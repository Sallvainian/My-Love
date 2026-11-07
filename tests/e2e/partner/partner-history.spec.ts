/**
 * E2E: See all opens every past question with the running count (epic
 * streak-and-partner-page, story 7.8).
 *
 * Runs on this worker's own pooled pair, unstubbed. 35 finished days are seeded
 * (`seedPairDays`, daysAgo 1 to 35, both picks, always `this`, so every day is
 * Same and the streak counts `same` 35 of `done` 35). The history page at
 * `/partner/history` is a page of the Partner view: the URL changes, the dock
 * keeps Partner lit, and the app header gives way to the page's own bar.
 *
 * The pair's days are cleared before each test and again at teardown; nothing
 * here links, unlinks or resets an account.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairQuestionsByDay,
  seedPairDays,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { COUPLE_STREAK_READ, DAILY_HISTORY_READ } from '../../support/helpers/reads';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const DAYS = 35;
const FIRST_PAGE = 30;

type Fixtures = Parameters<Parameters<typeof test>[2]>[0];

/** Clears and seeds the worker pair's 35 finished days; clears again at teardown. */
async function seedHistory({ supabaseAdmin, cleanup }: Pick<Fixtures, 'supabaseAdmin' | 'cleanup'>) {
  const pair = await resolveWorkerPairIds(supabaseAdmin);
  await clearPairDays(supabaseAdmin, pair);
  cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
  await seedPairDays(
    supabaseAdmin,
    pair,
    Array.from({ length: DAYS }, (_, index) => ({ daysAgo: index + 1, picks: 'both' as const }))
  );
  return readPairQuestionsByDay(supabaseAdmin, pair);
}

async function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

test.describe('Partner history page', () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P0] See all opens every past question, newest first, 30 at a time', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    test.setTimeout(120_000);
    const questions = await seedHistory({ supabaseAdmin, cleanup });
    expect(questions).toHaveLength(DAYS);

    await log.step('The worker opens Partner and taps See all');
    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    const ownHistory = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    await page.goto('/partner');
    expect((await ownStreak).status).toBe(200);
    expect((await ownHistory).status).toBe(200);

    const before = await historyLength(page);
    await page.getByTestId('partner-past-questions-see-all').click();

    await expect(page).toHaveURL(/\/partner\/history$/);
    expect(await historyLength(page)).toBe(before + 1);
    await expect(page.getByTestId('partner-history-title')).toHaveText('Past questions');
    await expect(page.getByTestId('app-header')).toHaveCount(0);
    await expect(page.getByTestId('nav-partner')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('partner-history-summary')).toHaveText(
      `Same pick on ${DAYS} of your ${DAYS} days`
    );

    await log.step('30 rows show newest first; scrolling to the end shows all 35');
    const rows = page.getByTestId('partner-history-row');
    await expect(rows).toHaveCount(FIRST_PAGE);
    for (const index of [0, 1, FIRST_PAGE - 1]) {
      const q = questions[index];
      await expect(rows.nth(index).getByTestId('partner-history-question')).toHaveText(
        `${q.this} or ${q.that}?`
      );
      await expect(rows.nth(index)).toHaveAttribute('data-same', 'true');
      await expect(rows.nth(index).getByTestId('partner-history-mine')).toHaveText(
        `You: ${q.this}`
      );
      await expect(rows.nth(index).getByTestId('partner-history-mark')).toHaveText('Same');
    }

    await page.getByTestId('partner-history-sentinel').scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(DAYS);
    const last = questions[DAYS - 1];
    await expect(rows.last().getByTestId('partner-history-question')).toHaveText(
      `${last.this} or ${last.that}?`
    );
  });

  test('[P0] the back arrow and the browser back both return to the Partner page', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    test.setTimeout(120_000);
    await seedHistory({ supabaseAdmin, cleanup });

    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner');
    expect((await ownStreak).status).toBe(200);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();

    await log.step('See all, then the arrow');
    await page.getByTestId('partner-past-questions-see-all').click();
    await expect(page.getByTestId('partner-history-title')).toBeVisible();
    await page.getByTestId('partner-history-back').click();
    await expect(page).toHaveURL(/\/partner$/);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    await expect(page.getByTestId('partner-history')).toHaveCount(0);
    await expect(page.getByTestId('app-header')).toBeVisible();

    await log.step('See all, then the browser back');
    await page.getByTestId('partner-past-questions-see-all').click();
    await expect(page.getByTestId('partner-history-title')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/partner$/);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    await expect(page.getByTestId('partner-history')).toHaveCount(0);
  });

  test('[P1] a reload on the history page keeps it, and its arrow lands on /partner without leaving the app', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    test.setTimeout(120_000);
    await seedHistory({ supabaseAdmin, cleanup });

    const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner/history');
    expect((await ownStreak).status).toBe(200);

    await expect(page.getByTestId('partner-history-title')).toBeVisible();
    await expect(page.getByTestId('partner-history-row')).toHaveCount(FIRST_PAGE);
    await expect(page.getByTestId('nav-partner')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('partner-history-summary')).toHaveText(
      `Same pick on ${DAYS} of your ${DAYS} days`
    );

    await log.step('The arrow replaces the entry: same history length, still in the app');
    const length = await historyLength(page);
    await page.getByTestId('partner-history-back').click();
    await expect(page).toHaveURL(/\/partner$/);
    await expect(page.getByTestId('partner-streak-card')).toBeVisible();
    expect(await historyLength(page)).toBe(length);
  });

  for (const form of ['column', 'bottom'] as const) {
    test(`[P1] in the ${form} form the dock lights Partner on the history page`, async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
      cleanup,
    }) => {
      test.setTimeout(120_000);
      await seedHistory({ supabaseAdmin, cleanup });

      if (form === 'column') {
        // The iPhone Duo's 84pt side column, as `env(safe-area-inset-left)`.
        const session = await page.context().newCDPSession(page);
        await session.send('Emulation.setSafeAreaInsetsOverride', {
          insets: { left: 84, right: 0, top: 0, bottom: 0 },
        });
      }

      const ownStreak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
      await page.goto('/partner');
      expect((await ownStreak).status).toBe(200);
      await page.getByTestId('partner-past-questions-see-all').click();

      await expect(page.getByTestId('partner-history-title')).toBeVisible();
      await expect(page.getByTestId('nav-dock')).toHaveAttribute('data-form', form);
      await expect(page.getByTestId('nav-partner')).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('partner-history-back')).toBeVisible();
    });
  }
});
