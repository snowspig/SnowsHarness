# Performance Guidelines

## Python

- 大数据用 `yield` 生成器（不用 list）
- `str.join()` 代替循环 `+` 拼接
- `set` O(1) 成员测试（不用 list）
- `collections.deque` 队列操作
- 批量 I/O，减少重复
- 优化前 profiling：`cProfile`, `line_profiler`
- `functools.lru_cache` 缓存纯函数
- CPU-bound → `multiprocessing`，I/O-bound → `asyncio`
- DB：连接池、批量查询、索引

## Frontend

- 路由+重组件懒加载（`React.lazy`, `Suspense`）
- 长列表虚拟化（`react-window`, `react-virtuoso`）
- 昂贵事件防抖/节流
- 避免不必要重渲染：`React.memo`, `useMemo`, `useCallback`
- 预取可能导航的数据
- 图片优化：WebP、lazy、responsive
- Bundle 分离：初始 <200KB gzipped

## API

- 列表端点分页
- 响应缓存
- 最小化 payload → 仅返回需要字段
- 大响应流式传输
- 速率限制

## Database

- 常查询列加索引
- 避免 N+1 → `select_related`/`joinedload` 或 JOIN
- 连接池
- 读密集考虑读副本
- 监控慢查询

## 通用

- 先测量，后优化（不猜测）
- 过早优化万恶之源 → 优化瓶颈
- 缓存昂贵，计算便宜
- 考虑 Big O 选择数据结构
