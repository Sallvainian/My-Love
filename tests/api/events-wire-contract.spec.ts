/**
 * ACTIVE API specs — the PostgREST wire contract of `public.events`.
 *
 * Runs in the Playwright `api` project (`playwright.config.ts`,
 * `testDir: './tests/api'`,
 * `baseURL: process.env.SUPABASE_URL`, `extraHTTPHeaders.apikey = process.env.SUPABASE_ANON_KEY`,
 * `'Content-Type': 'application/json'`).
 *
 * Produced by the story-5 `automate` run (spec-dynamic-events, "Manage events in
 * Settings") and activated under the configured runner by DW-30.
 *
 * Test-design IDs covered: DE.5-API-004, DE.5-API-005, DE.5-API-006, DE.5-API-007,
 * DE.5-API-008.
 * The `API` level is an extension the story-5 ATDD run introduced on top of the
 * `DE.5-<LEVEL>-<SEQ>` convention fixed at
 * `_bmad-output/test-artifacts/test-design-epic-5.md:288-290` (which lists `DB`,
 * `UNIT`, `COMP`, `E2E` only). DE.5-API-001..003 live in the ATDD sibling
 * `api-events-write-wire-shape.spec.ts` and are deliberately not repeated here.
 *
 * Run:
 *   npx playwright test tests/api/events-wire-contract.spec.ts --project=api --workers=1
 * Prerequisite: `supabase start`, plus the local `SUPABASE_URL`,
 * `SUPABASE_ANON_KEY` and service-role env the `api` project already reads.
 *
 * ── MEASURED, not predicted ────────────────────────────────────────────────
 *
 * Every status and error code asserted below was measured against the local
 * stack before it was written down (2026-08-19):
 *
 *   • anon (apikey header, no `Authorization`) on `GET /rest/v1/events`
 *     → **401**, body `{"code":"42501", "details":null, "hint":null,
 *       "message":"permission denied for table events"}`.
 *     Not a 200-with-an-empty-array. The refusal comes from the PRIVILEGE
 *     layer, not RLS: `20260818000002_create_events_table.sql:113` runs
 *     `revoke all on public.events from anon, authenticated` and then grants
 *     back to `authenticated` only, so anon never reaches a row-level check.
 *   • anon on `POST /rest/v1/events` → the same **401 / 42501**.
 *   • creator `POST` with `Prefer: return=representation` → **201** and a
 *     one-element ARRAY (not a bare object — supabase-js only gets an object
 *     because `.single()` adds `Accept: application/vnd.pgrst.object+json`).
 *   • creator `POST` with a 101-character label → **400**, body
 *     `{"code":"23514", ..., "message":"new row for relation \"events\"
 *     violates check constraint \"events_label_check\""}`.
 *   • an authenticated but UNLINKED account, holding a real bearer token, on
 *     `GET /rest/v1/events` while the couple has rows → **200** and `[]`.
 *     Deliberately a different answer from the anon case above, and the reason
 *     both tests exist — see DE.5-API-008 below.
 *
 * ── Why each test exists ───────────────────────────────────────────────────
 *
 * DE.5-API-007 [P0] — the events table is new and reachable over HTTP by
 *   anyone holding the public anon key. `20260818000002:113` is the only thing
 *   standing between an anon caller and the couple's data, and nothing measured
 *   it over the wire until now; `supabase/tests/database/20_events.sql` runs as
 *   a database role, which is a different question.
 * DE.5-API-004 [P1] — the whole premise of `event_date` being a `date` and not
 *   a `timestamptz` (migration header, :1-11) is that the exact `YYYY-MM-DD`
 *   string survives the round trip with no timezone shift. Asserted against a
 *   hard-coded literal, deliberately `2027-01-01`: the sharpest case, since a
 *   UTC-midnight misparse renders it as the previous YEAR west of UTC.
 * DE.5-API-005 [P1] — pins the lower-level raw PostgREST contract: one
 *   unbounded request with `select=*` and ascending `event_date`, then
 *   `created_at`, returns both halves of the couple through `events_select`.
 *   Two order keys serialize to one comma-joined parameter. The service's
 *   current split, bounded window is exercised by the active
 *   `tests/api/events-read-window.spec.ts` suite.
 * DE.5-API-008 [P1] — the HTTP twin of EV-DB-022/023
 *   (`supabase/tests/database/20_events.sql:219,224`), which prove the predicate
 *   in SQL only. NOT a duplicate of DE.5-API-007, and the two answers are not
 *   even the same: -007 is the `anon` ROLE with no bearer at all, refused
 *   401/42501 by the GRANT before any row is considered; -008 is a FULLY
 *   AUTHENTICATED caller who passes the grant and is then filtered to nothing by
 *   the row-level predicate, so it gets 200 and an empty array. The mechanism is
 *   the comment above `events_select`
 *   (`20260818000002_create_events_table.sql:60-68`):
 *   `get_my_partner_id()` returns NULL for an unlinked caller, `user_id = NULL`
 *   evaluates to NULL, and RLS admits a row only on TRUE — so NULL denies.
 * DE.5-API-006 [P1] — the response the client-side mirrors at
 *   `src/components/Settings/EventsSettings.tsx:73-75` (`LABEL_MAX_LENGTH`,
 *   `DESCRIPTION_MAX_LENGTH`, `ISO_DATE_PATTERN`) exist to keep a user from ever
 *   seeing. A 100-character label is posted first as a positive control, so a
 *   401/permission failure cannot masquerade as the CHECK firing.
 *
 * ── Schema validation ──────────────────────────────────────────────────────
 *
 * `EventRowSchema` below is TEST-LOCAL. There is no `events` schema anywhere
 * under `src/validation/` — the ATDD run recorded "no schema to hand it" as its
 * biggest deviation, and this file closes that gap by declaring one and handing
 * it to `apiRequest(...).validateSchema(...)`, the house idiom at
 * `tests/api/scripture-reflection-2.2.spec.ts:63-70`. It mirrors
 * `supabase/migrations/20260818000002_create_events_table.sql:17-26` column for
 * column. It would ideally live in `src/validation/schemas.ts` beside
 * `SupabaseReflectionSchema` (:231-240) so production and tests validate the
 * same shape; it is not put there here because the story's acceptance criterion
 * pins the production diff to five files.
 *
 * ── Isolation ──────────────────────────────────────────────────────────────
 *
 * Rows belong to this worker's own pair only, resolved through
 * `getWorkerPairEmails()` (keyed on `TEST_WORKER_INDEX`, never
 * `TEST_PARALLEL_INDEX`). Nothing here links or unlinks partners, resets a
 * password, or touches a row owned by another worker. The one identity that is
 * NOT from the pool — DE.5-API-008's outsider — is self-provisioned by
 * `createOutsiderClient` (`tests/support/helpers/rls-security.ts:43`), which
 * makes its own throwaway `auth.users` account; it is deleted in a `finally`, so
 * it cannot leak. Every label is prefixed
 * `Events Wire` so no row can ever slugify onto Home's fixed
 * `event-countdown-wedding` testid.
 */
