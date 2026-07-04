# SnowsHarness → ZCode 移植方案

> 目标：把 SnowsHarness 针对 Claude Code 的 harness 配置，移植为 **ZCode 插件**，在 ZCode (GLM) 环境下复现其能力并提升使用效率。
>
> 移植范围：Code Index (MCP) + 安全 Hooks + Rules→AGENTS.md，保留 SnowsRouter 模型路由。

---

## 0. TL;DR — 决策摘要

| 维度 | Claude Code 原方案 | ZCode 移植方案 |
|------|-------------------|---------------|
| 部署形态 | 复制到 `~/.claude/` + 合并 settings.json | **打包为 ZCode 插件**，本地目录作为 marketplace 安装 |
| 指令加载 | `rules/*.md` 自动注入上下文 | **无对应** → 改写为 `~/.zcode/AGENTS.md` + Skills |
| Hooks | settings.json `hooks`（6 事件） | `hooks/hooks.json`（**7 事件，但无 PreCompact/SessionEnd**） |
| Hook 输出 | stderr 提示模型可见 | **stdout 严格 JSON**（`additionalContext`）才注入对话 |
| MCP | `mcpServers` | `mcpServers`（插件 manifest 内，键名相同） |
| 权限白名单 | `permissions.allow` | **无对应** → 放弃，改 PreToolUse hook 软实现 |
| 模型路由 | `ANTHROPIC_*` 环境变量 | **ZCode provider 体系**（`~/.zcode/v2/config.json`） |

---

## 1. 两大环境的根本差异

### 1.1 配置文件体系

**Claude Code**（单一配置中心）：
```
~/.claude/
├── settings.json          # env + permissions + hooks + mcpServers + plugins
├── CLAUDE.md              # 项目指令（每个项目根也有一个）
├── rules/*.md             # ★ 自动注入每次会话（~35KB 常驻）
├── hooks/*.js
├── commands/*.md
└── agents/*.md
```

**ZCode**（多文件、分层作用域）：
```
~/.zcode/
├── AGENTS.md              # ★ 用户级指令（跨项目默认）
├── cli/config.json        # 用户级 hooks/mcp/plugins enable（harness 文档约定）
├── v2/config.json         # ★★ 实际 provider/模型配置（GLM 真实生效处）
├── v2/setting.json        # 客户端设置（providerFamily、locale 等）
├── skills/                # 用户级 skills
├── commands/              # 用户级 commands
└── agents/                # 用户级 agents

<repo>/
├── AGENTS.md              # 工作区级指令（团队共享）
└── .zcode/config.json     # 工作区级 hooks/mcp
```

> ⚠️ **关键发现**：你的机器上 `~/.zcode/cli/config.json` **尚未创建**，真实的 provider 配置在 `~/.zcode/v2/config.json`。插件形式的 hooks/mcp 注册在**插件自己的 manifest**里，不依赖 cli/config.json。

### 1.2 Hooks 事件对照（最重要的破坏性差异）

ZCode 只支持 **7 个事件**：

| SnowsHarness Hook | 事件 | ZCode | 处理 |
|------------------|------|-------|------|
| action-guard | PreToolUse | ✅ | 直接迁移 |
| config-protection | PreToolUse | ✅ | 直接迁移 |
| change-safety | PreToolUse | ✅ | 直接迁移 |
| secret-detect | PostToolUse | ✅ | 直接迁移 |
| output-size-warning | PostToolUse | ✅ | 直接迁移 |
| post-write-verify | PostToolUse | ✅ | 直接迁移 |
| track-written-files | PostToolUse | ✅ | 直接迁移 |
| suggest-compact | PostToolUse | ✅ | 直接迁移 |
| code-index-update | PostToolUse | ✅ | 直接迁移 |
| session-start | SessionStart | ✅ | 迁移（去 SnowsRouter/vLLM 检查） |
| project-context | SessionStart | ✅ | 迁移 |
| code-index-init | SessionStart | ✅ | 直接迁移 |
| batch-format | **Stop** | ✅ | 直接迁移 |
| memory-emergency-save | **PreCompact** | ❌ **不支持** | 改挂 Stop 或放弃 |
| session-end | **SessionEnd** | ❌ **不支持** | 改挂 Stop 或放弃 |
| session-learner | **SessionEnd** | ❌ **不支持** | 改挂 Stop 或放弃 |

