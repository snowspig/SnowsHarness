// server.js — MCP JSON-RPC 2.0 server for SnowsHarness Code Index.
// Pure Node.js, zero external dependencies. Communicates over stdio.
// Exposes four tools: code_search, code_explore, code_callers, code_impact.
"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Database } = require("./database");
const { explore } = require("./explorer");

// Server identity.
const SERVER_NAME = "snows-index";
const SERVER_VERSION = "1.0.0";
const PROTOCOL_VERSION = "2025-03-26";

// Guidance for the LLM agent (rendered in initialize response).
const INSTRUCTIONS = [
  "SnowsHarness Code Index — pre-indexed code knowledge graph.",
  "When .snows-index/ exists, use these tools instead of grep/read for code exploration:",
  "- code_search: Find symbols by name",
  "- code_explore: Get definition + call relationships + context in ONE call",
  "- code_callers: Find what calls a symbol",
  "- code_impact: Analyze blast radius of changes",
  "Treat returned source as already read — don't re-verify with grep/read.",
].join("\n");

// Tool definitions (returned by tools/list).
const TOOL_DEFS = [
  {
    name: "code_search",
    description:
      "Search for code symbols by name across the indexed project. Returns matching functions, classes, methods with file locations.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Symbol name to search for",
        },
        kind: {
          type: "string",
          description:
            "Filter by kind: function, class, method, interface, etc.",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "code_explore",
    description:
      "Get comprehensive context for a symbol: its definition, callers, callees, and related code. One call replaces multiple grep/read cycles.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Symbol name or natural language query about code structure",
        },
        depth: {
          type: "number",
          description: "Traversal depth (default 2, max 3)",
        },
        budget: {
          type: "number",
          description: "Max output characters (default 8000)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "code_callers",
    description: "Find all functions/methods that call the given symbol.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Symbol name",
        },
        limit: {
          type: "number",
          description: "Max results (default 30)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "code_impact",
    description:
      "Analyze what code would be affected by changing a symbol. Shows direct and transitive dependents.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Symbol name",
        },
        depth: {
          type: "number",
          description: "Transitive depth (default 2)",
        },
      },
      required: ["name"],
    },
  },
];

// Find the project root containing .snows-index/. Walk up from cwd.
function findProjectDir() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".snows-index"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback to cwd even if no index — handlers will surface a clear error.
  return process.cwd();
}

// Open the database, run async fn, always close.
async function withDb(projectDir, fn) {
  const dbPath = path.join(projectDir, ".snows-index", "index.db");
  if (!fs.existsSync(path.dirname(dbPath))) {
    throw new Error(
      `No code index found at ${path.dirname(dbPath)}. Run the indexer first.`,
    );
  }
  const db = new Database(dbPath);
  await db.init();
  try {
    return await fn(db);
  } finally {
    try {
      await db.close();
    } catch (err) {
      // best-effort close
    }
  }
}

// -- Tool handlers --

async function handleCodeSearch(args) {
  const query = String(args.query || "");
  const kind = args.kind || null;
  const limit = args.limit || 20;
  const projectDir = findProjectDir();
  return withDb(projectDir, async (db) => {
    const results = await db.searchSymbols(query, { kind, limit });
    if (results.length === 0) {
      return `No symbols found matching "${query}".`;
    }
    const lines = results.map((s) => {
      const sig = s.signature ? `  ${s.signature}` : "";
      return `${s.kind} ${s.name} — ${s.filePath}:${s.line}${sig}`;
    });
    return (
      `[Search results for "${query}"] (${results.length})\n` + lines.join("\n")
    );
  });
}

async function handleCodeExplore(args) {
  const query = String(args.query || "");
  const depth = Math.min(args.depth || 2, 3);
  const budget = args.budget || 8000;
  const projectDir = findProjectDir();
  return withDb(projectDir, async (db) => {
    return explore(db, query, projectDir, { depth, budget });
  });
}

