---
paths:
  - "src/components/**/*.tsx"
  - "src/hooks/**/*.ts"
---

# React Component Patterns

## Architecture
- Pure client-side SPA (React 19 + Vite) - never use "use client" or "use server"
- Feature-based folders: `src/components/[FeatureName]/`
- Colocated tests in `__tests__/` subdirectory

## Component Patterns
- Lazy loading: `React.lazy()` for route-level components
- `useTransition` for non-urgent updates
- Custom hooks in `src/hooks/` for reusable logic
- Prefer function components over class components

## File Organization
```
src/components/
├── Auth/
│   ├── LoginForm.tsx
│   ├── __tests__/
│   │   └── LoginForm.test.tsx
│   └── index.ts
```

## Import Order
1. React imports
2. Third-party libraries
3. Local components
4. Hooks
5. Types
6. Styles/constants
