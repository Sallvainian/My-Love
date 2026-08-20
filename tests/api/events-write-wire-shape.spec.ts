/**
 * Active ATDD coverage — the PostgREST wire shape of an RLS-filtered events write.
 *
 * Runs in the Playwright `api` project (`playwright.config.ts`,
 * `testDir: './tests/api'`,
 * `baseURL: process.env.SUPABASE_URL`, `extraHTTPHeaders.apikey = process.env.SUPABASE_ANON_KEY`).
 *
 * Produced by the story-5 ATDD run (spec-dynamic-events, "Manage events in
 * Settings") and activated under the configured runner by DW-30.
 *
 * Test-design IDs covered: DE.5-API-001, DE.5-API-002, DE.5-API-003.
 * Those three IDs are new. `_bmad-output/test-artifacts/test-design-epic-5.md:288-290`
 * fixes the convention as `DE.5-<LEVEL>-<SEQ>` and lists levels `DB`, `UNIT`,
 * `COMP`, `E2E` — `API` is an extension introduced by this ATDD run and is not
 * yet written into that document. The risk they attach to is R-005
 * (`test-design-epic-5.md:130`): "The UI's creator-only gate drifting from RLS".
 *
 * Run:
 *   npx playwright test tests/api/events-write-wire-shape.spec.ts --project=api
 * Prerequisite: `supabase start`, plus the local `SUPABASE_URL`,
 * `SUPABASE_ANON_KEY` and service-role env the `api` project already reads.
 *
 * ── MEASURED first run: GREEN, all three ───────────────────────────────────
 *
 * Executed during the story-5 ATDD run (2026-08-19) against the local stack,
 * `npx playwright test tests/api/events-write-wire-shape.spec.ts --project=api
 * --workers=1`. Result: **3 passed, 0 failed** in 5.5s.
 *
 * So PostgREST does answer a partner's RLS-filtered PATCH and DELETE with
 * `200` and an empty array, and `eventsService`'s `data.length === 0` branch is
 * reachable rather than dead code. That was an assumption before this file and
 * is a measurement after it. The paragraph below states the gap these three
 * close; it is kept because the gap is the reason they exist, not because the
 * outcome was ever in doubt after the run.
 *
 * Original pre-run assessment (left intact for the record): **UNVERIFIED**.
 * These three close a real assertion gap. `supabase/tests/database/20_events.sql`
 * proves the RLS predicate at SQL level — EV-DB-024 at :247 ("a partner's UPDATE
 * of the creator's row affects zero rows") and EV-DB-026 at :270 (the DELETE
 * twin) — and nothing anywhere proves what PostgREST hands back over HTTP for
 * the same filtered write. That HTTP shape is exactly what
 * `src/services/eventsService.ts:400-414` and `:452-467` branch on: they read
 * `data.length === 0` off a successful response and raise
 * `'Event not found or not yours to edit'` / `'Event not found or not yours to
 * delete'`. Whether PostgREST *already* answers 200-with-an-empty-array had not
 * been measured when this paragraph was written. It has been now — see
 * the MEASURED block above.
 *
 * The wire detail that decides the shape: supabase-js appends `.select()` to
 * both writes, which sends `Prefer: return=representation`. Every request below
 * therefore sends that header explicitly. Without it PostgREST answers 204 No
 * Content and this file would be measuring a shape the service never sees —
 * `tests/api/scripture-reflection-rpc.spec.ts:260-266` is that headerless 204
 * case, and it is deliberately not the shape under test here.
 *
 * Isolation: rows belong to this worker's own pair only, resolved through
 * `getWorkerPairEmails()` (keyed on `TEST_WORKER_INDEX`, never
 * `TEST_PARALLEL_INDEX`). Nothing here links or unlinks partners, resets a
 * password, or touches a row owned by another worker.
 */
