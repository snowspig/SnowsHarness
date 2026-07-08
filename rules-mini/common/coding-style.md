# Coding Style

## 通用原则

- 函数 ≤50 行 → 拆分
- 单一职责
- 描述性命名（循环计数器 i,j,k 除外）
- 组合优于继承
- DRY（复制3次 → 提取）

## Python

- PEP 8 风格
- 类型提示（函数签名+返回值）
- f-strings（不用 `%`/`.format()`）
- `pathlib.Path`（不用 `os.path`）
- dataclasses（数据容器）
- context managers（`with` 资源管理）
- async/await（I/O 操作）
- 导入顺序：stdlib → third-party → local
- Docstrings：Google 风格
- 异常：捕获具体异常，不用 bare `except:`
- 常量：UPPER_SNAKE_CASE

## Frontend (TS/JS)

- TS strict mode
- `const` > `let`，不用 `var`
- 回调用箭头函数，方法用普通函数
- 组件名：PascalCase
- 文件名：PascalCase.tsx（组件），kebab-case.ts（工具）
- CSS：CSS modules / Tailwind / styled-components
- 状态：就近原则
- 命名导出 > 默认导出
- 早返回减少嵌套

## API 设计

- RESTful：正确 HTTP 方法 + 状态码
- 请求/响应 schema 验证
- 列表端点分页
- 错误格式：`{"error": {"code": "...", "message": "..."}}`

## 反模式

- ❌ God 对象（职责过多）
- ❌ Magic 数字（提取常量）
- ❌ 深层嵌套（早返回/守卫）
- ❌ 过早抽象
- ❌ 注释掉的代码（删除，git 记得住）
