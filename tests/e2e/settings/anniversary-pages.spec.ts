/**
 * E2E: Settings > Dates > an anniversary's own page
 *
 * A linked pool account opens its own anniversary from the Dates list and
 * edits Name, Date and Note, each on its own one-field page: Save returns to
 * the anniversary page showing the new value, and the server row holds it. A
 * reload on the page stays on it. `Delete anniversary` asks first: Cancel keeps
 * the anniversary, Delete removes it and lands on the Dates list. An
 * anniversary the partner owns is never listed on the reader's Dates list.
 *
 * Seeds its own rows through the admin client and deletes only those by id, so
 * the pair's other rows are left alone. Bottom-dock form on a phone viewport,
 * as `event-pages.spec.ts` runs. The website has no Remind me, so none is
 * checked.
 */
import { test, expect } from '../../support/merged-fixtures';
import { dayMonth } from '../../support/helpers/dates-list-format';
import { isoDateDaysFromNow, localDateFromIso, resolveOwnPair } from '../../support/helpers/events';
import { openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe("Settings > Dates > an anniversary's page", () => {
  let seededIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    seededIds = [];
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seededIds.length === 0) return;
    // A row the test deleted is already gone; deleting by id again is a no-op.
    const { error } = await supabaseAdmin.from('anniversaries').delete().in('id', seededIds);
    if (error) throw new Error(`Failed to delete the rows this spec seeded: ${error.message}`);
  });

  test('[P1] should edit each field of an own anniversary, then delete it after a Cancel', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: an own anniversary, and one the partner owns
    const anchor = new Date();
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const stamp = `${testInfo.workerIndex}-${Date.now()}`;
    const label = `Anniv page ${stamp}`;
    const partnerLabel = `Anniv partner ${stamp}`;
    const { data: own, error: ownError } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: userId, event_date: '2022-04-04', label, description: 'The cafe' })
      .select('id')
      .single();
    expect(ownError).toBeNull();
    const id = own!.id;
    seededIds.push(id);
    const { data: theirs, error: theirError } = await supabaseAdmin
      .from('anniversaries')
      .insert({ user_id: partnerId, event_date: '2021-09-09', label: partnerLabel })
      .select('id')
      .single();
    expect(theirError).toBeNull();
    seededIds.push(theirs!.id);
    // Throws on a failed read, so `undefined` means only "no such row".
    const row = async () => {
      const { data, error } = await supabaseAdmin
        .from('anniversaries')
        .select('label, event_date, description')
        .eq('id', id);
      if (error) throw new Error(`Could not read the anniversary row: ${error.message}`);
      return data[0];
    };
    await openSettingsFromHome(page, interceptNetworkCall);

    // WHEN: the Dates list is opened
    await page.getByTestId('settings-dates-row').click();

    // THEN: the own anniversary is listed and the partner's never is
    const anniversaries = page.getByTestId('settings-dates-anniversaries');
    await expect(anniversaries).toContainText(label);
    await expect(anniversaries).not.toContainText(partnerLabel);
    await expect(page.getByTestId(`settings-dates-anniversary-${id}`)).toBeVisible();
    await expect(page.getByText(partnerLabel)).toHaveCount(0);

    // WHEN: the anniversary's row is tapped
    await page.getByTestId(`settings-dates-anniversary-${id}`).click();

    // THEN: its page opens, titled with it, with Name, Date, Note and Delete, and no Icon
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(page.getByTestId('settings-anniversary-name')).toHaveAccessibleName(`Name, ${label}`);
    await expect(page.getByTestId('settings-anniversary-date')).toHaveAccessibleName(
      `Date, ${dayMonth(localDateFromIso('2022-04-04'))}`
    );
    await expect(page.getByTestId('settings-anniversary-note')).toHaveAccessibleName('Note, The cafe');
    await expect(page.getByTestId('settings-anniversary-delete')).toHaveText('Delete anniversary');
    await expect(page.getByText('Icon', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('settings-remind-me')).toHaveCount(0);

    // WHEN: Name is changed and saved
    await page.getByTestId('settings-anniversary-name').click();
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}/name$`));
    await page.getByTestId('settings-anniversary-name-field').fill(`${label} renamed`);
    await page.getByTestId('settings-field-save').click();

    // THEN: back on the page, the title and the row show it, and the server holds it
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: `${label} renamed` })).toBeVisible();
    await expect(page.getByTestId('settings-anniversary-name')).toHaveAccessibleName(
      `Name, ${label} renamed`
    );
    expect((await row())?.label).toBe(`${label} renamed`);

    // WHEN: Date is changed and saved
    const newDate = isoDateDaysFromNow(-400, anchor);
    await page.getByTestId('settings-anniversary-date').click();
    await page.getByTestId('settings-anniversary-date-field').fill(newDate);
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new date and the server holds it
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}$`));
    await expect(page.getByTestId('settings-anniversary-date')).toHaveAccessibleName(
      `Date, ${dayMonth(localDateFromIso(newDate))}`
    );
    expect((await row())?.event_date).toBe(newDate);

    // WHEN: Note is changed and saved
    await page.getByTestId('settings-anniversary-note').click();
    await page.getByTestId('settings-anniversary-note-field').fill('The other cafe');
    await page.getByTestId('settings-field-save').click();

    // THEN: the row reads the new note and the server holds it
    await expect(page.getByTestId('settings-anniversary-note')).toHaveAccessibleName(
      'Note, The other cafe'
    );
    expect((await row())?.description).toBe('The other cafe');

    // WHEN: the page reloads
    await page.reload();

    // THEN: it is still the anniversary's page
    await expect(page).toHaveURL(new RegExp(`/settings/dates/anniversary/${id}$`));
    await expect(page.getByRole('heading', { level: 1, name: `${label} renamed` })).toBeVisible();

    // WHEN: Delete anniversary is tapped, then Cancel
    await page.getByTestId('settings-anniversary-delete').click();
    await expect(page.getByRole('dialog', { name: 'Delete this anniversary?' })).toBeVisible();
    await page.getByTestId('settings-anniversary-delete-confirmation-cancel').click();

    // THEN: the dialog closes and the anniversary is untouched
    await expect(page.getByTestId('settings-anniversary-delete-confirmation')).toHaveCount(0);
    await expect(page.getByTestId('settings-anniversary-page')).toBeVisible();
    expect(await row()).toBeDefined();

    // WHEN: Delete anniversary is tapped and Delete confirmed
    await page.getByTestId('settings-anniversary-delete').click();
    await page.getByTestId('settings-anniversary-delete-confirmation-confirm').click();

    // THEN: the app is on the Dates list, the anniversary is gone from it and from the server
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(page.getByTestId(`settings-dates-anniversary-${id}`)).toHaveCount(0);
    expect(await row()).toBeUndefined();
  });
});
