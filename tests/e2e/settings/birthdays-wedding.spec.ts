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
import type { BrowserContext } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import type { TypedSupabaseClient } from '../../support/factories';
import {
  clockAnchorAvoidingLeapDay,
  isoBirthdayDaysFromNow,
  isoDateDaysFromNow,
  resolveOwnPair,
} from '../../support/helpers/events';
import {
  COUPLE_SETTINGS_READ,
  OWN_PROFILE_READ,
  PARTNER_RECORD_READ,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';

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
    interceptNetworkCall,
  }) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await resetPair(supabaseAdmin, userId, partnerId);

    // Both pages run on one pinned clock, and the dates are built from it, so
    // the day counts below hold even if the run crosses real midnight.
    const anchor = clockAnchorAvoidingLeapDay([10, 40]);

    let partnerContext: BrowserContext | undefined;
    try {
      await log.step('With nothing set, the partner card says so and the wedding is TBD');
      await page.clock.install({ time: anchor });
      const homeReads = [COUPLE_SETTINGS_READ, PARTNER_RECORD_READ, OWN_PROFILE_READ].map((url) =>
        interceptNetworkCall({ method: 'GET', url })
      );
      await page.goto('/');
      for (const { status } of await Promise.all(homeReads)) expect(status).toBe(200);
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
      await partnerContext.clock.install({ time: anchor });
      const partnerPage = await partnerContext.newPage();
      const partnerReads = [COUPLE_SETTINGS_READ, OWN_PROFILE_READ].map((url) =>
        observeOn({ page: partnerPage, method: 'GET', url, timeout: SECOND_CONTEXT_READ_TIMEOUT })
      );
      await partnerPage.goto('/settings');
      for (const { status } of await Promise.all(partnerReads)) expect(status).toBe(200);
      await expect(partnerPage.getByTestId('settings-birthday-value')).toHaveText('Not set yet');
      await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');

      // Ten days from now, thirty years ago: "turns 30" in "10 days".
      const birthday = isoBirthdayDaysFromNow(10, 30, anchor);
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

      const wedding = isoDateDaysFromNow(40, anchor);
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
      const reloadReads = [COUPLE_SETTINGS_READ, PARTNER_RECORD_READ].map((url) =>
        interceptNetworkCall({ method: 'GET', url })
      );
      await page.reload();
      for (const { status } of await Promise.all(reloadReads)) expect(status).toBe(200);
      await expect
        .poll(() => page.evaluate(() => window.__APP_STORE__?.getState().partner?.birthday))
        .toBe(birthday);
      const partnerName = await page.evaluate(
        () => window.__APP_STORE__?.getState().partner?.displayName
      );
      const partnerCard = page.getByTestId('birthday-countdown-partner');
      await expect(partnerCard.locator('h3')).toHaveText(`${partnerName} turns 30`);
      // Whole days left plus a live clock to the day's local midnight, so ten
      // calendar days out reads "9 days" and the rest as hours.
      await expect(partnerCard.locator('h3 + div')).toHaveText('9 days');
      const weddingCard = page.getByTestId('event-countdown-wedding');
      await expect(weddingCard.locator('h3 + div')).toHaveText('39 days');

      await log.step('Each card runs a live clock that fits the card at phone width');
      await page.setViewportSize({ width: 390, height: 844 });
      const partnerClock = partnerCard.locator('h3 ~ span');
      await expect(partnerClock).toHaveText(/^\d{2}h \d{2}m \d{2}s$/);
      const firstReading = await partnerClock.textContent();
      await expect.poll(() => partnerClock.textContent()).not.toBe(firstReading);

      const box = async (locator: typeof partnerCard) => {
        const b = await locator.boundingBox();
        if (!b) throw new Error('[birthdays-wedding.spec] expected a visible box');
        return b;
      };
      // Half-width card: the clock takes its own line under the day count and
      // stays inside the card.
      const halfCard = await box(partnerCard);
      const halfValue = await box(partnerCard.locator('h3 + div'));
      const halfClock = await box(partnerClock);
      expect(halfClock.y).toBeGreaterThanOrEqual(halfValue.y + halfValue.height - 1);
      expect(halfClock.x + halfClock.width).toBeLessThanOrEqual(halfCard.x + halfCard.width);
      // Full-width card: the clock sits to the right of the day count, on its row.
      const fullValue = await box(weddingCard.locator('h3 + div'));
      const fullClock = await box(weddingCard.locator('h3 ~ span'));
      expect(fullClock.x).toBeGreaterThan(fullValue.x + fullValue.width);
      expect(fullClock.y).toBeLessThan(fullValue.y + fullValue.height);

      await log.step('The partner clears the wedding date; this Home reads "Date TBD" again');
      const cleared = partnerPage.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/couple_settings') &&
          response.request().method() === 'POST'
      );
      await partnerPage.getByTestId('settings-wedding-clear').click();
      expect((await cleared).ok()).toBe(true);
      await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');

      // The saved copy still holds the wedding date, so the card reads '39 days'
      // until this reload's own couple read has answered.
      const clearedRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.reload();
      expect((await clearedRead).status).toBe(200);
      await expect(page.getByTestId('event-countdown-wedding').locator('h3 + div')).toHaveText(
        'Date TBD'
      );
    } finally {
      await partnerContext?.close().catch(() => {});
      await resetPair(supabaseAdmin, userId, partnerId);
    }
  });
});
