# Direct Store Access Pattern

Components access the store via selector functions for optimal re-render performance.

## Selector Pattern

```typescript
// Select specific state fields to minimize re-renders
const currentView = useAppStore((state) => state.currentView);
const settings = useAppStore((state) => state.settings);
const isLoading = useAppStore((state) => state.isLoading);
```

Each selector creates a subscription that only triggers re-renders when the selected value changes (shallow equality by default).

## Multiple Selectors

For components that need multiple state fields, use individual selectors rather than one object selector:

```typescript
// GOOD: Each selector triggers re-render only when its value changes
const notes = useAppStore((state) => state.notes);
const notesIsLoading = useAppStore((state) => state.notesIsLoading);
const sendNote = useAppStore((state) => state.sendNote);

// AVOID: New object reference on every state change triggers unnecessary re-renders
const { notes, notesIsLoading, sendNote } = useAppStore((state) => ({
  notes: state.notes,
  notesIsLoading: state.notesIsLoading,
  sendNote: state.sendNote,
}));
```

## Action Selectors

Actions are stable references (they never change), so selecting them does not cause re-renders:

```typescript
const setView = useAppStore((state) => state.setView);
const addMoodEntry = useAppStore((state) => state.addMoodEntry);
const syncPendingMoods = useAppStore((state) => state.syncPendingMoods);
```

## App.tsx Destructured Access

The root `App` component uses destructuring for convenience since it subscribes to many fields:

```typescript
const {
  settings,
  initializeApp,
  isLoading,
  currentView,
  setView,
  syncPendingMoods,
  updateSyncStatus,
  syncStatus,
} = useAppStore();
```

This subscribes to the entire store. In `App.tsx` this is acceptable because:
- It is the root component (re-renders cascade anyway)
- It needs many state fields for routing and initialization
- Performance impact is minimal at the root level

## Outside React (Store API)

For non-React contexts (Service Worker messages, event handlers), use `getState()`:

```typescript
// In App.tsx event handler
const handleMessage = async (event: MessageEvent) => {
  if (event.data?.type === 'BACKGROUND_SYNC_COMPLETED') {
    await updateSyncStatus();
  }
};
```

For testing or debugging:

```typescript
// Window-exposed store access
window.__APP_STORE__?.getState().currentView;
window.__APP_STORE__?.getState().setView('photos');
```

## Cross-Slice Access via `get()`

Inside slice creators, `get()` returns the full `AppState`:

```typescript
export const createSettingsSlice: AppStateCreator<SettingsSlice> = (set, get, _api) => ({
  initializeApp: async () => {
    // Access AppSlice methods
    get().setLoading(true);
    get().setError(null);

    // Access AppSlice state
    const isHydrated = get().__isHydrated;

    // Access MessagesSlice methods
    get().updateCurrentMessage();
  },
});
```

This pattern is type-safe because `AppStateCreator<Slice>` includes `AppState` as the full store type.

## When to Use Each Pattern

| Context | Pattern | Example |
|---|---|---|
| Component needs 1-2 fields | Individual selectors | `useAppStore((s) => s.currentView)` |
| Component needs many fields | Destructured (root components only) | `const { settings, isLoading } = useAppStore()` |
| Component needs only actions | Action selectors | `useAppStore((s) => s.setView)` |
| Custom hook | Individual selectors | `useAppStore((s) => s.fetchNotes)` |
| Slice accessing other slices | `get()` | `get().updateCurrentMessage()` |
| Event handler (non-React) | `getState()` | `useAppStore.getState().syncPendingMoods()` |
| E2E test | `window.__APP_STORE__` | `page.evaluate(() => window.__APP_STORE__.getState())` |
