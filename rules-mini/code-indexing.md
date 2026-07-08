## Code Indexing

当 `.snows-index/` 存在时，可通过 MCP 工具访问预索引代码知识图。用其替代 grep/read 进行代码探索。

### 工具选择

| 工具           | 用途                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `code_explore` | "X 如何工作"，"展示 X 及上下文"，理解代码区。返回定义+调用者+被调者（一次调用） |
| `code_search`  | 快速找符号定义位置。仅返回位置                                                  |
| `code_callers` | 找什么调用特定函数/方法                                                         |
| `code_impact`  | 编辑前理解影响范围                                                              |

### 指南

- 返回源代码视为已读 → 不再 grep/Read 验证
- 流问题（"X 如何到达 Y"）→ 先 `code_explore`
- 重构 → `code_search` → `code_callers` → `code_impact` 了解依赖后再编辑
- 索引缺失或过期 → 运行 `node ~/.claude/hooks/code-index-init.js` 重建
- 索引随文件写自动更新。手动刷新：`/index rebuild`
