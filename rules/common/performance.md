# Performance Guidelines

## Python
- Use generators (`yield`) for large datasets instead of building lists.
- Use `str.join()` instead of `+` for string concatenation in loops.
- Use `set` for O(1) membership testing instead of `list`.
- Use `collections.deque` for queue operations.
- Avoid repeated I/O — batch reads, use buffers.
- Profile before optimizing: `cProfile`, `line_profiler`.
- Use `functools.lru_cache` for expensive pure function calls.
- For CPU-bound work: `multiprocessing`; for I/O-bound: `asyncio`.
- Database: use connection pools, batch queries, add indexes.

## Frontend
- Lazy load routes and heavy components (`React.lazy`, `Suspense`).
- Virtualize long lists (`react-window`, `react-virtuoso`).
- Debounce/throttle expensive event handlers (scroll, resize, input).
- Avoid unnecessary re-renders: `React.memo`, `useMemo`, `useCallback`.
- Prefetch data for likely next navigation.
- Optimize images: WebP format, lazy loading, responsive sizes.
- Bundle splitting: keep initial bundle < 200KB gzipped.

## API
- Add pagination to list endpoints.
- Use response caching where appropriate.
- Minimize response payload — only return needed fields.
- Use streaming for large responses.
- Add rate limiting.

## Database
- Add indexes for frequently queried columns.
- Avoid N+1 queries — use `select_related`/`joinedload` (ORM) or JOINs.
- Use connection pooling.
- Consider read replicas for read-heavy workloads.
- Monitor slow queries.

## General
- Measure first, optimize second. Don't guess.
- Premature optimization is the root of all evil — optimize bottlenecks, not everything.
- Cache the expensive, compute the cheap.
- Consider time complexity (Big O) for data structure choices.