> ZCode **额外支持** 两个 Claude Code 没用的事件：`UserPromptSubmit`、`PermissionRequest`、`PostToolUseFailure`。其中 `PermissionRequest` 可用来实现软权限白名单。

### 1.3 Hook 输入/输出契约差异（必须改）

**Claude Code**：
- stdin → JSON `{tool_name, tool_input}`
- 模型可见输出靠 `console.error()`（stderr）
- exit 2 = block

**ZCode**：
- stdin → JSON（字段名兼容：`tool_name`/`tool_input`）
- **stdout** 被解析为严格 JSON schema，`additionalContext` 字段注入对话上下文
- **stderr 不注入对话**（仅记日志）
- exit 0 = pass，exit 2 = block（PreToolUse/PermissionRequest）

→ 所有靠 `console.error` 给模型提示的 hook（action-guard、suggest-compact、output-size-warning 等），在 ZCode 下**模型看不到**，必须改写为：
```js
// 旧（Claude Code）
console.error(`[警告] 危险命令: ${cmd}`);
// 新（ZCode）
console.log(JSON.stringify({
  additionalContext: `[警告] 危险命令: ${cmd}\n如非故意请停止。`
}));
```

### 1.4 模型路由差异

**Claude Code** 通过环境变量：
```json
"env": {
  "ANTHROPIC_MODEL": "Classifier",
  "ANTHROPIC_BASE_URL": "http://192.168.8.1:8856",
  "CLAUDE_CODE_SUBAGENT_MODEL": "Classifier",
  "ANTHROPIC_SMALL_FAST_MODEL": "glm-5.1"
}
```

**ZCode** 通过 provider 体系（`~/.zcode/v2/config.json`）：
```json
{
  "provider": {
    "<provider-id>": {
      "kind": "anthropic",          // 支持 anthropic / openai 协议
      "options": {
        "apiKey": "...",
        "baseURL": "https://open.bigmodel.cn/api/anthropic"
      },
      "models": { "GLM-5.2": {...} }
    }
  }
}
```

→ SnowsRouter 若提供 **anthropic 兼容**端点，可注册为一个 custom provider，baseURL 指向 `http://192.168.8.1:8856`。详见 §4。

---

## 2. 目标插件结构

打包为名为 **`snows-harness`** 的 ZCode 插件，放在项目内的 `zcode-plugin/` 目录，通过本地 marketplace 安装。

```
SnowsHarness/
├── zcode-plugin/                          # ★ 新增：ZCode 插件包
│   ├── .zcode-plugin/
│   │   └── plugin.json                    # 插件 manifest（核心）
│   ├── package.json
│   ├── README.md
│   │
│   ├── hooks/
│   │   ├── hooks.json                     # ★ ZCode hook 注册（events 结构）
│   │   └── scripts/                       # hook 脚本（从原 hooks/ 改写）
│   │       ├── _lib/
│   │       │   └── zcode-output.js        # ★ 新增：统一的 stdout JSON 输出工具
│   │       ├── action-guard.js
│   │       ├── config-protection.js
│   │       ├── change-safety.js
│   │       ├── secret-detect.js
│   │       ├── code-index-init.js
│   │       ├── code-index-update.js
│   │       ├── batch-format.js
│   │       └── track-written-files.js
│   │       # 放弃：memory-emergency-save / session-end / session-learner（事件不支持）
│   │
│   ├── mcp/
│   │   ├── code-index-mcp.js              # MCP server 入口（原样复用）
│   │   └── code-index/                    # 原样复用
│   │       ├── server.js
│   │       ├── database.js
│   │       ├── explorer.js
│   │       ├── extractors.js
│   │       └── utils.js
│   │
│   ├── commands/                          # 斜杠命令（改文案）
│   │   ├── harness-check.md               # 改为检查插件健康
│   │   ├── review.md
│   │   ├── commit-push-pr.md
│   │   ├── plan-project.md                # 改为生成 AGENTS.md（非 CLAUDE.md）
│   │   ├── health-check.md
│   │   ├── build-fix.md
│   │   └── context-audit.md
│   │
│   ├── skills/                            # ★ 新增：把重规则转成按需 skill
│   │   ├── code-review-checklist/
│   │   │   └── SKILL.md                   # 来自 rules/common/code-review.md
│   │   └── memory-palace/
│   │       └── SKILL.md                   # 来自 rules/common/memory-palace.md
│   │
│   └── agents/                            # 子智能体（改 model 名）
│       ├── code-reviewer.md
│       ├── debugger.md
│       ├── planner.md
│       └── ...（保留需要的）
│
├── user-instructions/                     # ★ 新增：供用户复制到 ~/.zcode/
│   └── AGENTS.md                          # 全局指令（rules/common 精炼版）
│
├── docs/
│   └── ZCODE_MIGRATION_PLAN.md            # 本文档
│
# 保留原有（Claude Code 用）
├── hooks/ rules/ commands/ agents/        # 不动，Claude Code 仍可用
├── deploy.ps1 / deploy.sh
└── settings.template.json
```

