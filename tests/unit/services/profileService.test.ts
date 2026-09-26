/**
 * `profileService` against a recording fake Supabase client.
 *
 * What it must hold whatever the UI does with it:
 * - a birthday save sends `birthday` and `updated_at` only (the column grant
 *   opens no other `users` column) and addresses the caller's own row;
 * - the read applies the seed rule, so an unchosen name is `null`;
 * - offline, and an unreadable date, fail before any request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };

const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];
const results: Result[] = [];
const session = vi.hoisted(() => ({
  user: { id: 'SELF-ID', email: 'self@example.test' } as { id: string; email: string } | null,
}));

function builder(table: string) {
  const entry = { table, chain: [] as Array<[string, unknown[]]> };
  calls.push(entry);
  const proxy: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'eq', 'maybeSingle', 'abortSignal']) {
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

vi.mock('../../../src/api/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/supabaseClient')>();
  return {
    isSeedFallbackName: actual.isSeedFallbackName,
    supabase: {
      from: (table: string) => builder(table),
      auth: {
        getSession: async () => ({
          data: { session: session.user ? { user: session.user } : null },
          error: null,
        }),
      },
    },
  };
});

import { AccountDataError } from '../../../src/services/accountDataError';
import { profileService } from '../../../src/services/profileService';

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

function argsOf(method: string, index = 0) {
  return calls[index].chain.filter(([name]) => name === method).map(([, args]) => args);
}

beforeEach(() => {
  calls.length = 0;
  results.length = 0;
  session.user = { id: 'SELF-ID', email: 'self@example.test' };
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchOwnProfile', () => {
  it('reads the own row and returns the chosen name and birthday', async () => {
    results.push({ data: { display_name: '  Sam  ', birthday: '1990-01-02' }, error: null });

    expect(await profileService.fetchOwnProfile()).toEqual({
      displayName: 'Sam',
      birthday: '1990-01-02',
    });
    expect(calls[0].table).toBe('users');
    expect(argsOf('eq')).toEqual([['id', 'SELF-ID']]);
  });

  it('reads a seed name (the email) as no name, and no birthday as not set', async () => {
    results.push({ data: { display_name: 'self@example.test', birthday: null }, error: null });

    expect(await profileService.fetchOwnProfile()).toEqual({ displayName: null, birthday: null });
  });

  it('throws on a failed read', async () => {
    results.push({ data: null, error: { message: 'boom', code: '500', details: '', hint: '' } });

    await expect(profileService.fetchOwnProfile()).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'transport',
      message: '[ProfileService.fetchOwnProfile] Database error: boom',
    });
  });
});

describe('saveBirthday', () => {
  it('updates only birthday and updated_at on the own row', async () => {
    results.push({ data: { display_name: 'Sam', birthday: '2000-05-20' }, error: null });

    const saved = await profileService.saveBirthday('2000-05-20');

    expect(saved).toEqual({ displayName: 'Sam', birthday: '2000-05-20' });
    const [[patch]] = argsOf('update') as [[Record<string, unknown>]];
    expect(Object.keys(patch).sort()).toEqual(['birthday', 'updated_at']);
    expect(patch.birthday).toBe('2000-05-20');
    expect(argsOf('eq')).toEqual([['id', 'SELF-ID']]);
  });

  it('throws when no row was updated', async () => {
    results.push({ data: null, error: null });

    await expect(profileService.saveBirthday('2000-05-20')).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'invalid-response',
      message: 'Your birthday was not saved',
    });
  });

  it('refuses offline, and an unreadable date, before any request', async () => {
    await expect(profileService.saveBirthday('2000-02-30')).rejects.toBeInstanceOf(
      AccountDataError
    );
    setOnline(false);
    await expect(profileService.saveBirthday('2000-05-20')).rejects.toMatchObject({
      code: 'offline',
    });
    expect(calls).toHaveLength(0);
  });
});
