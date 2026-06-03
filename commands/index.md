# /index

Manage the SnowsHarness code index for the current project.

## Usage

`/index status` — Show index health: file count, symbol count, last indexed time
`/index rebuild` — Delete existing index and rebuild from scratch
`/index search <query>` — Search for symbols by name

## Steps

### If $ARGUMENTS is "status" or empty:

1. Run `node ~/.claude/hooks/code-index-init.js` to check/update the index
2. Report the status line: file count, symbol count, freshness

### If $ARGUMENTS is "rebuild":

1. Delete the `.snows-index/` directory in the project root
2. Run the indexer: `node ~/.claude/hooks/code-index-init.js`
3. Report the result

### If $ARGUMENTS starts with "search":

1. Extract the query from `$ARGUMENTS` (everything after "search ")
2. If no query, ask the user what to search for
3. Use the `code_search` MCP tool to find matching symbols
4. Display results grouped by file

### For any other argument:

Treat it as a search query and use `code_search`.
