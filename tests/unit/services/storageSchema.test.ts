/**
 * storageService IndexedDB schema — the open-race and repair paths
 *
 * `storage.ts` used to hand-write its own upgrade callback that created only
 * `messages` and `photos`, on the assumption that whichever service owned a
 * store would create it. IndexedDB runs the upgrade callback of only the ONE
 * `open()` that performs the version-change transaction, and `storage.ts`'s is
 * reached first on a fresh profile (`initializeApp()` at App.tsx:275, before
 * the mood-sync effects), so its callback was the one that ran and six stores
 * were never created at all.
 *
 * Existing dbSchema tests all open with `upgrade: upgradeDb` directly, which
 * is precisely the function `storage.ts` was NOT calling — they proved the
 * shared schema correct while the drifted copy went untested. These drive the
 * real `storageService` instead.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';

const ALL_STORES = [
  'messages',
  'photos',
  'moods',
  'sw-auth',
  'scripture-sessions',
  'scripture-reflections',
  'scripture-bookmarks',
  'scripture-messages',
] as const;

/** Every service instance built in a test, so its connection can be closed */
const openServices: Array<{ db: IDBPDatabase<MyLoveDBSchema> | null }> = [];

/**
 * A fresh storageService.
 *
 * The module exports a singleton caching its connection in `this.db`, so
 * without resetting the module registry a second call reuses the first
 * handle. Resetting alone is not enough: the discarded instance's connection
 * stays open, and IndexedDB blocks a version-change transaction until every
 * connection to that database closes — which is why these are tracked and
 * closed in afterEach rather than left to garbage collection.
 */
async function freshStorageService() {
  vi.resetModules();
  const mod = await import('../../../src/services/storage');
  openServices.push(mod.storageService as unknown as { db: IDBPDatabase<MyLoveDBSchema> | null });
  return mod.storageService;
}

/** Delete the database and wait for it — deleteDatabase is a request, not a call */
function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/** Open the database, run `fn`, close it even if `fn` throws */
async function withDb(
  version: number,
  upgrade: (db: IDBPDatabase<MyLoveDBSchema>) => void,
  fn?: (db: IDBPDatabase<MyLoveDBSchema>) => void
): Promise<void> {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, version, { upgrade });
  try {
    fn?.(db);
  } finally {
    db.close();
  }
}

