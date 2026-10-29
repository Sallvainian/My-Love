/**
 * Read the app's IndexedDB straight from the page, as a spec's witness of what
 * a device holds. One guarded reader for every e2e read, so no spec opens the
 * database by hand; writes (seeding or clearing a store) stay in their specs.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { Page } from '@playwright/test';

/**
 * A key the specs read by: a string, number, or compound array of them.
 * Narrower than `IDBValidKey`, whose recursive type is too deep for
 * `page.evaluate`'s argument typing.
 */
export type StoreKey = string | number | Array<string | number>;

/** What `readStore` asks: every row (optionally through an index), one row, or the row count. */
export type StoreQuery =
  | { op: 'getAll'; index?: string; key?: StoreKey }
  | { op: 'get'; key: StoreKey }
  | { op: 'count' };

/**
 * The answer to `query` against `store`, or `null` when there is nothing to
 * read: no `database` yet, no such store or index (or a key IndexedDB
 * refuses), a blocked open, or (for `get`) no row under `key`. A failed open
 * or a failed read request rejects with the IndexedDB error, so a spec never
 * mistakes a broken read for an empty one.
 *
 * The database is never opened before the app has created it: opening it
 * first would create an empty one ahead of the app's own upgrade. The answer
 * is JSON-cloned on the way out, so a `Date` comes back as its ISO string and
 * a `Blob` as `{ blobSize }` (a Blob cannot cross `page.evaluate`).
 *
 * A caller decides what `null` means for it: one that must see the store
 * throws, one with a natural empty answer (`[]`, `false`) returns that. A
 * caller that always answered a failed read with that empty answer catches
 * the rejection itself.
 */
export async function readStore<T>(
  page: Page,
  store: string,
  query: StoreQuery,
  database = 'my-love-db'
): Promise<T | null> {
  return page.evaluate(
    async ({ databaseName, storeName, storeQuery }) => {
      if (!(await indexedDB.databases()).some(({ name }) => name === databaseName)) return null;
      const answer = await new Promise<{ value: unknown } | null>((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        open.onerror = () => reject(open.error);
        // Without this the read never settles when another connection holds a
        // pending versionchange, and the spec hangs to its own timeout instead.
        open.onblocked = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          const finish = (value: { value: unknown } | null) => {
            db.close();
            resolve(value);
          };
          if (!db.objectStoreNames.contains(storeName)) {
            finish(null);
            return;
          }
          let request: IDBRequest;
          try {
            const objectStore = db.transaction(storeName, 'readonly').objectStore(storeName);
            if (storeQuery.op === 'count') {
              request = objectStore.count();
            } else if (storeQuery.op === 'get') {
              request = objectStore.get(storeQuery.key);
            } else {
              const source = storeQuery.index ? objectStore.index(storeQuery.index) : objectStore;
              request = source.getAll(storeQuery.key);
            }
          } catch {
            // A missing index, or a key IndexedDB refuses.
            finish(null);
            return;
          }
          request.onsuccess = () => finish({ value: request.result });
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        };
      });
      if (answer === null || answer.value === undefined) return null;
      return JSON.parse(
        JSON.stringify(answer.value, (_key, value: unknown) =>
          value instanceof Blob ? { blobSize: value.size } : value
        )
      );
    },
    { databaseName: database, storeName: store, storeQuery: query }
  );
}

/** The signed-in account's id as the app's store holds it, or `null` when signed out. */
export async function signedInUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__APP_STORE__?.getState().userId ?? null);
}

/** Whether the signed-in account's image cache holds a non-empty Blob for `path`. */
export async function imageCached(page: Page, path: string): Promise<boolean> {
  const userId = await signedInUserId(page);
  if (!userId) return false;
  // A failed read counts as not cached, as it always did.
  const row = await readStore<{ blob?: { blobSize?: unknown } }>(page, 'image-cache', {
    op: 'get',
    key: [userId, path],
  }).catch(() => null);
  return typeof row?.blob?.blobSize === 'number' && row.blob.blobSize > 0;
}
