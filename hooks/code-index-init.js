/**
 * Code Index Init Hook (SessionStart)
 *
 * On session start, builds or updates the SnowsHarness code index
 * stored under `<projectDir>/.snows-index/`.
 *
 * Behavior:
 * - First run: walks the project, extracts symbols/edges from every
 *   source file, and writes them to the index database.
 * - Subsequent runs: diffs current files against the indexed set and
 *   re-extracts only new / modified / deleted files.
 * - Non-code projects (zero source files) are silently ignored.
 * - Hard-capped at 15 seconds. If indexing takes longer we abort and
 *   warn the user, never block the session.
 *
 * Why: A persistent, local code index lets every Claude Code session
 *   start with a searchable map of the project's symbols and call
 *   edges without re-scanning the repo each time.
 * Remove when: Claude gains a native, persistent code indexer.
 */

const fs = require("fs");
const path = require("path");
const {
  walkSourceFiles,
  contentHash,
  isSourceFile,
} = require("./code-index/utils");
const { extractSymbols } = require("./code-index/extractors");
const { Database } = require("./code-index/database");

const INDEX_DIR = ".snows-index";
const DB_FILENAME = "index.db";
const TIMEOUT_MS = 15_000;

const log = (msg) => {
  try {
    process.stderr.write(`${msg}\n`);
  } catch {
    /* ignore */
  }
};

const warn = (msg) => log(`[CODE INDEX] WARN: ${msg}`);

const resolveProjectDir = () => {
  return (
    process.env.CLAUDE_PROJECT_DIR || process.env.PROJECT_DIR || process.cwd()
  );
};

const withTimeout = (promise, ms, onTimeout) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      onTimeout();
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
};

/**
 * Read a source file from disk, returning null on any failure.
 */
const safeReadFile = (absPath) => {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
};

/**
 * Extract symbols + edges from a single file and persist them.
 * Returns the number of symbols written.
 */
const indexFile = async (db, file) => {
  const absPath = path.join(resolveProjectDir(), file.path);
  const content = safeReadFile(absPath);
  if (content === null) return 0;

  const hash = contentHash(content);
  const { symbols, calls } = extractSymbols(content, file.language, file.path);
  const lineCount = content.split("\n").length;

  // Replace any prior symbols/edges for this file so re-indexing stays
  // consistent even if the file shrank.
  await db.deleteFileSymbols(file.path);

  for (const sym of symbols) {
    await db.insertSymbol({
      filePath: file.path,
      name: sym.name,
      kind: sym.kind,
      line: sym.line,
      endLine: sym.endLine || null,
      signature: sym.signature || null,
      modifiers: sym.modifiers || [],
      parent: sym.parent || null,
    });
  }

  for (const call of calls) {
    await db.insertEdge({
      sourceFile: file.path,
      sourceName: null,
      targetName: call.name,
      edgeType: "calls",
      filePath: file.path,
      line: call.line || null,
    });
  }

  await db.upsertFile({
    path: file.path,
    language: file.language,
    mtime: file.mtime,
    hash,
    symbolCount: symbols.length,
    lineCount,
  });

  return symbols.length;
};

const buildInitialIndex = async (projectDir, files) => {
  const dbPath = path.join(projectDir, INDEX_DIR, DB_FILENAME);
  const db = new Database(dbPath);
  await db.init();

  let totalSymbols = 0;
  for (const file of files) {
    try {
      totalSymbols += await indexFile(db, file);
    } catch (err) {
      warn(`failed to index ${file.path}: ${err.message}`);
    }
  }

  await db.close();
  return totalSymbols;
};

const updateExistingIndex = async (projectDir, files) => {
  const dbPath = path.join(projectDir, INDEX_DIR, DB_FILENAME);
  const db = new Database(dbPath);
  await db.init();

  // Build {path: {hash}} map expected by Database.getChangedFiles.
  const currentFileMap = {};
  for (const file of files) {
    const absPath = path.join(projectDir, file.path);
    const content = safeReadFile(absPath);
    if (content === null) continue;
    currentFileMap[file.path] = {
      path: file.path,
      language: file.language,
      mtime: file.mtime,
      hash: contentHash(content),
    };
  }

  const changes = await db.getChangedFiles(currentFileMap);
  let updatedSymbols = 0;
  for (const change of changes) {
    if (change.status === "deleted") {
      try {
        await db.deleteFileSymbols(change.path);
      } catch (err) {
        warn(`failed to delete symbols for ${change.path}: ${err.message}`);
      }
      continue;
    }
    // new or modified — find the matching file metadata and re-index.
    const meta = currentFileMap[change.path];
    if (!meta) continue;
    try {
      updatedSymbols += await indexFile(db, meta);
    } catch (err) {
      warn(`failed to re-index ${change.path}: ${err.message}`);
    }
  }

  await db.close();
  return { updatedSymbols, changedCount: changes.length };
};

async function main() {
  // Drain stdin — SessionStart gives us a JSON blob we don't need.
  try {
    fs.readFileSync(0, "utf8");
  } catch {
    /* ignore */
  }

  const projectDir = resolveProjectDir();
  const indexDir = path.join(projectDir, INDEX_DIR);

  let files;
  try {
    files = walkSourceFiles(projectDir);
  } catch (err) {
    warn(`walk failed: ${err.message}`);
    return;
  }

  const isFirstRun = !fs.existsSync(indexDir);
  const fileCount = files.length;

  if (isFirstRun) {
    if (fileCount === 0) {
      // Not a code project — leave the index untouched.
      return;
    }
    let symbolCount = 0;
    try {
      symbolCount = await withTimeout(
        buildInitialIndex(projectDir, files),
        TIMEOUT_MS,
        () => {
          warn(
            `initial indexing exceeded ${TIMEOUT_MS / 1000}s budget; aborting`,
          );
        },
      );
    } catch (err) {
      warn(`initial indexing failed: ${err.message}`);
      return;
    }
    log(`[CODE INDEX] ${symbolCount} symbols, ${fileCount} files indexed`);
    return;
  }

  // Existing index — incremental update.
  try {
    const { updatedSymbols, changedCount } = await withTimeout(
      updateExistingIndex(projectDir, files),
      TIMEOUT_MS,
      () => {
        warn(`index update exceeded ${TIMEOUT_MS / 1000}s budget; aborting`);
      },
    );
    if (typeof updatedSymbols === "undefined") return; // timed out
    log(
      `[CODE INDEX] ${updatedSymbols} symbols, ${fileCount} files, ${changedCount} updated`,
    );
  } catch (err) {
    warn(`index update failed: ${err.message}`);
  }
}

main().catch((err) => {
  warn(err && err.message ? err.message : String(err));
});
