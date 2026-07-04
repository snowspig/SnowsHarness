# snows-harness (ZCode Plugin)

SnowsHarness 的 ZCode 移植版 —— 通过代码索引 MCP、安全钩子、开发工作流命令增强 ZCode (GLM) 的能力。

> 原项目面向 Claude Code（`~/.claude/` + `settings.json`）。本插件是面向 ZCode 的等价实现，
> 以插件形式打包，通过本地 marketplace 安装。完整的迁移分析与决策见仓库根目录的
> `ZCODE_MIGRATION_PLAN.md`。

## 功能

- **Code Index MCP** — 8 种语言的符号提取 + SQLite 知识图谱，暴露 4 个 MCP 工具：
  - `code_search` — 按名搜索符号
  - `code_explore` — 一次调用获取定义 + 调用关系 + 上下文
  - `code_callers` — 查找谁调用了某符号
  - `code_impact` — 分析变更影响范围
- **安全 Hooks** — PreToolUse/PostToolUse 钩子：
  - `action-guard` — 危险命令/敏感文件/未知域名警告
  - `config-protection` — 阻止修改 linter 配置（防止"改 linter 迁就代码"）
  - `change-safety` — 阻止基于过期上下文的 Edit
  - `secret-detect` — 检测写入的 API key / 密钥 / 凭据
- **格式化** — 会话结束时批量运行 prettier/ruff
- **Skills** — 按需加载的规则（代码审查清单、测试指南、性能指南、记忆宫殿）
- **Commands** — `/harness-check`、`/review`、`/commit-push-pr`、`/plan-project` 等

## 前提条件

- ZCode 客户端已安装
- Node.js 22.5+（推荐，内置 SQLite；旧版本降级为 JSON 存储）
- `prettier` 和 `ruff`（可选，仅 batch-format 需要）

## 安装

### 方式一：本地 marketplace（推荐）

1. ZCode → **Settings → Plugin Management → Discover**
2. 点 **`+`** 添加 marketplace，选 "local directory"，指向本仓库根目录（含 `marketplace.json`）
3. 在列表中找到 `snows-harness` → 点 **Get**
4. 确认启用（默认启用）

### 方式二：开发模式直接放插件目录

把 `zcode-plugin/` 目录复制到 ZCode 插件缓存路径，或通过 marketplace 的 directory source 指向。

### 安装后：部署全局指令

把 `user-instructions/AGENTS.md` 复制到 `~/.zcode/AGENTS.md`（对所有项目生效）：

```bash
cp user-instructions/AGENTS.md ~/.zcode/AGENTS.md
```

项目专属规则放在各项目的 `<repo>/AGENTS.md`。

## 验证

安装后运行 `/harness-check` 验证插件健康。

或手动检查：
- `/mcp` 应显示 `snows-index` 已连接
- `/` 菜单应显示 `/harness-check`、`/review` 等命令
- 打开一个代码项目，stderr 日志（`~/.zcode/v2/logs/`）应看到 `[CODE INDEX] ... indexed`

## 架构

```
zcode-plugin/
├── .zcode-plugin/plugin.json   # 插件清单（hooks/mcp/skills/commands 注册）
├── hooks/
│   ├── hooks.json              # 事件注册（SessionStart/PreToolUse/PostToolUse/Stop）
│   └── scripts/                # hook 脚本
│       ├── _lib/zcode-output.js # stdout JSON 输出工具（ZCode 契约）
│       ├── code-index-init.js  # SessionStart: 建索引
│       ├── code-index-update.js # PostToolUse: 标记脏文件
│       ├── action-guard.js     # PreToolUse: 危险操作警告
│       ├── config-protection.js # PreToolUse: 阻止改 linter 配置
│       ├── change-safety.js    # PreToolUse: 阻止过期 Edit
│       ├── secret-detect.js    # PostToolUse: 密钥检测
│       ├── track-written-files.js # PostToolUse: 跟踪已写文件
│       └── batch-format.js     # Stop: 批量格式化
├── mcp/
│   ├── code-index-mcp.js       # MCP server 入口
│   └── code-index/             # 索引引擎（纯 Node.js，零依赖）
├── skills/                     # 按需加载的规则
│   ├── code-review-checklist/
│   ├── testing-guidelines/
│   ├── performance-guidelines/
│   └── memory-palace/
└── commands/                   # 斜杠命令
```

## 与 Claude Code 版的差异

| 方面 | Claude Code 版 | ZCode 版 |
|------|---------------|----------|
| 部署 | 复制到 `~/.claude/` + 合并 settings.json | 插件，本地 marketplace 安装 |
| 指令加载 | `rules/*.md` 自动注入每次会话 | `AGENTS.md`（常驻）+ Skills（按需） |
| Hook 输出 | stderr 提示模型可见 | stdout JSON `additionalContext` |
| Hook 阻断 | exit 2 | stdout JSON `permissionDecision:"deny"` |
| 事件 | 含 PreCompact/SessionEnd | 无这两个事件（memory 自动学习已移除） |
| 权限白名单 | settings.json permissions.allow | 无对应（依赖 ZCode permission mode） |
| 子智能体 | `~/.claude/agents/*.md` | ZCode 插件不支持，需用户级 subagent 单独配置 |

**未移植**（因 ZCode 事件限制）：`session-end.js`、`session-learner.js`、`memory-emergency-save.js`。
Memory Palace 改为手动模式（用户说"记住"或 `/memory` 命令触发，由 memory-palace skill 引导）。

## SnowsRouter 模型路由

本插件不含模型路由配置。如需通过 SnowsRouter 做双层路由，在 `~/.zcode/v2/config.json`
的 `provider` 中注册 SnowsRouter 为 custom provider（baseURL 指向路由器端点）。
详见 `ZCODE_MIGRATION_PLAN.md` §9。

## 许可证

私有，仅供个人使用。
