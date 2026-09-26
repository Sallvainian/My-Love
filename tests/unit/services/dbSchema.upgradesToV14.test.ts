/**
 * dbSchema Unit Tests — upgrades from v10 to v14
 *
 * Tests for the centralized IndexedDB schema upgrade function, one step at a
 * time from v10 to v14.
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, unwrap } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { deleteDatabase, legacyMessage, legacyMood, swAuthRow } from './dbSchemaFixtures';

describe('dbSchema', () => {
  const openDbs: Array<{ close: () => void }> = [];

  /** Open db and track for automatic cleanup */
  async function openTestDb<T = MyLoveDBSchema>(
    ...args: Parameters<typeof openDB<MyLoveDBSchema>>
  ) {
    const db = await openDB<MyLoveDBSchema>(...args);
    openDbs.push(db);
    return db;
  }

  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(() => {
    // Close all db handles opened during the test
    for (const db of openDbs) {
      db.close();
    }
    openDbs.length = 0;
    vi.restoreAllMocks();
    // The prompt tests stub `confirm` and `location`; a `location` stub left in
    // place makes the next `supabaseClient` import throw `Invalid URL`.
    vi.unstubAllGlobals();
    document.querySelector('[role="dialog"]')?.remove();
  });

  describe('upgrade from v10 to v11', () => {
    /** v10's shape: the five survivors of the scripture drop, photos among them. */
    async function seedV10({ withPhotos }: { withPhotos: boolean }): Promise<void> {
      const db = await openDB(DB_NAME, 10, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');

          database
            .createObjectStore('message-favorites', { keyPath: ['messageId', 'userId'] })
            .createIndex('by-user', 'userId');

          if (withPhotos) {
            database
              .createObjectStore('photos', { keyPath: 'id', autoIncrement: true })
              .createIndex('by-date', 'uploadDate', { unique: false });
          }

          database
            .createObjectStore('moods', { keyPath: 'id', autoIncrement: true })
            .createIndex('by-user-date', ['userId', 'date'], { unique: true });

          database.createObjectStore('sw-auth', { keyPath: 'id' });
        },
      });

      const stores = ['messages', 'message-favorites', 'moods', 'sw-auth'];
      const tx = db.transaction(withPhotos ? [...stores, 'photos'] : stores, 'readwrite');
      await tx.objectStore('messages').add(legacyMessage('WRITTEN-AT-V10'));
      await tx.objectStore('message-favorites').add({ messageId: 1, userId: 'USER-A' });
      if (withPhotos) await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V10' });
      await tx.objectStore('moods').add(legacyMood('MOOD-AT-V10'));
      await tx.objectStore('sw-auth').add(swAuthRow('TOKEN-AT-V10'));
      await tx.done;
      db.close();
    }

    it('drops the photos store and keeps every other row', async () => {
      await seedV10({ withPhotos: true });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(Array.from(unwrap(db).objectStoreNames)).not.toContain('photos');
      // Three survivors (message-favorites goes at v15) plus v12's local-copies,
      // v13's image-cache and v14's note-queue.
      expect(db.objectStoreNames.length).toBe(6);
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V10' });
      expect((await db.get('local-copies', ['USER-A', 'message-data']))?.value).toMatchObject({
        bundledFavoriteIds: [1],
      });
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V10' });
      expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V10' });
    });

    it('is a no-op for a profile that has no photos store', async () => {
      // Existence-gated, not version-gated: deleting a store that is absent
      // throws NotFoundError and would abort the whole upgrade.
      await seedV10({ withPhotos: false });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V10' });
    });
  });

  describe('upgrade from v11 to v12', () => {
    async function seedV11(): Promise<void> {
      const db = await openDB(DB_NAME, 11, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');
          database
            .createObjectStore('message-favorites', { keyPath: ['messageId', 'userId'] })
            .createIndex('by-user', 'userId');
          database
            .createObjectStore('moods', { keyPath: 'id', autoIncrement: true })
            .createIndex('by-user-date', ['userId', 'date'], { unique: true });
          database.createObjectStore('sw-auth', { keyPath: 'id' });
        },
      });
      await db.add('moods', legacyMood('MOOD-AT-V11', { synced: false }));
      db.close();
    }

    it('adds local-copies keyed [userId, kind] with a by-user index, keeping every row', async () => {
      await seedV11();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      const copies = db.transaction('local-copies', 'readonly').objectStore('local-copies');
      expect(Array.from(copies.keyPath as string[])).toEqual(['userId', 'kind']);
      expect(copies.indexNames.contains('by-user')).toBe(true);
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V11' });
    });

    it('keeps an existing local-copies store and its rows', async () => {
      // Existence-gated: a profile that already has the store (created by an
      // earlier build or a partial upgrade) must not throw ConstraintError.
      const seeded = await openDB(DB_NAME, 11, {
        upgrade(database) {
          database
            .createObjectStore('local-copies', { keyPath: ['userId', 'kind'] })
            .createIndex('by-user', 'userId');
        },
      });
      await seeded.put('local-copies', {
        userId: 'USER-A',
        kind: 'partner',
        value: { status: 'unlinked' },
        savedAt: 1,
      });
      seeded.close();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      expect(await db.get('local-copies', ['USER-A', 'partner'])).toMatchObject({
        value: { status: 'unlinked' },
      });
    });
  });

  describe('upgrade from v12 to v13', () => {
    async function seedV12(options: { withImageCache: boolean }): Promise<void> {
      const db = await openDB(DB_NAME, 12, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');
          database
            .createObjectStore('message-favorites', { keyPath: ['messageId', 'userId'] })
            .createIndex('by-user', 'userId');
          database
            .createObjectStore('moods', { keyPath: 'id', autoIncrement: true })
            .createIndex('by-user-date', ['userId', 'date'], { unique: true });
          database.createObjectStore('sw-auth', { keyPath: 'id' });
          database
            .createObjectStore('local-copies', { keyPath: ['userId', 'kind'] })
            .createIndex('by-user', 'userId');
          if (options.withImageCache) {
            // A store that exists without its index: the upgrade adds it.
            database.createObjectStore('image-cache', { keyPath: ['userId', 'path'] });
          }
        },
      });
      await db.put('local-copies', {
        userId: 'USER-A',
        kind: 'love-notes',
        value: [{ id: 'COPY-AT-V12' }],
        savedAt: 1,
      });
      if (options.withImageCache) {
        await db.put('image-cache', {
          userId: 'USER-A',
          path: 'partner/pic.jpg',
          blob: 'IMAGE-AT-V12',
          savedAt: 1,
        });
      }
      db.close();
    }

    it('adds image-cache keyed [userId, path] with a by-user index, keeping every row', async () => {
      await seedV12({ withImageCache: false });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      const images = db.transaction('image-cache', 'readonly').objectStore('image-cache');
      expect(Array.from(images.keyPath as string[])).toEqual(['userId', 'path']);
      expect(images.indexNames.contains('by-user')).toBe(true);
      expect(await db.get('local-copies', ['USER-A', 'love-notes'])).toMatchObject({
        value: [{ id: 'COPY-AT-V12' }],
      });
    });

    it('keeps an existing image-cache store and its rows, adding a missing index', async () => {
      // Existence-gated: a profile that already has the store must not throw
      // ConstraintError, and its rows survive.
      await seedV12({ withImageCache: true });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      const images = db.transaction('image-cache', 'readonly').objectStore('image-cache');
      expect(images.indexNames.contains('by-user')).toBe(true);
      expect(
        (await db.get('image-cache', ['USER-A', 'partner/pic.jpg'])) as unknown
      ).toMatchObject({ blob: 'IMAGE-AT-V12' });
    });
  });

  describe('upgrade from v13 to v14', () => {
    async function seedV13(options: { withNoteQueue: boolean }): Promise<void> {
      const db = await openDB(DB_NAME, 13, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');
          database
            .createObjectStore('message-favorites', { keyPath: ['messageId', 'userId'] })
            .createIndex('by-user', 'userId');
          database
            .createObjectStore('moods', { keyPath: 'id', autoIncrement: true })
            .createIndex('by-user-date', ['userId', 'date'], { unique: true });
          database.createObjectStore('sw-auth', { keyPath: 'id' });
          database
            .createObjectStore('local-copies', { keyPath: ['userId', 'kind'] })
            .createIndex('by-user', 'userId');
          database
            .createObjectStore('image-cache', { keyPath: ['userId', 'path'] })
            .createIndex('by-user', 'userId');
          if (options.withNoteQueue) {
            // A store that exists without its index: the upgrade adds it.
            database.createObjectStore('note-queue', { keyPath: 'id' });
          }
        },
      });
      await db.put('image-cache', {
        userId: 'USER-A',
        path: 'partner/pic.jpg',
        blob: 'IMAGE-AT-V13',
        savedAt: 1,
      });
      if (options.withNoteQueue) {
        await db.put('note-queue', {
          id: 'temp-QUEUED-AT-V13',
          userId: 'USER-A',
          toUserId: 'USER-B',
          content: 'queued before v14',
          createdAt: '2026-09-24T10:00:00.000Z',
          failed: false,
        });
      }
      db.close();
    }

    it('adds note-queue keyed by id with a by-user index, keeping every row', async () => {
      await seedV13({ withNoteQueue: false });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      const queue = db.transaction('note-queue', 'readonly').objectStore('note-queue');
      expect(queue.keyPath).toBe('id');
      expect(queue.indexNames.contains('by-user')).toBe(true);
      expect(
        (await db.get('image-cache', ['USER-A', 'partner/pic.jpg'])) as unknown
      ).toMatchObject({ blob: 'IMAGE-AT-V13' });
    });

    it('keeps an existing note-queue store and its rows, adding a missing index', async () => {
      // Existence-gated: a profile that already has the store must not throw
      // ConstraintError, and its queued notes survive.
      await seedV13({ withNoteQueue: true });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.length).toBe(6);
      const queue = db.transaction('note-queue', 'readonly').objectStore('note-queue');
      expect(queue.indexNames.contains('by-user')).toBe(true);
      expect(await db.getAllFromIndex('note-queue', 'by-user', 'USER-A')).toEqual([
        expect.objectContaining({ id: 'temp-QUEUED-AT-V13', content: 'queued before v14' }),
      ]);
    });
  });
});
