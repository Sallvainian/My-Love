/**
 * tests/e2e/settings/events-write-failures.spec.ts
 *
 * RED-PHASE ATDD scaffold — story 5 (`spec-dynamic-events`, "manage events in
 * Settings"). Every test is emitted as `test.skip(...)`; a developer activates
 * one by deleting its `.skip`.
 *
 * Test design:
 *   - **DE.5-E2E-002** ×2, [P2] — "a rejected edit and a rejected delete carry
 *     the service's own message to the dialog"
 *     (`_bmad-output/test-artifacts/test-design-epic-5.md:357`). It closes the
 *     only seam where the real message is never observed reaching a dialog: the
 *     component tests mock the store and assert a synthetic string.
 *   - **DE.5-E2E-003** ×1, [P3] — "an offline save surfaces the service's
 *     offline message inside the form" (:369).
 *
 * Shape mirrors `tests/e2e/settings/events-crud.spec.ts:392-446`, the existing
 * rejected-create test.
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-write-failures.spec.ts --project=chromium
 *
 * ── MEASURED first run: GREEN, all three ───────────────────────────────────
 *
 * Executed during the story-5 ATDD run (2026-08-19) against the local stack,
 * `npx playwright test tests/e2e/settings/events-write-failures.spec.ts
 * --project=chromium --workers=1`. Result: **3 passed, 0 failed.**
 *
 * So these are not red-phase tests in the TDD sense, and this header does not
 * pretend otherwise. They close an OBSERVATION gap the test design named at
 * `test-design-epic-5.md:355`: the real service messages —
 * `'Event not found or not yours to edit'` (src/services/eventsService.ts:413),
 * `'Event not found or not yours to delete'` (:466) and
 * `'You are offline. Events need a connection to save.'` (:305-308) — reach
 * their dialogs correctly today, but until this file nothing anywhere observed
 * them doing it. The component suites assert a synthetic string against a mocked
 * store; the concatenation from service through slice
 * (src/stores/slices/eventsSlice.ts:203-205, 233) to the rendered `role="alert"`
 * was unwitnessed. It is witnessed now, and a regression in any link of that
 * chain fails here.
 *
 * Test data: seeded and torn down for THIS worker's pair only, keyed on
 * TEST_WORKER_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import { formatDateISO } from '../../../src/utils/dateUtils';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';

// FILE-LEVEL, not per-describe: Playwright refuses `test.use({ video })` inside
// a describe group ("because it forces a new worker") — measured with
// `npx playwright test tests/e2e/settings/ --project=chromium --list`, which
// collected 0 tests in 0 files until this moved out here. Only the offline test
// below needs it: trace recording corrupts when the browser context goes
// offline, producing ENOENT, which is why
// `tests/e2e/offline/network-status.spec.ts:13` disables both the same way.
// The cost of hoisting is that the two stubbed-rejection tests in this file
// also lose their trace and video, which `playwright.config.ts:119-137` would
// otherwise record. Accepted over splitting the offline case into a fourth file
// that would duplicate ~150 lines of pair-resolution and teardown helpers.
test.use({ trace: 'off', video: 'off' });

/**
 * Labels are deliberately unlike any fixed Home testid — `Wedding` slugifies to
 * `event-countdown-wedding`, a hardcoded card that must never be shadowed.
 */
const EDIT_LABEL = 'Settings Reject Edit E2E';
const EDIT_ATTEMPT_LABEL = 'Settings Reject Edit Attempt E2E';
const DELETE_LABEL = 'Settings Reject Delete E2E';
const OFFLINE_LABEL = 'Settings Offline Save E2E';

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

/** This worker's own pair, resolved to `public.users.id`s. Throws outside a worker. */
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

/**
 * Remove every event owned by either half of this worker's pair.
 *
 * Checked, because a silently-failed clear leaves stray rows that break the
 * next test's premise and fail it pointing at the wrong code. Scoped to this
 * worker's own two users: every other row in `events` belongs to another
 * worker's pair.
 */
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

/**
 * Seed one row owned by `userId`, so the list, its Edit/Delete controls and
 * both dialogs are reachable without driving a create through the UI first.
 */
async function seedEvent(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  label: string,
  eventDate: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('events').insert({
    user_id: userId,
    label,
    event_date: eventDate,
    description: 'Seeded by the ATDD scaffold',
    icon: 'calendar',
  });
  if (error) {
    throw new Error(`Failed to seed the event "${label}": ${error.message}`);
  }
}

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

