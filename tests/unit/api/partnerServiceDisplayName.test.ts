/**
 * DW-133: the third reader of `users.display_name`, on the partner-mood surface.
 *
 * `sync_user_profile()` seeds a new profile row with
 * `COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown')`
 * (20251206024345_remote_schema.sql:164), and 20260912030000 deliberately does
 * not backfill the rows already seeded that way -- so every reader of that
 * column has to decide for itself which stored values still mean "no name
 * chosen".
 *
 * `partnerService.getPartner` did not decide. It composed
 * `display_name || email || 'Partner'`, and the seed is a non-empty string in
 * all three COALESCE cases, so the `||` never fell through: for the exact
 * DW-104 couple -- a partner row still carrying the email seed -- love notes
 * correctly showed 'Partner' while `PartnerMoodView` rendered the full address
 * three times from the same stored row, including in the page heading
 * (`PartnerMoodView.tsx:536`, `:566`, `:629`).
 *
 * The seed table below is repeated verbatim from
 * `partnerDisplayNameContract.test.ts:124-135`, on purpose. These are two
 * different functions reading one column, and the bug both times was that they
 * disagreed about it; asserting the same inputs against both is what makes a
 * future divergence fail rather than ship. The expectations differ because the
 * contracts do -- `getPartnerDisplayName` answers `null` and lets its caller
 * supply a default, while `getPartner` returns a rendered `PartnerInfo` whose
 * `displayName` goes straight to the screen, so the default is applied here.
 *
 * The real module is driven against a stubbed PostgREST chain, copying the
 * harness of that sibling file, so what is asserted is the contract rather than
 * any consumer's use of it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const OWN_EMAIL = 'me@example.com';
/** Mixed case on purpose: the seed rule compares case-insensitively. */
const PARTNER_EMAIL = 'Partner@Example.com';

let singleResults: Array<{ data: unknown; error: unknown }> = [];
let singleCalls = 0;
/** Whose session the client holds; `null` is signed out. */
let sessionUserId: string | null;
let sessionError: { message: string } | null;
/** Runs as each users read is answered, so a test can sign out mid-read. */
let onRead: ((call: number) => void) | null;

/**
 * One users read. RLS hides every users row from a request sent without a
 * session, so a read answered after a sign-out sees no row: `.single()` turns
 * that into PGRST116, `.maybeSingle()` into a null row.
 */
