/**
 * E2E: the streak's +1 plays once for each new day on each device (epic
 * streak-and-partner-page, story 7.5; R4).
 *
 * Every test runs on this worker's own pooled pair, unstubbed, with one done
 * day seeded (`seedPairDays`, after `clearPairDays`, cleared again at
 * teardown), so the day both pick today takes the held total from 1 to 2. Both
 * partners open Daily first and wait for the device-state copy
 * `daily-celebrated` to be seeded at 1: a first read plays nothing, and a
 * device that had no copy when the day finished would seed it silently. Every
 * pick goes through the UI. Nothing here links, unlinks or resets an account.
 *
 * 1. The second picker sees the +1 screen at once, held 2, with the button on
 *    the reveal; closing it and reloading shows nothing.
 * 2. The first picker, away from Daily when the day finishes, sees it once on
 *    returning; leaving and coming back, then a reload, show nothing.
 * 3. The first picker, staying on Daily, sees it with no reload when the
 *    partner's pick arrives.
 * 4. The first picker, on the Partner page when the day finishes, sees the new
 *    held there with no +1; opening Daily then plays it.
 *
 * The day's writer is asked to write tomorrow's question after their pick; the
 * sheet waits behind the +1 screen and covers the dock, so the writer says
 * "No thanks" where a step needs the dock.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test as base, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayWriter,
  seedPairDays,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { isoDateDaysFromNow } from '../../support/helpers/events';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { navigateTo } from '../../support/helpers/navigation';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { dismissStreakUp } from '../../support/helpers/streak-up';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const CELEBRATED_KIND = 'daily-celebrated';

interface PairSetup {
  /** The worker's page. */
  own: Page;
  /** The partner's page, in a second context. */
  partner: Page;
  ownIsWriter: boolean;
  ownName: string;
  partnerName: string;
}

