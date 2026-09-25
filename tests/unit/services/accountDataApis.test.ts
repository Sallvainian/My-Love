/**
 * The three account-data services that moved off the device:
 * `anniversariesService`, `customMessagesApi` and `messageFavoritesApi`.
 *
 * What each must hold, whatever the UI does with it:
 * - an offline write fails with an `offline` code BEFORE any request is made —
 *   there is no queue, so a request "sent later" would be a promise nobody keeps;
 * - a zero-row UPDATE is `not-found` (RLS filters a foreign row silently);
 * - the creates and the favorite add are ON CONFLICT DO NOTHING, never a
 *   merge that could overwrite a server row;
 * - the bundled-favorite key is a stable hash of the exact text.
 *
 * The Supabase client is a recording fake: every chained call is logged, and
 * awaiting the chain yields the result queued for that request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };

const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];
const results: Result[] = [];

function builder(table: string) {
  const entry = { table, chain: [] as Array<[string, unknown[]]> };
  calls.push(entry);
  const proxy: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'order', 'single', 'maybeSingle', 'abortSignal']) {
    proxy[method] = (...args: unknown[]) => {
      entry.chain.push([method, args]);
      return proxy;
    };
  }
  proxy.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
    const next = results.shift() ?? { data: null, error: null };
    return Promise.resolve(next).then(resolve, reject);
  };
  return proxy;
}

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: (table: string) => builder(table) },
}));

import { AccountDataError, REQUEST_TIMEOUT_MS } from '../../../src/services/accountDataError';
import { anniversariesService } from '../../../src/services/anniversariesService';
import { customMessagesApi, isMessageCategory } from '../../../src/services/customMessagesApi';
import {
  bundledMessageKey,
  hashText,
  messageFavoritesApi,
} from '../../../src/services/messageFavoritesApi';

const A = 'USER-A-ID';

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

function methods(index = 0) {
  return calls[index].chain.map(([method]) => method);
}

function argsOf(method: string, index = 0) {
  return calls[index].chain.find(([name]) => name === method)?.[1];
}

const anniversaryRow = {
  id: 'ann-1',
  user_id: A,
  event_date: '2024-02-14',
  label: 'First date',
  description: null,
  client_key: 'k',
  created_at: '2026-09-22T00:00:00.000Z',
  updated_at: '2026-09-22T00:00:00.000Z',
};

const customRow = {
  id: 'cm-1',
  user_id: A,
  text: 'You are my favorite',
  category: 'reason',
  active: true,
  is_favorite: false,
  tags: ['x'],
  client_key: 'k',
  created_at: '2026-09-22T00:00:00.000Z',
  updated_at: '2026-09-22T00:00:00.000Z',
};

beforeEach(() => {
  calls.length = 0;
  results.length = 0;
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('offline writes fail before any request', () => {
  it.each([
    ['createAnniversary', () => anniversariesService.createAnniversary(A, { date: '2024-02-14', label: 'x' }, 'k-1')],
    ['updateAnniversary', () => anniversariesService.updateAnniversary('ann-1', { date: '2024-02-14', label: 'x' })],
    ['deleteAnniversary', () => anniversariesService.deleteAnniversary('ann-1')],
    ['createCustomMessage', () =>
      customMessagesApi.createCustomMessage(A, { text: 'x', category: 'custom', active: true, tags: [] }, 'k-1')],
    ['updateCustomMessage', () => customMessagesApi.updateCustomMessage('cm-1', { isFavorite: true })],
    ['deleteCustomMessage', () => customMessagesApi.deleteCustomMessage('cm-1')],
    ['addFavorite', () => messageFavoritesApi.addFavorite(A, 'b:1')],
    ['removeFavorite', () => messageFavoritesApi.removeFavorite(A, 'b:1')],
  ])('%s', async (_name, write) => {
    setOnline(false);
    const failure = await write().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AccountDataError);
    expect((failure as AccountDataError).code).toBe('offline');
    expect((failure as AccountDataError).message).toMatch(/offline/i);
    expect(calls).toHaveLength(0);
  });
});

describe('request bounds', () => {
  // Every request is abandoned after REQUEST_TIMEOUT_MS, so a stalled socket
  // cannot hold the strict account-data queue. That includes both creates:
  // they reuse the caller's key on a retry, so a timeout that fired after the
  // server committed resolves to the stored row rather than a second one.
  const signalOf = (index = 0) => argsOf('abortSignal', index)?.[0];

  it.each([
    ['fetchAnniversaries', () => anniversariesService.fetchAnniversaries(A), { data: [], error: null }],
    ['updateAnniversary', () => anniversariesService.updateAnniversary('ann-1', { date: '2024-02-14', label: 'x' }),
      { data: [anniversaryRow], error: null }],
    ['deleteAnniversary', () => anniversariesService.deleteAnniversary('ann-1'), { data: null, error: null }],
    ['fetchCustomMessages', () => customMessagesApi.fetchCustomMessages(A), { data: [], error: null }],
    ['updateCustomMessage', () => customMessagesApi.updateCustomMessage('cm-1', { text: 'x' }),
      { data: [customRow], error: null }],
    ['deleteCustomMessage', () => customMessagesApi.deleteCustomMessage('cm-1'), { data: null, error: null }],
    ['fetchFavoriteKeys', () => messageFavoritesApi.fetchFavoriteKeys(A), { data: [], error: null }],
    ['addFavorite', () => messageFavoritesApi.addFavorite(A, 'b:1'), { data: null, error: null }],
    ['removeFavorite', () => messageFavoritesApi.removeFavorite(A, 'b:1'), { data: null, error: null }],
  ])('%s carries a timeout signal', async (_name, request, result) => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    results.push(result as Result);
    await request();
    expect(timeout).toHaveBeenCalledExactlyOnceWith(REQUEST_TIMEOUT_MS);
    expect(signalOf()).toBe(timeout.mock.results[0].value);
  });

  it.each([
    ['createAnniversary', () => anniversariesService.createAnniversary(A, { date: '2024-02-14', label: 'x' }, 'k-1'),
      { data: anniversaryRow, error: null }],
    ['createCustomMessage', () =>
      customMessagesApi.createCustomMessage(A, { text: 'x', category: 'custom', active: true, tags: [] }, 'k-1'),
      { data: customRow, error: null }],
  ])('%s carries a timeout signal too — it is retry-safe', async (_name, request, result) => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    results.push(result as Result);
    await request();
    expect(timeout).toHaveBeenCalledExactlyOnceWith(REQUEST_TIMEOUT_MS);
    expect(signalOf()).toBe(timeout.mock.results[0].value);
  });
});

describe('anniversariesService', () => {
  it('reads only the caller’s rows, as bare date strings, soonest first', async () => {
    results.push({ data: [anniversaryRow, { ...anniversaryRow, id: 'bad', event_date: 'infinity' }], error: null });

    const rows = await anniversariesService.fetchAnniversaries(A);

    expect(rows).toEqual([{ serverId: 'ann-1', date: '2024-02-14', label: 'First date' }]);
    expect(argsOf('eq')).toEqual(['user_id', A]);
    expect(argsOf('order')).toEqual(['event_date', { ascending: true }]);
  });

  it('creates under the caller and returns the server id', async () => {
    results.push({ data: { ...anniversaryRow, description: 'dinner' }, error: null });

    const created = await anniversariesService.createAnniversary(
      A,
      { date: '2024-02-14', label: 'First date', description: 'dinner' },
      'k-1'
    );

    expect(created).toEqual({ serverId: 'ann-1', date: '2024-02-14', label: 'First date', description: 'dinner' });
    expect(argsOf('upsert')).toEqual([
      { user_id: A, event_date: '2024-02-14', label: 'First date', description: 'dinner', client_key: 'k-1' },
      { onConflict: 'user_id,client_key', ignoreDuplicates: true },
    ]);
  });

  it('refuses a date the mirror schema could not read back', async () => {
    await expect(anniversariesService.createAnniversary(A, { date: '2026-02-30', label: 'x' }, 'k-1')).rejects.toThrow(
      'Not a valid calendar date'
    );
    expect(calls).toHaveLength(0);
  });

  it('reports a zero-row update as not-found', async () => {
    results.push({ data: [], error: null });

    const failure = await anniversariesService
      .updateAnniversary('ann-1', { date: '2024-02-14', label: 'x' })
      .catch((error: unknown) => error);

    expect((failure as AccountDataError).code).toBe('not-found');
    expect(argsOf('update')?.[0]).toEqual(expect.objectContaining({ updated_at: expect.any(String) }));
  });

  it('keeps a PostgREST failure’s friendly message under a transport code', async () => {
    results.push({ data: null, error: { code: '42501', message: 'rls', details: '', hint: '' } });

    const failure = await anniversariesService.deleteAnniversary('ann-1').catch((error: unknown) => error);

    expect((failure as AccountDataError).code).toBe('transport');
    expect((failure as AccountDataError).message).toMatch(/Permission denied/);
  });
});

describe('customMessagesApi', () => {
  it('maps rows and falls back to `custom` for an unknown category', async () => {
    results.push({ data: [customRow, { ...customRow, id: 'cm-2', category: 'poem' }], error: null });

    const rows = await customMessagesApi.fetchCustomMessages(A);

    expect(rows[0]).toEqual({
      serverId: 'cm-1',
      text: 'You are my favorite',
      category: 'reason',
      active: true,
      isFavorite: false,
      tags: ['x'],
      createdAt: new Date('2026-09-22T00:00:00.000Z'),
      updatedAt: new Date('2026-09-22T00:00:00.000Z'),
    });
    expect(rows[1].category).toBe('custom');
    expect(argsOf('eq')).toEqual(['user_id', A]);
  });

  it('writes only the fields asked for, plus updated_at', async () => {
    results.push({ data: [{ ...customRow, is_favorite: true }], error: null });

    const updated = await customMessagesApi.updateCustomMessage('cm-1', { isFavorite: true });

    expect(updated.isFavorite).toBe(true);
    expect(Object.keys(argsOf('update')?.[0] as object).sort()).toEqual(['is_favorite', 'updated_at']);
    expect(argsOf('eq')).toEqual(['id', 'cm-1']);
  });

  it('reports a zero-row update as not-found', async () => {
    results.push({ data: [], error: null });
    const failure = await customMessagesApi
      .updateCustomMessage('cm-1', { text: 'x' })
      .catch((error: unknown) => error);
    expect((failure as AccountDataError).code).toBe('not-found');
  });

  it('treats deleting an already-deleted row as done', async () => {
    results.push({ data: null, error: null });
    await expect(customMessagesApi.deleteCustomMessage('cm-1')).resolves.toBeUndefined();
    expect(methods()).toEqual(['delete', 'eq', 'abortSignal']);
  });

  it('narrows categories', () => {
    expect(isMessageCategory('memory')).toBe(true);
    expect(isMessageCategory('poem')).toBe(false);
  });
});

describe('messageFavoritesApi', () => {
  it('hashes text with SHA-256, stably', async () => {
    expect(await hashText('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(await bundledMessageKey('abc')).toBe(
      'b:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(await bundledMessageKey('abc ')).not.toBe(await bundledMessageKey('abc'));
  });

  it('adds idempotently and removes by user and key', async () => {
    await messageFavoritesApi.addFavorite(A, 'b:1');
    await messageFavoritesApi.removeFavorite(A, 'b:1');

    expect(argsOf('upsert', 0)).toEqual([
      { user_id: A, message_key: 'b:1' },
      { onConflict: 'user_id,message_key', ignoreDuplicates: true },
    ]);
    expect(calls[1].chain).toEqual([
      ['delete', []],
      ['eq', ['user_id', A]],
      ['eq', ['message_key', 'b:1']],
      ['abortSignal', [expect.any(AbortSignal)]],
    ]);
  });

  it('reads the caller’s keys', async () => {
    results.push({ data: [{ message_key: 'b:1' }, { message_key: 'b:2' }], error: null });
    expect(await messageFavoritesApi.fetchFavoriteKeys(A)).toEqual(['b:1', 'b:2']);
    expect(argsOf('eq')).toEqual(['user_id', A]);
  });

  it('wraps a network failure as a transport error without promising a sync', async () => {
    results.push(Promise.reject(new Error('socket hang up')) as unknown as Result);
    const failure = await messageFavoritesApi
      .fetchFavoriteKeys(A)
      .catch((error: unknown) => error);
    expect((failure as AccountDataError).code).toBe('transport');
    expect((failure as AccountDataError).message).not.toMatch(/synced/);
  });
});
