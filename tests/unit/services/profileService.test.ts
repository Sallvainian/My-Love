/**
 * `profileService` against a recording fake Supabase client.
 *
 * What it must hold whatever the UI does with it:
 * - a birthday save sends `birthday` and `updated_at` only, and a name save
 *   `display_name` and `updated_at` only (the column grants open no other
 *   `users` column), each addressing the caller's own row;
 * - a name that the read side would call a seed (the email, `Unknown`) or that
 *   is outside 3-30 characters is refused before any request;
 * - the read applies the seed rule, so an unchosen name is `null`;
 * - offline, and an unreadable date, fail before any request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    SEED_FALLBACK_NAME: actual.SEED_FALLBACK_NAME,
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
import {
  displayNameRefusal,
  isDisplayNameLength,
  profileService,
} from '../../../src/services/profileService';
import { setOnline } from '../stores/navigatorFixtures';

function argsOf(method: string, index = 0) {
  return calls[index].chain.filter(([name]) => name === method).map(([, args]) => args);
}

beforeEach(() => {
  calls.length = 0;
  results.length = 0;
  session.user = { id: 'SELF-ID', email: 'self@example.test' };
  setOnline(true);
});

describe('the display-name rule', () => {
  it('counts 3 to 30 characters once trimmed', () => {
    expect(isDisplayNameLength('  Ab  ')).toBe(false);
    expect(isDisplayNameLength(' Abc ')).toBe(true);
    expect(isDisplayNameLength('a'.repeat(30))).toBe(true);
    expect(isDisplayNameLength('a'.repeat(31))).toBe(false);
  });

  it('refuses a short name, the account email in any case, and the seed name', () => {
    expect(displayNameRefusal('Ab', null)).toBe('Display name must be between 3 and 30 characters');
    expect(displayNameRefusal(' SELF@example.test ', 'self@example.test')).toBe(
      'Please choose a name that is different from your email address'
    );
    expect(displayNameRefusal('Unknown', null)).toBe('"Unknown" is not a name — please choose another');
  });

  it('allows a name that breaks none of them, and skips the email check with no email', () => {
    expect(displayNameRefusal(' Casey ', 'self@example.test')).toBeNull();
    expect(displayNameRefusal('self@example.test', null)).toBeNull();
  });
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

describe('saveDisplayName', () => {
  it('updates only display_name and updated_at on the own row, trimmed', async () => {
    results.push({ data: { display_name: 'Casey', birthday: '2000-05-20' }, error: null });

    const saved = await profileService.saveDisplayName('  Casey  ');

    expect(saved).toEqual({ displayName: 'Casey', birthday: '2000-05-20' });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('users');
    const [[patch]] = argsOf('update') as [[Record<string, unknown>]];
    expect(Object.keys(patch).sort()).toEqual(['display_name', 'updated_at']);
    expect(patch.display_name).toBe('Casey');
    expect(argsOf('eq')).toEqual([['id', 'SELF-ID']]);
    expect(argsOf('select')).toEqual([['display_name, birthday']]);
  });

  it('throws when no row was updated', async () => {
    results.push({ data: null, error: null });

    await expect(profileService.saveDisplayName('Casey')).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'invalid-response',
      message: 'Could not find your profile to save the name to',
    });
  });

  it('throws a failed write with its mapped message', async () => {
    results.push({ data: null, error: { message: 'boom', code: '500', details: '', hint: '' } });

    await expect(profileService.saveDisplayName('Casey')).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'transport',
    });
  });

  it.each([
    ['the account email, in any case', 'SELF@Example.test', /different from your email address/],
    ['Unknown', 'Unknown', /"Unknown" is not a name/],
    ['two characters', 'ab', /between 3 and 30 characters/],
    ['31 characters', 'a'.repeat(31), /between 3 and 30 characters/],
    ['only spaces', '     ', /between 3 and 30 characters/],
  ])('refuses %s before any request', async (_what, name, message) => {
    await expect(profileService.saveDisplayName(name)).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'invalid-response',
      message: expect.stringMatching(message),
    });
    expect(calls).toHaveLength(0);
  });

  it('refuses offline with the name wording, before any request', async () => {
    setOnline(false);

    await expect(profileService.saveDisplayName('Casey')).rejects.toMatchObject({
      code: 'offline',
      message: 'You are offline. Name changes need a connection to save.',
    });
    expect(calls).toHaveLength(0);
  });
});
