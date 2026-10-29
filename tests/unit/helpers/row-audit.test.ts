import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TypedSupabaseClient } from '../../support/factories';
import globalTeardown from '../../support/global-teardown';
import {
  ROW_AUDIT_BASELINE_ENV,
  countPoolRows,
  diffRowCounts,
  formatRowDiff,
  parseRowCounts,
  rowCountKey,
  serializeRowCounts,
} from '../../support/helpers/row-audit';

const fakeDb = vi.hoisted(() => ({
  /** Rows each audited query counts, keyed `table|userId`; absent means 0. */
  counts: new Map<string, number>(),
  /** A table whose count query answers with an error. */
  failingTable: null as string | null,
}));

/** A service-role client that resolves `testworker<slot>…` emails and counts from `fakeDb`. */
function fakeAdmin() {
  return {
    from(table: string) {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (_column: string, email: string) => ({
              single: async () => ({ data: { id: `id-${email}` }, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          or: async (filter: string) => {
            if (table === fakeDb.failingTable) {
              return { count: null, error: { message: 'permission denied' } };
            }
            const userId = filter.split(',')[0].split('.eq.')[1];
            return { count: fakeDb.counts.get(`${table}|${userId}`) ?? 0, error: null };
          },
        }),
      };
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => fakeAdmin() }));

describe('diffRowCounts / formatRowDiff', () => {
  it('reports a clean run as one "no leftover rows" line', () => {
    const counts = { [rowCountKey('moods', 3, 'worker')]: 5 };
    const diff = diffRowCounts(counts, { ...counts });
    expect(diff).toEqual([]);
    expect(formatRowDiff(diff)).toEqual([
      'no leftover rows: every pool-account count matches setup',
    ]);
  });

  it('flags a grown count with its table, slot, role and positive delta', () => {
    const diff = diffRowCounts({ 'moods|3|worker': 5 }, { 'moods|3|worker': 6 });
    expect(diff).toEqual([
      { table: 'moods', slot: 3, role: 'worker', before: 5, after: 6, grew: true },
    ]);
    expect(formatRowDiff(diff)).toEqual(['moods slot 3 worker: 5 → 6 (+1)']);
  });

  it('reports a shrunk count without flagging it as grown', () => {
    const diff = diffRowCounts({ 'events|1|partner': 2 }, { 'events|1|partner': 0 });
    expect(diff).toEqual([
      { table: 'events', slot: 1, role: 'partner', before: 2, after: 0, grew: false },
    ]);
    expect(formatRowDiff(diff)).toEqual(['events slot 1 partner: 2 → 0 (-2)']);
  });

  it('lists every changed key in a mixed run and skips the unchanged ones', () => {
    const diff = diffRowCounts(
      { 'moods|3|worker': 5, 'events|1|partner': 2, 'photos|0|worker': 4 },
      { 'moods|3|worker': 6, 'events|1|partner': 0, 'photos|0|worker': 4 }
    );
    expect(diff.map((e) => [e.table, e.grew])).toEqual([
      ['events', false],
      ['moods', true],
    ]);
    expect(formatRowDiff(diff)).toEqual([
      'events slot 1 partner: 2 → 0 (-2)',
      'moods slot 3 worker: 5 → 6 (+1)',
    ]);
  });

  it('treats a key present on one side only as 0 on the other', () => {
    const diff = diffRowCounts({ 'love_notes|2|worker': 3 }, { 'interactions|0|partner': 1 });
    expect(diff).toEqual([
      { table: 'interactions', slot: 0, role: 'partner', before: 0, after: 1, grew: true },
      { table: 'love_notes', slot: 2, role: 'worker', before: 3, after: 0, grew: false },
    ]);
  });
});

describe('parseRowCounts', () => {
  it('round-trips a serialised baseline', () => {
    const counts = { 'moods|0|worker': 0, 'couple_settings|1|partner': 1 };
    expect(parseRowCounts(serializeRowCounts(counts))).toEqual(counts);
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['not JSON', '{oops'],
    ['an array', '[1,2]'],
    ['null', 'null'],
    ['a non-count value', '{"moods|0|worker":"5"}'],
    ['a negative count', '{"moods|0|worker":-1}'],
  ])('returns null for a baseline that is %s', (_, raw) => {
    expect(parseRowCounts(raw)).toBeNull();
  });
});

describe('countPoolRows', () => {
  beforeEach(() => {
    fakeDb.counts.clear();
    fakeDb.failingTable = null;
  });

  it('counts every audited table for both roles of every slot', async () => {
    fakeDb.counts.set('moods|id-testworker1-partner@test.example.com', 2);
    const counts = await countPoolRows(fakeAdmin() as unknown as TypedSupabaseClient, 2);
    expect(Object.keys(counts)).toHaveLength(11 * 2 * 2);
    expect(counts['moods|1|partner']).toBe(2);
    expect(counts['moods|1|worker']).toBe(0);
  });

  it('throws naming the table and email when a count query fails', async () => {
    fakeDb.failingTable = 'photos';
    await expect(countPoolRows(fakeAdmin() as unknown as TypedSupabaseClient, 1)).rejects.toThrow(
      /Could not count photos rows for testworker0@test\.example\.com: permission denied/
    );
  });
});

describe('globalTeardown', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeDb.counts.clear();
    fakeDb.failingTable = null;
    vi.stubEnv('PLAYWRIGHT_AUTH_POOL_SIZE', '1');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  async function baselineNow(): Promise<string> {
    const admin = fakeAdmin() as unknown as TypedSupabaseClient;
    return serializeRowCounts(await countPoolRows(admin, 1));
  }

  it('skips with a log and does not throw when there is no baseline', async () => {
    vi.stubEnv(ROW_AUDIT_BASELINE_ENV, '');
    await expect(globalTeardown()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[row-audit] skipped'));
  });

  it('logs "no leftover rows" and passes when nothing changed', async () => {
    vi.stubEnv(ROW_AUDIT_BASELINE_ENV, await baselineNow());
    await expect(globalTeardown()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      '[row-audit] no leftover rows: every pool-account count matches setup'
    );
  });

  it('fails the run naming every grown count', async () => {
    vi.stubEnv(ROW_AUDIT_BASELINE_ENV, await baselineNow());
    fakeDb.counts.set('moods|id-testworker0@test.example.com', 1);
    await expect(globalTeardown()).rejects.toThrow(/moods slot 0 worker: 0 → 1 \(\+1\)/);
  });

  it('reports a shrink without failing', async () => {
    fakeDb.counts.set('events|id-testworker0-partner@test.example.com', 2);
    vi.stubEnv(ROW_AUDIT_BASELINE_ENV, await baselineNow());
    fakeDb.counts.clear();
    await expect(globalTeardown()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('[row-audit] events slot 0 partner: 2 → 0 (-2)');
  });
});
