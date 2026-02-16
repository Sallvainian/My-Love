# Service Worker Architecture

## Overview

The app uses a custom **InjectManifest** strategy via `vite-plugin-pwa`. The service worker source is `src/sw.ts`, compiled separately from the main app bundle. It handles precaching, cache strategies, and background sync.

## Service Worker (`src/sw.ts`)

### Precaching

Static assets are precached using Workbox's `precacheAndRoute`:

```typescript
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
```

The `__WB_MANIFEST` array is injected at build time by Vite's PWA plugin. It includes image and font assets. JavaScript and CSS files are **not** precached -- they use NetworkFirst instead.

### Cache Strategies

| Resource Type | Strategy | Rationale |
|--------------|----------|-----------|
| JS/CSS bundles | NetworkOnly | Always serve latest code; hashed filenames handle cache busting |
| Navigation (HTML) | NetworkFirst | Show latest content, fall back to cache for offline |
| Images/Fonts | CacheFirst | Static assets rarely change; fast cached response |
| API calls | NetworkFirst | Fresh data preferred, cached fallback |

### Background Sync

The service worker listens for the `sync` event to process pending mood entries:

```typescript
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-pending-moods') {
    event.waitUntil(syncPendingMoods());
  }
});
```

The `syncPendingMoods()` function in the service worker:
1. Opens the `my-love-db` IndexedDB database directly (not through the app's service layer)
2. Reads all entries from the `moods` store where `synced === false`
3. Retrieves the auth token from the `sw-auth` store
4. For each unsynced mood, sends a REST API call to Supabase
5. On success, marks the mood as `synced: true` and stores the `supabaseId`
6. Sends a `BACKGROUND_SYNC_COMPLETED` message to all clients with success/fail counts

### Client Communication

After background sync completes, the service worker notifies all open tabs:

```typescript
const clients = await self.clients.matchAll();
clients.forEach(client => {
  client.postMessage({
    type: 'BACKGROUND_SYNC_COMPLETED',
    successCount,
    failCount,
  });
});
```

The main app listens for this message via `setupServiceWorkerListener()` in `src/utils/backgroundSync.ts`, which triggers a state refresh.

## Service Worker Database (`src/sw-db.ts`)

The service worker has its own database access layer because it cannot share the app's service layer (different execution context):

| Function | Purpose |
|----------|---------|
| `openMyLoveDB()` | Opens IndexedDB with migration support matching the app's schema |
| `getPendingMoods()` | Reads moods with `synced === false` |
| `markMoodSynced(id, supabaseId)` | Updates mood entry after successful sync |
| `storeAuthToken(token)` | Stores JWT for Supabase REST API calls |
| `getAuthToken()` | Retrieves stored JWT |
| `clearAuthToken()` | Removes JWT on sign-out |

## Type Definitions (`src/sw-types.d.ts`)

Custom type definitions extend `ServiceWorkerGlobalScope` with:

- `SyncEvent` interface with `tag` and `lastChance` properties
- `ExtendableEvent` and `ExtendableMessageEvent` interfaces
- `SyncManager` interface for `registration.sync.register(tag)`
- Workbox precaching module declarations
- Global `__WB_MANIFEST` declaration

## Registration (`src/main.tsx`)

Service worker registration is conditional:

```typescript
// Production: register with auto-reload on update
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const wb = new Workbox('/My-Love/sw.js');
  wb.addEventListener('waiting', () => {
    wb.messageSkipWaiting();  // Auto-activate new SW
    window.location.reload();  // Reload to use new version
  });
  wb.register();
}

// Development: unregister any stale service workers
if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then(regs =>
    regs.forEach(reg => reg.unregister())
  );
}
```

## Background Sync Registration

The `registerBackgroundSync()` function in `src/utils/backgroundSync.ts` registers sync tags from the main app:

```typescript
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register(tag);
}
```

Feature detection ensures graceful degradation on browsers that do not support the Background Sync API.

## Related Documentation

- [Offline Strategy](./12-offline-strategy.md)
- [Architecture Patterns](./03-architecture-patterns.md)
