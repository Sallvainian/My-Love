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
import { resolveOwnPair } from '../support/helpers/events';
import { getUserAccessToken } from '../support/helpers/supabase';
import type { TypedSupabaseClient } from '../support/factories';
import { createCheckWritePayload } from '../support/factories/check-write-payloads';
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

/** `photos.caption` is `check (char_length(caption) <= 500)` (`photos_caption_check`). */
const OVER_LONG_CAPTION = 'c'.repeat(501);

/** `love_notes.content` is `check (char_length(content) <= 1000 AND char_length(content) >= 1)`. */
const OVER_LONG_NOTE_CONTENT = 'x'.repeat(1001);

/**
 * `valid_mime_type` admits jpeg/png/webp only. gif is a real image type the
 * CHECK still refuses, so the rejection is the constraint, not a missing column.
 */
const DISALLOWED_MIME = 'image/gif';

/** `partner_requests_status_check` admits pending|accepted|declined. */
const DISALLOWED_REQUEST_STATUS = 'rejected';

/** Any valid `event_date`; no case here exercises the date. */
const FAR_FUTURE_EVENT_DATE = '2030-01-01';

/**
 * An events insert body. The defaults are the `events_label_check` case's body
 * (an over-long label); any other case overrides the label as well as the
 * column its own CHECK is about.
 */
function eventBody(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    user_id: userId,
    label: OVER_LONG_LABEL,
    event_date: FAR_FUTURE_EVENT_DATE,
    ...overrides,
  };
}

/**
 * Resolve this worker's own `public.users.id`.
 *
 * Kept self-contained because most cases here need only the signed-in user's
 * id; the interactions case additionally needs the partner, and uses the shared
 * `resolveOwnPair` helper for it.
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
   * Live `pg_constraint` (`contype='c'`, `public`) is 13 rows. Every table that
   * carries one has a write path that maps SQLSTATE `23514` through
   * `handleSupabaseError`:
   *
   *   events (3), moods (3), interactions (1) — original adopters
   *   photos (2)            — `src/services/photoService.ts:396-397`
   *   love_notes (2)        — `src/stores/slices/notesSlice.ts:519-520`
   *   partner_requests (2)  — `src/api/partnerService.ts:208-210`
   *                           (accept/decline around :317 and :345)
   *
   * The map is keyed on SQLSTATE, not table. This array drives one live
   * rejection per listed constraint. The remaining events/moods CHECKs
   * (`events_icon_check`, `events_description_check`, `moods_mood_type_check`,
   * `moods_mood_types_values_check`) share those tables' mapper tails and are
   * not listed here; `events_icon_check` is the "commits no row" probe below.
   *
   * INSERT RLS (live `pg_policies`) is `auth.uid()` = owner/sender, so a
   * self-row still reaches CHECK: `different_users` and `no_self_requests`
   * fire with `to_user_id = from_user_id`. Content/status CHECKs send to the
   * already-paired partner so the self-row CHECK does not fire first.
   * Interactions still need `resolveOwnPair` because their INSERT policy
   * requires the current partner (`20260912020000`).
   */
  const REJECTIONS = [
    {
      table: 'events',
      constraint: 'events_label_check',
      context: 'EventsService.createEvent',
      priority: 'P0',
      body: (userId: string) => eventBody(userId),
    },
    {
      table: 'interactions',
      constraint: 'interactions_type_check',
      context: 'InteractionService.sendInteraction',
      priority: 'P1',
      body: (userId: string, partnerId: string) => ({
        type: 'hug',
        from_user_id: userId,
        to_user_id: partnerId,
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
    {
      table: 'photos',
      constraint: 'photos_caption_check',
      context: 'PhotoService.uploadPhoto',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('photos', userId, partnerId, { caption: OVER_LONG_CAPTION }),
    },
    {
      table: 'photos',
      constraint: 'valid_mime_type',
      context: 'PhotoService.uploadPhoto',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('photos', userId, partnerId, { mime_type: DISALLOWED_MIME }),
    },
    {
      table: 'love_notes',
      constraint: 'love_notes_content_check',
      context: 'NotesSlice.sendNote',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('love_notes', userId, partnerId, {
          content: OVER_LONG_NOTE_CONTENT,
        }),
    },
    {
      table: 'love_notes',
      constraint: 'different_users',
      context: 'NotesSlice.sendNote',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('love_notes', userId, partnerId, { to_user_id: userId }),
    },
    {
      table: 'partner_requests',
      constraint: 'partner_requests_status_check',
      context: 'PartnerService.sendPartnerRequest',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('partner_requests', userId, partnerId, {
          status: DISALLOWED_REQUEST_STATUS,
        }),
    },
    {
      table: 'partner_requests',
      constraint: 'no_self_requests',
      context: 'PartnerService.sendPartnerRequest',
      priority: 'P1',
      body: (userId: string, partnerId: string) =>
        createCheckWritePayload('partner_requests', userId, partnerId, { to_user_id: userId }),
    },
  ] as const;

  for (const rejection of REJECTIONS) {
    test(`[${rejection.priority}] ${rejection.constraint} rejects with an envelope the mapper turns into the generic sentence`, async ({
      apiRequest,
      supabaseAdmin,
    }) => {
      // The interactions row needs the partner too: since
      // 20260912020000_partner_only_immutable_interactions.sql an INSERT is
      // refused before the CHECK constraint can fire unless the recipient is the
      // caller's current partner, and this file is about the CHECK envelope.
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const { status, body } = await apiRequest<PostgrestErrorEnvelope>({
        method: 'POST',
        path: `/rest/v1/${rejection.table}`,
        headers: { Authorization: `Bearer ${userToken}` },
        body: rejection.body(userId, partnerId),
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
      body: eventBody(userId),
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
    expect(Object.hasOwn(body, 'details')).toBe(true);
    expect(Object.hasOwn(body, 'code')).toBe(true);
    expect(Object.hasOwn(body, 'message')).toBe(true);
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
      body: eventBody(userId, { label: probeLabel, icon: 'not-an-icon' }),
    });

    expect(status).toBe(CHECK_VIOLATION_HTTP_STATUS);
    expect(body.message).toContain('check constraint "events_icon_check"');

    const { data, error } = await supabaseAdmin.from('events').select('id').eq('label', probeLabel);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
