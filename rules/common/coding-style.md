# Coding Style

## General Principles
- Functions should not exceed 50 lines. If they do, break them into smaller functions.
- Each function should do ONE thing (Single Responsibility Principle).
- Use descriptive variable names. Avoid single-letter variables except for loop counters (i, j, k) and lambda parameters.
- Prefer composition over inheritance.
- DRY (Don't Repeat Yourself) — if you copy-paste the same code 3 times, extract it.

## Python
- Follow PEP 8 style guide.
- Use type hints for all function signatures and return types.
- Use f-strings for string formatting, never `%` or `.format()`.
- Use `pathlib.Path` instead of `os.path`.
- Prefer dataclasses over plain classes for data containers.
- Use context managers (`with`) for resource management.
- Use `async/await` for I/O-bound operations, not threads.
- Import order: stdlib → third-party → local. Use `isort` or `ruff`.
- Docstrings: Google style for public functions/classes.
- Error handling: catch specific exceptions, never bare `except:`.
- Constants: UPPER_SNAKE_CASE at module level.

## Frontend (TypeScript/JavaScript)
- Use TypeScript strict mode.
- Prefer `const` over `let`, never use `var`.
- Use arrow functions for callbacks, regular functions for methods.
- Component names: PascalCase. File names: PascalCase.tsx for components, kebab-case.ts for utilities.
- CSS: Use CSS modules, Tailwind, or styled-components. Avoid inline styles.
- State management: keep state as close to where it's used as possible.
- Prefer named exports over default exports.
- Use early returns to reduce nesting.

## API Design
- RESTful conventions: proper HTTP methods, meaningful status codes.
- Request/response schemas with validation.
- Pagination for list endpoints.
- Consistent error response format: `{"error": {"code": "...", "message": "..."}}`.

## Anti-Patterns to Avoid
- God objects/classes — too many responsibilities
- Magic numbers — extract to named constants
- Deeply nested conditionals — use early returns or guard clauses
- Premature abstraction — three similar lines > a premature helper
- Commented-out code — delete it, git remembers
