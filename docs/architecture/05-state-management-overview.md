# State Management Overview

## Zustand Store Architecture

The entire application state is managed by a single Zustand store composed from 10 domain-specific slices. The store is defined in `src/stores/useAppStore.ts` and wrapped with the `persist` middleware for selective localStorage persistence.

### Store Type System

The central type file (`src/stores/types.ts`) defines:

```typescript
// AppState is the intersection of all slice interfaces
export type AppState = AppSlice &
  SettingsSlice &
  NavigationSlice &
  MessagesSlice &
  MoodSlice &
  InteractionsSlice &
  PartnerSlice &
  NotesSlice &
  PhotosSlice &
  ScriptureReadingSlice;

// Slice creator type with persist middleware support
export type AppStateCreator<T> = StateCreator<
  AppState,
  [['zustand/persist', Partial<AppState>]],
  [],
  T
>;
```

The `AppSlice` interface is defined in `types.ts` (not in `appSlice.ts`) to prevent circular imports, since all slices need to reference the full `AppState` type.

### Slice Inventory

| Slice | File | Persisted | Cross-Slice Deps |
|-------|------|-----------|-----------------|
| `AppSlice` | `appSlice.ts` | No | None |
| `SettingsSlice` | `settingsSlice.ts` | Yes (`settings`, `isOnboarded`) | MessagesSlice (initializeApp) |
| `NavigationSlice` | `navigationSlice.ts` | No | None |
| `MessagesSlice` | `messagesSlice.ts` | Yes (`messageHistory`) | SettingsSlice (read settings) |
| `MoodSlice` | `moodSlice.ts` | Yes (`moods`) | None |
| `InteractionsSlice` | `interactionsSlice.ts` | No | None |
| `PartnerSlice` | `partnerSlice.ts` | No | None |
| `NotesSlice` | `notesSlice.ts` | No | None |
| `PhotosSlice` | `photosSlice.ts` | No | None |
| `ScriptureReadingSlice` | `scriptureReadingSlice.ts` | No | None |

### Persistence Configuration

The `partialize` function selects which state to persist to localStorage:

```typescript
partialize: (state) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: state.messageHistory,
  moods: state.moods,
}),
```

This keeps the localStorage payload small (settings + flags + mood cache) while large data (photos, notes, scripture sessions) stays in IndexedDB or is fetched from Supabase on demand.

### Initialization Flow

```
main.tsx
    |-- StrictMode + LazyMotion(domAnimation)
    |-- Renders <App />
    |
App.tsx
    |-- useEffect calls initializeApp()
    |
settingsSlice.initializeApp()
    |-- Guard: isInitializing / isInitialized (module-level flags for StrictMode protection)
    |-- Check __isHydrated flag (Zustand persist hydration)
    |-- If not hydrated: clear corrupted localStorage, return
    |-- storageService.init() (open IndexedDB)
    |-- Load messages from IndexedDB
    |-- If empty: load default messages, write to IndexedDB
    |-- updateCurrentMessage() (MessagesSlice)
    |-- setLoading(false)
```

### E2E Testing Support

The store exposes itself to `window.__STORE__` in development and test environments for E2E test access:

```typescript
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as Record<string, unknown>).__STORE__ = useAppStore;
}
```

## Related Documentation

- [Zustand Store Configuration](../state-management/01-zustand-store-configuration.md)
- [Slice Details](../state-management/02-slice-details.md)
- [Data Flow Patterns](../state-management/04-data-flow.md)
- [Persistence Strategy](../state-management/05-persistence-strategy.md)
