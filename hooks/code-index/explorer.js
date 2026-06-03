// explorer.js — Core code-explore algorithm for SnowsHarness Code Index.
// Given a query, finds the most relevant symbol, reads its source from disk,
// then BFS-traverses callers/callees to build a budget-limited context window.
// Pure Node.js, zero external dependencies.
"use strict";

const fs = require("fs");
const path = require("path");

// Kind priority used when ranking candidate root symbols (lower = higher).
const KIND_PRIORITY = {
  class: 0,
  interface: 1,
  function: 2,
  method: 3,
  variable: 4,
  constant: 5,
};

const DEFAULT_BUDGET = 8000;
const ROOT_SNIPPET_CAP = 2000; // root definition may exceed this but is always shown in full
const RELATED_SNIPPET_CAP = 500;
const RELATION_SNIPPET_CAP = 400;

// Step 1: rank candidate symbols. Exact name match wins; otherwise kind priority.
function rankCandidates(symbols, query) {
  if (symbols.length === 0) return null;
  const q = query.toLowerCase();
  const scored = symbols.map((s) => {
    const nameLower = (s.name || "").toLowerCase();
    let score =
      KIND_PRIORITY[s.kind] !== undefined ? KIND_PRIORITY[s.kind] : 99;
    if (nameLower === q)
      score -= 10; // exact match wins big
    else if (nameLower.startsWith(q)) score -= 3;
    else if (nameLower.includes(q)) score -= 1;
    return { s, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].s;
}

// Read lines [start, end] (1-based, inclusive) from a file. Returns "" on error.
function readSnippet(projectDir, filePath, startLine, endLine) {
  try {
    const abs = path.join(projectDir, filePath);
    if (!fs.existsSync(abs)) return "";
    const content = fs.readFileSync(abs, "utf8");
    const lines = content.split(/\r?\n/);
    const s = Math.max(1, Number(startLine) || 1);
    let e = endLine ? Number(endLine) : s + 14;
    if (Number.isNaN(e) || e < s) e = s + 14;
    e = Math.min(lines.length, e);
    return lines.slice(s - 1, e).join("\n");
  } catch (err) {
    return "";
  }
}

// Truncate a string at a soft boundary (newline preferred).
function softTruncate(text, cap) {
  if (!text) return "";
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const lastNl = cut.lastIndexOf("\n");
  if (lastNl > cap * 0.6) return cut.slice(0, lastNl) + "\n  …";
  return cut + "…";
}

// Cap a string at `n` characters, returning a marker if truncated.
function cap(text, n) {
  if (!text) return "";
  if (text.length <= n) return text;
  return text.slice(0, n) + "…";
}

function dedupKey(s) {
  return `${s.name}::${s.filePath}::${s.line}`;
}

function symbolFromEdge(edge) {
  // Edges don't carry full symbol metadata, so synthesize a minimal record.
  return {
    name: edge.sourceName,
    filePath: edge.filePath || edge.sourceFile,
    line: edge.line,
    endLine: null,
    kind: "function",
    signature: null,
    modifiers: [],
    parent: null,
  };
}

// Main export. Returns a text context window for `query`.
async function explore(db, query, projectDir, options = {}) {
  try {
    const depth = options.depth || 2;
    const budget = options.budget || DEFAULT_BUDGET;

    if (!query || !query.trim()) {
      return "Error: empty query.";
    }

    // Step 1: find root symbol.
    const candidates = await db.searchSymbols(query, { limit: 5 });
    const root = rankCandidates(candidates, query);
    if (!root) {
      return `No symbols found matching "${query}". Try code_search with a broader query.`;
    }

    // Budget allocation (root is exempt; tracked separately).
    const callerBudget = Math.floor(budget * 0.4);
    const calleeBudget = Math.floor(budget * 0.4);
    const relatedBudget = Math.floor(budget * 0.2);

    // Step 2: read root definition.
    const rootSource = readSnippet(
      projectDir,
      root.filePath,
      root.line,
      root.endLine,
    );
    const rootText = softTruncate(rootSource, ROOT_SNIPPET_CAP);

    // Step 3: BFS — gather callers (incoming) and callees (outgoing).
    const callerEdges = await db.findCallers(root.name, 100);
    const calleeEdges = await db.findCallees(root.filePath, root.name, 100);

    // Dedup helpers.
    const seen = new Set();
    const collect = (arr) => {
      const out = [];
      for (const sym of arr) {
        const k = dedupKey(sym);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(sym);
      }
      return out;
    };

    // Step 4 (depth >= 2): second-hop callees.
    let transitiveCallees = [];
    if (depth >= 2) {
      for (const edge of calleeEdges.slice(0, 10)) {
        const next = await db.findCallees(
          edge.filePath || edge.sourceFile,
          edge.targetName,
          50,
        );
        for (const n of next) {
          const sym = symbolFromEdge(n);
          sym._depth = 2;
          transitiveCallees.push(sym);
        }
      }
    }
    transitiveCallees = collect(transitiveCallees);

    // Related: siblings under same parent (e.g. other methods in the same class).
    let related = [];
    if (root.parent) {
      // We don't have a "list siblings" query, so pull edges/callees of parent
      // is overkill. Instead, search by parent name.
      try {
        const siblingHits = await db.searchSymbols(root.parent, { limit: 30 });
        for (const s of siblingHits) {
          if (s.name === root.name && s.filePath === root.filePath) continue;
          related.push(s);
        }
      } catch (err) {
        // best-effort
      }
    }
    related = collect(related).slice(0, 15);

    // Build caller/callee symbol records.
    const callers = collect(callerEdges.map((e) => symbolFromEdge(e))).slice(
      0,
      30,
    );
    const callees = collect(calleeEdges.map((e) => symbolFromEdge(e))).slice(
      0,
      30,
    );

    // Step 5: format output, respecting per-section budget.
    const sections = [];

    // Root definition (no budget cap beyond ROOT_SNIPPET_CAP).
    const rootSig = root.signature ? `\n  ${root.signature}` : "";
    sections.push(
      `[Definition] ${root.name} (${root.kind}) — ${root.filePath}:${root.line}${rootSig}\n${rootText || "(source not found on disk)"}`,
    );

    // Callers (up to 40% of budget).
    if (callers.length > 0) {
      const lines = [`[Called by] (${callers.length})`];
      let used = 0;
      for (const c of callers) {
        if (used >= callerBudget) {
          lines.push(
            `- … (budget exhausted, ${callers.length - lines.length + 1} more)`,
          );
          break;
        }
        const header = `- ${c.name} in ${c.filePath}:${c.line || "?"}`;
        lines.push(header);
        used += header.length + 1;
        if (used < callerBudget) {
          const snip = cap(
            readSnippet(projectDir, c.filePath, c.line, c.endLine),
            RELATION_SNIPPET_CAP,
          );
          if (snip) {
            lines.push("  " + snip.split("\n").join("\n  "));
            used += snip.length + 4;
          }
        }
      }
      sections.push(lines.join("\n"));
    }

    // Callees (up to 40% of budget).
    if (callees.length > 0) {
      const lines = [`[Calls] (${callees.length})`];
      let used = 0;
      for (const c of callees) {
        if (used >= calleeBudget) {
          lines.push(
            `- … (budget exhausted, ${callees.length - lines.length + 1} more)`,
          );
          break;
        }
        const header = `- ${c.name} in ${c.filePath}:${c.line || "?"}`;
        lines.push(header);
        used += header.length + 1;
        if (used < calleeBudget) {
          const snip = cap(
            readSnippet(projectDir, c.filePath, c.line, c.endLine),
            RELATION_SNIPPET_CAP,
          );
          if (snip) {
            lines.push("  " + snip.split("\n").join("\n  "));
            used += snip.length + 4;
          }
        }
      }
      sections.push(lines.join("\n"));
    }

    // Transitive callees (folded into [Calls] section, depth-marked).
    if (transitiveCallees.length > 0) {
      const lines = [`[Transitive depth 2] (${transitiveCallees.length})`];
      let used = 0;
      for (const c of transitiveCallees) {
        if (used >= Math.floor(calleeBudget / 2)) {
          lines.push(`- … (budget exhausted)`);
          break;
        }
        lines.push(`- ${c.name} in ${c.filePath}:${c.line || "?"}`);
        used += c.name.length + (c.filePath || "").length + 10;
      }
      sections.push(lines.join("\n"));
    }

    // Related (up to 20% of budget).
    if (related.length > 0) {
      const lines = [`[Related] (${related.length})`];
      let used = 0;
      for (const r of related) {
        if (used >= relatedBudget) {
          lines.push(`- … (budget exhausted)`);
          break;
        }
        const sig = r.signature ? `  ${r.signature}` : "";
        const header = `- ${r.name} (${r.kind}) in ${r.filePath}:${r.line}${sig}`;
        lines.push(header);
        used += header.length + 1;
        if (used < relatedBudget) {
          const snip = cap(
            readSnippet(projectDir, r.filePath, r.line, r.endLine),
            RELATED_SNIPPET_CAP,
          );
          if (snip) {
            lines.push("  " + snip.split("\n").join("\n  "));
            used += snip.length + 4;
          }
        }
      }
      sections.push(lines.join("\n"));
    }

    return sections.join("\n\n");
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    return `Explore error: ${message}`;
  }
}

module.exports = { explore };
