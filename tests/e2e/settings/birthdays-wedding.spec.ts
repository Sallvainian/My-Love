/**
 * E2E: birthdays and the wedding date are server-held and shared
 * (spec-unified-data-storage story 4, CAP-11).
 *
 * The partner saves their own birthday and the couple's wedding date in
 * Settings through the real UI; this worker's Home then shows the partner's
 * birthday card, labelled with the partner's display name, and the wedding
 * countdown after a reload. Clearing the wedding date brings back "Date TBD".
 * The live-clock layout check seeds both dates through the service client
 * instead, since it is about the cards and not the save.
 *
 * Identities are this worker's own pooled pair, linked once by global setup.
 * Nothing here links, unlinks or resets an account; teardown resets only this
 * pair's own `birthday` columns and `wedding_date`.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import type { AuthOptions } from '@seontechnologies/playwright-utils/auth-session';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
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
  COUPLE_SETTINGS_SAVE,
  OWN_PROFILE_READ,
  PARTNER_RECORD_READ,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';

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

/** Whether the pair's couple_settings row exists: `resetPair` keeps one it finds. */
async function pairRowExists(
  supabaseAdmin: TypedSupabaseClient,
  userId: string,
  partnerId: string
): Promise<boolean> {
  const [user_a, user_b] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
  const { data, error } = await supabaseAdmin
    .from('couple_settings')
    .select('user_a')
    .eq('user_a', user_a)
    .eq('user_b', user_b);
  expect(error).toBeNull();
  return (data ?? []).length > 0;
}

/**
 * Open this worker's Home on the pinned clock, once the couple settings, the
 * partner record and the own profile have all been read.
 */
async function openThisHome(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  anchor: Date
): Promise<void> {
  await page.clock.install({ time: anchor });
  const homeReads = [COUPLE_SETTINGS_READ, PARTNER_RECORD_READ, OWN_PROFILE_READ].map((url) =>
    interceptNetworkCall({ method: 'GET', url })
  );
  await page.goto('/');
  for (const { status } of await Promise.all(homeReads)) expect(status).toBe(200);
}

/**
 * Open the partner's Settings in a second context on the same pinned clock,
 * with neither date set yet. The caller closes the returned context.
 */
