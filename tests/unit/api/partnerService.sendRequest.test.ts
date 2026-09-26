/**
 * DW-292: what `sendPartnerRequest` reads before it inserts, and what it does
 * when that read is answered for a request the session no longer backs.
 *
 * The users SELECT policy ("Users can view self and partner profiles",
 * 20260925000000_rls_initplan_photos_users.sql) returns the caller's own row
 * and their partner's, nothing else. A read of the target's row therefore sees
 * no row for every target a request can be sent to, so a "target already has a
 * partner" check on the client never fired and only produced a 406. The server
 * refuses the link at accept time instead: `accept_partner_request` raises
 * 'One or both users already have a partner'
 * (20260818000000_revoke_anon_execute_and_fix_partner_guards.sql).
 *
 * The real `supabaseClient` and `partnerService` run against a stubbed
 * supabase-js client that applies that policy, copying the harness of
 * partnerServiceDisplayName.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';

/** Whose session the client holds; `null` is signed out. */
let sessionUserId: string | null;
/** The caller's own users row, as the server holds it. */
let ownRow: { partner_id: string | null };
/** An error the own-row read answers with, instead of the row. */
let ownReadError: { code: string; message: string } | null;
/** Runs as each users read is answered, so a test can sign out mid-read. */
let onRead: (() => void) | null;
/** Every request the service sent, in order. */
let requests: string[];

/** One users read, filtered by the SELECT policy: own row only. */
async function answerRead(kind: 'single' | 'maybeSingle', id: string) {
  requests.push(`read users ${id === USER_ID ? 'own' : id === TARGET_ID ? 'target' : id}`);
  onRead?.();
  if (id === USER_ID && ownReadError) return { data: null, error: ownReadError };
  const visible = sessionUserId !== null && id === sessionUserId;
  if (visible) return { data: ownRow, error: null };
  return kind === 'single'
    ? { data: null, error: { code: 'PGRST116', message: 'no rows' }, status: 406 }
    : { data: null, error: null };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => {
        requests.push('getUser');
        return { data: { user: sessionUserId ? { id: sessionUserId } : null }, error: null };
      },
      getSession: async () => ({
        data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
        error: null,
      }),
      // `supabaseClient` installs listeners at import time.
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          single: () => answerRead('single', id),
          maybeSingle: () => answerRead('maybeSingle', id),
        }),
      }),
      insert: async (row: { from_user_id: string }) => {
        requests.push('insert');
        // "Users can create partner requests": WITH CHECK auth.uid() = from_user_id.
        return sessionUserId === row.from_user_id
          ? { error: null }
          : {
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "partner_requests"',
              },
            };
      },
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

async function send() {
  const { partnerService } = await import('@/api/partnerService');
  return partnerService.sendPartnerRequest(TARGET_ID);
}

describe('partnerService.sendPartnerRequest (DW-292)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sessionUserId = USER_ID;
    ownRow = { partner_id: null };
    ownReadError = null;
    onRead = null;
    requests = [];
  });

  it('never reads the target user row, which the users policy hides', async () => {
    await send();

    expect(requests).toEqual(['getUser', 'read users own', 'insert']);
  });

  it('still refuses when the caller already has a partner, before inserting', async () => {
    ownRow = { partner_id: '22222222-2222-4222-8222-222222222222' };

    await expect(send()).rejects.toThrow('You already have a partner');
    expect(requests).not.toContain('insert');
  });

  it('refuses without inserting when the own-row read fails', async () => {
    ownReadError = { code: '500', message: 'server down' };

    await expect(send()).rejects.toMatchObject({ message: 'server down' });
    expect(requests).not.toContain('insert');
  });

  // A sign-out landing mid-read sends the read without a session, RLS hides
  // the row, and the empty answer is not "no partner".
  it('refuses without inserting when the session ends during the own-row read', async () => {
    onRead = () => {
      sessionUserId = null;
    };

    await expect(send()).rejects.toThrow('Not authenticated');
    expect(requests).not.toContain('insert');
  });

  it('refuses without inserting when another account signs in during the own-row read', async () => {
    onRead = () => {
      sessionUserId = TARGET_ID;
    };

    await expect(send()).rejects.toThrow('Signed-in account changed');
    expect(requests).not.toContain('insert');
  });
});
