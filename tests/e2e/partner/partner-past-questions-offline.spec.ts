/**
 * E2E: the Past questions show offline from the `daily-days` copy, and only for
 * the current partner (epic streak-and-partner-page, story 7.9; AD-13, DW-492).
 *
 * 1. A worker pair's Partner page loaded online saves its 3 done days. After a
 *    reload that gets no history or streak answer, and then offline, the card
 *    still shows the 3 rows, and See all shows "Same pick on 3 of your 3 days".
 * 2. 35 done days paged in on See all online are all saved: a reload of
 *    `/partner/history` that gets no history answer, and then offline, shows all
 *    35 rows.
 * 3. Throwaway A, linked to B with done days, is relinked by an admin to C (and
 *    B to D). After A loads Partner and Daily online again, a reload with the
 *    reads aborted and the device offline shows none of A and B's questions,
 *    though the copy still holds their entries: the partner filter hides them.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. Each reload runs online with the reads aborted (`abortReads`),
 * so the session never gets a server answer, and the device then goes offline.
 * A test visits Daily and Partner online before going offline so their lazy
 * chunks are loaded.
 *
 * Accounts: tests 1 and 2 use this worker's pooled pair, whose days are cleared
 * before each test and again at teardown. Test 3 makes four throwaway accounts
 * and links and relinks only those; nothing links, unlinks or resets a pool
 * account.
 */
import type { Page } from '@playwright/test';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairQuestionTexts,
  readPairQuestionsByDay,
  seedPairDays,
} from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import type { TypedSupabaseClient } from '../../support/factories';
import { abortReads } from '../../support/helpers/abort-reads';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { navigateTo } from '../../support/helpers/navigation';
import { goOffline } from '../../support/helpers/offline';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_READ,
  DAILY_HISTORY_READ,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { createThrowaway, signIn } from '../../support/helpers/throwaway-account';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

interface SavedDay {
  day_id: string;
  day: string;
  state: string;
  partner_id?: string | null;
}

type Fixtures = Parameters<Parameters<typeof test>[2]>[0];

/** The saved `daily-days` entries, or `[]` when there is no copy. */
async function savedDays(page: Page): Promise<SavedDay[]> {
  return Object.values((await savedLocalCopy<Record<string, SavedDay>>(page, 'daily-days')) ?? {});
}

/** How many saved entries are done days (`both`) read with `partnerId`. */
async function savedDoneCount(page: Page, partnerId: string): Promise<number> {
  return (await savedDays(page)).filter(
    (entry) => entry.state === 'both' && entry.partner_id === partnerId
  ).length;
}

/** Clears and seeds the worker pair's `count` finished days; clears again at teardown. */
async function seedDoneDays(
  { supabaseAdmin, cleanup }: Pick<Fixtures, 'supabaseAdmin' | 'cleanup'>,
  count: number
) {
  const pair = await resolveWorkerPairIds(supabaseAdmin);
  await clearPairDays(supabaseAdmin, pair);
  cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
  await seedPairDays(
    supabaseAdmin,
    pair,
    Array.from({ length: count }, (_, index) => ({ daysAgo: index + 1, picks: 'both' as const }))
  );
  return { pair, questions: await readPairQuestionsByDay(supabaseAdmin, pair) };
}

