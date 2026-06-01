# SnowsHarness

A portable configuration harness for [Claude Code](https://claude.ai/code) — rules, hooks, commands, and agents that enhance Claude's behavior and enforce development standards.

## What It Does

- **Rules** — Markdown guidelines loaded into every session (coding style, git workflow, testing, performance, collaboration)
- **Hooks** — Node.js scripts triggered by lifecycle events (block bad edits, warn on destructive ops, auto-format on stop, detect secrets)
- **Commands** — Slash commands for common workflows (`/health-check`, `/review`, `/commit-push-pr`)
- **Agents** — Specialized subagent definitions (code-reviewer, debugger, planner, quant research team)
- **Memory Palace** — Structured project memory with wings for organized knowledge persistence

## Quick Start

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- Node.js 18+ (for hooks)
- `jq` (for bash deploy script, Linux/macOS only)

### Deploy

**Linux/macOS:**

```bash
./deploy.sh --dry-run    # Preview what will change
./deploy.sh --force      # Deploy without prompts
```

**Windows (PowerShell):**

```powershell
.\deploy.ps1 -DryRun
.\deploy.ps1 -Force
```

The deploy script copies hooks, rules, commands, and agents into `~/.claude/`, then merges hook registrations into your existing `settings.json` (preserves env vars, permissions, and plugins).

After deploy, verify with `/harness-check`.

### Model Routing

SnowsHarness uses a two-tier model architecture through [SnowsRouter](https://192.168.8.1:8856) (deployed on OpenWrt):

| Role              | Model      | Config                                     |
| ----------------- | ---------- | ------------------------------------------ |
| Main conversation | Classifier | `ANTHROPIC_MODEL: "Classifier"`            |
| Subagents         | Classifier | `CLAUDE_CODE_SUBAGENT_MODEL: "Classifier"` |
| Fast mode         | GLM 5.1    | `ANTHROPIC_SMALL_FAST_MODEL: "glm-5.1"`    |

Set `ANTHROPIC_BASE_URL` to your SnowsRouter endpoint. The Classifier model triggers intelligent model selection for each request.

## Architecture

```
SnowsHarness/
├── hooks/            # Node.js lifecycle hooks (13 scripts)
├── rules/            # Markdown behavioral rules (11 files)
│   ├── common/       # Coding style, git, testing, collaboration...
│   ├── frontend/     # React/Next.js patterns
│   └── python/       # Python project patterns
├── commands/         # Slash command definitions (7 commands)
├── agents/           # Subagent definitions (11 agents)
├── deploy.sh         # Linux/macOS deploy script
├── deploy.ps1        # Windows deploy script
├── settings.template.json  # Reference for hook registrations
└── CLAUDE.md         # Project instructions for Claude Code
```

### Hook Data Flows

- `track-written-files` → temp file → `batch-format` reads at session stop
- `session-start` → `.session-health-cache.json` → `session-end` reads it
- `session-start` → auto-creates `MEMORY.md` in project memory directory

### Hooks Overview

| Hook                  | Trigger      | Purpose                                                 |
| --------------------- | ------------ | ------------------------------------------------------- |
| `action-guard`        | PreToolUse   | Warns on destructive commands and sensitive file writes |
| `config-protection`   | PreToolUse   | Blocks edits to linter/tool config files                |
| `change-safety`       | PreToolUse   | Prevents stale-context edits                            |
| `secret-detect`       | PostToolUse  | Detects API keys and secrets in output                  |
| `output-size-warning` | PostToolUse  | Warns on oversized tool output                          |
| `post-write-verify`   | PostToolUse  | Validates files after write                             |
| `track-written-files` | PostToolUse  | Tracks modified files for batch formatting              |
| `suggest-compact`     | PostToolUse  | Suggests /compact when context grows large              |
| `session-start`       | SessionStart | Environment status, project detection, memory init      |
| `project-context`     | SessionStart | Injects project-specific context hints                  |
| `batch-format`        | Stop         | Runs prettier/ruff on all modified files                |
| `session-end`         | SessionEnd   | Writes structured telemetry                             |
| `session-learner`     | SessionEnd   | Extracts debug patterns into memory palace              |

## Syncing Across Machines

```bash
git pull
./deploy.sh --force   # Linux/macOS
.\deploy.ps1 -Force   # Windows
```

## License

Private — for personal use.