async function openPartnerSettings(
  browser: Browser,
  baseURL: string | undefined,
  authOptions: AuthOptions,
  partnerUserIdentifier: string,
  anchor: Date
) {
  const context = await browser.newContext({
    storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
    baseURL,
  });
  try {
    await context.clock.install({ time: anchor });
    const partnerPage = await context.newPage();
    const partnerReads = [COUPLE_SETTINGS_READ, OWN_PROFILE_READ].map((url) =>
      observeOn({ page: partnerPage, method: 'GET', url, timeout: SECOND_CONTEXT_READ_TIMEOUT })
    );
    await partnerPage.goto('/settings');
    for (const { status } of await Promise.all(partnerReads)) expect(status).toBe(200);
    await expect(partnerPage.getByTestId('settings-birthday-value')).toHaveText('Not set yet');
    await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');
    return { context, page: partnerPage };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

test.describe('Birthdays and wedding date shared by both partners', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P1] a birthday the partner saves in Settings shows on this Home after reload', async ({
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
      await log.step('With nothing set, the partner card says so');
      await openThisHome(page, interceptNetworkCall, anchor);
      await expect(page.getByTestId('birthday-countdown-partner')).toContainText('Not set yet');
      await expect(page.getByTestId('birthday-countdown-self')).toContainText(
        'Set it in Settings'
      );

      await log.step('The partner saves a birthday in Settings');
      const partner = await openPartnerSettings(
        browser,
        baseURL,
        authOptions,
        partnerUserIdentifier,
        anchor
      );
      partnerContext = partner.context;
      const partnerPage = partner.page;

      // Ten days from now, thirty years ago: "turns 30" in "10 days".
      const birthday = isoBirthdayDaysFromNow(10, 30, anchor);
      await partnerPage.getByTestId('settings-birthday-date').fill(birthday);
      const birthdaySaved = observeOn({
        page: partnerPage,
        method: 'PATCH',
        url: '**/rest/v1/users?*',
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await partnerPage.getByTestId('settings-birthday-save').click();
      expect((await birthdaySaved).status).toBe(200);
      await recurseUntil(
        () => partnerPage.evaluate(() => window.__APP_STORE__?.getState().ownProfile?.birthday),
        (v) => {
          expect(v).toBe(birthday);
        }
      );
      await expect(partnerPage.getByTestId('settings-birthday-error')).toHaveCount(0);

      await log.step('This Home shows it after a reload');
      const reloadReads = [COUPLE_SETTINGS_READ, PARTNER_RECORD_READ].map((url) =>
        interceptNetworkCall({ method: 'GET', url })
      );
      await page.reload();
      for (const { status } of await Promise.all(reloadReads)) expect(status).toBe(200);
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__?.getState().partner?.birthday),
        (v) => {
          expect(v).toBe(birthday);
        }
      );
      const partnerName = await page.evaluate(
        () => window.__APP_STORE__?.getState().partner?.displayName
      );
      const partnerCard = page.getByTestId('birthday-countdown-partner');
      await expect(partnerCard.locator('h3')).toHaveText(`${partnerName} turns 30`);
      // Whole days left plus a live clock to the day's local midnight, so ten
      // calendar days out reads "9 days" and the rest as hours.
      await expect(partnerCard.getByTestId('countdown-value')).toHaveText('9 days');
    } finally {
      await partnerContext?.close().catch(() => {});
      await resetPair(supabaseAdmin, userId, partnerId);
    }
  });

  test('[P1] a wedding date the partner saves shows on this Home, and clearing it brings back Date TBD', async ({
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
      await log.step('With nothing set, the wedding is TBD');
      await openThisHome(page, interceptNetworkCall, anchor);
      await expect(page.getByTestId('event-countdown-wedding')).toContainText('Date TBD');

      await log.step('The partner saves a wedding date in Settings');
      const partner = await openPartnerSettings(
        browser,
        baseURL,
        authOptions,
        partnerUserIdentifier,
        anchor
      );
      partnerContext = partner.context;
      const partnerPage = partner.page;

      const wedding = isoDateDaysFromNow(40, anchor);
      await partnerPage.getByTestId('settings-wedding-date').fill(wedding);
      // The upsert answers 201 when it creates the pair's row, 200 when it updates it.
      const weddingStatus = (await pairRowExists(supabaseAdmin, userId, partnerId)) ? 200 : 201;
      const weddingSaved = observeOn({
        page: partnerPage,
        method: 'POST',
        url: COUPLE_SETTINGS_SAVE,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await partnerPage.getByTestId('settings-wedding-save').click();
      expect((await weddingSaved).status).toBe(weddingStatus);
      await expect(partnerPage.getByTestId('settings-wedding-clear')).toBeVisible();
      await expect(partnerPage.getByTestId('settings-wedding-error')).toHaveCount(0);

      await log.step('This Home shows it after a reload');
      const reloadReads = [COUPLE_SETTINGS_READ, PARTNER_RECORD_READ].map((url) =>
        interceptNetworkCall({ method: 'GET', url })
      );
      await page.reload();
      for (const { status } of await Promise.all(reloadReads)) expect(status).toBe(200);
      const weddingCard = page.getByTestId('event-countdown-wedding');
      await expect(weddingCard.getByTestId('countdown-value')).toHaveText('39 days');

      await log.step('The partner clears the wedding date; this Home reads "Date TBD" again');
      const cleared = observeOn({
        page: partnerPage,
        method: 'POST',
        url: COUPLE_SETTINGS_SAVE,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await partnerPage.getByTestId('settings-wedding-clear').click();
      expect((await cleared).status).toBe(200);
      await expect(partnerPage.getByTestId('settings-wedding-value')).toHaveText('Not set yet');

      // The saved copy still holds the wedding date, so the card reads '39 days'
      // until this reload's own couple read has answered.
      const clearedRead = interceptNetworkCall({ method: 'GET', url: COUPLE_SETTINGS_READ });
      await page.reload();
      expect((await clearedRead).status).toBe(200);
      await expect(
        page.getByTestId('event-countdown-wedding').getByTestId('countdown-value')
      ).toHaveText('Date TBD');
    } finally {
      await partnerContext?.close().catch(() => {});
      await resetPair(supabaseAdmin, userId, partnerId);
    }
  });

  test('[P1] each countdown card runs a live clock that fits the card at phone width', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    await resetPair(supabaseAdmin, userId, partnerId);

    // The page runs on a pinned clock, and the dates are built from it, so the
    // day counts below hold even if the run crosses real midnight.
    const anchor = clockAnchorAvoidingLeapDay([10, 40]);

    try {
      await log.step('Both dates are seeded: the partner birthday and the wedding');
      const birthday = isoBirthdayDaysFromNow(10, 30, anchor);
      const seededBirthday = await supabaseAdmin
        .from('users')
        .update({ birthday })
        .eq('id', partnerId);
      expect(seededBirthday.error).toBeNull();
      const [user_a, user_b] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
      const seededWedding = await supabaseAdmin
        .from('couple_settings')
        .upsert(
          { user_a, user_b, wedding_date: isoDateDaysFromNow(40, anchor) },
          { onConflict: 'user_a,user_b' }
        );
      expect(seededWedding.error).toBeNull();

      await openThisHome(page, interceptNetworkCall, anchor);
      await recurseUntil(
        () => page.evaluate(() => window.__APP_STORE__?.getState().partner?.birthday),
        (v) => {
          expect(v).toBe(birthday);
        }
      );
      const partnerCard = page.getByTestId('birthday-countdown-partner');
      const weddingCard = page.getByTestId('event-countdown-wedding');
      // Premise: both cards count down to a set date, so both carry a clock.
      await expect(partnerCard.getByTestId('countdown-value')).toHaveText('9 days');
      await expect(weddingCard.getByTestId('countdown-value')).toHaveText('39 days');

      await log.step('Each card runs a live clock that fits the card at phone width');
      await page.setViewportSize({ width: 390, height: 844 });
      const partnerClock = partnerCard.getByTestId('countdown-clock');
      await expect(partnerClock).toHaveText(/^\d{2}h \d{2}m \d{2}s$/);
      const firstReading = await partnerClock.textContent();
      await recurseUntil(
        () => partnerClock.textContent(),
        (v) => {
          expect(v).not.toBe(firstReading);
        }
      );

      const box = async (locator: typeof partnerCard) => {
        const b = await locator.boundingBox();
        if (!b) throw new Error('[birthdays-wedding.spec] expected a visible box');
        return b;
      };
      // Half-width card: the clock takes its own line under the day count and
      // stays inside the card.
      const halfCard = await box(partnerCard);
      const halfValue = await box(partnerCard.getByTestId('countdown-value'));
      const halfClock = await box(partnerClock);
      expect(halfClock.y).toBeGreaterThanOrEqual(halfValue.y + halfValue.height - 1);
      expect(halfClock.x + halfClock.width).toBeLessThanOrEqual(halfCard.x + halfCard.width);
      // Full-width card: the clock sits to the right of the day count, on its row.
      const fullValue = await box(weddingCard.getByTestId('countdown-value'));
      const fullClock = await box(weddingCard.getByTestId('countdown-clock'));
      expect(fullClock.x).toBeGreaterThan(fullValue.x + fullValue.width);
      expect(fullClock.y).toBeLessThan(fullValue.y + fullValue.height);
    } finally {
      await resetPair(supabaseAdmin, userId, partnerId);
    }
  });
});
