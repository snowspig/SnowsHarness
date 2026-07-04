---
name: memory-palace
description: 结构化跨会话记忆系统（Memory Palace）。当用户说"记住X"、要求保存决策/偏好/发现、或在长任务中需要持久化进度时加载。定义 L0-L3 分层记忆、wing 主题分类、以及手动保存流程。
---

# Memory Palace Protocol

> **ZCode 适配说明**：原 Claude Code 版依赖 SessionEnd/PreCompact hook 自动学习，
> ZCode 不支持这两个事件，因此本系统改为**手动触发**：用户说"记住"或调用
> `/memory save` 时，按本协议写入记忆文件。

## 分层加载（L0–L3）

| Layer | 文件 | 加载时机 | 内容 |
|-------|------|---------|------|
| **L0** | `identity.md` | 每次会话（用户手动在 AGENTS.md 引用） | 用户身份、全局偏好 |
| **L1** | `MEMORY.md` | 每次会话（同上） | Wing 索引、活跃上下文条目 |
| **L2** | `wings/<wing>/README.md` | 按需 | Wing 概览、关键词索引 |
| **L3** | `wings/<wing>/{facts,events,preferences}.md` | 按需 | 完整深度记忆 |

## 目录结构

记忆存放在 `~/.zcode/projects/<project>/memory/`（或项目内 `memory/`）：

```
memory/
├── MEMORY.md          # L1 入口（所有 wing 索引 + 活跃上下文）
├── identity.md        # L0: 用户身份、全局偏好
├── wings/
│   ├── _template.md
│   └── <wing-name>/
│       ├── README.md  # L2: 概览 + 匹配关键词
│       ├── facts.md   # L3: 决策、配置选择、约束
│       ├── events.md  # L3: 里程碑、事件（按日期）
│       └── preferences.md  # L3: 用户习惯、观点、风格
└── _meta/
    └── changelog.md
```

## 记忆类型判断

当用户说"记住 X"或检测到重要发现时：

1. **确定 wing** —— 属于哪个主题领域？
2. **确定类型**：
   - **Fact**（决策、配置选择、约束）→ `wings/<wing>/facts.md`
   - **Event**（里程碑、事件、部署）→ `wings/<wing>/events.md`
   - **Preference**（观点、风格、习惯）→ `wings/<wing>/preferences.md`
   - **Identity**（用户是谁、全局偏好）→ `identity.md`
3. **按格式写入**（见下）
4. 若是关键事实（★）或改变活跃上下文，更新 `MEMORY.md`
5. 新增条目后更新 wing 的 `README.md`

## 写入格式

### Facts
```markdown
## 标题
- **Date**: YYYY-MM-DD | **Status**: active/critical/superseded
- ★ 关键事实加此前缀 —— 会浮现在 L1 上下文
- 描述事实的内容
- **Why:** 为何重要
- **How to apply:** 因此该怎么做
```

### Events
```markdown
## YYYY-MM-DD
- 描述发生了什么
- 影响或后续行动
```

### Preferences
```markdown
## 主题
- 描述偏好
- 适用的场景
```

## 逐字原则

记录用户原话时，存**逐字引用**（verbatim），不要总结。总结会丢失细微差别。
用 `>` 引用块标记逐字原话。

```markdown
## 错误处理偏好
- **Date**: 2026-06-01 | **Status**: active
- > "不要给我加 try-catch 包裹，让错误直接暴露"
- **Why:** 用户偏好显式错误处理
- **How to apply:** 只在用户要求时才加 try-catch
```

## MEMORY.md 格式（L1 索引，≤200 行）

```markdown
# Memory Palace
## Active Context
- ★ [关键事实标题](wings/wing-name/facts.md#标题) — 一行摘要
- [活跃项](wings/wing-name/facts.md#标题) — 一行摘要
## Wings
| Wing | Entries | Last Updated | Keywords |
|------|---------|--------------|----------|
| wing-name | 12 | 2026-06-01 | kw1, kw2 |
```

## 文件大小上限

| 文件 | 上限 | 超限处理 |
|------|------|---------|
| `MEMORY.md` | 200 行 | 删除最老的 Active Context |
| `identity.md` | 50 行 | 合并重复 |
| 每个 wing `README.md` | 80 行 | 归档旧条目 |
| 每个 `facts.md` | 100 行 | 归档已废弃事实 |
| 每个 `events.md` | 100 行 | 仅保留最近 30 天 |
| 每个 `preferences.md` | 50 行 | 合并重复 |

## 质量门

写入前自检：
- ✅ 未来会话会用到吗？
- ✅ 是非显而易见的（不在代码、git 历史、AGENTS.md 里）？
- ✅ 用户明确要求或确认了吗？
- ❌ 只对当前对话有意义 → 跳过
- ❌ 已在别处记录 → 跳过
