/**
 * dbSchema Unit Tests — upgrade from v15 to v16 (the pick-queue store)
 *
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { deleteDatabase, legacyMessage, swAuthRow } from './dbSchemaFixtures';

describe('dbSchema upgrade from v15 to v16', () => {
  const openDbs: Array<{ close: () => void }> = [];

  async function openTestDb(...args: Parameters<typeof openDB<MyLoveDBSchema>>) {
    const db = await openDB<MyLoveDBSchema>(...args);
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

  /** A v15 profile: six stores, with rows in the ones that hold account data. */
  async function seedV15(options: { withPickQueue: boolean }): Promise<void> {
    const db = await openDB(DB_NAME, 15, {
      upgrade(database) {
        const messages = database.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true,
        });
        messages.createIndex('by-category', 'category');
        messages.createIndex('by-date', 'createdAt');
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
        database.createObjectStore('note-queue', { keyPath: 'id' }).createIndex('by-user', 'userId');
        if (options.withPickQueue) {
          // A store that exists without its index: the upgrade adds the index.
          database.createObjectStore('pick-queue', { keyPath: ['user_id', 'day_id'] });
        }
      },
    });
    await db.add('messages', legacyMessage('WRITTEN-AT-V15'));
    await db.add('sw-auth', swAuthRow('TOKEN-AT-V15'));
    await db.put('local-copies', { userId: 'USER-A', kind: 'events', value: 'COPY-AT-V15' });
    await db.put('note-queue', {
      id: 'temp-QUEUED-AT-V15',
      userId: 'USER-A',
      toUserId: 'USER-B',
      content: 'queued at v15',
      createdAt: '2026-11-05T10:00:00.000Z',
      failed: false,
    });
    if (options.withPickQueue) {
      await db.put('pick-queue', {
        user_id: 'USER-A',
        day_id: 'DAY-1',
        choice: 'this',
        picked_at: '2026-11-05T10:00:00.000Z',
        time_zone: 'America/New_York',
        utc_offset_minutes: -300,
        failed: false,
        failure: null,
      });
    }
    db.close();
  }

  it('adds pick-queue keyed [user_id, day_id] with a by-user index, keeping every row', async () => {
    await seedV15({ withPickQueue: false });

    const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

    expect(db.objectStoreNames.length).toBe(7);
    const queue = db.transaction('pick-queue', 'readonly').objectStore('pick-queue');
    expect(queue.keyPath).toEqual(['user_id', 'day_id']);
    expect(queue.indexNames.contains('by-user')).toBe(true);
    expect(await db.getAll('pick-queue')).toEqual([]);
    expect((await db.getAll('messages'))[0]).toMatchObject({ text: 'WRITTEN-AT-V15' });
    expect((await db.getAll('sw-auth'))[0]).toMatchObject({ accessToken: 'TOKEN-AT-V15' });
    expect((await db.get('local-copies', ['USER-A', 'events']))?.value).toBe('COPY-AT-V15');
    expect(await db.getAllFromIndex('note-queue', 'by-user', 'USER-A')).toEqual([
      expect.objectContaining({ id: 'temp-QUEUED-AT-V15', content: 'queued at v15' }),
    ]);
  });

  it('keeps an existing pick-queue store and its rows, adding a missing index', async () => {
    // Existence-gated: a store that already exists must not throw ConstraintError.
    await seedV15({ withPickQueue: true });

    const db = await openTestDb(DB_NAME, DB_VERSION, { upgrade: upgradeDb });

    expect(db.objectStoreNames.length).toBe(7);
    const queue = db.transaction('pick-queue', 'readonly').objectStore('pick-queue');
    expect(queue.indexNames.contains('by-user')).toBe(true);
    expect(await db.getAllFromIndex('pick-queue', 'by-user', 'USER-A')).toEqual([
      expect.objectContaining({ day_id: 'DAY-1', choice: 'this', failed: false }),
    ]);
  });
});
