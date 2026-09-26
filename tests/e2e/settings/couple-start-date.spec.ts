/**
 * E2E: the couple's shared start date is one value both partners see
 * (spec-unified-data-storage story 3, CAP-9).
 *
 * The partner saves a date and time in Settings through the real UI; this
 * worker's page then shows the same date after a reload — on Home's "Together
 * for" card and in its own Settings row.
 *
 * Identities are this worker's own pooled pair, linked once by global setup.
 * Nothing here links, unlinks or resets an account; teardown deletes only this
 * pair's couple_settings row.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
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

/** The instant as the browser's local date and time input values. */
async function localInputsOf(page: Page, iso: string): Promise<{ date: string; time: string }> {
  return page.evaluate((value) => {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
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
      expect.soft(error).toBeNull();
    };
    await clearPair();

    let partnerContext: BrowserContext | undefined;
    try {
      await log.step('With no row yet, Home shows the placeholder');
      const homeRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.goto('/');
      expect((await homeRead).status).toBe(200);
      await expect(page.getByTestId('time-together')).toContainText(
        'Set your start date in Settings'
      );

      await log.step('The partner saves a date and time in Settings');
      partnerContext = await browser.newContext({
        storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
        baseURL,
      });
      const partnerPage = await partnerContext.newPage();
      const partnerRead = observeOn({
        page: partnerPage,
        method: 'GET',
        url: COUPLE_SETTINGS_READ,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await partnerPage.goto('/settings');
      expect((await partnerRead).status).toBe(200);
      await expect(partnerPage.getByTestId('settings-together-since-value')).toHaveText(
        'Not set yet'
      );

      // Twelve days and an hour ago, to the minute.
      const target = new Date(Date.now() - 12 * DAY_MS - 60 * 60 * 1000);
      target.setSeconds(0, 0);
      const targetIso = target.toISOString();
      const inputs = await localInputsOf(partnerPage, targetIso);
      await partnerPage.getByTestId('settings-together-since-date').fill(inputs.date);
      await partnerPage.getByTestId('settings-together-since-time').fill(inputs.time);

      const saved = observeOn({
        page: partnerPage,
        method: 'POST',
        url: COUPLE_SETTINGS_SAVE,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await partnerPage.getByTestId('settings-together-since-save').click();
      expect((await saved).status).toBe(201);
      await recurseUntil(() => storeStart(partnerPage), (v) => { expect(v).toBe(targetIso); });
      await expect(partnerPage.getByTestId('settings-together-since-error')).toHaveCount(0);

      await log.step('This partner sees the same date after a reload');
      const reloadRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.reload();
      expect((await reloadRead).status).toBe(200);
      await recurseUntil(() => storeStart(page), (v) => { expect(v).toBe(targetIso); });
      const card = page.getByTestId('time-together');
      await expect(card).toContainText('12 days');
      await expect(card).not.toContainText('Set your start date in Settings');

      // The saved copy already holds targetIso, so the inputs are read only
      // after this visit's own couple read has answered.
      const settingsRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.goto('/settings');
      expect((await settingsRead).status).toBe(200);
      const own = await localInputsOf(page, targetIso);
      await expect(page.getByTestId('settings-together-since-date')).toHaveValue(own.date);
      await expect(page.getByTestId('settings-together-since-time')).toHaveValue(own.time);
    } finally {
      await partnerContext?.close().catch(() => {});
      await clearPair();
    }
  });
});
