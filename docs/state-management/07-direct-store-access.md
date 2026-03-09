# Direct Store Access Patterns

## Inside React Components

### useAppStore Hook

Primary access method:

```typescript
import { useAppStore } from '../stores/useAppStore';

// Single selector (re-renders only when this value changes)
const currentView = useAppStore((state) => state.currentView);

// Action extraction (stable reference)
const setView = useAppStore((state) => state.setView);

// Multiple selectors with useShallow (prevents object-identity re-renders)
import { useShallow } from 'zustand/react/shallow';
const { session, scriptureLoading } = useAppStore(
  useShallow((state) => ({
    session: state.session,
    scriptureLoading: state.scriptureLoading,
  }))
);
```

**Performance**: Zustand uses reference equality by default. Selecting a new object on every render creates a new reference. Use `useShallow` for multi-field selectors (used by ScriptureOverview, SoloReadingFlow, LobbyContainer, ReadingContainer).

## Outside React Components

### getState() for Reads

```typescript
const currentMoods = useAppStore.getState().moods;
const isOnline = useAppStore.getState().syncStatus.isOnline;
```

Used in service workers, utility functions, and initialization code.

### setState() for Writes

```typescript
// Direct partial update
useAppStore.setState({ isLoading: false });

// Updater function for state-dependent updates
useAppStore.setState((state) => ({
  moods: [...state.moods, newMood],
}));
```

### subscribe() for Side Effects

```typescript
const unsubscribe = useAppStore.subscribe(
  (state) => state.syncStatus.pendingMoods,
  (pendingMoods) => {
    if (pendingMoods > 0) {
      registerBackgroundSync('sync-pending-moods');
    }
  }
);
```

## E2E Testing Access

In non-production environments, the store is exposed on `window.__APP_STORE__`:

```typescript
// src/stores/useAppStore.ts
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  window.__APP_STORE__ = useAppStore;
}
```

E2E tests access via:

```typescript
// Playwright test
await page.evaluate(() => {
  const store = window.__APP_STORE__;
  return store?.getState().moods.length;
});
```

The global type declaration:

```typescript
declare global {
  interface Window {
    __APP_STORE__?: typeof useAppStore;
  }
}
```

## Cross-Slice Access Within Slices

Inside slice creators, `get()` provides full `AppState`:

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

## Service Layer Boundary

Services (IndexedDB, Supabase) do NOT access the store directly. Data flows unidirectionally:

```
Component -> useAppStore (hook) -> Slice Action -> Service -> IndexedDB/Supabase
```

This keeps services stateless and testable.

## Related Documentation

- [React Hooks](./06-react-hooks.md)
- [Store Configuration](./01-zustand-store-configuration.md)
- [Slice Details](./02-slice-details.md)
