# /context-audit

Analyze current context window usage and prompt header size.

## Steps

1. Run `/doctor` to get current session info
2. List all active rules loaded:
   - Global rules from `~/.claude/rules/`
   - Project rules from `.claude/rules/` (if in a project)
   - CLAUDE.md content
3. List all active plugins and their estimated token contribution
4. List all active hooks
5. Calculate approximate token breakdown:
   - System prompt (base)
   - Rules
   - Plugins/skills
   - Memory
   - Hooks config
6. Identify redundancies and optimization opportunities

## Output Format

```
Context Audit Report
═══════════════════
Rules:       N files (~X tokens)
Plugins:     N plugins (~X tokens)
Hooks:       N hooks
Memory:      N files (~X tokens)
───────────────────────────
Suggestions: [list or "No issues found"]
```

## Suggestions to Look For

- Duplicate rules across global and project level
- Unused plugins that add significant token overhead
- Overly verbose rule files that could be condensed
- Hooks that overlap in function
