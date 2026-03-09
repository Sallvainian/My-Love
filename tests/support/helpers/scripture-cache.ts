/**
 * Scripture Cache Helpers
 *
 * Shared helpers for clearing client-side scripture caches in E2E tests.
 */
import type { Page } from '@playwright/test';

/**
 * Clear all client-side scripture caches (localStorage + IndexedDB).
 *
 * Removes Zustand persisted state from localStorage and deletes all
 * IndexedDB databases that could hold stale session data. Call this
 * before re-navigating to /scripture when a test needs the client to
 * re-read server state (e.g., after DB-level session manipulation).
 */
export async function clearClientScriptureCache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.removeItem('my-love-storage');

    const factory = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };

    const dbNames = new Set<string>(['my-love-db']);
    if (typeof factory.databases === 'function') {
      const databases = await factory.databases();
      for (const db of databases) {
        if (db.name) dbNames.add(db.name);
      }
    }

    await Promise.all(
      [...dbNames].map(
        (dbName) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          })
      )
    );
  });
}
