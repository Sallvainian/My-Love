# 11. Service Worker

## Main Service Worker

**Module:** `src/sw.ts`

Custom service worker extending Workbox for PWA precaching and Background Sync.

### Caching Strategy

| Resource | Strategy | Cache Name | Expiry |
|---|---|---|---|
| Precached assets | Precache (Workbox manifest) | Workbox default | Automatic cleanup |
| JS / CSS | `NetworkOnly` | N/A | Always fresh |
| Navigation (HTML) | `NetworkFirst` (3s timeout) | `navigation-cache` | Falls back to precache |
| Images / Fonts | `CacheFirst` | `static-assets-v2` | 30 days, max 100 entries |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | 1 year, max 30 entries |

### Background Sync

**Trigger:** `sync` event with tag `sync-pending-moods`.

**Flow:**
1. Read unsynced moods from IndexedDB via `getPendingMoods()`.
2. Read auth token from IndexedDB via `getAuthToken()`.
3. Validate token expiry (5-minute buffer).
4. For each mood: call Supabase REST API directly via `fetch()` (no JS client).
5. On success: mark mood synced via `markMoodSynced()`.
6. Notify open clients via `postMessage({ type: 'BACKGROUND_SYNC_COMPLETED', successCount, failCount })`.
7. If all fail: throw to trigger Background Sync API retry.

**REST API call:**
```
POST {SUPABASE_URL}/rest/v1/moods
Headers:
  Content-Type: application/json
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {access_token}
  Prefer: return=representation
```

### Message Handler

Listens for `SKIP_WAITING` messages to activate new service worker immediately.

---

## Service Worker Database Helpers

**Module:** `src/sw-db.ts`

IndexedDB operations designed for the service worker context (no window access).

### Functions

| Function | Signature | Description |
|---|---|---|
| `getPendingMoods` | `(): Promise<StoredMoodEntry[]>` | Get all moods where `synced === false`. Opens/closes DB per call. |
| `markMoodSynced` | `(localId: number, supabaseId: string): Promise<void>` | Set `synced: true` and `supabaseId` on a mood entry. |
| `storeAuthToken` | `(token: Omit<StoredAuthToken, 'id'>): Promise<void>` | Store JWT + refresh token in `sw-auth` store for Background Sync. |
| `getAuthToken` | `(): Promise<StoredAuthToken \| null>` | Read current auth token from `sw-auth` store. |
| `clearAuthToken` | `(): Promise<void>` | Remove auth token (called on sign-out). |

**`StoredAuthToken` shape:**
```typescript
{
  id: 'current';       // Fixed key
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // Unix timestamp
  userId: string;
}
```

---
