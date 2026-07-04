#!/usr/bin/env node
// code-index-mcp.js — MCP server entry point for SnowsHarness Code Index.
// Exposes code indexing tools to Claude Code via JSON-RPC 2.0 over stdio.
// Pure Node.js, zero external dependencies.
"use strict";
require("./code-index/server").start();