async function answerRead(kind: 'single' | 'maybeSingle') {
  const call = singleCalls;
  singleCalls += 1;
  onRead?.(call);
  const result = singleResults[call] ?? singleResults.at(-1);
  if (result === undefined) throw new Error('no stubbed result');
  if (sessionUserId === null) {
    return kind === 'single'
      ? { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      : { data: null, error: null };
  }
  return result;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        sessionUserId
          ? { data: { user: { id: sessionUserId, email: OWN_EMAIL } }, error: sessionError }
          : { data: { user: null }, error: sessionError },
      getSession: async () => ({
        data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
        error: sessionError,
      }),
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

/** The first of the two reads: the caller's row, naming their partner. */
const linked = {
  data: { partner_id: PARTNER_ID, updated_at: '2026-01-01T00:00:00Z' },
  error: null,
};

/** Queue the linkage read, then a partner row carrying these columns. */
function partnerRow(display_name: unknown, email: unknown = PARTNER_EMAIL): void {
  singleResults = [linked, { data: { id: PARTNER_ID, display_name, email }, error: null }];
}

async function partner() {
  const { partnerService } = await import('@/api/partnerService');
  const result = await partnerService.getPartner(USER_ID);
  return result.status === 'linked' ? result.partner : null;
}

function resetHarness(): void {
  singleResults = [];
  singleCalls = 0;
  sessionUserId = USER_ID;
  sessionError = null;
  onRead = null;
}

describe('partnerService.getPartner display name', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetHarness();
  });

  describe('a row carrying only what the trigger seeded', () => {
    it.each([
      ['the partner email', PARTNER_EMAIL],
      ['the partner email in a different case', 'partner@example.com'],
      ['the partner email with stray whitespace', `  ${PARTNER_EMAIL}  `],
      ["'Unknown', the trigger's last-resort seed", 'Unknown'],
      ['the empty string', ''],
      ['whitespace only, which renders as nothing', '   '],
      ['null, the column default before any seed ran', null],
    ])('renders %s as the neutral default', async (_label, display_name) => {
      partnerRow(display_name);

      const result = await partner();

      expect(result?.displayName).toBe('Partner');
      // The address must not survive anywhere in the rendered name. This is
      // the whole point of the entry: it was appearing in an <h1>.
      expect(result?.displayName.toLowerCase()).not.toContain('@');
    });
  });

  describe('a name someone actually chose', () => {
    it.each([
      ['an ordinary name', 'Alex', 'Alex'],
      ['a name padded with whitespace', '  Alex  ', 'Alex'],
      // Equality, not containment: these are names someone typed.
      ["a name that merely contains the seed word", 'Unknown Soldier', 'Unknown Soldier'],
      ['a name that merely contains an address', 'p@example.com (work)', 'p@example.com (work)'],
      // Someone else's address is a deliberate choice, if an odd one. The seed
      // rule compares against the row's OWN email, not any address at all.
      ['a different address entirely', 'someone.else@example.com', 'someone.else@example.com'],
    ])('keeps %s', async (_label, display_name, expected) => {
      partnerRow(display_name);

      const result = await partner();

      expect(result?.displayName).toBe(expected);
    });
  });

  it('still returns the partner id and email alongside the neutral name', async () => {
    // The name is neutralised; the record is not. `PartnerMoodView` needs the
    // id to load moods, and a fix that emptied the whole record to hide the
    // address would break the surface it was meant to correct.
    partnerRow(PARTNER_EMAIL);

    const result = await partner();

    expect(result?.id).toBe(PARTNER_ID);
    expect(result?.email).toBe(PARTNER_EMAIL);
    expect(result?.displayName).toBe('Partner');
  });

  it('answers null when there is no partner at all', async () => {
    singleResults = [{ data: { partner_id: null, updated_at: null }, error: null }];

    await expect(partner()).resolves.toBeNull();
  });
});

describe('partnerService.getPartner classification', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetHarness();
  });

  async function status() {
    const { partnerService } = await import('@/api/partnerService');
    return (await partnerService.getPartner(USER_ID)).status;
  }

  it('answers linked with the partner when both reads succeed', async () => {
    partnerRow('Alex');

    await expect(status()).resolves.toBe('linked');
  });

  it('answers unlinked when the user row has no partner_id', async () => {
    singleResults = [{ data: { partner_id: null, updated_at: null }, error: null }];

    await expect(status()).resolves.toBe('unlinked');
  });

  it('answers unlinked when the signed-in user has no users row yet', async () => {
    singleResults = [{ data: null, error: null }];

    await expect(status()).resolves.toBe('unlinked');
  });

  it('answers error, not unlinked, when the user-row read fails', async () => {
    singleResults = [{ data: null, error: { code: '500', message: 'server down' } }];

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when the session read fails', async () => {
    sessionError = { message: 'Failed to fetch' };

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when there is no signed-in user', async () => {
    sessionUserId = null;

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when a different account holds the session', async () => {
    partnerRow('Alex');
    sessionUserId = PARTNER_ID;

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when the partner-row read fails', async () => {
    singleResults = [linked, { data: null, error: { code: '500', message: 'server down' } }];

    await expect(status()).resolves.toBe('error');
  });

  // DW-264: a sign-out that lands while a read is in flight. The rest of the
  // lookup goes out without a session, RLS hides the row, and the empty answer
  // is about the signed-out request -- not evidence that the account is
  // unlinked, which the slice would save to the account's local copy.
  it('answers error, not unlinked, when the session ends during the user-row read', async () => {
    partnerRow('Alex');
    onRead = (call) => {
      if (call === 0) sessionUserId = null;
    };

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when the session ends during the partner-row read', async () => {
    partnerRow('Alex');
    onRead = (call) => {
      if (call === 1) sessionUserId = null;
    };

    await expect(status()).resolves.toBe('error');
  });

  it('answers error when another account signs in during the user-row read', async () => {
    partnerRow('Alex');
    onRead = (call) => {
      if (call === 0) sessionUserId = PARTNER_ID;
    };

    await expect(status()).resolves.toBe('error');
  });
});
