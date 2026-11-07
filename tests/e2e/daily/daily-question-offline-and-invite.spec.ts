/**
 * E2E: Daily shows its saved day offline and invites an unlinked account to link
 * (epic daily-question, story 6.5; R7, R8, AD-12, AD-13).
 *
 * 1. An account with no partner opens /daily: `get_daily_day` answers
 *    `unlinked`, the invitation shows with no question, and Go to Partner lands
 *    on /partner.
 * 2. The worker's day loaded online is saved in the `daily-days` copy, so after
 *    a reload that gets no server answer, offline, the same question shows and
 *    neither the invitation nor the loading line does.
 * 3. A fresh context with an empty copy and no server answer shows an error, never
 *    the invitation; offline, Retry shows the needs-a-connection sentence.
 *
 * Dev mode has no service worker, so a reload cannot happen while the context
 * is offline. The reload runs online with the `get_daily_day` endpoint aborted,
 * so the session never gets a server answer, and the device then goes offline.
 *
 * Accounts: the unlinked one is a throwaway made by the test and deleted at
 * teardown; the others use this worker's pooled pair, whose days are cleared
 * before the test and again at teardown. Nothing links, unlinks or resets a
 * pool account.
 */
import type { Page } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { clearPairDays } from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { closeContext } from '../../support/fixtures/cleanup';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { goOffline } from '../../support/helpers/offline';
import { DAILY_DAY_READ, SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { createThrowaway, signIn } from '../../support/helpers/throwaway-account';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const OFFLINE_LOAD_MESSAGE = "You are offline. Today's question needs a connection to load.";

/** Route `get_daily_day` to an abort and count the requests it took. */
async function abortDailyReads(page: Page): Promise<{ count: () => number }> {
  let aborted = 0;
  // playwright-utils deviation: the route must be installed before the navigation it serves and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route(DAILY_DAY_READ, (route) => {
    aborted += 1;
    return route.abort();
  });
  return { count: () => aborted };
}

test.describe('Daily: saved day offline and the invitation to link', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P1] an account with no partner sees the invitation and Go to Partner opens Partner', async ({
    browser,
    baseURL,
    supabaseAdmin,
    cleanup,
  }) => {
    const account = await createThrowaway(supabaseAdmin, cleanup, 'daily');
    const context = await browser.newContext({ baseURL });
    cleanup.defer('close the throwaway context', () => closeContext(context));
    const page = await context.newPage();
    await dismissWelcomeSplash(page);
    await signIn(page, account);

    // WHEN: the account opens /daily.
    const read = observeOn({
      page,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await page.goto('/daily');
    const answer = await read;

    // THEN: the server says unlinked, and the page invites instead of asking.
    expect(answer.status).toBe(200);
    expect(answer.responseJson).toEqual({ status: 'unlinked' });
    await expect(page.getByTestId('daily-invite')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Link with your partner' })).toBeVisible();
    await expect(page.getByTestId('daily-question')).toHaveCount(0);
    await expect(page.getByTestId('daily-option-this')).toHaveCount(0);

    // AND: Go to Partner opens the Partner page.
    await page.getByTestId('daily-invite-link').click();
    await expect(page).toHaveURL(/\/partner$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })
    ).toBeVisible();
  });

  test("[P1] today's question loaded online is shown offline after a reload", async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await dismissWelcomeSplash(page);

    // GIVEN: /daily loads online and the answer is saved in the copy.
    const read = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    const online = await read;
    expect(online.status).toBe(200);
    const dayId = (online.responseJson as { snapshot: { day_id: string } }).snapshot.day_id;
    const question = page.getByTestId('daily-question');
    await expect(question).toBeVisible();
    const questionText = await question.innerText();
    await recurseUntil(
      async () => Object.keys((await savedLocalCopy<Record<string, unknown>>(page, 'daily-days')) ?? {}),
      (ids) => {
        expect(ids).toContain(dayId);
      }
    );

    // WHEN: the page reloads without a server answer and the device goes offline.
    const aborted = await abortDailyReads(page);
    await page.reload();
    await expect(page.getByTestId('daily-question')).toBeVisible();
    // The read really hit the aborted route, so the question came from the copy.
    await recurseUntil(async () => aborted.count(), (v) => {
      expect(v).toBeGreaterThan(0);
    });
    await goOffline(page, true);

    // THEN: the saved question shows, with neither the invitation nor the loading line.
    await expect(page.getByTestId('daily-question')).toHaveText(questionText);
    await expect(page.getByTestId('daily-invite')).toHaveCount(0);
    await expect(page.getByTestId('daily-loading')).toHaveCount(0);
  });

  test('[P1] with nothing saved and no answer, Daily shows an error and never the invitation', async ({
    page,
    supabaseAdmin,
    cleanup,
  }) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));
    await dismissWelcomeSplash(page);

    // GIVEN: a fresh context (an empty copy) whose Daily read is aborted.
    const aborted = await abortDailyReads(page);
    await page.goto('/daily');

    // THEN: the failed read is an error with Retry, not the invitation and not a question.
    await expect(page.getByTestId('daily-error')).toBeVisible();
    expect(aborted.count()).toBeGreaterThan(0);
    await expect(page.getByTestId('daily-invite')).toHaveCount(0);
    await expect(page.getByTestId('daily-question')).toHaveCount(0);

    // WHEN: the device goes offline and Retry is tapped.
    await goOffline(page, true);
    await page.getByTestId('daily-retry').click();

    // THEN: the needs-a-connection sentence shows, still no question or invitation.
    await expect(page.getByTestId('daily-error')).toContainText(OFFLINE_LOAD_MESSAGE);
    await expect(page.getByTestId('daily-question')).toHaveCount(0);
    await expect(page.getByTestId('daily-invite')).toHaveCount(0);
  });
});
