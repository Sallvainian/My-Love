/**
 * Story 8 (CAP-9 / F9): which stored names count as "the user chose this".
 *
 * `sync_user_profile()` seeds a new profile row with
 * `COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown')`
 * (20251206024345_remote_schema.sql:164), and 20260912030000 deliberately does
 * NOT backfill the rows that were already seeded that way. So the only thing
 * separating "has a name" from "still needs the setup screen" is this
 * classification, and App gates the setup modal on it.
 *
 * The third answer matters as much as the other two: a failed read is not
 * evidence that the user has no name, and collapsing it into `unset` shoves an
 * established account back into the setup modal on one transient 5xx. Same
 * three-way split, for the same reason, as `partnerLookupContract.test.ts`.
 *
 * These cases drive the real module against a stubbed PostgREST chain, so what
 * is asserted is the contract rather than any consumer's use of it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'Person@Example.com';

let singleResult: { data: unknown; error: unknown };
let sessionResult: { data: { session: unknown }; error: unknown };
/** Runs as the profile read is answered, so a test can end the session mid-read. */
let onRead: (() => void) | null = null;

/**
 * The profile read. RLS hides every users row from a request sent without a
 * session, so a read answered after a sign-out sees no row: `.single()` turns
 * that into PGRST116 (a 406 on the wire), `.maybeSingle()` into a null row.
 */
async function answerRead(kind: 'single' | 'maybeSingle') {
  onRead?.();
  if (!sessionResult.data.session) {
    return kind === 'single'
      ? { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      : { data: null, error: null };
  }
  return singleResult;
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

const signedIn = { data: { session: { user: { id: USER_ID, email: EMAIL } } }, error: null };

/** A successful read of the caller's profile row. */
function profileRow(display_name: string | null) {
  return { data: { display_name }, error: null };
}

async function lookup() {
  const { lookupOwnDisplayName } = await import('@/api/supabaseClient');
  return lookupOwnDisplayName();
}

describe('own display name contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sessionResult = signedIn;
    onRead = null;
  });

  describe('the seed fallbacks all read as "no name chosen"', () => {
    // Each of these is a value `sync_user_profile()` itself can have written,
    // so none of them is evidence that anyone picked a name.
    it.each([
      ['null, the column default before any seed ran', null],
      ['the empty string', ''],
      ['whitespace only, which renders as nothing', '   '],
      ["'Unknown', the trigger's last-resort seed", 'Unknown'],
      ['the account email, the trigger\'s second seed', EMAIL],
      ['the account email in a different case', 'person@example.com'],
      ['the account email with stray whitespace', `  ${EMAIL}  `],
    ])('treats %s as unset', async (_label, display_name) => {
      singleResult = profileRow(display_name);
      await expect(lookup()).resolves.toEqual({ status: 'unset' });
    });
  });

  describe('a chosen name is returned as chosen', () => {
    it('returns a name the user picked', async () => {
      singleResult = profileRow('Jessie');
      await expect(lookup()).resolves.toEqual({ status: 'chosen', displayName: 'Jessie' });
    });

    it('trims the stored value rather than rejecting it', async () => {
      singleResult = profileRow('  Jessie  ');
      await expect(lookup()).resolves.toEqual({ status: 'chosen', displayName: 'Jessie' });
    });

    it("accepts a name that merely contains the email, rather than equalling it", async () => {
      singleResult = profileRow(`${EMAIL} (work)`);
      await expect(lookup()).resolves.toEqual({
        status: 'chosen',
        displayName: `${EMAIL} (work)`,
      });
    });

    it('accepts the literal email of a DIFFERENT account', async () => {
      // Only the caller's OWN email is a seed value. Someone else's is a
      // deliberate, if odd, choice.
      singleResult = profileRow('someone.else@example.com');
      await expect(lookup()).resolves.toEqual({
        status: 'chosen',
        displayName: 'someone.else@example.com',
      });
    });

    it("accepts 'Unknown' embedded in a longer name", async () => {
      singleResult = profileRow('Unknown Soldier');
      await expect(lookup()).resolves.toEqual({
        status: 'chosen',
        displayName: 'Unknown Soldier',
      });
    });

    it('keeps a chosen name when the session carries no email at all', async () => {
      sessionResult = { data: { session: { user: { id: USER_ID } } }, error: null };
      singleResult = profileRow('Jessie');
      await expect(lookup()).resolves.toEqual({ status: 'chosen', displayName: 'Jessie' });
    });
  });

  describe('a failed read is its own answer', () => {
    it('reports a transport failure as error, not as unset', async () => {
      singleResult = { data: null, error: { code: '500', message: 'upstream request timeout' } };
      await expect(lookup()).resolves.toEqual({
        status: 'error',
        reason: 'upstream request timeout',
      });
    });

    it('reports a thrown read as error', async () => {
      sessionResult = {
        get data(): { session: unknown } {
          throw new Error('storage unavailable');
        },
        error: null,
      };
      await expect(lookup()).resolves.toEqual({
        status: 'error',
        reason: 'storage unavailable',
      });
    });

    it('reports a missing session as error rather than opening setup', async () => {
      sessionResult = { data: { session: null }, error: null };
      await expect(lookup()).resolves.toEqual({
        status: 'error',
        reason: 'No authenticated session',
      });
    });

    it('surfaces a session error message when there is one', async () => {
      sessionResult = { data: { session: null }, error: { message: 'refresh token expired' } };
      await expect(lookup()).resolves.toEqual({
        status: 'error',
        reason: 'refresh token expired',
      });
    });

    // No row while the session holds is not a failure: the profile simply is
    // not there to have a name. DisplayNameSetup fails closed on the write side
    // by checking that its UPDATE matched a row.
    it('treats a missing profile row as unset while the session holds', async () => {
      singleResult = { data: null, error: null };
      await expect(lookup()).resolves.toEqual({ status: 'unset' });
    });
  });

  // A sign-out landing while the read is in flight: the read goes out without
  // a session, RLS hides the row, and the empty answer says nothing about
  // whether the account chose a name -- `unset` would open the setup modal.
  describe('the session changing during the read', () => {
    it('answers error, not unset, when the session ends', async () => {
      singleResult = profileRow('Jessie');
      onRead = () => {
        sessionResult = { data: { session: null }, error: null };
      };
      await expect(lookup()).resolves.toMatchObject({ status: 'error' });
    });

    it('answers error when another account signs in', async () => {
      singleResult = profileRow('Jessie');
      onRead = () => {
        sessionResult = {
          data: { session: { user: { id: '33333333-3333-4333-8333-333333333333' } } },
          error: null,
        };
      };
      await expect(lookup()).resolves.toMatchObject({ status: 'error' });
    });
  });

  describe('getOwnDisplayName collapses the three answers for renderers', () => {
    it.each([
      ['a chosen name', profileRow('Jessie'), 'Jessie'],
      ['a seed fallback', profileRow(EMAIL), null],
      ['a failed read', { data: null, error: { code: '500', message: 'boom' } }, null],
    ])('returns %s', async (_label, result, expected) => {
      singleResult = result;
      const { getOwnDisplayName } = await import('@/api/supabaseClient');
      await expect(getOwnDisplayName()).resolves.toBe(expected);
    });
  });
});