import { test, expect } from '../support/merged-fixtures';
// The `log` VALUE, not the destructured fixture. The fixture merged into
// merged-fixtures.ts:15 is `(params: LogParams) => Promise<void>`
// (node_modules/@seontechnologies/playwright-utils/dist/esm/log/log-fixture.d.ts);
// only the value export carries `.step`/`.info`
// (dist/esm/log/log.d.ts). This project's merged fixtures do not re-export it,
// so it is imported straight from the package.
import { log } from '@seontechnologies/playwright-utils';
import { getUserAccessToken } from '../support/helpers/supabase';
import {
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../support/helpers/events';

/**
 * The `public.events` row as PostgREST returns it.
 *
 * Hand-written: there is no Zod/OpenAPI schema for `events` anywhere under
 * `src/validation/`, so `apiRequest`'s `validateSchema` has nothing to be
 * handed and the assertions below cover only the fields under test. Columns
 * mirror `supabase/migrations/20260818000002_create_events_table.sql:17-26`.
 */
type EventRow = {
  id: string;
  user_id: string;
  label: string;
  event_date: string;
  description: string | null;
  icon: 'ring' | 'plane' | 'calendar';
  created_at: string;
  updated_at: string;
};

/**
 * Labels are deliberately prefixed `Events API` and unlike any fixed Home
 * testid — `Wedding` slugifies to `event-countdown-wedding`, a hardcoded card
 * that a row created here must never shadow.
 */
const SEEDED_LABEL = 'Events API Seeded Trip';
const PARTNER_ATTEMPT_LABEL = 'Events API Partner Overwrite';
const CREATOR_EDIT_LABEL = 'Events API Creator Voyage';

/** Preserve the test-body failure when checked teardown fails too. */
async function runWithPairCleanup(
  supabaseAdmin: Parameters<typeof clearPairEvents>[0],
  userId: string,
  partnerId: string,
  action: () => Promise<void>
): Promise<void> {
  let actionFailure: unknown;
  let actionFailed = false;

  try {
    await action();
  } catch (error) {
    actionFailed = true;
    actionFailure = error;
  }

  let cleanupFailure: unknown;
  let cleanupFailed = false;
  try {
    await clearPairEvents(supabaseAdmin, userId, partnerId);
  } catch (error) {
    cleanupFailed = true;
    cleanupFailure = error;
  }

  if (actionFailed && cleanupFailed) {
    throw new AggregateError(
      [actionFailure, cleanupFailure],
      'The events wire-shape assertion and pair cleanup both failed'
    );
  }
  if (cleanupFailed) throw cleanupFailure;
  if (actionFailed) throw actionFailure;
}

test.describe('Events write wire shape over PostgREST — story 5', () => {
  // ==========================================================================
  // DE.5-API-001
  // Risk: R-005. Precondition for `eventsService.updateEvent`'s
  // `'Event not found or not yours to edit'` (src/services/eventsService.ts:400-414).
  // ==========================================================================
  test('[P1] DE.5-API-001 a partner PATCH on the creator\'s event returns 200 with zero rows, not an error', async ({
    supabaseAdmin,
    apiRequest,
  }) => {
    await log.step('Resolve this worker\'s own pair and clear its events');
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await runWithPairCleanup(supabaseAdmin, userId, partnerId, async () => {
      await log.step('Seed one event owned by the creator');
      const seededDate = isoDateDaysFromNow(30);
      const eventId = await seedEvent(supabaseAdmin, {
        userId,
        label: SEEDED_LABEL,
        eventDate: seededDate,
        description: 'Seeded by the events write wire-shape test',
        icon: 'calendar',
      });

      await log.step('Sign in as the PARTNER and PATCH the creator\'s row');
      const partnerToken = await getUserAccessToken(supabaseAdmin, partnerId);

      // `Prefer: return=representation` is what supabase-js's `.select()` sends.
      // Drop it and PostgREST answers 204, which is not the shape the service reads.
      const { status, body } = await apiRequest<EventRow[]>({
        method: 'PATCH',
        path: `/rest/v1/events?id=eq.${eventId}`,
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          Prefer: 'return=representation',
        },
        body: {
          label: PARTNER_ATTEMPT_LABEL,
          updated_at: new Date().toISOString(),
        },
      });

      // THEN: RLS filters the write to nothing and PostgREST reports SUCCESS.
      // A 403/404 here would mean the service's `data.length === 0` branch is
      // unreachable and its error message never fires.
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);

      await log.step('Confirm the creator\'s row is untouched');
      const { data: afterRow, error: afterError } = await supabaseAdmin
        .from('events')
        .select('label, event_date')
        .eq('id', eventId)
        .single();

      expect(afterError).toBeNull();
      expect(afterRow?.label).toBe(SEEDED_LABEL);
      expect(afterRow?.event_date).toBe(seededDate);
    });
  });

  // ==========================================================================
  // DE.5-API-002
  // Risk: R-005. Precondition for `eventsService.deleteEvent`'s
  // `'Event not found or not yours to delete'` (src/services/eventsService.ts:452-467).
  // ==========================================================================
  test('[P1] DE.5-API-002 a partner DELETE on the creator\'s event returns 200 with zero rows, not an error', async ({
    supabaseAdmin,
    apiRequest,
  }) => {
    await log.step('Resolve this worker\'s own pair and clear its events');
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await runWithPairCleanup(supabaseAdmin, userId, partnerId, async () => {
      await log.step('Seed one event owned by the creator');
      const seededDate = isoDateDaysFromNow(45);
      const eventId = await seedEvent(supabaseAdmin, {
        userId,
        label: SEEDED_LABEL,
        eventDate: seededDate,
        description: 'Seeded by the events write wire-shape test',
        icon: 'calendar',
      });

      await log.step('Sign in as the PARTNER and DELETE the creator\'s row');
      const partnerToken = await getUserAccessToken(supabaseAdmin, partnerId);

      const { status, body } = await apiRequest<EventRow[]>({
        method: 'DELETE',
        path: `/rest/v1/events?id=eq.${eventId}`,
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          Prefer: 'return=representation',
        },
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);

      await log.step('Confirm the creator\'s row survives');
      const { data: survivors, error: surviveError } = await supabaseAdmin
        .from('events')
        .select('id, label')
        .eq('id', eventId);

      expect(surviveError).toBeNull();
      expect(survivors).toHaveLength(1);
      expect(survivors?.[0]?.label).toBe(SEEDED_LABEL);
    });
  });

  // ==========================================================================
  // DE.5-API-003 — positive control.
  // Without it, DE.5-API-001 and -002 would still pass if the endpoint were
  // broken for everyone: a PATCH that matches nothing for ANY caller returns
  // the same empty array. This test is what makes the zero-row result mean
  // "RLS filtered it" rather than "the write path is dead".
  // ==========================================================================
  test('[P1] DE.5-API-003 the creator\'s own PATCH on the same row returns 200 with exactly one updated row', async ({
    supabaseAdmin,
    apiRequest,
  }) => {
    await log.step('Resolve this worker\'s own pair and clear its events');
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);

    await runWithPairCleanup(supabaseAdmin, userId, partnerId, async () => {
      await log.step('Seed one event owned by the creator');
      const seededDate = isoDateDaysFromNow(60);
      const eventId = await seedEvent(supabaseAdmin, {
        userId,
        label: SEEDED_LABEL,
        eventDate: seededDate,
        description: 'Seeded by the events write wire-shape test',
        icon: 'calendar',
      });

      await log.step('Sign in as the CREATOR and PATCH their own row');
      const creatorToken = await getUserAccessToken(supabaseAdmin, userId);

      // `updated_at` is client-maintained on this table — there is no trigger
      // and PostgREST does not set it (migration comment, :39-42), so the
      // writing client sends it, exactly as eventsService.updateEvent does.
      const newUpdatedAt = new Date().toISOString();
      const { status, body } = await apiRequest<EventRow[]>({
        method: 'PATCH',
        path: `/rest/v1/events?id=eq.${eventId}`,
        headers: {
          Authorization: `Bearer ${creatorToken}`,
          Prefer: 'return=representation',
        },
        body: {
          label: CREATOR_EDIT_LABEL,
          updated_at: newUpdatedAt,
        },
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(eventId);
      expect(body[0].user_id).toBe(userId);
      expect(body[0].label).toBe(CREATOR_EDIT_LABEL);
      // Untouched columns come back unchanged — the representation is the row,
      // not just the patched fields.
      expect(body[0].event_date).toBe(seededDate);
      expect(body[0].icon).toBe('calendar');

      await log.step('Confirm the new label is what landed in the table');
      const { data: afterRow, error: afterError } = await supabaseAdmin
        .from('events')
        .select('label')
        .eq('id', eventId)
        .single();

      expect(afterError).toBeNull();
      expect(afterRow?.label).toBe(CREATOR_EDIT_LABEL);
    });
  });
});
