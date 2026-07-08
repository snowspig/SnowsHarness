# Frontend Patterns

## 项目结构 (Next.js)

```
src/
├── app/          # App Router 页面 + API routes
├── components/   # ui(原语) + features(特定组件)
├── hooks/        # 自定义 React hooks
├── lib/          # 工具
├── stores/       # 状态管理
├── types/        # TS 类型
└── styles/       # 全局样式
```

## 组件设计

- 小而专注（<200 行）
- 复杂逻辑 → 自定义 hook
- 组合优于 prop drilling
- 优先受控组件

### Hook 模式

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### 复合组件模式

```typescript
const Accordion = ({ children }) => <div className="accordion">{children}</div>;
Accordion.Item = ({ title, children }) => { /* ... */ };
```

## 状态管理

- **本地** (`useState`): 组件内 UI 状态
- **共享** (`useContext`/`zustand`): 跨组件状态
- **服务端** (`@tanstack/react-query`): API 数据+缓存
- **URL**: 过滤器、分页、选中项

## API 调用模式

```typescript
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
```

## 错误处理

- Error boundaries 包裹组件树
- `react-query` 内置错误状态
- Toast 通知用户错误
- 不展示原始错误消息

## 样式

- Tailwind: utility-first, responsive-first
- CSS 变量设计 token
- 移动优先响应式
- 一致间距（4px 网格）
- 开始即支持暗色模式（如需要）

## 性能检查

- 图片优化+懒加载 ✓
- 路由代码分割 ✓
- 重组件懒加载 ✓
- 无不必要重渲染 ✓
- 监控 bundle 大小 ✓
- 字体优化 ✓
