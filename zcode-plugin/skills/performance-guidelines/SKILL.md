---
name: performance-guidelines
description: 性能优化指南。当用户讨论性能、优化、慢查询、卡顿、或需要提升吞吐/降低延迟时加载。覆盖 Python/Frontend/API/Database 各层性能要点。
---

# 性能指南

## 总则
- 先测量再优化，别猜
- 优化瓶颈，不是所有东西（过早优化是万恶之源）
- 缓存昂贵的，计算便宜的
- 数据结构选择考虑时间复杂度（Big O）

## Python
- 大数据集用 generator（`yield`），不要构建列表
- 循环内字符串拼接用 `str.join()`，不用 `+`
- 成员判断用 `set`（O(1)），不用 `list`
- 队列操作用 `collections.deque`
- 避免重复 I/O —— 批量读、用缓冲
- 优化前先 profile：`cProfile`、`line_profiler`
- 昂贵的纯函数用 `functools.lru_cache`
- CPU 密集用 `multiprocessing`；I/O 密集用 `asyncio`
- 数据库：连接池、批量查询、加索引

## Frontend
- 路由和重组件懒加载（`React.lazy`、`Suspense`）
- 长列表虚拟化（`react-window`、`react-virtuoso`）
- 昂贵事件处理器防抖/节流（scroll、resize、input）
- 避免不必要重渲染：`React.memo`、`useMemo`、`useCallback`
- 预取可能导航的数据
- 图片优化：WebP、懒加载、响应式尺寸
- 包分割：初始包 < 200KB gzipped

## API
- 列表端点加分页
- 适当处用响应缓存
- 最小化响应 payload —— 只返回需要的字段
- 大响应用流式
- 加速率限制

## Database
- 频繁查询的列加索引
- 避免 N+1 查询 —— 用 `select_related`/`joinedload`（ORM）或 JOIN
- 用连接池
- 读多写少考虑读副本
- 监控慢查询
