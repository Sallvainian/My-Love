/**
 * storageService IndexedDB schema — the open-race and repair paths
 *
 * `storage.ts` used to hand-write its own upgrade callback that created only
 * `messages` and the since-dropped `photos`, on the assumption that whichever service owned a
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
import { openDB, unwrap, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import type { Message } from '../../../src/types';

// The server half of custom messages and favorites; these tests drive the
// IndexedDB mirror, which is written only after the server accepted a write.
vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: (await import('../helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
}));
vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: (await import('../helpers/fakeAccountDataApis')).fakeMessageFavoritesApi,
}));

const ALL_STORES = [
  'messages',
  'message-favorites',
  'moods',
  'sw-auth',
  'local-copies',
  'image-cache',
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

      // No longer in MyLoveDBSchema (dropped at v11), so created untyped.
      const photos = unwrap(db).createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
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

    expect(await reopened.getMessage(messageId, null)).toMatchObject({ text: 'keep me' });
  });

  it.each(['storage', 'mood', 'custom', 'worker'] as const)('migrates v8 once when %s opens first, preserving raw rows', async (opener) => {
    const legacy = await openDB<MyLoveDBSchema>(DB_NAME, 8, {
      upgrade(db) {
        const messages = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messages.createIndex('by-category', 'category');
        messages.createIndex('by-date', 'createdAt');
        messages.createIndex('by-user', 'userId');
      },
    });
    const raw: Message[] = [
      { id: 1, text: 'daily', category: 'reason', isCustom: false, isFavorite: true, createdAt: new Date() },
      { id: 2, text: 'owned', category: 'custom', isCustom: true, userId: 'owner-a', serverId: 'server-owned', isFavorite: true, createdAt: new Date() },
      { id: 3, text: 'ownerless', category: 'custom', isCustom: true, isFavorite: true, createdAt: new Date() },
    ];
    for (const row of raw) await legacy.put('messages', row);
    legacy.close();
    vi.resetModules();
    if (opener === 'worker') {
      await (await import('../../../src/sw-db')).getPendingMoods('owner-a');
    }
    const first = opener === 'storage' || opener === 'worker'
      ? (await import('../../../src/services/storage')).storageService
      : opener === 'mood'
        ? (await import('../../../src/services/moodService')).moodService
        : (await import('../../../src/services/customMessageService')).customMessageService;
    openServices.push(first as unknown as { db: IDBPDatabase<MyLoveDBSchema> | null });
    await first.init();
    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      expect(await db.getAll('messages')).toEqual(raw);
      expect(await db.getAll('message-favorites')).toEqual([{ messageId: 2, userId: 'owner-a' }]);
      expect(db.transaction('message-favorites').store.indexNames.contains('by-user')).toBe(true);
      const service = await freshStorageService();
      expect((await service.getAllMessages('owner-a')).map((row) => [row.id, row.isFavorite])).toEqual([[1, false], [2, true]]);
      expect(await service.toggleFavorite(2, 'owner-a')).toBe(false);
      const reopened = await freshStorageService();
      expect(await reopened.getMessage(2, 'owner-a')).toMatchObject({ isFavorite: false });
      expect(await db.getAll('messages')).toEqual(raw);
    } finally { db.close(); }
  });

  it('migrates v8 when the worker open runs without window', async () => {
    const legacy = await openDB<MyLoveDBSchema>(DB_NAME, 8, {
      upgrade(db) {
        const messages = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messages.createIndex('by-category', 'category');
        messages.createIndex('by-date', 'createdAt');
        messages.createIndex('by-user', 'userId');
      },
    });
    const raw: Message[] = [
      { id: 1, text: 'daily', category: 'reason', isCustom: false, isFavorite: true, createdAt: new Date() },
      { id: 2, text: 'owned', category: 'custom', isCustom: true, userId: 'owner-a', serverId: 'server-owned', isFavorite: true, createdAt: new Date() },
      { id: 3, text: 'ownerless', category: 'custom', isCustom: true, isFavorite: true, createdAt: new Date() },
    ];
    for (const row of raw) await legacy.put('messages', row);
    legacy.close();

    const windowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      vi.resetModules();
      await (await import('../../../src/sw-db')).getPendingMoods('owner-a');
    } finally {
      if (windowDesc) {
        Object.defineProperty(globalThis, 'window', windowDesc);
      }
    }

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      expect(await db.getAll('message-favorites')).toEqual([{ messageId: 2, userId: 'owner-a' }]);
    } finally {
      db.close();
    }
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
        serverId: 'server-a',
        isFavorite: false,
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      await storageService.addMessage({
        text: 'B-PRIVATE-CUSTOM',
        category: 'custom',
        isCustom: true,
        userId: B,
        serverId: 'server-b',
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

    describe('reads and writes by id are scoped the same way', () => {
      /**
       * `getMessage`, `updateMessage`, `deleteMessage` and `toggleFavorite`
       * reached any row in the shared store by id with no owner check, while
       * their batch siblings above already filtered. Every case here drives the
       * real service against the same seeded shared device and confirms what is
       * actually ON DISK afterwards — a denied write that merely returns early
       * and a denied write that writes anyway are indistinguishable from the
       * caller's side, so the store is the only honest witness.
       *
       * Favorites require a signed-in caller who can see the row. Generic
       * updates/deletes require ownership of a custom row and reject denial.
       */

      /** Every row as it actually sits on disk, bypassing the service's filter. */
      async function rowsOnDisk(): Promise<Message[]> {
        const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
        try {
          return await db.getAll('messages');
        } finally {
          db.close();
        }
      }

      /** The row with this text as it sits on disk, or undefined once it is gone. */
      async function diskRow(text: string): Promise<Message | undefined> {
        return (await rowsOnDisk()).find((message) => message.text === text);
      }

      /** The row at this id as it sits on disk — the retargeting cases move text around. */
      async function rowAt(id: number): Promise<Message | undefined> {
        return (await rowsOnDisk()).find((message) => message.id === id);
      }

      /** The id of a seeded row, read off disk so a test can name a row it may not see. */
      async function idOf(text: string): Promise<number> {
        const row = await diskRow(text);
        if (!row) throw new Error(`seed row not found on disk: ${text}`);
        return row.id;
      }

      /**
       * Swap the service's cached connection for one whose reads or writes fail.
       *
       * The split under test is the service's existing error contract — reads
       * degrade to `undefined`, writes re-throw — and it only shows when the
       * READ succeeds and the write does not, which a wholesale outage cannot
       * produce. `close` forwards to the real connection so afterEach still
       * releases it; `init()` sees a non-null `db` and leaves the stub alone.
       *
       * The transaction proxy injects read or write failures independently,
       * while forwarding unmodified operations to the real IndexedDB store.
       */
      function breakStore(service: unknown, broken: { reads?: boolean; writes?: boolean }): void {
        const holder = service as { db: IDBPDatabase<MyLoveDBSchema> };
        const real = holder.db;
        const fail = () => Promise.reject(new Error('IndexedDB is unavailable'));
        holder.db = {
          get: (store: 'messages', key: number) => (broken.reads ? fail() : real.get(store, key)),
          getAll: (store: 'messages') => (broken.reads ? fail() : real.getAll(store)),
          put: (store: 'messages', value: Message) =>
            broken.writes ? fail() : real.put(store, value),
          delete: (store: 'messages', key: number) =>
            broken.writes ? fail() : real.delete(store, key),
          transaction: (...args: Parameters<typeof real.transaction>) => {
            const tx = real.transaction(...args);
            const wrap = (store: object) => new Proxy(store, {
              get(target, key) {
                if ((broken.reads && ['get', 'getAll'].includes(String(key))) ||
                    (broken.writes && ['put', 'delete'].includes(String(key)))) return fail;
                const value = Reflect.get(target, key);
                return typeof value === 'function' ? value.bind(target) : value;
              },
            });
            return new Proxy(tx, {
              get(target, key) {
                if (key === 'store') return wrap(target.store!);
                if (key === 'objectStore') return (name: never) => wrap(target.objectStore(name));
                const value = Reflect.get(target, key);
                return typeof value === 'function' ? value.bind(target) : value;
              },
            });
          },
          close: () => real.close(),
        } as unknown as IDBPDatabase<MyLoveDBSchema>;
      }

      it('hides a null-owner legacy custom row from signed-out reads', async () => {
        const service = await seedSharedDevice();
        const id = await service.addMessage({
          text: 'NULL-OWNER', category: 'custom', isCustom: true,
          userId: null, createdAt: new Date(),
        } as unknown as Omit<Message, 'id'>);
        expect(await service.getMessage(id, null)).toBeUndefined();
        expect((await service.getAllMessages(null)).some((row) => row.id === id)).toBe(false);
        expect(await rowAt(id)).toBeDefined();
      });

      it('hands the owner their own custom row', async () => {
        const storageService = await seedSharedDevice();

        expect(await storageService.getMessage(await idOf('A-PRIVATE-CUSTOM'), A)).toMatchObject({
          text: 'A-PRIVATE-CUSTOM',
        });
      });

      it('answers a cross-account read exactly as it answers a missing id', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        // Identical answers: nothing tells B that this id is taken. Message ids
        // are small sequential integers, so a distinguishable "exists but
        // hidden" would be an enumeration oracle over A's private rows.
        expect(await storageService.getMessage(aId, B)).toBeUndefined();
        expect(await storageService.getMessage(999_999, B)).toBeUndefined();
      });

      it('leaves the shared daily row readable by every caller, signed out included', async () => {
        const storageService = await seedSharedDevice();
        const dailyId = await idOf('BUNDLED-DAILY');

        expect(await storageService.getMessage(dailyId, B)).toMatchObject({
          text: 'BUNDLED-DAILY',
        });
        expect(await storageService.getMessage(dailyId, null)).toMatchObject({
          text: 'BUNDLED-DAILY',
        });
      });

      it('hides the legacy unowned row from every caller', async () => {
        const storageService = await seedSharedDevice();
        const legacyId = await idOf('LEGACY-OWNERLESS');

        for (const caller of [A, B, null]) {
          expect(await storageService.getMessage(legacyId, caller)).toBeUndefined();
        }
        // Hidden, not deleted and not claimed.
        expect(await diskRow('LEGACY-OWNERLESS')).toBeDefined();
      });

      it('refuses every write against the legacy unowned row', async () => {
        const storageService = await seedSharedDevice();
        const legacyId = await idOf('LEGACY-OWNERLESS');

        // The only row excluded by `undefined !== null` rather than by two ids
        // differing, so the signed-out caller is the case that actually
        // exercises it — and it was asserted on the read path alone.
        await expect(
          storageService.updateMessage(legacyId, { text: 'CLAIMED' }, null)
        ).rejects.toThrow();
        await expect(storageService.toggleFavorite(legacyId, null)).rejects.toThrow();
        await expect(storageService.deleteMessage(legacyId, null)).rejects.toThrow();

        expect(await rowAt(legacyId)).toMatchObject({
          text: 'LEGACY-OWNERLESS',
          isFavorite: false,
        });
      });

      it('refuses a cross-account update by throwing without writing', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await expect(
          storageService.updateMessage(aId, { text: 'B-OVERWROTE-IT' }, B)
        ).rejects.toThrow();

        expect((await rowsOnDisk()).map((message) => message.text)).not.toContain('B-OVERWROTE-IT');
        expect(await diskRow('A-PRIVATE-CUSTOM')).toBeDefined();
      });

      it('pins the write to the row it checked, not to an id inside the updates', async () => {
        const storageService = await seedSharedDevice();
        const dailyId = await idOf('BUNDLED-DAILY');
        const aId = await idOf('A-PRIVATE-CUSTOM');

        // The store is keyed on `id`, so `updates.id` is a second address for
        // the write. B may see the shared daily row and may not see A's — so
        // an unpinned put walks straight past the guard using a row it is
        // allowed to name.
        await expect(storageService.updateMessage(dailyId, { id: aId, text: 'B-OVERWROTE-IT' }, B)).rejects.toThrow('protected');

        expect(await rowAt(aId)).toMatchObject({ text: 'A-PRIVATE-CUSTOM' });
        // Protected-field rejection leaves both source and target untouched.
        expect(await rowAt(dailyId)).toMatchObject({ text: 'BUNDLED-DAILY' });
      });

      it('applies the owner’s own update', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await storageService.updateMessage(aId, { text: 'A-EDITED' }, A);

        expect(await diskRow('A-EDITED')).toBeDefined();
        expect(await diskRow('A-PRIVATE-CUSTOM')).toBeUndefined();
      });

      it('refuses a cross-account delete by throwing and leaves the row on disk', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await expect(storageService.deleteMessage(aId, B)).rejects.toThrow();

        expect(await diskRow('A-PRIVATE-CUSTOM')).toBeDefined();
      });

      it('applies the owner’s own delete', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await storageService.deleteMessage(aId, A);

        expect(await diskRow('A-PRIVATE-CUSTOM')).toBeUndefined();
        // Only that row: a delete must not take the shared rotation with it.
        expect(await diskRow('BUNDLED-DAILY')).toBeDefined();
      });

      it('refuses a cross-account favorite and leaves the flag as it was', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await expect(storageService.toggleFavorite(aId, B)).rejects.toThrow();

        expect(await diskRow('A-PRIVATE-CUSTOM')).toMatchObject({ isFavorite: false });
      });

      it('applies the owner’s own favorite', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');

        await storageService.toggleFavorite(aId, A);

        expect(await storageService.getMessage(aId, A)).toMatchObject({ isFavorite: true });
        expect(await diskRow('A-PRIVATE-CUSTOM')).toMatchObject({ isFavorite: false });
      });

      it('partitions shared daily favorites across accounts and refuses signed-out writes', async () => {
        const service = await seedSharedDevice();
        const id = await idOf('BUNDLED-DAILY');
        expect(await service.toggleFavorite(id, A)).toBe(true);
        expect(await service.getMessage(id, A)).toMatchObject({ isFavorite: true });
        expect(await service.getMessage(id, B)).toMatchObject({ isFavorite: false });
        expect(await service.getMessage(id, null)).toMatchObject({ isFavorite: false });
        await expect(service.toggleFavorite(id, null)).rejects.toThrow();
        const reopened = await freshStorageService();
        expect(await reopened.getMessage(id, A)).toMatchObject({ isFavorite: true });
        expect((await reopened.getMessagesByCategory('reason', A))[0].isFavorite).toBe(true);
        expect((await reopened.getAllMessages(B)).every((row) => !row.isFavorite)).toBe(true);
        expect(await rowAt(id)).toMatchObject({ isFavorite: false });
      });

      it('serializes concurrent toggles and returns each committed value', async () => {
        const service = await seedSharedDevice();
        const id = await idOf('BUNDLED-DAILY');
        expect(await Promise.all([service.toggleFavorite(id, A), service.toggleFavorite(id, A)])).toEqual([true, false]);
        expect(await service.getMessage(id, A)).toMatchObject({ isFavorite: false });
      });

      it('refuses shared and missing generic writes and every protected update', async () => {
        const service = await seedSharedDevice();
        const daily = await idOf('BUNDLED-DAILY');
        const own = await idOf('A-PRIVATE-CUSTOM');
        const before = await rowsOnDisk();
        for (const id of [daily, 999999]) {
          await expect(service.updateMessage(id, { text: 'changed' }, A)).rejects.toThrow();
          await expect(service.deleteMessage(id, A)).rejects.toThrow();
        }
        for (const updates of [{ userId: B }, { isCustom: false }, { id: daily }, { createdAt: new Date() }, { isFavorite: true }]) {
          await expect(service.updateMessage(own, updates, A)).rejects.toThrow('protected');
        }
        expect(await rowsOnDisk()).toEqual(before);
      });

      it('surfaces a real aborted transaction without changing favorites', async () => {
        const service = await seedSharedDevice();
        const id = await idOf('BUNDLED-DAILY');
        const holder = service as unknown as { db: IDBPDatabase<MyLoveDBSchema> };
        const native = unwrap(holder.db);
        const original = native.transaction.bind(native);
        const transaction = vi.spyOn(native, 'transaction').mockImplementationOnce((...args) => {
          const tx = original(...args);
          tx.abort();
          return tx;
        });
        await expect(service.toggleFavorite(id, A)).rejects.toThrow();
        transaction.mockRestore();
        expect(await service.getMessage(id, A)).toMatchObject({ isFavorite: false });
      });

      it('still degrades a failed read to undefined', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');
        breakStore(storageService, { reads: true });

        expect(await storageService.getMessage(aId, A)).toBeUndefined();
      });

      it('re-throws when the ownership read before a delete fails', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');
        breakStore(storageService, { reads: true });

        // deleteMessage reads raw rather than through getMessage exactly so a
        // broken store cannot present itself as "not found" and swallow the
        // delete. Routing it through getMessage would resolve silently here.
        await expect(storageService.deleteMessage(aId, A)).rejects.toThrow();
      });

      it('still re-throws a failed write', async () => {
        const storageService = await seedSharedDevice();
        const aId = await idOf('A-PRIVATE-CUSTOM');
        breakStore(storageService, { writes: true });

        await expect(storageService.updateMessage(aId, { text: 'X' }, A)).rejects.toThrow();
        await expect(storageService.deleteMessage(aId, A)).rejects.toThrow();
        await expect(storageService.toggleFavorite(aId, A)).rejects.toThrow();
      });
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

    it.each([1, 2, 5])(
      '[from v%i] drops the photos store and keeps the other rows',
      async (version) => {
        // v11 drops the store for every starting version, existence-gated. The
        // v1 seed uses the incompatible v1 key path the old v2 branch discarded.
        await seedLegacy(version, version === 1 ? 'localId' : 'id');

        const storageService = await freshStorageService();
        await storageService.init();

        const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
        try {
          expect(unwrap(db).objectStoreNames.contains('photos')).toBe(false);
          expect(await db.getAll('messages')).toHaveLength(1);
          expect(await db.getAll('moods')).toHaveLength(1);
          for (const store of ALL_STORES) {
            expect(db.objectStoreNames.contains(store)).toBe(true);
          }
        } finally {
          db.close();
        }
      }
    );

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
  });
});
