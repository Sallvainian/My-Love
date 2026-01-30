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
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  upgradeDb,
  MyLoveDBSchema,
} from '../../../src/services/dbSchema';

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

    it('should create exactly 8 stores', async () => {
      const db = await openTestDb(DB_NAME, DB_VERSION, {
        upgrade: upgradeDb,
      });

      expect(db.objectStoreNames.length).toBe(8);
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

      expect(dbV5.objectStoreNames.length).toBe(8);
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

      // photos index
      const photosTx = db.transaction('photos', 'readonly');
      const photosStore = photosTx.objectStore('photos');
      expect(photosStore.indexNames.contains('by-date')).toBe(true);

      // moods index (unique)
      const moodsTx = db.transaction('moods', 'readonly');
      const moodsStore = moodsTx.objectStore('moods');
      expect(moodsStore.indexNames.contains('by-date')).toBe(true);
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
      expect(DB_VERSION).toBe(5);
    });
  });
});
