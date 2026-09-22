/**
 * The two user-facing creates are retry-safe and bounded.
 *
 * `anniversariesService.createAnniversary` and `customMessagesApi.createCustomMessage`
 * write with ON CONFLICT DO NOTHING on `UNIQUE (user_id, client_key)`, using a
 * key the form mints once per submit and reuses on a retry of that submit
 * (`useSubmitKey`). A response lost after the server committed therefore
 * resolves, on retry, to the stored row — never a second one. And because
 * they are retry-safe they carry the request timeout, so a stalled create no
 * longer holds the strict account-data queue.
 *
 * The Supabase client here is a small stateful fake that stores rows and
 * enforces the unique key, so "exactly one row" is read back from its table
 * rather than inferred from call arguments.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Outcome = 'ok' | 'lose-response' | 'stall';

const fake = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  const plan: Array<'ok' | 'lose-response' | 'stall'> = [];
  let nextId = 0;
  const lost = { data: null, error: { message: 'TypeError: Load failed', details: '', hint: '', code: '' } };
  const aborted = { data: null, error: { message: 'AbortError: signal is aborted', details: '', hint: '', code: '' } };

  function builder(table: string) {
    const state: {
      upsert?: { row: Row; ignoreDuplicates: boolean };
      filters: Array<[string, unknown]>;
      signal?: AbortSignal;
    } = { filters: [] };

    const execute = (): Promise<{ data: Row | null; error: unknown }> => {
      const outcome = plan.shift() ?? 'ok';
      if (outcome === 'stall') {
        // Never answers; only the caller's abort signal ends it.
        return new Promise((resolve) => {
          state.signal?.addEventListener('abort', () => resolve(aborted));
        });
      }
      const rows = tables.get(table) ?? [];
      tables.set(table, rows);
      let result: Row | null;
      if (state.upsert) {
        const { row } = state.upsert;
        const clash = rows.find((r) => r.user_id === row.user_id && r.client_key === row.client_key);
        if (clash) {
          result = null; // ON CONFLICT DO NOTHING returns no row
        } else {
          const stamp = '2026-09-22T00:00:00.000Z';
          const stored = { id: `row-${++nextId}`, created_at: stamp, updated_at: stamp, ...row };
          rows.push(stored);
          result = stored;
        }
      } else {
        result = rows.find((r) => state.filters.every(([col, val]) => r[col] === val)) ?? null;
      }
      // The server committed; the client never hears about it.
      if (outcome === 'lose-response') return Promise.resolve(lost);
      return Promise.resolve({ data: result, error: null });
    };

    const chain = {
      upsert(row: Row, opts: { ignoreDuplicates?: boolean }) {
        state.upsert = { row, ignoreDuplicates: opts.ignoreDuplicates === true };
        return chain;
      },
      select() {
        return chain;
      },
      eq(col: string, val: unknown) {
        state.filters.push([col, val]);
        return chain;
      },
      abortSignal(signal: AbortSignal) {
        state.signal = signal;
        return chain;
      },
      maybeSingle() {
        return execute();
      },
    };
    return chain;
  }

  return {
    tables,
    plan,
    supabase: { from: (table: string) => builder(table) },
    reset() {
      tables.clear();
      plan.length = 0;
      nextId = 0;
    },
  };
});

vi.mock('../../../src/api/supabaseClient', () => ({ supabase: fake.supabase }));

import { AccountDataError } from '../../../src/services/accountDataError';
import { serializeAccountDataWrite } from '../../../src/services/accountDataQueue';
import { anniversariesService } from '../../../src/services/anniversariesService';
import { customMessagesApi } from '../../../src/services/customMessagesApi';

const A = 'USER-A';
const anniversary = { date: '2024-02-14', label: 'First date' };
const message = { text: 'You make every day better', category: 'custom' as const, active: true, tags: [] };

const creates: Array<[table: string, create: (key: string) => Promise<{ serverId: string }>]> = [
  ['anniversaries', (key) => anniversariesService.createAnniversary(A, anniversary, key)],
  ['custom_messages', (key) => customMessagesApi.createCustomMessage(A, message, key)],
];

function plan(...outcomes: Outcome[]) {
  fake.plan.push(...outcomes);
}

beforeEach(() => {
  fake.reset();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(creates)('%s create', (table, create) => {
  it('a lost response followed by a retry with the same key stores exactly one row', async () => {
    plan('lose-response');
    const first = await create('submit-1').catch((error: unknown) => error);
    expect(first).toBeInstanceOf(AccountDataError);
    expect(fake.tables.get(table)).toHaveLength(1); // the server did commit

    // The retry: the upsert conflicts and returns nothing, the read-back by
    // key returns the row the first attempt stored.
    const retried = await create('submit-1');

    expect(fake.tables.get(table)).toHaveLength(1);
    expect(retried.serverId).toBe(fake.tables.get(table)![0].id);
  });

  it('a different key (an edited submit) is a different row', async () => {
    await create('submit-1');
    await create('submit-2');
    expect(fake.tables.get(table)).toHaveLength(2);
  });

  it('a stalled create is abandoned by its timeout and no longer blocks the next save', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    plan('stall');

    const stalled = serializeAccountDataWrite(() => create('submit-1'));
    const nextSave = vi.fn(async () => 'saved');
    const queued = serializeAccountDataWrite(nextSave);

    // Held while the create is pending: the queue is strict.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(nextSave).not.toHaveBeenCalled();

    controller.abort(); // what REQUEST_TIMEOUT_MS does to a stalled socket
    await expect(stalled).rejects.toMatchObject({ code: 'transport' });
    await expect(queued).resolves.toBe('saved');
  });
});
