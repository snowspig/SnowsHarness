# Testing Guidelines

## 原则

- 独立、幂等
- 测试行为，非实现
- 一测一事
- 描述性名称：`test_<what_should_happen>()`
- AAA 结构：Arrange-Act-Assert

## Python (pytest)

- 测试文件：`tests/test_*.py`
- Fixtures 共享 setup/teardown
- `pytest-asyncio` 测试 async
- `responses`/`httpx` mock HTTP
- `tmp_path` 代替临时文件
- 覆盖率：关键路径，不求 100%

## Frontend

- 单元：`vitest`/`jest`
- 组件：`@testing-library/react`
- E2E：`playwright`（按需）
- 测试文件：`Component.test.tsx`（同位置）

## 何时写测试

- ✅ ALWAYS：bug 修复（先写失败测试）
- ✅ ALWAYS：公共 API 端点
- ✅ ALWAYS：复杂业务逻辑
- ✅ 有用时：纯工具函数
- ⏭️ SKIP：trivial getter/setter、简单 UI、原型

## 测试数据

- 工厂/fixtures，不用硬编码
- 边界：空输入、null、边界值
- 测试错误路径，非仅 happy path

## 运行

```bash
# Python
pytest tests/ -v --tb=short
pytest tests/ --cov=src --cov-report=term-missing

# Frontend
npx vitest run
npx vitest run --coverage
```
