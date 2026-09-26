/**
 * dbSchema Unit Tests — upgrades from v4, v7 and v9
 *
 * Tests for the centralized IndexedDB schema upgrade function, from legacy
 * profiles at v4, v7 and v9.
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, unwrap } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { deleteDatabase, legacyMessage, legacyMood, swAuthRow, withinTimeout } from './dbSchemaFixtures';

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
      await seedTx.objectStore('messages').add(legacyMessage('written before v8'));
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
      await tx.objectStore('messages').add(legacyMessage('WRITTEN-AT-V7'));
      await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V7' });
      await tx.objectStore('moods').add(legacyMood('MOOD-AT-V7', { date: '2026-08-01' }));
      await tx.objectStore('sw-auth').add(swAuthRow('TOKEN-AT-V7'));
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
      await tx.objectStore('messages').add(legacyMessage('WRITTEN-AT-V9'));
      await tx.objectStore('message-favorites').add({ messageId: 1, userId: 'USER-A' });
      await tx.objectStore('photos').add({ caption: 'PHOTO-AT-V9' });
      await tx.objectStore('moods').add(legacyMood('MOOD-AT-V9'));
      await tx.objectStore('sw-auth').add(swAuthRow('TOKEN-AT-V9'));
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
});
