/**
 * `partnerService.searchUsers`: the exact-email partner search.
 *
 * The users SELECT policy hides every row but the caller's own and their
 * partner's, so the search goes through the SECURITY DEFINER RPC
 * `find_partner_by_email` (20260926000000_find_partner_by_email.sql), which
 * answers no row (no such account, or the caller), one unlinked row
 * (`is_taken = false`, id and name), or one taken row (`is_taken = true`, id
 * and name null). This pins how each answer, and a failed request, maps to a
 * `PartnerSearchResult`, and that no table read happens.
 *
 * The real `supabaseClient` and `partnerService` run against a stubbed
 * supabase-js client, the harness of partnerService.sendRequest.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TARGET_ID = '33333333-3333-4333-8333-333333333333';

type Row = { id: string | null; display_name: string | null; is_taken: boolean };

/** What the RPC answers with next. */
let rpcAnswer: { data: Row[] | null; error: { code: string; message: string } | null };
/** Every request the service sent, in order. */
let requests: Array<{ kind: string; name?: string; args?: unknown }>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => {
        requests.push({ kind: 'getUser' });
        return { data: { user: { id: 'caller' } }, error: null };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      // `supabaseClient` installs listeners at import time.
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: async (name: string, args: unknown) => {
      requests.push({ kind: 'rpc', name, args });
      return rpcAnswer;
    },
    from: (table: string) => {
      requests.push({ kind: 'from', name: table });
      throw new Error(`unexpected table read: ${table}`);
    },
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

async function search(email: string) {
  const { partnerService } = await import('@/api/partnerService');
  return partnerService.searchUsers(email);
}

describe('partnerService.searchUsers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcAnswer = { data: [], error: null };
    requests = [];
  });

  it('asks the RPC with the trimmed address and nothing else', async () => {
    await search('  Jessie@Example.test ');

    // Case is the server's job (lower() on both sides); only whitespace goes here.
    expect(requests).toEqual([
      { kind: 'rpc', name: 'find_partner_by_email', args: { p_email: 'Jessie@Example.test' } },
    ]);
  });

  it('found: an unlinked account comes back with its id, name and the typed address', async () => {
    rpcAnswer = {
      data: [{ id: TARGET_ID, display_name: ' Jessie ', is_taken: false }],
      error: null,
    };

    expect(await search(' jessie@example.test ')).toEqual({
      status: 'found',
      user: { id: TARGET_ID, email: 'jessie@example.test', displayName: 'Jessie' },
    });
  });

  it.each([
    ['the address itself', 'jessie@example.test'],
    ['the address in another case', 'JESSIE@example.test'],
    ["the trigger's last resort", 'Unknown'],
    ['nothing', null],
    ['blank', '  '],
  ])('found: a seed name (%s) is not shown as a name', async (_label, seed) => {
    rpcAnswer = { data: [{ id: TARGET_ID, display_name: seed, is_taken: false }], error: null };

    const result = await search('jessie@example.test');

    expect(result).toEqual({
      status: 'found',
      user: { id: TARGET_ID, email: 'jessie@example.test', displayName: null },
    });
  });

  it('taken: an account that already has a partner is reported as taken, nothing more', async () => {
    rpcAnswer = { data: [{ id: null, display_name: null, is_taken: true }], error: null };

    expect(await search('jessie@example.test')).toEqual({ status: 'taken' });
  });

  it('missing: no row (no such account, or the caller) is "missing"', async () => {
    rpcAnswer = { data: [], error: null };

    expect(await search('nobody@example.test')).toEqual({ status: 'missing' });
  });

  it.each(['', '   ', 'jessie', 'jessie@', 'jessie@example', '@example.test', 'jes sie@example.test'])(
    'missing, without a request: %j cannot be anyone\'s sign-in email',
    async (query) => {
      expect(await search(query)).toEqual({ status: 'missing' });
      expect(requests).toEqual([]);
    }
  );

  it('error: a failed request is an error, never "missing"', async () => {
    rpcAnswer = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };

    expect(await search('jessie@example.test')).toEqual({
      status: 'error',
      reason: 'JWT expired',
    });
  });

  it('error: a thrown request is an error, never "missing"', async () => {
    const { supabase } = await import('@/api/supabaseClient');
    vi.spyOn(supabase, 'rpc').mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await search('jessie@example.test')).toEqual({
      status: 'error',
      reason: 'Failed to fetch',
    });
  });

  it('error: an untaken row without an id is refused rather than offered', async () => {
    rpcAnswer = { data: [{ id: null, display_name: 'Jessie', is_taken: false }], error: null };

    expect(await search('jessie@example.test')).toMatchObject({ status: 'error' });
  });
});
