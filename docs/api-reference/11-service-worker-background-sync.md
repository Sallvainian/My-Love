# 11. Service Worker and Background Sync

**Sources:**

- `src/sw.ts` -- Service worker with Workbox caching + Background Sync
- `src/sw-db.ts` -- IndexedDB helpers for service worker context

## Overview

The service worker extends Workbox-generated precaching with custom Background Sync support for offline mood syncing. It operates independently of the app window, syncing pending moods even when the app is closed.

## Caching Strategies

| Content           | Strategy       | Cache Name         | Details                                                           |
| ----------------- | -------------- | ------------------ | ----------------------------------------------------------------- |
| JS/CSS            | `NetworkOnly`  | None               | Always fresh from network (prevents stale code after deployments) |
| Navigation (HTML) | `NetworkFirst` | `navigation-cache` | 3s network timeout, falls back to precached version offline       |
| Images/Fonts      | `CacheFirst`   | `static-assets-v2` | 30-day expiry, max 100 entries                                    |
| Google Fonts      | `CacheFirst`   | `google-fonts-v2`  | 1-year expiry, max 30 entries, cacheable status 0/200             |

## Auto-Update Configuration

```typescript
self.skipWaiting();
clientsClaim();
```

New service worker versions activate immediately and claim all clients. Required by `vite-plugin-pwa` with `injectManifest` + `registerType: 'autoUpdate'`.

## Precaching

```typescript
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
```

`self.__WB_MANIFEST` is injected by VitePWA at build time with hashed static assets. `index.html` is included for version detection (triggers SW updates when JS hashes change).

## Background Sync

### Sync Event Handler

Listens for the `sync` event with tag `sync-pending-moods`.

**Trigger conditions:**

1. Browser regains connectivity after being offline
2. Manually triggered via `registration.sync.register('sync-pending-moods')` from the app

### `syncPendingMoods()` Flow

1. **Get pending moods:** Calls `getPendingMoods()` from `sw-db.ts` to read unsynced entries from IndexedDB
2. **Get auth token:** Calls `getAuthToken()` from `sw-db.ts` to read the stored JWT
3. **Token validation:** Checks if token is expired (with 5-minute buffer). If expired, returns silently (app will refresh token on next open)
4. **Sync each mood:** For each pending mood:
   - Transforms to Supabase REST format via `transformMoodForSupabase()`
   - Calls `POST {SUPABASE_URL}/rest/v1/moods` with headers:
     - `Content-Type: application/json`
     - `apikey: {SUPABASE_ANON_KEY}`
     - `Authorization: Bearer {accessToken}`
     - `Prefer: return=representation`
   - On success: calls `markMoodSynced(localId, supabaseId)`
   - On failure: logs error, continues to next mood
5. **Notify clients:** Posts `BACKGROUND_SYNC_COMPLETED` message to all open windows with `successCount` and `failCount`
6. **Retry trigger:** If all moods failed, throws to trigger Background Sync API retry

### `transformMoodForSupabase(mood, userId)`

Maps local mood format to Supabase REST API format:

| Local Field                      | Supabase Field |
| -------------------------------- | -------------- |
| `mood.mood`                      | `mood_type`    |
| `mood.moods` or `[mood.mood]`    | `mood_types`   |
| `mood.note` or `null`            | `note`         |
| `mood.timestamp` (as ISO string) | `created_at`   |
| `userId` (from auth token)       | `user_id`      |

## Service Worker Database Helpers (`src/sw-db.ts`)

These functions operate directly on IndexedDB without the app's service layer, enabling Background Sync when the app is closed.

### `openDatabase(): Promise<IDBPDatabase>`

Opens `my-love-db` with full v1-v4 migration support. The SW must handle upgrades independently since it may open the database before the app does.

### `getPendingMoods(): Promise<StoredMoodEntry[]>`

Reads all moods from the `moods` store and filters to `synced === false`. Closes the database connection after reading.

### `markMoodSynced(localId: number, supabaseId: string): Promise<void>`

Sets `synced = true` and `supabaseId` on the mood entry. Closes the database connection after writing.

### `storeAuthToken(token): Promise<void>`

Stores auth credentials in the `sw-auth` store with key `'current'`. Called from `actionService.signIn()` and `sessionService.onAuthStateChange()`.

```typescript
interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
}
```

### `getAuthToken(): Promise<StoredAuthToken | null>`

Reads the stored auth token. Called from the sync handler to authenticate REST API calls.

### `clearAuthToken(): Promise<void>`

Deletes the auth token from IndexedDB. Called on sign-out.

## Environment Variables (Build-time)

The service worker accesses these via `import.meta.env` (injected at build time by Vite):

- `VITE_SUPABASE_URL` -- Used for REST API calls
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` -- Used as `apikey` header