test.describe('Past questions offline, on the worker pair', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await dismissWelcomeSplash(page);
  });

  test('[P1] the card and See all show 3 saved days after a reload with no answer, offline', async ({
    page,
    supabaseAdmin,
    cleanup,
    interceptNetworkCall,
  }) => {
    const { pair, questions } = await seedDoneDays({ supabaseAdmin, cleanup }, 3);
    expect(questions).toHaveLength(3);

    await log.step('GIVEN the Partner page loaded the 3 days online');
    const history = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    const streak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner');
    expect((await history).status).toBe(200);
    expect((await streak).status).toBe(200);
    await expect(page.getByTestId('partner-past-question')).toHaveCount(3);
    await recurseUntil(
      () => savedDoneCount(page, pair.partnerId),
      (count) => {
        expect(count).toBe(3);
      }
    );

    await log.step('WHEN it reloads with the history and streak reads aborted, then goes offline');
    const abortedHistory = await abortReads(page, DAILY_HISTORY_READ);
    const abortedStreak = await abortReads(page, COUPLE_STREAK_READ);
    await page.reload();
    await expect(page.getByTestId('partner-past-question')).toHaveCount(3);
    // Both reads really hit the aborted routes: the card came from the copies.
    await recurseUntil(
      async () => [abortedHistory.count(), abortedStreak.count()],
      ([historyReads, streakReads]) => {
        expect(historyReads).toBeGreaterThan(0);
        expect(streakReads).toBeGreaterThan(0);
      }
    );
    await goOffline(page, true);

    await log.step('THEN the card still shows the 3 rows, and See all shows them with the count');
    const cardRows = page.getByTestId('partner-past-question');
    await expect(cardRows).toHaveCount(3);
    for (const [index, question] of questions.entries()) {
      await expect(cardRows.nth(index).getByTestId('partner-past-question-text')).toHaveText(
        `${question.this} or ${question.that}?`
      );
    }
    await page.getByTestId('partner-past-questions-see-all').click();
    await expect(page.getByTestId('partner-history-summary')).toHaveText(
      'Same pick on 3 of your 3 days'
    );
    const rows = page.getByTestId('partner-history-row');
    await expect(rows).toHaveCount(3);
    for (const [index, question] of questions.entries()) {
      await expect(rows.nth(index).getByTestId('partner-history-question')).toHaveText(
        `${question.this} or ${question.that}?`
      );
    }
  });

  test('[P1] 35 days paged in online all show on See all after a reload with no answer, offline', async ({
    page,
    supabaseAdmin,
    cleanup,
    interceptNetworkCall,
  }) => {
    const { pair, questions } = await seedDoneDays({ supabaseAdmin, cleanup }, 35);
    expect(questions).toHaveLength(35);

    await log.step('GIVEN See all paged all 35 days in online');
    const history = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    const streak = interceptNetworkCall({ method: 'POST', url: COUPLE_STREAK_READ });
    await page.goto('/partner/history');
    expect((await history).status).toBe(200);
    expect((await streak).status).toBe(200);
    await expect(page.getByTestId('partner-history-row')).toHaveCount(30);
    await page.getByTestId('partner-history-sentinel').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('partner-history-row')).toHaveCount(35);
    await recurseUntil(
      () => savedDoneCount(page, pair.partnerId),
      (count) => {
        expect(count).toBe(35);
      }
    );

    await log.step('WHEN the page reloads with the history read aborted, then goes offline');
    const aborted = await abortReads(page, DAILY_HISTORY_READ);
    await page.reload();
    await expect(page.getByTestId('partner-history-row')).toHaveCount(35);
    await recurseUntil(
      async () => aborted.count(),
      (count) => {
        expect(count).toBeGreaterThan(0);
      }
    );
    await goOffline(page, true);

    await log.step('THEN all 35 rows show under the count');
    await expect(page.getByTestId('partner-history-summary')).toHaveText(
      'Same pick on 35 of your 35 days'
    );
    const rows = page.getByTestId('partner-history-row');
    await expect(rows).toHaveCount(35);
    const oldest = questions[34];
    await expect(rows.last().getByTestId('partner-history-question')).toHaveText(
      `${oldest.this} or ${oldest.that}?`
    );
  });
});

/** Point two accounts at each other (`users.partner_id`), as global setup links the pool. */
async function link(admin: TypedSupabaseClient, first: string, second: string): Promise<void> {
  for (const [id, partnerId] of [
    [first, second],
    [second, first],
  ]) {
    const { error } = await admin.from('users').update({ partner_id: partnerId }).eq('id', id);
    if (error) throw new Error(`link: failed to set a partner: ${error.message}`);
  }
}

