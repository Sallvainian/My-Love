/**
 * Custom messages belong to one account: the message-data copy and the service
 *
 * Custom messages live in each account's `message-data` local copy, keyed by
 * `[userId, kind]`, so one account's rows cannot be read under another's id.
 * These drive the real copy against fake-indexeddb, and the service's server
 * writes and pure copy transforms against a faked server:
 * - a copy saved for one account is never read back for another;
 * - every server write refuses a signed-out caller, invalid input or an
 *   unsynced row before anything is sent;
 * - local ids stay stable across refreshes and are never reused;
 * - export and import carry no owner.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { CustomMessagesExport, Message } from '../../../src/types';
import { AccountDataError } from '../../../src/services/accountDataError';
import type { ServerCustomMessage } from '../../../src/services/customMessagesApi';
import { fakeCustomMessagesApi } from '../helpers/fakeAccountDataApis';

vi.mock('../../../src/services/customMessagesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/customMessagesApi')>()),
  customMessagesApi: (await import('../helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
}));

import {
  customMessageService as service,
  emptyMessageData,
  parseMessageData,
  readMessageData,
  writeMessageData,
  type MessageDataCopy,
} from '../../../src/services/customMessageService';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const at = new Date('2026-08-03T06:00:00.000Z');

function row(id: number, serverId: string | undefined, text: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    text,
    category: 'custom',
    isCustom: true,
    userId: A,
    ...(serverId ? { serverId } : {}),
    active: true,
    isFavorite: false,
    createdAt: at,
    updatedAt: at,
    tags: [],
    ...extra,
  };
}

function remote(serverId: string, text: string, extra: Partial<ServerCustomMessage> = {}): ServerCustomMessage {
  return {
    serverId,
    text,
    category: 'custom',
    active: true,
    isFavorite: false,
    tags: [],
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
}

function copyWith(custom: Message[], nextCustomId: number, bundledFavoriteIds: number[] = []): MessageDataCopy {
  return { custom, bundledFavoriteIds, nextCustomId };
}

describe('customMessageService and the message-data copy', () => {
  beforeEach(() => {
    for (const fn of Object.values(fakeCustomMessagesApi)) fn.mockClear();
  });

  describe('the copy is per account', () => {
    beforeEach(() => {
      globalThis.indexedDB = new IDBFactory();
    });

    it('never reads one account’s rows back for another', async () => {
      await writeMessageData(A, copyWith([row(400, 'srv-a', 'A-PRIVATE')], 401, [3]));

      expect(await readMessageData(B)).toBeNull();
      expect((await readMessageData(A))?.custom.map((m) => m.text)).toEqual(['A-PRIVATE']);
    });

    it('drops malformed saved rows and never lets nextCustomId fall behind a saved id', () => {
      const parsed = parseMessageData({
        custom: [row(9, 'srv-9', 'kept'), { id: 'nope', text: 1 }, null],
        bundledFavoriteIds: [2, 'x'],
        nextCustomId: 3,
      });

      expect(parsed?.custom.map((m) => m.id)).toEqual([9]);
      expect(parsed?.bundledFavoriteIds).toEqual([2]);
      expect(parsed?.nextCustomId).toBe(10);
      expect(parseMessageData('garbage')).toBeNull();
    });
  });

  describe('server writes', () => {
    it('refuses to create a row with no owner, before anything is sent', async () => {
      await expect(
        service.createRemote(null, { text: 'ORPHAN', category: 'custom' }, 'key')
      ).rejects.toThrow(/requires a signed-in user/);
      expect(fakeCustomMessagesApi.createCustomMessage).not.toHaveBeenCalled();
    });

    it('refuses invalid input before anything is sent', async () => {
      await expect(service.createRemote(A, { text: '', category: 'custom' }, 'key')).rejects.toThrow();
      expect(() => service.validateUpdate({ id: 1, text: '' })).toThrow();
      expect(fakeCustomMessagesApi.createCustomMessage).not.toHaveBeenCalled();
    });

    it('creates for the given owner under the caller’s key', async () => {
      await service.createRemote(A, { text: 'hello', category: 'custom' }, 'submit-1');

      expect(fakeCustomMessagesApi.createCustomMessage).toHaveBeenCalledWith(
        A,
        { text: 'hello', category: 'custom', active: true, tags: [] },
        'submit-1'
      );
    });

    it('sends an update and a delete by the row’s serverId', async () => {
      await service.updateRemote(row(400, 'srv-a', 'x'), { id: 400, text: 'A-EDITED', active: false });
      await service.deleteRemote(row(401, 'srv-b', 'y'));

      expect(fakeCustomMessagesApi.updateCustomMessage).toHaveBeenCalledWith('srv-a', {
        text: 'A-EDITED',
        active: false,
      });
      expect(fakeCustomMessagesApi.deleteCustomMessage).toHaveBeenCalledWith('srv-b');
    });

    it('refuses to edit or delete a row with no server id, without calling the server', async () => {
      const local = row(400, undefined, 'local only');

      await expect(service.updateRemote(local, { id: 400, text: 'X' })).rejects.toMatchObject({
        code: 'not-synced',
      });
      await expect(service.deleteRemote(local)).rejects.toMatchObject({ code: 'not-synced' });
      expect(fakeCustomMessagesApi.updateCustomMessage).not.toHaveBeenCalled();
      expect(fakeCustomMessagesApi.deleteCustomMessage).not.toHaveBeenCalled();
    });

    it('passes the server’s offline refusal through', async () => {
      fakeCustomMessagesApi.updateCustomMessage.mockRejectedValueOnce(
        new AccountDataError('offline', 'You are offline.')
      );

      await expect(
        service.updateRemote(row(400, 'srv-a', 'x'), { id: 400, text: 'y' })
      ).rejects.toMatchObject({ code: 'offline' });
    });
  });

  describe('local ids', () => {
    // The `minNewId` the store passes: one above the highest bundled id, 365 bundled
    // messages today (src/stores/slices/messagesSlice.ts minNewCustomId, module-private).
    const BUNDLED_ID_FLOOR = 366;
    // A floor above the copy's `nextCustomId` (405), as a larger bundled set would give.
    const BUNDLED_ID_FLOOR_ABOVE_COPY = 1000;

    it('gives a new row an id above every bundled id and every id handed out', () => {
      const base = copyWith([row(400, 'srv-a', 'a')], 405);

      const aboveCopy = service.withCreatedRow(base, remote('srv-n', 'n'), A, BUNDLED_ID_FLOOR);
      expect(aboveCopy.message).toMatchObject({ id: 405, userId: A, serverId: 'srv-n' });
      expect(aboveCopy.copy.nextCustomId).toBe(406);

      const aboveBundled = service.withCreatedRow(base, remote('srv-n', 'n'), A, BUNDLED_ID_FLOOR_ABOVE_COPY);
      expect(aboveBundled.message.id).toBe(BUNDLED_ID_FLOOR_ABOVE_COPY);
    });

    it('returns the existing row for a retried create instead of adding a copy', () => {
      const base = copyWith([row(400, 'srv-retried', 'retried')], 401);

      const result = service.withCreatedRow(base, remote('srv-retried', 'retried'), A, 1);

      expect(result.copy).toBe(base);
      expect(result.message.id).toBe(400);
    });

    it('never reuses a deleted row’s id', () => {
      const created = service.withCreatedRow(emptyMessageData(10), remote('srv-1', 'one'), A, 10);
      const deleted = service.withoutRow(created.copy, created.message.id);
      const again = service.withCreatedRow(deleted, remote('srv-2', 'two'), A, 10);

      expect(created.message.id).toBe(10);
      expect(again.message.id).toBe(11);
    });

    it('keeps a matched row’s id on refresh, numbers new rows next and drops the rest', () => {
      const base = copyWith(
        [row(400, 'srv-keep', 'old'), row(401, undefined, 'unsynced'), row(402, 'srv-gone', 'gone')],
        403,
        [7]
      );

      const next = service.withServerRows(
        base,
        [remote('srv-new', 'new'), remote('srv-keep', 'edited', { isFavorite: true })],
        A,
        [2, 5],
        1
      );

      expect(next.custom.map((m) => [m.id, m.serverId, m.text, m.isFavorite])).toEqual([
        [400, 'srv-keep', 'edited', true],
        [403, 'srv-new', 'new', false],
      ]);
      expect(next.bundledFavoriteIds).toEqual([2, 5]);
      expect(next.nextCustomId).toBe(404);
    });

    it('keeps the local id when an edit is saved', () => {
      const next = service.withUpdatedRow(
        copyWith([row(400, 'srv-a', 'before')], 401),
        400,
        remote('srv-a', 'after', { active: false }),
        A
      );

      expect(next.custom).toEqual([
        expect.objectContaining({ id: 400, text: 'after', active: false, userId: A }),
      ]);
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

    it('exports the given rows with no owner or server id', () => {
      const file = service.exportMessages([row(400, 'srv-a', 'A-PRIVATE-ONE')]);

      expect(file.messageCount).toBe(1);
      expect(JSON.stringify(file)).not.toContain(A);
      expect(JSON.stringify(file)).not.toContain('srv-a');
    });

    it('deduplicates against the importer’s own texts and within the file only', () => {
      const plan = service.planImport(
        [row(400, 'srv-a', 'A-PRIVATE-ONE')],
        exportFile(['a-private-one ', 'NEW', 'new'])
      );

      expect(plan.toCreate.map((m) => m.text)).toEqual(['NEW']);
      expect(plan.skipped).toBe(2);
    });

    it('ignores any owner in the file', () => {
      const file = exportFile(['SHARED-TEXT']) as CustomMessagesExport & {
        messages: Array<Record<string, unknown>>;
      };
      file.messages[0].userId = B;

      const plan = service.planImport([], file);

      expect(plan.toCreate).toEqual([
        expect.not.objectContaining({ userId: expect.anything() }),
      ]);
    });

    it('refuses an unsupported file', () => {
      const future = { ...exportFile([]), version: '2.0' } as unknown as CustomMessagesExport;
      // The schema accepts only version "1.0"; its refusal is the only
      // version check.
      expect(() => service.planImport([], future)).toThrow(/^Invalid version\. Please select a valid option\.$/);
    });
  });
});
