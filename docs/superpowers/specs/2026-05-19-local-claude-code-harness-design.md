# Local Claude Code Harness Enhancement - Design Spec

**Date**: 2026-05-19
**Status**: Draft
**Scope**: Global Claude Code configuration at `C:\Users\Tao\.claude\`

---

## Goal

Enhance local Claude Code usage through a refined harness that improves context management, automates repetitive tasks, and extends capabilities via custom commands/agents — while keeping the prompt header lean and reasonable.

**Principles:**
- Extract best patterns from reference repos (ECC, anthropics/skills, awesome-harness-engineering)
- Skip everything that overlaps with superpowers plugin or is overly heavy
- Prefer hooks for mechanical operations, rules for judgment calls
- Each component must answer "why it exists" and "when it should be removed"

---

## Architecture Overview

```
C:\Users\Tao\.claude\
├── settings.json              # Global permissions + hooks config + plugins
├── settings.local.json        # Local-only settings (not shared)
├── keybindings.json           # Keyboard shortcuts (existing)
├── rules/                     # Global rules (always in context)
│   ├── common/
│   │   ├── coding-style.md    # Existing — keep
│   │   ├── git-workflow.md    # Existing — keep
│   │   ├── memory-palace.md   # Existing — keep
│   │   ├── performance.md     # Existing — keep
│   │   ├── testing.md         # Existing — keep
│   │   ├── collaboration.md   # NEW — collaboration principles + state persistence
│   │   ├── file-organization.md # NEW — prevent root directory pollution
│   │   └── code-review.md     # NEW — review triage matrix
│   ├── frontend/
│   │   └── patterns.md        # Existing — keep
│   ├── python/
│   │   └── patterns.md        # Existing — keep
│   └── harness-quality.md     # NEW — harness self-audit rule
├── commands/                  # NEW — custom slash commands
│   ├── build-fix.md           # Build error diagnosis and fix
│   ├── context-audit.md       # Token budget audit
│   ├── commit-push-pr.md      # Commit + push + PR workflow
│   └── harness-check.md       # Harness health check
├── agents/                    # NEW — custom subagents
│   ├── build-error-resolver.md
│   ├── security-reviewer.md
│   ├── test-runner.md
│   └── docs-generator.md
├── hooks/                     # Hook scripts
│   ├── session-start.js       # Existing — keep
│   ├── project-context.js     # Existing — keep
│   ├── action-guard.js        # Existing — MODIFY: add config protection
│   ├── secret-detect.js       # Existing — keep
│   ├── output-size-warning.js # Existing — keep
│   ├── post-write-verify.js   # Existing — keep (real-time lint)
│   ├── session-end.js         # Existing — keep
│   ├── session-learner.js     # Existing — MODIFY: fix hardcoded path
│   ├── config-protection.js   # NEW — block config file edits
│   ├── change-safety.js       # NEW — detect stale-context edits
│   ├── suggest-compact.js     # NEW — suggest /compact at logical boundaries
│   └── batch-format.js        # NEW — stop-time batch formatting
├── skills/                    # Custom skills (local)
├── memory/                    # Memory Palace (existing)
└── teams/                     # Team collaboration (existing)
```

**Total estimated prompt header cost: ~920 tokens** (rules ~550 + hooks ~370)

---

## Part 1: Rules (New)

### 1.1 collaboration.md (~200 tokens)

```markdown
## Collaboration Principles

Start from the original requirement and root problem, not from conventions or templates:
- Do not assume the user knows exactly what they want — when motivation or goal
  is unclear, stop and discuss
- When the goal is clear but the chosen path is suboptimal — say so directly and
  suggest a better approach
- Always trace issues to root cause; never paper over problems — but match rigor
  to context (production code demands root cause; throwaway scripts need only work)
- Every decision must answer "why"
- Output only what changes decisions — cut everything else

## State Persistence

Persist state as it happens, not at context boundaries:
- When a task completes, a decision is made, or a correction occurs, write it to
  CLAUDE.md or memory immediately
- Before starting complex work, write current progress and next steps to
  .claude/plan.md so that context loss from /compact or session restart does not
  reset progress
```

### 1.2 file-organization.md (~100 tokens)

```markdown
## File Organization

Never create loose files in the project root.

