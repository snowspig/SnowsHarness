# /context-audit

分析当前上下文窗口占用与指令体积。

## 步骤

1. 列出所有活跃的指令来源：
   - 用户级 `~/.zcode/AGENTS.md`（全局默认）
   - 工作区级 `<repo>/AGENTS.md`（项目专属）
2. 列出所有已发现的 skills 及其大致 token 占用（仅在触发时加载的标注"按需"）
3. 列出所有注册的 hooks（按事件分组）
4. 列出已连接的 MCP server 及其工具数
5. 估算 token 构成：
   - 系统提示（基础）
   - AGENTS.md（常驻）
   - Skills（触发时）
   - MCP 工具定义
6. 识别冗余与优化机会

## 输出格式

```
上下文审计报告
══════════════
AGENTS.md (用户):  N 行 (~X tokens)
AGENTS.md (项目):  N 行 (~X tokens)
Skills:             N 个（M 个按需加载）
Hooks:              N 个 hook
MCP:                snows-index (4 工具)
───────────────────────────
建议: [列表 或 "无明显问题"]
```

## 建议关注

- 用户级与项目级 AGENTS.md 的重复内容
- 过长可精简的指令段
- 功能重叠的 hooks
