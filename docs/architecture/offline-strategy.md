# Offline Strategy

The app implements a hybrid sync solution with three complementary mechanisms:

## 1. Service Worker (sw.ts)

Uses Workbox with an `injectManifest` strategy for full control over caching behavior:

| Request Type | Strategy | Cache Name | Details |
|---|---|---|---|
| JS/CSS | `NetworkOnly` | - | Always fetch fresh code after deployments |
| Navigation (HTML) | `NetworkFirst` | `navigation-cache` | 3s timeout, falls back to precached version |
| Images/Fonts | `CacheFirst` | `static-assets-v2` | 30-day expiration, 100 entry limit |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | 1-year expiration, 30 entry limit |
| Static assets | Precache | Workbox default | `*.{png,jpg,jpeg,svg,woff2,ico}` only |

**Background Sync API:**
- Tag: `sync-pending-moods`
- Triggers when browser regains connectivity (even if app is closed)
- Opens IndexedDB directly (no window context needed)
- Reads pending moods, reads stored auth token, calls Supabase REST API via `fetch`
- Marks moods as synced on success
- Notifies open clients via `postMessage` with success/fail counts

## 2. IndexedDB Persistence

All data services extend `BaseIndexedDBService<T>` which provides:
- Automatic init guard (prevents concurrent initialization)
- Generic CRUD: `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`
- Cursor-based pagination: `getPage(offset, limit)` for efficient large-dataset access
- Error handling strategy: reads return `null`/`[]` on failure (graceful degradation), writes throw (data integrity)
- Quota monitoring with warnings at 80% and errors at 95%

## 3. App-Level Sync (App.tsx)

Three sync mechanisms run in the main thread:

| Mechanism | Trigger | Frequency |
|---|---|---|
| Immediate sync | `online` event fires | On each reconnection |
| Periodic sync | `setInterval` | Every 5 minutes while app is open |
| Mount sync | App component mounts | Once on app load (if online + authenticated) |

## Conflict Resolution

Last-write-wins with server-side timestamps. The `synced` boolean and `supabaseId` fields on `MoodEntry` track local vs. remote state. When a mood is synced, the local record is updated with the Supabase-generated UUID.

## Optimistic UI

UI updates are applied immediately to local state (Zustand + IndexedDB). Sync to Supabase happens asynchronously in the background. If sync fails, the data remains in the local pending queue and will retry.

---
