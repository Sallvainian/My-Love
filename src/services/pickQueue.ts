/**
 * Pick queue — daily-question picks waiting to be sent, per account.
 *
 * A pick made without a connection is written here with the instant and zone it
 * was made in, so it survives a reload and goes out when the connection returns
 * (architecture AD-12). The server dates a pick by its `picked_at` in the zone
 * sent with it, so a pick sent after midnight still counts for its own date.
 *
 * One IndexedDB store, `pick-queue`, keyed `[user_id, day_id]` with a `by-user`
 * index (see `dbSchema.ts`, v16). Each row is plain data:
 * `{ user_id, day_id, choice, picked_at, time_zone, utc_offset_minutes, failed,
 * failure }`.
 *
 * ## API
 *
 * IndexedDB convention: reads return `[]` on failure, writes throw.
 * - `enqueuePick(row)` — add one pick. A new pick for the same account and day
 *   replaces the row. Throws.
 * - `listQueuedPicks(userId)` — that account's rows, oldest `picked_at` first
 *   (ties by `day_id`), or `[]` when there are none or the read failed.
 * - `markQueuedPickFailed(userId, dayId, failure)` — mark a row refused by the
 *   server, with the refusal's message. Resolves `false` when no such row
 *   exists. Throws.
 * - `removeQueuedPick(userId, dayId)` — delete one row. Deleting an absent row
 *   is a no-op. Throws.
 *
 * ## Queue rules
 *
 * - SENDER. Only `dailyQuestionSlice.drainQueuedPicks` sends rows, under
 *   `withSyncLock(PICK_QUEUE_LOCK)`, oldest first, and only the signed-in
 *   account's pending (not `failed`) rows. A resend after a lost response is
 *   idempotent on the server (one pick per day and user).
 * - DELETE on a confirmed answer, even if the session changed meanwhile: the
 *   pick is committed. A server refusal marks the row `failed` instead; any
 *   other failure leaves it pending for the next drain trigger.
 * - FAILED rows are not pending: the view gives the pick control back, and a
 *   new pick for that day replaces the row.
 * - ACCOUNTS. Sign-out keeps an account's rows; they send when that account
 *   signs back in. `deleteAccountData` never touches this store.
 * - Queued picks are never written to the `daily-days` local copy.
 */
import type { IDBPDatabase } from 'idb';
import type { MyLoveDBSchema, StoredQueuedPick } from './dbSchema';
import { STORE_NAMES, openMyLoveDB } from './dbSchema';

export type QueuedPick = StoredQueuedPick;

let dbPromise: Promise<IDBPDatabase<MyLoveDBSchema>> | null = null;

/** One shared handle, dropped on `versionchange` / `close` (as in noteQueue.ts). */
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

/** Add one pick to the queue, replacing any row for the same account and day. Throws on failure. */
export async function enqueuePick(pick: QueuedPick): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAMES.PICK_QUEUE, {
    user_id: pick.user_id,
    day_id: pick.day_id,
    choice: pick.choice,
    picked_at: pick.picked_at,
    time_zone: pick.time_zone,
    utc_offset_minutes: pick.utc_offset_minutes,
    failed: pick.failed,
    failure: pick.failure,
  });
}

/** `userId`'s queued picks, oldest first; `[]` when none or unreadable. */
export async function listQueuedPicks(userId: string): Promise<QueuedPick[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllFromIndex(STORE_NAMES.PICK_QUEUE, 'by-user', userId);
    return rows.sort((a, b) => {
      if (a.picked_at !== b.picked_at) return a.picked_at < b.picked_at ? -1 : 1;
      if (a.day_id === b.day_id) return 0;
      return a.day_id < b.day_id ? -1 : 1;
    });
  } catch (error) {
    console.error('[pickQueue] Failed to read the pick queue:', error);
    return [];
  }
}

/**
 * Mark one row refused by the server, with the refusal's message. Resolves
 * `false` when the row is absent. Throws on failure.
 */
export async function markQueuedPickFailed(
  userId: string,
  dayId: string,
  failure: string
): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.PICK_QUEUE, 'readwrite');
  const row = await tx.store.get([userId, dayId]);
  if (!row) {
    await tx.done;
    return false;
  }
  await Promise.all([tx.store.put({ ...row, failed: true, failure }), tx.done]);
  return true;
}

/** Delete one row; an absent row is a no-op. Throws on failure. */
export async function removeQueuedPick(userId: string, dayId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAMES.PICK_QUEUE, [userId, dayId]);
}