import { test, expect } from '../support/merged-fixtures';
// The `log` VALUE, not the destructured fixture. The fixture merged into
// merged-fixtures.ts:15 is `(params: LogParams) => Promise<void>`
// (node_modules/@seontechnologies/playwright-utils/dist/esm/log/log-fixture.d.ts);
// only the value export carries `.step`/`.info` (dist/esm/log/log.d.ts). This
// project's merged fixtures do not re-export it, so it is imported from the
// package directly.
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { getUserAccessToken } from '../support/helpers/supabase';
import { createOutsiderClient } from '../support/helpers/rls-security';
// The pair resolution, the scoped teardown and the local-components date all
// live in one module now. They were hand-copied into eight files before it
// existed, and `clearPairEvents` is the teardown that keeps one worker's rows
// out of another worker's premise — eight copies was eight chances for one to
// drift into deleting more than its own pair.
import {
  clearOwnPairEvents,
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../support/helpers/events';

/**
 * The `public.events` row exactly as PostgREST returns it. Columns, nullability
 * and the icon union mirror
 * `supabase/migrations/20260818000002_create_events_table.sql:17-26`.
 * `z.string().uuid()` rather than `z.uuid()` to match the house style in
 * `src/validation/schemas.ts:231-240`.
 */
const EventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string().max(100),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).nullable(),
  icon: z.enum(['ring', 'plane', 'calendar']),
  created_at: z.string(),
  updated_at: z.string(),
});