test.describe('Past questions offline, after a relink', () => {
  // Signs in as its own throwaway accounts, not the worker's pool account.
  test.use({ authSessionEnabled: false });
  test.describe.configure({ timeout: 180_000 });

  test("[P1] an old pairing's days stay saved but neither Daily nor Past questions shows them", async ({
    page,
    supabaseAdmin,
    cleanup,
    interceptNetworkCall,
  }) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    const c = await createThrowaway(supabaseAdmin, cleanup, 'c');
    const d = await createThrowaway(supabaseAdmin, cleanup, 'd');
    await link(supabaseAdmin, a.userId, b.userId);
    await seedPairDays(
      supabaseAdmin,
      { userId: a.userId, partnerId: b.userId },
      [1, 2, 3].map((daysAgo) => ({ daysAgo, picks: 'both' as const }))
    );

    await log.step('GIVEN A loaded Daily and Partner online while linked to B');
    await dismissWelcomeSplash(page);
    await signIn(page, a);
    const dayRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await navigateTo(page, 'daily');
    expect((await dayRead).status).toBe(200);
    await expect(page.getByTestId('daily-question')).toBeVisible();
    const history = interceptNetworkCall({ method: 'POST', url: DAILY_HISTORY_READ });
    await navigateTo(page, 'partner');
    expect((await history).status).toBe(200);
    await expect(page.getByTestId('partner-past-question')).toHaveCount(3);
    await recurseUntil(
      () => savedDoneCount(page, b.userId),
      (count) => {
        expect(count).toBe(3);
      }
    );
    // Every question of A and B's days, today's included.
    const oldTexts = await readPairQuestionTexts(supabaseAdmin, {
      userId: a.userId,
      partnerId: b.userId,
    });
    expect(oldTexts.length).toBeGreaterThanOrEqual(3);

    await log.step('WHEN an admin relinks A to C and B to D, and A loads Partner and Daily online');
    for (const id of [a.userId, b.userId, c.userId, d.userId]) {
      const { error } = await supabaseAdmin.from('users').update({ partner_id: null }).eq('id', id);
      if (error) throw new Error(`unlink: ${error.message}`);
    }
    await link(supabaseAdmin, a.userId, c.userId);
    await link(supabaseAdmin, b.userId, d.userId);

    await navigateTo(page, 'home');
    await expect(page.getByTestId('partner-view')).toHaveCount(0);
    await navigateTo(page, 'partner');
    await expect(page.getByRole('heading', { level: 1, name: c.name })).toBeVisible();
    await expect(page.getByTestId('partner-past-questions')).toHaveCount(0);
    const newDayRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await navigateTo(page, 'daily');
    expect((await newDayRead).status).toBe(200);
    await expect(page.getByTestId('daily-question')).toBeVisible();
    // The new pairing's day is saved under C; the old pairing's done days remain under B.
    await recurseUntil(
      async () => ({
        withC: (await savedDays(page)).filter((entry) => entry.partner_id === c.userId).length,
        withB: await savedDoneCount(page, b.userId),
      }),
      ({ withC, withB }) => {
        expect(withC).toBeGreaterThan(0);
        expect(withB).toBe(3);
      }
    );
    const newTexts = await readPairQuestionTexts(supabaseAdmin, {
      userId: a.userId,
      partnerId: c.userId,
    });
    // A new day can draw the same question text as an old one; only the old pairing's others prove the filter.
    const hidden = oldTexts.filter((text) => !newTexts.includes(text));
    expect(hidden.length).toBeGreaterThanOrEqual(3);

    await log.step('AND reloads with the reads aborted, then goes offline');
    const abortedHistory = await abortReads(page, DAILY_HISTORY_READ);
    await abortReads(page, COUPLE_STREAK_READ);
    await abortReads(page, DAILY_DAY_READ);
    await navigateTo(page, 'partner');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: c.name })).toBeVisible();
    await recurseUntil(
      async () => abortedHistory.count(),
      (count) => {
        expect(count).toBeGreaterThan(0);
      }
    );
    // The reload dropped Daily's lazy chunk: load it while still online, then come back.
    await navigateTo(page, 'daily');
    await expect(page.getByTestId('daily-question')).toBeVisible();
    await navigateTo(page, 'partner');
    await expect(page.getByRole('heading', { level: 1, name: c.name })).toBeVisible();
    await goOffline(page, true);

    await log.step("THEN Partner shows none of A and B's questions and Daily shows C's day");
    await expect(page.getByTestId('partner-past-questions')).toHaveCount(0);
    for (const text of hidden) {
      await expect(page.getByTestId('partner-view')).not.toContainText(text);
    }
    // This Daily check is held by the date drop, not the partner filter: A and C's
    // answer for today dropped A and B's entry for the same date. The Daily partner
    // filter is pinned by tests/unit/stores/dailyQuestionSlice.partner.test.ts.
    await navigateTo(page, 'daily');
    await expect(page.getByTestId('daily-question')).toBeVisible();
    for (const text of hidden) {
      await expect(page.getByTestId('daily-question')).not.toContainText(text);
    }

    await log.step('AND the copy still holds the old pairing, hidden by the filter');
    expect(await savedDoneCount(page, b.userId)).toBe(3);
  });
});
