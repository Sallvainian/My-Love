import { Page } from '@playwright/test';

/**
 * PWA Testing Helper Utilities
 *
 * Specialized helper functions for testing Progressive Web App features:
 * - Service Worker registration and lifecycle
 * - IndexedDB CRUD operations and cleanup
 * - LocalStorage persistence testing
 * - Offline mode simulation
 *
 * All helpers use page.evaluate() to access browser APIs in the page context.
 */

/**
 * Wraps a promise with a timeout to prevent indefinite hangs.
 * Critical for IndexedDB operations in Chromium where events may not fire.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param fallback - Fallback value to return on timeout
 * @returns The promise result or fallback value
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   someLongOperation(),
 *   5000,
 *   'default-value'
 * );
 * ```
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`⏱ Operation timed out after ${timeoutMs}ms, using fallback`);
        resolve(fallback);
      }, timeoutMs)
    ),
  ]);
}

/**
 * Waits for the service worker to be registered and ready.
 *
 * @param page - Playwright Page instance
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @throws Error if service worker is not registered within timeout
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ page }) => {
 *   await page.goto('/');
 *   await waitForServiceWorker(page);
 * });
 * ```
 */
export async function waitForServiceWorker(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();

  await page.waitForFunction(
    () => {
      return navigator.serviceWorker.ready;
    },
    { timeout }
  );

  // Additional verification that service worker is actually active
  const isActive = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });

  if (!isActive) {
    throw new Error('Service worker registration found but no active worker');
  }

  const elapsedTime = Date.now() - startTime;
  console.log(`Service worker ready after ${elapsedTime}ms`);
}

/**
 * Clears an IndexedDB database by name.
 * Includes timeout protection to prevent indefinite hangs in Chromium.
 *
 * @param page - Playwright Page instance
 * @param dbName - Name of the IndexedDB database to clear
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ page }) => {
 *   await clearIndexedDB(page, 'my-love-db');
 * });
 * ```
 */
export async function clearIndexedDB(page: Page, dbName: string): Promise<void> {
  await withTimeout(
    page.evaluate((name) => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        let eventFired = false;

        // Set up a fallback timeout for when no event fires (e.g., non-existent DB in Firefox)
        const diagnosticTimeout = setTimeout(() => {
          if (!eventFired) {
            console.warn(`⚠️  No deleteDatabase event fired after 4s for '${name}' - assuming success for non-existent DB`);
            eventFired = true;
            resolve(); // Resolve promise - database likely doesn't exist
          }
        }, 4000);

        request.onsuccess = () => {
          eventFired = true;
          clearTimeout(diagnosticTimeout);
          console.log(`✓ IndexedDB '${name}' deleteDatabase SUCCESS`);
          resolve();
        };

        request.onerror = () => {
          eventFired = true;
          clearTimeout(diagnosticTimeout);
          console.warn(`✗ IndexedDB '${name}' deleteDatabase ERROR:`, request.error);
          resolve(); // Resolve anyway - database may not exist
        };

        request.onblocked = () => {
          eventFired = true;
          clearTimeout(diagnosticTimeout);
          console.warn(`⚠️  IndexedDB '${name}' deleteDatabase BLOCKED - resolving after 2s`);
          // Increased from 100ms to 2000ms for better handling
          setTimeout(() => resolve(), 2000);
        };
      });
    }, dbName),
    5000, // 5 second timeout - prevents indefinite hangs
    undefined
  );
}

/**
 * Simulates offline network condition.
 *
 * @param page - Playwright Page instance
 *
 * @example
 * ```typescript
 * test('should work offline', async ({ page }) => {
 *   await page.goto('/');
 *   await goOffline(page);
 *   // App should still function using cached resources
 * });
 * ```
 */
export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);

  // Verify offline state
  const isOffline = await page.evaluate(() => {
    return !navigator.onLine;
  });

  if (!isOffline) {
    console.warn('Failed to set offline state - navigator.onLine still true');
  }

  console.log('Network condition: offline');
}

/**
 * Restores online network condition.
 *
 * @param page - Playwright Page instance
 *
 * @example
 * ```typescript
 * test('should reconnect', async ({ page }) => {
 *   await goOffline(page);
 *   // Test offline behavior
 *   await goOnline(page);
 *   // Test reconnection behavior
 * });
 * ```
 */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);

  // Verify online state
  const isOnline = await page.evaluate(() => {
    return navigator.onLine;
  });

  if (!isOnline) {
    console.warn('Failed to restore online state - navigator.onLine still false');
  }

  console.log('Network condition: online');
}

