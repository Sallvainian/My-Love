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
 * - `deleteAccountImages(userId)` — delete every image cached for one account
 *   and nothing else. Called on sign-out with the OUTGOING account (see
 *   `deleteAccountData` in `authSlice.ts`). Throws.
 *
 * ## Rules for a consumer
 *
 * - FILL SOURCE. Cache only a Blob downloaded from Storage for a path the
 *   account was shown (love notes: when the image is displayed; photos, story
 *   10: its own policy). Never a preview of an unsent upload.
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

/** Delete every image cached for `userId`, and nothing else. Throws on failure. */
export async function deleteAccountImages(userId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.IMAGE_CACHE, 'readwrite');
  const keys = await tx.store.index('by-user').getAllKeys(userId);
  // Awaited together, as in localCopy.deleteAccountCopies.
  await Promise.all([...keys.map((key) => tx.store.delete(key)), tx.done]);
}
