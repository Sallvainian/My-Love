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

const LOOKUP_BACKOFF_MS = [300, 600]; // src/api/supabaseClient.ts LOOKUP_BACKOFF_MS (module-private)

/** Past the whole retry schedule (300 + 600 ms), with 100 ms to spare: 1000 ms. */
const PAST_EVERY_BACKOFF_MS = LOOKUP_BACKOFF_MS.reduce((total, delay) => total + delay, 0) + 100;

/**
 * Five times that: long enough after the last attempt that a fourth one, had
 * the bound slipped, would have run and been counted.
 */
const LONG_AFTER_EVERY_BACKOFF_MS = 5 * PAST_EVERY_BACKOFF_MS;

/** Queue of answers the stubbed users read returns, one per call. */
let singleResults: Array<{ data: unknown; error: unknown }> = [];
let singleCalls = 0;
let sessionResult: { data: { session: unknown }; error: unknown };
/** Runs as each users read is answered, so a test can end the session mid-read. */
let onRead: (() => void) | null = null;

/**
 * One users read. RLS hides every users row from a request sent without a
 * session, so a read answered after a sign-out sees no row: `.single()` turns
 * that into PGRST116 (a 406 on the wire), `.maybeSingle()` into a null row.
 */
async function answerRead(kind: 'single' | 'maybeSingle') {
  const result = singleResults[singleCalls] ?? singleResults.at(-1);
  singleCalls += 1;
  onRead?.();
  if (result === undefined) throw new Error('no stubbed result');
  if (!sessionResult.data.session) {
    return kind === 'single'
      ? { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      : { data: null, error: null };
  }
  return result;
}

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
          single: () => answerRead('single'),
          maybeSingle: () => answerRead('maybeSingle'),
        }),
      }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

const signedIn = { data: { session: { user: { id: USER_ID } } }, error: null };
const signedOut = { data: { session: null }, error: null };

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
    onRead = null;
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

    it('reports a missing users row as unlinked while the session holds', async () => {
      singleResults = [{ data: null, error: null }];
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

  // A sign-out landing while the read is in flight: the read goes out without
  // a session, RLS hides the row, and the empty answer is about the signed-out
  // request -- not evidence that the account is unlinked.
  describe('lookupPartnerId when the session changes during the read', () => {
    it('answers error, not unlinked, when the session ends', async () => {
      singleResults = [linked];
      onRead = () => {
        sessionResult = signedOut;
      };
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toMatchObject({ status: 'error' });
    });

    it('answers error when another account signs in', async () => {
      singleResults = [linked];
      onRead = () => {
        sessionResult = { data: { session: { user: { id: PARTNER_ID } } }, error: null };
      };
      const { lookupPartnerId } = await import('@/api/supabaseClient');
      await expect(lookupPartnerId()).resolves.toMatchObject({ status: 'error' });
    });
  });

  describe('resolvePartnerIdForDelivery retries only the error case', () => {
    it('recovers a partner whose first lookup failed transiently', async () => {
      // The regression, exactly: one failed round-trip used to be permanent.
      singleResults = [transportError, linked];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(PAST_EVERY_BACKOFF_MS);

      await expect(pending).resolves.toBe(PARTNER_ID);
      expect(singleCalls).toBe(2);
    });

    it('does not retry a genuine unlink, so an unlinked user pays nothing', async () => {
      singleResults = [{ data: { partner_id: null }, error: null }, linked];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(PAST_EVERY_BACKOFF_MS);

      await expect(pending).resolves.toBeNull();
      // The second stubbed answer is never reached: one call settled it.
      expect(singleCalls).toBe(1);
    });

    it('stays closed, and bounded, when every attempt fails', async () => {
      singleResults = [transportError];
      const { resolvePartnerIdForDelivery } = await import('@/api/supabaseClient');

      const pending = resolvePartnerIdForDelivery();
      await vi.advanceTimersByTimeAsync(LONG_AFTER_EVERY_BACKOFF_MS);

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
      await vi.advanceTimersByTimeAsync(LONG_AFTER_EVERY_BACKOFF_MS);

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
