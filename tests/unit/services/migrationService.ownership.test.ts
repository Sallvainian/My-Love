/**
 * The LocalStorage migration may not invent an owner
 *
 * `migrateCustomMessagesFromLocalStorage` runs from `App.tsx` once a session
 * exists, which means an account is always signed in when it fires — and that
 * account is simply whoever opened the app first, not the author. The Story 3.4
 * LocalStorage list predates accounts entirely; it is per-device data. Stamping
 * it with the signed-in id would hand one partner the other's messages, which
 * is the exact leak the ownership work removes.
 *
 * This file exists because nothing else executes the real function. The only
 * other test that references the module (`tests/unit/App.eventsSession.test.tsx`)
 * mocks it away, so swapping the unowned write for an owner-stamping `create`
 * left the entire repository green — the central rule of the story was unpinned
 * and the leak could have shipped behind a passing suite.
 *
 * Driven against fake-indexeddb rather than a mocked service: the property is
 * which rows end up on disk and who can see them, and a mocked store cannot
 * hold a row at all.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import type { Message } from '../../../src/types';

const LOCALSTORAGE_KEY = 'my-love-custom-messages';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

let connections: Array<IDBPDatabase<MyLoveDBSchema>> = [];

/**
 * Fresh singletons. Both modules cache a connection at module scope, and each
 * test runs against a brand-new IDBFactory, so a stale handle would point at a
 * database that no longer exists.
 */
async function freshModules() {
  const { customMessageService } = await import('../../../src/services/customMessageService');
  const { migrateCustomMessagesFromLocalStorage } = await import(
    '../../../src/services/migrationService'
  );
  (customMessageService as unknown as { db: unknown }).db = null;
  return { customMessageService, migrate: migrateCustomMessagesFromLocalStorage };
}

async function rowsOnDisk(): Promise<Message[]> {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, newVersion, transaction) {
      upgradeDb(database, oldVersion, newVersion, transaction);
    },
  });
  connections.push(db);
  const all = await db.getAll('messages');
  db.close();
  connections = connections.filter((c) => c !== db);
  return all;
}

function seedLocalStorage(texts: string[]): void {
  localStorage.setItem(
    LOCALSTORAGE_KEY,
    JSON.stringify(
      texts.map((text, index) => ({
        id: index + 1,
        text,
        category: 'custom',
        isCustom: true,
        active: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      }))
    )
  );
}

describe('migrateCustomMessagesFromLocalStorage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    connections = [];
    localStorage.removeItem(LOCALSTORAGE_KEY);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    connections.forEach((db) => db.close());
    connections = [];
    localStorage.removeItem(LOCALSTORAGE_KEY);
  });

  it('stores the migrated rows with no owner key at all', async () => {
    seedLocalStorage(['LEGACY-DEVICE-MESSAGE']);
    const { migrate } = await freshModules();

    const result = await migrate();

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    const [row] = await rowsOnDisk();
    expect(row.text).toBe('LEGACY-DEVICE-MESSAGE');
    expect(row.isCustom).toBe(true);
    // Not merely `undefined`: the key is ABSENT, the same shape as a custom row
    // written before the field existed. An own `userId` of undefined reads back
    // differently from no key at all.
    expect('userId' in row).toBe(false);
  });

  it('leaves the migrated rows invisible to every account', async () => {
    seedLocalStorage(['LEGACY-DEVICE-MESSAGE']);
    const { migrate, customMessageService } = await freshModules();

    await migrate();

    // The whole point: whoever happened to be signed in when App.tsx fired this
    // does not acquire the previous owner's writing.
    for (const caller of [A, B, null]) {
      const visible = await customMessageService.getAllForUser(caller, { isCustom: true });
      expect(visible).toEqual([]);
    }
    // …and it is still on disk. Hidden, not deleted, not claimed.
    expect((await rowsOnDisk()).map((m) => m.text)).toContain('LEGACY-DEVICE-MESSAGE');
  });

  it('does not deduplicate against a signed-in account’s own messages', async () => {
    // A wrote this sentence inside their own account. The device's legacy list
    // happening to contain it too is not a reason to drop the legacy row, and
    // the two rows have different owners.
    const { migrate, customMessageService } = await freshModules();
    await customMessageService.create(A, { text: 'SAME-SENTENCE', category: 'custom' });

    seedLocalStorage(['SAME-SENTENCE']);
    const result = await migrate();

    expect(result.migratedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect((await rowsOnDisk()).filter((m) => m.text === 'SAME-SENTENCE')).toHaveLength(2);
    // A's own row is untouched and still A's.
    expect(await customMessageService.getAllForUser(A, { isCustom: true })).toEqual([
      expect.objectContaining({ text: 'SAME-SENTENCE', userId: A }),
    ]);
  });

  it('counts a repeat migration as skipped rather than duplicating the rows', async () => {
    // The service reports 'duplicate' and the migration has to carry that
    // through to skippedCount: the counts are the migration's only report of
    // what happened, and a miscount misreports a list as unmigrated.
    seedLocalStorage(['LEGACY-DEVICE-MESSAGE']);
    const { migrate } = await freshModules();
    await migrate();

    seedLocalStorage(['LEGACY-DEVICE-MESSAGE']);
    const second = await migrate();

    expect(second.migratedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
    expect(await rowsOnDisk()).toHaveLength(1);
  });

  it('tracks created and duplicate outcomes separately within one run', async () => {
    seedLocalStorage(['ALREADY-MIGRATED']);
    const { migrate } = await freshModules();
    await migrate();

    seedLocalStorage(['ALREADY-MIGRATED', 'BRAND-NEW-ONE']);
    const result = await migrate();

    expect(result).toMatchObject({ migratedCount: 1, skippedCount: 1, success: true });
    expect((await rowsOnDisk()).map((m) => m.text).sort()).toEqual([
      'ALREADY-MIGRATED',
      'BRAND-NEW-ONE',
    ]);
  });

  it('keeps LocalStorage once the list is accounted for', async () => {
    seedLocalStorage(['LEGACY-DEVICE-MESSAGE']);
    const { migrate } = await freshModules();

    await migrate();

    // The migrated rows are unowned and therefore invisible to every account,
    // so this key is the only copy left that a user can read. Re-migrating is
    // harmless: the repeat-migration case above proves it skips rather than
    // duplicates.
    expect(localStorage.getItem(LOCALSTORAGE_KEY)).not.toBeNull();
  });

  it('is a no-op when there is nothing to migrate', async () => {
    const { migrate } = await freshModules();

    const result = await migrate();

    expect(result).toMatchObject({ migratedCount: 0, skippedCount: 0, success: true });
    expect(await rowsOnDisk()).toEqual([]);
  });
});
