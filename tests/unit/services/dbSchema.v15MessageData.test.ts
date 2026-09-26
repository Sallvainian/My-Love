/**
 * dbSchema Unit Tests — upgrade to v15 (message data)
 *
 * Tests for the centralized IndexedDB schema upgrade function's v15 branch,
 * which moves custom messages and favorites onto the message-data local copy.
 * Uses fake-indexeddb to simulate IndexedDB in Node.js environment.
 *
 * @see src/services/dbSchema.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, unwrap } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import { projectMessageFavorites } from '../../../src/services/messageFavorites';
import type { Message } from '../../../src/types';
import { getDailyMessage } from '../../../src/utils/messageRotation';
import { deleteDatabase, legacyMessage, swAuthRow } from './dbSchemaFixtures';

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
        ...BUNDLED.map((text) => legacyMessage(text)),
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
        await db.put('sw-auth', swAuthRow('a', options.token) as never);
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
});
