/**
 * dbSchema Unit Tests
 *
 * Tests for the centralized IndexedDB schema upgrade function: fresh install,
 * store indexes and the schema constants.
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
  upgradeDb,
} from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { deleteDatabase } from './dbSchemaFixtures';

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

  describe('store indexes', () => {
    it('indexes messages by category and date but not by user, and moods by user and date', async () => {
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
    it('names the core stores messages, moods, sw-auth, local-copies, image-cache and note-queue', () => {
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
    it("names the database 'my-love-db'", () => {
      expect(DB_NAME).toBe('my-love-db');
    });

    it('is at schema version 15, after custom messages moved onto the message-data copy', () => {
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
