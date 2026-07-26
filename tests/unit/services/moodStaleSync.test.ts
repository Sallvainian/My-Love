/**
 * A sync must never silently discard a concurrent edit.
 *
 * Two independent routes lose an edit, and each is covered here:
 *
 * 1. Clearing the dirty flag unconditionally. A sync snapshots a record, spends
 *    up to ~7s in retry backoff, then marks it clean over whatever the user
 *    typed in the meantime.
 * 2. Two contexts syncing the same record at once. `syncStatus.isSyncing` is
 *    per-context, so a second tab and the service worker cannot see it; the
 *    last write wins on the server while both writers report success.
 *
 * These drive the REAL moodService and sw-db against fake-indexeddb, so the
 * single-transaction compare-and-set is exercised rather than described.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { moodService } from '@/services/moodService';
import { moodSyncFingerprint } from '@/services/moodSyncPayload';
import { MOOD_SYNC_LOCK, withSyncLock } from '@/services/syncLock';
import { markMoodSynced } from '@/sw-db';

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

/**
 * Minimal in-process LockManager.
 *
 * happy-dom has no `navigator.locks`, and the real one cannot be driven
 * deterministically anyway. This models the only two behaviours the code
 * depends on: `ifAvailable` yields null while held, and the lock is released
 * when the callback settles — including when it throws.
 */
