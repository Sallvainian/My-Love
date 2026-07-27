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
    // its index; moodService reads through by-date, so the index is the part
    // that has to survive.
    const storageService = await freshStorageService();
    await storageService.init();

    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION);
    try {
      const store = db.transaction('moods', 'readonly').objectStore('moods');
      expect(store.indexNames.contains('by-date')).toBe(true);
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

  it('does not discard rows already in a healthy database', async () => {
    // The repair path runs on every existing install, so it has to be additive.
    // The v1→v2 photos migration is deliberately destructive; it must stay
    // gated on oldVersion and not fire for a v5 database holding good rows.
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
});
