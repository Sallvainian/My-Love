/**
 * E2E: every 25 days the milestone screen follows the +1 (epic
 * streak-and-partner-page, story 7.6; R5).
 *
 * Every test runs on this worker's own pooled pair, unstubbed, with 24 done
 * days seeded (`seedPairDays` days 1 to 24, `both`, after `clearPairDays`,
 * cleared again at teardown), so the day both pick today takes the held total
 * from 24 to 25, the first milestone. Both partners open Daily first and wait
 * for the device-state copy `daily-celebrated` to be seeded at
 * `{ held: 24, milestones: 0 }`: a first read plays nothing. Every pick goes
 * through the UI. Nothing here links, unlinks or resets an account.
 *
 * 1. The second picker sees the +1 screen (held 25), its button opens the
 *    milestone screen (25 in colour, 50, 75 and 100 grey); Continue reveals
 *    the card; a reload shows neither and the copy holds `{ 25, 1 }`.
 * 2. The first picker, away from Daily when the day finishes, sees the +1 then
 *    the milestone on returning, and closes it with Close.
 *
 * The day's writer is asked to write tomorrow's question after their pick; the
 * sheet waits behind both screens, so the writer says "No thanks" where a step
 * needs the page.
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

/** `page` opens Daily and the device has seeded `daily-celebrated` at `held` and `milestones`. */
async function openDailySeeded(
  page: Page,
  held: number,
  milestones: number,
  method: 'goto' | 'reload' = 'goto'
) {
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
    () => savedLocalCopy<{ held: number; milestones: number }>(page, CELEBRATED_KIND),
    (saved) => {
      expect(saved).toMatchObject({ held, milestones });
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
    await seedPairDays(
      supabaseAdmin,
      pair,
      Array.from({ length: 24 }, (_, index) => ({ daysAgo: index + 1, picks: 'both' as const }))
    );

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

    await openDailySeeded(page, 24, 0);
    await openDailySeeded(partnerPage, 24, 0);
    // Today's day exists now, so its writer is known.
    const writer = await readPairDayWriter(supabaseAdmin, pair, isoDateDaysFromNow(0, new Date()));

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

/** The +1 screen with the new held 25, the message and the button's label. */
async function expectStreakUp(
  page: Page,
  { otherName, button }: { otherName: string; button: string }
): Promise<void> {
  await expect(page.getByTestId('daily-streak-up')).toBeVisible();
  await expect(page.getByTestId('daily-streak-up-held')).toHaveText('25');
  await expect(page.getByTestId('daily-streak-up-plus')).toHaveText('+1');
  await expect(page.getByTestId('daily-streak-up-message')).toContainText(
    `You and ${otherName} both answered.`
  );
  await expect(page.getByTestId('daily-streak-up-continue')).toHaveText(button);
}

/** The milestone screen for 25 days: the badge block 25 (colour), 50, 75 and 100 (grey). */
async function expectMilestone(page: Page, { otherName }: { otherName: string }): Promise<void> {
  await expect(page.getByTestId('daily-milestone')).toBeVisible();
  await expect(page.getByTestId('daily-streak-up')).toHaveCount(0);
  await expect(page.getByTestId('daily-milestone-held')).toHaveText('25');
  await expect(page.getByTestId('daily-milestone-message')).toContainText(
    `You and ${otherName} have answered together on 25 days.`
  );
  await expect(page.getByTestId('daily-milestone-badge-25')).toHaveAttribute(
    'data-reached',
    'true'
  );
  for (const days of [50, 75, 100]) {
    await expect(page.getByTestId(`daily-milestone-badge-${days}`)).toHaveAttribute(
      'data-reached',
      'false'
    );
  }
}

test.describe('Daily: every 25 days the milestone screen shows its badge', () => {
  test.describe.configure({ timeout: 150_000 });

  test('[P0] the second picker sees the +1 then the milestone, and a reload shows neither', async ({
    setup: { own, partner, ownIsWriter, ownName },
  }) => {
    await log.step('The worker picks and waits; the partner picks second');
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();
    await pick(partner, 'that');

    await log.step('The partner sees the +1 screen, held 25, then its button opens the milestone');
    await expectStreakUp(partner, {
      otherName: ownName,
      button: 'Continue',
    });
    await partner.getByTestId('daily-streak-up-continue').click();
    await expectMilestone(partner, { otherName: ownName });

    await log.step('Continue reveals the card');
    await partner.getByTestId('daily-milestone-continue').click();
    await expect(partner.getByTestId('daily-milestone')).toHaveCount(0);
    await expect(partner.getByTestId('daily-reveal')).toBeVisible();
    if (!ownIsWriter) await partner.getByTestId('daily-write-decline').click();

    await log.step('A reload shows neither screen, and the copy holds the milestone');
    await openDailySeeded(partner, 25, 1, 'reload');
    await expectClaimed(partner, 25);
    await expect(partner.getByTestId('daily-streak-up')).toHaveCount(0);
    await expect(partner.getByTestId('daily-milestone')).toHaveCount(0);
    expect(
      await savedLocalCopy<{ held: number; milestones: number }>(partner, CELEBRATED_KIND)
    ).toEqual({ held: 25, milestones: 1 });
  });

  test('[P0] the first picker, returning to Daily, sees the +1 then the milestone and closes it', async ({
    setup: { own, partner, ownIsWriter, partnerName },
  }) => {
    await pick(own, 'this');
    await expect(own.getByTestId('daily-waiting')).toBeVisible();
    if (ownIsWriter) await own.getByTestId('daily-write-decline').click();

    await log.step('The worker leaves Daily; the partner finishes the day');
    await navigateTo(own, 'home');
    await expect(own.getByTestId('daily-question-view')).toHaveCount(0);
    await pick(partner, 'that');

    await log.step('The worker comes back: the +1, then the milestone, closed with Close');
    await navigateTo(own, 'daily');
    await expectStreakUp(own, {
      otherName: partnerName,
      button: 'Continue',
    });
    await dismissStreakUp(own);
    await expectMilestone(own, { otherName: partnerName });
    await own.getByTestId('daily-milestone-close').click();
    await expect(own.getByTestId('daily-milestone')).toHaveCount(0);
    await expect(own.getByTestId('daily-reveal')).toBeVisible();
  });
});
