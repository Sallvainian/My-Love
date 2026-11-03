/**
 * E2E: Home's date cards and Add button open the date pages
 *
 * A linked pool account taps a Home card and lands on that date's page with
 * Home still lit in the dock; the back arrow, or the browser's back, returns
 * to Home. The mark survives a reload on the page, and a page opened from the
 * Dates list inside Settings does not light Home. Home's Add opens the New
 * event form directly, with no Kind chooser.
 *
 * Seeds its own rows through the admin client and deletes only those: by id
 * for what it seeds, by label and owner for the event it adds through the form.
 * Bottom-dock form on a phone viewport (390x844), as `event-pages.spec.ts` runs.
 */
import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import {
  isoDateDaysFromNow,
  localDateFromIso,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { fillNewEventForm } from '../../support/helpers/new-date-forms';
import { COUPLE_SETTINGS_READ, EVENTS_WRITE, UPCOMING_EVENTS_READ } from '../../support/helpers/reads';
import { openDatesList, openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** Home with the reads behind its cards answered. Armed before the page loads. */
async function openHome(page: Page, interceptNetworkCall: InterceptNetworkCallFn) {
  const reads = [UPCOMING_EVENTS_READ, COUPLE_SETTINGS_READ].map((url) =>
    interceptNetworkCall({ method: 'GET', url })
  );
  await page.goto('/');
  for (const { status } of await Promise.all(reads)) expect(status).toBe(200);
  await expect(page.getByTestId('time-together')).toBeVisible();
}

/** A Home card's tap target, named by the card's label. */
const cardButton = (page: Page, label: string) => page.getByRole('button', { name: label });

const homeIsLit = async (page: Page) => {
  await expect(page.getByTestId('nav-home')).toHaveAttribute('aria-current', 'page');
};

test.describe("Home's date cards and Add button", () => {
  let seededEvents: string[] = [];
  let seededAnniversaries: string[] = [];
  let addedLabels: string[] = [];

  test.beforeEach(async ({ page }) => {
    seededEvents = [];
    seededAnniversaries = [];
    addedLabels = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    // A row the test deleted is already gone; deleting by id again is a no-op.
    if (seededEvents.length > 0) {
      const { error } = await supabaseAdmin.from('events').delete().in('id', seededEvents);
      if (error) throw new Error(`Failed to delete the events this spec seeded: ${error.message}`);
    }
    if (seededAnniversaries.length > 0) {
      const { error } = await supabaseAdmin
        .from('anniversaries')
        .delete()
        .in('id', seededAnniversaries);
      if (error) throw new Error(`Failed to delete the anniversaries this spec seeded: ${error.message}`);
    }
    if (addedLabels.length > 0) {
      const { userId } = await resolveOwnPair(supabaseAdmin);
      const { error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('user_id', userId)
        .in('label', addedLabels);
      if (error) throw new Error(`Failed to delete the events this spec added: ${error.message}`);
    }
  });

  test('[P1] should open an event card on its page with Home lit, and return to Home by the back arrow', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own upcoming event on Home
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry trip ${testInfo.workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(5, anchor),
    });
    seededEvents.push(id);
    await openHome(page, interceptNetworkCall);
    await expect(cardButton(page, label)).toBeVisible();
    const before = await page.evaluate(() => window.history.length);

    // WHEN: the card is tapped
    await cardButton(page, label).click();

    // THEN: the event's page opens as one new entry, with Home lit
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    await homeIsLit(page);
    await expect(page.getByTestId('nav-settings')).toHaveCount(0);

    // WHEN: the back arrow is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: Home, at /, still lit
    await expect(page).toHaveURL(/\/$/);
    await expect(cardButton(page, label)).toBeVisible();
    await homeIsLit(page);
  });

  test('[P1] should keep Home lit through a reload on the date page, and still go back to Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: Home's event card opened its page
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry reload ${testInfo.workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(5, anchor),
    });
    seededEvents.push(id);
    await openHome(page, interceptNetworkCall);
    await cardButton(page, label).click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));

    // WHEN: the page reloads
    await page.reload();

    // THEN: it is the same page, with Home lit
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await homeIsLit(page);

    // WHEN: back is taken
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: Home, lit
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('time-together')).toBeVisible();
    await homeIsLit(page);
  });

  test('[P1] should change an event\'s date from Home and show the new date on return', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own event five days out, opened from its Home card
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry flow ${testInfo.workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(5, anchor),
    });
    seededEvents.push(id);
    await openHome(page, interceptNetworkCall);
    const card = page.locator('[data-testid^="event-countdown-"]').filter({ hasText: label });
    const valueBefore = (await card.getByTestId('countdown-value').textContent()) ?? '';
    await cardButton(page, label).click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));

    // WHEN: Date is changed to twelve days out and saved
    const newDate = isoDateDaysFromNow(12, anchor);
    await page.getByTestId('settings-event-date').click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}/date$`));
    await homeIsLit(page);
    await page.getByTestId('settings-event-date-field').fill(newDate);
    await page.getByTestId('settings-field-save').click();

    // THEN: back on the event page with Home lit, and the server holds the date
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await homeIsLit(page);
    const { data, error } = await supabaseAdmin.from('events').select('event_date').eq('id', id);
    expect(error).toBeNull();
    expect(data?.[0]?.event_date).toBe(newDate);
    expect(localDateFromIso(newDate).getTime()).toBeGreaterThan(anchor.getTime());

    // WHEN: back is taken
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: Home shows the card with its new countdown
    await expect(page).toHaveURL(/\/$/);
    await expect(card.getByTestId('countdown-value')).not.toHaveText(valueBefore);
    await homeIsLit(page);
  });

  test('[P1] should open Together since from its card and return to Home by the browser back', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: Home with the Together card
    await openHome(page, interceptNetworkCall);

    // WHEN: the card is tapped
    await page.getByTestId('time-together-open').click();

    // THEN: the Together since page opens with Home lit
    await expect(page).toHaveURL(/\/settings\/dates\/together-since$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Together since' })).toBeVisible();
    await homeIsLit(page);

    // WHEN: the browser goes back
    await page.goBack();

    // THEN: Home, lit
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('time-together')).toBeVisible();
    await homeIsLit(page);
  });

  test('[P1] should open an anniversary card on its page', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own anniversary falling tomorrow, so it is among Home's next three
    const tomorrow = isoDateDaysFromNow(1, new Date());
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry anniv ${testInfo.workerIndex}-${Date.now()}`;
    const { data, error } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: userId, event_date: `2020${tomorrow.slice(4)}`, label })
      .select('id')
      .single();
    expect(error).toBeNull();
    const id = data!.id;
    seededAnniversaries.push(id);
    const anniversariesRead = interceptNetworkCall({
      method: 'GET',
      url: '**/rest/v1/anniversaries*',
    });
    await openHome(page, interceptNetworkCall);
    expect((await anniversariesRead).status).toBe(200);

    // WHEN: the card is tapped
    await cardButton(page, label).click();

    // THEN: the anniversary's page opens, with Home lit
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await homeIsLit(page);

    // WHEN: back is tapped
    await page.getByRole('button', { name: 'Back' }).click();

    // THEN: Home
    await expect(page).toHaveURL(/\/$/);
    await expect(cardButton(page, label)).toBeVisible();
  });

  test('[P1] should open New event from Add with no Kind chooser, and show the added event on Home', async ({
    page,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: Home
    const anchor = new Date();
    const label = `Entry added ${testInfo.workerIndex}-${Date.now()}`;
    addedLabels.push(label);
    await openHome(page, interceptNetworkCall);

    // WHEN: Add is tapped
    await page.getByTestId('home-add-event').click();

    // THEN: the New event form opens directly, with Home lit
    await expect(page).toHaveURL(/\/settings\/dates\/new-event$/);
    await expect(page.getByTestId('settings-new-event-page')).toBeVisible();
    await expect(page.getByTestId('settings-kind-chooser')).toHaveCount(0);
    await homeIsLit(page);

    // WHEN: Cancel is tapped
    await page.getByRole('button', { name: 'Cancel' }).click();

    // THEN: Home, still lit
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('home-add-event')).toBeVisible();
    await homeIsLit(page);

    // WHEN: Add is tapped again, the form is filled and Add is confirmed
    await page.getByTestId('home-add-event').click();
    await expect(page.getByTestId('settings-new-event-page')).toBeVisible();
    await fillNewEventForm(page, { label, date: isoDateDaysFromNow(9, anchor) });
    const createResponse = interceptNetworkCall({ method: 'POST', url: EVENTS_WRITE });
    await page.getByTestId('settings-form-add').click();
    expect((await createResponse).status).toBe(201);

    // THEN: Home shows the new card, and does not open the new event's page
    await expect(page).toHaveURL(/\/$/);
    await expect(cardButton(page, label)).toBeVisible();
    await homeIsLit(page);
  });

  test('[P1] should return to Home with the card gone after deleting an event opened from Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own upcoming event on Home
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry delete ${testInfo.workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(6, anchor),
    });
    seededEvents.push(id);
    await openHome(page, interceptNetworkCall);

    // WHEN: its card is tapped, then Delete event is confirmed
    await cardButton(page, label).click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await page.getByTestId('settings-event-delete').click();
    await page.getByTestId('settings-event-delete-confirmation-confirm').click();

    // THEN: Home, lit, with the card gone and the server row deleted
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('home-add-event')).toBeVisible();
    await homeIsLit(page);
    await expect(cardButton(page, label)).toHaveCount(0);
    const { data, error } = await supabaseAdmin.from('events').select('id').eq('id', id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('[P1] should not light Home for a date page opened from the Dates list', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own event, and Settings opened by the gear
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const label = `Entry list ${testInfo.workerIndex}-${Date.now()}`;
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label,
      eventDate: isoDateDaysFromNow(5, anchor),
    });
    seededEvents.push(id);
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);

    // WHEN: the event's row is tapped
    await page.getByTestId(`settings-dates-event-${id}`).click();

    // THEN: its page opens and no dock destination is lit
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByTestId('nav-home')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-testid="nav-dock"] [aria-current="page"]')).toHaveCount(0);
  });
});
