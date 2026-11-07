/**
 * E2E: The Settings navigation rules, walked together
 *
 * The epic's Notes decisions that no single spec walks: what a reload restores
 * (a list page or a date page reloads to itself; a one-field page or a form
 * page reloads to the page above it), back from a date page opened from Home,
 * a pasted link (a page that is the session's first entry goes up by replacing
 * its entry, skipping an ancestor with no page), and Home as the bottom layer
 * (back from any view lands on Home however it was reached through the dock,
 * and back on Home leaves nothing of the app's behind).
 *
 * `settings-stack`, `home-date-entry-points`, `dock` and `routing` each prove
 * part of this; "back on Home leaves the app" had no E2E check. Playwright's
 * page starts at about:blank, so the visit's first app entry is Home and one
 * more back from it must leave the origin.
 *
 * Bottom-dock form on a phone viewport (390x844) only. The column form needs
 * `env()` insets a desktop browser cannot emulate; the unit tests prove it.
 * Seeds its own events through the admin client and deletes only those ids.
 */
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { isoDateDaysFromNow, resolveOwnPair, seedEvent } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { openNewDateForm } from '../../support/helpers/new-date-forms';
import { COUPLE_SETTINGS_READ, UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import {
  openDatesList,
  openSettingsFromHome,
  reloadDatesList,
} from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

const historyLength = (page: Page) => page.evaluate(() => window.history.length);

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

const back = (page: Page) => page.getByRole('button', { name: 'Back' });

const homeIsLit = async (page: Page) => {
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
};

/** Home with the reads behind its cards answered. Armed before the page loads. */
async function openHome(page: Page, interceptNetworkCall: InterceptNetworkCallFn) {
  const reads = [UPCOMING_EVENTS_READ, COUPLE_SETTINGS_READ].map((url) =>
    interceptNetworkCall({ method: 'GET', url })
  );
  await page.goto('/');
  for (const { status } of await Promise.all(reads)) expect(status).toBe(200);
  await expect(page.getByTestId('time-together')).toBeVisible();
}

/** Back on Home: at `/`, Home lit. */
async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('time-together')).toBeVisible();
  await homeIsLit(page);
}

/** One more back from Home leaves the app: the page is back on about:blank. */
async function expectBackOnHomeLeavesTheApp(page: Page) {
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
}

