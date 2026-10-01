/**
 * Read one account's saved local copy (`services/localCopy.ts`) straight from
 * the app's IndexedDB, as a spec's witness that a copy was or was not saved.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { Page } from '@playwright/test';

/**
 * The saved `value` of `kind` in the `local-copies` store, or `null` when there
 * is none to read: no signed-in account (when `owner` is left out), no
 * `my-love-db` yet, no `local-copies` store, no row, or a failed read.
 *
 * `owner` defaults to the signed-in account. The database is never opened
 * before the app has created it: opening it first would create an empty one
 * ahead of the app's own upgrade.
 */
export async function savedLocalCopy<T>(
  page: Page,
  kind: string,
  owner?: string
): Promise<T | null> {
  return page.evaluate(
    async ({ copyKind, copyOwner }) => {
      const userId = copyOwner ?? window.__APP_STORE__?.getState().userId;
      if (!userId) return null;
      if (!(await indexedDB.databases()).some(({ name }) => name === 'my-love-db')) return null;
      return new Promise<T | null>((resolve) => {
        const open = indexedDB.open('my-love-db');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('local-copies')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db
            .transaction('local-copies')
            .objectStore('local-copies')
            .get([userId, copyKind]);
          get.onsuccess = () => {
            db.close();
            resolve((get.result?.value as T | undefined) ?? null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      });
    },
    { copyKind: kind, copyOwner: owner ?? null }
  );
}
