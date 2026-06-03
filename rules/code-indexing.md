## Code Indexing

When `.snows-index/` exists in the project root, a pre-indexed code knowledge graph is available via MCP tools. Use it instead of grep/read for code exploration.

### Tool Selection

- **`code_explore`** — Use for "how does X work", "show me X and its context", or understanding a code area. Returns definition + callers + callees in ONE call.
- **`code_search`** — Use to quickly find where a symbol is defined. Returns locations only.
- **`code_callers`** — Use to find what calls a specific function/method.
- **`code_impact`** — Use before editing to understand blast radius.

### Guidelines

- Treat returned source code as already read — do NOT re-verify with grep or Read.
- For flow questions ("how does X reach Y"), use `code_explore` first.
- For refactoring, use `code_search` → `code_callers` → `code_impact` to understand dependencies before editing.
- If the index is missing or stale, offer to run `node ~/.claude/hooks/code-index-init.js` to rebuild.
- The index auto-updates when files are written. For manual refresh: `/index rebuild`.
