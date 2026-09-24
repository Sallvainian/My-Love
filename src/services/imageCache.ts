/**
 * Image cache — per-account image Blobs, keyed by storage path.
 *
 * An image shown online is kept here so it can be shown again offline.
 * Signed URLs cannot serve that purpose: they change on every signing and
 * expire after 3600 s. So a cached image is keyed by its STORAGE PATH and
 * holds the Blob itself, fetched with the Storage `download()` API.
 *
 * One IndexedDB store, `image-cache`, keyed `[userId, path]` with a `by-user`
 * index (see `dbSchema.ts`, v13). It is separate from `local-copies`, whose
 * values must be plain structured-cloneable data without blob URLs.
 *
 * ## API
 *
 * IndexedDB convention: reads return `null` on failure, writes throw.
 * - `readCachedImage(userId, path)` — the cached Blob, or `null` when there is
 *   none or the read failed.
 * - `writeCachedImage(userId, path, blob)` — cache (or replace) one image.
 *   Throws. A caller that is showing the image logs the failure and still
 *   shows it.
 * - `deleteCachedImages(userId, paths)` — delete the listed images of one
 *   account (absent paths are a no-op). Throws.
 * - `deleteAccountImages(userId)` — delete every image cached for one account
 *   and nothing else. Called on sign-out with the OUTGOING account (see
 *   `deleteAccountData` in `authSlice.ts`). Throws.
 * - `isQuotaError(error)` — whether a failed write was the browser refusing
 *   more storage (a `QuotaExceededError`, including a transaction aborted
 *   with one).
 *
 * ## Rules for a consumer
 *
 * - FILL SOURCE. Cache only a Blob downloaded from Storage for a path the
 *   account was shown or listed. Love notes: when the image is displayed.
 *   Photos (`photoImageCache.ts`): every photo in the account's `photos` list,
 *   filled in the background after each successful list read and when an
 *   image is displayed; photo images alone are evicted, oldest first, and only
 *   when the browser refuses a write. Never a preview of an unsent upload.
 * - IDENTITY. Capture `{ userId, authSessionVersion }` before the first await
 *   and re-check both before writing the cache and before showing the result,
 *   so one account's image is never cached or shown under another. Write under
 *   the CAPTURED `userId`.
 * - A Blob handed to `URL.createObjectURL` for display must be revoked by its
 *   consumer when no longer shown.
 */
import type { IDBPDatabase } from 'idb';
import type { MyLoveDBSchema } from './dbSchema';
import { STORE_NAMES, openMyLoveDB } from './dbSchema';

let dbPromise: Promise<IDBPDatabase<MyLoveDBSchema>> | null = null;

/** One shared handle, dropped on `versionchange` / `close` (as in localCopy.ts). */
function getDb(): Promise<IDBPDatabase<MyLoveDBSchema>> {
  if (!dbPromise) {
    const opening = openMyLoveDB().then((db) => {
      const forget = () => {
        if (dbPromise === opening) dbPromise = null;
      };
      db.addEventListener('versionchange', forget);
      db.addEventListener('close', forget);
      return db;
    });
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
    dbPromise = opening;
  }
  return dbPromise;
}

/** The cached image at `path` for `userId`, or `null` when absent or unreadable. */
export async function readCachedImage(userId: string, path: string): Promise<Blob | null> {
  try {
    const db = await getDb();
    const row = await db.get(STORE_NAMES.IMAGE_CACHE, [userId, path]);
    return row?.blob instanceof Blob ? row.blob : null;
  } catch (error) {
    console.error('[imageCache] Failed to read a cached image:', error);
    return null;
  }
}

/** Cache `blob` as the image at `path` for `userId`. Throws on failure. */
export async function writeCachedImage(userId: string, path: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAMES.IMAGE_CACHE, { userId, path, blob, savedAt: Date.now() });
}

/** Delete the images at `paths` cached for `userId`, and nothing else. Throws on failure. */
export async function deleteCachedImages(userId: string, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.IMAGE_CACHE, 'readwrite');
  // Awaited together, as in localCopy.deleteAccountCopies.
  await Promise.all([...paths.map((path) => tx.store.delete([userId, path])), tx.done]);
}

/**
 * Whether `error` is the browser refusing more storage: a `QuotaExceededError`
 * (legacy code 22, Firefox's `NS_ERROR_DOM_QUOTA_REACHED` 1014), or an
 * IndexedDB transaction aborted with one — `idb` rejects that as the
 * transaction's own error, or as an `AbortError` whose request or transaction
 * carries it.
 */
export function isQuotaError(error: unknown): boolean {
  const seen = new Set<unknown>();
  const check = (value: unknown, depth: number): boolean => {
    if (!value || typeof value !== 'object' || depth > 3 || seen.has(value)) return false;
    seen.add(value);
    const v = value as {
      name?: unknown;
      code?: unknown;
      error?: unknown;
      cause?: unknown;
      target?: { error?: unknown } | null;
    };
    if (v.name === 'QuotaExceededError' || v.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    if (v.code === 22 || v.code === 1014) return true;
    return (
      check(v.error, depth + 1) ||
      check(v.cause, depth + 1) ||
      check(v.target?.error, depth + 1)
    );
  };
  return check(error, 0);
}

/** Delete every image cached for `userId`, and nothing else. Throws on failure. */
export async function deleteAccountImages(userId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.IMAGE_CACHE, 'readwrite');
  const keys = await tx.store.index('by-user').getAllKeys(userId);
  // Awaited together, as in localCopy.deleteAccountCopies.
  await Promise.all([...keys.map((key) => tx.store.delete(key)), tx.done]);
}
