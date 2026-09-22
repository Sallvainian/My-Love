/**
 * Custom messages belong to one account, against a real database
 *
 * The `messages` store holds every account that has signed in on this device.
 * Before this, `customMessageService.getAll()` read the whole store and the
 * inherited get/getAll/update/delete/clear/getPage were public on top of it, so
 * on a shared browser account B could list, open, edit, delete, export and
 * rotate through account A's private custom messages, and B's import silently
 * skipped a message because A had written the same sentence.
 *
 * These drive the real service against fake-indexeddb rather than a mock: the
 * whole property under test is which ROWS come back, and a mocked store cannot
 * hold rows belonging to somebody else.
 *
 * The unowned row in each fixture is the legacy case — a custom message written
 * before `userId` existed, or migrated from the Story 3.4 LocalStorage list. It
 * belongs to nobody, must stay on disk, and must never surface to anyone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, upgradeDb } from '../../../src/services/dbSchema';
import type { MyLoveDBSchema } from '../../../src/services/dbSchema';
import type { CustomMessagesExport, Message } from '../../../src/types';
import { AccountDataError } from '../../../src/services/accountDataError';
import { fakeCustomMessagesApi } from '../helpers/fakeAccountDataApis';

// The server half of custom messages and favorites; these tests drive the
// IndexedDB mirror, which is written only after the server accepted a write.
vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: (await import('../helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
}));
vi.mock('../../../src/services/messageFavoritesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/messageFavoritesApi')>()),
  messageFavoritesApi: (await import('../helpers/fakeAccountDataApis')).fakeMessageFavoritesApi,
}));

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

/**
 * A fresh service instance.
 *
 * The module exports a singleton caching its connection, so without resetting
 * the module registry a later test reuses the first handle — which, with a new
 * IDBFactory per test, points at a database that no longer exists.
 */
async function freshService() {
  const { customMessageService } = await import('../../../src/services/customMessageService');
  // The singleton is built at import time; close the cached handle and drop it
  // so the next call re-opens against this test's factory. Closing matters as
  // much as dropping: an abandoned connection still holds the database open,
  // and the first case to reuse a factory across tests would then block on the
  // versionchange transaction instead of failing with something readable.
  const cached = (customMessageService as unknown as { db?: { close?: () => void } | null }).db;
  cached?.close?.();
  (customMessageService as unknown as { db: unknown }).db = null;
  return customMessageService;
}

let connections: Array<IDBPDatabase<MyLoveDBSchema>> = [];

async function openCurrent(): Promise<IDBPDatabase<MyLoveDBSchema>> {
  const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, newVersion, transaction) {
      upgradeDb(database, oldVersion, newVersion, transaction);
    },
  });
  connections.push(db);
  return db;
}

/** Seed rows straight into the store, bypassing the service's own guards. */
async function seed(rows: Array<Omit<Message, 'id'>>): Promise<number[]> {
  const db = await openCurrent();
  const tx = db.transaction('messages', 'readwrite');
  const ids: number[] = [];
  for (const row of rows) {
    ids.push((await tx.store.add(row as Message)) as number);
  }
  await tx.done;
  db.close();
  connections = connections.filter((c) => c !== db);
  return ids;
}

function customRow(userId: string | undefined, text: string): Omit<Message, 'id'> {
  const row: Omit<Message, 'id'> = {
    text,
    category: 'custom',
    isCustom: true,
    active: true,
    isFavorite: false,
    createdAt: new Date('2026-08-03T06:00:00.000Z'),
    updatedAt: new Date('2026-08-03T06:00:00.000Z'),
    tags: [],
  };
  // Set the key only when there is an owner: an own-property `userId` that is
  // undefined is a different row shape from one with no such key, and the
  // legacy rows genuinely have no key. An owned row is an uploaded mirror row,
  // so it carries the server id its edits and deletes are addressed by.
  if (userId !== undefined) {
    row.userId = userId;
    row.serverId = `server-${userId}-${text}`;
  }
  return row;
}