function futureDate(dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return formatDateISO(date);
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-crud.spec.ts:139-144.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.afterEach(async ({ supabaseAdmin }) => {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  await clearPairEvents(supabaseAdmin, userId, partnerId);
});

/**
 * No `skipNetworkMonitoring` on this describe, and that is deliberate rather
 * than an oversight. Both stubs answer **200**, because a zero-row body is
 * exactly what RLS produces for a non-creator's write — the service reads
 * `data.length === 0`, not a status (eventsService.ts:412-414, 465-467). The
 * network-error-monitor fixture only fails a test on a 4xx/5xx
 * (`tests/support/merged-fixtures.ts:29-40`), so there is nothing here to opt
 * out of, and leaving it armed keeps a genuine backend error visible.
 */
test.describe('A rejected events write keeps its dialog open (DE.5-E2E-002)', () => {
  test.skip(
    '[P2] DE.5-E2E-002a a rejected edit carries the service message into the form',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      await seedEvent(supabaseAdmin, userId, EDIT_LABEL, futureDate(30));

      await log.step('Open Settings on a row this account owns');
      await page.goto('/');
      await navigateTo(page, 'settings');

      const row = rowFor(page, EDIT_LABEL);
      await expect(row).toBeVisible();

      // Declared before the form is even opened, so the route is in place long
      // before the PATCH leaves the page (network-first). `body: []` is the
      // zero-row shape a partner's UPDATE gets back through RLS, which
      // eventsService turns into EventWriteError at :412-414.
      const rejectedEdit = interceptNetworkCall({
        method: 'PATCH',
        url: '**/rest/v1/events*',
        fulfillResponse: { status: 200, body: [] },
      });

      await row.locator('[data-testid^="event-edit-"]').click();
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-label')).toHaveValue(EDIT_LABEL);

      await log.step('Submit an edit the server answers with zero rows');
      await page.getByTestId('events-form-label').fill(EDIT_ATTEMPT_LABEL);
      await page.getByTestId('events-form-submit').click();

      await rejectedEdit;

      // The message the write itself returned, not a generic one.
      await expect(page.getByTestId('events-form-error')).toContainText(
        'Event not found or not yours to edit'
      );
      // The form stays open, and Save is usable again so a retry needs no
      // reopen (EventsSettings.tsx sets isSaving false on the failure branch).
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-submit')).toBeEnabled();

      // And the list behind it still carries the ORIGINAL label: a rejected
      // write must not be reflected optimistically.
      await expect(rowFor(page, EDIT_LABEL)).toBeVisible();
      await expect(rowFor(page, EDIT_ATTEMPT_LABEL)).toHaveCount(0);
    }
  );

  test.skip(
    '[P2] DE.5-E2E-002b a rejected delete carries the service message into the confirmation',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      await seedEvent(supabaseAdmin, userId, DELETE_LABEL, futureDate(30));

      await log.step('Open Settings on a row this account owns');
      await page.goto('/');
      await navigateTo(page, 'settings');

      const row = rowFor(page, DELETE_LABEL);
      await expect(row).toBeVisible();

      // Same zero-row shape, on the DELETE this time — eventsService.ts:465-467.
      const rejectedDelete = interceptNetworkCall({
        method: 'DELETE',
        url: '**/rest/v1/events*',
        fulfillResponse: { status: 200, body: [] },
      });

      await row.locator('[data-testid^="event-delete-"]').click();
      await expect(page.getByTestId('events-delete-confirmation')).toBeVisible();

      await log.step('Confirm a delete the server answers with zero rows');
      await page.getByTestId('events-delete-confirm').click();

      await rejectedDelete;

      await expect(page.getByTestId('events-delete-error')).toContainText(
        'Event not found or not yours to delete'
      );
      // The confirmation stays open, with both controls usable again.
      await expect(page.getByTestId('events-delete-confirmation')).toBeVisible();
      await expect(page.getByTestId('events-delete-confirm')).toBeEnabled();
      await expect(page.getByTestId('events-delete-cancel')).toBeEnabled();

      // The row survives the rejection.
      await expect(rowFor(page, DELETE_LABEL)).toBeVisible();
    }
  );
});

test.describe('Saving an event while offline (DE.5-E2E-003)', () => {
  // No `skipNetworkMonitoring` here either: nothing is stubbed and no HTTP call
  // is made at all. `createEvent` refuses before it reaches the network
  // (eventsService.ts:305-308), and requests that fail while the context is
  // offline are aborted rather than answered, so the monitor — which fails only
  // on a 4xx/5xx response — has nothing to react to. If it does fire, that is
  // signal about the app during the offline window, not about this test.
  test.skip(
    '[P3] DE.5-E2E-003 an offline save surfaces the service offline message in the form',
    async ({ page, supabaseAdmin }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await log.step('Open the add form while still online');
      await page.goto('/');
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();

      await page.getByTestId('events-settings-empty-add').click();
      await expect(page.getByTestId('events-form')).toBeVisible();
      await page.getByTestId('events-form-label').fill(OFFLINE_LABEL);
      await page.getByTestId('events-form-date').fill(futureDate(12));

      await log.step('Drop the connection, then save');
      // `isOnline()` reads `navigator.onLine` (src/api/errorHandlers.ts:44), and
      // `createEvent` guards on it before any request (eventsService.ts:305-308).
      // The `offline` event is dispatched alongside for parity with
      // network-status.spec.ts:28-29 — it is what App.tsx:365-366 listens on to
      // update `syncStatus.isOnline`; the service itself does not need it.
      //
      // UNVERIFIED: that `context.setOffline(true)` actually flips
      // `navigator.onLine` to false in this project is asserted only at
      // `tests/e2e-archive/epic-1-validation.spec.ts:325-330`, in a frozen
      // archive that no Playwright project runs. It was not measured this
      // session. If the guard does not trip, this test fails on the assertion
      // below rather than on anything about the form.
      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await page.getByTestId('events-form-submit').click();

      await expect(page.getByTestId('events-form-error')).toContainText(
        'You are offline. Events need a connection to save.'
      );
      // The typed-in event is still there to retry, and nothing was added.
      await expect(page.getByTestId('events-form')).toBeVisible();
      await expect(page.getByTestId('events-form-label')).toHaveValue(OFFLINE_LABEL);
      await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(0);

      await log.step('Restore the connection');
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    }
  );
});
