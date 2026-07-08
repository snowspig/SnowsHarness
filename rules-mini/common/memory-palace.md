# Memory Palace Protocol

分层记忆系统，按主题组织（wings），渐进加载节省 token。

## 分层加载

| Layer | 文件              | Budget | 触发时机         | 内容              |
| ----- | ----------------- | ------ | ---------------- | ----------------- |
| L0    | identity.md       | ~100   | 会话开始         | 身份+全局偏好     |
| L1    | MEMORY.md         | ~500   | 会话开始         | 翅膀索引+活跃条目 |
| L2    | wings/*/README.md | ~300   | `/memory wing X` | 概览+关键词       |
| L3    | facts/events/pref | 无限   | `/memory search` | 完整记忆          |

**Wake-up 成本**: ~600 tok (L0+L1)

## 结构

```
memory/
├── MEMORY.md      # L1 索引
├── identity.md    # L0 身份
├── wings/<wing>/  # L2 README + L3 facts|events|preferences
└── _meta/changelog.md
```

## 记忆类型

### Fact（决策/配置/约束）

```markdown
## Title

- **Date**: YYYY-MM-DD | **Status**: active/critical/superseded
- ★ Critical 前缀 = L1 显示
- 内容描述
- **Why:** 为何重要
- **How to apply:** 如何应用
```

### Event（里程碑/事件）

```markdown
## YYYY-MM-DD

- 事件描述
- 影响或后续行动
```

### Preference（偏好/习惯）

```markdown
## Topic

- 偏好描述
- 适用上下文
```

## 存储原则

- ✅ 未来有用 → 保存
- ✅ 非显而易见 → 保存（代码、git、CLAUDE.md 已有的不保存）
- ✅ 用户明确请求 → 保存
- ❌ 仅当前会话有用 → 不保存
- ❌ 他处已记录 → 不保存

## MEMORY.md (L1 索引)

```markdown
# Memory Palace

## Active Context

- ★ [Critical](wings/*/facts.md#title) — 摘要
- [Active](wings/*/facts.md#title) — 摘要

## Wings

| Wing | Entries | Updated | Keywords |
```

**限制**: max 200 行

## 写入触发

- 用户说 "remember X" → 立即写入
- 任务完成 → 写入进度和决策
- PreCompact → 紧急保存
- SessionEnd → 挖掘模式写入洞察
- `/memory save` → 手动保存

## 质量门

写入前检查：

1. ✅ 未来会用到？
2. ✅ 非显而易见？
3. ✅ 用户请求/确认？
4. ❌ 仅当前相关？ → 跳过
5. ❌ 他处已存？ → 跳过

## 关键词（Wing 匹配）

每个 wing README.md 有 `## Keywords` 行。session-start hook 匹配项目路径和 CLAUDE.md。

## 创建新 Wing

1. 复制 `_template.md` → `wings/<new-wing>/README.md`
2. 创建 `facts.md`, `events.md`, `preferences.md`
3. 更新 MEMORY.md 的 Wings 表
4. 填写 README.md 的 Keywords 行

## 自动保存触发

- "remember X" → 立即
- 任务完成 → 写入
- PreCompact → 紧急
- SessionEnd → 挖掘
- `/memory save` → 手动

## 相关

- `session-start.js` — L0+L1 注入
- `session-learner.js` — 会话结束挖掘
- `/memory` — 交互命令
