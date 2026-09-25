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
import type { MyLoveDBSchema, StoredMessageData } from '../../../src/services/dbSchema';
import { projectMessageFavorites } from '../../../src/services/messageFavorites';
import type { Message } from '../../../src/types';

// The server half of custom messages and favorites; these tests drive
// toggleFavorite, which writes the server before it changes the copy.
vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: (await import('../helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
}));
vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: (await import('../helpers/fakeAccountDataApis')).fakeMessageFavoritesApi,
}));

type FakeCustom = typeof import('../helpers/fakeAccountDataApis').fakeCustomMessagesApi;
type FakeFavorites = typeof import('../helpers/fakeAccountDataApis').fakeMessageFavoritesApi;

const ALL_STORES = [
  'messages',
  'moods',
  'sw-auth',
  'local-copies',
  'image-cache',
  'note-queue',
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

  it('leaves a messages store for the bundled rows alone, with no owner index', async () => {
    // v15: custom messages live in each account's message-data local copy, so
    // the store needs no `by-user` index and the favorites store is gone.
    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      const store = db.transaction('messages', 'readonly').objectStore('messages');
      expect(Array.from(store.indexNames).sort()).toEqual(['by-category', 'by-date']);
      expect(unwrap(db).objectStoreNames.contains('message-favorites')).toBe(false);
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

  /** A v8 profile: the owner index, no favorites store, legacy flags on rows. */
  async function seedV8(): Promise<Message[]> {
    const legacy = await openDB<MyLoveDBSchema>(DB_NAME, 8, {
      upgrade(db) {
        const messages = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        messages.createIndex('by-category', 'category');
        messages.createIndex('by-date', 'createdAt');
        (messages as unknown as IDBObjectStore).createIndex('by-user', 'userId');
        db.createObjectStore('sw-auth', { keyPath: 'id' });
      },
    });
    const raw: Message[] = [
      { id: 1, text: 'daily', category: 'reason', isCustom: false, isFavorite: true, createdAt: new Date() },
      { id: 2, text: 'owned', category: 'custom', isCustom: true, userId: 'owner-a', serverId: 'server-owned', isFavorite: true, createdAt: new Date() },
      { id: 3, text: 'ownerless', category: 'custom', isCustom: true, isFavorite: true, createdAt: new Date() },
    ];
    for (const row of raw) await legacy.put('messages', row);
    await legacy.put('sw-auth', {
      id: 'current',
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      userId: 'owner-a',
    });
    legacy.close();
    return raw;
  }

  it.each(['storage', 'mood', 'worker'] as const)('migrates v8 once when %s opens first', async (opener) => {
    const raw = await seedV8();
    vi.resetModules();
    if (opener === 'worker') {
      await (await import('../../../src/sw-db')).getPendingMoods('owner-a');
    }
    const first = opener === 'storage' || opener === 'worker'
      ? (await import('../../../src/services/storage')).storageService
      : (await import('../../../src/services/moodService')).moodService;
    openServices.push(first as unknown as { db: IDBPDatabase<MyLoveDBSchema> | null });
    await first.init();
    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      // The bundled row is untouched, legacy flag and all; the custom rows go.
      expect(await db.getAll('messages')).toEqual([raw[0]]);
      expect(unwrap(db).objectStoreNames.contains('message-favorites')).toBe(false);
      // The signed-in account's own row moved with its id and its legacy flag;
      // the ownerless row and the bundled row's flag name no account.
      const copy = (await db.get('local-copies', ['owner-a', 'message-data']))?.value as StoredMessageData;
      expect(copy.custom.map((row) => [row.id, row.text, row.isFavorite])).toEqual([[2, 'owned', true]]);
      expect(copy.bundledFavoriteIds).toEqual([]);
      const service = await freshStorageService();
      expect(
        projectMessageFavorites(await service.getAllMessages(), copy).map((row) => [row.id, row.isFavorite])
      ).toEqual([[1, false], [2, true]]);
    } finally { db.close(); }
  });

  it('migrates v8 when the worker open runs without window', async () => {
    await seedV8();

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

    // The worker has no localStorage; the sw-auth token names the account.
    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      const copy = (await db.get('local-copies', ['owner-a', 'message-data']))?.value as StoredMessageData;
      expect(copy.custom.map((row) => row.id)).toEqual([2]);
      expect(unwrap(db).objectStoreNames.contains('message-favorites')).toBe(false);
    } finally {
      db.close();
    }
  });

  describe('the messages store serves the bundled rows only', () => {
    const A = '00000000-0000-4000-8000-00000000000a';

    /** Bundled rows, plus a custom row written straight to disk as a stray. */
    async function seedStore() {
      const storageService = await freshStorageService();
      await storageService.init();
      const dailyId = await storageService.addMessage({
        text: 'BUNDLED-DAILY',
        category: 'reason',
        isCustom: false,
        isFavorite: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const strayId = await storageService.addMessage({
        text: 'STRAY-CUSTOM',
        category: 'custom',
        isCustom: true,
        userId: A,
        serverId: 'server-a',
        createdAt: new Date('2026-08-03T06:00:00.000Z'),
      });
      return { storageService, dailyId, strayId };
    }

    it('never hands out a custom row, through any read', async () => {
      const { storageService, dailyId, strayId } = await seedStore();

      expect((await storageService.getAllMessages()).map((m) => m.text)).toEqual(['BUNDLED-DAILY']);
      expect((await storageService.getMessagesByCategory('custom')).map((m) => m.text)).toEqual([]);
      expect((await storageService.getMessagesByCategory('reason')).map((m) => m.text)).toEqual([
        'BUNDLED-DAILY',
      ]);
      expect(await storageService.getMessage(strayId)).toBeUndefined();
      expect(await storageService.getMessage(dailyId)).toMatchObject({ text: 'BUNDLED-DAILY' });
    });

    it('still degrades a failed read to undefined', async () => {
      const { storageService, dailyId } = await seedStore();
      const holder = storageService as unknown as { db: IDBPDatabase<MyLoveDBSchema> };
      const real = holder.db;
      holder.db = {
        get: () => Promise.reject(new Error('IndexedDB is unavailable')),
        close: () => real.close(),
      } as unknown as IDBPDatabase<MyLoveDBSchema>;

      expect(await storageService.getMessage(dailyId)).toBeUndefined();
    });
  });

  describe('toggleFavorite writes the server, then returns the changed copy', () => {
    const A = '00000000-0000-4000-8000-00000000000a';
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const bundled: Message = { id: 3, text: 'BUNDLED-DAILY', category: 'reason', isCustom: false, createdAt };
    const custom: Message = {
      id: 400,
      text: 'A-CUSTOM',
      category: 'custom',
      isCustom: true,
      userId: A,
      serverId: 'server-a',
      isFavorite: false,
      createdAt,
    };
    const copy = (): StoredMessageData => ({ custom: [custom], bundledFavoriteIds: [], nextCustomId: 401 });

    /**
     * The storage module and the two API fakes it was built with, read from the
     * same module registry — `freshStorageService` resets the registry, and the
     * mocked API modules are the only handle on the fakes that module holds.
     */
    async function build() {
      const service = await freshStorageService();
      const fakeCustomMessagesApi = (await import('../../../src/services/customMessagesApi'))
        .customMessagesApi as unknown as FakeCustom;
      const fakeMessageFavoritesApi = (await import('../../../src/services/messageFavoritesApi'))
        .messageFavoritesApi as unknown as FakeFavorites;
      for (const fn of [
        fakeCustomMessagesApi.updateCustomMessage,
        fakeMessageFavoritesApi.addFavorite,
        fakeMessageFavoritesApi.removeFavorite,
      ]) {
        fn.mockClear();
      }
      return { service, fakeCustomMessagesApi, fakeMessageFavoritesApi };
    }

    it('toggles a bundled favorite by its text key, on then off', async () => {
      const { service, fakeMessageFavoritesApi } = await build();
      const { bundledMessageKey } = await import('../../../src/services/messageFavoritesApi');

      const on = await service.toggleFavorite(A, bundled, copy());
      expect(on.isFavorite).toBe(true);
      expect(on.copy.bundledFavoriteIds).toEqual([3]);
      expect(fakeMessageFavoritesApi.addFavorite).toHaveBeenCalledWith(A, await bundledMessageKey('BUNDLED-DAILY'));

      const off = await service.toggleFavorite(A, bundled, on.copy);
      expect(off.isFavorite).toBe(false);
      expect(off.copy.bundledFavoriteIds).toEqual([]);
      expect(fakeMessageFavoritesApi.removeFavorite).toHaveBeenCalledTimes(1);
    });

    it('toggles a custom favorite on its server row', async () => {
      const { service, fakeCustomMessagesApi } = await build();

      const on = await service.toggleFavorite(A, custom, copy());
      expect(on.isFavorite).toBe(true);
      expect(on.copy.custom[0]).toMatchObject({ id: 400, isFavorite: true });
      expect(fakeCustomMessagesApi.updateCustomMessage).toHaveBeenCalledWith('server-a', { isFavorite: true });
    });

    it('refuses a signed-out or unsynced toggle before anything is sent', async () => {
      const { service, fakeCustomMessagesApi, fakeMessageFavoritesApi } = await build();

      await expect(service.toggleFavorite(null, bundled, copy())).rejects.toThrow(/signed-in/);
      await expect(
        service.toggleFavorite(A, { ...custom, serverId: undefined }, copy())
      ).rejects.toMatchObject({ code: 'not-synced' });
      expect(fakeCustomMessagesApi.updateCustomMessage).not.toHaveBeenCalled();
      expect(fakeMessageFavoritesApi.addFavorite).not.toHaveBeenCalled();
    });

    it('leaves the copy it was given unchanged when the server refuses', async () => {
      const { service, fakeMessageFavoritesApi } = await build();
      fakeMessageFavoritesApi.addFavorite.mockRejectedValueOnce(new Error('offline'));
      const before = copy();

      await expect(service.toggleFavorite(A, bundled, before)).rejects.toThrow('offline');
      expect(before).toEqual(copy());
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

    it('[from v5] keeps the messages rows and adds no owner index', async () => {
      // `seedLegacy` builds `messages` the way a pre-v8 profile has it: no
      // owner index. Since v15 none is added — custom rows live in the
      // message-data local copy.
      await seedLegacy(5, 'id');

      const storageService = await freshStorageService();
      await storageService.init();

      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
      try {
        const tx = db.transaction('messages', 'readonly');
        const indexNames = Array.from(tx.store.indexNames);
        await tx.done;

        expect(indexNames).not.toContain('by-user');
        expect(await db.getAll('messages')).toHaveLength(1);
      } finally {
        db.close();
      }
    });
  });
});
