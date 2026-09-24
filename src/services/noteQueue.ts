/**
 * Note queue — love-note text waiting to be sent, per account.
 *
 * Every text-only love note is written here before it is sent, so a note
 * composed offline (or whose send fails on the network) survives a reload and
 * goes out later, in order and exactly once. A note with a picture never comes
 * here; it needs a connection and keeps its direct send path.
 *
 * One IndexedDB store, `note-queue`, keyed by the note's `tempId` with a
 * `by-user` index (see `dbSchema.ts`, v14). Each row is plain data:
 * `{ id: tempId, userId, toUserId, content, createdAt, failed }`.
 *
 * ## API
 *
 * IndexedDB convention: reads return `[]` on failure, writes throw.
 * - `enqueueNote(note)` — add one note. Throws, so the composer keeps its text.
 * - `listQueuedNotes(userId)` — that account's rows, oldest `createdAt` first
 *   (ties by `id`), or `[]` when there are none or the read failed.
 * - `setQueuedNoteFailed(id, failed)` — mark a row rejected by the server, or
 *   clear the mark for a Retry. Resolves `false` when no such row exists.
 *   Throws.
 * - `removeQueuedNote(id)` — delete one row. Deleting an absent row is a no-op.
 *   Throws.
 *
 * ## Queue rules
 *
 * - SENDER. Only `notesSlice.drainQueuedNotes` sends rows, under
 *   `withSyncLock(NOTE_QUEUE_LOCK)`, one at a time, oldest first, and only the
 *   signed-in account's rows. The row's `id` is sent as `idempotency_key`, so a
 *   resend after a lost response resolves to the stored note. Another tab of
 *   the account may send a row this tab shows; the drain then confirms that
 *   note from the stored row.
 * - RECIPIENT. `toUserId` is fixed at enqueue, from the loaded partner or a
 *   successful partner lookup. A queued note never needs a network lookup to
 *   be sent.
 * - DELETE on a confirmed insert, even if the session changed meanwhile: the
 *   note is committed. A server rejection marks the row `failed` instead; any
 *   other failure leaves it pending for the next drain trigger.
 * - ACCOUNTS. Sign-out keeps an account's rows (CAP-7); they send when that
 *   account signs back in. `deleteAccountData` never touches this store.
 * - Queued notes are never written to the `love-notes` local copy.
 */
import type { IDBPDatabase } from 'idb';
import type { MyLoveDBSchema, StoredQueuedNote } from './dbSchema';
import { STORE_NAMES, openMyLoveDB } from './dbSchema';

export type QueuedNote = StoredQueuedNote;

let dbPromise: Promise<IDBPDatabase<MyLoveDBSchema>> | null = null;

/** One shared handle, dropped on `versionchange` / `close` (as in imageCache.ts). */
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

/** Add one note to the queue. Throws on failure. */
export async function enqueueNote(note: QueuedNote): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAMES.NOTE_QUEUE, {
    id: note.id,
    userId: note.userId,
    toUserId: note.toUserId,
    content: note.content,
    createdAt: note.createdAt,
    failed: note.failed,
  });
}

/** `userId`'s queued notes, oldest first; `[]` when none or unreadable. */
export async function listQueuedNotes(userId: string): Promise<QueuedNote[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllFromIndex(STORE_NAMES.NOTE_QUEUE, 'by-user', userId);
    return rows.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    });
  } catch (error) {
    console.error('[noteQueue] Failed to read the note queue:', error);
    return [];
  }
}

/**
 * Set the `failed` mark on one row. Resolves `false` when the row is absent.
 * Throws on failure.
 */
export async function setQueuedNoteFailed(id: string, failed: boolean): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES.NOTE_QUEUE, 'readwrite');
  const row = await tx.store.get(id);
  if (!row) {
    await tx.done;
    return false;
  }
  await Promise.all([tx.store.put({ ...row, failed }), tx.done]);
  return true;
}

/** Delete one row; an absent row is a no-op. Throws on failure. */
export async function removeQueuedNote(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAMES.NOTE_QUEUE, id);
}
