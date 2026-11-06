/**
 * E2E: Settings > Dates > adding a date
 *
 * A linked pool account taps `+` on the Dates list, chooses Anniversary in the
 * Kind chooser, fills the New anniversary form and taps Add: the app returns to
 * the Dates list with the new row under Anniversaries, the server holds the
 * row, and Home's countdown shows it. Cancel leaves a form without writing. A
 * reload on either form shows the Dates list. (The event form's own journeys are
 * `events-crud.spec.ts`.)
 *
 * Creates its own rows through the UI and deletes only those, by label, so the
 * pair's other rows are left alone. Bottom-dock form on a phone viewport, as
 * `dates-list.spec.ts` runs.
 */
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { test, expect } from '../../support/merged-fixtures';
import { closeContext } from '../../support/fixtures/cleanup';
import { ANNIVERSARIES_READ, SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';
import { WELCOME_SPLASH_KEY } from '../../support/helpers/welcome-splash';
import { dayMonth } from '../../support/helpers/dates-list-format';
import { localDateFromIso, resolveOwnPair } from '../../support/helpers/events';
import { fillNewEventForm, openNewDateForm } from '../../support/helpers/new-date-forms';
import { navigateTo } from '../../support/helpers/navigation';
import { openDatesList, openSettingsFromHome } from '../../support/helpers/settings-screen';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe('Settings > Dates > adding a date', () => {
  let createdLabels: string[] = [];
  let ownerId: string | null = null;

  test.beforeEach(async ({ page }) => {
    createdLabels = [];
    ownerId = null;
    await dismissWelcomeSplash(page);
    await page.setViewportSize(PHONE_VIEWPORT);
  });

  test.afterEach(async ({ supabaseAdmin }) => {
    if (!ownerId) return;
    // Only the rows this spec's forms made, by their unique labels.
    for (const [table, label] of [
      ['anniversaries', createdLabels[0]],
      ['events', createdLabels[1]],
    ] as const) {
      if (!label) continue;
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', ownerId).eq('label', label);
      if (error) throw new Error(`Failed to delete the ${table} row this spec made: ${error.message}`);
    }
  });

  test('[P1] should add an anniversary from the Dates list and show it on the list and on Home', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    browser,
    cleanup,
  }, testInfo) => {
    // GIVEN: the Dates list of a linked pool account
    const { userId } = await resolveOwnPair(supabaseAdmin);
    ownerId = userId;
    const label = `Form anniversary ${testInfo.workerIndex}-${Date.now()}`;
    createdLabels = [label];
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);

    // WHEN: + is tapped and Anniversary chosen
    await openNewDateForm(page, 'anniversary');

    // THEN: the form opens with Cancel in the bar and Add off
    await expect(page.getByTestId('settings-cancel')).toHaveText('Cancel');
    await expect(page.getByTestId('settings-form-add')).toBeDisabled();
    await expect(page.getByTestId('settings-new-anniversary-name-field')).toBeFocused();

    // WHEN: Name and Date are filled and Add is tapped
    await page.getByTestId('settings-new-anniversary-name-field').fill(label);
    await page.getByTestId('settings-new-anniversary-date-field').fill('2022-04-04');
    await page.getByTestId('settings-new-anniversary-note-field').fill('The cafe');
    await expect(page.getByTestId('settings-form-add')).toBeEnabled();
    const created = interceptNetworkCall({ method: 'POST', url: '**/rest/v1/anniversaries*' });
    await page.getByTestId('settings-form-add').click();
    expect((await created).status).toBe(201);

    // THEN: the app is back on the Dates list, not on the new anniversary's page,
    // with the row under Anniversaries and its date on the right
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByTestId('settings-anniversary-page')).toHaveCount(0);
    const row = page
      .getByTestId('settings-dates-anniversaries')
      .locator('[data-testid^="settings-dates-anniversary-"]')
      .filter({ hasText: label });
    await expect(row).toBeVisible();
    await expect(row).toContainText(dayMonth(localDateFromIso('2022-04-04')));

    // THEN: the server holds the row, the account's own
    const { data } = await supabaseAdmin
      .from('anniversaries')
      .select('user_id, label, event_date, description')
      .eq('label', label);
    expect(data).toEqual([
      { user_id: userId, label, event_date: '2022-04-04', description: 'The cafe' },
    ]);

    // THEN: Home's Upcoming list shows it beside the events, with no reload
    await navigateTo(page, 'home');
    await expect(
      page.locator('[data-testid^="anniversary-countdown-"]').filter({ hasText: label })
    ).toBeVisible();

    // THEN: the partner's Dates list shows it too (anniversaries are shared, as events are)
    const pair = getWorkerPairEmails();
    if (!pair) throw new Error('This test requires its worker-owned account pair');
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173';
    const partnerContext = await browser.newContext({
      baseURL,
      storageState: {
        cookies: [],
        origins: [
          {
            origin: new URL(baseURL).origin,
            localStorage: [{ name: WELCOME_SPLASH_KEY, value: String(Date.now()) }],
          },
        ],
      },
    });
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    await partnerPage.goto('/');
    await partnerPage.getByLabel('Email', { exact: true }).fill(pair.user2Email);
    await partnerPage.getByTestId('password-input').fill(TEST_USER_PASSWORD);
    await partnerPage.getByTestId('submit-button').click();
    await expect(partnerPage.getByTestId('app-container')).toBeVisible();
    // The partner's anniversaries read answers before the row is looked for.
    const partnerRead = observeOn({
      page: partnerPage,
      method: 'GET',
      url: ANNIVERSARIES_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/settings/dates');
    expect((await partnerRead).status).toBe(200);
    await expect(partnerPage.getByTestId('settings-dates-birthdays')).toBeVisible();
    await expect(
      partnerPage.locator('[data-testid^="settings-dates-anniversary-"]').filter({ hasText: label })
    ).toHaveCount(1);
  });

  test('[P1] should create nothing when Cancel is tapped on either form', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    // GIVEN: a filled New event form
    const { userId } = await resolveOwnPair(supabaseAdmin);
    ownerId = userId;
    const stamp = `${testInfo.workerIndex}-${Date.now()}`;
    const anniversaryLabel = `Form cancel anniversary ${stamp}`;
    const eventLabel = `Form cancel event ${stamp}`;
    createdLabels = [anniversaryLabel, eventLabel];
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);
    await openNewDateForm(page, 'event');
    await fillNewEventForm(page, { label: eventLabel, date: '2031-05-05', description: 'Never saved' });

    // WHEN: Cancel is tapped
    await page.getByTestId('settings-cancel').click();

    // THEN: the Dates list is back, with no row for it
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(page.getByText(eventLabel)).toHaveCount(0);

    // WHEN: the same on a filled New anniversary form
    await openNewDateForm(page, 'anniversary');
    await page.getByTestId('settings-new-anniversary-name-field').fill(anniversaryLabel);
    await page.getByTestId('settings-new-anniversary-date-field').fill('2031-05-05');
    await page.getByTestId('settings-cancel').click();

    // THEN: back on the Dates list again, with no row
    await expect(page).toHaveURL(/\/settings\/dates$/);
    await expect(page.getByText(anniversaryLabel)).toHaveCount(0);

    // THEN: the server holds neither
    const events = await supabaseAdmin.from('events').select('id').eq('label', eventLabel);
    const anniversaries = await supabaseAdmin
      .from('anniversaries')
      .select('id')
      .eq('label', anniversaryLabel);
    expect(events.data).toEqual([]);
    expect(anniversaries.data).toEqual([]);
  });

  test('[P1] should close the Kind chooser without navigating on Cancel', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: the Dates list
    await openSettingsFromHome(page, interceptNetworkCall);
    await openDatesList(page, interceptNetworkCall);

    // WHEN: + is tapped, then Cancel in the chooser
    await page.getByTestId('settings-dates-add').click();
    await expect(page.getByRole('dialog', { name: 'Add a date' })).toBeVisible();
    await page.getByTestId('settings-kind-chooser-cancel').click();

    // THEN: the chooser is gone and the page did not move
    await expect(page.getByTestId('settings-kind-chooser')).toHaveCount(0);
    await expect(page).toHaveURL(/\/settings\/dates$/);
  });

  for (const kind of ['event', 'anniversary'] as const) {
    test(`[P1] should show the Dates list when the New ${kind} form is reloaded`, async ({
      page,
      interceptNetworkCall,
    }) => {
      // GIVEN: a New form that is open
      await openSettingsFromHome(page, interceptNetworkCall);
      await openDatesList(page, interceptNetworkCall);
      await openNewDateForm(page, kind);

      // WHEN: the page is reloaded
      await page.reload();

      // THEN: the Dates list is shown, one level up
      await expect(page.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
      await expect(page).toHaveURL(/\/settings\/dates$/);
      await expect(page.getByTestId(`settings-new-${kind}-page`)).toHaveCount(0);
    });
  }
});
