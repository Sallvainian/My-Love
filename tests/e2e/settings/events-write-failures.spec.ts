/**
 * tests/e2e/settings/events-write-failures.spec.ts
 *
 * Write-failure coverage for story 5 (`spec-dynamic-events`, "manage events in
 * Settings"), activated under the configured runner by DW-30 and moved onto the
 * Dates list's pages by the story that deleted the Countdowns section.
 *
 * Test design:
 *   - **DE.5-E2E-002** ×2, [P2] — "a rejected edit and a rejected delete carry
 *     the service's own message to the page's Error box"
 *     (`_bmad-output/test-artifacts/test-design-epic-5.md:357`). It closes the
 *     only seam where the real message is never observed reaching the screen:
 *     the component tests mock the store and assert a synthetic string. A
 *     rejected edit lands in the field page's Error box, a rejected delete in
 *     the event page's.
 *   - **DE.5-E2E-003** ×1, [P3] — "an offline add surfaces the service's
 *     offline message inside the form" (:369), keeping every field.
 *
 * The old form's Refresh and Retry controls are gone with it, so nothing here
 * asserts them: a stale row is fixed by leaving the page, which loads again.
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-write-failures.spec.ts --project=chromium
 *
 * These tests close an observation gap the test design named at
 * `test-design-epic-5.md:355`: the real service messages — a failed write's
 * `[EventsService.updateEvent] Database error: TypeError: Failed to fetch` /
 * `…deleteEvent…` (the PostgREST failure eventsService maps) and
 * `'You are offline. Events need a connection to save.'` — reach
 * their Error boxes correctly today, but until this file nothing anywhere
 * observed them doing it. The component suites assert a synthetic string against
 * a mocked store; the concatenation from service through slice
 * (src/stores/slices/eventsSlice.ts:203-205, 233) to the rendered `role="alert"`
 * was unwitnessed. It is witnessed now, and a regression in any link of that
 * chain fails here.
 *
 * Test data: seeded and torn down for THIS worker's pair only, keyed on
 * TEST_PARALLEL_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import {
  clearOwnPairEvents,
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { eventRowFor, fillNewEventForm, openNewEventForm } from '../../support/helpers/new-date-forms';
import { openDatesList, openSettingsFromHome } from '../../support/helpers/settings-screen';
import { log } from '@seontechnologies/playwright-utils';

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

const rowFor = eventRowFor;

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

test.afterEach(async ({ supabaseAdmin }) => {
  await clearOwnPairEvents(supabaseAdmin);
});

/**
 * No `skipNetworkMonitoring` on this describe, and that is deliberate rather
 * than an oversight. Both stubs abort the write in flight, so no 4xx/5xx is
 * ever answered; the network-error-monitor fixture only fails a test on one
 * (`tests/support/merged-fixtures.ts`), so there is nothing here to opt out
 * of, and leaving it armed keeps a genuine backend error visible. (These used
 * to answer zero rows, the shape a partner's write got through RLS; since both
 * partners may edit every event, zero rows means the event is gone, which the
 * "deleted elsewhere" describe covers.)
 */
test.describe('A rejected events write shows its message (DE.5-E2E-002)', () => {
  test(
    '[P2] DE.5-E2E-002a a rejected edit carries the service message into the field page',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      const anchor = new Date();
      await seedEvent(supabaseAdmin, {
        userId,
        label: EDIT_LABEL,
        eventDate: isoDateDaysFromNow(30, anchor),
        description: 'Seeded by the write-failure test',
        icon: 'calendar',
      });

      await log.step('Open the Dates list on a row this account owns');
      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);

      const row = rowFor(page, EDIT_LABEL);
      await expect(row).toBeVisible();

      // Declared before the Save is tapped, so the route is in place before the
      // PATCH leaves the page (network-first). The request fails in flight, a
      // write that genuinely did not land. (Zero rows no longer means rejected:
      // since both partners may edit every event it means the event is gone,
      // which the "deleted elsewhere" describe below covers.)
      let markAborted: () => void = () => {};
      const editAborted = new Promise<void>((resolve) => (markAborted = resolve));
      await page.route('**/rest/v1/events*', async (route) => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        await route.abort('failed');
        markAborted();
      });

      await row.click();
      await page.getByTestId('settings-event-name').click();
      await expect(page.getByTestId('settings-event-name-field')).toHaveValue(EDIT_LABEL);

      await log.step('Save an edit whose request fails in flight');
      await page.getByTestId('settings-event-name-field').fill(EDIT_ATTEMPT_LABEL);
      await page.getByTestId('settings-field-save').click();

      await editAborted;

      // The message the write itself returned, not a generic one.
      await expect(page.getByTestId('settings-field-error')).toContainText(
        '[EventsService.updateEvent] Database error: TypeError: Failed to fetch'
      );
      // The field page stays, holding what was typed, with Save usable again.
      await expect(page.getByTestId('settings-event-name-page')).toBeVisible();
      await expect(page.getByTestId('settings-event-name-field')).toHaveValue(EDIT_ATTEMPT_LABEL);
      await expect(page.getByTestId('settings-field-save')).toBeEnabled();

      // And the event page behind it still carries the ORIGINAL label: a
      // rejected write must not be reflected optimistically.
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName(`Name, ${EDIT_LABEL}`);
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(rowFor(page, EDIT_LABEL)).toBeVisible();
      await expect(rowFor(page, EDIT_ATTEMPT_LABEL)).toHaveCount(0);
    }
  );

  test(
    '[P2] DE.5-E2E-002b a rejected delete carries the service message into the event page',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      const anchor = new Date();
      await seedEvent(supabaseAdmin, {
        userId,
        label: DELETE_LABEL,
        eventDate: isoDateDaysFromNow(30, anchor),
        description: 'Seeded by the write-failure test',
        icon: 'calendar',
      });

      await log.step('Open the Dates list on a row this account owns');
      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);

      const row = rowFor(page, DELETE_LABEL);
      await expect(row).toBeVisible();

      // The same in-flight failure, on the DELETE this time.
      let markAborted: () => void = () => {};
      const deleteAborted = new Promise<void>((resolve) => (markAborted = resolve));
      await page.route('**/rest/v1/events*', async (route) => {
        if (route.request().method() !== 'DELETE') return route.fallback();
        await route.abort('failed');
        markAborted();
      });

      await row.click();
      await page.getByTestId('settings-event-delete').click();
      await expect(page.getByTestId('settings-event-delete-confirmation')).toBeVisible();

      await log.step('Confirm a delete whose request fails in flight');
      await page.getByTestId('settings-event-delete-confirmation-confirm').click();

      await deleteAborted;

      await expect(page.getByTestId('settings-date-error')).toContainText(
        '[EventsService.deleteEvent] Database error: TypeError: Failed to fetch'
      );
      // The confirmation has closed and the event page stays, with Delete
      // usable again.
      await expect(page.getByTestId('settings-event-delete-confirmation')).toHaveCount(0);
      await expect(page.getByTestId('settings-event-page')).toBeVisible();
      await expect(page.getByTestId('settings-event-delete')).toBeEnabled();

      // The row survives the rejection.
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(rowFor(page, DELETE_LABEL)).toBeVisible();
    }
  );
});

