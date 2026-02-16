# Offline Strategy

## Design Philosophy

The app uses a **hybrid offline strategy** where different features have different network requirements:

| Feature | Pattern | Offline Behavior |
|---------|---------|-----------------|
| Daily Messages | Offline-first | Fully functional offline (messages in IndexedDB) |
| Mood Tracking | Offline-first | Create/update works offline; sync when connected |
| Custom Messages | Offline-first | Full CRUD offline via IndexedDB |
| Settings/Theme | Local-only | Always works (localStorage) |
| Love Notes | Online-required | Read cached messages; send fails with retry prompt |
| Photo Gallery | Online-required | Cached photos viewable; upload requires connection |
| Scripture Reading | Online-first | Cached sessions viewable; new sessions require connection |
| Poke/Kiss | Online-required | Fails with offline error |
| Partner Data | Online-required | Shows cached partner info; refresh requires connection |

## Three-Tier Sync Architecture

### Tier 1: Immediate Sync

When a mood is created while online, `syncPendingMoods()` is called immediately after the IndexedDB write:

```typescript
// src/stores/slices/moodSlice.ts
if (navigator.onLine) {
  try {
    await get().syncPendingMoods();
  } catch (syncError) {
    console.warn('[MoodSlice] Immediate sync failed, will retry via background sync:', syncError);
  }
}
```

Failures are non-blocking -- the entry is saved locally and will sync via other tiers.

### Tier 2: Periodic Sync

`App.tsx` sets up a 5-minute interval that syncs pending moods while the app is open:

```typescript
useEffect(() => {
  const intervalId = setInterval(async () => {
    if (navigator.onLine) {
      await syncPendingMoods();
    }
  }, 5 * 60 * 1000); // 5 minutes
  return () => clearInterval(intervalId);
}, []);
```

### Tier 3: Background Sync API

When the app is closed or in the background, the service worker handles sync:

1. **Registration**: `registerBackgroundSync('sync-pending-moods')` is called when moods are saved offline
2. **Execution**: The browser triggers the SW's `sync` event when connectivity returns
3. **Processing**: The SW reads unsynced entries from IndexedDB and calls Supabase REST API directly
4. **Notification**: On completion, the SW sends `BACKGROUND_SYNC_COMPLETED` to all open tabs

```typescript
// src/utils/backgroundSync.ts
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register(tag);
}
```

Feature detection ensures graceful degradation on browsers without Background Sync API support.

## Network Status Detection

### useNetworkStatus Hook (`src/hooks/useNetworkStatus.ts`)

Provides online/offline/connecting status with a 1.5-second debounce on reconnection:

```typescript
type NetworkStatus = 'online' | 'offline' | 'connecting';
```

The debounce prevents UI flicker during brief connectivity interruptions. The hook listens to `window.addEventListener('online')` and `window.addEventListener('offline')`.

### NetworkStatusIndicator Component

`src/components/shared/NetworkStatusIndicator.tsx` displays a banner when the device is offline or reconnecting.

### SyncToast Component

`src/components/shared/SyncToast.tsx` shows a toast notification when background sync completes.

## Offline Error Handling

`src/utils/offlineErrorHandler.ts` provides utilities for features that require network:

### OfflineError Class

Custom error class with retry semantics:

```typescript
export class OfflineError extends Error {
  readonly name = 'OfflineError';
  readonly isRetryable = true;
  readonly operation: string;
}
```

### withOfflineCheck Wrapper

Checks network status before executing an async operation:

```typescript
export async function withOfflineCheck<T>(
  operation: string,
  asyncFn: () => Promise<T>
): Promise<T> {
  if (isOffline()) {
    throw new OfflineError(operation);
  }
  return asyncFn();
}
```

### safeOfflineOperation Wrapper

Returns a result object instead of throwing, suitable for UI components:

```typescript
const result = await safeOfflineOperation('save-mood', () => saveMood(data));
if (result.offline) {
  // Show offline message with retry action
} else if (result.success) {
  // Show success
}
```

## Offline-Safe Authentication

`getCurrentUserIdOfflineSafe()` retrieves the user ID from the cached Supabase session without making a network request. This enables mood tracking to work offline:

```typescript
export async function getCurrentUserIdOfflineSafe(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
```

## Related Documentation

- [Service Worker Architecture](./10-service-worker.md)
- [Architecture Patterns](./03-architecture-patterns.md)
- [Data Architecture](./04-data-architecture.md)
