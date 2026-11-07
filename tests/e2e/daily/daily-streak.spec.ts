/**
 * E2E: Daily shows the couple's streak, the week and a missed day (epic
 * streak-and-partner-page, story 7.4).
 *
 * Every test runs on this worker's own pooled pair, unstubbed: the server
 * counts, the page shows. The pair's past days are seeded with `seedPairDays`
 * (dated from the host's local date, which is the browser's zone) after
 * `clearPairDays`, and cleared again at teardown. Nothing here links, unlinks
 * or resets an account.
 *
 * 1. Two done days, then today: the grey chip holds 2 with "2 in a row" and
 *    the week strip; the worker's own pick shows "Your half is in..."; the
 *    partner's pick, sent from a second browser, turns the worker's Daily
 *    orange with no reload, and the Partner card agrees.
 * 2. Done, done, missed: the blue chip, the cold banner for one missed day
 *    ("Yesterday was"), and a blue Partner card.
 * 3. Done, missed, missed: the banner says "The last 2 days were".
 * 4. One done day and the partner's pick today: the worker picks offline
 *    (queued), the connection returns, the drain sends it, and the chip turns
 *    orange at 2 without a reload.
 *
 * Listeners and read trackers are attached before the navigation they observe.
 * The file keeps trace and video off for the offline test.
 */
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayWriter,
  seedPairDays,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { isoDateDaysFromNow } from '../../support/helpers/events';
import { goOffline } from '../../support/helpers/offline';
import { navigateTo } from '../../support/helpers/navigation';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

// Tracing corrupts when the context goes offline (see network-status.spec.ts);
// `use` cannot sit in a describe group, so the whole file runs without it.
test.use({ trace: 'off', video: 'off' });

type DayState = 'done' | 'missed' | 'open';

/** The seven dates of Daily's strip, oldest first, in the state the server gave. */
async function expectWeek(page: Page, states: DayState[]): Promise<void> {
  const days = page.getByTestId('daily-streak-day');
  await expect(days).toHaveCount(7);
  for (const [index, state] of states.entries()) {
    await expect(days.nth(index)).toHaveAttribute('data-state', state);
  }
  await expect(days.last()).toContainText('Today');
}