---

## 3. plugin.json 核心清单

```jsonc
// zcode-plugin/.zcode-plugin/plugin.json
{
  "name": "snows-harness",                    // 必须 ^[a-z0-9][a-z0-9._-]{0,127}$
  "version": "1.0.0",
  "description": "SnowsHarness for ZCode: code index MCP, safety hooks, dev workflow commands.",
  "author": { "name": "snowspig" },
  "license": "MIT",

  // Hooks —— 指向 hooks/hooks.json
  "hooks": "hooks",

  // MCP server —— 内联定义（参考 android-emulator 插件）
  "mcpServers": {
    "snows-index": {
      "command": "node",
      "args": ["${ZCODE_PLUGIN_ROOT}/mcp/code-index-mcp.js"],
      "cwd": "${ZCODE_PROJECT_DIR}"
    }
  },

  // Skills —— 按需加载的规则
  "skills": "skills",

  // Commands —— 斜杠命令
  "commands": "commands"
  // agents 在 ZCode 中"recorded but not executed"，
  // 故 agents/ 暂不放入 manifest（见 §8 说明）
}
```

**关键点**：
- `${ZCODE_PLUGIN_ROOT}` 是插件专属变量，hook/mcp 中可用（skill 目录变量在 hook 里**会报错**，不能用）。
- MCP 用 `node` 直接跑（code-index 是纯 Node.js 零依赖，无需像 android-emulator 那样走 ZCode.exe host）。
- `agents` 字段 ZCode "记录但不执行"，所以子智能体不能靠插件提供 —— 见 §8。

---

## 4. hooks/hooks.json（事件注册）

```jsonc
// zcode-plugin/hooks/hooks.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",                        // 匹配 startup/resume/clear/compact 全部
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/code-index-init.js\"",
            "timeout": 20                     // 秒（首次建索引可能慢）
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",         // 大小写敏感正则
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/action-guard.js\""
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/config-protection.js\""
          }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/change-safety.js\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/secret-detect.js\""
          },
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/code-index-update.js\""
          },
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/track-written-files.js\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command",
            "command": "node \"${ZCODE_PLUGIN_ROOT}/hooks/scripts/batch-format.js\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**与 Claude Code 版的差异**：
1. **删除 SessionEnd**：`session-end.js`、`session-learner.js` 无对应事件，**不迁移**。Memory Palace 的"自动会话学习"放弃，改用 `/memory` 手动命令 + skill 引导。
2. **删除 PreCompact**：`memory-emergency-save.js` 不迁移。如需紧急保存，可挂到 `Stop`（但会每轮触发，需加节流）。
3. **matcher 区分大小写**：`Bash|Write|Edit`（不是 `bash|write|edit`）。
4. **路径用 `${ZCODE_PLUGIN_ROOT}`**：插件安装后位置不固定，必须用变量。
5. **超时单位**：`command` 类型的 `timeout` 是**秒**（不是毫秒），`process` 类型才用 `timeoutMs`。

---

## 5. Hook 脚本改写规范

### 5.1 统一输出工具（新增）

所有 hook 共用一个输出封装，把 stderr 提示转成 ZCode 的 stdout JSON：

```js
// zcode-plugin/hooks/scripts/_lib/zcode-output.js
"use strict";
// ZCode hook 输出契约：
// - stdout 输出严格 JSON，schema 外字段会导致校验失败
// - additionalContext 内容会注入对话上下文（模型可见）
// - stderr 只进日志，模型看不到
// - exit 2 = block（仅 PreToolUse/PermissionRequest 生效）

