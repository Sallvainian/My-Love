/**
 * P0/P1 API: the wire contract the 23514 mapping depends on
 *
 * `src/api/errorHandlers.ts:66` maps SQLSTATE `23514` to a generic sentence.
 * The unit tests (`tests/unit/api/errorHandlers.test.ts`) pin the map, and
 * `tests/unit/api/checkConstraintMapping.test.ts` pins that each adopter's
 * catch tail reaches it. Both feed the mapper an envelope a test author wrote
 * down. Neither can tell you the server still sends that envelope.
 *
 * That gap is not theoretical. `handleSupabaseError` is only consulted when
 * `isPostgrestError` returns true, and that guard (`src/api/errorHandlers.ts:109-117`)
 * requires `code`, `message` AND `details` to be present on the body. PostgREST
 * sends `details` as JSON `null` for an authenticated CHECK rejection — present,
 * but empty. If a future PostgREST omitted the key instead, the guard would go
 * false, every adopter would route its rejection into a network tail, and the
 * user would be told their change "will be synced when you're back online"
 * about a write the database refused outright. Every unit test in the repo
 * would still be green.
 *
 * So this file drives the real rejection against the running local stack and
 * feeds the body it gets back through the production mapper. It is the only
 * place the two halves meet.
 *
 * ## Why these writes need no cleanup
 *
 * Every request here is one the database REJECTS. A failed INSERT commits no
 * row, so nothing is created, nothing is owned, and nothing is torn down — the
 * last test asserts that rather than assuming it. That matters under
 * `AGENTS.md`'s rule that a spec must not null a shared row at teardown: this
 * one has no teardown at all.
 *
 * ## Why service_role is not used
 *
 * `src/api/supabaseClient.ts:55` builds the browser client with the publishable
 * key, so the app always speaks as `authenticated`. Postgres shows the failing
 * row (`details`) only to a privileged role, so a probe run as service_role
 * would assert against a body the app never receives. Every request below
 * carries a real user's JWT.
 */
import { test, expect } from '../support/merged-fixtures';
import { getWorkerPairEmails } from '../support/auth/worker-pool';
import { getUserAccessToken } from '../support/helpers/supabase';
import type { TypedSupabaseClient } from '../support/factories';
import {
  CHECK_VIOLATION_CODE,
  CHECK_VIOLATION_HTTP_STATUS,
  CHECK_VIOLATION_MESSAGE,
  LEAK_MARKERS,
  type PostgrestErrorEnvelope,
} from '../support/check-constraint-envelopes';
import { handleSupabaseError, isPostgrestError } from '../../src/api/errorHandlers';

/** `events.label` is `check (char_length(label) <= 100)`. 101 characters clears it. */
const OVER_LONG_LABEL = 'x'.repeat(101);

/** `moods.note` is `check (char_length(note) <= 500)`. */
const OVER_LONG_NOTE = 'n'.repeat(501);

/**
 * Resolve this worker's own `public.users.id`.
 *
 * Mirrors `tests/e2e/settings/events-crud.spec.ts:37-69`, kept self-contained
 * there and here because the factory helper it mirrors is not exported.
 */
