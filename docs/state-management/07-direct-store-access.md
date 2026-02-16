# Direct Store Access Patterns

## Overview

Zustand stores can be accessed both inside React components (via hooks) and outside React components (via direct store API). This document covers both patterns.

## Inside React Components

### useAppStore Hook

The primary way to access state in React components:

```typescript
import { useAppStore } from '../stores/useAppStore';

function MoodTracker() {
  // Select specific state (re-renders only when selected state changes)
  const moods = useAppStore((state) => state.moods);
  const addMoodEntry = useAppStore((state) => state.addMoodEntry);

  // Multiple selections (object selector)
  const { syncStatus, updateSyncStatus } = useAppStore((state) => ({
    syncStatus: state.syncStatus,
    updateSyncStatus: state.updateSyncStatus,
  }));
}
```

**Performance note:** Zustand uses reference equality by default. Selecting a new object on every render (`{ a: state.a, b: state.b }`) creates a new reference each time. For multiple selectors, either use `useShallow` from `zustand/react/shallow` or extract selectors individually.

### Selector Best Practices

**Granular selectors** minimize re-renders:

```typescript
// Good: Only re-renders when currentView changes
const currentView = useAppStore((state) => state.currentView);

// Avoid: Re-renders whenever any state changes
const state = useAppStore();
```

## Outside React Components

### getState() for Reads

```typescript
import { useAppStore } from '../stores/useAppStore';

// Read current state snapshot
const currentMoods = useAppStore.getState().moods;
const isOnline = useAppStore.getState().syncStatus.isOnline;
```

### setState() for Writes

```typescript
// Direct state update
useAppStore.setState({ isLoading: false });

// Updater function for state-dependent updates
useAppStore.setState((state) => ({
  moods: [...state.moods, newMood],
}));
```

### subscribe() for Side Effects

```typescript
// Listen for state changes outside React
const unsubscribe = useAppStore.subscribe(
  (state) => state.syncStatus.pendingMoods,
  (pendingMoods) => {
    if (pendingMoods > 0) {
      registerBackgroundSync('sync-pending-moods');
    }
  }
);

// Cleanup
unsubscribe();
```

## E2E Testing Access

In development and test environments, the store is exposed globally:

```typescript
// src/stores/useAppStore.ts
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as Record<string, unknown>).__STORE__ = useAppStore;
}
```

E2E tests can then:

```typescript
// In Playwright test
await page.evaluate(() => {
  const store = (window as any).__STORE__;
  const state = store.getState();
  return state.moods.length;
});
```

## Cross-Slice Access Within Slices

Inside slice creators, `get()` provides the full `AppState`:

```typescript
export const createMoodSlice: AppStateCreator<MoodSlice> = (set, get, _api) => ({
  addMoodEntry: async (moods, note) => {
    // Read from any slice
    const settings = get().settings;

    // Call actions from any slice
    get().setLoading(true);

    // Update own state
    set((state) => ({
      moods: [...state.moods, created],
    }));
  },
});
```

## Service Layer Store Access

Services (IndexedDB, Supabase) do **not** access the store directly. Instead, data flows through slices:

```
Component -> useAppStore (hook) -> Slice Action -> Service -> IndexedDB/Supabase
```

This keeps services stateless and testable.

## Related Documentation

- [React Hooks](./06-react-hooks.md)
- [Zustand Store Configuration](./01-zustand-store-configuration.md)
- [Slice Details](./02-slice-details.md)
