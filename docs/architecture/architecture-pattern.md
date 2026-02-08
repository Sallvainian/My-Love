# Architecture Pattern

**Component-based SPA with Offline-First Dual-Persistence Data Layer**

The application follows a five-layer architecture where data flows downward through well-defined boundaries:

```
+-------------------------------------------------------------+
|  VIEW LAYER          React Components (24 feature folders)   |
|                      Lazy-loaded routes via React.lazy       |
+-------------------------------------------------------------+
        |  props / hooks                    ^ callbacks / events
        v                                   |
+-------------------------------------------------------------+
|  STATE LAYER         Zustand Store (10 slices)               |
|                      persist middleware -> localStorage       |
|                      Custom hooks for derived state           |
+-------------------------------------------------------------+
        |  action calls                     ^ state updates
        v                                   |
+-------------------------------------------------------------+
|  SERVICE LAYER       Domain services (14 service files)      |
|                      BaseIndexedDBService (abstract CRUD)    |
|                      Zod validation at boundaries            |
+-------------------------------------------------------------+
        |  typed API calls                  ^ validated responses
        v                                   |
+-------------------------------------------------------------+
|  API LAYER           Supabase client (7 API files)           |
|                      Typed queries via database.types.ts     |
|                      Realtime subscriptions                  |
+-------------------------------------------------------------+
        |  HTTP / WebSocket                 ^ JSON responses
        v                                   |
+-------------------------------------------------------------+
|  STORAGE LAYER       Supabase (remote PostgreSQL + RLS)      |
|                      IndexedDB (local, 8 object stores)      |
|                      localStorage (Zustand hydration only)   |
+-------------------------------------------------------------+
        |  Background Sync                  ^ sync events
        v                                   |
+-------------------------------------------------------------+
|  BACKGROUND LAYER    Service Worker (sw.ts)                  |
|                      Workbox strategies (precache + runtime) |
|                      Background Sync API for offline writes  |
+-------------------------------------------------------------+
```

## Key Architectural Decisions

1. **No client-side router.** Navigation is managed by a Zustand `navigationSlice` that updates `currentView` state and manipulates `history.pushState` manually. This avoids a router dependency and keeps offline navigation simple.

2. **Dual persistence.** Small, critical state (settings, message history, mood list) persists to localStorage via Zustand's `persist` middleware for fast hydration. Large or binary data (photos, custom messages, scripture sessions) persists to IndexedDB via typed service classes.

3. **Singleton services.** Each IndexedDB-backed service extends `BaseIndexedDBService<T>` and is exported as a module-level singleton. This ensures a single database connection per store and prevents concurrent initialization.

4. **Typed Supabase client.** The `database.types.ts` file is auto-generated from Supabase schema introspection, providing compile-time type safety for all database queries.

---
