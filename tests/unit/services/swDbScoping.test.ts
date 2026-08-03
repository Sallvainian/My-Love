/**
 * sw-db against a real database — account scoping and the v7 index migration
 *
 * Two gaps this closes, both invisible to the mocked service-worker tests:
 *
 * 1. `getPendingMoods()` read the whole moods store. That store holds every
 *    account that has signed in on this device, and sw.ts stamps each row it is
 *    handed with the stored token's owner, so a background sync after an account
 *    switch uploaded one partner's private mood notes into the other's account.
 *
 * 2. The v7 branch that migrates an existing profile's moods index —
 *    `dbSchema.ts:283 } else if (tx) {` — had no coverage at all. Deleting the
 *    whole branch left the suite green, because every other test creates the
 *    store fresh and takes the `!contains('moods')` path instead.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema, StoredMoodEntry } from '../../../src/services/dbSchema';
import { getPendingMoods } from '../../../src/sw-db';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';

/** Connections opened by a test, closed in afterEach so upgrades are not blocked */
let openConnections: Array<IDBPDatabase<MyLoveDBSchema>> = [];

function mood(overrides: Partial<StoredMoodEntry> & { userId: string }): StoredMoodEntry {
  return {
    mood: 'happy',
    moods: ['happy'],
    note: 'a note',
    date: '2026-08-03',
    timestamp: new Date('2026-08-03T12:00:00.000Z'),
    synced: false,
    ...overrides,
  };
}

/** Open at the current version through the shared upgrade path */
async function openCurrent(): Promise<IDBPDatabase<MyLoveDBSchema>> {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, newVersion, transaction) {
      upgradeDb(database, oldVersion, newVersion, transaction);
    },
  });
  openConnections.push(db);
  return db;
}

async function seed(moods: StoredMoodEntry[]): Promise<void> {
  const db = await openCurrent();
  const tx = db.transaction('moods', 'readwrite');
  for (const entry of moods) {
    await tx.store.add(entry);
  }
  await tx.done;
  db.close();
}

describe('sw-db against a real database', () => {
  beforeEach(() => {
    // A fresh factory per test: these open at differing versions and a database
    // left behind by the previous test would skip the upgrade under test.
    globalThis.indexedDB = new IDBFactory();
    openConnections = [];
  });

  afterEach(() => {
    openConnections.forEach((db) => db.close());
    openConnections = [];
  });

  describe('getPendingMoods account scoping', () => {
    it('returns only the named user’s unsynced rows', async () => {
      await seed([
        mood({ userId: USER_A, date: '2026-08-01', note: 'mine, pending' }),
        mood({ userId: USER_B, date: '2026-08-01', note: 'theirs, pending' }),
        mood({ userId: USER_B, date: '2026-08-02', note: 'theirs, also pending' }),
      ]);

      const pending = await getPendingMoods(USER_A);

      expect(pending).toHaveLength(1);
      expect(pending[0].note).toBe('mine, pending');
      // The leak in full: the other account's private note reaching a caller
      // that is about to stamp it with this token's user id.
      expect(pending.map((m) => m.userId)).not.toContain(USER_B);
    });

    it('still excludes rows already synced', async () => {
      await seed([
        mood({ userId: USER_A, date: '2026-08-01', synced: true }),
        mood({ userId: USER_A, date: '2026-08-02', synced: false }),
      ]);

      const pending = await getPendingMoods(USER_A);

      expect(pending).toHaveLength(1);
      expect(pending[0].date).toBe('2026-08-02');
    });

    it('does not claim a malformed row that carries no owner', async () => {
      // Defensive, not a migration path: `moodService.create` has required a
      // userId since the file was written, so no such row should exist. If one
      // ever did, it belongs to nobody and must not be uploaded under whoever
      // happens to be signed in. Mirrors moodService.getUnsyncedMoods, which
      // compares strictly and so skips it too.
      await seed([
        mood({ userId: undefined as unknown as string, date: '2026-07-01' }),
        mood({ userId: USER_A, date: '2026-08-01' }),
      ]);

      const pending = await getPendingMoods(USER_A);

      expect(pending).toHaveLength(1);
      expect(pending[0].userId).toBe(USER_A);
    });

    it('returns every user’s rows when no owner is given', async () => {
      // The unscoped read is still reachable and must keep its old meaning;
      // sw.ts simply no longer uses it.
      await seed([
        mood({ userId: USER_A, date: '2026-08-01' }),
        mood({ userId: USER_B, date: '2026-08-01' }),
      ]);

      expect(await getPendingMoods()).toHaveLength(2);
    });

    it('returns an empty list when the user has nothing pending', async () => {
      await seed([mood({ userId: USER_B, date: '2026-08-01' })]);

      expect(await getPendingMoods(USER_A)).toEqual([]);
    });
  });

  describe('v7 moods index migration on an existing profile', () => {
    /**
     * Build the pre-v7 shape: a moods store whose unique index is `by-date`.
     * This is the branch every already-installed profile takes, as opposed to
     * the fresh-install branch that creates the store outright.
     */
    async function seedLegacyV6(): Promise<void> {
      const legacy = await openDB(DB_NAME, 6, {
        upgrade(database) {
          const store = database.createObjectStore('moods', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'date', { unique: true });
        },
      });
      legacy.close();
    }

    it('drops by-date and creates by-user-date', async () => {
      await seedLegacyV6();

      const db = await openCurrent();
      const tx = db.transaction('moods', 'readonly');
      const indexNames = Array.from(tx.store.indexNames);
      await tx.done;

      expect(indexNames).toContain('by-user-date');
      // The whole point of v7: `by-date` unique on the date alone collided
      // across accounts, so one partner logging a mood blocked the other.
      expect(indexNames).not.toContain('by-date');
    });

    it('lets both partners log a mood on the same day', async () => {
      await seedLegacyV6();
      await openCurrent().then((db) => db.close());

      await seed([
        mood({ userId: USER_A, date: '2026-08-03' }),
        mood({ userId: USER_B, date: '2026-08-03' }),
      ]);

      const db = await openCurrent();
      const all = await db.getAll('moods');
      db.close();

      // Under the old `by-date` unique index the second add threw a
      // ConstraintError and one partner's mood was silently lost.
      expect(all).toHaveLength(2);
    });

    it('still rejects the same user logging twice for one day', async () => {
      await seedLegacyV6();
      await openCurrent().then((db) => db.close());

      await seed([mood({ userId: USER_A, date: '2026-08-03' })]);

      const db = await openCurrent();
      const tx = db.transaction('moods', 'readwrite');
      // The constraint violation aborts the transaction, so `done` rejects too.
      // Claim it up front or it surfaces as an unhandled rejection after the
      // test has already passed.
      const aborted = tx.done.catch(() => undefined);

      await expect(tx.store.add(mood({ userId: USER_A, date: '2026-08-03' }))).rejects.toThrow();

      await aborted;
      db.close();
    });

    it('preserves rows written before the migration', async () => {
      await seedLegacyV6();

      // Write through the legacy shape, then upgrade over the top of it.
      const legacy = await openDB(DB_NAME, 6);
      const legacyTx = legacy.transaction('moods', 'readwrite');
      await legacyTx.store.add(mood({ userId: USER_A, date: '2026-07-30', note: 'kept' }));
      await legacyTx.done;
      legacy.close();

      const db = await openCurrent();
      const all = await db.getAll('moods');
      db.close();

      expect(all).toHaveLength(1);
      expect(all[0].note).toBe('kept');
    });
  });
});
