/**
 * Local copy — the one per-account, per-kind saved copy of server data.
 *
 * Every screen that shows account or couple data renders its saved copy at
 * once and then refreshes it from the server (stale-while-revalidate). This
 * module is the only place those copies live: one IndexedDB store,
 * `local-copies`, keyed `[userId, kind]` (see `dbSchema.ts`, v12). No feature
 * keeps its own cache.
 *
 * ## API
 *
 * Storage (IndexedDB convention: reads return `null` on failure, writes throw):
 * - `readLocalCopy<T>(userId, kind)` — the saved value, or `null` when there is
 *   none or the read failed.
 * - `writeLocalCopy<T>(userId, kind, value)` — replace the saved value. Throws.
 * - `deleteAccountCopies(userId)` — delete every kind saved for one account.
 *   Called on sign-out with the OUTGOING account; touches no other store
 *   (queued `moods` rows stay for their owner). Throws.
 *
 * Refresh (who re-reads the server, and when):
 * - `registerLocalCopy(kind, refresh)` — register the kind's refresher. One per
 *   kind; registering again replaces it. Returns an unregister function.
 * - `refreshLocalCopies()` — run every registered refresher. App.tsx calls it on
 *   signed-in start and on the window `online` event. Each kind runs
 *   independently: one kind's failure is logged and never stops another.
 * - `refreshLocalCopy(kind)` — run one kind's refresher; for Realtime handlers
 *   and screens that need a fresh read on demand. Same failure isolation.
 *
 * ## Rules for a consumer
 *
 * - FILL SOURCES. A copy is written only from a server response, a Realtime
 *   event, or the user's own write (confirmed or queued). Never from a default,
 *   a guess, or another account's state.
 * - A FAILED SERVER READ changes nothing: the copy and the screen stay as they
 *   were. Only a successful read overwrites a copy — including "the server says
 *   there is nothing", which is saved as such.
 * - IDENTITY. A refresher captures `{ userId, authSessionVersion }` before its
 *   first await and re-checks both before every store write and before writing
 *   the copy, so a result raised for one account is never shown or saved under
 *   another. The copy is written under the CAPTURED `userId`.
 * - A refresher resolves on its own failures (log and keep); a throw is still
 *   contained here, but should not be relied on.
 * - The value must be structured-cloneable (plain data, no class instances,
 *   functions or blob URLs).
 */
import type { IDBPDatabase } from 'idb';
import type { MyLoveDBSchema } from './dbSchema';
import { STORE_NAMES, openMyLoveDB } from './dbSchema';

export type LocalCopyRefresher = () => Promise<void>;

const refreshers = new Map<string, LocalCopyRefresher>();

let dbPromise: Promise<IDBPDatabase<MyLoveDBSchema>> | null = null;

/**
 * One shared handle. `openMyLoveDB`'s `blocking` handler closes it when a newer
 * version (or a delete) wants the database; the `versionchange` / `close`
 * listeners drop the cached promise so the next call reopens.
 */
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

/** The saved copy of `kind` for `userId`, or `null` when absent or unreadable. */
export async function readLocalCopy<T>(userId: string, kind: string): Promise<T | null> {
  try {
    const db = await getDb();
    const row = await db.get(STORE_NAMES.LOCAL_COPIES, [userId, kind]);
    return row ? (row.value as T) : null;
  } catch (error) {
    console.error(`[localCopy] Failed to read ${kind} copy:`, error);
    return null;
  }
}

/** Replace the saved copy of `kind` for `userId`. Throws on failure. */
export async function writeLocalCopy<T>(userId: string, kind: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAMES.LOCAL_COPIES, { userId, kind, value, savedAt: Date.now() });
}

/**
 * Delete every saved copy belonging to `userId`, and nothing else. Other
 * accounts' copies and every other store (including unsynced `moods`) are
 * untouched. Throws on failure.
 */
export async function deleteAccountCopies(userId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.LOCAL_COPIES, 'readwrite');
  const keys = await tx.store.index('by-user').getAllKeys(userId);
  // Awaited together: a rejected delete aborts the transaction, and a
  // separately awaited `tx.done` would then reject with no handler attached.
  await Promise.all([...keys.map((key) => tx.store.delete(key)), tx.done]);
}

/**
 * Register the refresher for `kind`. Registering a kind again replaces its
 * refresher. Returns a function that unregisters it (only if still current).
 */
export function registerLocalCopy(kind: string, refresh: LocalCopyRefresher): () => void {
  refreshers.set(kind, refresh);
  return () => {
    if (refreshers.get(kind) === refresh) refreshers.delete(kind);
  };
}

async function runRefresher(kind: string, refresh: LocalCopyRefresher): Promise<void> {
  try {
    await refresh();
  } catch (error) {
    console.error(`[localCopy] Refresh failed for ${kind}:`, error);
  }
}

/** Run every registered refresher; one kind's failure never stops another. */
export async function refreshLocalCopies(): Promise<void> {
  await Promise.all(
    Array.from(refreshers, ([kind, refresh]) => runRefresher(kind, refresh))
  );
}

/** Run one kind's refresher, if registered. Failures are logged, not thrown. */
export async function refreshLocalCopy(kind: string): Promise<void> {
  const refresh = refreshers.get(kind);
  if (!refresh) return;
  await runRefresher(kind, refresh);
}
