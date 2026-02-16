# 11. Service Worker and Background Sync

**Sources:**
- `src/sw.ts` (custom service worker with Workbox)
- `src/sw-db.ts` (IndexedDB helpers for service worker context)

## Overview

The service worker uses the Workbox InjectManifest strategy (not GenerateSW). It handles:
1. Precaching of static assets
2. Runtime caching with appropriate strategies per resource type
3. Background Sync API for syncing pending moods when the app is closed

## Cache Strategies (src/sw.ts)

### Precaching

```typescript
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
```

The `__WB_MANIFEST` array is injected by VitePWA at build time. It includes `index.html` for version detection (triggers SW updates when JS hashes change).

### Runtime Routes

| Resource | Strategy | Cache Name | Notes |
|----------|----------|------------|-------|
| JS (`script`) | `NetworkOnly` | -- | Always fetch fresh to prevent stale code after deployments |
| CSS (`style`) | `NetworkOnly` | -- | Same rationale as JS |
| Navigation | `NetworkFirst` | `navigation-cache` | 3-second network timeout, falls back to precached `index.html` |
| Images, Fonts | `CacheFirst` | `static-assets-v2` | Max 100 entries, 30-day expiry |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | Max 30 entries, 1-year expiry, accepts opaque responses (`status: 0`) |

### Why NetworkOnly for JS/CSS

After deployments, JS/CSS filenames change (Vite content hashing). Serving stale bundles from cache would cause import errors or runtime crashes. The precache manifest handles offline support for these assets.

## Background Sync (src/sw.ts)

### Trigger

The service worker listens for `sync` events with the tag `sync-pending-moods`. This fires when:
1. The browser regains connectivity after being offline
2. The app explicitly calls `registration.sync.register('sync-pending-moods')`

### syncPendingMoods() Flow

```
1. getPendingMoods()         -- Read unsynced moods from IndexedDB
2. getAuthToken()            -- Read stored JWT from IndexedDB sw-auth store
3. Check token expiry        -- Skip if expired (5-minute buffer)
4. For each pending mood:
   a. transformMoodForSupabase()  -- Convert local format to REST API format
   b. fetch(SUPABASE_URL/rest/v1/moods, { method: 'POST', ... })
   c. markMoodSynced(localId, supabaseId)
5. Notify open clients       -- postMessage({ type: 'BACKGROUND_SYNC_COMPLETED', ... })
6. If all failed, throw       -- Triggers automatic retry via Background Sync API
```

### Mood Transformation

```typescript
function transformMoodForSupabase(mood: StoredMoodEntry, userId: string): Record<string, unknown>
```

Maps local mood format to Supabase REST API format:
- `mood_type`: The primary mood (`mood.mood`)
- `mood_types`: Array of all selected moods (`mood.moods` or `[mood.mood]` for legacy)
- `note`: The mood note (or `null`)
- `created_at`: ISO timestamp from `mood.timestamp`
- `user_id`: From the stored auth token

### REST API Authentication

The service worker calls the Supabase REST API directly with `fetch()` (not the JS client):

```typescript
fetch(`${SUPABASE_URL}/rest/v1/moods`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken.accessToken}`,
    'Prefer': 'return=representation',
  },
  body: JSON.stringify(supabaseMood),
});
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) are baked in at build time via `import.meta.env`.

### Error Handling

- **No auth token:** Returns early without throwing (will retry on next sync)
- **Expired token:** Returns early (app will refresh token on next open)
- **Individual mood failure:** Logs error, increments `failCount`, continues with next mood
- **All moods failed:** Throws error to trigger automatic retry via Background Sync API
- **Partial success:** Does not throw (successful moods stay synced, failed ones retry next time)

### Client Notification

After sync completes, the service worker notifies all open windows:

```typescript
client.postMessage({
  type: 'BACKGROUND_SYNC_COMPLETED',
  successCount,
  failCount,
});
```

## Service Worker Database Helpers (src/sw-db.ts)

IndexedDB operations for use in the service worker context. The service worker cannot share the app's IndexedDB connection, so it opens its own connection using the same `DB_NAME` and `DB_VERSION`.

### openDatabase()

Opens `my-love-db` at `DB_VERSION` (currently 5). Includes its own migration logic for v1-v4 (matching the app's migrations but with `objectStoreNames.contains()` guards to handle stores that may already exist). Note: v5 scripture stores are not created here since the service worker only needs moods and auth.

### Functions

#### `getPendingMoods(): Promise<StoredMoodEntry[]>`

Reads all moods from the `moods` store, filters to `synced === false`. Opens and closes the database connection per call.

#### `markMoodSynced(localId: number, supabaseId: string): Promise<void>`

Gets the mood by `localId`, sets `synced: true` and `supabaseId`, then puts it back. Throws if the mood is not found.

#### `storeAuthToken(token: Omit<StoredAuthToken, 'id'>): Promise<void>`

Stores (or overwrites) the auth token with key `'current'` in the `sw-auth` store.

**Stored fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `'current'` | Fixed key for single-token storage |
| `accessToken` | `string` | JWT for API authorization |
| `refreshToken` | `string` | For token refresh |
| `expiresAt` | `number` | Unix timestamp of token expiry |
| `userId` | `string` | User UUID for REST API requests |

#### `getAuthToken(): Promise<StoredAuthToken | null>`

Reads the token with key `'current'`. Returns `null` if not found.

#### `clearAuthToken(): Promise<void>`

Deletes the token with key `'current'`. Called on sign-out.

### Connection Lifecycle

Each function opens a connection, performs the operation, and closes the connection in a `finally` block. This is necessary because service workers have short lifetimes and cannot maintain persistent connections.

## Other Service Worker Events

### `message` Event

Handles `SKIP_WAITING` messages to activate a new service worker immediately.

### `activate` Event

Calls `self.clients.claim()` to take control of all open clients immediately after activation.

## Hybrid Sync Strategy Summary

The app uses three complementary sync triggers:

| Trigger | Location | When |
|---------|----------|------|
| Immediate sync | App (moodSyncService) | On mood creation |
| Periodic sync | App (App.tsx) | While app is open |
| Background Sync | Service worker (sw.ts) | When app is closed, then device comes online |