test.describe('An event deleted elsewhere while its page is open', () => {
  test(
    '[P1] an edit of an event deleted elsewhere drops it and goes back to the Dates list',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      const id = await seedEvent(supabaseAdmin, {
        userId: partnerId,
        label: EDIT_LABEL,
        eventDate: isoDateDaysFromNow(30, new Date()),
        icon: 'calendar',
      });

      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);
      await rowFor(page, EDIT_LABEL).click();
      await page.getByTestId('settings-event-name').click();
      await expect(page.getByTestId('settings-event-name-field')).toHaveValue(EDIT_LABEL);

      await log.step('The partner deletes it; this phone hears nothing');
      await supabaseAdmin.from('events').delete().eq('id', id);

      await log.step('Save an edit, which finds no row');
      await page.getByTestId('settings-event-name-field').fill(EDIT_ATTEMPT_LABEL);
      await page.getByTestId('settings-field-save').click();

      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
      await expect(rowFor(page, EDIT_LABEL)).toHaveCount(0);
      await expect(rowFor(page, EDIT_ATTEMPT_LABEL)).toHaveCount(0);
    }
  );

  test(
    '[P1] a delete of an event deleted elsewhere is done, and it leaves the list',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);
      const id = await seedEvent(supabaseAdmin, {
        userId: partnerId,
        label: DELETE_LABEL,
        eventDate: isoDateDaysFromNow(30, new Date()),
        icon: 'calendar',
      });

      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);
      await rowFor(page, DELETE_LABEL).click();
      await expect(page.getByTestId('settings-event-page')).toBeVisible();

      await log.step('The partner deletes it; this phone hears nothing');
      await supabaseAdmin.from('events').delete().eq('id', id);

      await page.getByTestId('settings-event-delete').click();
      await page.getByTestId('settings-event-delete-confirmation-confirm').click();

      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.getByTestId('settings-date-error')).toHaveCount(0);
      await expect(rowFor(page, DELETE_LABEL)).toHaveCount(0);
    }
  );
});

test.describe('Adding an event while offline (DE.5-E2E-003)', () => {
  // No `skipNetworkMonitoring` here either: nothing is stubbed and no HTTP call
  // is made at all. The form refuses before it reaches the network, and
  // requests that fail while the context is offline are aborted rather than
  // answered, so the monitor — which fails only on a 4xx/5xx response — has
  // nothing to react to. If it does fire, that is signal about the app during
  // the offline window, not about this test.
  test(
    '[P3] DE.5-E2E-003 an offline add surfaces the offline message in the form and keeps its fields',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await log.step('Open the New event form while still online');
      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);

      await openNewEventForm(page);
      const anchor = new Date();
      const date = isoDateDaysFromNow(12, anchor);
      await fillNewEventForm(page, { label: OFFLINE_LABEL, date, description: 'Keep me' });

      await log.step('Drop the connection, then add');
      // `isOnline()` reads `navigator.onLine` (src/api/errorHandlers.ts:44), and
      // the form checks it before any request. The `offline` event is dispatched
      // alongside for parity with network-status.spec.ts:28-29 — it is what
      // App.tsx:365-366 listens on to update `syncStatus.isOnline`; the form
      // itself does not need it.
      //
      // Measured in the activated runner: `context.setOffline(true)` flips
      // `navigator.onLine` to false here, so the form's guard trips before a
      // request leaves the page.
      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await page.getByTestId('settings-form-add').click();

      await expect(page.getByTestId('settings-form-error')).toContainText(
        'You are offline. Events need a connection to save.'
      );
      // The typed-in event is still there to retry, and nothing was added.
      await expect(page.getByTestId('settings-new-event-page')).toBeVisible();
      await expect(page.getByTestId('settings-new-event-name-field')).toHaveValue(OFFLINE_LABEL);
      await expect(page.getByTestId('settings-new-event-date-field')).toHaveValue(date);
      await expect(page.getByTestId('settings-new-event-note-field')).toHaveValue('Keep me');
      await expect(page.getByTestId('settings-form-add')).toBeEnabled();

      await log.step('Restore the connection');
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      await page.getByTestId('settings-cancel').click();
      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.locator('[data-testid^="settings-dates-event-"]')).toHaveCount(0);
    }
  );
});
