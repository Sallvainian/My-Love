/**
 * E2E: the couple's shared start date is one value both partners see
 * (spec-unified-data-storage story 3, CAP-9).
 *
 * The partner saves a date and time on the Together since page through the
 * real UI (Dates, Together since, Date, Save); this worker's page then shows
 * the same date after a reload — on Home's "Together for" card and in its own
 * Together since Date field.
 *
 * Identities are this worker's own pooled pair, linked once by global setup.
 * Nothing here links, unlinks or resets an account; teardown deletes only this
 * pair's couple_settings row.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { closeContext } from '../../support/fixtures/cleanup';
import { clockAnchor, resolveOwnPair } from '../../support/helpers/events';
import {
  COUPLE_SETTINGS_READ,
  COUPLE_SETTINGS_SAVE,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

const DAY_MS = 24 * 60 * 60 * 1000;

async function storeStart(page: Page): Promise<string | null | undefined> {
  return page.evaluate(() => {
    const couple = window.__APP_STORE__?.getState().coupleSettings;
    return couple?.status === 'linked' ? couple.relationshipStart : undefined;
  });
}

/** The instant as the browser's local `YYYY-MM-DDTHH:MM`, which the datetime-local field shows. */
async function localDateTimeOf(page: Page, iso: string): Promise<string> {
  return page.evaluate((value) => {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, iso);
}

test.describe('Couple start date shared by both partners', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P1] a date saved by one partner shows on the other after reload', async ({
    page,
    browser,
    baseURL,
    supabaseAdmin,
    authOptions,
    partnerUserIdentifier,
    partnerAuthToken,
    interceptNetworkCall,
    cleanup,
  }) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const pair = userId < partnerId
      ? { user_a: userId, user_b: partnerId }
      : { user_a: partnerId, user_b: userId };
    const clearPair = async () => {
      const { error } = await supabaseAdmin
        .from('couple_settings')
        .delete()
        .eq('user_a', pair.user_a)
        .eq('user_b', pair.user_b);
      expect(error).toBeNull();
    };
    await clearPair();
    cleanup.defer("delete the pair's couple settings", clearPair);

    // This page runs on a pinned clock and the date is built from it, so the
    // day count below holds whenever the run happens.
    const anchor = clockAnchor();
    await page.clock.install({ time: anchor });

    await log.step('With no row yet, Home shows the placeholder');
    const homeRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await page.goto('/');
    expect((await homeRead).status).toBe(200);
    await expect(page.getByTestId('time-together')).toContainText(
      'Set your start date in Settings'
    );

    await log.step('The partner saves a date and time in Settings');
    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be saving.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    const partnerRead = observeOn({
      page: partnerPage,
      method: 'GET',
      url: COUPLE_SETTINGS_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/settings/dates');
    expect((await partnerRead).status).toBe(200);
    // Not set yet: a loaded Not set opens the Date page directly.
    const sinceRow = partnerPage.getByTestId('settings-dates-together-since');
    await expect(sinceRow).toHaveAccessibleName('Together since, Not set');
    await sinceRow.click();
    await expect(partnerPage.getByRole('heading', { level: 1, name: 'Date' })).toBeVisible();

    // Twelve days and an hour before the pinned clock, to the minute.
    const target = new Date(anchor.getTime() - 12 * DAY_MS - 60 * 60 * 1000);
    target.setSeconds(0, 0);
    const targetIso = target.toISOString();
    await partnerPage
      .getByTestId('settings-together-since-field')
      .fill(await localDateTimeOf(partnerPage, targetIso));

    const saved = observeOn({
      page: partnerPage,
      method: 'POST',
      url: COUPLE_SETTINGS_SAVE,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('settings-field-save').click();
    expect((await saved).status).toBe(201);
    await recurseUntil(() => storeStart(partnerPage), (v) => { expect(v).toBe(targetIso); });
    // The page returned one level, to the Dates list, with no error left behind.
    await expect(partnerPage.getByRole('heading', { level: 1, name: 'Dates' })).toBeVisible();
    await expect(partnerPage.getByTestId('settings-field-error')).toHaveCount(0);
    await expect(sinceRow).not.toHaveAccessibleName('Together since, Not set');

    await log.step('This partner sees the same date after a reload');
    const reloadRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await page.reload();
    expect((await reloadRead).status).toBe(200);
    await recurseUntil(() => storeStart(page), (v) => { expect(v).toBe(targetIso); });
    const card = page.getByTestId('time-together');
    await expect(card).toContainText('12 days');
    await expect(card).not.toContainText('Set your start date in Settings');

    // The saved copy already holds targetIso, so the field is read only
    // after this visit's own couple read has answered.
    const settingsRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
    await page.goto('/settings/dates/together-since');
    expect((await settingsRead).status).toBe(200);
    await page.getByTestId('settings-date-row').click();
    await expect(page.getByTestId('settings-together-since-field')).toHaveValue(
      await localDateTimeOf(page, targetIso)
    );
  });
});