/** PostgREST answers a table read/write with an array, never a bare object,
 * unless the caller sends `Accept: application/vnd.pgrst.object+json`. */
const EventRowsSchema = z.array(EventRowSchema);

type EventRow = z.infer<typeof EventRowSchema>;

/** The PostgREST error envelope. Same four keys on 401/42501 and 400/23514. */
type PostgrestErrorBody = {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
};

const ANON_ATTEMPT_LABEL = 'Events Wire Anon Attempt';
const DEFAULTS_LABEL = 'Events Wire Defaults Probe';
const BOUNDARY_PREFIX = 'Events Wire Boundary ';
const OVERLONG_PREFIX = 'Events Wire Overlong ';

/** Exactly 100 characters — the last label the CHECK admits. */
const MAX_LENGTH_LABEL = BOUNDARY_PREFIX.padEnd(100, 'x');
/** Exactly 101 characters — the first label the CHECK refuses. */
const OVER_LENGTH_LABEL = OVERLONG_PREFIX.padEnd(101, 'x');

/** Ordering fixture labels, named for the position they must come back in. */
const ORDER_PARTNER_SOONEST = 'Events Wire Order Partner Soonest';
const ORDER_CREATOR_SAME_DAY = 'Events Wire Order Creator Same Day';
const ORDER_CREATOR_MIDDLE = 'Events Wire Order Creator Middle';
const ORDER_CREATOR_LATER = 'Events Wire Order Creator Later';
const ORDER_PARTNER_LAST = 'Events Wire Order Partner Last';

/** DE.5-API-008 fixtures — one row on each half of the pair. */
const OUTSIDER_CREATOR_LABEL = 'Events Wire Outsider Creator Row';
const OUTSIDER_PARTNER_LABEL = 'Events Wire Outsider Partner Row';