// PreToolUse / PermissionRequest 可返回的 hookSpecificOutput
function block(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  }));
  process.exit(0);   // 用 JSON 返回 deny，而非 exit 2（更可控）
}

// 把提示信息注入对话上下文（模型可见）
function notify(text) {
  console.log(JSON.stringify({ additionalContext: text }));
}

module.exports = { block, notify };
```

### 5.2 action-guard.js 改写示例

```js
// 旧（Claude Code）
if (warnings.length > 0) {
  console.error("\n=== ACTION GUARD WARNING ===");
  for (const w of warnings) { console.error(`[${w.risk}] ${w.message}`); }
}

// 新（ZCode）
const { notify } = require("./_lib/zcode-output");
if (warnings.length > 0) {
  const lines = warnings.map(w => `[${w.risk} RISK] ${w.type}: ${w.message}`);
  notify("=== ACTION GUARD WARNING ===\n" + lines.join("\n") +
         "\n如非故意，请停止并确认。");
}
// 注意：action-guard 原本只警告不阻断，保持 exit 0
```

### 5.3 change-safety.js 改写示例（原本就用 exit 2 阻断）

```js
// 旧
if (!normalizedContent.includes(normalizedOld)) {
  console.error("[CHANGE SAFETY] ...");
  process.exit(2);
}

// 新（推荐用 JSON deny，比 exit 2 信息更明确）
const { block } = require("./_lib/zcode-output");
if (!normalizedContent.includes(normalizedOld)) {
  block(`[CHANGE SAFETY] Edit 的 old_string 与文件当前内容不符。
文件可能自上次读取后已变更。
请先 Read 文件，再用当前内容重试 Edit。`);
  return;
}
```

### 5.4 code-index-init.js / code-index-update.js

这俩**几乎零改动** —— 它们只在 stderr 输出日志（`process.stderr.write`），本来就符合 ZCode（stderr 进日志不注入对话）。唯一改动：
- 环境变量：`CLAUDE_PROJECT_DIR` → 兼容 `${ZCODE_PROJECT_DIR}`（已用 `process.env.PROJECT_DIR` 兜底，可补一行 `process.env.ZCODE_PROJECT_DIR`）。

```js
// 改 resolveProjectDir
const resolveProjectDir = () =>
  process.env.CLAUDE_PROJECT_DIR ||
  process.env.ZCODE_PROJECT_DIR ||   // ★ 新增
  process.env.PROJECT_DIR ||
  process.cwd();