function installFakeLockManager(): { held: () => Set<string> } {
  const held = new Set<string>();

  const locks = {
    async request(
      name: string,
      options: { ifAvailable?: boolean },
      callback: (lock: { name: string } | null) => Promise<unknown>
    ) {
      if (held.has(name)) {
        if (options?.ifAvailable) return callback(null);
        throw new Error('fake LockManager only models ifAvailable');
      }
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };

  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
  return { held: () => held };
}

describe('stale mood sync must not discard an edit', () => {
  beforeEach(async () => {
    installFakeLockManager();
    try {
      await moodService.clear();
    } catch {
      // Ignore if db not initialized yet
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('markAsSynced change detection', () => {
    it('[clean sync] clears the flag and records the server id', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'unchanged');

      const outcome = await moodService.markAsSynced(
        created.id!,
        'server-1',
        moodSyncFingerprint(created)
      );

      expect(outcome).toBe('cleared');
      const stored = await moodService.get(created.id!);
      expect(stored!.synced).toBe(true);
      expect(stored!.supabaseId).toBe('server-1');
      expect(await moodService.getUnsyncedMoods()).toHaveLength(0);
    });

    it('[note edited mid-flight] keeps the record dirty and still records the server id', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);

      // The user edits while the write is in flight.
      await moodService.updateMood(created.id!, ['happy'], 'B');

      const outcome = await moodService.markAsSynced(created.id!, 'server-1', sent);

      expect(outcome).toBe('deferred');
      const stored = await moodService.get(created.id!);
      expect(stored!.synced).toBe(false);
      expect(stored!.note).toBe('B');
      // Recorded anyway: the row exists, so the next pass must PATCH it rather
      // than insert a second one.
      expect(stored!.supabaseId).toBe('server-1');

      const pending = await moodService.getUnsyncedMoods();
      expect(pending.map((m) => m.id)).toEqual([created.id]);
    });

    it('[mood type edited mid-flight] is detected as well as a note change', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'same note');
      const sent = moodSyncFingerprint(created);

      await moodService.updateMood(created.id!, ['sad'], 'same note');

      expect(await moodService.markAsSynced(created.id!, 'server-1', sent)).toBe('deferred');
      expect((await moodService.get(created.id!))!.synced).toBe(false);
    });

    it('[edit reverts to the sent value] clears the flag rather than deferring forever', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);

      await moodService.updateMood(created.id!, ['happy'], 'B');
      await moodService.updateMood(created.id!, ['happy'], 'A');

      // The server already holds this exact content, so deferring would leave
      // the record permanently dirty and re-sync it on every trigger.
      expect(await moodService.markAsSynced(created.id!, 'server-1', sent)).toBe('cleared');
      expect((await moodService.get(created.id!))!.synced).toBe(true);
    });

    it('[record deleted mid-flight] reports missing without throwing', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);

      await moodService.delete(created.id!);

      await expect(moodService.markAsSynced(created.id!, 'server-1', sent)).resolves.toBe(
        'missing'
      );
    });

    it('[edit races the mark] the edit is never reverted', async () => {
      // Behavioural guard. Both operations start in the same tick; whichever
      // order they commit in, the record must not end up stale-on-the-server
      // and flagged clean at the same time.
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);

      await Promise.all([
        moodService.markAsSynced(created.id!, 'server-1', sent),
        moodService.updateMood(created.id!, ['happy'], 'B'),
      ]);

      const stored = await moodService.get(created.id!);
      expect(stored!.note).toBe('B');
      // The edit is the newer value, so it is by definition not on the server:
      // whichever order the transactions committed in, the record must still be
      // pending. Asserting this as its own expectation matters — folding it into
      // a conjunction with the line above makes it unfalsifiable.
      expect(stored!.synced).toBe(false);
    });

    it('[atomicity] reads and writes inside exactly one readwrite transaction', async () => {
      // The behavioural test above cannot force the interleave deterministically
      // — a `get`/`await`/`put` pair passes it by luck of scheduling. So assert
      // the structural invariant the fix actually rests on: one transaction,
      // which IndexedDB serialises against every other connection including the
      // service worker. Two transactions means a gap, and a gap means the same
      // silent loss in a narrower window.
      const created = await moodService.create(USER_ID, ['happy'], 'A');

      const opened: Array<{ store: unknown; mode: string }> = [];
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase['transaction']>
      ) {
        opened.push({ store: args[0], mode: args[1] ?? 'readonly' });
        return original.apply(this, args);
      };

      try {
        await moodService.markAsSynced(created.id!, 'server-1', moodSyncFingerprint(created));
      } finally {
        IDBDatabase.prototype.transaction = original;
      }

      expect(opened).toEqual([{ store: 'moods', mode: 'readwrite' }]);
    });

    it('[legacy record] a string timestamp fingerprints identically to a Date', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');

      const asStored = { ...created, timestamp: created.timestamp.toISOString() };
      // Cast: models a record rehydrated from persisted JSON, which the type
      // says is a Date but which arrives as a string.
      expect(moodSyncFingerprint(asStored as unknown as typeof created)).toBe(
        moodSyncFingerprint(created)
      );
    });

    it('[single-mood legacy record] fingerprints the same as its multi-mood equivalent', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const legacy = { ...created, moods: undefined };

      expect(moodSyncFingerprint(legacy)).toBe(moodSyncFingerprint(created));
    });
  });

  describe('service worker uses the identical rule', () => {
    it('[SW syncs while a tab edits] leaves the record pending', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);

      await moodService.updateMood(created.id!, ['happy'], 'B');

      expect(await markMoodSynced(created.id!, 'server-1', sent)).toBe('deferred');
      const stored = await moodService.get(created.id!);
      expect(stored!.synced).toBe(false);
      expect(stored!.supabaseId).toBe('server-1');
    });

    it('[SW clean sync] clears the flag', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');

      expect(await markMoodSynced(created.id!, 'server-1', moodSyncFingerprint(created))).toBe(
        'cleared'
      );
      expect((await moodService.get(created.id!))!.synced).toBe(true);
    });

    it('[SW record deleted mid-flight] reports missing without throwing', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');
      const sent = moodSyncFingerprint(created);
      await moodService.delete(created.id!);

      await expect(markMoodSynced(created.id!, 'server-1', sent)).resolves.toBe('missing');
    });

    it('[SW atomicity] reads and writes inside exactly one readwrite transaction', async () => {
      // The main-thread half has this guard; without the same one here, a
      // refactor of sw-db back to `get`/`await`/`put` reopens the race with a
      // fully green suite. `openDatabase()` also opens a connection, so filter
      // to transactions on the moods store.
      const created = await moodService.create(USER_ID, ['happy'], 'A');

      const opened: Array<{ store: unknown; mode: string }> = [];
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (
        this: IDBDatabase,
        ...args: Parameters<IDBDatabase['transaction']>
      ) {
        opened.push({ store: args[0], mode: args[1] ?? 'readonly' });
        return original.apply(this, args);
      };

      try {
        await markMoodSynced(created.id!, 'server-1', moodSyncFingerprint(created));
      } finally {
        IDBDatabase.prototype.transaction = original;
      }

      expect(opened.filter((t) => t.store === 'moods')).toEqual([
        { store: 'moods', mode: 'readwrite' },
      ]);
    });
  });

  describe('cross-context lock', () => {
    it('[second writer] skips while another context holds the lock', async () => {
      let innerRan = false;
      let outerOutcome: unknown;

      await withSyncLock(MOOD_SYNC_LOCK, async () => {
        // Reentrant call models a second tab or the service worker starting a
        // batch while this one is mid-flight.
        outerOutcome = await withSyncLock(MOOD_SYNC_LOCK, async () => {
          innerRan = true;
          return 'inner';
        });
        return 'outer';
      });

      expect(innerRan).toBe(false);
      expect(outerOutcome).toEqual({ ran: false });
    });

    it('[second writer] touches no flags when it skips', async () => {
      const created = await moodService.create(USER_ID, ['happy'], 'A');

      await withSyncLock(MOOD_SYNC_LOCK, async () => {
        await withSyncLock(MOOD_SYNC_LOCK, async () => {
          await moodService.markAsSynced(created.id!, 'server-1', moodSyncFingerprint(created));
        });
      });

      expect((await moodService.get(created.id!))!.synced).toBe(false);
      expect((await moodService.get(created.id!))!.supabaseId).toBeUndefined();
    });

    it('[holder crashes] releases the lock so the next batch proceeds', async () => {
      await expect(
        withSyncLock(MOOD_SYNC_LOCK, async () => {
          throw new Error('tab closed mid-batch');
        })
      ).rejects.toThrow('tab closed mid-batch');

      const after = await withSyncLock(MOOD_SYNC_LOCK, async () => 'ran');
      expect(after).toEqual({ ran: true, result: 'ran' });
    });

    it('[navigator.locks absent] still runs the batch', async () => {
      Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });

      const outcome = await withSyncLock(MOOD_SYNC_LOCK, async () => 'ran');

      expect(outcome).toEqual({ ran: true, result: 'ran' });
    });
  });
});