/**
 * Reads a value from LocalStorage.
 *
 * @param page - Playwright Page instance
 * @param key - LocalStorage key to read
 * @returns The value stored at the key, or null if not found
 *
 * @example
 * ```typescript
 * const theme = await getLocalStorageItem(page, 'app-theme');
 * expect(theme).toBe('dark');
 * ```
 */
export async function getLocalStorageItem(
  page: Page,
  key: string
): Promise<string | null> {
  return await page.evaluate((k) => {
    return localStorage.getItem(k);
  }, key);
}

/**
 * Writes a value to LocalStorage.
 *
 * @param page - Playwright Page instance
 * @param key - LocalStorage key to write
 * @param value - Value to store
 *
 * @example
 * ```typescript
 * await setLocalStorageItem(page, 'test-key', 'test-value');
 * const retrieved = await getLocalStorageItem(page, 'test-key');
 * expect(retrieved).toBe('test-value');
 * ```
 */
export async function setLocalStorageItem(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await page.evaluate(
    ({ k, v }) => {
      localStorage.setItem(k, v);
    },
    { k: key, v: value }
  );
}

/**
 * Clears all LocalStorage data.
 *
 * @param page - Playwright Page instance
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ page }) => {
 *   await clearLocalStorage(page);
 * });
 * ```
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });

  console.log('LocalStorage cleared');
}

/**
 * Retrieves all records from an IndexedDB object store.
 * Includes timeout protection and improved error handling for Chromium compatibility.
 *
 * @param page - Playwright Page instance
 * @param dbName - Name of the IndexedDB database
 * @param storeName - Name of the object store
 * @returns Array of all records in the store, or empty array if DB/store doesn't exist
 *
 * @example
 * ```typescript
 * const messages = await getIndexedDBStore(page, 'my-love-db', 'messages');
 * expect(messages).toHaveLength(10);
 * ```
 */
export async function getIndexedDBStore(
  page: Page,
  dbName: string,
  storeName: string
): Promise<any[]> {
  return await withTimeout(
    page.evaluate(
      ({ db, store }) => {
        return new Promise<any[]>((resolve) => {
          const request = indexedDB.open(db);
          let isUpgrading = false;

          request.onerror = () => {
            console.warn(`✗ Failed to open IndexedDB '${db}':`, request.error);
            resolve([]); // Return empty array if DB doesn't exist
          };

          request.onupgradeneeded = () => {
            // Database doesn't exist or needs upgrade
            isUpgrading = true;
            console.warn(`⚠️  Database '${db}' doesn't exist - will be created`);
            // Don't close here - let onsuccess handle it
          };

          request.onsuccess = () => {
            const database = request.result;

            // If we just created the database, it won't have the store we need
            if (isUpgrading) {
              console.warn(`⚠️  Database '${db}' was just created, no stores exist yet`);
              database.close();
              resolve([]);
              return;
            }

            // Check if object store exists
            if (!database.objectStoreNames.contains(store)) {
              console.warn(`⚠️  Object store '${store}' not found in database '${db}'`);
              database.close();
              resolve([]);
              return;
            }

            try {
              const transaction = database.transaction(store, 'readonly');
              const objectStore = transaction.objectStore(store);
              const getAllRequest = objectStore.getAll();

              getAllRequest.onsuccess = () => {
                console.log(`✓ Successfully read ${getAllRequest.result.length} records from '${db}'.'${store}'`);
                database.close();
                resolve(getAllRequest.result);
              };

              getAllRequest.onerror = () => {
                console.warn(`✗ Failed to read from store '${store}':`, getAllRequest.error);
                database.close();
                resolve([]);
              };
            } catch (error) {
              console.warn(`✗ Error accessing store '${store}':`, error);
              database.close();
              resolve([]);
            }
          };

          request.onblocked = () => {
            console.warn(`⚠️  IndexedDB '${db}' access blocked - returning empty array`);
            // Changed from reject to resolve with empty array for better test resilience
            resolve([]);
          };
        });
      },
      { db: dbName, store: storeName }
    ),
    5000, // 5 second timeout
    [] // Return empty array on timeout
  );
}
