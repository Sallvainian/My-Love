/**
 * dbSchema Unit Tests
 *
 * Tests for the centralized IndexedDB schema upgrade function.
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see tech-spec-03-test-factories.md (Task 5.1)
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, unwrap } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  openMyLoveDB,
  upgradeDb,
} from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { projectMessageFavorites } from '../../../src/services/messageFavorites';
import { storeAuthToken } from '../../../src/sw-db';
import type { Message } from '../../../src/types';
import { getDailyMessage } from '../../../src/utils/messageRotation';

// Mock import.meta.env.DEV to suppress console logs during tests
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: false,
    },
  },
});

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

  beforeEach(() => {
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    // Close all db handles opened during the test
    for (const db of openDbs) {
      db.close();
    }
    openDbs.length = 0;
    vi.restoreAllMocks();
    document.querySelector('[role="dialog"]')?.remove();
  });

  describe('fresh install (v0 → current)', () => {
    it('should create all stores on fresh install', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      expect(db.objectStoreNames.contains('messages')).toBe(true);
      expect(db.objectStoreNames.contains('moods')).toBe(true);
      expect(db.objectStoreNames.contains('sw-auth')).toBe(true);
      expect(db.objectStoreNames.contains('local-copies')).toBe(true);
      expect(db.objectStoreNames.contains('image-cache')).toBe(true);
      expect(db.objectStoreNames.contains('note-queue')).toBe(true);
      // v11: photos live in Supabase; a fresh profile never gets the store.
      expect(unwrap(db).objectStoreNames.contains('photos')).toBe(false);
      // v15: favorites live in the message-data local copy.
      expect(unwrap(db).objectStoreNames.contains('message-favorites')).toBe(false);
    });

    it('should create exactly 6 stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      expect(db.objectStoreNames.length).toBe(6);
    });
  });

  describe('upgrade from v4 to v5', () => {
    it('keeps an existing messages store and its row without adding a by-user index', async () => {
      // The v4 seed builds `messages` with by-category and by-date only. v8
      // used to add `by-user` here; since v15 custom rows live in the
      // message-data local copy and the index is never created.
      const dbV4 = await openDB(DB_NAME, 4, {
        upgrade(db) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messageStore.createIndex('by-category', 'category');
          messageStore.createIndex('by-date', 'createdAt');
        },
      });
      const seedTx = dbV4.transaction('messages', 'readwrite');
      await seedTx.objectStore('messages').add({
        text: 'written before v8',
        category: 'reason',
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await seedTx.done;
      expect(
        dbV4.transaction('messages', 'readonly').objectStore('messages').indexNames.contains(
          'by-user'
        )
      ).toBe(false);
      dbV4.close();

      const upgraded = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      const store = upgraded.transaction('messages', 'readonly').objectStore('messages');
      expect((store.indexNames as DOMStringList).contains('by-user')).toBe(false);
      // The index it already had is untouched, and so is the row.
      expect(store.indexNames.contains('by-category')).toBe(true);
      expect(await upgraded.getAll('messages')).toHaveLength(1);
    });
  });

  describe('upgrade from v7 to v8', () => {
    /**
     * v7 is a different path through `upgradeDb` from v4 or v5: all eight
     * stores exist, `moods` already carries `by-user-date`, and every v1–v7
     * branch is a no-op.
     */
    async function seedV7(): Promise<void> {
      // Deliberately opened UNTYPED, as `storageSchema.test.ts`'s `seedLegacy`
      // is: this is a legacy shape, not the current schema, and the rows only
      // need the fields each assertion reads back.
      const db = await openDB(DB_NAME, 7, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          // No by-user: that is exactly what v8 adds.

          const photos = database.createObjectStore('photos', {
            keyPath: 'id',
            autoIncrement: true,
          });
          photos.createIndex('by-date', 'uploadDate', { unique: false });

          // v7's shape: compound and unique on the pair, with `by-date` gone.
          const moods = database.createObjectStore('moods', {
            keyPath: 'id',
            autoIncrement: true,
          });
          moods.createIndex('by-user-date', ['userId', 'date'], { unique: true });

          database.createObjectStore('sw-auth', { keyPath: 'id' });

          const sessions = database.createObjectStore('scripture-sessions', { keyPath: 'id' });
          sessions.createIndex('by-user', 'userId');
          for (const name of [
            'scripture-reflections',
            'scripture-bookmarks',
            'scripture-messages',
          ] as const) {
            database.createObjectStore(name, { keyPath: 'id' }).createIndex(
              'by-session',
              'sessionId'
            );
          }
        },
      });

      // A row in every store, so "intact" is measured on data and not merely on
      // the stores still being listed.
      const tx = db.transaction(
        [
          'messages',
          'photos',
          'moods',
          'sw-auth',
          'scripture-sessions',
          'scripture-reflections',
          'scripture-bookmarks',
          'scripture-messages',
        ],
        'readwrite'
      );
      await tx.objectStore('messages').add({
        text: 'WRITTEN-AT-V7',
        category: 'reason',
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V7' });
      await tx.objectStore('moods').add({
        userId: 'USER-A',
        date: '2026-08-01',
        mood: 'happy',
        note: 'MOOD-AT-V7',
        timestamp: new Date('2026-08-01T00:00:00.000Z'),
        synced: true,
      });
      await tx.objectStore('sw-auth').add({
        id: 'current',
        accessToken: 'TOKEN-AT-V7',
        refreshToken: 'r',
        expiresAt: 1,
        userId: 'USER-A',
      });
      await tx.objectStore('scripture-sessions').add({
        id: 'session-v7',
        userId: 'USER-A',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-reflections').add({
        id: 'reflection-v7',
        sessionId: 'session-v7',
        stepIndex: 0,
        userId: 'USER-A',
        notes: 'REFLECTION-AT-V7',
        isShared: false,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-bookmarks').add({
        id: 'bookmark-v7',
        sessionId: 'session-v7',
        stepIndex: 0,
        userId: 'USER-A',
        shareWithPartner: false,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-messages').add({
        id: 'message-v7',
        sessionId: 'session-v7',
        senderId: 'USER-A',
        message: 'PRAYER-AT-V7',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      });
      await tx.done;
      db.close();
    }

    /**
     * Fail loudly on a hang instead of waiting out the runner's own timeout,
     * which reports only "test timed out" and names no operation.
     */
    async function withinTimeout<T>(work: Promise<T>, label: string, ms = 2000): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} never settled (${ms}ms)`)), ms);
      });
      try {
        return await Promise.race([work, guard]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    it('reaches the current schema while every other store keeps its rows', async () => {
      await seedV7();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      // No v8 index: custom rows live in the message-data local copy since v15.
      const messages = db.transaction('messages', 'readonly').objectStore('messages');
      expect((messages.indexNames as DOMStringList).contains('by-user')).toBe(false);
      // …and the indexes it already had are undisturbed.
      expect(messages.indexNames.contains('by-category')).toBe(true);
      expect(messages.indexNames.contains('by-date')).toBe(true);

      // "rows and other stores intact": asserted on CONTENT, store by store. A
      // count check would pass on rows some branch had silently rewritten.
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V7' });
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V7' });
      expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V7' });

      // Six stores (local-copies at v12, image-cache at v13, note-queue at
      // v14; message-favorites is never created since v15);
      // the v7 scripture stores are dropped on the way to v10 and photos on the
      // way to v11. The v7 moods index is untouched — a later branch must not
      // re-run the v7 swap over a store that has already had it.
      expect(db.objectStoreNames.length).toBe(6);
      const remaining = Array.from(unwrap(db).objectStoreNames);
      expect(remaining).not.toContain('photos');
      expect(remaining).not.toContain('scripture-sessions');
      expect(remaining).not.toContain('scripture-reflections');
      expect(remaining).not.toContain('scripture-bookmarks');
      expect(remaining).not.toContain('scripture-messages');
      const moods = db.transaction('moods', 'readonly').objectStore('moods');
      expect(moods.indexNames.contains('by-user-date')).toBe(true);
      expect((moods.indexNames as DOMStringList).contains('by-date')).toBe(false);
    });

    it('upgrades fully even when a service that does not own the messages store wins the upgrade', async () => {
      // IndexedDB runs the upgrade callback of only the ONE open() that
      // performs the version-change transaction; every other concurrent open()
      // just connects. Six modules open this database, and which one gets
      // there first is a race decided by app start-up order — so the store a
      // service "owns" says nothing about which callback migrates it.
      // moodService reaches for `moods` and never touches `messages`, which
      // makes it the right proof.
      await seedV7();

      const { moodService } = await import('../../../src/services/moodService');
      const moodHandle = moodService as unknown as { db: { close: () => void } | null };
      // The singleton caches its connection at module scope and this file
      // deletes the database between tests, so drop the stale handle first.
      moodHandle.db = null;

      await withinTimeout(moodService.init(), 'moodService.init()');
      openDbs.push({ close: () => moodHandle.db?.close() });

      // It resolved rather than blocking, and the v7 row is still there:
      // winning the upgrade is not a reset.
      const afterMood = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      expect(afterMood.objectStoreNames.length).toBe(6);
      expect((await afterMood.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V7' });

      // The service that DOES read the store now connects at the same version,
      // which needs no versionchange transaction at all.
      const { storageService } = await import('../../../src/services/storage');
      const storageHandle = storageService as unknown as { db: { close: () => void } | null };
      storageHandle.db = null;
      await withinTimeout(storageService.init(), 'storageService.init()');
      openDbs.push({ close: () => storageHandle.db?.close() });
      expect((await storageService.getAllMessages()).map((m) => m.text)).toEqual([
        'WRITTEN-AT-V7',
      ]);
    });
  });

  describe('upgrade from v9', () => {
    async function seedV9(): Promise<void> {
      const db = await openDB(DB_NAME, 9, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');

          const favorites = database.createObjectStore('message-favorites', {
            keyPath: ['messageId', 'userId'],
          });
          favorites.createIndex('by-user', 'userId');

          const photos = database.createObjectStore('photos', {
            keyPath: 'id',
            autoIncrement: true,
          });
          photos.createIndex('by-date', 'uploadDate', { unique: false });

          const moods = database.createObjectStore('moods', {
            keyPath: 'id',
            autoIncrement: true,
          });
          moods.createIndex('by-user-date', ['userId', 'date'], { unique: true });

          database.createObjectStore('sw-auth', { keyPath: 'id' });

          const sessions = database.createObjectStore('scripture-sessions', { keyPath: 'id' });
          sessions.createIndex('by-user', 'userId');
          for (const name of [
            'scripture-reflections',
            'scripture-bookmarks',
            'scripture-messages',
          ] as const) {
            database.createObjectStore(name, { keyPath: 'id' }).createIndex('by-session', 'sessionId');
          }
        },
      });

      const tx = db.transaction(
        [
          'messages',
          'message-favorites',
          'photos',
          'moods',
          'sw-auth',
          'scripture-sessions',
          'scripture-reflections',
          'scripture-bookmarks',
          'scripture-messages',
        ],
        'readwrite'
      );
      await tx.objectStore('messages').add({
        text: 'WRITTEN-AT-V9',
        category: 'reason',
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await tx.objectStore('message-favorites').add({ messageId: 1, userId: 'USER-A' });
      await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V9' });
      await tx.objectStore('moods').add({
        userId: 'USER-A',
        date: '2026-09-01',
        mood: 'happy',
        note: 'MOOD-AT-V9',
        timestamp: new Date('2026-09-01T00:00:00.000Z'),
        synced: true,
      });
      await tx.objectStore('sw-auth').add({
        id: 'current',
        accessToken: 'TOKEN-AT-V9',
        refreshToken: 'r',
        expiresAt: 1,
        userId: 'USER-A',
      });
      await tx.objectStore('scripture-sessions').add({
        id: 'session-v9',
        userId: 'USER-A',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-reflections').add({
        id: 'reflection-v9',
        sessionId: 'session-v9',
        stepIndex: 0,
        userId: 'USER-A',
        notes: 'REFLECTION-AT-V9',
        isShared: false,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-bookmarks').add({
        id: 'bookmark-v9',
        sessionId: 'session-v9',
        stepIndex: 0,
        userId: 'USER-A',
        shareWithPartner: false,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      await tx.objectStore('scripture-messages').add({
        id: 'message-v9',
        sessionId: 'session-v9',
        senderId: 'USER-A',
        message: 'PRAYER-AT-V9',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      });
      await tx.done;
      expect(db.objectStoreNames.length).toBe(9);
      db.close();
    }

    it('drops the scripture and photos stores and keeps survivor rows intact', async () => {
      await seedV9();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(db.objectStoreNames.contains('messages')).toBe(true);
      expect(db.objectStoreNames.contains('moods')).toBe(true);
      expect(db.objectStoreNames.contains('sw-auth')).toBe(true);
      expect(db.objectStoreNames.contains('local-copies')).toBe(true);
      expect(db.objectStoreNames.contains('image-cache')).toBe(true);
      expect(db.objectStoreNames.contains('note-queue')).toBe(true);
      expect(db.objectStoreNames.length).toBe(6);

      const remaining = Array.from(unwrap(db).objectStoreNames);
      expect(remaining).not.toContain('message-favorites');
      expect(remaining).not.toContain('photos');
      expect(remaining).not.toContain('scripture-sessions');
      expect(remaining).not.toContain('scripture-reflections');
      expect(remaining).not.toContain('scripture-bookmarks');
      expect(remaining).not.toContain('scripture-messages');

      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V9' });
      // v15: USER-A (the sw-auth account) keeps its favorite of bundled row 1.
      expect((await db.get('local-copies', ['USER-A', 'message-data']))?.value).toMatchObject({
        custom: [],
        bundledFavoriteIds: [1],
      });
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V9' });
      expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V9' });
    });
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
      await tx.objectStore('messages').add({
        text: 'WRITTEN-AT-V10',
        category: 'reason',
        isCustom: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await tx.objectStore('message-favorites').add({ messageId: 1, userId: 'USER-A' });
      if (withPhotos) await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V10' });
      await tx.objectStore('moods').add({
        userId: 'USER-A',
        date: '2026-09-01',
        mood: 'happy',
        note: 'MOOD-AT-V10',
        timestamp: new Date('2026-09-01T00:00:00.000Z'),
        synced: true,
      });
      await tx.objectStore('sw-auth').add({
        id: 'current',
        accessToken: 'TOKEN-AT-V10',
        refreshToken: 'r',
        expiresAt: 1,
        userId: 'USER-A',
      });
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
      await db.add('moods', {
        userId: 'USER-A',
        date: '2026-09-01',
        mood: 'happy',
        note: 'MOOD-AT-V11',
        timestamp: new Date('2026-09-01T00:00:00.000Z'),
        synced: false,
      });
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

  describe('upgrade to v15 (custom messages and favorites onto the local copy)', () => {
    const A = 'USER-A';
    const B = 'USER-B';
    const BUNDLED = ['DAILY-1', 'DAILY-2', 'DAILY-3', 'DAILY-4', 'DAILY-5'];

    type LegacyRow = Record<string, unknown>;

    /**
     * A pre-v15 profile: bundled rows 1-5, then custom rows written by A and B
     * interleaved (ids 6-10) and one legacy unowned custom row (id 11).
     * `version` 14 carries every v9-v14 store; 8 has no message-favorites and
     * relies on the legacy `isFavorite` flag.
     */
    async function seedLegacy(options: {
      version: 8 | 14;
      token: string | null;
      favorites?: Array<{ messageId: number; userId: string }>;
      extraRows?: LegacyRow[];
    }): Promise<void> {
      const db = await openDB(DB_NAME, options.version, {
        upgrade(database) {
          const messages = database.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messages.createIndex('by-category', 'category');
          messages.createIndex('by-date', 'createdAt');
          messages.createIndex('by-user', 'userId');
          database
            .createObjectStore('moods', { keyPath: 'id', autoIncrement: true })
            .createIndex('by-user-date', ['userId', 'date'], { unique: true });
          database.createObjectStore('sw-auth', { keyPath: 'id' });
          if (options.version === 14) {
            database
              .createObjectStore('message-favorites', { keyPath: ['messageId', 'userId'] })
              .createIndex('by-user', 'userId');
            for (const name of ['local-copies', 'image-cache'] as const) {
              database
                .createObjectStore(name, { keyPath: ['userId', name === 'local-copies' ? 'kind' : 'path'] })
                .createIndex('by-user', 'userId');
            }
            database.createObjectStore('note-queue', { keyPath: 'id' }).createIndex('by-user', 'userId');
          } else {
            database.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
          }
        },
      });

      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const rows: LegacyRow[] = [
        ...BUNDLED.map((text) => ({ text, category: 'reason', isCustom: false, createdAt })),
        { text: 'A-ONE', category: 'custom', isCustom: true, userId: A, serverId: 'srv-a1', active: true, createdAt },
        { text: 'B-ONE', category: 'custom', isCustom: true, userId: B, serverId: 'srv-b1', active: true, createdAt },
        { text: 'A-TWO', category: 'custom', isCustom: true, userId: A, serverId: 'srv-a2', active: false, createdAt },
        { text: 'B-TWO', category: 'custom', isCustom: true, userId: B, serverId: 'srv-b2', active: true, createdAt },
        { text: 'A-THREE', category: 'memory', isCustom: true, userId: A, serverId: 'srv-a3', active: true, createdAt, tags: ['t'] },
        { text: 'LEGACY-UNOWNED', category: 'custom', isCustom: true, active: true, createdAt },
        ...(options.extraRows ?? []),
      ];
      for (const row of rows) await db.add('messages', row as never);
      if (options.token) {
        await db.put('sw-auth', {
          id: 'current',
          accessToken: 'a',
          refreshToken: 'r',
          expiresAt: 1,
          userId: options.token,
        } as never);
      }
      for (const favorite of options.favorites ?? []) {
        await db.put('message-favorites' as never, favorite as never);
      }
      db.close();
    }

    async function readCopy(db: Awaited<ReturnType<typeof openTestDb>>, userId: string) {
      return (await db.get('local-copies', [userId, 'message-data']))?.value as
        | { custom: Array<Record<string, unknown>>; bundledFavoriteIds: number[]; nextCustomId: number }
        | undefined;
    }

    it('moves the signed-in account’s rows (same ids) and favorites into its copy, then drops every custom row and the legacy stores', async () => {
      await seedLegacy({
        version: 14,
        token: A,
        favorites: [
          { messageId: 2, userId: A }, // bundled
          { messageId: 10, userId: A }, // A-THREE
          { messageId: 3, userId: B }, // B's bundled favorite: not A's
          { messageId: 7, userId: B }, // B-ONE
        ],
      });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      const copy = await readCopy(db, A);
      expect(copy?.custom.map((row) => [row.id, row.text, row.serverId, row.isFavorite])).toEqual([
        [6, 'A-ONE', 'srv-a1', false],
        [8, 'A-TWO', 'srv-a2', false],
        [10, 'A-THREE', 'srv-a3', true],
      ]);
      expect(copy?.custom[1]).toMatchObject({ active: false, isCustom: true, userId: A });
      expect(copy?.custom[2]).toMatchObject({ category: 'memory', tags: ['t'] });
      expect(copy?.bundledFavoriteIds).toEqual([2]);
      // Above every id the store ever held, so no deleted row's id comes back.
      expect(copy?.nextCustomId).toBe(12);

      // Only the bundled rows remain, unchanged.
      expect((await db.getAll('messages')).map((row) => [row.id, row.text])).toEqual(
        BUNDLED.map((text, index) => [index + 1, text])
      );
      const messages = db.transaction('messages', 'readonly').objectStore('messages');
      expect((messages.indexNames as DOMStringList).contains('by-user')).toBe(false);
      expect(Array.from(unwrap(db).objectStoreNames)).not.toContain('message-favorites');
      expect(db.objectStoreNames.length).toBe(6);
    });

    it('deletes a stale account’s rows and favorites with the stores instead of copying them', async () => {
      await seedLegacy({
        version: 14,
        token: A,
        favorites: [
          { messageId: 7, userId: B },
          { messageId: 3, userId: B },
        ],
      });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(await readCopy(db, B)).toBeUndefined();
      const texts = (await db.getAll('messages')).map((row) => row.text);
      expect(texts).not.toContain('B-ONE');
      expect(texts).not.toContain('B-TWO');
      expect(texts).not.toContain('LEGACY-UNOWNED');
      expect(await db.getAllFromIndex('local-copies', 'by-user', B)).toEqual([]);
    });

    it('copies nothing when nobody is signed in, and still deletes the custom rows and favorites', async () => {
      await seedLegacy({ version: 14, token: null, favorites: [{ messageId: 6, userId: A }] });

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      expect(await db.getAll('local-copies')).toEqual([]);
      expect((await db.getAll('messages')).every((row) => !row.isCustom)).toBe(true);
      expect(await db.count('messages')).toBe(BUNDLED.length);
      expect(Array.from(unwrap(db).objectStoreNames)).not.toContain('message-favorites');
    });

    it('from v8, keeps only an owned custom row’s legacy isFavorite flag', async () => {
      await seedLegacy({
        version: 8,
        token: A,
        extraRows: [
          {
            text: 'A-LEGACY-FAVORITE',
            category: 'custom',
            isCustom: true,
            userId: A,
            serverId: 'srv-a4',
            isFavorite: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });
      // A bundled row's legacy flag names no account.
      const flagged = await openDB(DB_NAME, 8);
      const bundledRow = (await flagged.get('messages', 1)) as Record<string, unknown>;
      await flagged.put('messages', { ...bundledRow, isFavorite: true } as never);
      flagged.close();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      const copy = await readCopy(db, A);
      expect(copy?.custom.map((row) => [row.id, row.text, row.isFavorite])).toEqual([
        [6, 'A-ONE', false],
        [8, 'A-TWO', false],
        [10, 'A-THREE', false],
        [12, 'A-LEGACY-FAVORITE', true],
      ]);
      expect(copy?.bundledFavoriteIds).toEqual([]);
      expect(copy?.nextCustomId).toBe(13);
      expect(Array.from(unwrap(db).objectStoreNames)).not.toContain('message-favorites');
      expect(Array.from(unwrap(db).objectStoreNames)).not.toContain('photos');
      expect((await db.getAll('messages')).every((row) => !row.isCustom)).toBe(true);
    });

    it('keeps the rotation identical: same pool order, same message every day', async () => {
      await seedLegacy({ version: 14, token: A });

      // Before: what storageService handed the rotation — every row A could
      // see, in key order, inactive custom rows filtered out by the slice.
      const before = await openDB(DB_NAME, 14);
      const visible = (await before.getAll('messages')).filter(
        (row: { isCustom?: boolean; userId?: string }) => !row.isCustom || row.userId === A
      ) as Message[];
      before.close();
      const poolBefore = visible.filter((m) => !m.isCustom || m.active !== false);

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const copy = await readCopy(db, A);
      const poolAfter = projectMessageFavorites(
        (await db.getAll('messages')) as Message[],
        copy as never
      ).filter((m) => !m.isCustom || m.active !== false);

      expect(poolAfter.map((m) => m.id)).toEqual(poolBefore.map((m) => m.id));
      for (let day = 0; day < 60; day++) {
        const date = new Date(2026, 8, 1 + day);
        const was = getDailyMessage(poolBefore, date);
        const is = getDailyMessage(poolAfter, date);
        expect([is.id, is.text]).toEqual([was.id, was.text]);
      }
    });

    it('writes nothing on a later upgrade of a migrated profile, and keeps an existing copy', async () => {
      await seedLegacy({ version: 14, token: A });
      const migrated = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const saved = await migrated.get('local-copies', [A, 'message-data']);
      await migrated.put('local-copies', {
        ...saved!,
        value: { custom: [], bundledFavoriteIds: [4], nextCustomId: 40 },
      });
      migrated.close();

      // A later version re-runs upgradeDb: nothing legacy is left to move.
      const next = await openTestDb(DB_NAME, DB_VERSION + 1, { upgrade: upgradeDb });
      expect(await readCopy(next, A)).toEqual({ custom: [], bundledFavoriteIds: [4], nextCustomId: 40 });
      expect(await next.count('messages')).toBe(BUNDLED.length);
    });
  });

  describe('blocked upgrade prompt', () => {
    const RELOAD_MESSAGE =
      'A database update is waiting. You must reload this page to finish the update.';

    async function holdLowerVersion(): Promise<{ close: () => void }> {
      const holder = await openDB(DB_NAME, 9, {
        upgrade(database) {
          database.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        },
      });
      openDbs.push(holder);
      return holder;
    }

    function getBlockedDialog(): HTMLElement | null {
      return document.querySelector('[role="dialog"]');
    }

    async function waitForBlockedDialog(): Promise<HTMLElement> {
      return vi.waitFor(() => {
        const dialog = getBlockedDialog();
        expect(dialog).not.toBeNull();
        expect(dialog?.textContent).toContain(RELOAD_MESSAGE);
        if (!dialog) throw new Error('blocked dialog missing');
        return dialog;
      });
    }

    function clickDialogButton(dialog: HTMLElement, name: 'Reload' | 'Not now'): void {
      const button = [...dialog.querySelectorAll('button')].find(
        (el) => el.textContent === name
      );
      expect(button).toBeDefined();
      (button as HTMLButtonElement).click();
    }

    it('shows a reload confirm and rejects the open when dismissed', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      window.confirm = confirm;

      const opening = openMyLoveDB();
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      clickDialogButton(dialog, 'Not now');

      await expect(opening).rejects.toThrow(/blocked/);
      expect(getBlockedDialog()).toBeNull();
    });

    it('shows a reload confirm and reloads when accepted', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      window.confirm = confirm;
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });

      const opening = openMyLoveDB();
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      clickDialogButton(dialog, 'Reload');
      expect(reload).toHaveBeenCalledTimes(1);

      // Reload is mocked, so the tab stays; close the holder so the pending
      // open can finish instead of spinning the fake-indexeddb wait loop.
      for (const db of openDbs) db.close();
      openDbs.length = 0;
      const upgraded = await opening;
      openDbs.push(upgraded);
    });

    it('prompts once for concurrent opens and rejects them all on dismiss', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      window.confirm = confirm;

      const openings = [openMyLoveDB(), openMyLoveDB(), openMyLoveDB()];
      const dialog = await waitForBlockedDialog();
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      expect(confirm).not.toHaveBeenCalled();

      clickDialogButton(dialog, 'Not now');

      const results = await Promise.allSettled(openings);
      expect(results.map((result) => result.status)).toEqual([
        'rejected',
        'rejected',
        'rejected',
      ]);
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(String(result.reason)).toMatch(/blocked/);
        }
      }
      expect(getBlockedDialog()).toBeNull();
    });

    it('reloads once when concurrent opens accept the blocked confirm', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      window.confirm = confirm;
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });

      const openings = [openMyLoveDB(), openMyLoveDB(), openMyLoveDB()];
      const dialog = await waitForBlockedDialog();
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      expect(confirm).not.toHaveBeenCalled();

      clickDialogButton(dialog, 'Reload');
      expect(reload).toHaveBeenCalledTimes(1);

      for (const db of openDbs) db.close();
      openDbs.length = 0;
      const upgraded = await Promise.all(openings);
      for (const db of upgraded) openDbs.push(db);
    });

    it('shows a reload confirm when page-side storeAuthToken is blocked', async () => {
      await holdLowerVersion();
      const confirm = vi.fn();
      window.confirm = confirm;

      const storing = storeAuthToken({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: 0,
        userId: 'user-a',
      });
      const dialog = await waitForBlockedDialog();
      expect(confirm).not.toHaveBeenCalled();

      clickDialogButton(dialog, 'Not now');

      await expect(storing).rejects.toThrow(/blocked/);
      expect(getBlockedDialog()).toBeNull();
    });
  });

  describe('live handle close on next bump', () => {
    async function withinTimeout<T>(work: Promise<T>, label: string, ms = 2000): Promise<T> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} never settled (${ms}ms)`)), ms);
      });
      try {
        return await Promise.race([work, guard]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    it('lets a higher-version open fulfill without a reload confirm', async () => {
      const holder = await openMyLoveDB();
      openDbs.push(holder);
      const confirm = vi.fn().mockReturnValue(false);
      window.confirm = confirm;

      const next = await withinTimeout(openDB(DB_NAME, DB_VERSION + 1), 'open DB_VERSION+1');
      openDbs.push(next);

      expect(confirm).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('does not treat a closed service wrapper as already initialized', async () => {
      const { moodService } = await import('../../../src/services/moodService');
      const { storageService } = await import('../../../src/services/storage');

      type Handle = { db: { close: () => void } | null };
      const holders: Array<{ service: { init: () => Promise<void> }; handle: Handle }> = [
        { service: moodService, handle: moodService as unknown as Handle },
        { service: storageService, handle: storageService as unknown as Handle },
      ];

      for (const { handle } of holders) {
        handle.db?.close();
        handle.db = null;
      }

      for (const { service, handle } of holders) {
        await service.init();
        expect(handle.db).not.toBeNull();
        openDbs.push({ close: () => handle.db?.close() });
      }

      const confirm = vi.fn().mockReturnValue(false);
      window.confirm = confirm;

      const next = await withinTimeout(
        openDB(DB_NAME, DB_VERSION + 1),
        'open DB_VERSION+1 with live service handles'
      );
      openDbs.push(next);
      expect(confirm).not.toHaveBeenCalled();
      expect(document.querySelector('[role="dialog"]')).toBeNull();

      for (const { service, handle } of holders) {
        expect(handle.db).toBeNull();
        await expect(service.init()).rejects.toThrow(/lower version|VersionError/i);
      }
    });
  });

  describe('store indexes', () => {
    it('should have correct indexes on core stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      // messages indexes
      const messagesTx = db.transaction('messages', 'readonly');
      const messagesStore = messagesTx.objectStore('messages');
      expect(messagesStore.indexNames.contains('by-category')).toBe(true);
      expect(messagesStore.indexNames.contains('by-date')).toBe(true);
      // v15: the store holds bundled rows only, so it has no owner index.
      expect((messagesStore.indexNames as DOMStringList).contains('by-user')).toBe(false);

      // moods index (compound, unique on [userId, date])
      const moodsTx = db.transaction('moods', 'readonly');
      const moodsStore = moodsTx.objectStore('moods');
      expect(moodsStore.indexNames.contains('by-user-date')).toBe(true);
    });
  });

  describe('STORE_NAMES constants', () => {
    it('should have correct core store names', () => {
      expect(STORE_NAMES).toEqual({
        MESSAGES: 'messages',
        MOODS: 'moods',
        SW_AUTH: 'sw-auth',
        LOCAL_COPIES: 'local-copies',
        IMAGE_CACHE: 'image-cache',
        NOTE_QUEUE: 'note-queue',
      });
    });
  });

  describe('DB constants', () => {
    it('should export correct database name', () => {
      expect(DB_NAME).toBe('my-love-db');
    });

    it('should export correct database version', () => {
      // v6 re-fires upgradeDb so profiles stranded at v5 by storage.ts's old
      // callback get their missing stores created; v7 swaps the moods index;
      // v8 adds by-user to messages; v9 stores favorites by account; v10 drops
      // the four scripture stores; v11 drops the unused photos store; v12 adds
      // the shared per-account local-copies store; v13 adds the per-account
      // image-cache store; v14 adds the per-account note-queue store; v15
      // moves custom messages and favorites onto the message-data local copy.
      expect(DB_VERSION).toBe(15);
    });
  });
});
