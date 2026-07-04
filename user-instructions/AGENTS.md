# SnowsHarness 全局指令

> 本文件复制到 `~/.zcode/AGENTS.md` 后，对所有 ZCode 项目生效。
> 项目专属规则请放在各项目的 `<repo>/AGENTS.md`（会覆盖这里的宽泛默认）。

## 协作原则

从原始需求和问题本质出发，不从惯例和模板出发：

- **目标不清就停下讨论** —— 不假设用户清楚自己想要什么；动机或目标不清晰时，停下来澄清
- **路径次优就直说** —— 目标清晰但所选路径不是最优时，直接指出并建议更优解
- **追根因，不打补丁** —— 始终追溯问题根因，不掩盖问题；但严格度匹配场景（生产代码追根因，临时脚本能跑就行）
- **每个决策都要能回答"为什么"**
- **只输出能改变决策的内容，其余删掉**

## 编码风格

- 函数 < 50 行，单一职责；超长就拆成更小的函数
- 命名达意，禁止单字母（循环计数 i/j/k 和 lambda 参数除外）
- 优先组合而非继承；DRY —— 同样代码复制 3 次就抽取

### Python
- 遵循 PEP 8；所有函数签名和返回类型加类型注解
- 字符串用 f-string，不用 `%` 或 `.format()`
- 路径用 `pathlib.Path`，不用 `os.path`
- 数据容器用 dataclass；资源管理用 `with`
- I/O 密集用 `async/await`，不用线程
- 导入顺序：stdlib → 第三方 → 本地（用 isort 或 ruff）
- 捕获具体异常，**禁止 bare `except:`**
- 常量用 UPPER_SNAKE_CASE 放模块级

### Frontend (TypeScript/JavaScript)
- strict 模式；`const` 优先，禁用 `var`
- 回调用箭头函数，方法用常规函数
- 组件名 PascalCase；工具文件 kebab-case
- 优先 named exports；用 early return 减少嵌套

### API 设计
- RESTful 约定：正确 HTTP 方法 + 有意义状态码
- 列表端点加分页；统一错误格式 `{"error":{"code","message"}}`

## 反模式（禁止）

- God object（职责过多的类）
- 魔法数字（提取为命名常量）
- 深层嵌套（>3 层用 guard clause）
- 注释掉的代码（删掉，git 会记住）
- 过早抽象（三行相似 ≠ 立刻抽 helper）

## Git 工作流

- Commit 格式 `<type>: <subject>`，type: feat/fix/refactor/perf/docs/test/chore/style
- Subject ≤ 72 字符，祈使语气，不以句号结尾；body 解释 WHY
- 分支：`feature/<name>`、`fix/<name>`、`refactor/<name>`；分支存活 < 3 天
- **禁止** force push 到 main/master；**禁止**提交密钥；commit 前必查 `git status`
- 不提交 `__pycache__/`、`node_modules/`、`.env`、`*.pyc`

## 文件组织

禁止在项目根目录创建散落文件：

- 计划/设计文档 → `docs/`
- 临时脚本（debug_*.py、test_*.ps1 等）→ `tmp/`（任务完成后清理）
- 生成代码 → `src/` 或对应子目录
- 不确定文件该放哪时，先问再建

## 测试

- 测试独立、幂等；每个测试验证一件事；用 AAA 模式
- **必须写测试**：bug 修复（先写复现测试）、公开 API、复杂业务逻辑
- **可跳过**：琐碎 getter/setter、原型
- Python: pytest；Frontend: vitest/jest + @testing-library/react

## 性能

- 先测量再优化，别猜；优化瓶颈，不是所有东西
- Python: 大数据集用 generator；循环内字符串拼接用 `str.join()`；成员判断用 `set`
- Frontend: 路由懒加载；长列表虚拟化；防抖昂贵事件处理器
- 数据库: 加索引；避免 N+1 查询；用连接池

## Harness 质量

每个 harness 组件（hook、skill、command）都应注明：为何存在、什么能力提升后可删除。
每 3 个月或大模型升级后复盘，移除不再产生价值的组件 —— 零件越少，故障越少。
