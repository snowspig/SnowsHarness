// database.js — SQLite/JSON storage layer for the code indexing system.
// Pure Node.js, ZERO external dependencies. Uses node:sqlite when available
// (Node 22.5+) and falls back to a flat JSON file otherwise.

"use strict";

const fs = require("fs");
const path = require("path");

// Backend detection. node:sqlite is experimental and may not be compiled in.
let sqliteModule = null;
try {
  sqliteModule = require("node:sqlite");
} catch (err) {
  sqliteModule = null;
}

const hasSQLite = sqliteModule !== null;
const DatabaseSync = hasSQLite ? sqliteModule.DatabaseSync : null;

/**
 * Database class — unified interface for SQLite or JSON-backed storage.
 * All public methods are async even when the underlying op is synchronous.
 */
class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.kind = hasSQLite && dbPath.endsWith(".db") ? "sqlite" : "json";
    this._db = null; // SQLite handle
    this._state = null; // JSON in-memory state
  }

  async init() {
    if (this.kind === "sqlite") {
      const dir = path.dirname(this.dbPath);
      fs.mkdirSync(dir, { recursive: true });
      this._db = new DatabaseSync(this.dbPath);
      this._db.exec("PRAGMA journal_mode=WAL;");
      this._db.exec("PRAGMA foreign_keys=ON;");
      this._db.exec(SCHEMA_SQL);
      return;
    }
    // JSON fallback.
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, "utf8");
        this._state = JSON.parse(raw);
      } catch (err) {
        process.stderr.write(
          `database.js: corrupt JSON index, rebuilding: ${err.message}\n`,
        );
        this._state = null;
      }
    }
    if (!this._state) {
      this._state = {
        meta: { version: 1, createdAt: new Date().toISOString() },
        files: {},
        symbols: [],
        edges: [],
      };
    }
  }

  // -- Files --

  async upsertFile(fileRecord) {
    if (this.kind === "sqlite") {
      const sql = `
        INSERT INTO files (path, language, mtime, hash, symbol_count, line_count, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          language=excluded.language,
          mtime=excluded.mtime,
          hash=excluded.hash,
          symbol_count=excluded.symbol_count,
          line_count=excluded.line_count,
          indexed_at=excluded.indexed_at
      `;
      this._db
        .prepare(sql)
        .run(
          fileRecord.path,
          fileRecord.language || null,
          String(fileRecord.mtime),
          fileRecord.hash,
          fileRecord.symbolCount || 0,
          fileRecord.lineCount || 0,
          new Date().toISOString(),
        );
      return;
    }
    this._state.files[fileRecord.path] = {
      path: fileRecord.path,
      language: fileRecord.language || null,
      mtime: String(fileRecord.mtime),
      hash: fileRecord.hash,
      symbolCount: fileRecord.symbolCount || 0,
      lineCount: fileRecord.lineCount || 0,
      indexedAt: new Date().toISOString(),
    };
  }

  async getFile(filePath) {
    if (this.kind === "sqlite") {
      const row = this._db
        .prepare("SELECT * FROM files WHERE path = ?")
        .get(filePath);
      if (!row) return null;
      return {
        path: row.path,
        language: row.language,
        mtime: row.mtime,
        hash: row.hash,
        symbolCount: row.symbol_count,
        lineCount: row.line_count,
        indexedAt: row.indexed_at,
      };
    }
    return this._state.files[filePath] || null;
  }

  async getChangedFiles(currentFiles) {
    const changed = [];
    const seen = new Set();
    for (const [p, info] of Object.entries(currentFiles)) {
      seen.add(p);
      const existing = await this.getFile(p);
      if (!existing) {
        changed.push({ path: p, status: "new" });
      } else if (existing.hash !== info.hash) {
        changed.push({ path: p, status: "modified" });
      }
    }
    for (const p of Object.keys(this._stateOrFiles())) {
      if (!seen.has(p)) changed.push({ path: p, status: "deleted" });
    }
    return changed;
  }

  _stateOrFiles() {
    if (this.kind === "sqlite") {
      const rows = this._db.prepare("SELECT path FROM files").all();
      const map = {};
      for (const r of rows) map[r.path] = true;
      return map;
    }
    return this._state.files;
  }

  async deleteFileSymbols(filePath) {
    if (this.kind === "sqlite") {
      this._db.prepare("DELETE FROM symbols WHERE file_path = ?").run(filePath);
      this._db.prepare("DELETE FROM edges WHERE file_path = ?").run(filePath);
      return;
    }
    this._state.symbols = this._state.symbols.filter(
      (s) => s.filePath !== filePath,
    );
    this._state.edges = this._state.edges.filter(
      (e) => e.filePath !== filePath,
    );
  }

  // -- Symbols --

  async insertSymbol(symbol) {
    if (this.kind === "sqlite") {
      const stmt = this._db.prepare(`
        INSERT OR IGNORE INTO symbols
          (file_path, name, kind, line, end_line, signature, modifiers, parent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        symbol.filePath,
        symbol.name,
        symbol.kind,
        symbol.line,
        symbol.endLine || null,
        symbol.signature || null,
        JSON.stringify(symbol.modifiers || []),
        symbol.parent || null,
      );
      // When IGNORE skips a duplicate, lastInsertRowid may be 0; resolve
      // the real id by lookup so the caller always gets a valid id.
      if (info.lastInsertRowid && info.lastInsertRowid !== 0) {
        return Number(info.lastInsertRowid);
      }
      const row = this._db
        .prepare(
          "SELECT id FROM symbols WHERE file_path=? AND name=? AND kind=? AND line=?",
        )
        .get(symbol.filePath, symbol.name, symbol.kind, symbol.line);
      return row ? row.id : 0;
    }
    const id = this._state.symbols.length + 1;
    this._state.symbols.push({
      id,
      filePath: symbol.filePath,
      name: symbol.name,
      kind: symbol.kind,
      line: symbol.line,
      endLine: symbol.endLine || null,
      signature: symbol.signature || null,
      modifiers: symbol.modifiers || [],
      parent: symbol.parent || null,
    });
    return id;
  }

  // -- Edges --

  async insertEdge(edge) {
    if (this.kind === "sqlite") {
      const stmt = this._db.prepare(`
        INSERT OR IGNORE INTO edges
          (source_file, source_name, target_name, edge_type, file_path, line)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        edge.sourceFile,
        edge.sourceName,
        edge.targetName,
        edge.edgeType,
        edge.filePath,
        edge.line || null,
      );
      return;
    }
    const exists = this._state.edges.some(
      (e) =>
        e.sourceFile === edge.sourceFile &&
        e.sourceName === edge.sourceName &&
        e.targetName === edge.targetName &&
        e.edgeType === edge.edgeType &&
        e.filePath === edge.filePath,
    );
    if (exists) return;
    this._state.edges.push({ ...edge });
  }

  // -- Queries --

  async searchSymbols(query, options = {}) {
    const limit = options.limit || 50;
    const kind = options.kind || null;
    if (this.kind === "sqlite") {
      try {
        // FTS5 query — escape by quoting each token.
        const ftsQuery = sanitizeFtsQuery(query);
        let sql = `
          SELECT s.* FROM symbols_fts f
          JOIN symbols s ON s.id = f.rowid
          WHERE symbols_fts MATCH ?
        `;
        const params = [ftsQuery];
        if (kind) {
          sql += " AND s.kind = ?";
          params.push(kind);
        }
        sql += " ORDER BY bm25(symbols_fts) LIMIT ?";
        params.push(limit);
        const rows = this._db.prepare(sql).all(...params);
        return rows.map(rowToSymbol);
      } catch (err) {
        // Fall back to LIKE if FTS5 query is malformed.
        return this._searchSymbolsLike(query, kind, limit);
      }
    }
    const q = query.toLowerCase();
    return this._state.symbols
      .filter(
        (s) =>
          (s.name.toLowerCase().includes(q) ||
            (s.signature || "").toLowerCase().includes(q)) &&
          (!kind || s.kind === kind),
      )
      .slice(0, limit)
      .map((s) => ({ ...s, modifiers: s.modifiers || [] }));
  }

  _searchSymbolsLike(query, kind, limit) {
    const q = `%${query}%`;
    let sql = `
      SELECT * FROM symbols
      WHERE (name LIKE ? OR signature LIKE ?)
    `;
    const params = [q, q];
    if (kind) {
      sql += " AND kind = ?";
      params.push(kind);
    }
    sql += " LIMIT ?";
    params.push(limit);
    return this._db
      .prepare(sql)
      .all(...params)
      .map(rowToSymbol);
  }

  async findCallers(name, limit = 100) {
    if (this.kind === "sqlite") {
      const rows = this._db
        .prepare(
          `SELECT * FROM edges
           WHERE target_name = ? AND edge_type = 'calls'
           LIMIT ?`,
        )
        .all(name, limit);
      return rows.map(rowToEdge);
    }
    return this._state.edges
      .filter((e) => e.targetName === name && e.edgeType === "calls")
      .slice(0, limit);
  }

  async findCallees(sourceFile, name, limit = 100) {
    if (this.kind === "sqlite") {
      const rows = this._db
        .prepare(
          `SELECT * FROM edges
           WHERE source_name = ? AND edge_type = 'calls'
           LIMIT ?`,
        )
        .all(name, limit);
      return rows.map(rowToEdge);
    }
    return this._state.edges
      .filter((e) => e.sourceName === name && e.edgeType === "calls")
      .slice(0, limit);
  }

  async getImpactRadius(name, depth = 2) {
    if (depth <= 0) return [];
    const visited = new Map(); // name -> distance
    const queue = [{ name, distance: 0 }];
    while (queue.length > 0) {
      const { name: cur, distance } = queue.shift();
      if (visited.has(cur)) continue;
      visited.set(cur, distance);
      if (distance >= depth) continue;
      const incoming = await this.findCallers(cur, 500);
      for (const e of incoming) {
        if (!visited.has(e.sourceName)) {
          queue.push({ name: e.sourceName, distance: distance + 1 });
        }
      }
    }
    const results = [];
    for (const [n, d] of visited) {
      if (d === 0) continue; // skip the seed
      const sym = await this._findSymbolByName(n);
      if (sym) results.push({ symbol: sym, distance: d });
    }
    return results;
  }

  async _findSymbolByName(name) {
    if (this.kind === "sqlite") {
      const row = this._db
        .prepare("SELECT * FROM symbols WHERE name = ? LIMIT 1")
        .get(name);
      return row ? rowToSymbol(row) : null;
    }
    return this._state.symbols.find((s) => s.name === name) || null;
  }

  async getStats() {
    const symbolsByKind = {};
    if (this.kind === "sqlite") {
      const fc = this._db.prepare("SELECT COUNT(*) AS c FROM files").get().c;
      const sc = this._db.prepare("SELECT COUNT(*) AS c FROM symbols").get().c;
      const ec = this._db.prepare("SELECT COUNT(*) AS c FROM edges").get().c;
      const kindRows = this._db
        .prepare("SELECT kind, COUNT(*) AS c FROM symbols GROUP BY kind")
        .all();
      for (const r of kindRows) symbolsByKind[r.kind] = r.c;
      let size = 0;
      try {
        size = fs.statSync(this.dbPath).size;
      } catch (err) {
        size = 0;
      }
      return {
        fileCount: fc,
        symbolCount: sc,
        edgeCount: ec,
        symbolsByKind,
        dbSizeBytes: size,
      };
    }
    for (const s of this._state.symbols) {
      symbolsByKind[s.kind] = (symbolsByKind[s.kind] || 0) + 1;
    }
    let size = 0;
    try {
      size = fs.statSync(this.dbPath).size;
    } catch (err) {
      size = 0;
    }
    return {
      fileCount: Object.keys(this._state.files).length,
      symbolCount: this._state.symbols.length,
      edgeCount: this._state.edges.length,
      symbolsByKind,
      dbSizeBytes: size,
    };
  }

  async close() {
    if (this.kind === "sqlite") {
      if (this._db) {
        this._db.close();
        this._db = null;
      }
      return;
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(this._state, null, 2), "utf8");
  }
}

