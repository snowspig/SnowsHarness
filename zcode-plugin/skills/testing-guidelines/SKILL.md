---
name: testing-guidelines
description: 测试编写指南。当用户写测试、要求测试覆盖、修 bug 需先写复现测试、或讨论测试策略时加载。覆盖 Python(pytest) 与 Frontend(vitest/jest) 的测试约定。
---

# 测试指南

## 原则
- 测试独立且幂等
- 测行为，不测实现细节
- 每个测试验证一件事
- 测试名说明预期行为（`test_user_registration_rejects_duplicate_email` ✓，`test_user` ✗）
- AAA 模式：Arrange-Act-Assert

## Python 测试
- 框架：`pytest`（默认）
- 测试文件：`tests/` 下的 `test_*.py`
- 函数：`def test_<behavior_description>()`
- 共享 setup/teardown 用 fixture
- async 测试用 `pytest-asyncio`
- mock HTTP 用 `responses` 或 `httpx`
- 临时文件用 `tmp_path` fixture
- 覆盖率：关注关键路径，不必 100%

```python
# 好的测试名
def test_user_registration_rejects_duplicate_email():
    ...

# 坏的测试名
def test_user():
    ...
```

## Frontend 测试
- 单元：`vitest` 或 `jest`
- 组件：`@testing-library/react`
- E2E：`playwright`（需要时）
- 测试文件同置：`Component.test.tsx`

## 何时写测试
- **必须**：bug 修复（先写复现测试）、公开 API、复杂业务逻辑
- **有用时**：纯工具函数
- **跳过**：琐碎 getter/setter、简单 UI、原型

## 测试数据
- 用工厂或 fixture，不用硬编码
- 边界：空输入、null/undefined、边界值
- 测错误路径，不只测 happy path

## 运行
```bash
# Python
pytest tests/ -v --tb=short
pytest tests/ --cov=src --cov-report=term-missing

# Frontend
npx vitest run
npx vitest run --coverage
```