test.describe('Settings navigation rules', () => {
  let seededEvents: string[] = [];

  test.beforeEach(async ({ page }) => {
    seededEvents = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seededEvents.length > 0) {
      const { error } = await supabaseAdmin.from('events').delete().in('id', seededEvents);
      if (error) throw new Error(`Failed to delete the events this spec seeded: ${error.message}`);
    }
  });

  /** Seed one own upcoming event and remember its id for `afterEach`. */
  async function seedOwnEvent(
    supabaseAdmin: Parameters<typeof resolveOwnPair>[0],
    tag: string,
    workerIndex: number
  ) {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Nav rules ${tag} ${workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(5, new Date()),
    });
    seededEvents.push(id);
    return { id, label };
  }

  test('[P1] should reload a list page and a date page to themselves', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own upcoming event, and the Dates list open from the gear
    const { id, label } = await seedOwnEvent(supabaseAdmin, 'reload', testInfo.workerIndex);
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);
    await expect(page).toHaveURL(/\/settings\/dates$/);

    // WHEN: the list page is reloaded
    await reloadDatesList(page, interceptNetworkCall);

    // THEN: it is still the Dates list at its URL
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(heading(page, 'Dates')).toBeVisible();

    // WHEN: the seeded event's row is opened and the date page is reloaded
    await page.getByTestId(`settings-dates-event-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(heading(page, label)).toBeVisible();
    await page.reload();

    // THEN: it is still that event's page, titled with its label
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(heading(page, label)).toBeVisible();
  });

  test('[P1] should reload a one-field page and a form page to the page above them', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: Settings › Profile › Name, a one-field page
    await openSettingsFromHome(page, interceptNetworkCall);
    await page.getByTestId('settings-profile-row').click();
    await expect(heading(page, 'Profile')).toBeVisible();
    await page.getByTestId('settings-profile-name').click();
    await expect(page).toHaveURL(/\/settings\/profile\/name$/);
    await expect(heading(page, 'Name')).toBeVisible();

    // WHEN: the page is reloaded
    await page.reload();

    // THEN: Profile shows at its URL, and back goes up to the Settings top page
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(heading(page, 'Profile')).toBeVisible();
    await expect(heading(page, 'Name')).toHaveCount(0);
    await back(page).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(heading(page, 'Settings')).toBeVisible();

    // GIVEN: the New event form, opened from the Dates list
    await openDatesList(page, interceptNetworkCall);
    await openNewDateForm(page, 'event');
    await expect(page.getByTestId('settings-new-event-name-field')).toBeVisible();

    // WHEN: the form page is reloaded
    await reloadDatesList(page, interceptNetworkCall);

    // THEN: the Dates list shows at its URL, with no form
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(heading(page, 'Dates')).toBeVisible();
    await expect(page.getByTestId('settings-new-event-name-field')).toHaveCount(0);
  });

  test('[P1] should keep Home lit on a date page opened from Home, and after back', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own upcoming event card on Home
    const { id, label } = await seedOwnEvent(supabaseAdmin, 'home', testInfo.workerIndex);
    await openHome(page, interceptNetworkCall);
    const card = page.getByRole('button', { name: label });
    await expect(card).toBeVisible();

    // WHEN: the card is tapped
    await card.click();

    // THEN: the date page shows at its URL with Home lit
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(heading(page, label)).toBeVisible();
    await homeIsLit(page);

    // WHEN: the back arrow is tapped
    await back(page).click();

    // THEN: Home, at /, still lit
    await expectHome(page);
    await expect(card).toBeVisible();
  });

  test('[P1] should go up one level from pasted links without leaving the app', async ({
    page,
    supabaseAdmin,
  }, testInfo) => {
    // GIVEN: a pasted link to a date page, which is the session's first app entry
    const { id, label } = await seedOwnEvent(supabaseAdmin, 'pasted', testInfo.workerIndex);
    await page.goto(`/settings/dates/event/${id}`);
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(heading(page, label)).toBeVisible();
    const length = await historyLength(page);

    // WHEN: the back arrow is tapped
    await back(page).click();

    // THEN: the Dates list, skipping `dates/event` (which has no page), by
    // replacing the entry: the history did not grow
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(heading(page, 'Dates')).toBeVisible();
    expect(await historyLength(page)).toBe(length);

    // WHEN: the arrow is tapped again
    await back(page).click();

    // THEN: the Settings top page, still inside the app
    await expect(page).toHaveURL(/\/settings$/);
    await expect(heading(page, 'Settings')).toBeVisible();
    expect(await historyLength(page)).toBe(length);

    // GIVEN: a pasted link to a one-field page
    await page.goto('/settings/profile/name');

    // THEN: it opens on the page above it, Profile
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(heading(page, 'Profile')).toBeVisible();
    await expect(heading(page, 'Name')).toHaveCount(0);
  });

  test('[P0] should land on Home from any view reached through the dock, and leave the app on one more back', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: Home, then Daily, Notes and Photos in turn through the dock
    await openHome(page, interceptNetworkCall);
    await navigateTo(page, 'daily');
    await expect(page).toHaveURL(/\/daily$/);
    await navigateTo(page, 'notes');
    await expect(page).toHaveURL(/\/notes$/);
    await navigateTo(page, 'photos');
    await expect(page).toHaveURL(/\/photos$/);
    await expect(
      page.getByTestId('photo-gallery').or(page.getByTestId('photo-gallery-empty-state'))
    ).toBeVisible();

    // WHEN: back is pressed once
    await page.goBack();

    // THEN: Home, not Notes or Daily, with Home lit
    await expectHome(page);

    // WHEN: back is pressed on Home
    // THEN: nothing of the app's is left behind: the page leaves the origin
    await expectBackOnHomeLeavesTheApp(page);

    // GIVEN: a fresh visit, deep inside Settings (Settings › Profile › Name),
    // then a dock pick sideways to Partner
    await openSettingsFromHome(page, interceptNetworkCall);
    await page.getByTestId('settings-profile-row').click();
    await expect(heading(page, 'Profile')).toBeVisible();
    await page.getByTestId('settings-profile-name').click();
    await expect(page).toHaveURL(/\/settings\/profile\/name$/);
    await navigateTo(page, 'partner');
    await expect(page).toHaveURL(/\/partner$/);
    await expect(page.getByTestId('partner-mood-view')).toBeVisible();

    // WHEN: back is pressed once
    await page.goBack();

    // THEN: Home, the Settings entries dropped, with Home lit
    await expectHome(page);

    // WHEN: back is pressed on Home
    // THEN: the page leaves the origin again
    await expectBackOnHomeLeavesTheApp(page);
  });
});