// -- Helpers --

const rowToSymbol = (row) => ({
  id: row.id,
  filePath: row.file_path,
  name: row.name,
  kind: row.kind,
  line: row.line,
  endLine: row.end_line,
  signature: row.signature,
  modifiers: row.modifiers ? safeJsonParse(row.modifiers, []) : [],
  parent: row.parent,
});

const rowToEdge = (row) => ({
  id: row.id,
  sourceFile: row.source_file,
  sourceName: row.source_name,
  targetName: row.target_name,
  edgeType: row.edge_type,
  filePath: row.file_path,
  line: row.line,
});

const safeJsonParse = (s, fallback) => {
  try {
    return JSON.parse(s);
  } catch (err) {
    return fallback;
  }
};

/**
 * Sanitize a free-text query for FTS5 MATCH. FTS5 reserves several
 * characters (", *, :, (, ), etc.) — wrap each whitespace-separated
 * token in double quotes to treat them as literal substrings.
 */
const sanitizeFtsQuery = (query) => {
  if (!query || !query.trim()) return '""';
  return query
    .split(/\s+/)
    .map((tok) => {
      const cleaned = tok.replace(/"/g, '""');
      return `"${cleaned}"`;
    })
    .join(" ");
};

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    language TEXT,
    mtime TEXT NOT NULL,
    hash TEXT NOT NULL,
    symbol_count INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,
    indexed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS symbols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    line INTEGER NOT NULL,
    end_line INTEGER,
    signature TEXT,
    modifiers TEXT,
    parent TEXT,
    UNIQUE(file_path, name, kind, line)
  );

  CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT NOT NULL,
    source_name TEXT NOT NULL,
    target_name TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    line INTEGER,
    UNIQUE(source_file, source_name, target_name, edge_type, file_path)
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
    name, signature, kind,
    content='symbols', content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
    INSERT INTO symbols_fts(rowid, name, signature, kind)
    VALUES (new.id, new.name, new.signature, new.kind);
  END;
  CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
    INSERT INTO symbols_fts(symbols_fts, rowid, name, signature, kind)
    VALUES ('delete', old.id, old.name, old.signature, old.kind);
  END;

  CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
  CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
  CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
  CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_name);
  CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_name);
  CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);
`;

module.exports = { Database, hasSQLite };