function dailyRow(text: string): Omit<Message, 'id'> {
  return {
    text,
    category: 'reason',
    isCustom: false,
    isFavorite: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/** A owns three, B owns none, and one legacy row belongs to nobody. */
async function seedSharedDevice(): Promise<{ aIds: number[]; legacyId: number }> {
  const ids = await seed([
    dailyRow('A-BUNDLED-DAILY-MESSAGE'),
    customRow(A, 'A-PRIVATE-ONE'),
    customRow(A, 'A-PRIVATE-TWO'),
    customRow(A, 'A-PRIVATE-THREE'),
    customRow(undefined, 'LEGACY-OWNERLESS-MESSAGE'),
  ]);
  return { aIds: [ids[1], ids[2], ids[3]], legacyId: ids[4] };
}

async function rowsOnDisk(): Promise<Message[]> {
  const db = await openCurrent();
  const all = await db.getAll('messages');
  db.close();
  connections = connections.filter((c) => c !== db);
  return all;
}

describe('customMessageService ownership', () => {
  beforeEach(() => {
    // A fresh factory per test: the service caches its connection and these
    // tests each need a database of their own.
    globalThis.indexedDB = new IDBFactory();
    connections = [];
  });

  afterEach(() => {
    connections.forEach((db) => db.close());
    connections = [];
  });

  describe('reads', () => {
    it('returns none of the other account’s custom rows', async () => {
      await seedSharedDevice();
      const service = await freshService();

      const mine = await service.getAllForUser(B, { isCustom: true });

      expect(mine).toEqual([]);
      // The disclosure in full: the other account's writing reaching a caller
      // that is about to paint it into the AdminPanel list.
      expect(JSON.stringify(mine)).not.toContain('A-PRIVATE-ONE');
    });

    it('returns every one of the owner’s own custom rows', async () => {
      await seedSharedDevice();
      const service = await freshService();

      const mine = await service.getAllForUser(A, { isCustom: true });

      expect(mine.map((m) => m.text).sort()).toEqual([
        'A-PRIVATE-ONE',
        'A-PRIVATE-THREE',
        'A-PRIVATE-TWO',
      ]);
    });

    it('still sees them after the account switches back', async () => {
      await seedSharedDevice();
      const service = await freshService();

      expect(await service.getAllForUser(A, { isCustom: true })).toHaveLength(3);
      expect(await service.getAllForUser(B, { isCustom: true })).toHaveLength(0);
      // Scoping is a filter, not a deletion: nothing about B's session is
      // allowed to cost A their messages.
      expect(await service.getAllForUser(A, { isCustom: true })).toHaveLength(3);
    });

    it('hides a legacy unowned row from every account, and from nobody at all', async () => {
      await seedSharedDevice();
      const service = await freshService();

      for (const caller of [A, B, null]) {
        const visible = await service.getAllForUser(caller, { isCustom: true });
        expect(JSON.stringify(visible)).not.toContain('LEGACY-OWNERLESS-MESSAGE');
      }

      // …and it is still on disk. Hidden, not migrated, not claimed, not deleted.
      expect((await rowsOnDisk()).map((m) => m.text)).toContain('LEGACY-OWNERLESS-MESSAGE');
    });

    it('includes the shared daily rows but no custom row of anyone else’s', async () => {
      await seedSharedDevice();
      const service = await freshService();

      const visible = await service.getAllForUser(B);

      expect(visible.map((m) => m.text)).toEqual(['A-BUNDLED-DAILY-MESSAGE']);
    });

    it('returns nothing at all when nobody is signed in', async () => {
      await seedSharedDevice();
      const service = await freshService();

      expect(await service.getAllForUser(null, { isCustom: true })).toEqual([]);
      // Fails closed rather than open for a caller that reaches it through an
      // `any` or a value that is undefined at runtime.
      expect(await service.getAllForUser(undefined as unknown as string)).toEqual([]);
    });

    it('applies the caller’s filters on top of ownership, never instead of it', async () => {
      await seed([
        customRow(A, 'A-INACTIVE'),
        customRow(B, 'B-ACTIVE-MATCH'),
        customRow(B, 'B-OTHER'),
      ]);
      const db = await openCurrent();
      const all = await db.getAll('messages');
      const tx = db.transaction('messages', 'readwrite');
      await tx.store.put({ ...all[0], active: false });
      await tx.done;
      db.close();
      connections = connections.filter((c) => c !== db);

      const service = await freshService();

      // A category filter reads through an index, which is the one path that
      // could reach rows before the ownership filter runs.
      expect(
        (await service.getAllForUser(B, { category: 'custom' })).map((m) => m.text).sort()
      ).toEqual(['B-ACTIVE-MATCH', 'B-OTHER']);
      expect((await service.getAllForUser(B, { searchTerm: 'MATCH' })).map((m) => m.text)).toEqual([
        'B-ACTIVE-MATCH',
      ]);
      // `active: false` must not be a way to reach A's inactive row.
      expect(await service.getAllForUser(B, { isCustom: true, active: false })).toEqual([]);
    });

    it('returns null rather than throwing when asked for a row by id it may not see', async () => {
      const { aIds, legacyId } = await seedSharedDevice();
      const service = await freshService();

      // A read degrades; another account's row, a legacy row and a row that
      // does not exist are deliberately indistinguishable to the caller.
      expect(await service.getForUser(B, aIds[0])).toBeNull();
      expect(await service.getForUser(B, legacyId)).toBeNull();
      expect(await service.getForUser(A, legacyId)).toBeNull();
      expect(await service.getForUser(null, aIds[0])).toBeNull();
      expect(await service.getForUser(A, 9999)).toBeNull();

      expect(await service.getForUser(A, aIds[0])).toMatchObject({ text: 'A-PRIVATE-ONE' });
    });

    it('scopes the rotation pool to the caller’s own active rows', async () => {
      await seedSharedDevice();
      const service = await freshService();

      // Not the rotation pool itself — that is built in `messagesSlice`
      // (`updateCurrentMessage`) from `messages`, and this method has no
      // production caller. It is the owner-scoped equivalent of the old
      // unscoped `getAll({ isCustom: true, active: true })`, kept so that
      // anything reaching for "this account's rotatable custom rows" has a
      // scoped read to reach for rather than the base class's.
      expect((await service.getActiveCustomMessages(A)).map((m) => m.text).sort()).toEqual([
        'A-PRIVATE-ONE',
        'A-PRIVATE-THREE',
        'A-PRIVATE-TWO',
      ]);
      expect(await service.getActiveCustomMessages(B)).toEqual([]);
    });
  });

  describe('writes', () => {
    it('stamps a new row with the id it was handed', async () => {
      const service = await freshService();

      const created = await service.create(A, { text: 'A-BRAND-NEW', category: 'custom' });

      expect(created.userId).toBe(A);
      expect(await service.getAllForUser(B, { isCustom: true })).toEqual([]);
      expect((await service.getAllForUser(A, { isCustom: true })).map((m) => m.text)).toEqual([
        'A-BRAND-NEW',
      ]);
    });

    it('a create that resolves to a row already mirrored returns it instead of adding a copy', async () => {
      // A retried submit reuses its key, so the server hands back the row the
      // first attempt stored — which a mirror refresh may already have added.
      const [mirroredId] = await seed([{ ...customRow(A, 'A-RETRIED'), serverId: 'srv-retried' }]);
      const service = await freshService();
      fakeCustomMessagesApi.createCustomMessage.mockResolvedValueOnce({
        serverId: 'srv-retried', text: 'A-RETRIED', category: 'custom', active: true,
        isFavorite: false, tags: [], createdAt: new Date(), updatedAt: new Date(),
      });

      const created = await service.create(A, { text: 'A-RETRIED', category: 'custom' }, 'submit-1');

      expect(fakeCustomMessagesApi.createCustomMessage).toHaveBeenLastCalledWith(
        A, expect.objectContaining({ text: 'A-RETRIED' }), 'submit-1'
      );
      expect(created.id).toBe(mirroredId);
      expect((await rowsOnDisk()).filter((row) => row.serverId === 'srv-retried')).toHaveLength(1);
    });

    it('refuses to create a row with no owner', async () => {
      const service = await freshService();

      await expect(service.create(null, { text: 'ORPHAN', category: 'custom' })).rejects.toThrow(
        /requires a signed-in user/
      );
      expect(await rowsOnDisk()).toEqual([]);
    });

    it('refuses to update another account’s row, and changes nothing', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();

      await expect(service.updateMessage(B, { id: aIds[0], text: 'B-OVERWROTE-IT' })).rejects.toThrow(
        /not found for this user/
      );

      const onDisk = await rowsOnDisk();
      expect(onDisk.find((m) => m.id === aIds[0])).toMatchObject({
        text: 'A-PRIVATE-ONE',
        userId: A,
      });
      expect(JSON.stringify(onDisk)).not.toContain('B-OVERWROTE-IT');
    });

    it('updates the owner’s own row', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();

      await service.updateMessage(A, { id: aIds[0], text: 'A-EDITED', active: false });

      expect(await service.getForUser(A, aIds[0])).toMatchObject({
        text: 'A-EDITED',
        active: false,
        userId: A,
      });
    });

    it('refuses to update a legacy unowned row or a shared daily row', async () => {
      const { legacyId } = await seedSharedDevice();
      const dailyId = (await rowsOnDisk()).find((m) => !m.isCustom)!.id;
      const service = await freshService();

      await expect(service.updateMessage(A, { id: legacyId, text: 'CLAIMED' })).rejects.toThrow();
      // The bundled rows are nobody's to edit through this service either.
      await expect(service.updateMessage(A, { id: dailyId, text: 'CLAIMED' })).rejects.toThrow();
      expect(JSON.stringify(await rowsOnDisk())).not.toContain('CLAIMED');
    });

    it('refuses to delete another account’s row, and changes nothing', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();

      await expect(service.deleteForUser(B, aIds[0])).rejects.toThrow(/not found for this user/);

      expect(await rowsOnDisk()).toHaveLength(5);
    });

    it('deletes the owner’s own row', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();

      await service.deleteForUser(A, aIds[0]);

      expect((await service.getAllForUser(A, { isCustom: true })).map((m) => m.text).sort()).toEqual(
        ['A-PRIVATE-THREE', 'A-PRIVATE-TWO']
      );
    });

    it('sends an update and a delete to the server by the row’s serverId', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();
      fakeCustomMessagesApi.updateCustomMessage.mockClear();
      fakeCustomMessagesApi.deleteCustomMessage.mockClear();

      await service.updateMessage(A, { id: aIds[0], text: 'A-EDITED', active: false });
      await service.deleteForUser(A, aIds[1]);

      expect(fakeCustomMessagesApi.updateCustomMessage).toHaveBeenCalledWith(
        `server-${A}-A-PRIVATE-ONE`,
        { text: 'A-EDITED', active: false }
      );
      expect(fakeCustomMessagesApi.deleteCustomMessage).toHaveBeenCalledWith(
        `server-${A}-A-PRIVATE-TWO`
      );
    });

    it('leaves the disk untouched when the server refuses (offline)', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();
      const before = await rowsOnDisk();
      fakeCustomMessagesApi.updateCustomMessage.mockRejectedValueOnce(
        new AccountDataError('offline', 'You are offline.')
      );
      fakeCustomMessagesApi.deleteCustomMessage.mockRejectedValueOnce(
        new AccountDataError('offline', 'You are offline.')
      );

      await expect(service.updateMessage(A, { id: aIds[0], text: 'A-EDITED' })).rejects.toMatchObject({
        code: 'offline',
      });
      await expect(service.deleteForUser(A, aIds[0])).rejects.toMatchObject({ code: 'offline' });

      expect(await rowsOnDisk()).toEqual(before);
    });

    it('refuses to edit or delete an owned row not yet uploaded, without calling the server', async () => {
      const [localId] = await seed([{ ...customRow(A, 'A-LOCAL-ONLY'), serverId: undefined }]);
      const service = await freshService();
      const before = await rowsOnDisk();
      fakeCustomMessagesApi.updateCustomMessage.mockClear();
      fakeCustomMessagesApi.deleteCustomMessage.mockClear();

      await expect(service.updateMessage(A, { id: localId, text: 'X' })).rejects.toMatchObject({
        code: 'not-synced',
      });
      await expect(service.deleteForUser(A, localId)).rejects.toMatchObject({ code: 'not-synced' });

      expect(fakeCustomMessagesApi.updateCustomMessage).not.toHaveBeenCalled();
      expect(fakeCustomMessagesApi.deleteCustomMessage).not.toHaveBeenCalled();
      expect(await rowsOnDisk()).toEqual(before);
    });

    it('a row the refresh marked localOnly cannot be edited but can be deleted from this device', async () => {
      const [localId] = await seed([{ ...customRow(A, 'A-UNSENDABLE'), serverId: undefined, localOnly: true }]);
      const service = await freshService();
      fakeCustomMessagesApi.updateCustomMessage.mockClear();
      fakeCustomMessagesApi.deleteCustomMessage.mockClear();

      await expect(service.updateMessage(A, { id: localId, text: 'X' })).rejects.toMatchObject({
        code: 'not-synced',
        message: expect.stringMatching(/only on this device.*delete it/),
      });

      await service.deleteForUser(A, localId);

      expect(fakeCustomMessagesApi.updateCustomMessage).not.toHaveBeenCalled();
      expect(fakeCustomMessagesApi.deleteCustomMessage).not.toHaveBeenCalled();
      expect((await rowsOnDisk()).some((row) => row.id === localId)).toBe(false);
    });

    it('an unmarked row without a server id is never deleted locally only, even after the upload flag is set', async () => {
      // Upload done, refresh failed: the row IS on the server under a server
      // id this mirror has not learned yet. A local-only delete would let the
      // next refresh bring it back.
      const [pendingId] = await seed([{ ...customRow(A, 'A-UPLOADED-NOT-REFRESHED'), serverId: undefined }]);
      const service = await freshService();
      fakeCustomMessagesApi.deleteCustomMessage.mockClear();
      localStorage.setItem(`my-love-local-upload-v1:${A}`, 'done');
      try {
        await expect(service.deleteForUser(A, pendingId)).rejects.toMatchObject({
          code: 'not-synced',
          message: expect.stringMatching(/Try again in a moment/),
        });
        expect(fakeCustomMessagesApi.deleteCustomMessage).not.toHaveBeenCalled();
        expect((await rowsOnDisk()).some((row) => row.id === pendingId)).toBe(true);
      } finally {
        localStorage.removeItem(`my-love-local-upload-v1:${A}`);
      }
    });

    it('refuses every write when nobody is signed in', async () => {
      const { aIds } = await seedSharedDevice();
      const service = await freshService();

      await expect(service.updateMessage(null, { id: aIds[0], text: 'X' })).rejects.toThrow(
        /requires a signed-in user/
      );
      await expect(service.deleteForUser(null, aIds[0])).rejects.toThrow(
        /requires a signed-in user/
      );
      expect(await rowsOnDisk()).toHaveLength(5);
    });
  });

  describe('inherited unscoped methods', () => {
    it('refuses every base-class method that would reach the whole store', async () => {
      await seedSharedDevice();
      const service = await freshService();

      // None of these can be narrowed to demand an owner — a subclass method
      // may not add required parameters — so each is closed off instead. A
      // caller reaching one is a bug, and it must not quietly return or change
      // every account's rows.
      await expect(service.getAll()).rejects.toThrow(/unscoped/);
      await expect(service.get(1)).rejects.toThrow(/unscoped/);
      await expect(service.update(1, { text: 'x' })).rejects.toThrow(/unscoped/);
      await expect(service.delete(1)).rejects.toThrow(/unscoped/);
      await expect(service.getPage(0, 10)).rejects.toThrow(/unscoped/);
      await expect(service.clear()).rejects.toThrow(/every account/);

      // And a clear-all in particular left the store intact.
      expect(await rowsOnDisk()).toHaveLength(5);
    });
  });

  describe('export and import', () => {
    function exportFile(texts: string[]): CustomMessagesExport {
      return {
        version: '1.0',
        exportDate: '2026-09-12T00:00:00.000Z',
        messageCount: texts.length,
        messages: texts.map((text) => ({
          text,
          category: 'custom' as const,
          active: true,
          tags: [],
          createdAt: '2026-08-03T06:00:00.000Z',
          updatedAt: '2026-08-03T06:00:00.000Z',
        })),
      };
    }

    it('exports the caller’s rows and nobody else’s', async () => {
      await seedSharedDevice();
      const service = await freshService();

      const forB = await service.exportMessages(B);
      expect(forB.messageCount).toBe(0);
      expect(forB.messages).toEqual([]);
      expect(JSON.stringify(forB)).not.toContain('A-PRIVATE-ONE');
      expect(JSON.stringify(forB)).not.toContain('LEGACY-OWNERLESS-MESSAGE');

      const forA = await service.exportMessages(A);
      expect(forA.messageCount).toBe(3);
    });

    it('exports nothing when nobody is signed in', async () => {
      await seedSharedDevice();
      const service = await freshService();

      expect((await service.exportMessages(null)).messages).toEqual([]);
    });

    it('does not deduplicate against the other account’s texts', async () => {
      await seedSharedDevice();
      const service = await freshService();

      // The leak in its quietest form: skipping B's import because A wrote the
      // same sentence both loses B's message and tells B that A's row exists.
      const result = await service.importMessages(B, exportFile(['A-PRIVATE-ONE']));

      expect(result).toEqual({ imported: 1, skipped: 0 });
      expect((await service.getAllForUser(B, { isCustom: true })).map((m) => m.text)).toEqual([
        'A-PRIVATE-ONE',
      ]);
      // A's own copy is untouched — two rows now, one per owner.
      expect((await service.getAllForUser(A, { isCustom: true })).map((m) => m.text).sort()).toEqual(
        ['A-PRIVATE-ONE', 'A-PRIVATE-THREE', 'A-PRIVATE-TWO']
      );
    });

    it('still deduplicates against the caller’s own texts', async () => {
      await seedSharedDevice();
      const service = await freshService();

      const result = await service.importMessages(A, exportFile(['A-PRIVATE-ONE', 'A-NEW-ONE']));

      expect(result).toEqual({ imported: 1, skipped: 1 });
    });

    it('gives each imported row its own key, never one derived from the text', async () => {
      // A text-derived key would belong to a message edited since its import,
      // so a re-import would get the edited row back and store nothing.
      const service = await freshService();
      fakeCustomMessagesApi.createCustomMessage.mockClear();

      await service.importMessages(A, exportFile(['Imported Once']));
      await service.deleteForUser(A, (await service.getAllForUser(A, { isCustom: true }))[0].id);
      await service.importMessages(A, exportFile(['Imported Once']));

      const keys = fakeCustomMessagesApi.createCustomMessage.mock.calls.map((call) => call[2]);
      expect(keys).toHaveLength(2);
      expect(keys[1]).not.toBe(keys[0]);
      expect(keys[0]).not.toMatch(/^i:/);
    });

    it('does not deduplicate against a legacy unowned row', async () => {
      await seedSharedDevice();
      const service = await freshService();

      // A row nobody owns cannot block anybody's import either.
      const result = await service.importMessages(B, exportFile(['LEGACY-OWNERLESS-MESSAGE']));

      expect(result).toEqual({ imported: 1, skipped: 0 });
    });

    it('stamps imported rows with the importing user, ignoring any owner in the file', async () => {
      const service = await freshService();

      const file = exportFile(['SHARED-TEXT']) as CustomMessagesExport & {
        messages: Array<Record<string, unknown>>;
      };
      // A hand-edited file claiming a different owner. CustomMessagesExport has
      // no owner field, and the Zod object strips unknown keys, so this must
      // have no effect whatsoever.
      file.messages[0].userId = A;

      await service.importMessages(B, file);

      expect(await service.getAllForUser(A, { isCustom: true })).toEqual([]);
      expect((await service.getAllForUser(B, { isCustom: true }))[0]).toMatchObject({
        text: 'SHARED-TEXT',
        userId: B,
      });
    });

    it('refuses to import when nobody is signed in', async () => {
      const service = await freshService();

      await expect(service.importMessages(null, exportFile(['X']))).rejects.toThrow(
        /requires a signed-in user/
      );
      expect(await rowsOnDisk()).toEqual([]);
    });

    it('refuses an EMPTY import when nobody is signed in', async () => {
      // The empty file is what pins the check at importMessages' own boundary.
      // With rows in the file, `create` refuses each one and the import throws
      // anyway — so deleting the guard here would still look correct while
      // quietly reporting success for a file with nothing in it.
      const service = await freshService();

      await expect(service.importMessages(null, exportFile([]))).rejects.toThrow(
        /requires a signed-in user/
      );
    });
  });

  describe('legacy LocalStorage migration', () => {
    it('stores a migrated row with no owner at all', async () => {
      const service = await freshService();

      expect(await service.createUnownedIfAbsent({ text: 'FROM-LOCALSTORAGE', category: 'custom' }))
        .toBe('created');

      const [row] = await rowsOnDisk();
      expect(row.isCustom).toBe(true);
      // Not merely undefined — the key is absent, the same as a row written
      // before the field existed.
      expect('userId' in row).toBe(false);

      // And it is hidden from everyone, exactly like any other legacy row.
      expect(await service.getAllForUser(A, { isCustom: true })).toEqual([]);
      expect(await service.getAllForUser(B, { isCustom: true })).toEqual([]);
    });

    it('does not re-store a text it already migrated', async () => {
      const service = await freshService();

      await service.createUnownedIfAbsent({ text: 'FROM-LOCALSTORAGE', category: 'custom' });
      const second = await service.createUnownedIfAbsent({
        text: '  from-localstorage  ',
        category: 'custom',
      });

      expect(second).toBe('duplicate');
      expect(await rowsOnDisk()).toHaveLength(1);
    });

    it('does not treat an account’s own row as a migrated duplicate', async () => {
      await seedSharedDevice();
      const service = await freshService();

      // A wrote this sentence in their own account; the device's legacy list
      // having it too is not a reason to drop it, and the two rows have
      // different owners.
      expect(await service.createUnownedIfAbsent({ text: 'A-PRIVATE-ONE', category: 'custom' })).toBe(
        'created'
      );
      expect((await rowsOnDisk()).filter((m) => m.text === 'A-PRIVATE-ONE')).toHaveLength(2);
    });
  });
});