test.describe('Events wire contract over PostgREST — story 5', () => {
  // Scoped to this worker's own pair, and checked. Runs even when a test throws
  // mid-way, so a failure never leaks rows into the next test's premise.
  test.afterEach(async ({ supabaseAdmin }) => {
    await clearOwnPairEvents(supabaseAdmin);
  });

  // ==========================================================================
  // DE.5-API-007 [P0]
  // The privilege layer, measured over HTTP. `20260818000002:113` revokes all
  // from anon; this is what an anon caller holding the public key actually gets.
  // ==========================================================================
  test('[P0] DE.5-API-007 the anon role is refused on both GET and POST /rest/v1/events', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    // GIVEN: a real `public.users.id` from this worker's own pair, so nothing
    // but the missing bearer can explain a refusal below.
    const { userId } = await resolveOwnPair(supabaseAdmin);

    // WHEN: an anon caller reads the table
    await log.step('GET /rest/v1/events as anon — apikey header only, no Authorization bearer');
    // No `Authorization` header at all. The `api` project sends `apikey` and
    // `Content-Type` for every request (playwright.config.ts:150-154), so this
    // is exactly the request an unauthenticated browser would make.
    const read = await apiRequest<PostgrestErrorBody>({
      method: 'GET',
      path: '/rest/v1/events?select=*',
    });

    // MEASURED: 401, not 200-with-an-empty-array. anon is refused by the GRANT,
    // before RLS is ever consulted — hence 42501 "permission denied for table",
    // not a silent empty result.
    // THEN: the grant layer refuses it
    expect(read.status).toBe(401);
    expect(read.body.code).toBe('42501');
    expect(read.body.message).toBe('permission denied for table events');

    // WHEN: the same anon caller writes a well-formed row
    await log.step('POST /rest/v1/events as anon — same headers, a well-formed row');
    const write = await apiRequest<PostgrestErrorBody>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: { Prefer: 'return=representation' },
      body: {
        user_id: userId,
        label: ANON_ATTEMPT_LABEL,
        event_date: isoDateDaysFromNow(20),
      },
    });

    // MEASURED: the same 401/42501. The body is well-formed and the user_id is
    // real, so nothing but the missing bearer decides this.
    // THEN: identically refused
    expect(write.status).toBe(401);
    expect(write.body.code).toBe('42501');
    expect(write.body.message).toBe('permission denied for table events');

    // THEN: and nothing landed
    await log.step('Confirm the refused POST wrote nothing');
    const { data: leaked, error: leakError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('label', ANON_ATTEMPT_LABEL);

    expect(leakError).toBeNull();
    expect(leaked).toHaveLength(0);
  });

  // ==========================================================================
  // DE.5-API-004 [P1]
  // The date round trip plus the column defaults, read off the representation
  // the creating client actually receives.
  // ==========================================================================
  test('[P1] DE.5-API-004 POST with return=representation echoes event_date verbatim and applies the column defaults', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // A hard-coded literal, never a value derived from `new Date()`: New Year's
    // Day is where a UTC-midnight misparse is loudest — west of UTC it renders
    // as 2026-12-31, a different year.
    const EXACT_EVENT_DATE = '2027-01-01';

    // GIVEN / WHEN: the creator posts a row with `icon` and `description` omitted
    await log.step('Sign in as the creator and POST an event with icon and description omitted');
    const creatorToken = await getUserAccessToken(supabaseAdmin, userId);

    // `Prefer: return=representation` is what supabase-js's `.select()` sends
    // (`eventsService.createEvent`, src/services/eventsService.ts:322). Without
    // it PostgREST answers 204 and this would measure a shape the service never
    // sees — `tests/api/scripture-reflection-rpc.spec.ts:258-266` is that
    // headerless case, and it is deliberately not the shape under test here.
    const { status, body } = await apiRequest<EventRow[]>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
        Prefer: 'return=representation',
      },
      body: {
        user_id: userId,
        label: DEFAULTS_LABEL,
        event_date: EXACT_EVENT_DATE,
        // `description` and `icon` deliberately absent — their defaults are
        // half of what this test measures.
      },
    }).validateSchema<z.infer<typeof EventRowsSchema>>(EventRowsSchema);

    // MEASURED: 201, and an ARRAY of one. A bare object would mean the caller
    // sent `Accept: application/vnd.pgrst.object+json`, which this one does not.
    expect(status).toBe(201);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);

    // THE premise of the feature: the exact string back, character for
    // character. `toBe`, not a Date comparison — a Date would re-introduce the
    // very parse this column exists to avoid.
    expect(body[0].event_date).toBe(EXACT_EVENT_DATE);

    // Column defaults from the migration (:20-22).
    expect(body[0].icon).toBe('calendar');
    expect(body[0].description).toBeNull();

    // Both timestamps are server-populated on INSERT (:23-24) even though
    // `updated_at` is client-maintained on UPDATE (:39-42).
    expect(body[0].created_at).toBeTruthy();
    expect(body[0].updated_at).toBeTruthy();
    expect(body[0].user_id).toBe(userId);
    expect(body[0].label).toBe(DEFAULTS_LABEL);

    // THEN: the stored value is the same string, read back independently
    await log.step('Confirm the stored date is the same string, not a shifted one');
    const { data: storedRow, error: storedError } = await supabaseAdmin
      .from('events')
      .select('event_date, icon, description')
      .eq('id', body[0].id)
      .single();

    expect(storedError).toBeNull();
    expect(storedRow?.event_date).toBe(EXACT_EVENT_DATE);
    expect(storedRow?.icon).toBe('calendar');
    expect(storedRow?.description).toBeNull();
  });

  // ==========================================================================
  // DE.5-API-005 [P1]
  // The raw PostgREST ordering/RLS contract, including the created_at
  // tiebreak and the partner half the unfiltered read must return. The current
  // split, bounded service query is covered by events-read-window.spec.ts.
  // ==========================================================================
  test('[P1] DE.5-API-005 a raw ascending GET returns both halves of the pair in event_date then created_at order', async ({
    apiRequest,
    recurse,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // Explicit `created_at` values, one second apart, so the same-date tiebreak
    // is decided by the data rather than by how fast the inserts happened to run.
    const base = Date.now();
    const createdAt = (offsetMs: number): string => new Date(base + offsetMs).toISOString();

    const soonest = isoDateDaysFromNow(10);
    const middle = isoDateDaysFromNow(25);
    const later = isoDateDaysFromNow(40);
    const last = isoDateDaysFromNow(60);

    // GIVEN: five rows across both halves of the pair, inserted out of order
    await log.step('Seed five rows across both halves of the pair, in scrambled insert order');
    // Insert order is deliberately NOT the expected read order: if the service
    // query lost its `.order()` calls, PostgREST would hand rows back in
    // whatever order the table yields and this test would catch it.
    const { error: seedError } = await supabaseAdmin.from('events').insert([
      {
        user_id: userId,
        label: ORDER_CREATOR_LATER,
        event_date: later,
        icon: 'plane',
        created_at: createdAt(3000),
      },
      {
        user_id: partnerId,
        label: ORDER_PARTNER_LAST,
        event_date: last,
        icon: 'ring',
        created_at: createdAt(4000),
      },
      {
        // Same event_date as ORDER_PARTNER_SOONEST, created one second LATER —
        // this pair is the whole point of the created_at tiebreak.
        user_id: userId,
        label: ORDER_CREATOR_SAME_DAY,
        event_date: soonest,
        icon: 'calendar',
        created_at: createdAt(1000),
      },
      {
        user_id: userId,
        label: ORDER_CREATOR_MIDDLE,
        event_date: middle,
        icon: 'calendar',
        created_at: createdAt(2000),
      },
      {
        user_id: partnerId,
        label: ORDER_PARTNER_SOONEST,
        event_date: soonest,
        icon: 'calendar',
        created_at: createdAt(0),
      },
    ]);

    expect(seedError).toBeNull();

    // WHEN: the creator issues one raw, unbounded ascending PostgREST read
    // THEN: PostgREST returns both halves of the pair in event_date, created_at order
    await log.step('Read as the creator with one raw unbounded ascending query');
    const creatorToken = await getUserAccessToken(supabaseAdmin, userId);

    // `order=event_date.asc,created_at.asc` — ONE comma-joined parameter, which
    // is what two `.order()` calls serialize to
    // (@supabase/postgrest-js/src/PostgrestTransformBuilder.ts:380-388).
    // Deliberately no `user_id` filter: the `events_select` policy scopes the
    // read, and a filter would drop the partner half.
    const listed = await recurse(
      () =>
        apiRequest<EventRow[]>({
          method: 'GET',
          path: '/rest/v1/events?select=*&order=event_date.asc,created_at.asc',
          headers: { Authorization: `Bearer ${creatorToken}` },
        }).validateSchema<z.infer<typeof EventRowsSchema>>(EventRowsSchema),
      // An explicit `return true` after the assertions, not a bare assertion
      // block: the fixture's predicate is typed `(value: T) => boolean`
      // (node_modules/@seontechnologies/playwright-utils/dist/types/recurse/recurse.d.ts),
      // so a `void` predicate compiles under the runtime's truthiness handling
      // but fails `tsc` with TS2345.
      (response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(5);
        return true;
      },
      {
        timeout: 15000,
        interval: 500,
        log: 'Waiting for all five seeded events to be readable',
      }
    );

    // Ordered: event_date ascending, then created_at ascending inside the
    // same-date pair. Asserted as one array so a swap anywhere fails loudly.
    expect(listed.body.map((row) => row.label)).toEqual([
      ORDER_PARTNER_SOONEST,
      ORDER_CREATOR_SAME_DAY,
      ORDER_CREATOR_MIDDLE,
      ORDER_CREATOR_LATER,
      ORDER_PARTNER_LAST,
    ]);

    expect(listed.body.map((row) => row.event_date)).toEqual([
      soonest,
      soonest,
      middle,
      later,
      last,
    ]);

    // Both halves of the couple came back through the unfiltered read.
    expect(listed.body.map((row) => row.user_id)).toEqual([
      partnerId,
      userId,
      userId,
      userId,
      partnerId,
    ]);
  });

  // ==========================================================================
  // DE.5-API-008 [P1]
  // The row-level predicate, measured over HTTP by a caller who clears the
  // grant. The SQL twin is EV-DB-022/023 (supabase/tests/database/20_events.sql:219,224).
  // ==========================================================================
  test('[P1] DE.5-API-008 an authenticated but unlinked outsider reads none of the couple\'s events', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // GIVEN: one event on each half of the couple
    await log.step('Seed one event on each half of the pair');
    const { data: seeded, error: seedError } = await supabaseAdmin
      .from('events')
      .insert([
        { user_id: userId, label: OUTSIDER_CREATOR_LABEL, event_date: isoDateDaysFromNow(12) },
        { user_id: partnerId, label: OUTSIDER_PARTNER_LABEL, event_date: isoDateDaysFromNow(18) },
      ])
      .select('id');

    expect(seedError).toBeNull();
    expect(seeded).toHaveLength(2);

    // A throwaway account of its own, never a pool account belonging to another
    // worker. It is linked to nobody, which is the whole point: it is exactly
    // the caller `get_my_partner_id()` returns NULL for.
    const outsider = await createOutsiderClient(supabaseAdmin, 'events-wire-outsider');
    let testFailure: unknown;
    let testFailed = false;
    let cleanupFailure: Error | null = null;

    try {
      // GIVEN (positive control): the same endpoint does serve the creator both rows,
      // so an empty outsider read cannot be a dead endpoint masquerading as RLS.
      await log.step('Positive control: the creator can see both rows over the same endpoint');
      // Without this the outsider's empty array would also be the answer if the
      // rows had never been seeded, or if the endpoint were broken for everyone.
      const creatorToken = await getUserAccessToken(supabaseAdmin, userId);
      const visible = await apiRequest<EventRow[]>({
        method: 'GET',
        path: '/rest/v1/events?select=*&order=event_date.asc,created_at.asc',
        headers: { Authorization: `Bearer ${creatorToken}` },
      }).validateSchema<z.infer<typeof EventRowsSchema>>(EventRowsSchema);

      expect(visible.status).toBe(200);
      expect(visible.body.map((row) => row.label)).toEqual([
        OUTSIDER_CREATOR_LABEL,
        OUTSIDER_PARTNER_LABEL,
      ]);

      // WHEN: an authenticated but unlinked account reads the same endpoint
      await log.step('The unlinked outsider reads the same endpoint with a real bearer token');
      const outsiderToken = await getUserAccessToken(supabaseAdmin, outsider.userId);
      const denied = await apiRequest<EventRow[]>({
        method: 'GET',
        path: '/rest/v1/events?select=*&order=event_date.asc,created_at.asc',
        headers: { Authorization: `Bearer ${outsiderToken}` },
      }).validateSchema<z.infer<typeof EventRowsSchema>>(EventRowsSchema);

      // MEASURED: 200 with an empty array — NOT the 401/42501 the anon role gets
      // in DE.5-API-007. The outsider clears the grant and is then filtered out
      // row by row, so PostgREST reports a perfectly successful read of nothing.
      expect(denied.status).toBe(200);
      expect(denied.body).toEqual([]);

      // Stated the other way round as well, so the assertion cannot pass just
      // because the array happened to be empty for some unrelated reason.
      expect(denied.body.map((row) => row.label)).not.toContain(OUTSIDER_CREATOR_LABEL);
      expect(denied.body.map((row) => row.label)).not.toContain(OUTSIDER_PARTNER_LABEL);

      // THEN: it sees none of them, and both rows are still there — the caller was
      // filtered by the row predicate, not the data removed
      await log.step('Confirm both rows still exist — the outsider was filtered, not the data');
      const { data: stillThere, error: stillError } = await supabaseAdmin
        .from('events')
        .select('label')
        .in('user_id', [userId, partnerId]);

      expect(stillError).toBeNull();
      expect(stillThere).toHaveLength(2);

      // The shared afterEach helper must remain scoped to this worker's pair.
      // Give a non-pool user a row, run the real helper, and prove that row
      // survives while the couple's two rows are cleared.
      await log.step('Confirm shared cleanup leaves an outsider-owned row untouched');
      const outsiderEventId = await seedEvent(supabaseAdmin, {
        userId: outsider.userId,
        label: 'Events Wire Outsider Cleanup Witness',
        eventDate: isoDateDaysFromNow(24),
      });

      await clearOwnPairEvents(supabaseAdmin);

      const { data: outsiderRow, error: outsiderRowError } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('id', outsiderEventId)
        .single();
      const { count: remainingPairRows, error: pairCountError } = await supabaseAdmin
        .from('events')
        .select('id', { count: 'exact', head: true })
        .in('user_id', [userId, partnerId]);

      expect(outsiderRowError).toBeNull();
      expect(outsiderRow?.id).toBe(outsiderEventId);
      expect(pairCountError).toBeNull();
      expect(remainingPairRows).toBe(0);
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      // Always, even on failure: the account exists in auth.users until this runs.
      try {
        const { error: cleanupError } = await outsider.cleanup();
        if (cleanupError) {
          cleanupFailure = new Error(
            `Failed to clean up outsider account ${outsider.userId}: ${cleanupError.message}`
          );
        }
      } catch (error) {
        cleanupFailure =
          error instanceof Error
            ? error
            : new Error(`Outsider account cleanup rejected with: ${String(error)}`);
      }
    }

    if (testFailed && cleanupFailure) {
      throw new AggregateError(
        [testFailure, cleanupFailure],
        'The outsider test and its account cleanup both failed'
      );
    }
    if (cleanupFailure) throw cleanupFailure;
    if (testFailed) throw testFailure;
  });

  // ==========================================================================
  // DE.5-API-006 [P1]
  // The raw Postgres refusal that EventsSettings.tsx:73-75 exists to pre-empt.
  // ==========================================================================
  test('[P1] DE.5-API-006 a 101-character label is refused with the CHECK violation the client mirrors', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    // Guard the fixtures themselves: an off-by-one here would make the test
    // measure something other than the boundary.
    expect(MAX_LENGTH_LABEL).toHaveLength(100);
    expect(OVER_LENGTH_LABEL).toHaveLength(101);

    const creatorToken = await getUserAccessToken(supabaseAdmin, userId);

    // GIVEN (positive control): a label at exactly the limit is admitted, so the
    // refusal below is the length and not the request shape.
    await log.step('Positive control: a 100-character label is admitted');
    // Without this, a 401 or a broken write path would produce the same
    // "the POST did not create a row" outcome as the CHECK firing.
    const accepted = await apiRequest<EventRow[]>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
        Prefer: 'return=representation',
      },
      body: {
        user_id: userId,
        label: MAX_LENGTH_LABEL,
        event_date: isoDateDaysFromNow(15),
      },
    }).validateSchema<z.infer<typeof EventRowsSchema>>(EventRowsSchema);

    expect(accepted.status).toBe(201);
    expect(accepted.body).toHaveLength(1);
    expect(accepted.body[0].label).toBe(MAX_LENGTH_LABEL);

    // WHEN: one character more is posted
    // THEN: the column CHECK refuses it with 23514, the response the client mirrors exist to hide
    await log.step('One character more is refused by the column CHECK');
    const refused = await apiRequest<PostgrestErrorBody>({
      method: 'POST',
      path: '/rest/v1/events',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
        Prefer: 'return=representation',
      },
      body: {
        user_id: userId,
        label: OVER_LENGTH_LABEL,
        event_date: isoDateDaysFromNow(15),
      },
    });

    // MEASURED: 400 with PostgREST's mapping of SQLSTATE 23514
    // (check_violation), naming the constraint from
    // `20260818000002_create_events_table.sql:19`.
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('23514');
    expect(refused.body.message).toContain('events_label_check');

    // THEN: and the over-length row did not land
    await log.step('Confirm the over-length row did not land');
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('events')
      .select('label')
      .in('user_id', [userId, partnerId]);

    expect(rowsError).toBeNull();
    expect(rows?.map((row) => row.label)).toEqual([MAX_LENGTH_LABEL]);
  });
});