```

---

## 6. Code Index MCP（零成本复用）

**好消息**：`code-index/*` 五个文件是纯 Node.js + stdio JSON-RPC 2.0，零外部依赖，与 Claude Code 无任何耦合。

迁移步骤：
1. 复制 `hooks/code-index/`（5 文件）+ `hooks/code-index-mcp.js` → `zcode-plugin/mcp/`
2. 在 `plugin.json` 的 `mcpServers` 注册（见 §3）
3. ZCode 会自动连接（workspace/plugin 作用域的 MCP 默认 trusted & 自动连接）
4. 工具名仍为 `mcp__snows-index__code_search` 等，**无需改 permissions**（ZCode 无此机制，MCP 工具默认可用）

**唯一注意**：code-index 依赖 `node:sqlite`（Node 22.5+）。ZCode 内置的 Node 版本若 < 22.5，会降级为 JSON 存储。MCP server 用系统 `node` 启动（`"command": "node"`），需确认系统 node 版本：
```bash
node --version   # 需 >= 22.5 才有 SQLite
```

---

## 7. Rules → AGENTS.md + Skills

### 7.1 问题：ZCode 无 "自动注入 rules" 机制

Claude Code 把 `~/.claude/rules/*.md` 全部注入每次会话（~35KB 常驻 token）。ZCode 没有这个，只有：
- `AGENTS.md`（用户级 + 工作区级，常驻）
- Skills（按需加载，触发时才进上下文）

### 7.2 拆分策略

把 8 个 rules 文件按"是否每次都需要"分类：

| Rule 文件 | 性质 | 去向 |
|----------|------|------|
| `coding-style.md` | 每次 | AGENTS.md（精炼版） |
| `collaboration.md` | 每次 | AGENTS.md（精炼版） |
| `git-workflow.md` | 每次 | AGENTS.md（精炼版） |
| `file-organization.md` | 每次 | AGENTS.md（精炼版） |
| `testing.md` | 按需 | Skill |
| `performance.md` | 按需 | Skill |
| `code-review.md` | 按需（/review 时） | Skill |
| `memory-palace.md` | 按需 | Skill |
| `harness-quality.md` | 元规则 | AGENTS.md（1-2 句） |
| `code-indexing.md` | 已由 MCP 工具说明覆盖 | 删除/合并进 MCP instructions |

### 7.3 user-instructions/AGENTS.md 模板

```markdown
# SnowsHarness 全局指令

## 协作原则
- 从原始需求和根因出发，不套模板
- 目标不清就停下讨论；路径次优就直说并建议更优解
- 追根因，不掩盖问题；但严格度匹配场景（生产代码追根因，临时脚本能跑就行）
- 每个决策都要回答"为什么"
- 只输出能改变决策的内容，其余删掉

## 编码风格
- 函数 < 50 行，单一职责；超长就拆
- 命名达意，禁止单字母（循环计数 i/j/k 除外）
- Python：PEP8 + 类型注解 + f-string + pathlib + dataclass；禁止 bare except
- TS/JS：strict 模式，const 优先，PascalCase 组件名
- DRY：复制 3 次就抽取

## Git 工作流
<精炼 git-workflow.md 要点>

## 文件组织
- 计划文档 → docs/，临时脚本 → tmp/，禁止堆在根目录
- scratch/temp/TODO.md 等文件禁止建在项目根

## Harness 质量
每个 harness 组件都应注明：为何存在、什么能力提升后可删除。
每 3 个月或大模型升级后复盘，移除不再产生价值的组件。
```

> 用户把 `user-instructions/AGENTS.md` 复制到 `~/.zcode/AGENTS.md`，对所有项目生效。

### 7.4 Skill 例子（code-review-checklist）

```markdown
---
name: code-review-checklist
description: 代码审查清单。当用户请求 review、检查代码质量、或 /review 命令时加载。覆盖正确性、安全、性能、质量四维度。
---

# 代码审查清单
<原 rules/common/code-review.md 内容>
```

Skill 的好处：只在 `/review` 或语义匹配时加载，**不占每次会话的 token**。

---

## 8. Agents / 子智能体（⚠️ 限制）

**问题**：ZCode 插件 manifest 的 `agents` 字段是 *"recorded but not executed"*（仅记录，不执行）。原 harness 的 11 个 agent（code-reviewer、debugger、quant-* 等）**不能通过插件提供**。

**替代方案**：
- **方案 A（推荐）**：把 agent 定义复制到 `~/.zcode/agents/`（用户级）或通过 **Settings → Subagents** 界面添加。这些是 ZCode 原生的 subagent 注册位置。
- **方案 B**：把 agent 的 system prompt 转成 **Skill**，主智能体按需加载后"扮演"该角色（但失去并行 subagent 能力）。

**model 名改动**：原 `model: glm-5.1` → ZCode 的 `GLM-5.2`（见你 v2/config.json 里的模型 id）。

> 建议：agent 移植**不在本次插件范围内**，单独作为"用户级 subagent 配置"处理。本次聚焦 Code Index + 安全 Hooks + Rules。

---

## 9. SnowsRouter 模型路由对接

### 9.1 现状

你的 Claude Code 通过 SnowsRouter（OpenWrt `192.168.8.1:8856`）做双层路由：`ANTHROPIC_MODEL: "Classifier"` 触发智能选模型。

ZCode 当前直连 `https://open.bigmodel.cn/api/anthropic`（GLM-5.2），**未走 SnowsRouter**。

### 9.2 对接方案

SnowsRouter 若暴露 **anthropic 兼容**端点，可在 ZCode 注册为 custom provider：

在 `~/.zcode/v2/config.json` 的 `provider` 里新增：
```jsonc
"snowsrouter": {
  "name": "SnowsRouter",
  "kind": "anthropic",                    // SnowsRouter 需实现 anthropic /v1/messages
  "options": {
    "apiKey": "<SnowsRouter 鉴权>",
    "baseURL": "http://192.168.8.1:8856"  // 你的路由器端点
  },
  "enabled": true,
  "source": "custom",
  "models": {
    "Classifier": {                       // 触发 SnowsRouter 智能选模型
      "limit": { "context": 200000 }
    }
  }
}
```

### 9.3 待确认事项

| 问题 | 影响 |
|------|------|
| SnowsRouter 是否实现 `/v1/messages`（anthropic 协议）？ | 若只有 OpenAI 协议，`kind` 改 `"openai"` |
| SnowsRouter 鉴权方式（API key?） | 决定 apiKey 字段 |
| ZCode 是否支持 subagent 独立 model（对应 `CLAUDE_CODE_SUBAGENT_MODEL`） | 影响 worker agent 路由 |

> 模型路由**独立于 harness 插件**，是 v2/config.json 的 provider 配置。可在插件装好后单独调试。

---

## 10. 权限白名单（放弃 + 替代）

原 `settings.json` 的 `permissions.allow`（几十条 Bash 白名单）在 ZCode **无对应字段**。

**替代**：
- ZCode 用 **permission mode**（auto/plan 等）+ hooks 管控
- 用 `PermissionRequest` 事件 hook 可实现"软白名单"：检查命令，已知安全的自动 allow，未知的 ask
- 但这会增加复杂度，**建议初版放弃**，依赖 ZCode 默认的 permission mode

---

## 11. Commands 改写

斜杠命令格式（`.md`）ZCode 完全兼容，路径改 `commands/` 即可。**仅需改文案**：

| Command | 改动 |
|---------|------|
| `harness-check.md` | 检查对象从 `~/.claude/settings.json` 改为插件目录 + v2/config.json |
| `plan-project.md` | 生成 `AGENTS.md`（非 `CLAUDE.md`） |
| `health-check.md` | 去掉 SnowsRouter/vLLM 检查（或改成检查 ZCode provider） |
| `memory.md` | 保留，因 Memory Palace 改为手动模式 |
| 其余 | 文案中 `CLAUDE.md` → `AGENTS.md`，`~/.claude/` → 插件路径 |

---

## 12. 本地 Marketplace 安装

不用发布，用本地目录作为 marketplace：

### 12.1 创建 marketplace.json

```jsonc
// SnowsHarness/zcode-plugin/.zcode-plugin/marketplace.json
// 或单独放：SnowsHarness/marketplace.json
{
  "name": "snows-local",
  "version": 1,
  "plugins": [
    {
      "name": "snows-harness",
      "source": { "kind": "directory", "path": "./zcode-plugin" },
      "version": "1.0.0"
    }
  ]
}
```

### 12.2 安装步骤（用户操作）

1. ZCode → Settings → Plugin Management → Discover → **`+`**
2. 选 "local directory"，指向 `D:\Quant\SnowsHarness`（含 marketplace.json 的目录）
3. 找到 `snows-harness` 插件 → **Get**
4. 确认启用（默认启用）

### 12.3 验证

- `/mcp` 看到 `snows-index` 已连接
- Settings → Plugin Management → snows-harness 详情看到 hooks/skills/commands
- `/` 菜单看到 `/harness-check` 等命令
- 编辑文件时 stderr 日志看到 `[CODE INDEX]` 输出

---

## 13. 实施步骤（建议顺序）

### 阶段 1：骨架 + Code Index（最高价值，验证插件机制）
1. 创建 `zcode-plugin/` 目录结构 + `.zcode-plugin/plugin.json`
2. 复制 `code-index/*` + `code-index-mcp.js` → `mcp/`
3. 创建 `marketplace.json`
4. 本地安装插件，验证 MCP 连接 + `code_search` 工具可用
5. 复制 `code-index-init.js` / `code-index-update.js` → `hooks/scripts/`（补 ZCODE_PROJECT_DIR）
6. 写 `hooks/hooks.json`（先只放 code-index 的 SessionStart/PostToolUse）
7. 验证：打开一个项目，看到自动建索引

### 阶段 2：安全 Hooks
8. 写 `_lib/zcode-output.js`
9. 改写 `action-guard.js`、`config-protection.js`、`change-safety.js`（stderr → stdout JSON）
10. 改写 `secret-detect.js`
11. 注册到 `hooks.json` 的 PreToolUse/PostToolUse
12. 验证：触发危险命令看到模型收到警告

### 阶段 3：Rules → AGENTS.md + Skills
13. 精炼 `rules/common/*` → `user-instructions/AGENTS.md`
14. 把 `code-review.md` / `memory-palace.md` → `skills/*/SKILL.md`
15. 用户复制 AGENTS.md → `~/.zcode/AGENTS.md`
16. 验证：新会话看到全局指令生效

### 阶段 4：Commands + 收尾
17. 改写 commands 文案
18. 写插件 README
19. （可选）SnowsRouter provider 对接
20. （可选）agents → 用户级 subagent

---

## 14. 风险与回退

| 风险 | 缓解 |
|------|------|
| Hook stdout JSON 校验失败 → hook 被丢弃 | 用 `_lib/zcode-output.js` 统一输出；先空跑测试 |
| `${ZCODE_PLUGIN_ROOT}` 在某些字段不展开 | 仅在 command/args 用；脚本内部用 `process.env` |
| code-index 首次建索引超 20s | timeout 设 20s；超大项目可手动先跑一次 |
| node:sqlite 不可用 | 自动降级 JSON 存储（database.js 已处理） |
| Memory Palace 丢失自动学习 | 文档说明改手动 `/memory`；后续评估 Stop 节流方案 |

**回退**：整个移植在 `zcode-plugin/` 独立目录，**不改动任何 Claude Code 原文件**。卸载插件即完全回退。

---

## 15. 不迁移清单（明确放弃）

| 组件 | 原因 |
|------|------|
| `session-end.js` / `session-learner.js` | ZCode 无 SessionEnd 事件 |
| `memory-emergency-save.js` | ZCode 无 PreCompact 事件 |
| `permissions.allow` 白名单 | ZCode 无对应机制 |
| `enabledPlugins`（Claude 插件） | ZCode 是不同生态 |
| `ANTHROPIC_*` 环境变量 | ZCode 用 provider 体系 |
| `suggest-compact.js` | ZCode 的 compact 机制不同（可后续评估） |
| `output-size-warning.js` | ZCode 输出处理不同，优先级低 |

---

## 附录 A：组件迁移总表

| 原组件 | 类型 | 迁移 | 改动量 |
|--------|------|------|--------|
| code-index/* (5 文件) | MCP | ✅ 原样 | 0 |
| code-index-mcp.js | MCP 入口 | ✅ 原样 | 0 |
| code-index-init.js | SessionStart hook | ✅ | 补 ZCODE_PROJECT_DIR |
| code-index-update.js | PostToolUse hook | ✅ | 补 ZCODE_PROJECT_DIR |
| action-guard.js | PreToolUse hook | ✅ | stderr→stdout JSON |
| config-protection.js | PreToolUse hook | ✅ | stderr→stdout JSON |
| change-safety.js | PreToolUse hook | ✅ | exit 2→JSON deny |
| secret-detect.js | PostToolUse hook | ✅ | stderr→stdout JSON |
| track-written-files.js | PostToolUse hook | ✅ | 路径变量 |
| batch-format.js | Stop hook | ✅ | 路径变量 |
| session-start.js | SessionStart hook | 🟡 重构 | 去 SnowsRouter 检查、改 memory 注入 |
| rules/common/* (5 文件) | 常驻规则 | ✅ | 精炼→AGENTS.md |
| rules/common/{testing,performance,code-review,memory-palace} | 按需规则 | ✅ | → Skills |
| commands/* (9 文件) | 斜杠命令 | ✅ | 改文案 |
| agents/* (11 文件) | 子智能体 | 🟡 单独处理 | ZCode 插件不支持，→ 用户级 subagent |
| settings.template.json | 配置模板 | ❌ | ZCode 用 provider 体系 |
| deploy.ps1 / deploy.sh | 部署脚本 | ❌ | 改为 marketplace 安装 |