Working files placement:
- Plans, specs, design docs → docs/ directory
- Temporary scripts (.py, .ps1, .sh for quick testing) → tmp/ directory
- Generated code → appropriate src/ or project subdirectory

Cleanup rules:
- Files in tmp/ are disposable — clean up when the task is complete
- Never leave debug_*, test_*, or ad-hoc .ps1/.py scripts in the project root

If unsure where a file belongs, ask before creating it.
```

### 1.3 code-review.md (~150 tokens)

```markdown
## Code Review Standards

When reviewing code, classify every finding by severity:

- **Blocker**: Will cause failures in production (security holes, data loss, crashes)
- **High**: Likely to cause problems soon (race conditions, missing error handling)
- **Medium**: Should be fixed but not urgent (code smells, missing tests, naming)
- **Nitpick**: Style preferences, minor readability improvements

Every finding must include: file path, line number, what's wrong, why it matters,
and a suggested fix. No finding without evidence.
```

### 1.4 harness-quality.md (~100 tokens)

```markdown
## Harness Quality

Every harness component (hook, rule, agent, command) should document:
- Why it exists (what model limitation it compensates for)
- What capability improvement would make it unnecessary

Review this file every 3 months or after major model upgrades.
Remove components that no longer provide value — fewer moving parts = fewer failures.
```

---

## Part 2: Hooks (New + Modified)

### 2.1 New Hooks

#### config-protection.js
- **Event**: PreToolUse, matches `Write|Edit`
- **Logic**: Block modifications to tool config files (eslint, prettier, tsconfig, ruff, pyproject.toml lint sections). Whitelist: CLAUDE.md, .claude/*, memory/*
- **Why**: Prevents "fix the linter to satisfy the code" anti-pattern
- **Remove when**: Claude reliably fixes code instead of weakening configs on its own

#### change-safety.js
- **Event**: PreToolUse, matches `Edit`
- **Logic**: Before Edit executes, check if the file has uncommitted changes and if the `old_string` matches current content. If mismatch, block and tell Claude to Read the file first.
- **Why**: Prevents edits based on stale context that accidentally overwrite recent changes
- **Remove when**: Claude always reads files before editing, or context window becomes large enough that stale context is rare

#### suggest-compact.js
- **Event**: PostToolUse, matches all tools
- **Logic**: Count tool calls. After 80 calls, suggest `/compact` at the next logical boundary (task completion, test pass, commit). Never interrupt mid-task.
- **Why**: Long sessions accumulate context pressure; proactive compact prevents quality degradation
- **Remove when**: Claude Code's built-in compaction becomes fully automatic and sufficient

#### batch-format.js
- **Event**: Stop
- **Logic**: Collect all files written/edited during the session, batch run prettier/ruff format once. Does not run after every Edit (that's post-write-verify.js's job for lint).
- **Why**: Formatting is cosmetic; batching at Stop is faster than per-Edit and doesn't waste mid-task tokens
- **Remove when**: post-write-verify.js handles formatting adequately, or formatting is fully automated by the editor

### 2.2 Modified Hooks

#### action-guard.js
- **Change**: Add file organization check — warn when creating files in project root that are not standard project files
- **Why**: Claude frequently creates plan.md, debug_*.py, .ps1 scripts in root

#### session-learner.js
- **Change**: Replace hardcoded `D--Quant-claudecode` path with dynamic detection based on `CLAUDE_PROJECT_DIR` environment variable
- **Why**: Current implementation only works for one specific project

### 2.3 Hook Config in settings.json

New hooks entries to merge into `settings.json` hooks section. Uses the same format as existing hooks:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/config-protection.js"],
        "description": "Block modifications to tool config files (eslint, prettier, tsconfig, etc.)"
      },
      {
        "matcher": "Edit",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/change-safety.js"],
        "description": "Prevent edits based on stale context that overwrite recent changes"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/suggest-compact.js"],
        "description": "Suggest /compact after 80+ tool calls at logical boundaries"
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": "node",
        "args": ["C:/Users/Tao/.claude/hooks/batch-format.js"],
        "description": "Batch format all files written during the session"
      }
    ]
  }
}
```

Note: This merges with existing hooks. Existing PreToolUse/PostToolUse entries (action-guard, secret-detect, post-write-verify, output-size-warning) remain unchanged.

