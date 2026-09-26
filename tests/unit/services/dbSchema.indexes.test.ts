/**
 * P0 Unit: dbSchema - Index Integrity
 *
 * Critical path: IndexedDB indexes must be correct for query performance.
 * Validates index configuration across all stores.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';

// Mock import.meta.env.DEV
vi.stubGlobal('import', {
  meta: { env: { DEV: false } },
});

/**
 * Delete the database and wait for it — deleteDatabase is a request, not a call.
 * A blocked delete means a connection leaked from an earlier case; failing here
 * names it, where resolving would only move the hang to the next open.
 */
function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error(`deleteDatabase(${DB_NAME}) is blocked: a connection leaked from an earlier case`));
  });
}

describe('dbSchema - Index Integrity', () => {
  const openDbs: Array<{ close: () => void }> = [];

  async function openTestDb() {
    const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
      upgrade: upgradeDb,
    });
    openDbs.push(db);
    return db;
  }

  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(() => {
    for (const db of openDbs) db.close();
    openDbs.length = 0;
  });

  it('[P0] should have only the bundled-row indexes on the messages store', async () => {
    // GIVEN: Fresh database install
    const db = await openTestDb();

    // WHEN: Checking messages store
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');

    // THEN: the store holds the bundled daily rows only (v15), so there is no
    // owner index; custom rows live in each account's message-data local copy.
    expect(Array.from(store.indexNames).sort()).toEqual(['by-category', 'by-date']);
  });

  it('[P0] should have unique by-user-date index on moods store', async () => {
    // GIVEN: Fresh database install
    const db = await openTestDb();

    // WHEN: Checking moods store
    const tx = db.transaction('moods', 'readonly');
    const store = tx.objectStore('moods');

    // THEN: the compound index exists, is unique, and is keyed on the pair.
    // Uniqueness on `date` alone made the store unable to hold two accounts'
    // entries for the same day, so the keyPath is the point of the assertion.
    expect(store.indexNames.contains('by-user-date')).toBe(true);
    const index = store.index('by-user-date');
    expect(index.unique).toBe(true);
    expect(Array.from(index.keyPath as string[])).toEqual(['userId', 'date']);
    // Cast: 'by-date' is no longer part of the typed schema for moods, but it
    // still exists on disk for pre-v7 profiles and must be gone after upgrade.
    expect((store.indexNames as DOMStringList).contains('by-date')).toBe(false);
  });
});