async function handleCodeCallers(args) {
  const name = String(args.name || "");
  const limit = args.limit || 30;
  const projectDir = findProjectDir();
  return withDb(projectDir, async (db) => {
    const edges = await db.findCallers(name, limit);
    if (edges.length === 0) {
      return `No callers found for "${name}".`;
    }
    const lines = edges.map(
      (e) =>
        `${e.sourceName} in ${e.sourceFile}:${e.line || "?"} calls ${name}`,
    );
    return `[Callers of ${name}] (${edges.length})\n` + lines.join("\n");
  });
}

async function handleCodeImpact(args) {
  const name = String(args.name || "");
  const depth = args.depth || 2;
  const projectDir = findProjectDir();
  return withDb(projectDir, async (db) => {
    const items = await db.getImpactRadius(name, depth);
    if (items.length === 0) {
      return `No dependents found for "${name}" within depth ${depth}.`;
    }
    const byDist = new Map();
    for (const { symbol, distance } of items) {
      if (!byDist.has(distance)) byDist.set(distance, []);
      byDist.get(distance).push(symbol);
    }
    const sections = [];
    for (let d = 1; d <= depth; d++) {
      const bucket = byDist.get(d) || [];
      if (bucket.length === 0) continue;
      const label = d === 1 ? "Direct" : `Transitive depth ${d}`;
      const lines = bucket.map(
        (s) => `- ${s.name} (${s.kind}) in ${s.filePath}:${s.line}`,
      );
      sections.push(`[${label}] (${bucket.length})\n${lines.join("\n")}`);
    }
    return `[Impact radius for ${name}]\n` + sections.join("\n\n");
  });
}

const TOOL_HANDLERS = {
  code_search: handleCodeSearch,
  code_explore: handleCodeExplore,
  code_callers: handleCodeCallers,
  code_impact: handleCodeImpact,
};

// -- JSON-RPC dispatcher --

function sendResponse(id, result) {
  const msg = { jsonrpc: "2.0", id, result };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendError(id, code, message) {
  const msg = {
    jsonrpc: "2.0",
    id: id !== undefined ? id : null,
    error: { code, message },
  };
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function logDebug(text) {
  if (process.env.SNOWS_INDEX_DEBUG) {
    process.stderr.write(`[code-index-mcp] ${text}\n`);
  }
}

async function handleMessage(msg) {
  const { id, method, params } = msg;
  logDebug(`<- ${method}`);

  if (method === "initialize") {
    return sendResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions: INSTRUCTIONS,
    });
  }

  if (method === "notifications/initialized") {
    return; // notification, no response
  }

  if (method === "ping") {
    return sendResponse(id, {});
  }

  if (method === "tools/list") {
    return sendResponse(id, { tools: TOOL_DEFS });
  }

  if (method === "tools/call") {
    const toolName = params && params.name;
    const args = (params && params.arguments) || {};
    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      return sendResponse(id, {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      });
    }
    try {
      const text = await handler(args);
      return sendResponse(id, {
        content: [{ type: "text", text: String(text) }],
        isError: false,
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      logDebug(`tool ${toolName} error: ${message}`);
      return sendResponse(id, {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      });
    }
  }

  // Unknown method.
  return sendError(id, -32601, `Method not found: ${method}`);
}

function start() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (err) {
      sendError(null, -32700, `Parse error: ${err.message}`);
      return;
    }
    Promise.resolve()
      .then(() => handleMessage(msg))
      .catch((err) => {
        logDebug(`unhandled error: ${err && err.stack ? err.stack : err}`);
        sendError(msg.id, -32603, "Internal error");
      });
  });

  rl.on("close", () => {
    logDebug("stdin closed, shutting down");
    process.exit(0);
  });

  process.stderr.write(
    `[code-index-mcp] ${SERVER_NAME} v${SERVER_VERSION} started\n`,
  );
}

module.exports = { start };
