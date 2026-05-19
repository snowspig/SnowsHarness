# /harness-check

Check the health and configuration of your Claude Code harness setup.

## Steps

1. **Global config**: Verify `~/.claude/settings.json` exists and is valid JSON
2. **Rules audit**: List all rules in `~/.claude/rules/` with file sizes
3. **Hooks audit**:
   - List all hooks in `~/.claude/hooks/`
   - Verify each hook's JS file exists and is syntactically valid (`node --check`)
   - Check hooks.json references match actual files
4. **Commands audit**: List all commands in `~/.claude/commands/`
5. **Agents audit**: List all agents in `~/.claude/agents/`
6. **Plugins audit**: List enabled plugins from settings.json
7. **Memory audit**: Check Memory Palace structure exists and is organized
8. **Connectivity**: Verify any configured MCP servers are reachable

## Output Format

```
Harness Health Check
════════════════════
✓ Global config     — valid
✓ Rules (N)         — N files, total X KB
⚠ Hooks (N)         — 1 issue found: [description]
✓ Commands (N)      — N commands registered
✓ Agents (N)        — N agents registered
✓ Plugins (N)       — N plugins enabled
✓ Memory            — organized
───────────────────────────
Issues: [list or "All clear"]
```

## Exit Codes

- All checks pass → report "All clear"
- Any check fails → report specific issues with fix suggestions
