/**
 * DW-88 / DW-92: a transient partner lookup failure must not read as "unlinked".
 *
 * Before this contract split, `getPartnerId` collapsed three different answers
 * into one `null`: "you have no partner", "the `users` read failed", and "any
 * exception at all". The Realtime receivers gate delivery on that value, and
 * both of them clear their snapshot BEFORE the lookup (correctly -- a re-join
 * is exactly when the relationship may have changed). `SUBSCRIBED` fires once
 * on a healthy socket, so nothing re-armed it: one failed round-trip muted a
 * couple's live notes and moods for the life of the mount, with no error shown.
 *
 * These cases drive the real module against a stubbed PostgREST chain, so what
 * is asserted is the CONTRACT -- which answer each failure shape produces, and
 * which of them are retried -- rather than any receiver's use of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';

/** Queue of answers the stubbed `.single()` returns, one per call. */
let singleResults: Array<{ data: unknown; error: unknown }> = [];
let singleCalls = 0;
let sessionResult: { data: { session: unknown }; error: unknown };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => sessionResult,
      // `supabaseClient` installs listeners at import time.
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => {
            const result = singleResults[singleCalls] ?? singleResults.at(-1);
            singleCalls += 1;
            if (result === undefined) throw new Error('no stubbed result');
            return result;
          },
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

const signedIn = { data: { session: { user: { id: USER_ID } } }, error: null };

/** A PostgREST transport failure: not PGRST116, so not an answer about linkage. */
const transportError = {
  data: null,
  error: { code: '500', message: 'upstream request timeout' },
};

const linked = { data: { partner_id: PARTNER_ID }, error: null };

describe('partner lookup contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    singleResults = [];
    singleCalls = 0;
    sessionResult = signedIn;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lookupPartnerId classifies the three answers apart', () => {
    it('reports a linked partner', async () => {
      singleResults = [linked];
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toEqual({
        status: 'linked',
        partnerId: PARTNER_ID,
      });
    });

    it('reports a genuine unlink as unlinked, not as an error', async () => {
      singleResults = [{ data: { partner_id: null }, error: null }];
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toEqual({ status: 'unlinked' });
    });

    it('reports a missing users row (PGRST116) as unlinked', async () => {
      singleResults = [{ data: null, error: { code: 'PGRST116', message: 'no rows' } }];
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toEqual({ status: 'unlinked' });
    });

    it('reports a transport failure as an error rather than as unlinked', async () => {
      singleResults = [transportError];
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toEqual({
        status: 'error',
        reason: 'upstream request timeout',
      });
    });
  });

  describe('resolvePartnerIdForDelivery retries only the error case', () => {
    it('recovers a partner whose first lookup failed transiently', async () => {
      // The regression, exactly: one failed round-trip used to be permanent.
      singleResults = [transportError, linked];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toBe(PARTNER_ID);
      expect(singleCalls).toBe(2);
    });

    it('does not retry a genuine unlink, so an unlinked user pays nothing', async () => {
      singleResults = [{ data: { partner_id: null }, error: null }, linked];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toBeNull();
      // The second stubbed answer is never reached: one call settled it.
      expect(singleCalls).toBe(1);
    });

    it('stays closed, and bounded, when every attempt fails', async () => {
      singleResults = [transportError];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(5000);

      // Null, not a throw: callers keep their fail-closed drop.
      await expect(pending).resolves.toBeNull();
      // Bounded at three; a receiver must not hold its join open indefinitely.
      expect(singleCalls).toBe(3);
    });

    it('treats a failed getSession as an error, not as a signed-out user', async () => {
      // A failed session read is not evidence of being signed out; collapsing
      // it to "unlinked" was the second half of the same defect.
      sessionResult = { data: { session: null }, error: { message: 'network down' } };
      singleResults = [linked];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(pending).resolves.toBeNull();
      // It retried rather than accepting the first answer, and never reached
      // the users table because the session never resolved.
      expect(singleCalls).toBe(0);
    });
  });

  it('getPartnerId keeps its original string-or-null contract for its other callers', async () => {
    singleResults = [transportError];
    const { getPartnerId } = await import('@/api/supabaseClient');
    // Unchanged: still one attempt, still null on failure. The 12 callers that
    // only decide what to render are deliberately untouched by this split.
    await expect(getPartnerId()).resolves.toBeNull();
    expect(singleCalls).toBe(1);
  });

  describe('known offline (DW-222)', () => {
    let onLine: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    });
    afterEach(() => {
      onLine.mockRestore();
    });

    it('lookupPartnerId answers error without querying the users table', async () => {
      singleResults = [linked];
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toEqual({
        status: 'error',
        reason: 'offline',
        offline: true,
      });
      expect(singleCalls).toBe(0);
    });

    it('the delivery lookup does not retry or wait out the backoff', async () => {
      singleResults = [linked];
      const { resolvePartnerLookupForDelivery } = await import('@/api/supabaseClient');
      // Fake timers are on: a backoff would leave this promise pending.
      await expect(resolvePartnerLookupForDelivery()).resolves.toMatchObject({ status: 'error' });
      expect(singleCalls).toBe(0);
    });

    it('getPartnerId is null, with no request', async () => {
      singleResults = [linked];
      const { getPartnerId } = await import('@/api/supabaseClient');
      await expect(getPartnerId()).resolves.toBeNull();
      expect(singleCalls).toBe(0);
    });
  });
});
