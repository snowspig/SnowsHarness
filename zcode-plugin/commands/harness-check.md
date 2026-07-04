# /harness-check

检查 snows-harness ZCode 插件的健康与配置状态。

## 步骤

1. **插件清单**: 读取 `~/.zcode/cli/plugins/` 下 snows-harness 的 `plugin.json`，确认 name/version/各组件字段有效
2. **Hooks 审计**:
   - 列出 `hooks/hooks.json` 注册的所有事件与 matcher
   - 对每个 hook 脚本运行 `node --check` 验证语法
   - 确认 `${ZCODE_PLUGIN_ROOT}` 路径变量正确引用
3. **MCP 审计**: 向 snows-index MCP server 发 `tools/list`，确认 4 个工具（code_search/code_explore/code_callers/code_impact）可用
4. **Skills 审计**: 列出 `skills/` 下的所有 skill 目录与 SKILL.md frontmatter
5. **Commands 审计**: 列出 `commands/` 下注册的斜杠命令
6. **代码索引状态**: 检查当前项目是否有 `.snows-index/index.db`，报告符号/文件数
7. **全局指令**: 检查 `~/.zcode/AGENTS.md` 是否存在（用户级指令是否部署）

## 输出格式

```
SnowsHarness (ZCode) 健康检查
═════════════════════════════
✓ 插件清单        — snows-harness v1.0.0
✓ Hooks (N)       — N 个事件注册，全部语法有效
✓ MCP snows-index — 已连接，4 个工具
✓ Skills (N)      — N 个 skill
✓ Commands (N)    — N 个命令
✓ 代码索引        — 85 符号 / 236 文件
⚠ 全局指令        — ~/.zcode/AGENTS.md 未找到
─────────────────────────────
问题: [列表 或 "全部正常"]
```

## 退出判断

- 全部通过 → 报告"全部正常"
- 任一失败 → 报告具体问题与修复建议
