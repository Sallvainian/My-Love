/**
 * tests/e2e/settings/events-load-recovery.spec.ts
 *
 * Active ATDD recovery coverage for story 5 (`spec-dynamic-events`, "manage
 * events in Settings"), activated under the configured runner by DW-30.
 *
 * Test design: the E2E half of **DE.5-COMP-003**, [P2] — "a failed load
 * re-fires on reconnect and clears its notice"
 * (`_bmad-output/test-artifacts/test-design-epic-5.md:359`), originally blocked
 * on the DW-27 fix. Risk R-003.
 *
 * ── HISTORICAL first run: RED before DW-27 ───────────────────────────────────
 *
 * Executed during the story-5 ATDD run (2026-08-19) against the local stack,
 * `npx playwright test tests/e2e/settings/events-load-recovery.spec.ts
 * --project=chromium --workers=1`. Result: **1 failed** — as predicted below,
 * and for the predicted reason. Its component-level twin
 * (DE.5-COMP-003 in EventsSettings.errorIsolation.test.tsx) failed in the same
 * run with `expected "vi.fn()" to be called 2 times, but got 1 times`: the
 * reconnect never re-fires the load at either level.
 *
 * This was not an unverified guess before it was run. The deferred-work ledger
 * recorded the original gap at
 * `_bmad-output/implementation-artifacts/deferred-work.md:244-250`:
 *
 *   "DW-27: Once the Settings events load fails, nothing re-fires it: the
 *    notice and the empty list persist until the user reloads the page."
 *   "The mount effect's deps are [userId, loadEvents]. App.tsx's otherwise
 *    identical Home effect deliberately adds isOnline, commented 'coming back
 *    online re-fires the load, so the offline error card clears without leaving
 *    Home.' There is no retry control, and clearEventsError ... still has zero
 *    production callers."
 *
 * The deps are at `src/components/Settings/EventsSettings.tsx:141`; App's Home
 * effect and its comment are at `src/App.tsx:443-447`.
 *
 * The production change was made to the load effect rather than the assertion.
 * The test design left the shape of that change open
 * (:481-483): "decide the intent first — `isOnline` in the effect deps,
 * matching App's Home effect, or a visible Retry control". This test drives
 * the first branch: it takes the browser context offline and back online, which
 * is the transition an `isOnline` dep would observe (`syncStatus.isOnline` is
 * updated from the window `online`/`offline` listeners at App.tsx:365-366). If
 * the spec decision picks a Retry control instead, the trigger below changes
 * from the `online` event to a click on that control — the three assertions do
 * not.
 *
 * Deviation from the ATDD brief, stated plainly: the brief suggested failing
 * the initial GET with an injected 500 under `skipNetworkMonitoring`. This file
 * fails the load by going offline instead. A 500 while the app stays online
 * leaves `syncStatus.isOnline` true throughout, so no dependency the named fix
 * could key on ever changes value, and the test would be red forever no matter
 * what was implemented. Going offline both fails the load through a guard read
 * from source (eventsService.ts:246-250) and produces the state transition the
 * fix is supposed to observe. No 4xx/5xx is injected anywhere, so no
 * `skipNetworkMonitoring` annotation is needed: requests that fail while the
 * context is offline are aborted rather than answered, and the
 * network-error-monitor fixture (`tests/support/merged-fixtures.ts:29-40`)
 * fails a test only on a 4xx/5xx response.
 *
 * Run:
 *   supabase start
 *   npx playwright test tests/e2e/settings/events-load-recovery.spec.ts --project=chromium
 *
 * Test data: seeded and torn down for THIS worker's pair only, keyed on
 * TEST_WORKER_INDEX through `getWorkerPairEmails()`. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import { test, expect } from '../../support/merged-fixtures';
import { navigateTo } from '../../support/helpers/navigation';
import {
  clearOwnPairEvents,
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';

/**
 * Deliberately unlike any fixed Home testid — `Wedding` slugifies to
 * `event-countdown-wedding`, a hardcoded card that must never be shadowed.
 */
const RECOVERY_LABEL = 'Settings Recovery E2E';

