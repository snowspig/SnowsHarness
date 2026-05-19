# Python Patterns

## Project Structure
```
project/
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── main.py
│       ├── models.py
│       ├── services.py
│       └── utils.py
├── tests/
│   ├── conftest.py
│   └── test_*.py
├── pyproject.toml
└── README.md
```

## Design Patterns

### Strategy Pattern
Use when you have multiple algorithms for the same task:
```python
class PricingStrategy(Protocol):
    def calculate(self, price: float) -> float: ...

class DiscountStrategy:
    def calculate(self, price: float) -> float:
        return price * 0.9
```

### Factory Pattern
Use for object creation with complex setup:
```python
def create_database(config: dict) -> Database:
    if config["type"] == "postgres":
        return PostgresDatabase(config)
    return SQLiteDatabase(config)
```

### Observer Pattern
Use `asyncio` events for event-driven architectures:
```python
class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def on(self, event: str, handler: Callable) -> None:
        self._handlers.setdefault(event, []).append(handler)
```

## Error Handling Pattern
```python
from dataclasses import dataclass

@dataclass
class Result[T]:
    value: T | None = None
    error: str | None = None

    @property
    def is_ok(self) -> bool:
        return self.error is None

    def unwrap(self) -> T:
        if self.error:
            raise ValueError(self.error)
        return self.value
```

## Configuration Pattern
Use pydantic for type-safe config:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    debug: bool = False
    api_key: str

    model_config = SettingsConfigDict(env_prefix="APP_")
```

## Async Patterns
```python
# Parallel I/O with asyncio.gather
async def fetch_all(urls: list[str]) -> list[Response]:
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(url) for url in urls]
        return await asyncio.gather(*tasks)

# Background task with cancellation
async def run_with_timeout(coro, timeout: float = 30.0):
    return await asyncio.wait_for(coro, timeout=timeout)
```

## Logging
- Use `structlog` or `logging` with structured output.
- Log levels: DEBUG for dev, INFO for operations, WARNING for recoverable issues, ERROR for failures.
- Never log secrets or PII.
- Correlation IDs for request tracing.