describe('storageService schema', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    for (const service of openServices) {
      service.db?.close();
    }
    openServices.length = 0;
    await deleteDatabase();
    vi.resetModules();
  });

  it('creates every object store on a fresh profile', async () => {
    // storageService wins the open race on a real fresh profile, so whatever
    // its callback creates IS the schema. Asserted store by store: a count
    // check would pass on the wrong six.
    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      for (const store of ALL_STORES) {
        expect(db.objectStoreNames.contains(store)).toBe(true);
      }
      expect(db.objectStoreNames.length).toBe(ALL_STORES.length);
    } finally {
      db.close();
    }
  });

  it('leaves a moods store the rest of the app can actually open', async () => {
    // `contains('moods')` alone would still pass if the store existed without
    // its index; moodService reads through by-user-date, so the index is the
    // part that has to survive.
    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      const store = db.transaction('moods', 'readonly').objectStore('moods');
      expect(store.indexNames.contains('by-user-date')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('repairs a profile stranded at v5 with the stores its old callback skipped', async () => {
    // Exactly what the deleted callback produced: reached v5, created two
    // stores. Every `oldVersion < N` guard is false at 5, so before the
    // existence checks landed this database could never be repaired by any
    // later version bump.
    await withDb(5, (db) => {
      const messages = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
      messages.createIndex('by-category', 'category');
      messages.createIndex('by-date', 'createdAt');

      const photos = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
      photos.createIndex('by-date', 'uploadDate', { unique: false });
    });

    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      for (const store of ALL_STORES) {
        expect(db.objectStoreNames.contains(store)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('leaves a messages store custom rows can be partitioned in', async () => {
    // The mirror of the moods case above. `by-user` is what separates one
    // account's custom messages from the other's on a shared device, so
    // `contains('messages')` alone is not enough of an assertion.
    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      const store = db.transaction('messages', 'readonly').objectStore('messages');
      expect(store.indexNames.contains('by-user')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('does not discard rows already in a healthy database', async () => {
    // NOTE: this asserts that reopening at the SAME version preserves rows. It
    // deliberately does NOT exercise `upgradeDb` — opening twice at DB_VERSION
    // runs no versionchange transaction at all, so the upgrade path is not
    // under test here. The migration cases below are what cover that.
    const storageService = await freshStorageService();
    await storageService.init();
    const messageId = await storageService.addMessage({
      text: 'keep me',
      category: 'affirmation',
      isFavorite: false,
      isCustom: false,
      createdAt: new Date(),
    });

    const reopened = await freshStorageService();
    await reopened.init();

    expect(await reopened.getMessage(messageId)).toMatchObject({ text: 'keep me' });
  });

  describe('message reads are scoped to one account', () => {
    /**
     * `getAllMessages` feeds the daily rotation and the Home screen, and the
     * store holds every account that has signed in on this device — so
     * unscoped it put one partner's private custom messages into the other's
     * rotation pool. Driven through the real storageService against a real
     * store, because the property under test is which ROWS come back.
     */
    const A = '00000000-0000-4000-8000-00000000000a';
    const B = '00000000-0000-4000-8000-00000000000b';

    async function seedSharedDevice() {
      const storageService = await freshStorageService();
      await storageService.init();
      await storageService.addMessage({
        text: 'BUNDLED-DAILY',
        category: 'reason',
        isCustom: false,
        isFavorite: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await storageService.addMessage({
        text: 'A-PRIVATE-CUSTOM',
        category: 'custom',
        isCustom: true,
        userId: A,
        isFavorite: false,
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      await storageService.addMessage({
        text: 'B-PRIVATE-CUSTOM',
        category: 'custom',
        isCustom: true,
        userId: B,
        isFavorite: false,
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      // Legacy: written before custom rows carried an owner, or migrated from
      // the Story 3.4 LocalStorage list. Belongs to nobody.
      await storageService.addMessage({
        text: 'LEGACY-OWNERLESS',
        category: 'custom',
        isCustom: true,
        isFavorite: false,
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      return storageService;
    }

    it('returns the shared daily rows plus only the caller’s own custom rows', async () => {
      const storageService = await seedSharedDevice();

      expect((await storageService.getAllMessages(B)).map((m) => m.text).sort()).toEqual([
        'B-PRIVATE-CUSTOM',
        'BUNDLED-DAILY',
      ]);
      expect((await storageService.getAllMessages(A)).map((m) => m.text).sort()).toEqual([
        'A-PRIVATE-CUSTOM',
        'BUNDLED-DAILY',
      ]);
    });

    it('still loads the daily rows when nobody is signed in, and no custom row', async () => {
      const storageService = await seedSharedDevice();

      // Signing out must not blank Home — the bundled messages are shared —
      // but it must not leave anyone's custom rows in the pool either.
      expect((await storageService.getAllMessages(null)).map((m) => m.text)).toEqual([
        'BUNDLED-DAILY',
      ]);
    });

    it('excludes the legacy unowned row from every caller', async () => {
      const storageService = await seedSharedDevice();

      for (const caller of [A, B, null]) {
        const pool = await storageService.getAllMessages(caller);
        expect(pool.map((m) => m.text)).not.toContain('LEGACY-OWNERLESS');
      }
      // …and it is still on disk: hidden, not deleted, not claimed.
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        expect((await db.getAll('messages')).map((m) => m.text)).toContain('LEGACY-OWNERLESS');
      } finally {
        db.close();
      }
    });

    it('scopes getMessagesByCategory the same way', async () => {
      const storageService = await seedSharedDevice();

      // This read goes through the by-category index rather than getAll, which
      // is a separate path to the same rows.
      expect((await storageService.getMessagesByCategory('custom', B)).map((m) => m.text)).toEqual([
        'B-PRIVATE-CUSTOM',
      ]);
      expect(await storageService.getMessagesByCategory('custom', null)).toEqual([]);
      expect((await storageService.getMessagesByCategory('reason', A)).map((m) => m.text)).toEqual([
        'BUNDLED-DAILY',
      ]);
    });
  });

  describe('upgrading an existing database', () => {
    /**
     * Seed a database at `version` with the stores a profile of that vintage
     * would have, so that opening at DB_VERSION genuinely runs `upgradeDb` with
     * a non-zero `oldVersion`.
     *
     * Without this every test in this file created the database from scratch,
     * where `oldVersion` is 0 and the version-gated branches cannot be observed
     * at all.
     */
    async function seedLegacy(version: number, photosKeyPath: string): Promise<void> {
      const db = await openDB(DB_NAME, version, {
        upgrade(database) {
          database.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          database.createObjectStore('photos', { keyPath: photosKeyPath, autoIncrement: true });
          // Pre-v7 moods: unique on `date` ALONE. This is the index the branch
          // exists to replace, and without seeding it here the v7 migration
          // branch is never reached with a non-zero oldVersion through
          // storageService — which is the open that wins the race on a real
          // profile.
          const moods = database.createObjectStore('moods', {
            keyPath: 'id',
            autoIncrement: true,
          });
          moods.createIndex('by-date', 'date', { unique: true });
        },
      });
      const tx = db.transaction(['messages', 'photos', 'moods'], 'readwrite');
      await tx.objectStore('messages').add({ text: 'keep me' });
      await tx.objectStore('photos').add({ caption: 'a photo' });
      await tx.objectStore('moods').add({ userId: 'user-A', date: '2026-08-01', synced: true });
      await tx.done;
      db.close();
    }

    it('[from v1] drops the incompatible photos store, as designed', async () => {
      // The v1 photos store used a different shape, so the upgrade is
      // deliberately destructive for it. This is the assertion that pins the
      // branch `if (oldVersion < 2 && db.objectStoreNames.contains('photos'))`
      // as still firing — deleting that line leaves this failing.
      await seedLegacy(1, 'localId');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        expect(await db.getAll('photos')).toHaveLength(0);
        // Everything else is additive, so the message survives the same upgrade.
        expect(await db.getAll('messages')).toHaveLength(1);
      } finally {
        db.close();
      }
    });

    it('[from v5] migrates the moods index to by-user-date', async () => {
      // The branch's headline migration, reached through storageService rather
      // than by calling upgradeDb directly — storage.ts has to thread the
      // versionchange transaction through for this to happen at all, and
      // dropping that argument silently skips the whole branch.
      await seedLegacy(5, 'id');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        const tx = db.transaction('moods', 'readonly');
        const indexNames = Array.from(tx.store.indexNames);
        await tx.done;

        expect(indexNames).toContain('by-user-date');
        // Unique on the date alone collided across accounts: on a shared
        // device the second partner to log a mood that day was rejected.
        expect(indexNames).not.toContain('by-date');
        // And the seeded row survived the index swap.
        expect(await db.getAll('moods')).toHaveLength(1);
      } finally {
        db.close();
      }
    });

    it('[from v5] adds the messages by-user index without dropping rows', async () => {
      // `seedLegacy` builds `messages` the way a pre-v8 profile has it: no
      // owner index. Reached through storageService rather than by calling
      // upgradeDb directly, because storage.ts has to thread the versionchange
      // transaction through for the existing-store branch to run at all.
      await seedLegacy(5, 'id');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        const tx = db.transaction('messages', 'readonly');
        const indexNames = Array.from(tx.store.indexNames);
        await tx.done;

        expect(indexNames).toContain('by-user');
        expect(await db.getAll('messages')).toHaveLength(1);
      } finally {
        db.close();
      }
    });

    it('[from v2] keeps photos rows — the drop boundary is below v2', async () => {
      // Pins WHERE the boundary sits, not merely that it exists. v2 already
      // holds the modern photos schema, so widening the gate to `oldVersion < 3`
      // would start destroying good rows, and the v1/v5 cases alone cannot see
      // that.
      await seedLegacy(2, 'id');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        expect(await db.getAll('photos')).toHaveLength(1);
      } finally {
        db.close();
      }
    });

    it('[from v5] keeps photos rows, because the drop is version-gated', async () => {
      // This is the case the repair path must not damage: a healthy modern
      // database that merely needs the missing stores added. Ungating the drop
      // — `contains('photos')` alone — leaves this failing.
      await seedLegacy(5, 'id');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        expect(await db.getAll('photos')).toHaveLength(1);
        expect(await db.getAll('messages')).toHaveLength(1);
        // And the repair still happened: the stores that were missing exist.
        for (const store of ALL_STORES) {
          expect(db.objectStoreNames.contains(store)).toBe(true);
        }
      } finally {
        db.close();
      }
    });
  });
});
