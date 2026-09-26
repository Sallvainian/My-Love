/**
 * `coupleSettingsService` against a recording fake Supabase client.
 *
 * What it must hold whatever the UI does with it:
 * - the row is always addressed by the ORDERED pair, whichever partner asks,
 *   so both partners reach the same row (the table's CHECK is user_a < user_b);
 * - no row is "not set yet", not a failure;
 * - a save is an upsert on the pair (last write wins) and an offline one fails
 *   with an `offline` code before any request is made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };

const calls: Array<{ table: string; chain: Array<[string, unknown[]]> }> = [];
const results: Result[] = [];

function builder(table: string) {
  const entry = { table, chain: [] as Array<[string, unknown[]]> };
  calls.push(entry);
  const proxy: Record<string, unknown> = {};
  for (const method of ['select', 'upsert', 'eq', 'maybeSingle', 'abortSignal']) {
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
import { couplePair, coupleSettingsService } from '../../../src/services/coupleSettingsService';

const LOW = '00000000-0000-4000-8000-000000000001';
const HIGH = '00000000-0000-4000-8000-000000000002';

/** A stored couple_settings row, addressed by the ordered pair. */
const settingsRow = (overrides: Record<string, unknown> = {}) => ({ user_a: LOW, user_b: HIGH, ...overrides });

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

function argsOf(method: string, index = 0) {
  return calls[index].chain.filter(([name]) => name === method).map(([, args]) => args);
}

beforeEach(() => {
  calls.length = 0;
  results.length = 0;
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('couplePair', () => {
  it('orders the pair the same way whichever partner asks', () => {
    expect(couplePair(LOW, HIGH)).toEqual({ user_a: LOW, user_b: HIGH });
    expect(couplePair(HIGH, LOW)).toEqual({ user_a: LOW, user_b: HIGH });
  });
});

describe('fetchCoupleSettings', () => {
  it('reads the ordered pair and returns the start as an ISO string', async () => {
    results.push({
      data: settingsRow({ relationship_start: '2025-10-04T22:00:00+00:00' }),
      error: null,
    });

    const settings = await coupleSettingsService.fetchCoupleSettings(HIGH, LOW);

    expect(settings).toEqual({ relationshipStart: '2025-10-04T22:00:00.000Z', weddingDate: null });
    expect(calls[0].table).toBe('couple_settings');
    expect(argsOf('eq')).toEqual([
      ['user_a', LOW],
      ['user_b', HIGH],
    ]);
  });

  it('reads no row as "not set yet"', async () => {
    results.push({ data: null, error: null });

    expect(await coupleSettingsService.fetchCoupleSettings(LOW, HIGH)).toEqual({
      relationshipStart: null,
      weddingDate: null,
    });
  });

  it('returns the wedding date as the server stored it, and an unreadable one as unset', async () => {
    results.push({
      data: settingsRow({ relationship_start: null, wedding_date: '2027-06-19' }),
      error: null,
    });
    results.push({
      data: settingsRow({ relationship_start: null, wedding_date: 'garbage' }),
      error: null,
    });

    expect(await coupleSettingsService.fetchCoupleSettings(LOW, HIGH)).toEqual({
      relationshipStart: null,
      weddingDate: '2027-06-19',
    });
    expect(await coupleSettingsService.fetchCoupleSettings(LOW, HIGH)).toEqual({
      relationshipStart: null,
      weddingDate: null,
    });
  });

  it('throws a transport error on a failed read', async () => {
    results.push({ data: null, error: { message: 'boom', code: '500', details: '', hint: '' } });

    await expect(coupleSettingsService.fetchCoupleSettings(LOW, HIGH)).rejects.toMatchObject({
      name: 'AccountDataError',
      code: 'transport',
      message: '[CoupleSettingsService.fetchCoupleSettings] Database error: boom',
    });
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    await expect(coupleSettingsService.fetchCoupleSettings(LOW, HIGH)).rejects.toMatchObject({
      code: 'offline',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('saveStartDate', () => {
  it('upserts the ordered pair on its key and returns the stored start', async () => {
    results.push({
      data: settingsRow({ relationship_start: '2025-10-04T22:00:00+00:00' }),
      error: null,
    });

    const saved = await coupleSettingsService.saveStartDate(HIGH, LOW, '2025-10-04T22:00:00.000Z');

    expect(saved).toEqual({ relationshipStart: '2025-10-04T22:00:00.000Z', weddingDate: null });
    const [[row, options]] = argsOf('upsert') as [[Record<string, unknown>, unknown]];
    expect(row).toMatchObject({
      user_a: LOW,
      user_b: HIGH,
      relationship_start: '2025-10-04T22:00:00.000Z',
    });
    expect(typeof row.updated_at).toBe('string');
    expect(options).toEqual({ onConflict: 'user_a,user_b' });
  });

  it('refuses offline before any request', async () => {
    setOnline(false);

    const failure = await coupleSettingsService
      .saveStartDate(LOW, HIGH, '2025-10-04T22:00:00.000Z')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AccountDataError);
    expect((failure as AccountDataError).code).toBe('offline');
    expect(calls).toHaveLength(0);
  });

  it('refuses an unreadable value before any request', async () => {
    await expect(coupleSettingsService.saveStartDate(LOW, HIGH, 'not-a-date')).rejects.toBeInstanceOf(
      AccountDataError
    );
    expect(calls).toHaveLength(0);
  });
});

describe('saveWeddingDate', () => {
  it('upserts only the wedding date and updated_at, never the start date', async () => {
    results.push({
      data: settingsRow({ relationship_start: '2025-10-04T22:00:00+00:00', wedding_date: '2027-06-19' }),
      error: null,
    });

    const saved = await coupleSettingsService.saveWeddingDate(HIGH, LOW, '2027-06-19');

    expect(saved).toEqual({
      relationshipStart: '2025-10-04T22:00:00.000Z',
      weddingDate: '2027-06-19',
    });
    const [[row, options]] = argsOf('upsert') as [[Record<string, unknown>, unknown]];
    expect(Object.keys(row).sort()).toEqual(['updated_at', 'user_a', 'user_b', 'wedding_date']);
    expect(row).toMatchObject({ user_a: LOW, user_b: HIGH, wedding_date: '2027-06-19' });
    expect(options).toEqual({ onConflict: 'user_a,user_b' });
  });

  it('clears the wedding date by sending null', async () => {
    results.push({
      data: settingsRow({ relationship_start: null, wedding_date: null }),
      error: null,
    });

    const saved = await coupleSettingsService.saveWeddingDate(LOW, HIGH, null);

    expect(saved).toEqual({ relationshipStart: null, weddingDate: null });
    const [[row]] = argsOf('upsert') as [[Record<string, unknown>]];
    expect(row).toMatchObject({ wedding_date: null });
  });

  it('refuses offline, and an unreadable date, before any request', async () => {
    await expect(coupleSettingsService.saveWeddingDate(LOW, HIGH, '2027-02-30')).rejects.toBeInstanceOf(
      AccountDataError
    );
    setOnline(false);
    await expect(coupleSettingsService.saveWeddingDate(LOW, HIGH, '2027-06-19')).rejects.toMatchObject({
      code: 'offline',
    });
    expect(calls).toHaveLength(0);
  });
});
