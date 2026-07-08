# Python Patterns

## 项目结构

```
project/
├── src/package_name/
│   ├── __init__.py, main.py, models.py, services.py, utils.py
├── tests/conftest.py, test_*.py
├── pyproject.toml, README.md
```

## 设计模式

### Strategy Pattern

```python
class PricingStrategy(Protocol):
    def calculate(self, price: float) -> float: ...
```

### Factory Pattern

```python
def create_database(config: dict) -> Database:
    if config["type"] == "postgres": return PostgresDatabase(config)
    return SQLiteDatabase(config)
```

### Observer Pattern

```python
class EventBus:
    _handlers: dict[str, list[Callable]] = {}
    def on(self, event: str, handler: Callable) -> None: ...
```

## 错误处理模式

```python
@dataclass
class Result[T]:
    value: T | None = None
    error: str | None = None
    @property
    def is_ok(self) -> bool: return self.error is None
    def unwrap(self) -> T:
        if self.error: raise ValueError(self.error)
        return self.value
```

## 配置模式

```python
from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    database_url: str
    debug: bool = False
    model_config = SettingsConfigDict(env_prefix="APP_")
```

## Async 模式

```python
# 并行 I/O
async def fetch_all(urls: list[str]) -> list[Response]:
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(url) for url in urls]
        return await asyncio.gather(*tasks)

# 后台任务（可取消）
async def run_with_timeout(coro, timeout: float = 30.0):
    return await asyncio.wait_for(coro, timeout)
```

## 日志

- `structlog` 或 `logging` 结构化输出
- 级别：DEBUG(开发), INFO(操作), WARNING(可恢复), ERROR(失败)
- 不记录 secrets/PII
- 请求追踪用 correlation ID
