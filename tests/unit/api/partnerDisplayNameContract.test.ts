/**
 * DW-104: the chat must never render a partner's email address as their name.
 *
 * `sync_user_profile()` seeds a new profile row with
 * `COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown')`
 * (20251206024345_remote_schema.sql:164), and 20260912030000 deliberately does
 * not backfill the rows already seeded that way. `lookupOwnDisplayName` has
 * always applied that rule to your OWN row, but `getPartnerDisplayName`
 * returned the column verbatim -- so in a couple where neither person had
 * chosen a name, love notes showed you as `person` (the email prefix
 * `LoveNotes.tsx:81` falls back to) and your partner as
 * `partner@example.com`, in full, on every note they sent.
 *
 * Both readers now share `isSeedFallbackName`, so they can no longer disagree
 * about the same column. These cases drive the real module against a stubbed
 * PostgREST chain, so what is asserted is the CONTRACT rather than any
 * consumer's use of it -- the mirror of `ownDisplayNameContract.test.ts`, whose
 * seed cases these deliberately repeat from the partner side.
 *
 * `null` is the answer for a seed, which is the same answer this function
 * already gives for "no partner" and "the read failed". That collapse is
 * deliberate: `LoveNotes.tsx:86` is the only caller and does nothing with the
 * difference except keep its own 'Partner' default.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
/** The caller's own address, which is NOT what a partner row is judged against. */
const OWN_EMAIL = 'me@example.com';
const PARTNER_EMAIL = 'Partner@Example.com';

/**
 * Queue of answers the stubbed `.single()` returns, one per call — this is a
 * two-read call (`partner_id` off the caller's row, then the partner's row), so
 * a single-result stub would answer both reads with the same object. Copied
 * from `partnerLookupContract.test.ts:21-49` for that reason.
 */
let singleResults: Array<{ data: unknown; error: unknown }> = [];
let singleCalls = 0;
let sessionResult: { data: { session: unknown }; error: unknown };
/** Every `.select()` argument, in order, so the added `email` column is pinned. */
let selectedColumns: string[] = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => sessionResult,
      // `supabaseClient` installs listeners at import time.
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: (columns: string) => {
        selectedColumns.push(columns);
        return {
          eq: () => ({
            single: async () => {
              const result = singleResults[singleCalls] ?? singleResults.at(-1);
              singleCalls += 1;
              if (result === undefined) throw new Error('no stubbed result');
              return result;
            },
          }),
        };
      },
    }),
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    realtime: { setAuth: async () => {} },
  }),
}));

const signedIn = {
  data: { session: { user: { id: USER_ID, email: OWN_EMAIL } } },
  error: null,
};

/** The first of the two reads: the caller's row, naming their partner. */
const linked = { data: { partner_id: PARTNER_ID }, error: null };

/** Queue the linkage read, then a partner row carrying these two columns. */
function partnerRow(display_name: unknown, email: unknown = PARTNER_EMAIL): void {
  singleResults = [linked, { data: { display_name, email }, error: null }];
}

async function partnerName() {
  const { getPartnerDisplayName } = await import('@/api/supabaseClient');
  return getPartnerDisplayName();
}