/** `page` opens Daily and the device has seeded `daily-celebrated` at `held`. */
async function openDailySeeded(page: Page, held: number, method: 'goto' | 'reload' = 'goto') {
  const read = observeOn({
    page,
    method: 'POST',
    url: DAILY_DAY_READ,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  if (method === 'goto') await page.goto('/daily');
  else await page.reload();
  expect((await read).status).toBe(200);
  await expect(page.getByTestId('daily-streak-held')).toHaveText(String(held));
  await recurseUntil(
    () => savedLocalCopy<{ held: number }>(page, CELEBRATED_KIND),
    (saved) => {
      expect(saved).toMatchObject({ held });
    }
  );
}

/** `page` picks an option and the server confirms. */
async function pick(page: Page, option: 'this' | 'that'): Promise<void> {
  await page.getByTestId(`daily-option-${option}`).click();
  const sent = observeOn({
    page,
    method: 'POST',
    url: DAILY_PICK_SEND,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await page.getByTestId('daily-send-pick').click();
  expect((await sent).status).toBe(200);
}

const test = base.extend<{ setup: PairSetup }>({
  setup: async (
    {
      page,
      browser,
      baseURL,
      supabaseAdmin,
      authOptions,
      partnerUserIdentifier,
      partnerAuthToken,
      cleanup,
    },
    use
  ) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await seedPairDays(supabaseAdmin, pair, [{ daysAgo: 1, picks: 'both' }]);

    const names: Record<string, string> = {};
    for (const id of [pair.userId, pair.partnerId]) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('display_name')
        .eq('id', id)
        .single();
      expect(error).toBeNull();
      names[id] = data?.display_name?.trim() ?? '';
      expect(names[id], "premise: this worker's pool pair have names").toBeTruthy();
    }

    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be sending.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    await dismissWelcomeSplash(page);
    await dismissWelcomeSplash(partnerPage);

    await openDailySeeded(page, 1);
    await openDailySeeded(partnerPage, 1);
    // Today's day exists now, so its writer is known.
    const writer = await readPairDayWriter(
      supabaseAdmin,
      pair,
      isoDateDaysFromNow(0, new Date())
    );

    await use({
      own: page,
      partner: partnerPage,
      ownIsWriter: writer === pair.userId,
      ownName: names[pair.userId],
      partnerName: names[pair.partnerId],
    });
  },
});

/** This mount's claim of `held` has answered (the overlay, if any, is in the same commit). */
async function expectClaimed(page: Page, held: number): Promise<void> {
  await expect(page.getByTestId('daily-question-view')).toHaveAttribute(
    'data-streak-claimed',
    String(held)
  );
}

/** The +1 screen with the new held, the badge, the message and the button's label. */
async function expectStreakUp(
  page: Page,
  { held, otherName, button }: { held: number; otherName: string; button: string }
): Promise<void> {
  await expect(page.getByTestId('daily-streak-up')).toBeVisible();
  await expect(page.getByTestId('daily-streak-up-held')).toHaveText(String(held));
  await expect(page.getByTestId('daily-streak-up-plus')).toHaveText('+1');
  await expect(page.getByTestId('daily-streak-up-message')).toContainText(
    `You and ${otherName} both answered.`
  );
  await expect(page.getByTestId('daily-streak-up-message')).toContainText('2 days in a row!');
  await expect(page.getByTestId('daily-streak-up-continue')).toHaveText(button);
}

test.describe('Daily: the streak goes up by one', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P0] the second picker sees it at once, and a reload never replays it', async ({
    setup: { own, partner, ownIsWriter, ownName },
  }) => {
    await log.step('The worker picks and waits; the partner picks second');
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();
    await pick(partner, 'that');

    await log.step('The partner sees the +1 screen at once, held 2, button on the reveal');
    await expectStreakUp(partner, {
      held: 2,
      otherName: ownName,
      button: `See ${ownName}'s pick`,
    });

    await log.step('Closing it reveals the card; a reload shows no +1 screen');
    await partner.getByTestId('daily-streak-up-continue').click();
    await expect(partner.getByTestId('daily-streak-up')).toHaveCount(0);
    await expect(partner.getByTestId('daily-reveal')).toBeVisible();
    if (!ownIsWriter) await partner.getByTestId('daily-write-decline').click();
    await openDailySeeded(partner, 2, 'reload');
    await expectClaimed(partner, 2);
    await expect(partner.getByTestId('daily-streak-up')).toHaveCount(0);
  });

  test('[P0] the first picker, away from Daily, sees it once on coming back', async ({
    setup: { own, partner, ownIsWriter, partnerName },
  }) => {
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();

    await log.step('The worker leaves Daily; the partner finishes the day');
    await navigateTo(own, 'home');
    await expect(own.getByTestId('daily-question-view')).toHaveCount(0);
    await pick(partner, 'that');

    await log.step('The worker comes back: the +1 screen plays, with the reveal behind it');
    await navigateTo(own, 'daily');
    await expectStreakUp(own, {
      held: 2,
      otherName: partnerName,
      button: `See ${partnerName}'s pick`,
    });
    await dismissStreakUp(own);
    await expect(own.getByTestId('daily-reveal')).toBeVisible();

    await log.step('Leaving and coming back shows nothing; neither does a reload');
    await navigateTo(own, 'home');
    await navigateTo(own, 'daily');
    await expect(own.getByTestId('daily-streak-held')).toHaveText('2');
    await expectClaimed(own, 2);
    await expect(own.getByTestId('daily-streak-up')).toHaveCount(0);
    await openDailySeeded(own, 2, 'reload');
    await expectClaimed(own, 2);
    await expect(own.getByTestId('daily-streak-up')).toHaveCount(0);
  });

  test('[P0] the first picker, staying on Daily, sees it when the partner pick arrives', async ({
    setup: { own, partner, ownIsWriter, partnerName },
  }) => {
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();
    await expect(own.getByTestId('daily-streak-up')).toHaveCount(0);

    await log.step('The partner picks; the worker sees the +1 screen with no reload');
    await pick(partner, 'that');
    await expectStreakUp(own, {
      held: 2,
      otherName: partnerName,
      button: `See ${partnerName}'s pick`,
    });
    await dismissStreakUp(own);
    await expect(own.getByTestId('daily-reveal')).toBeVisible();
    await expect(own.getByTestId('daily-streak-held')).toHaveText('2');
  });

  test('[P0] the Partner page shows the new held without the +1, and Daily then plays it', async ({
    setup: { own, partner, ownIsWriter, partnerName },
    interceptNetworkCall,
  }) => {
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();

    await log.step('The worker opens Partner; the partner finishes the day');
    const firstRead = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await navigateTo(own, 'partner');
    expect((await firstRead).status).toBe(200);
    await pick(partner, 'that');

    await log.step("Partner's card shows the new held, and no +1 screen plays");
    await expect(own.getByTestId('partner-streak-held')).toHaveText('2');
    await expect(own.getByTestId('daily-streak-up')).toHaveCount(0);
    // The Partner page never writes the device-state copy.
    expect(await savedLocalCopy<{ held: number }>(own, CELEBRATED_KIND)).toMatchObject({ held: 1 });

    await log.step('Opening Daily plays it');
    await navigateTo(own, 'daily');
    await expectStreakUp(own, {
      held: 2,
      otherName: partnerName,
      button: `See ${partnerName}'s pick`,
    });
    await dismissStreakUp(own);
    await recurseUntil(
      () => savedLocalCopy<{ held: number }>(own, CELEBRATED_KIND),
      (saved) => {
        expect(saved).toMatchObject({ held: 2 });
      }
    );
  });
});
