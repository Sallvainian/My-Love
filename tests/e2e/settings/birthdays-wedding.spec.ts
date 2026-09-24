/**
 * E2E: birthdays and the wedding date are server-held and shared
 * (spec-unified-data-storage story 4, CAP-11).
 *
 * The partner saves their own birthday and the couple's wedding date in
 * Settings through the real UI; this worker's Home then shows the partner's
 * birthday card, labelled with the partner's display name, and the wedding
 * countdown after a reload. Clearing the wedding date brings back "Date TBD".
 *
 * Identities are this worker's own pooled pair, linked once by global setup.
 * Nothing here links, unlinks or resets an account; teardown resets only this
 * pair's own `birthday` columns and `wedding_date`.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { test, expect } from '../../support/merged-fixtures';
import type { TypedSupabaseClient } from '../../support/factories';
import { resolveOwnPair } from '../../support/helpers/events';

/**
 * A `YYYY-MM-DD` date `days` from today in the browser's local time, moved
 * `yearsBack` years into the past. Skips a 29 February, which rolls over.
 */
async function localDateIn(page: Page, days: number, yearsBack = 0): Promise<string> {
  return page.evaluate(
    ({ days, yearsBack }) => {
      const now = new Date();
      let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
      if (d.getMonth() === 1 && d.getDate() === 29) {
        d = new Date(d.getFullYear(), 2, 1);
      }
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear() - yearsBack}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    { days, yearsBack }
  );
}

async function resetPair(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<void> {
  const users = await supabaseAdmin
    .from('users')
    .update({ birthday: null })
    .in('id', [userId, partnerId]);
  expect.soft(users.error).toBeNull();
  const pair = userId < partnerId
    ? { user_a: userId, user_b: partnerId }
    : { user_a: partnerId, user_b: userId };
  const couple = await supabaseAdmin
    .from('couple_settings')
    .update({ wedding_date: null })
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b);
  expect.soft(couple.error).toBeNull();
}

test.describe('Birthdays and wedding date shared by both partners', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P1] a birthday and wedding date saved by the partner show on this Home after reload', async ({
    page,
    browser,
    baseURL,
    supabaseAdmin,
    authOptions,
    partnerUserIdentifier,
    partnerAuthToken,
  }) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await resetPair(supabaseAdmin, userId, partnerId);

    let partnerContext: BrowserContext | undefined;
    try {
      await log.step('With nothing set, the partner card says so and the wedding is TBD');
      await page.goto('/');
      await expect(page.getByTestId('birthday-countdown-partner')).toContainText('Not set yet');
      await expect(page.getByTestId('birthday-countdown-self')).toContainText(
        'Set it in Settings'
      );
      await expect(page.getByTestId('event-countdown-wedding')).toContainText('Date TBD');

      await log.step('The partner saves a birthday and a wedding date in Settings');
      partnerContext = await browser.newContext({
        storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
        baseURL,
      });
      const partnerPage = await partnerContext.newPage();
      await partnerPage.goto('/settings');
      await expect(partnerPage.getByTestId('settings-birthday-value')).toHaveText('Not set yet');
      await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');

      // Ten days from now, thirty years ago: "turns 30" in "10 days".
      const birthday = await localDateIn(partnerPage, 10, 30);
      await partnerPage.getByTestId('settings-birthday-date').fill(birthday);
      const birthdaySaved = partnerPage.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/users') && response.request().method() === 'PATCH'
      );
      await partnerPage.getByTestId('settings-birthday-save').click();
      expect((await birthdaySaved).ok()).toBe(true);
      await expect
        .poll(() => partnerPage.evaluate(() => window.__APP_STORE__?.getState().ownProfile?.birthday))
        .toBe(birthday);
      await expect(partnerPage.getByTestId('settings-birthday-error')).toHaveCount(0);

      const wedding = await localDateIn(partnerPage, 40);
      await partnerPage.getByTestId('settings-wedding-date').fill(wedding);
      const weddingSaved = partnerPage.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/couple_settings') &&
          response.request().method() === 'POST'
      );
      await partnerPage.getByTestId('settings-wedding-save').click();
      expect((await weddingSaved).ok()).toBe(true);
      await expect(partnerPage.getByTestId('settings-wedding-clear')).toBeVisible();
      await expect(partnerPage.getByTestId('settings-wedding-error')).toHaveCount(0);

      await log.step('This Home shows both after a reload');
      await page.reload();
      await expect
        .poll(() => page.evaluate(() => window.__APP_STORE__?.getState().partner?.birthday))
        .toBe(birthday);
      const partnerName = await page.evaluate(
        () => window.__APP_STORE__?.getState().partner?.displayName
      );
      const partnerCard = page.getByTestId('birthday-countdown-partner');
      await expect(partnerCard.locator('h3')).toHaveText(`${partnerName} turns 30`);
      await expect(partnerCard.locator('h3 + div')).toHaveText('10 days');
      await expect(page.getByTestId('event-countdown-wedding').locator('h3 + div')).toHaveText(
        '40 days'
      );

      await log.step('The partner clears the wedding date; this Home reads "Date TBD" again');
      const cleared = partnerPage.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/couple_settings') &&
          response.request().method() === 'POST'
      );
      await partnerPage.getByTestId('settings-wedding-clear').click();
      expect((await cleared).ok()).toBe(true);
      await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');

      await page.reload();
      await expect(page.getByTestId('event-countdown-wedding').locator('h3 + div')).toHaveText(
        'Date TBD'
      );
    } finally {
      await partnerContext?.close().catch(() => {});
      await resetPair(supabaseAdmin, userId, partnerId);
    }
  });
});
