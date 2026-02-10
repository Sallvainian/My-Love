# Overview

My-Love uses **Zustand 5.0.11** with the `persist` middleware for centralized state management. The store follows a **slice-based architecture** where each feature domain owns its own state shape, actions, and initialization logic. Slices are composed into a single `useAppStore` hook via the `create` function.

## Why Zustand

| Decision | Benefit | Trade-off |
|---|---|---|
| Zustand over Redux | Less boilerplate, smaller bundle (~3KB) | No middleware ecosystem, no action replay |
| Single store | All state accessible via `get()` | Slice composition requires careful typing |
| `persist` middleware | Automatic localStorage hydration | Map serialization/deserialization complexity |
| Slice pattern | Feature isolation, independent development | Cross-slice access requires `get()` casting |

## Store Architecture

```
useAppStore (single Zustand store)
  |-- persist middleware (localStorage)
  |     |-- partialize (selective field persistence)
  |     |-- onRehydrateStorage (Map deserialization, validation)
  |     |-- createJSONStorage (pre-hydration validation)
  |
  |-- 10 Slices (composed via spread operator)
        |-- appSlice         (core: loading, error, hydration)
        |-- settingsSlice    (settings, onboarding, theme, init)
        |-- navigationSlice  (view routing, browser history)
        |-- messagesSlice    (daily messages, history, custom messages)
        |-- moodSlice        (mood entries, sync, partner moods)
        |-- interactionsSlice (poke/kiss, realtime subscription)
        |-- partnerSlice     (partner connection, search, requests)
        |-- notesSlice       (love notes chat, send, pagination)
        |-- photosSlice      (photo upload, gallery, storage quota)
        |-- scriptureReadingSlice (scripture sessions, reflections)
```

## Type-Safe Slice Creator Pattern

All slices use a shared type alias that provides full access to the composed `AppState` via `get()`:

```typescript
// src/stores/types.ts
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
```

This allows any slice to read state from other slices:

```typescript
// In messagesSlice, accessing settings from settingsSlice
const { settings } = get(); // settings comes from SettingsSlice
```

## Circular Dependency Prevention

The `AppSlice` interface is defined in `types.ts` (not `appSlice.ts`) to prevent circular imports:

```typescript
// src/stores/types.ts
export interface AppSlice {
  isLoading: boolean;
  error: string | null;
  __isHydrated: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
}

export interface AppState
  extends AppSlice,
    SettingsSlice,
    NavigationSlice,
    MessagesSlice,
    MoodSlice,
    InteractionsSlice,
    PartnerSlice,
    NotesSlice,
    PhotosSlice,
    ScriptureReadingSlice {}
```

## Initialization Flow

1. Store is created with `create<AppState>()(persist(...))`
2. `persist` middleware reads from localStorage and calls `onRehydrateStorage`
3. Map deserialization converts `shownMessages` from Array back to Map
4. `__isHydrated` is set to `true`
5. `App.tsx` calls `initializeApp()` (from `settingsSlice`)
6. `initializeApp` checks `__isHydrated`, initializes IndexedDB, loads messages
7. `updateCurrentMessage()` computes today's daily message

## E2E Testing Support

The store is exposed on `window.__APP_STORE__` for Playwright test access:

```typescript
if (typeof window !== 'undefined') {
  window.__APP_STORE__ = useAppStore;
}
```
