# Overview

My Love uses **Zustand** with the `persist` middleware for centralized state management. The store follows a **slice-based architecture** where each feature domain owns its own state shape, actions, and initialization logic. Slices are composed into a single `useAppStore` hook via the `create` function.

**Key design decisions:**

- **Single store, multiple slices** -- All application state lives in one Zustand store (`useAppStore`), composed from 10 independent slice creators.
- **Persist middleware** -- Critical user settings and message history are automatically serialized to `localStorage` via Zustand's `persist` middleware. Bulk data (messages, photos, moods) uses IndexedDB or Supabase.
- **Type-safe slice creators** -- Every slice uses the shared `AppStateCreator<Slice>` generic, which encodes the middleware tuple so slices can safely call cross-slice actions via `get()`.
- **No context providers** -- Zustand stores are module-scoped singletons. Components subscribe to state with selector functions and re-render only when selected values change.

## Technology Stack

| Concern | Technology |
|---------|------------|
| State library | Zustand 4.x |
| Persistence (small data) | `zustand/middleware` `persist` with `localStorage` |
| Persistence (bulk data) | IndexedDB via `storageService` / `moodService` / `customMessageService` |
| Remote persistence | Supabase (photos, interactions, love notes, scripture sessions, mood sync) |
| Type system | TypeScript strict mode, `StateCreator` generics |

---
