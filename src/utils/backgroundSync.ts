/**
 * Background Sync Utility
 *
 * Handles registration of Background Sync API tags and
 * communication with the service worker for offline mood syncing.
 *
 * Part of Hybrid Sync Solution (Part 2).
 */

/**
 * Register a background sync tag
 *
 * This tells the browser to sync pending data when:
 * 1. Connection is restored after being offline
 * 2. App is in background but has connectivity
 *
 * @param tag - Sync tag identifier (e.g., 'sync-pending-moods')
 * @returns Promise that resolves when sync is registered
 *
 * @example
 * ```typescript
 * // Register sync when mood is saved offline
 * await registerBackgroundSync('sync-pending-moods');
 * ```
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  // Check if Background Sync API is supported
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    if (import.meta.env.DEV) {
      console.log('[BackgroundSync] Background Sync API not supported');
    }
    return;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Register the sync tag
    await registration.sync.register(tag);

    if (import.meta.env.DEV) {
      console.log(`[BackgroundSync] Registered sync tag: ${tag}`);
    }
  } catch (error) {
    console.error('[BackgroundSync] Failed to register sync:', error);
  }
}

/**
 * Setup service worker message listener
 *
 * Listens for messages from the service worker and triggers
 * appropriate actions (e.g., sync pending moods).
 *
 * @param onSyncRequest - Callback when service worker requests sync
 * @returns Cleanup function to remove listener
 *
 * @example
 * ```typescript
 * const cleanup = setupServiceWorkerListener(async () => {
 *   await syncPendingMoods();
 * });
 *
 * // Later, cleanup on unmount
 * cleanup();
 * ```
 */
export function setupServiceWorkerListener(
  onSyncRequest: () => Promise<void>
): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'BACKGROUND_SYNC_REQUEST') {
      if (import.meta.env.DEV) {
        console.log('[BackgroundSync] Received sync request from service worker');
      }

      // Trigger sync
      onSyncRequest().catch((error) => {
        console.error('[BackgroundSync] Sync request failed:', error);
      });
    }
  };

  // Add listener
  navigator.serviceWorker.addEventListener('message', handleMessage);

  // Return cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}

/**
 * Check if Background Sync API is supported
 *
 * @returns true if supported, false otherwise
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}
