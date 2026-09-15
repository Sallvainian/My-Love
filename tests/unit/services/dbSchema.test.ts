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
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, STORE_NAMES, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';

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
  });

  describe('fresh install (v0 → v5)', () => {
    it('should create all stores on fresh install', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      // Core stores (v1-v4)
      expect(db.objectStoreNames.contains('messages')).toBe(true);
      expect(db.objectStoreNames.contains('photos')).toBe(true);
      expect(db.objectStoreNames.contains('moods')).toBe(true);
      expect(db.objectStoreNames.contains('sw-auth')).toBe(true);

      // Scripture stores (v5)
      expect(db.objectStoreNames.contains('scripture-sessions')).toBe(true);
      expect(db.objectStoreNames.contains('scripture-reflections')).toBe(true);
      expect(db.objectStoreNames.contains('scripture-bookmarks')).toBe(true);
      expect(db.objectStoreNames.contains('scripture-messages')).toBe(true);
    });

    it('should create exactly 9 stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      expect(db.objectStoreNames.length).toBe(9);
    });
  });

  describe('upgrade from v4 to v5', () => {
    it('should add scripture stores when upgrading from v4', async () => {
      // First, create v4 database with existing stores
      const dbV4 = await openDB(DB_NAME, 4, {
        upgrade(db) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messageStore.createIndex('by-category', 'category');
          messageStore.createIndex('by-date', 'createdAt');

          const photosStore = db.createObjectStore('photos', {
            keyPath: 'id',
            autoIncrement: true,
          });
          photosStore.createIndex('by-date', 'uploadDate', { unique: false });

          const moodsStore = db.createObjectStore('moods', {
            keyPath: 'id',
            autoIncrement: true,
          });
          moodsStore.createIndex('by-date', 'date', { unique: true });

          db.createObjectStore('sw-auth', { keyPath: 'id' });
        },
      });

      // Verify v4 state
      expect(dbV4.objectStoreNames.length).toBe(4);
      expect(dbV4.objectStoreNames.contains('scripture-sessions')).toBe(false);
      dbV4.close();

      // Upgrade to v5
      const dbV5 = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      // Verify scripture stores were added
      expect(dbV5.objectStoreNames.contains('scripture-sessions')).toBe(true);
      expect(dbV5.objectStoreNames.contains('scripture-reflections')).toBe(true);
      expect(dbV5.objectStoreNames.contains('scripture-bookmarks')).toBe(true);
      expect(dbV5.objectStoreNames.contains('scripture-messages')).toBe(true);

      // Verify existing stores are preserved
      expect(dbV5.objectStoreNames.contains('messages')).toBe(true);
      expect(dbV5.objectStoreNames.contains('photos')).toBe(true);
      expect(dbV5.objectStoreNames.contains('moods')).toBe(true);
      expect(dbV5.objectStoreNames.contains('sw-auth')).toBe(true);

      expect(dbV5.objectStoreNames.length).toBe(9);
    });

    it('should add the messages by-user index to a store that already exists', async () => {
      // The v4 seed above builds `messages` with by-category and by-date only,
      // which is what every already-installed profile has. Adding an index to
      // an existing store needs the versionchange transaction, so this is the
      // branch that fails silently if `tx` is ever dropped from the call — the
      // fresh-install case cannot see it, because it takes the create path.
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
      expect(store.indexNames.contains('by-user')).toBe(true);
      // The index it already had is untouched, and so is the row.
      expect(store.indexNames.contains('by-category')).toBe(true);
      expect(await upgraded.getAll('messages')).toHaveLength(1);
    });
  });

  describe('upgrade from v7 to v8', () => {
    /**
     * v7 is where every already-installed profile actually sits, and it is a
     * different path through `upgradeDb` from v4 or v5: all eight stores exist,
     * `moods` already carries `by-user-date`, and every v1–v7 branch is a
     * no-op. The only thing left to do is add `by-user` to `messages` — so this
     * is the one starting point where that branch runs alone, with nothing else
     * to mask it.
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

    it('adds by-user to messages while every other store keeps its rows', async () => {
      await seedV7();

      const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

      // The migration itself.
      const messages = db.transaction('messages', 'readonly').objectStore('messages');
      expect(messages.indexNames.contains('by-user')).toBe(true);
      // …without disturbing the indexes it already had.
      expect(messages.indexNames.contains('by-category')).toBe(true);
      expect(messages.indexNames.contains('by-date')).toBe(true);

      // "rows and other stores intact": asserted on CONTENT, store by store. A
      // count check would pass on rows some branch had silently rewritten, and
      // the photos store in particular has a deliberately destructive branch
      // one version boundary away.
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V7' });
      expect((await db.getAll('photos'))[0]).toMatchObject({ caption: 'PHOTO-AT-V7' });
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V7' });
      expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V7' });
      expect((await db.getAll('scripture-sessions'))[0]).toMatchObject({ id: 'session-v7' });
      expect((await db.getAll('scripture-reflections'))[0]).toMatchObject({
        notes: 'REFLECTION-AT-V7',
      });
      expect((await db.getAll('scripture-bookmarks'))[0]).toMatchObject({ id: 'bookmark-v7' });
      expect((await db.getAll('scripture-messages'))[0]).toMatchObject({ message: 'PRAYER-AT-V7' });

      // No store gained or lost, and the v7 moods index is untouched — v8 must
      // not re-run the v7 swap over a store that has already had it.
      expect(db.objectStoreNames.length).toBe(9);
      const moods = db.transaction('moods', 'readonly').objectStore('moods');
      expect(moods.indexNames.contains('by-user-date')).toBe(true);
      expect((moods.indexNames as DOMStringList).contains('by-date')).toBe(false);
    });

    it('creates it even when a service that does not own the messages store wins the upgrade', async () => {
      // IndexedDB runs the upgrade callback of only the ONE open() that
      // performs the version-change transaction; every other concurrent open()
      // just connects. Five modules open this database, and which one gets
      // there first is a race decided by app start-up order — so the store a
      // service "owns" says nothing about which callback creates its indexes.
      // moodService reaches for `moods` and never touches `messages`, which
      // makes it the right proof: if its open were to skip the messages branch
      // (or fail to thread the versionchange transaction through), `by-user`
      // would never exist for the service that does need it.
      await seedV7();

      const { moodService } = await import('../../../src/services/moodService');
      const moodHandle = moodService as unknown as { db: { close: () => void } | null };
      // The singleton caches its connection at module scope and this file
      // deletes the database between tests, so drop the stale handle first.
      moodHandle.db = null;

      await withinTimeout(moodService.init(), 'moodService.init()');
      openDbs.push({ close: () => moodHandle.db?.close() });

      // It resolved rather than blocking, and it left the index behind for a
      // store it has no interest in.
      const afterMood = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      expect(
        afterMood.transaction('messages', 'readonly').objectStore('messages').indexNames.contains(
          'by-user'
        )
      ).toBe(true);
      // And the v7 row is still there: winning the upgrade is not a reset.
      expect((await afterMood.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V7' });

      // The service that DOES own the store now connects at the same version,
      // which needs no versionchange transaction at all — the second open must
      // not block behind the first service's still-open connection.
      const { customMessageService } = await import('../../../src/services/customMessageService');
      const customHandle = customMessageService as unknown as { db: { close: () => void } | null };
      customHandle.db = null;
      await withinTimeout(customMessageService.init(), 'customMessageService.init()');
      openDbs.push({ close: () => customHandle.db?.close() });

      // …and it can actually use the index's store through its scoped read.
      expect(await customMessageService.getAllForUser('USER-A', { isCustom: true })).toEqual([]);
    });
  });

  describe('store indexes', () => {
    it('should have correct index on scripture-sessions', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      const tx = db.transaction('scripture-sessions', 'readonly');
      const store = tx.objectStore('scripture-sessions');
      expect(store.indexNames.contains('by-user')).toBe(true);
    });

    it('should have correct index on scripture-reflections', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      const tx = db.transaction('scripture-reflections', 'readonly');
      const store = tx.objectStore('scripture-reflections');
      expect(store.indexNames.contains('by-session')).toBe(true);
    });

    it('should have correct index on scripture-bookmarks', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      const tx = db.transaction('scripture-bookmarks', 'readonly');
      const store = tx.objectStore('scripture-bookmarks');
      expect(store.indexNames.contains('by-session')).toBe(true);
    });

    it('should have correct index on scripture-messages', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      const tx = db.transaction('scripture-messages', 'readonly');
      const store = tx.objectStore('scripture-messages');
      expect(store.indexNames.contains('by-session')).toBe(true);
    });

    it('should have correct indexes on core stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      // messages indexes
      const messagesTx = db.transaction('messages', 'readonly');
      const messagesStore = messagesTx.objectStore('messages');
      expect(messagesStore.indexNames.contains('by-category')).toBe(true);
      expect(messagesStore.indexNames.contains('by-date')).toBe(true);
      // v8: custom messages carry an owner, so one account's rows can be
      // separated from another's on a shared device.
      expect(messagesStore.indexNames.contains('by-user')).toBe(true);

      // photos index
      const photosTx = db.transaction('photos', 'readonly');
      const photosStore = photosTx.objectStore('photos');
      expect(photosStore.indexNames.contains('by-date')).toBe(true);

      // moods index (compound, unique on [userId, date])
      const moodsTx = db.transaction('moods', 'readonly');
      const moodsStore = moodsTx.objectStore('moods');
      expect(moodsStore.indexNames.contains('by-user-date')).toBe(true);
    });
  });

  describe('STORE_NAMES constants', () => {
    it('should have correct scripture store names', () => {
      expect(STORE_NAMES.SCRIPTURE_SESSIONS).toBe('scripture-sessions');
      expect(STORE_NAMES.SCRIPTURE_REFLECTIONS).toBe('scripture-reflections');
      expect(STORE_NAMES.SCRIPTURE_BOOKMARKS).toBe('scripture-bookmarks');
      expect(STORE_NAMES.SCRIPTURE_MESSAGES).toBe('scripture-messages');
    });

    it('should have correct core store names', () => {
      expect(STORE_NAMES.MESSAGES).toBe('messages');
      expect(STORE_NAMES.PHOTOS).toBe('photos');
      expect(STORE_NAMES.MOODS).toBe('moods');
      expect(STORE_NAMES.SW_AUTH).toBe('sw-auth');
    });
  });

  describe('DB constants', () => {
    it('should export correct database name', () => {
      expect(DB_NAME).toBe('my-love-db');
    });

    it('should export correct database version', () => {
      // v6 re-fires upgradeDb so profiles stranded at v5 by storage.ts's old
      // callback get their missing stores created; v7 swaps the moods index;
      // v8 adds by-user to messages.
      expect(DB_VERSION).toBe(9);
    });
  });
});
