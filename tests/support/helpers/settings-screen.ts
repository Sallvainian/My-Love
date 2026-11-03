/**
 * UI helpers for opening Settings and the Dates list, and for waiting on the events data Home and the Dates list load.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel. Kept apart
 * from `events.ts`, whose pure functions over `supabaseAdmin` are also used by
 * the `api` project and a Vitest unit test, neither of which should load the
 * Playwright fixture graph this module needs.
 */
import type { Locator, Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { expect } from '../merged-fixtures';
import { navigateTo } from './navigation';
import { UPCOMING_EVENTS_READ } from './reads';
import { recurseUntil } from './recurse';

/**
 * Open Settings the way a user does — Home first, then the gear — and return
 * once Settings is on screen.
 *
 * Settings itself sends no events read: only the Dates list (`DatesPage`) and
 * an event's page load events, on their own mount. So this waits for Home's
 * load only, and a spec that needs the Dates list's read arms it before the
 * tap that opens the list (`openDatesList`).
 */
export async function openSettingsFromHome(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.goto('/');
  expect((await homeRead).status).toBe(200);
  await returnToSettings(page);
}

/**
 * Leave Home for Settings by the gear and return once Settings is on screen.
 *
 * Home's own events load is allowed to settle in the store first, so a read
 * armed afterwards (the Dates list's mount read) cannot latch onto Home's:
 * Home and the Dates list send identical GETs, and only ordering tells them
 * apart.
 */
export async function returnToSettings(page: Page): Promise<void> {
  await recurseUntil(
    () =>
      page.evaluate(() => {
        const state = window.__APP_STORE__!.getState();
        return !state.eventsIsLoading && state.eventsPagination !== null;
      }),
    (v) => {
      expect(v).toBe(true);
    }
  );

  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
}

/** Reload /settings and return once Settings is on screen. */
export async function reloadSettings(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId('settings-view')).toBeVisible();
}

/**
 * Open the Dates list from the Settings top page and return once the list's
 * own mount read has answered successfully. The saved copy renders before the
 * server answers, so rows seen before this returns may be the copy's.
 *
 * Call it only after Home's events read has settled in the store
 * (`returnToSettings` / `openSettingsFromHome` wait for that): Home and the
 * Dates list send identical GETs, so an arm registered earlier can latch onto
 * Home's.
 */
export async function openDatesList(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const datesRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.getByTestId('settings-dates-row').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
  expect((await datesRead).status).toBe(200);
}

/**
 * Reload on /settings/dates and return once the reload's own events read has
 * answered successfully, with the Dates list on screen.
 */
export async function reloadDatesList(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const datesRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
  expect((await datesRead).status).toBe(200);
}

/**
 * Home's events column in a loaded state: a stored event's card or the empty
 * placeholder, never the load error or a gap. The static wedding card is not a
 * stored event, so it does not count.
 */
export function homeEventsSettled(page: Page): Locator {
  return page
    .locator('[data-testid^="event-countdown-"]:not([data-testid="event-countdown-wedding"])')
    .or(page.getByTestId('events-empty-placeholder'))
    .first();
}
