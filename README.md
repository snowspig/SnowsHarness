# SnowsHarness

[中文](#中文说明) | [English](#english)

---

<a id="english"></a>

A portable configuration harness for [Claude Code](https://claude.ai/code) — rules, hooks, commands, agents, and a code indexing system that enhance Claude's behavior and enforce development standards.

## What It Does

- **Rules** — Markdown guidelines loaded into every session (coding style, git workflow, testing, performance, collaboration)
- **Hooks** — Node.js scripts triggered by lifecycle events (block bad edits, warn on destructive ops, auto-format on stop, detect secrets)
- **Commands** — Slash commands for common workflows (`/health-check`, `/review`, `/commit-push-pr`)
- **Agents** — Specialized subagent definitions (code-reviewer, debugger, planner, quant research team)
- **Code Index** — Regex-based symbol extraction + SQLite knowledge graph, exposed as MCP tools for instant code exploration
- **Memory Palace** — Structured project memory with wings for organized knowledge persistence

## Quick Start

### Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- Node.js 22.5+ (recommended, for built-in SQLite; falls back to JSON on older versions)
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

The deploy script copies hooks, rules, commands, and agents into `~/.claude/`, then merges hook registrations and MCP server config into your existing `settings.json` (preserves env vars, permissions, and plugins).

After deploy, verify with `/harness-check`.

### Model Routing

SnowsHarness uses a two-tier model architecture through SnowsRouter (deployed on OpenWrt):

| Role              | Model      | Config                                     |
| ----------------- | ---------- | ------------------------------------------ |
| Main conversation | Classifier | `ANTHROPIC_MODEL: "Classifier"`            |
| Subagents         | Classifier | `CLAUDE_CODE_SUBAGENT_MODEL: "Classifier"` |
| Fast mode         | GLM 5.1    | `ANTHROPIC_SMALL_FAST_MODEL: "glm-5.1"`    |

Set `ANTHROPIC_BASE_URL` to your SnowsRouter endpoint. The Classifier model triggers intelligent model selection for each request.

## Architecture

```
SnowsHarness/
├── hooks/            # Node.js lifecycle hooks
│   └── code-index/   # Code indexing modules (extractors, database, MCP server)
├── rules/            # Markdown behavioral rules
│   ├── common/       # Coding style, git, testing, collaboration...
│   ├── frontend/     # React/Next.js patterns
│   └── python/       # Python project patterns
├── commands/         # Slash command definitions
├── agents/           # Subagent definitions
├── deploy.sh         # Linux/macOS deploy script
├── deploy.ps1        # Windows deploy script
├── settings.template.json  # Reference for hook registrations + MCP config
└── CLAUDE.md         # Project instructions for Claude Code
```

### Code Index System

A built-in code knowledge graph inspired by [CodeGraph](https://github.com/colbymchenry/codegraph), reimplemented with zero external dependencies:

- **Regex extractors** for 8 languages (JS/TS, Python, Go, Rust, Java, C#, C/C++, CSS)
- **SQLite storage** with FTS5 full-text search (Node 22.5+ built-in `node:sqlite`)
- **MCP server** exposing 4 tools to Claude Code:
  - `code_search` — Find symbols by name
  - `code_explore` — Get definition + call relationships + context in ONE call
  - `code_callers` — Find what calls a symbol
  - `code_impact` — Analyze blast radius of changes
- **Auto-indexing** on session start, incremental updates on file edits

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
| `code-index-update`   | PostToolUse  | Marks edited files for index re-sync                    |
| `session-start`       | SessionStart | Environment status, project detection, memory init      |
| `project-context`     | SessionStart | Injects project-specific context hints                  |
| `code-index-init`     | SessionStart | Auto-indexes project source files                       |
| `batch-format`        | Stop         | Runs prettier/ruff on all modified files                |
| `memory-emergency-save` | PreCompact | Saves insights before context compression               |
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

---

<a id="中文说明"></a>

# 中文说明

SnowsHarness 是一个面向 [Claude Code](https://claude.ai/code) 的便携式配置工具包 — 通过规则、钩子、命令、智能体和代码索引系统来增强 Claude 的能力并规范开发流程。

## 功能概览

- **规则 (Rules)** — Markdown 格式的行为指南，每次会话自动加载（编码风格、Git 工作流、测试、性能、协作规范等）
- **钩子 (Hooks)** — Node.js 脚本，在生命周期事件触发时执行（阻止错误编辑、危险操作警告、自动格式化、密钥检测等）
- **命令 (Commands)** — 斜杠命令，用于常用工作流（`/health-check`、`/review`、`/commit-push-pr`）
- **智能体 (Agents)** — 专用子智能体定义（代码审查、调试器、规划器、量化研究团队等）
- **代码索引 (Code Index)** — 基于正则的符号提取 + SQLite 知识图谱，通过 MCP 工具即时查询代码结构，减少 token 消耗
- **记忆宫殿 (Memory Palace)** — 结构化项目记忆系统，按主题（wings）组织跨会话知识

## 快速开始

### 前提条件

- 已安装 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- Node.js 22.5+（推荐，内置 SQLite；旧版本降级为 JSON 存储）
- `jq`（仅 Linux/macOS 部署脚本需要）

### 部署

**Linux/macOS：**

```bash
./deploy.sh --dry-run    # 预览变更
./deploy.sh --force      # 无提示部署
```

**Windows (PowerShell)：**

```powershell
.\deploy.ps1 -DryRun
.\deploy.ps1 -Force
```

部署脚本将 hooks、rules、commands、agents 复制到 `~/.claude/`，然后将钩子注册和 MCP 服务器配置**合并**到现有的 `settings.json`（保留环境变量、权限和插件配置）。

部署后运行 `/harness-check` 验证。

### 模型路由

SnowsHarness 通过 SnowsRouter（部署在 OpenWrt 路由器上）使用双层模型架构：

| 角色       | 模型       | 配置                                      |
| ---------- | ---------- | ----------------------------------------- |
| 主对话     | Classifier | `ANTHROPIC_MODEL: "Classifier"`           |
| 子智能体   | Classifier | `CLAUDE_CODE_SUBAGENT_MODEL: "Classifier"` |
| 快速模式   | GLM 5.1    | `ANTHROPIC_SMALL_FAST_MODEL: "glm-5.1"`   |

将 `ANTHROPIC_BASE_URL` 设为 SnowsRouter 端点地址。Classifier 模型名会触发智能模型选择。

## 代码索引系统

灵感来自 [CodeGraph](https://github.com/colbymchenry/codegraph)，零外部依赖重新实现：

| 组件 | 功能 |
|------|------|
| **正则提取器** | 支持 8 种语言：JS/TS、Python、Go、Rust、Java、C#、C/C++、CSS |
| **SQLite 知识图谱** | 符号（函数、类、方法）+ 关系（调用、包含、导入）+ FTS5 全文搜索 |
| **MCP 服务器** | 4 个工具：`code_search`、`code_explore`、`code_callers`、`code_impact` |
| **自动索引** | 会话启动时自动建索引，编辑文件时增量更新 |

## 多机同步

```bash
git pull
./deploy.sh --force   # Linux/macOS
.\deploy.ps1 -Force   # Windows
```
