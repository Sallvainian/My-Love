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
 * Listens for messages from the service worker:
 * - BACKGROUND_SYNC_COMPLETED: SW finished syncing, refresh local state
 *
 * @param onSyncCompleted - Callback when service worker completed background sync
 * @returns Cleanup function to remove listener
 *
 * @example
 * ```typescript
 * const cleanup = setupServiceWorkerListener(async () => {
 *   await updateSyncStatus(); // Refresh state after SW sync
 * });
 *
 * // Later, cleanup on unmount
 * cleanup();
 * ```
 */
export function setupServiceWorkerListener(
  onSyncCompleted: () => Promise<void>
): () => void {
  // Guard: Check if service workers are supported (defense-in-depth)
  if (!isServiceWorkerSupported()) {
    if (import.meta.env.DEV) {
      console.log('[BackgroundSync] Service Worker not supported, skipping listener setup');
    }
    // Return noop cleanup function
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    // Handle sync completion notification from SW
    if (event.data?.type === 'BACKGROUND_SYNC_COMPLETED') {
      if (import.meta.env.DEV) {
        console.log('[BackgroundSync] Service Worker completed background sync:', {
          successCount: event.data.successCount,
          failCount: event.data.failCount,
        });
      }

      // Refresh local state after SW sync
      onSyncCompleted().catch((error) => {
        console.error('[BackgroundSync] Failed to refresh after sync:', error);
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
 * Check if Service Worker API is supported
 *
 * Used for basic service worker functionality like message listening.
 * More permissive than isBackgroundSyncSupported().
 *
 * @returns true if supported, false otherwise
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Check if Background Sync API is supported
 *
 * Used for registering background sync tags (requires both SW and SyncManager).
 * More restrictive than isServiceWorkerSupported().
 *
 * @returns true if supported, false otherwise
 */
export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}
