/**
 * E2E: the Partner page lists past questions marked Same or Different (epic
 * streak-and-partner-page, story 7.7).
 *
 * Runs on this worker's own pooled pair, unstubbed. Four finished days are
 * seeded (`seedPairDays`, daysAgo 1 to 4, both picks, always `this`, so every
 * seeded day is Same) and the worker picks today's question on Daily. The
 * Partner page then shows the three newest finished days, not today's, which
 * only one partner has answered. When the partner picks the other option on
 * Daily, the page, left open, shows today's question first as Different with
 * no reload (the `daily_pick` broadcast re-reads the history), still three rows.
 *
 * The pair's days are cleared before the test and again at teardown; nothing
 * here links, unlinks or resets an account.
 */
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as fulfillOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairDayWriter,
  readPairQuestionsByDay,
  seedPairDays,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { isoDateDaysFromNow } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_READ,
  DAILY_HISTORY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { dismissStreakUp } from '../../support/helpers/streak-up';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

test.describe('Partner page past questions', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] lists the three newest finished days, and today joins the top once the partner picks', async ({
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
    test.setTimeout(120_000);
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await seedPairDays(supabaseAdmin, pair, [
      { daysAgo: 1, picks: 'both' },
      { daysAgo: 2, picks: 'both' },
      { daysAgo: 3, picks: 'both' },
      { daysAgo: 4, picks: 'both' },
    ]);

    await log.step('The worker picks today on Daily; the partner has not');
    const ownDay = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    expect((await ownDay).status).toBe(200);

    const today = isoDateDaysFromNow(0, new Date());
    const workerIsWriter = (await readPairDayWriter(supabaseAdmin, pair, today)) === pair.userId;

    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    // The writer's sheet would cover the dock.
    if (workerIsWriter) await page.getByTestId('daily-write-decline').click();

    const questions = await readPairQuestionsByDay(supabaseAdmin, pair);
    const todayQuestion = questions.find((q) => q.day === today);
    expect(todayQuestion, "today's day exists").toBeDefined();
    const finished = questions.filter((q) => q.day !== today);
    expect(finished).toHaveLength(4);

    await log.step('The worker opens Partner: days 1, 2 and 3, all Same, not today');
    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    const ownHistory = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    await navigateTo(page, 'partner');
    expect((await ownStreak).status).toBe(200);
    expect((await ownHistory).status).toBe(200);

    const section = page.getByTestId('partner-past-questions');
    await expect(section).toBeVisible();
    const rows = section.getByTestId('partner-past-question');
    await expect(rows).toHaveCount(3);
    for (const [index, q] of finished.slice(0, 3).entries()) {
      const row = rows.nth(index);
      await expect(row.getByTestId('partner-past-question-text')).toHaveText(
        `${q.this} or ${q.that}?`
      );
      await expect(row.getByTestId('partner-past-question-picks')).toHaveText(
        `${q.this} · ${q.this}`
      );
      await expect(row).toHaveAttribute('data-same', 'true');
      await expect(row.getByTestId('partner-past-question-mark')).toHaveText('Same');
    }

    await log.step('The partner picks the other option on Daily; the worker never reloads');
    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();
    await dismissWelcomeSplash(partnerPage);
    const partnerDay = fulfillOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerDay).status).toBe(200);

    const reread = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = fulfillOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-reveal')).toBeVisible();
    await dismissStreakUp(partnerPage);

    // A history re-read lands; the row assertions below retry until the one the
    // partner's `daily_pick` asks for has landed (a SUBSCRIBED re-read can match this wait too).
    expect((await reread).status).toBe(200);
    await expect(rows).toHaveCount(3);
    const first = rows.first();
    const now = todayQuestion!;
    await expect(first.getByTestId('partner-past-question-text')).toHaveText(
      `${now.this} or ${now.that}?`
    );
    await expect(first.getByTestId('partner-past-question-picks')).toHaveText(
      `${now.this} · ${now.that}`
    );
    await expect(first).toHaveAttribute('data-same', 'false');
    await expect(first.getByTestId('partner-past-question-mark')).toHaveText('Different');
  });
});
