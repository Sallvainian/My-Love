---
paths:
  - "src/stores/**/*.ts"
---

# Zustand State Management

## Slice Composition Pattern
- Factory functions create slices with typed state and actions
- Cross-slice access via `get()` parameter
- Combine slices in root store with `...createSlice(set, get)`

## Selector Pattern (MANDATORY)
```typescript
// Always use selectors
const value = useAppStore(state => state.value);
const { action } = useAppStore(state => ({ action: state.action }));

// NEVER destructure the whole store
// BAD: const { value, action } = useAppStore();
```

## Persistence Strategy
- LocalStorage: User settings, preferences
- IndexedDB: Application data (couples, memories, anniversaries)
- Map serialization via `partialize` + `onRehydrateStorage`

## Hydration Pattern
- Use `__isHydrated` flag to guard initialization
- Wait for hydration before critical operations
- Handle storage errors gracefully