---

## Part 3: Commands (New)

All commands are markdown files in `~/.claude/commands/`. Zero resident token cost — loaded only on invocation.

### 3.1 build-fix.md
Read build error output, trace root cause, implement fix, verify build passes. Focus on compilation/type errors, not logic bugs (use superpowers:systematic-debugging for those).

### 3.2 context-audit.md
Inventory all loaded components (plugins, skills, rules, hooks, MCP servers), estimate token consumption per component, classify as always/sometimes/rarely needed, produce prioritized savings recommendations.

### 3.3 commit-push-pr.md
One-command workflow: stage files, write conventional commit message, push to remote, create PR with summary and test plan. Follows git-workflow.md conventions.

### 3.4 harness-check.md
Run the HARNESS_CHECKLIST from awesome-harness-engineering against current project: check CLAUDE.md accuracy, hook health, rule relevance, agent availability. Output a punch list of issues.

---

## Part 4: Agents (New)

All agents are markdown files in `~/.claude/agents/`. Zero resident token cost — description only in agent list.

### 4.1 build-error-resolver.md
Specializes in reading compiler/linter output, identifying root cause, and applying targeted fixes. Narrower than superpowers:debugger — focused purely on build failures.

### 4.2 security-reviewer.md
OWASP Top 10 scanner. Checks for injection, XSS, auth issues, secrets in code. Uses structured severity classification (Critical/High/Medium/Low).

### 4.3 test-runner.md
Runs test suites, analyzes failures, identifies patterns in test output. Can run specific test files or full suites depending on context.

### 4.4 docs-generator.md
Generates API documentation, README sections, and code comments. Understands when to use docstrings vs README vs separate docs.

### Superpowers overlap — NOT building:

| Function | Use Superpowers Instead |
|----------|------------------------|
| Planning | `superpowers:writing-plans` |
| Code review | `superpowers:requesting-code-review` |
| Debugging | `superpowers:systematic-debugging` |
| TDD | `superpowers:test-driven-development` |
| Verification | `superpowers:verification-before-completion` |
| Branch management | `superpowers:finishing-a-development-branch` |
| Parallel agents | `superpowers:dispatching-parallel-agents` |
| Brainstorming | `superpowers:brainstorming` |

---

## Part 5: tmp/ Directory Convention

Projects should have a `tmp/` directory for disposable working files.

**session-start.js enhancement**: On startup, check if `tmp/` exists. If not, suggest creating it. If it does, check that `.gitignore` includes `tmp/`. This is a non-blocking check — just a console message.

---

## Token Budget Summary

| Component | Resident Tokens | On-Trigger Tokens |
|-----------|----------------|-------------------|
| Existing rules (5 files) | ~800 | — |
| New rules (4 files) | ~550 | — |
| Existing hooks (8 hooks) | ~300 | — |
| New hooks (4 hooks) | ~370 | — |
| Superpowers plugin | ~600 | 1000-3000 per skill |
| Other plugins | ~400 | varies |
| **Total resident** | **~3,020** | — |

This is reasonable — under 3,500 tokens of permanent context, with skills loading on-demand.

---

## Reference Sources

- ECC (github.com/affaan-m/ECC): hooks patterns, project-stack-mappings
- anthropics/skills: official skill architecture, progressive disclosure
- awesome-harness-engineering: AGENTS.md template, HARNESS_CHECKLIST
- Anthropic engineering blog: harness design for long-running apps
- Addy Osmani / Martin Fowler / OpenAI: harness engineering principles
- Boris Cherny / Mnilax: Claude Code best practices

---

## Decommission Criteria

Per harness-quality.md, each component should document when to remove it:

| Component | Remove When |
|-----------|-------------|
| config-protection.js | Claude reliably fixes code instead of weakening configs |
| change-safety.js | Claude always reads before editing, or context windows grow large enough |
| suggest-compact.js | Claude Code's auto-compaction becomes fully sufficient |
| batch-format.js | post-write-verify.js handles formatting adequately |
| collaboration.md | Model's default behavior matches these principles |
| file-organization.md | Claude stops creating root-level temp files |
| harness-quality.md | This harness is no longer maintained |
| All custom commands/agents | Superpowers adds equivalent functionality |
