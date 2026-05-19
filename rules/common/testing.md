# Testing Guidelines

## Principles
- Tests should be independent and idempotent.
- Test behavior, not implementation details.
- Each test should verify ONE thing.
- Use descriptive test names that explain the expected behavior.
- Arrange-Act-Assert (AAA) pattern for test structure.

## Python Testing
- Framework: `pytest` (default)
- Test files: `test_*.py` in `tests/` directory
- Test functions: `def test_<behavior_description>()`
- Fixtures for shared setup/teardown
- Use `pytest-asyncio` for async tests
- Use `responses` or `httpx` for mocking HTTP calls
- Use `tmp_path` fixture instead of manual temp files
- Coverage: aim for critical path coverage, not 100%

```python
# Good test name
def test_user_registration_rejects_duplicate_email():
    ...

# Bad test name
def test_user():
    ...
```

## Frontend Testing
- Unit tests: `vitest` or `jest`
- Component tests: `@testing-library/react`
- E2E tests: `playwright` (when needed)
- Test files co-located: `Component.test.tsx`

## When to Write Tests
- ALWAYS: bug fixes (write test that reproduces the bug FIRST)
- ALWAYS: public API endpoints
- ALWAYS: complex business logic
- WHEN USEFUL: pure utility functions
- SKIP: trivial getters/setters, simple UI, prototypes

## Test Data
- Use factories or fixtures, not hardcoded data
- Edge cases: empty input, null/undefined, boundary values
- Test error paths, not just happy paths

## Running Tests
```bash
# Python
pytest tests/ -v --tb=short
pytest tests/ --cov=src --cov-report=term-missing

# Frontend
npx vitest run
npx vitest run --coverage
```