test.describe('Daily streak', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] seeded days show a grey chip, the own pick says it waits, and the partner pick turns it orange', async ({
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

    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await seedPairDays(supabaseAdmin, pair, [
      { daysAgo: 2, picks: 'both' },
      { daysAgo: 1, picks: 'both' },
    ]);

    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    await dismissWelcomeSplash(partnerPage);

    await log.step('The worker opens Daily: a grey chip at 2, two in a row, the strip');
    const ownDay = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/daily');
    expect((await ownDay).status).toBe(200);
    expect((await ownStreak).status).toBe(200);

    await expect(page.getByTestId('daily-header')).toContainText("Today's question");
    const chip = page.getByTestId('daily-streak-chip');
    await expect(chip).toHaveAttribute('data-state', 'grey');
    await expect(page.getByTestId('daily-streak-held')).toHaveText('2');
    await expect(page.getByTestId('daily-streak-run')).toHaveText('2 in a row');
    await expectWeek(page, ['open', 'open', 'open', 'open', 'done', 'done', 'open']);
    await expect(page.getByTestId('daily-streak-cold')).toHaveCount(0);
    await expect(page.getByTestId('daily-streak-waiting')).toHaveCount(0);

    await log.step('The partner opens Partner first: the card is grey at 2, as the server says');
    const partnerStreak = observeOn({
      page: partnerPage,
      method: 'POST',
      url: COUPLE_STREAK_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/partner');
    expect((await partnerStreak).status).toBe(200);
    await expect(partnerPage.getByTestId('partner-streak-card')).toHaveAttribute(
      'data-state',
      'grey'
    );
    await expect(partnerPage.getByTestId('partner-streak-held')).toHaveText('2');

    await log.step('The partner opens Daily too');
    const partnerDay = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerDay).status).toBe(200);

    // Today's day exists now, so its writer is known: they say "No thanks" to
    // the sheet that follows their pick.
    const writer = await readPairDayWriter(
      supabaseAdmin,
      pair,
      isoDateDaysFromNow(0, new Date())
    );
    // The waiting sentence names the partner by their profile name.
    const { data: partnerRow, error: partnerError } = await supabaseAdmin
      .from('users')
      .select('display_name')
      .eq('id', pair.partnerId)
      .single();
    expect(partnerError).toBeNull();
    const partnerName = partnerRow?.display_name?.trim();
    expect(partnerName, "premise: this worker's pool partner has a name").toBeTruthy();

    await log.step('The worker picks: the waiting sentence shows, the chip stays grey');
    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-streak-waiting')).toBeVisible();
    await expect(page.getByTestId('daily-streak-waiting')).toHaveText(
      `Your half is in. The streak lights up when ${partnerName} answers too.`
    );
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    await expect(chip).toHaveAttribute('data-state', 'grey');
    if (writer === pair.userId) await page.getByTestId('daily-write-decline').click();

    await log.step("The partner picks in the second browser: the worker's Daily turns orange");
    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);

    // No reload: the partner's `daily_pick` re-reads the day and the streak.
    await expect(chip).toHaveAttribute('data-state', 'orange');
    await expect(page.getByTestId('daily-streak-held')).toHaveText('3');
    await expect(page.getByTestId('daily-streak-run')).toHaveText('3 in a row');
    await expectWeek(page, ['open', 'open', 'open', 'open', 'done', 'done', 'done']);
    await expect(page.getByTestId('daily-reveal')).toBeVisible();
    await expect(page.getByTestId('daily-streak-waiting')).toHaveCount(0);

    await log.step('The Partner card shows the same orange');
    await navigateTo(page, 'partner');
    const card = page.getByTestId('partner-streak-card');
    await expect(card).toHaveAttribute('data-state', 'orange');
    await expect(page.getByTestId('partner-streak-held')).toHaveText('3');
  });

  test('[P0] a date missed yesterday shows the blue chip, the cold banner and a blue Partner card', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await seedPairDays(supabaseAdmin, pair, [
      { daysAgo: 3, picks: 'both' },
      { daysAgo: 2, picks: 'both' },
      { daysAgo: 1, picks: 'none' },
    ]);

    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/daily');
    expect((await ownStreak).status).toBe(200);

    const chip = page.getByTestId('daily-streak-chip');
    await expect(chip).toHaveAttribute('data-state', 'blue');
    await expect(page.getByTestId('daily-streak-held')).toHaveText('2');
    await expect(page.getByTestId('daily-streak-run')).toHaveText('0 in a row');
    const banner = page.getByTestId('daily-streak-cold');
    await expect(banner).toContainText('Your streak went cold');
    await expect(banner).toContainText(
      "Yesterday was missed, so it's frozen at 2. You keep the 2. Both answer today to light it back up."
    );
    await expectWeek(page, ['open', 'open', 'open', 'done', 'done', 'missed', 'open']);

    await navigateTo(page, 'partner');
    await expect(page.getByTestId('partner-streak-card')).toHaveAttribute('data-state', 'blue');
    await expect(page.getByTestId('partner-streak-held')).toHaveText('2');
  });

  test('[P1] several missed dates say how many days were missed', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await seedPairDays(supabaseAdmin, pair, [
      { daysAgo: 3, picks: 'both' },
      { daysAgo: 2, picks: 'user' },
      { daysAgo: 1, picks: 'partner' },
    ]);

    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/daily');
    expect((await ownStreak).status).toBe(200);

    await expect(page.getByTestId('daily-streak-chip')).toHaveAttribute('data-state', 'blue');
    await expect(page.getByTestId('daily-streak-held')).toHaveText('1');
    await expect(page.getByTestId('daily-streak-cold')).toContainText(
      "The last 2 days were missed, so it's frozen at 1. You keep the 1."
    );
    await expectWeek(page, ['open', 'open', 'open', 'done', 'missed', 'missed', 'open']);
  });

  test.describe('after a pick queued offline', () => {
    test("[P1] the drain's send lights the chip up without a reload", async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
      cleanup,
    }) => {
      const pair = await resolveWorkerPairIds(supabaseAdmin);
      await clearPairDays(supabaseAdmin, pair);
      cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
      await seedPairDays(supabaseAdmin, pair, [
        { daysAgo: 1, picks: 'both' },
        { daysAgo: 0, picks: 'partner' },
      ]);

      await log.step('The worker opens Daily: the partner has picked, the chip is grey at 1');
      const ownDay = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
      const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
      await page.goto('/daily');
      expect((await ownDay).status).toBe(200);
      expect((await ownStreak).status).toBe(200);
      const chip = page.getByTestId('daily-streak-chip');
      await expect(chip).toHaveAttribute('data-state', 'grey');
      await expect(page.getByTestId('daily-streak-held')).toHaveText('1');
      await expect(page.getByTestId('daily-partner-status')).toContainText('has picked');

      await log.step('Offline, the worker picks: queued, the chip is unchanged');
      await goOffline(page, true);
      await page.getByTestId('daily-option-this').click();
      await page.getByTestId('daily-send-pick').click();
      await expect(page.getByTestId('daily-pick-queued')).toBeVisible();
      await expect(chip).toHaveAttribute('data-state', 'grey');
      await expect(page.getByTestId('daily-streak-held')).toHaveText('1');

      await log.step("Back online, the drain sends the pick and the chip shows the server's 2");
      const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
      const rereadStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
      await goOffline(page, false);
      expect((await ownPick).status).toBe(200);
      expect((await rereadStreak).status).toBe(200);

      await expect(chip).toHaveAttribute('data-state', 'orange');
      await expect(page.getByTestId('daily-streak-held')).toHaveText('2');
      await expect(page.getByTestId('daily-streak-run')).toHaveText('2 in a row');
      await expect(page.getByTestId('daily-pick-queued')).toHaveCount(0);
    });
  });
});
