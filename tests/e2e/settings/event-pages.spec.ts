/**
 * E2E: Settings > Dates > an event's own page
 *
 * A linked pool account opens its own upcoming event from the Dates list and
 * edits Name, Date, Note and Icon, each on its own one-field page: Save returns
 * to the event page showing the new value, and the server row holds it. `Delete
 * event` asks first: Cancel keeps the event, Delete removes it and lands on the
 * Dates list. A reload on the event page stays on it. The partner's event is
 * edited and deleted the same way, and stays recorded under the partner.
 *
 * Seeds its own rows through the admin client and deletes only those by id, so
 * the pair's other rows are left alone. Bottom-dock form on a phone viewport, as
 * `dates-list.spec.ts` runs. The website has no Remind me, so none is checked.
 */
import { test, expect } from '../../support/merged-fixtures';
import { listDate } from '../../support/helpers/dates-list-format';
import {
  isoDateDaysFromNow,
  localDateFromIso,
  resolveOwnPair,
  seedEvent,
} from '../../support/helpers/events';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe('Settings > Dates > an event\'s page', () => {
  let seededIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    seededIds = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seededIds.length === 0) return;
    // A row the test deleted is already gone; deleting by id again is a no-op.
    const { error } = await supabaseAdmin.from('events').delete().in('id', seededIds);
    if (error) throw new Error(`Failed to delete the rows this spec seeded: ${error.message}`);
  });

  test('[P1] should edit each field of an own event, then delete it after a Cancel', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: an own upcoming event
    const anchor = new Date();
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const id = await seedEvent(supabaseAdmin, {
      userId,
      label: 'Event page trip',
      eventDate: isoDateDaysFromNow(5, anchor),
      description: 'Pack light',
      icon: 'calendar',
    });
    seededIds.push(id);
    const row = async () =>
      (await supabaseAdmin.from('events').select('label, event_date, description, icon').eq('id', id)).data?.[0];
    await openSettingsFromHome(page, interceptNetworkCall);

    // WHEN: the event's row on the Dates list is tapped
    await page.getByTestId('settings-dates-row').click();
    await page.getByTestId(`settings-dates-event-${id}`).click();

    // THEN: its page opens, titled with the event, with its four rows and Delete
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Event page trip' })).toBeVisible();
    await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName('Name, Event page trip');
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName('Note, Pack light');
    await expect(page.getByTestId('settings-event-icon')).toHaveAccessibleName('Icon, Calendar');
    await expect(page.getByTestId('settings-event-delete')).toHaveText('Delete event');
    await expect(page.getByTestId('settings-remind-me')).toHaveCount(0);

    // WHEN: Name is changed and saved
    await page.getByTestId('settings-event-name').click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}/name$`));
    await page.getByTestId('settings-event-name-field').fill('Event page cabin');
    await page.getByTestId('settings-field-save').click();

    // THEN: back on the event page, the title and the row show it, and the server holds it
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Event page cabin' })).toBeVisible();
    await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName('Name, Event page cabin');
    expect((await row())?.label).toBe('Event page cabin');

    // WHEN: Date is changed and saved
    const newDate = isoDateDaysFromNow(12, anchor);
    await page.getByTestId('settings-event-date').click();
    await page.getByTestId('settings-event-date-field').fill(newDate);
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new date and the server holds it
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(newDate), new Date())}`
    );
    expect((await row())?.event_date).toBe(newDate);

    // WHEN: Note is changed and saved
    await page.getByTestId('settings-event-note').click();
    await page.getByTestId('settings-event-note-field').fill('Bring the camera');
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new note and the server holds it
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName('Note, Bring the camera');
    expect((await row())?.description).toBe('Bring the camera');

    // WHEN: Icon is changed and saved
    await page.getByTestId('settings-event-icon').click();
    await page.getByTestId('settings-event-icon-ring').click();
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new icon and the server holds it
    await expect(page.getByTestId('settings-event-icon')).toHaveAccessibleName('Icon, Ring');
    expect((await row())?.icon).toBe('ring');

    // WHEN: the page reloads
    await page.reload();

    // THEN: it is still the event's page
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Event page cabin' })).toBeVisible();

    // WHEN: Delete event is tapped, then Cancel
    await page.getByTestId('settings-event-delete').click();
    await expect(page.getByRole('dialog', { name: 'Delete this event?' })).toBeVisible();
    await page.getByTestId('settings-event-delete-confirmation-cancel').click();

    // THEN: the dialog closes and the event is untouched
    await expect(page.getByTestId('settings-event-delete-confirmation')).toHaveCount(0);
    await expect(page.getByTestId('settings-event-page')).toBeVisible();
    expect(await row()).toBeDefined();

    // WHEN: Delete event is tapped and Delete confirmed
    await page.getByTestId('settings-event-delete').click();
    await page.getByTestId('settings-event-delete-confirmation-confirm').click();

    // THEN: the app is on the Dates list, the event is gone from it and from the server
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(page.getByTestId(`settings-dates-event-${id}`)).toHaveCount(0);
    expect(await row()).toBeUndefined();
  });

  test("[P1] should edit and delete the partner's event like an own one", async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: an upcoming event the partner made
    const anchor = new Date();
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    const id = await seedEvent(supabaseAdmin, {
      userId: partnerId,
      label: 'Event page partner',
      eventDate: isoDateDaysFromNow(6, anchor),
      description: 'Her idea',
      icon: 'plane',
    });
    seededIds.push(id);
    const row = async () =>
      (await supabaseAdmin.from('events').select('user_id, description').eq('id', id)).data?.[0];
    await openSettingsFromHome(page, interceptNetworkCall);

    // WHEN: its row on the Dates list is tapped
    await page.getByTestId('settings-dates-row').click();
    await page.getByTestId(`settings-dates-event-${id}`).click();

    // THEN: the page shows the same editable rows and Delete as an own event
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Event page partner' })).toBeVisible();
    await expect(page.getByTestId('settings-event-name')).toHaveAccessibleName('Name, Event page partner');
    await expect(page.getByTestId('settings-event-date')).toHaveAccessibleName(
      `Date, ${listDate(localDateFromIso(isoDateDaysFromNow(6, anchor)), new Date())}`
    );
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName('Note, Her idea');
    await expect(page.getByTestId('settings-event-icon')).toHaveAccessibleName('Icon, Plane');
    await expect(page.getByTestId('settings-event-delete')).toHaveText('Delete event');

    // WHEN: Note is changed and saved
    await page.getByTestId('settings-event-note').click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}/note$`));
    await page.getByTestId('settings-event-note-field').fill('Our idea');
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new note, and the server holds it under the partner still
    await expect(page).toHaveURL(new RegExp(`/settings/dates/event/${id}$`));
    await expect(page.getByTestId('settings-event-note')).toHaveAccessibleName('Note, Our idea');
    expect(await row()).toEqual({ user_id: partnerId, description: 'Our idea' });

    // WHEN: Delete event is tapped and Delete confirmed
    await page.getByTestId('settings-event-delete').click();
    await page.getByTestId('settings-event-delete-confirmation-confirm').click();

    // THEN: the Dates list, without the event, and the server row is gone
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByTestId(`settings-dates-event-${id}`)).toHaveCount(0);
    expect(await row()).toBeUndefined();
  });
});
