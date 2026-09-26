/**
 * UI helpers for waiting on the events data Home and Settings load.
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

/**
 * Wait until Settings' events load, whose upcoming read is `settingsRead`, has
 * settled successfully.
 *
 * `aria-busy` starts `false` before the mount load begins and goes `false` on
 * failure too, so it is read only after the read has answered, and the load
 * error banner — which a failed load shows above rows already on screen — must
 * be absent.
 */
export async function settingsEventsLoaded(
  page: Page,
  settingsRead: ReturnType<InterceptNetworkCallFn>
): Promise<void> {
  expect((await settingsRead).status).toBe(200);
  await expect(page.getByTestId('events-settings-load-region')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('events-settings-load-error')).toHaveCount(0);
}

/**
 * Open Settings the way a user does — Home first, then the gear — and return
 * once Settings' own events load has settled.
 *
 * Home and Settings send identical GETs, so only ordering tells them apart:
 * Home's load is awaited and allowed to settle in the store before the second
 * arm is registered, which makes the second one Settings' mount read.
 */
export async function openSettingsFromHome(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const homeRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.goto('/');
  expect((await homeRead).status).toBe(200);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__APP_STORE__!.getState();
        return !state.eventsIsLoading && state.eventsPagination !== null;
      })
    )
    .toBe(true);

  const settingsRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await settingsEventsLoaded(page, settingsRead);
}

/**
 * Reload /settings and return once the reload's own events load has settled.
 *
 * The saved copy renders before the server answers, so rows seen before this
 * returns may be the copy's rather than the server's.
 */
export async function reloadSettings(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<void> {
  const settingsRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
  await page.reload();
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await settingsEventsLoaded(page, settingsRead);
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
