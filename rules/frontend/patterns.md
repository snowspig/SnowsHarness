# Frontend Patterns

## Project Structure (Next.js)
```
src/
├── app/              # App Router pages
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/          # API routes
├── components/
│   ├── ui/           # Reusable UI primitives
│   └── features/     # Feature-specific components
├── hooks/            # Custom React hooks
├── lib/              # Utilities and helpers
├── stores/           # State management
├── types/            # TypeScript type definitions
└── styles/           # Global styles
```

## Component Design
- Keep components small and focused (< 200 lines).
- Extract complex logic into custom hooks.
- Use composition over prop drilling.
- Prefer controlled components.

### Custom Hook Pattern
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

### Compound Component Pattern
```typescript
// <Accordion><Accordion.Item>...</Accordion.Item></Accordion>
const Accordion = ({ children }) => (
  <div className="accordion">{children}</div>
);
Accordion.Item = ({ title, children }) => { /* ... */ };
```

## State Management
- **Local state** (`useState`): UI state within a component
- **Shared state** (`useContext` / `zustand`): cross-component state
- **Server state** (`@tanstack/react-query`): API data with caching
- **URL state**: filters, pagination, selected items

## API Call Pattern
```typescript
// Custom hook wrapping react-query
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
```

## Error Handling
- Error boundaries for component trees.
- `react-query` has built-in error states.
- Toast notifications for user-facing errors.
- Never show raw error messages to users.

## Styling Guidelines
- Tailwind: utility-first, responsive-first.
- CSS custom properties for design tokens.
- Mobile-first responsive design.
- Consistent spacing scale (4px grid).
- Dark mode support from the start if needed.

## Performance Checklist
- [ ] Images optimized and lazy-loaded
- [ ] Routes code-split
- [ ] Heavy components lazy-loaded
- [ ] No unnecessary re-renders
- [ ] Bundle size monitored
- [ ] Fonts optimized (preloaded, swap)
