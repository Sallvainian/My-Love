/**
 * `pushPreferencesService` against a recording fake Supabase client.
 *
 * What it must hold whatever the UI does with it:
 * - a missing row reads as every switch on;
 * - a save is an upsert on `user_id` that sends `user_id` and one column only,
 *   so another switch is never overwritten;
 * - a failed read or write throws, and offline fails before any request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };

const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];
const results: Result[] = [];

function builder(table: string) {
  const entry = { table, chain: [] as Array<[string, unknown[]]> };
  calls.push(entry);
  const proxy: Record<string, unknown> = {};
  for (const method of ['select', 'upsert', 'eq', 'maybeSingle', 'single', 'abortSignal']) {
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

import { AccountDataError } from '../../../src/services/accountDataError';
import {
  ALL_PUSH_PREFERENCES_ON,
  pushPreferencesService,
  type PushPreferenceKey,
} from '../../../src/services/pushPreferencesService';

const ROW = {
  love_notes: false,
  moods: true,
  photos: true,
  pokes_and_kisses: true,
  dates: true,
  partner_requests: true,
};

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

function argsOf(method: string, index = 0) {
  return calls[index].chain.filter(([name]) => name === method).map(([, args]) => args);
}

beforeEach(() => {
  calls.length = 0;
  results.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
});

describe('fetchPushPreferences', () => {
  it("reads the account's row and maps its columns", async () => {
    results.push({ data: ROW, error: null });

    expect(await pushPreferencesService.fetchPushPreferences('USER-A')).toEqual({
      loveNotes: false,
      moods: true,
      photos: true,
      pokesAndKisses: true,
      dates: true,
      partnerRequests: true,
    });
    expect(calls[0].table).toBe('push_preferences');
    expect(argsOf('eq')).toEqual([['user_id', 'USER-A']]);
  });

  it('reads a missing row as every switch on', async () => {
    results.push({ data: null, error: null });

    expect(await pushPreferencesService.fetchPushPreferences('USER-A')).toEqual(
      ALL_PUSH_PREFERENCES_ON
    );
  });

  it('throws on a failed read', async () => {
    results.push({ data: null, error: { message: 'boom', code: '500', details: '', hint: '' } });

    await expect(pushPreferencesService.fetchPushPreferences('USER-A')).rejects.toBeInstanceOf(
      AccountDataError
    );
  });

  it('is refused offline before any request', async () => {
    setOnline(false);

    await expect(pushPreferencesService.fetchPushPreferences('USER-A')).rejects.toMatchObject({
      code: 'offline',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('savePushPreference', () => {
  const COLUMNS: Array<[PushPreferenceKey, string]> = [
    ['loveNotes', 'love_notes'],
    ['moods', 'moods'],
    ['photos', 'photos'],
    ['pokesAndKisses', 'pokes_and_kisses'],
    ['dates', 'dates'],
    ['partnerRequests', 'partner_requests'],
  ];

  it.each(COLUMNS)('%s upserts user_id and %s alone, on user_id', async (key, column) => {
    results.push({ data: ROW, error: null });

    await pushPreferencesService.savePushPreference('USER-A', key, false);

    expect(calls[0].table).toBe('push_preferences');
    expect(argsOf('upsert')).toEqual([[{ user_id: 'USER-A', [column]: false }, { onConflict: 'user_id' }]]);
  });

  it('returns the stored row, mapped', async () => {
    results.push({ data: ROW, error: null });

    const saved = await pushPreferencesService.savePushPreference('USER-A', 'loveNotes', false);

    expect(saved).toEqual({ ...ALL_PUSH_PREFERENCES_ON, loveNotes: false });
    expect(calls[0].chain.map(([name]) => name)).toContain('single');
  });

  it('throws when the write is refused', async () => {
    results.push({ data: null, error: { message: 'denied', code: '42501', details: '', hint: '' } });

    await expect(
      pushPreferencesService.savePushPreference('USER-A', 'moods', false)
    ).rejects.toBeInstanceOf(AccountDataError);
  });

  it('is refused offline before any request', async () => {
    setOnline(false);

    await expect(
      pushPreferencesService.savePushPreference('USER-A', 'moods', false)
    ).rejects.toMatchObject({ code: 'offline' });
    expect(calls).toHaveLength(0);
  });
});