async function resolveOwnUserId(supabaseAdmin: TypedSupabaseClient): Promise<string> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnUserId: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', pair.user1Email)
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not resolve app user for ${pair.user1Email}: ${error?.message ?? 'not found'}`
    );
  }

  return data.id;
}

test.describe('CHECK-constraint rejections over the wire', () => {
  /**
   * The three tables carrying a CHECK constraint that is written through a
   * module importing `handleSupabaseError`. Measured from `pg_constraint`:
   * `events` has three such constraints, `moods` three, `interactions` one.
   * The other seven CHECK constraints in `public` sit on `love_notes`,
   * `partner_requests`, `photos` and `scripture_reflections`, none of which
   * route through the mapper — see this spec's sibling summary.
   */
  const REJECTIONS = [
    {
      table: 'events',
      constraint: 'events_label_check',
      context: 'EventsService.createEvent',
      priority: 'P0',
      body: (userId: string) => ({
        user_id: userId,
        label: OVER_LONG_LABEL,
        event_date: '2030-01-01',
      }),
    },
    {
      table: 'interactions',
      constraint: 'interactions_type_check',
      context: 'InteractionService.sendInteraction',
      priority: 'P1',
      body: (userId: string) => ({
        type: 'hug',
        from_user_id: userId,
        to_user_id: userId,
      }),
    },
    {
      table: 'moods',
      constraint: 'moods_note_check',
      context: 'MoodApi.create',
      priority: 'P1',
      body: (userId: string) => ({
        user_id: userId,
        mood_type: 'happy',
        note: OVER_LONG_NOTE,
      }),
    },
  ] as const;

  for (const rejection of REJECTIONS) {
    test(`[${rejection.priority}] ${rejection.constraint} rejects with an envelope the mapper turns into the generic sentence`, async ({
      apiRequest,
      supabaseAdmin,
    }) => {
      const userId = await resolveOwnUserId(supabaseAdmin);
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const { status, body } = await apiRequest<PostgrestErrorEnvelope>({
        method: 'POST',
        path: `/rest/v1/${rejection.table}`,
        headers: { Authorization: `Bearer ${userToken}` },
        body: rejection.body(userId),
      });

      // The server's half of the contract.
      expect(status).toBe(CHECK_VIOLATION_HTTP_STATUS);
      expect(body.code).toBe(CHECK_VIOLATION_CODE);
      expect(body.message).toContain(`check constraint "${rejection.constraint}"`);
      // The guard that decides whether the map is consulted at all. Asserted
      // on the live body, not on a fixture, because that is the whole point of
      // this file.
      expect(isPostgrestError(body)).toBe(true);

      // The app's half: this is the exact call each adopter's catch tail makes.
      const mapped = handleSupabaseError(
        body as unknown as Parameters<typeof handleSupabaseError>[0],
        rejection.context
      );

      expect(mapped.message).toBe(`[${rejection.context}] ${CHECK_VIOLATION_MESSAGE}`);
      for (const marker of LEAK_MARKERS) {
        expect(mapped.message).not.toContain(marker);
      }
      expect(mapped.message).not.toContain(rejection.constraint);
      expect(mapped.message).not.toContain(rejection.table);
    });
  }

  test('[P1] the server withholds the failing row from an authenticated caller, but still sends the details key', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const userId = await resolveOwnUserId(supabaseAdmin);
    const userToken = await getUserAccessToken(supabaseAdmin, userId);

    const { body } = await apiRequest<PostgrestErrorEnvelope>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { user_id: userId, label: OVER_LONG_LABEL, event_date: '2030-01-01' },
    });

    // Two separate claims, and the mapping depends on the second one.
    //
    // 1. The value is null — Postgres shows `Failing row contains (…)`, which
    //    quotes the user's own input back, only to a privileged role. Probed
    //    as service_role the same rejection DOES carry it, which is why this
    //    is asserted rather than assumed.
    expect(body.details).toBeNull();
    // 2. The key is nonetheless present, which is the only thing
    //    `isPostgrestError` looks at. Drop the key and the mapper is never
    //    called for any SQLSTATE at all.
    expect(Object.prototype.hasOwnProperty.call(body, 'details')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, 'code')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, 'message')).toBe(true);
  });

  test('[P1] a rejected CHECK write commits no row, so this spec has nothing to clean up', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const userId = await resolveOwnUserId(supabaseAdmin);
    const userToken = await getUserAccessToken(supabaseAdmin, userId);

    // A label short enough to pass `events_label_check` and unique enough to
    // find, on a row that `events_icon_check` will refuse. If the INSERT ever
    // partially committed, this exact label would be sitting in the table.
    const probeLabel = `check-probe-${userId}`;

    const { status, body } = await apiRequest<PostgrestErrorEnvelope>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        user_id: userId,
        label: probeLabel,
        event_date: '2030-01-01',
        icon: 'not-an-icon',
      },
    });

    expect(status).toBe(CHECK_VIOLATION_HTTP_STATUS);
    expect(body.message).toContain('check constraint "events_icon_check"');

    const { data, error } = await supabaseAdmin.from('events').select('id').eq('label', probeLabel);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
