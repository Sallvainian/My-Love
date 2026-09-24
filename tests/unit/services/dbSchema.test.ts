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
import { storeAuthToken } from '../../../src/sw-db';

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
      expect(db.objectStoreNames.contains('message-favorites')).toBe(true);
      expect(db.objectStoreNames.contains('moods')).toBe(true);
      expect(db.objectStoreNames.contains('sw-auth')).toBe(true);
      expect(db.objectStoreNames.contains('local-copies')).toBe(true);
      expect(db.objectStoreNames.contains('image-cache')).toBe(true);
      // v11: photos live in Supabase; a fresh profile never gets the store.
      expect(unwrap(db).objectStoreNames.contains('photos')).toBe(false);
    });

    it('should create exactly 6 stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      expect(db.objectStoreNames.length).toBe(6);
    });
  });

  describe('upgrade from v4 to v5', () => {
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
      // count check would pass on rows some branch had silently rewritten.
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V7' });
      expect((await db.getAll('moods'))[0]).toMatchObject({ note: 'MOOD-AT-V7' });
      expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V7' });

      // Six stores (message-favorites is created at v9, local-copies at v12,
      // image-cache at v13);
      // the v7 scripture stores are dropped on the way to v10 and photos on the
      // way to v11. The v7 moods index is untouched — v8 must not re-run the v7
      // swap over a store that has already had it.
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

    it('creates it even when a service that does not own the messages store wins the upgrade', async () => {
      // IndexedDB runs the upgrade callback of only the ONE open() that
      // performs the version-change transaction; every other concurrent open()
      // just connects. Four modules open this database, and which one gets
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
      expect(db.objectStoreNames.contains('message-favorites')).toBe(true);
      expect(db.objectStoreNames.contains('moods')).toBe(true);
      expect(db.objectStoreNames.contains('sw-auth')).toBe(true);
      expect(db.objectStoreNames.contains('local-copies')).toBe(true);
      expect(db.objectStoreNames.contains('image-cache')).toBe(true);
      expect(db.objectStoreNames.length).toBe(6);

      const remaining = Array.from(unwrap(db).objectStoreNames);
      expect(remaining).not.toContain('photos');
      expect(remaining).not.toContain('scripture-sessions');
      expect(remaining).not.toContain('scripture-reflections');
      expect(remaining).not.toContain('scripture-bookmarks');
      expect(remaining).not.toContain('scripture-messages');

      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V9' });
      expect((await db.getAll('message-favorites'))[0]).toEqual({
        messageId: 1,
        userId: 'USER-A',
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
      // The four survivors plus v12's local-copies and v13's image-cache.
      expect(db.objectStoreNames.length).toBe(6);
      expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V10' });
      expect((await db.getAll('message-favorites'))[0]).toEqual({
        messageId: 1,
        userId: 'USER-A',
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
      const { customMessageService } = await import('../../../src/services/customMessageService');
      const { storageService } = await import('../../../src/services/storage');

      type Handle = { db: { close: () => void } | null };
      const holders: Array<{ service: { init: () => Promise<void> }; handle: Handle }> = [
        { service: moodService, handle: moodService as unknown as Handle },
        { service: customMessageService, handle: customMessageService as unknown as Handle },
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
      // v8: custom messages carry an owner, so one account's rows can be
      // separated from another's on a shared device.
      expect(messagesStore.indexNames.contains('by-user')).toBe(true);

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
        MESSAGE_FAVORITES: 'message-favorites',
        MOODS: 'moods',
        SW_AUTH: 'sw-auth',
        LOCAL_COPIES: 'local-copies',
        IMAGE_CACHE: 'image-cache',
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
      // image-cache store.
      expect(DB_VERSION).toBe(13);
    });
  });
});
