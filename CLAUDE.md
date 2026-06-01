# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

SnowsHarness is a **Claude Code configuration harness** — a portable, deployable set of rules, hooks, commands, and agents that enhances Claude Code's behavior. It deploys to `~/.claude/` via platform-specific deploy scripts.

## Deploying

**Windows (PowerShell):**
```powershell
.\deploy.ps1 -DryRun    # Preview what will change
.\deploy.ps1 -Force     # Deploy without prompts
```

**Linux/macOS (Bash):**
```bash
./deploy.sh --dry-run    # Preview what will change
./deploy.sh --force      # Deploy without prompts
```

The deploy script copies hooks, rules, commands, and agents into `~/.claude/`, then **merges** hook registrations into the existing `settings.json` (preserves env vars, permissions, and plugins). On Linux/macOS, `CLAUDE_CODE_USE_POWERSHELL_TOOL` is automatically set to `"0"`.

**Do not commit `settings.json`** — it contains API keys. Use `settings.template.json` as the reference.

## Architecture

Four layers, each with different token costs:

| Layer        | Location        | Loaded                     | Token Cost      |
| ------------ | --------------- | -------------------------- | --------------- |
| **Rules**    | `rules/*.md`    | Always in context          | ~35 KB resident |
| **Hooks**    | `hooks/*.js`    | On trigger                 | Zero resident   |
| **Commands** | `commands/*.md` | On invocation (`/command`) | Zero resident   |
| **Agents**   | `agents/*.md`   | On dispatch                | Zero resident   |

### Rules (behavioral guidance)

Global markdown rules loaded into every session. Cover coding style, git workflow, performance, testing, collaboration, file organization, code review standards, and memory palace protocol. Located in `rules/common/`, `rules/frontend/`, `rules/python/`.

### Hooks (mechanical safety nets)

Node.js scripts triggered by Claude Code lifecycle events:

- **PreToolUse**: `action-guard` (warns on destructive ops), `config-protection` (blocks linter config weakening), `change-safety` (prevents stale-context edits)
- **PostToolUse**: `secret-detect`, `output-size-warning`, `post-write-verify`, `track-written-files`, `suggest-compact`
- **SessionStart**: `session-start` (environment status, project detection, memory auto-init), `project-context`
- **Stop**: `batch-format` (runs prettier/ruff on all modified files)
- **SessionEnd**: `session-end`, `session-learner`

Hook data flows:

- `track-written-files` → writes temp file → `batch-format` reads it at Stop time
- `session-start` → writes `.session-health-cache.json` → `session-end` reads it
- `session-start` → auto-creates `MEMORY.md` in `~/.claude/projects/<project>/memory/` if missing

### Commands (on-demand workflows)

Slash commands loaded only when invoked: `/harness-check`, `/health-check`, `/review`, `/build-fix`, `/commit-push-pr`, `/context-audit`, `/plan-project`.

### Agents (specialized subagents)

Markdown agent definitions with YAML frontmatter (name, description, tools, model). Include general-purpose agents (planner, debugger, code-reviewer) and quant-specific agents (quant-coordinator, quant-data-analyst, quant-strategy-researcher, quant-risk-analyst). Quant agents respond in Chinese.

## Model Routing

Two-tier model architecture routed through SnowsRouter (deployed on OpenWrt at `192.168.8.1:8856`):

| Role                  | Model      | Config Location                 | Purpose                                              |
| --------------------- | ---------- | ------------------------------- | ---------------------------------------------------- |
| **Main conversation** | Classifier | `ANTHROPIC_MODEL: "Classifier"` | SnowsRouter classifies and assigns the optimal model |
| **Subagents**         | Classifier | `CLAUDE_CODE_SUBAGENT_MODEL`    | SnowsRouter assigns optimal model for each subagent  |
| **Fast mode**         | `glm-5.1`  | `ANTHROPIC_SMALL_FAST_MODEL`    | Quick operations, fast mode                          |

`ANTHROPIC_MODEL` must be `"Classifier"` — this triggers SnowsRouter's model classification at `ANTHROPIC_BASE_URL`. Do not change to `"auto"` or a specific model name, as both bypass the router.

**Orchestrator agents** (SnowsRouter assigns model):

- `quant-coordinator` — team lead, dispatches and synthesizes (`model: opus`)

**Worker agents** (run on GLM 5.1):

- `planner`, `code-reviewer`, `debugger`, `test-runner`
- `docs-generator`, `build-error-resolver`, `security-reviewer`
- `quant-data-analyst`, `quant-strategy-researcher`, `quant-risk-analyst`

## Key Conventions

- Hooks read JSON from stdin and output warnings to stderr. Exit code 2 = block the operation, exit code 0 = allow.
- Every component should document **why it exists** and **when it should be removed** (see `rules/harness-quality.md`).
- Review the harness every 3 months or after major model upgrades — remove components that no longer provide value.
- `settings.template.json` is the authoritative reference for hook registrations and config structure. The deploy script merges hooks from this template into the live `settings.json`.
- **Deploy merge limitation**: the merge logic adds new matchers but does not reconcile hooks _within_ an existing matcher. If template adds a hook to an existing matcher group, manually add it to the deployed `settings.json`.

## Cross-Platform Compatibility

All hooks are cross-platform Node.js. Path handling uses `os.homedir()` and forward-slash normalization throughout. The deploy scripts are platform-specific (`deploy.ps1` for Windows, `deploy.sh` for Linux/macOS) but produce equivalent results. The `settings.template.json` ships with `CLAUDE_CODE_USE_POWERSHELL_TOOL: "1"` (Windows default); the bash deploy script overrides this to `"0"` on Linux.

## Collaboration Principles

- Start from the original requirement and root problem, not from conventions or templates.
- Do not assume the user knows exactly what they want — when motivation or goal is unclear, stop and discuss.
- When the goal is clear but the chosen path is suboptimal, say so directly and suggest a better approach.
- Always trace issues to root cause; never paper over problems, but match rigor to context.
- Every decision must answer "why".
- Output only what changes decisions; cut everything else.

## Reference Materials

- `docs/superpowers/` — superpowers plugin skill definitions
- `references/` — external harness engineering references and pattern libraries

## Syncing Across Machines

**Windows:**
```powershell
git pull
.\deploy.ps1 -Force
```

**Linux/macOS:**
```bash
git pull
./deploy.sh --force
```

After deploy, verify with `/harness-check`.