describe('partner display name contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    singleResults = [];
    singleCalls = 0;
    selectedColumns = [];
    sessionResult = signedIn;
  });

  describe('a name the partner chose is returned', () => {
    it('returns the stored name', async () => {
      partnerRow('Jessie');
      await expect(partnerName()).resolves.toBe('Jessie');
    });

    it('trims the stored value, matching the own-name reader', async () => {
      partnerRow('  Jessie  ');
      await expect(partnerName()).resolves.toBe('Jessie');
    });

    it('returns a name for a partner row that has no email to compare against', async () => {
      // Nothing to equal, so nothing is a seed: the name stands.
      partnerRow('Jessie', null);
      await expect(partnerName()).resolves.toBe('Jessie');
    });
  });

  describe('a row still carrying the seed answers null, not an address', () => {
    // The regression, exactly. Each of these is a value `sync_user_profile()`
    // itself can have written, so none is evidence that anyone picked a name —
    // and the first three are the ones that used to reach the chat verbatim.
    it.each([
      ['the partner email', PARTNER_EMAIL],
      ['the partner email in a different case', 'partner@example.com'],
      ['the partner email with stray whitespace', `  ${PARTNER_EMAIL}  `],
      ["'Unknown', the trigger's last-resort seed", 'Unknown'],
      ['the empty string', ''],
      ['whitespace only, which renders as nothing', '   '],
      ['null, the column default before any seed ran', null],
    ])('treats %s as no name', async (_label, display_name) => {
      partnerRow(display_name);
      await expect(partnerName()).resolves.toBeNull();
    });

    it('never returns a value containing the address, not even a prefix', async () => {
      // The bug was visible as "the chat shows an email"; assert that shape
      // directly, so a future fallback that swapped the address for its prefix
      // (which would be someone ELSE's data on the partner side) also fails.
      partnerRow(PARTNER_EMAIL);
      const name = await partnerName();
      expect(name).toBeNull();
      expect(name ?? '').not.toContain('@');
      expect(name ?? '').not.toBe(PARTNER_EMAIL.split('@')[0]);
    });
  });

  describe('the rule is equality against THIS row, and only equality', () => {
    it('keeps a name that merely contains the email', async () => {
      partnerRow(`${PARTNER_EMAIL} (work)`);
      await expect(partnerName()).resolves.toBe(`${PARTNER_EMAIL} (work)`);
    });

    it("keeps 'Unknown' embedded in a longer name", async () => {
      partnerRow('Unknown Soldier');
      await expect(partnerName()).resolves.toBe('Unknown Soldier');
    });

    it("compares against the partner's own email, not the caller's", async () => {
      // A partner who typed the caller's address as their name has made a
      // deliberate, if odd, choice — and judging the partner row against the
      // caller's email would hide real names in the other direction too.
      partnerRow(OWN_EMAIL, PARTNER_EMAIL);
      await expect(partnerName()).resolves.toBe(OWN_EMAIL);
    });

    it('reads the email column it compares against', async () => {
      // Without `email` in the SELECT the predicate is handed `undefined` and
      // silently degrades to only catching '' and 'Unknown' — the seed case
      // this whole contract is about would come back alive with every
      // assertion above still green if the column were dropped.
      partnerRow('Jessie');
      await partnerName();
      expect(selectedColumns).toEqual(['partner_id', 'display_name, email']);
    });
  });

  describe('the non-answers stay null, as before', () => {
    it('answers null when the partner row read fails', async () => {
      singleResults = [linked, { data: null, error: { code: '500', message: 'upstream timeout' } }];
      await expect(partnerName()).resolves.toBeNull();
    });

    it('answers null when there is no partner', async () => {
      singleResults = [{ data: { partner_id: null }, error: null }];
      await expect(partnerName()).resolves.toBeNull();
      // The partner read is never attempted: there is no row to ask for.
      expect(singleCalls).toBe(1);
    });

    it('answers null when the linkage read itself fails', async () => {
      singleResults = [{ data: null, error: { code: '500', message: 'upstream timeout' } }];
      await expect(partnerName()).resolves.toBeNull();
      expect(singleCalls).toBe(1);
    });

    it('answers null when nobody is signed in', async () => {
      sessionResult = { data: { session: null }, error: null };
      await expect(partnerName()).resolves.toBeNull();
      expect(singleCalls).toBe(0);
    });

    it('answers null rather than throwing when the read throws', async () => {
      sessionResult = {
        get data(): { session: unknown } {
          throw new Error('storage unavailable');
        },
        error: null,
      };
      await expect(partnerName()).resolves.toBeNull();
    });
  });
});
