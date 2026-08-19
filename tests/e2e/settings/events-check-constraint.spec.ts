/**
 * P1 E2E: what a CHECK-constraint rejection puts on the screen
 *
 * This is the surface the story was about. `EventsSettings.tsx:789-797` renders
 * `saveError` and nothing else, `eventsSlice.addEvent` sets it from
 * `error.message` verbatim (`src/stores/slices/eventsSlice.ts:73-75, 167`), and
 * before `src/api/errorHandlers.ts:66` existed that message was
 * `Database error: new row for relation "events" violates check constraint
 * "events_label_check"` — a Postgres sentence, in a couples app, in the box
 * where the user is told what went wrong.
 *
 * ## Why this test stubs, and why that is not a cop-out
 *
 * The rejection is not reachable by typing. `EventsSettings.tsx:511-529` mirrors
 * all three of the table's CHECK constraints client-side — blank label,
 * `LABEL_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`, `ICON_VALUES` — and nothing is
 * requested until that mirror passes. The same holds for the other two adopters:
 * `MoodTracker.tsx:523` caps the note at `maxLength={200}` against a database
 * check of 500, and `interactions.type` is a `'poke' | 'kiss'` union with only
 * two call sites. Measured across the whole schema, no CHECK constraint behind
 * `handleSupabaseError` can be tripped through the UI today.
 *
 * That makes the mapping a net beneath the client guard rather than a fix for a
 * live user-visible bug — and it makes stubbing the only honest way to exercise
 * it. The net has to hold for the case the guard stops covering: a constraint
 * tightened in a migration without the mirror being updated, a new writer added
 * that skips the form, or a client mirror edited by mistake. Every one of those
 * arrives at the browser as exactly the response stubbed below.
 *
 * The stub is not invented. Status and body are the measured authenticated
 * rejection from `tests/support/check-constraint-envelopes.ts` — 400, and
 * `details: null` rather than the failing row a service_role caller is shown.
 * `tests/api/check-constraint-error-mapping.spec.ts` is the spec that proves the
 * real server still sends it; this one takes it as given and follows it to the
 * screen.
 *
 * The stubbed 400 is why the describe carries `skipNetworkMonitoring`: the
 * merged fixtures' network-error-monitor fails a test on any 4xx it sees, and
 * here the 4xx is the subject.
 *
 * The client-side mirror itself is not re-asserted here: it is owned by
 * `src/components/Settings/__tests__/EventsSettings.test.tsx:404`, which rejects
 * a 101-character label at component level. Re-testing it through a browser
 * would be the same claim, slower and more brittle.
 *
 * User-id resolution and event clearing mirror
 * `tests/e2e/settings/events-crud.spec.ts:37-89`, which in turn mirrors
 * `tests/e2e/home/events.spec.ts`; kept self-contained here for the same reason
 * both of those are — the factory helper they mirror is not exported.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import {
  AUTHENTICATED_EVENTS_LABEL_CHECK,
  CHECK_VIOLATION_HTTP_STATUS,
  CHECK_VIOLATION_MESSAGE,
  LEAK_MARKERS,
} from '../../support/check-constraint-envelopes';
import { formatDateISO } from '../../../src/utils/dateUtils';

/**
 * A label the client-side mirror accepts. The server rejects it anyway — that
 * divergence is the whole scenario, so the label must be *valid* or the request
 * never leaves the page.
 */
const VALID_LABEL = 'Settings Check Constraint E2E';

/**
 * The exact string the box must show. The `[EventsService.createEvent]` prefix
 * is `handleSupabaseError`'s context, passed straight through by `messageOf`;
 * asserting the whole string rather than a fragment is what makes a silent
 * re-appearance of the `Database error: ` fallback fail here.
 */
const EXPECTED_SAVE_ERROR = `[EventsService.createEvent] ${CHECK_VIOLATION_MESSAGE}`;

async function resolveAppUserId(
  supabaseAdmin: TypedSupabaseClient,
  email: string
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (error || !data?.id) {
    throw new Error(`Could not resolve app user for ${email}: ${error?.message ?? 'not found'}`);
  }

  return data.id;
}

async function resolveOwnPair(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ userId: string; partnerId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) {
    throw new Error('resolveOwnPair: no worker identity (TEST_WORKER_INDEX unset)');
  }

  const [userId, partnerId] = await Promise.all([
    resolveAppUserId(supabaseAdmin, pair.user1Email),
    resolveAppUserId(supabaseAdmin, pair.user2Email),
  ]);

  return { userId, partnerId };
}

/** Checked, because a silently-failed clear leaves rows that break the premise
 *  and fail this test as "empty state not visible", pointing at the wrong code. */
async function clearPairEvents(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').delete().in('user_id', [userId, partnerId]);
  if (error) {
    throw new Error(`Failed to clear events for the worker pair: ${error.message}`);
  }
}

function futureDate(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDateISO(date);
}

test.describe(
  'A CHECK-constraint rejection reaches the user as the generic sentence',
  // The stubbed 400 is deliberate; without this the network monitor fails the
  // test on the very response it was told to inject.
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    test('[P1] shows the mapped message and no part of the Postgres sentence', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await page.goto('/');
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();

      // Registered before the form is opened, so the route is in place long
      // before the create leaves the page.
      const rejectedCreate = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/events*',
        fulfillResponse: {
          status: CHECK_VIOLATION_HTTP_STATUS,
          body: AUTHENTICATED_EVENTS_LABEL_CHECK,
        },
      });

      await page.getByTestId('events-settings-empty-add').click();
      await page.getByTestId('events-form-label').fill(VALID_LABEL);
      await page.getByTestId('events-form-date').fill(futureDate(10));
      await page.getByTestId('events-form-submit').click();

      await rejectedCreate;

      const saveError = page.getByTestId('events-form-error');
      await expect(saveError).toBeVisible();
      await expect(saveError).toHaveText(EXPECTED_SAVE_ERROR);

      // Each of these is a substring of the raw rejection, and each would be on
      // screen if the 23514 key were dropped and the fallback took over.
      for (const marker of LEAK_MARKERS) {
        await expect(saveError).not.toContainText(marker);
      }
      await expect(saveError).not.toContainText('events_label_check');

      // The form stays open carrying the message, and nothing was added behind it.
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(0);
      await expect(page.getByTestId('events-form-submit')).toBeEnabled();
    });
  }
);