// Playwright trace recording corrupts when the browser context goes offline,
// producing ENOENT errors — recorded at
// `tests/e2e/offline/network-status.spec.ts:11-13`, which disables both for
// exactly this reason. `playwright.config.ts` sets trace/screenshot/video to
// 'on' globally, so the opt-out has to be stated here.
test.use({ trace: 'off', video: 'off' });

/** The list row carrying a given label. Row testids key on the event's uuid. */
function rowFor(page: Page, label: string) {
  return page.locator('[data-testid^="event-row-"]').filter({ hasText: label });
}

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome splash, matching events-crud.spec.ts:139-144.
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', Date.now().toString());
  });
});

test.afterEach(async ({ supabaseAdmin }) => {
  await clearOwnPairEvents(supabaseAdmin);
});

test.describe('A failed Settings events load recovers on reconnect (DE.5-COMP-003)', () => {
  test(
    '[P2] DE.5-COMP-003 restoring the connection re-fires the load and clears the notice, with no reload',
    async ({ page, supabaseAdmin, interceptNetworkCall }) => {
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      await clearPairEvents(supabaseAdmin, userId, partnerId);

      await log.step('Let Home complete its own load first, against an empty list');
      // Awaited rather than assumed: Home has its own loadEvents effect
      // (App.tsx:428-447), and the row below must be seeded AFTER that read
      // lands. Seed first and the client would already hold the row, making the
      // final assertion pass without anything re-firing.
      const homeLoad = interceptNetworkCall({ method: 'GET', url: '**/rest/v1/events*' });
      await page.goto('/');
      await homeLoad;

      await log.step('Load the lazy Settings chunk while the browser is online');
      // Settings is lazy-loaded. If the browser goes offline before this chunk
      // has ever been fetched, navigation fails at the module boundary and the
      // events load this test targets never runs. Visit and leave it once while
      // online so the later failure belongs to loadEvents, not Vite's module
      // request.
      await navigateTo(page, 'settings');
      await expect(page.getByTestId('settings-view')).toBeVisible();
      await expect(page.getByTestId('events-settings-empty')).toBeVisible();
      // Leave Settings through a view that never calls loadEvents. Returning to
      // Home would start a two-request background refresh; if either half were
      // still in flight when the witness was seeded, the client could learn the
      // row before reconnect recovery and let the final assertion pass for the
      // wrong reason.
      await navigateTo(page, 'mood');
      await expect(page.getByTestId('mood-tracker')).toBeVisible();

      await log.step('Seed a row the client cannot know about yet');
      await seedEvent(supabaseAdmin, {
        userId,
        label: RECOVERY_LABEL,
        eventDate: isoDateDaysFromNow(21),
        description: 'Seeded by the load-recovery test',
        icon: 'calendar',
      });

      await log.step('Go offline, then open Settings so its own load fails');
      // getEvents refuses before any request when navigator.onLine is false
      // (eventsService.ts:246-250, isOnline at src/api/errorHandlers.ts:44).
      // The dispatched event is what App.tsx:365-366 listens on to update
      // `syncStatus.isOnline` — the value an `isOnline` dep would read.
      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await navigateTo(page, 'settings');
      await expect(page.getByTestId('settings-view')).toBeVisible();

      // The failed-load notice and its explicit manual fallback are rendered
      // with role="status" and aria-live="polite".
      const loadErrorNotice = page.getByTestId('events-settings-load-error');
      await expect(loadErrorNotice).toBeVisible();
      await expect(loadErrorNotice).toContainText(
        "We couldn't load your events. Check your connection and try again."
      );
      await expect(page.getByTestId('events-settings-retry')).toBeEnabled();
      await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(0);

      await log.step('Restore the connection without reloading the page');
      // Declared before the trigger, so a re-fire cannot be missed. This is the
      // first of the three layers: the request itself, then the store's list,
      // then the UI (AGENTS.md, "Running and verifying").
      const recoveryLoad = interceptNetworkCall({
        method: 'GET',
        url: '**/rest/v1/events*',
        timeout: 15000,
      });

      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));

      // There is deliberately no page.reload() anywhere in this test: a reload
      // is precisely the workaround DW-27 described before reconnect recovery
      // was implemented.
      const { status } = await recoveryLoad;
      expect(status).toBe(200);

      const row = rowFor(page, RECOVERY_LABEL);
      await expect(row).toBeVisible();
      await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
    }
  );
});
