# Offline Strategy

## Architecture: Online-First with Hybrid Sync

The app follows an **online-first** architecture where most operations require network connectivity. Offline support is provided through cached data display and a 3-layer sync system for mood entries. Writes to Supabase fail immediately when offline, with retry prompts shown to the user.

## Three-Layer Mood Sync

### Layer 1: Immediate Sync (`moodSlice`)

On mood creation, if online, sync to Supabase immediately:

```typescript
// In moodSlice.addMoodEntry
const userId = await getCurrentUserIdOfflineSafe();
if (navigator.onLine && userId) {
  await uploadMood(entry, userId);
}
```

Uses `getCurrentUserIdOfflineSafe()` which reads from the cached session (no network call needed).

### Layer 2: Periodic Sync (`App.tsx`)

Every 5 minutes while the app is open, sync any pending moods:

```typescript
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const syncInterval = setInterval(() => {
  if (syncStatus.isOnline && session) {
    syncPendingMoods().catch(console.error);
  }
}, SYNC_INTERVAL_MS);
```

Also triggers immediately on app mount and on network reconnection:

```typescript
const handleOnline = () => {
  updateSyncStatus();
  syncPendingMoods().catch(console.error);
};
window.addEventListener('online', handleOnline);
```

### Layer 3: Background Sync (`sw.ts`)

The Service Worker syncs pending moods when the browser regains connectivity, even when the app is completely closed:

```typescript
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-pending-moods') {
    event.waitUntil(syncPendingMoods());
  }
}) as EventListener);
```

The SW implementation:
1. Opens IndexedDB directly (no window context)
2. Reads pending moods from the `moods` store
3. Reads the auth token from the `sw-auth` store
4. Validates token expiry (with 5-minute buffer)
5. Calls Supabase REST API via `fetch()` (not the JS client)
6. Marks each mood as synced in IndexedDB
7. Notifies open clients via `postMessage`

```typescript
const response = await fetch(`${SUPABASE_URL}/rest/v1/moods`, {
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

If all moods fail to sync, the function throws to trigger the Background Sync API's built-in retry mechanism.

## Service Worker Caching Strategies

Defined in `src/sw.ts` using Workbox:

| Resource | Strategy | Cache Name | TTL |
|---|---|---|---|
| JS/CSS bundles | `NetworkOnly` | -- | Always fresh |
| Navigation (HTML) | `NetworkFirst` | `navigation-cache` | 3s timeout, then cache |
| Images/Fonts | `CacheFirst` | `static-assets-v2` | 30 days, 100 entries |
| Google Fonts | `CacheFirst` | `google-fonts-v2` | 1 year, 30 entries |
| Static assets | Precache | Workbox manifest | Build-time revision |

### Precache Configuration

Only static assets are precached (no JS/CSS/HTML):

```typescript
// vite.config.ts
injectManifest: {
  globPatterns: ['**/*.{png,jpg,jpeg,svg,woff2,ico}'],
  globIgnores: ['**/*.js', '**/*.css', '**/*.html'],
  additionalManifestEntries: [
    { url: 'index.html', revision: Date.now().toString() },
  ],
},
```

This ensures `registerRoute(NetworkOnly)` in `sw.ts` actually runs for code files, preventing stale JavaScript from being served after deployments.

## Offline Error Handling (`src/utils/offlineErrorHandler.ts`)

### `OfflineError` Class

Custom error class for offline operation failures:

```typescript
export class OfflineError extends Error {
  readonly name = 'OfflineError';
  readonly isRetryable = true;
  readonly operation: string;

  constructor(operation: string, message?: string) {
    super(message || "You're offline. Please check your connection and try again.");
    this.operation = operation;
  }
}
```

### Guard Functions

```typescript
// Throws OfflineError if offline before executing
export async function withOfflineCheck<T>(operation: string, asyncFn: () => Promise<T>): Promise<T> {
  if (isOffline()) {
    throw new OfflineError(operation);
  }
  return asyncFn();
}

// Returns result object instead of throwing (for UI components)
export async function safeOfflineOperation<T>(operation: string, asyncFn: () => Promise<T>):
  Promise<{ success: true; data: T } | { success: false; offline: true; retry: () => Promise<T> } | { success: false; error: Error }> {
  if (isOffline()) {
    return { success: false, offline: true, message: OFFLINE_RETRY_MESSAGE, retry: asyncFn };
  }
  // ...execute and return result
}
```

## Network Status Detection (`src/hooks/useNetworkStatus.ts`)

The `useNetworkStatus` hook provides three states:

| State | Meaning |
|---|---|
| `online` | Connected and confirmed |
| `offline` | No network connection |
| `connecting` | Transitioning (1500ms debounce) |

The debounce prevents UI flicker during brief connectivity changes.

## UI Components

### `NetworkStatusIndicator`

Displays a banner when offline or connecting:

```typescript
<NetworkStatusIndicator showOnlyWhenOffline />
```

Shows at the top of the viewport, outside the main content area.

### `SyncToast`

Shows feedback after Background Sync completes:

```typescript
<SyncToast syncResult={syncResult} onDismiss={() => setSyncResult(null)} />
```

Displays success/failure counts from the Service Worker's `BACKGROUND_SYNC_COMPLETED` message.

## IndexedDB for Offline Data

### Auth Token Storage (`sw-db.ts`)

```typescript
export async function storeAuthToken(token: AuthTokenData): Promise<void>;
export async function getAuthToken(): Promise<AuthTokenData | null>;
export async function clearAuthToken(): Promise<void>;
```

Stored in the `sw-auth` store (key: `'current'`) for Service Worker access.

### Pending Moods

```typescript
export async function getPendingMoods(): Promise<StoredMoodEntry[]>;
export async function markMoodSynced(localId: number, supabaseId: string): Promise<void>;
```

Mood entries with `synced: false` are picked up by the 3-layer sync system.

## What Works Offline

| Feature | Offline Support | Notes |
|---|---|---|
| Home view | Full | Inline components, no lazy loading |
| Daily message | Full | Loaded from IndexedDB on init |
| Relationship timers | Full | Computed from static config |
| Theme | Full | Persisted in localStorage |
| Mood entry | Write to IndexedDB | Syncs via 3-layer system |
| Photo gallery | View cached metadata only | Signed URLs expire |
| Love Notes | View cached messages only | Cannot send |
| Scripture reading | No | Requires Supabase RPCs |
| Partner interactions | No | Requires Supabase |
