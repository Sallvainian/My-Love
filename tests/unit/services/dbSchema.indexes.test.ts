/**
 * P0 Unit: dbSchema - Index Integrity
 *
 * Critical path: IndexedDB indexes must be correct for query performance.
 * Validates index configuration across all stores.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  upgradeDb,
  MyLoveDBSchema,
} from '../../../src/services/dbSchema';

// Mock import.meta.env.DEV
vi.stubGlobal('import', {
  meta: { env: { DEV: false } },
});

describe('dbSchema - Index Integrity', () => {
  const openDbs: Array<{ close: () => void }> = [];

  async function openTestDb() {
    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
      upgrade: upgradeDb,
    });
    openDbs.push(db);
    return db;
  }

  beforeEach(() => {
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    for (const db of openDbs) db.close();
    openDbs.length = 0;
  });

  it('[P0] should have by-user index on scripture-sessions for user queries', async () => {
    // GIVEN: Fresh database install
    const db = await openTestDb();

    // WHEN: Checking scripture-sessions store
    const tx = db.transaction('scripture-sessions', 'readonly');
    const store = tx.objectStore('scripture-sessions');

    // THEN: by-user index exists
    expect(store.indexNames.contains('by-user')).toBe(true);
  });

  it('[P0] should have by-session index on all scripture child stores', async () => {
    // GIVEN: Fresh database install
    const db = await openTestDb();

    // WHEN/THEN: Each child store has by-session index
    for (const storeName of ['scripture-reflections', 'scripture-bookmarks', 'scripture-messages'] as const) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      expect(store.indexNames.contains('by-session')).toBe(true);
    }
  });

  it('[P0] should have unique by-date index on moods store', async () => {
    // GIVEN: Fresh database install
    const db = await openTestDb();

    // WHEN: Checking moods store
    const tx = db.transaction('moods', 'readonly');
    const store = tx.objectStore('moods');

    // THEN: by-date index exists
    expect(store.indexNames.contains('by-date')).toBe(true);
  });
});
