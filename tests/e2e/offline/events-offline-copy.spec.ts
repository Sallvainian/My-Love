/**
 * E2E: the couple's events on the shared local-copy mechanism
 * (spec-unified-data-storage story 5).
 *
 * After one online session, Home and the Dates list show the saved events offline,
 * with no load-error card: first from this session's own server answer, then,
 * after a reload that cannot reach the events table, from the `events` local
 * copy alone.
 *
 * Test data: one row seeded for THIS worker's own user (`resolveOwnPair`, keyed
 * on TEST_PARALLEL_INDEX) and deleted by id at teardown. No partner is linked or
 * unlinked, no password reset, no shared row nulled.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { goOffline } from '../../support/helpers/offline';
import {
  clearPairEvents,
  isoDateDaysFromNow,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { deleteRowById } from '../../support/helpers/teardown';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

/** Unlike any fixed Home testid; slugifies to `event-countdown-offline-copy-e2e`. */
const LABEL = 'Offline Copy E2E';
const HOME_CARD = 'event-countdown-offline-copy-e2e';

/** Labels in the signed-in account's saved `events` copy, or `null`. */
async function savedEventLabels(page: Page): Promise<string[] | null> {
  return (await savedLocalCopy<{ label: string }[]>(page, 'events'))?.map((e) => e.label) ?? null;
}

/** The Dates list row for the seeded event. */
function settingsRow(page: Page) {
  return page.locator('[data-testid^="settings-dates-event-"]').filter({ hasText: LABEL });
}

/** Opens the Dates list from the top page of Settings, which a dock tap lands on. */
async function openDatesList(page: Page) {
  await page.getByTestId('settings-dates-row').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
}

async function expectListedOffline(page: Page) {
  await navigateTo(page, 'home');
  await expect(page.getByTestId(HOME_CARD)).toBeVisible();
  await expect(page.getByTestId('events-load-error')).toHaveCount(0);

  await navigateTo(page, 'settings');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await openDatesList(page);
  await expect(settingsRow(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await dismissWelcomeSplash(page);
});

test.describe('Events from the local copy', () => {
  test('[P1] events loaded once online are listed offline on Home and on the Dates list', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await clearPairEvents(supabaseAdmin, userId, partnerId);
    const anchor = new Date();
    const eventId = await seedEvent(supabaseAdmin, {
      userId,
      label: LABEL,
      eventDate: isoDateDaysFromNow(14, anchor),
      icon: 'plane',
    });
    cleanup.defer('delete the seeded event', () => deleteRowById(supabaseAdmin, 'events', eventId));

    // GIVEN: Home loads online, which saves the copy. Settings is lazy and
    // dev mode has no service worker, so its module is loaded while online.
    const upcomingRead = interceptNetworkCall({ method: 'GET', url: UPCOMING_EVENTS_READ });
    await page.goto('/');
    const upcoming = await upcomingRead;
    expect(upcoming.status).toBe(200);
    expect(upcoming.responseJson).toEqual([expect.objectContaining({ id: eventId, label: LABEL })]);
    await expect(page.getByTestId(HOME_CARD)).toBeVisible();
    await recurseUntil(() => savedEventLabels(page), (v) => { expect(v).toEqual([LABEL]); });
    await navigateTo(page, 'settings');
    await openDatesList(page);
    await expect(settingsRow(page)).toBeVisible();
    await navigateTo(page, 'mood');
    await expect(page.getByTestId('mood-tracker')).toBeVisible();

    // WHEN offline in the same session, returning to Home through the dock.
    await goOffline(page, true);
    // THEN: listed, with no load-error card or banner.
    await expectListedOffline(page);

    // AND: a reload that cannot reach the events table, then offline, shows
    // the saved copy alone — this session never had a server answer.
    await goOffline(page, false);
    // playwright-utils deviation: the route must be installed before the next navigation and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
    await page.route('**/rest/v1/events*', (route) => route.abort());
    // The reload stays on /settings/dates, whose list comes from the copy.
    await page.goto('/settings/dates');
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(settingsRow(page)).toBeVisible();
    await navigateTo(page, 'mood');
    await expect(page.getByTestId('mood-tracker')).toBeVisible();
    await goOffline(page, true);
    await expectListedOffline(page);
    expect(await page.evaluate(() => window.__APP_STORE__?.getState().eventsError ?? null)).toBeNull();
  });
});
