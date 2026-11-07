/**
 * E2E: a partner's pick shows on the other partner's open Daily without a
 * reload (epic daily-question, story 6.6; R2, architecture AD-11).
 *
 * Two pages on this worker's own pooled pair, both open on /daily with their
 * partner channel joined (the `SUBSCRIBED` log) and every `get_daily_day` read
 * settled. The worker sends This: the partner's page shows "has picked" and no
 * reveal. The partner then sends That: the worker's page shows the reveal with
 * both option texts and "Different picks". Each update must come from the
 * `daily_pick` broadcast and the `get_daily_day_by_id` re-read it asks for, so
 * the spec also requires that the page answered one 200 for that RPC and
 * started no `get_daily_day` read after the send.
 *
 * Listeners and request trackers are attached before the navigation they
 * observe. Nothing here links, unlinks or resets an account; the pair's days
 * are cleared before the test and again at teardown.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  readPairQuestionTexts,
} from '../../support/factories/daily-question';
import { closeContext } from '../../support/fixtures/cleanup';
import { resolveWorkerPairIds } from '../../support/factories/events';
import {
  DAILY_DAY_BY_ID_READ,
  DAILY_DAY_READ,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { MOOD_SUBSCRIBED_LOG, type ReadTracker, trackReads } from '../../support/helpers/request-tracker';

const GET_DAILY_DAY_PATH = '/rest/v1/rpc/get_daily_day';

/**
 * Armed before the page loads: the log is printed once, mid-boot, and a page
 * whose channel has not joined would miss the broadcast the spec sends next.
 * Resolves with the number of `get_daily_day` reads the page had started when
 * the join was logged: the join starts one more read of its own, after that
 * count, and that read must settle before the spec sends anything.
 */
function channelJoined(page: Page, reads: ReadTracker): Promise<number> {
  return page
    .waitForEvent('console', {
      predicate: (message) => MOOD_SUBSCRIBED_LOG.test(message.text()),
      timeout: 30_000,
    })
    .then(() => reads.started());
}

test.describe('Daily question: a partner pick shows live', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P0] the partner\'s pick and the reveal show on an open Daily with no reload', async ({
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

    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be sending.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();

    await log.step('Both partners open /daily with their channel joined');
    // Trackers and the join logs first, then the navigation they observe.
    const ownReads = trackReads(page, GET_DAILY_DAY_PATH, 'POST');
    const partnerReads = trackReads(partnerPage, GET_DAILY_DAY_PATH, 'POST');
    const ownJoined = channelJoined(page, ownReads);
    const partnerJoined = channelJoined(partnerPage, partnerReads);

    const ownRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.goto('/daily');
    expect((await ownRead).status).toBe(200);
    const partnerRead = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.goto('/daily');
    expect((await partnerRead).status).toBe(200);
    const [ownStartedAtJoin, partnerStartedAtJoin] = await Promise.all([ownJoined, partnerJoined]);

    const [assigned] = await readPairQuestionTexts(supabaseAdmin, pair);
    await expect(page.getByTestId('daily-question')).toHaveText(assigned);
    await expect(partnerPage.getByTestId('daily-question')).toHaveText(assigned);
    const thisText = await page.getByTestId('daily-option-this').innerText();
    const thatText = await page.getByTestId('daily-option-that').innerText();

    await log.step('Every get_daily_day read has settled on both pages');
    // The join's own read starts after its log line, so each page must have
    // started one beyond the count taken then, with none left in flight; the
    // mount and local-copy reads alone could otherwise satisfy a bare count.
    for (const [reads, startedAtJoin] of [
      [ownReads, ownStartedAtJoin],
      [partnerReads, partnerStartedAtJoin],
    ] as const) {
      await recurseUntil(
        async () => ({ started: reads.started(), inFlight: reads.inFlight() }),
        ({ started, inFlight }) => {
          expect(started, "the join's own read started").toBeGreaterThan(startedAtJoin);
          expect(inFlight, 'no get_daily_day read is in flight').toBe(0);
        },
        { timeout: 15_000 }
      );
    }
    await expect(partnerPage.getByTestId('daily-partner-status')).toContainText("hasn't picked yet");
    const partnerReadsBeforeSend = partnerReads.started();
    const ownReadsBeforeSend = ownReads.started();

    await log.step('The worker sends This; the partner sees "has picked", with no reveal');
    const partnerReReadOne = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_BY_ID_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();

    expect((await partnerReReadOne).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-partner-status')).toContainText('has picked');
    await expect(partnerPage.getByTestId('daily-reveal')).toHaveCount(0);
    await expect(partnerPage.getByTestId('daily-reveal-partner')).toHaveCount(0);
    expect(partnerReads.started(), 'the partner page read no day but the named one').toBe(
      partnerReadsBeforeSend
    );

    await log.step('The partner sends That; the worker sees the reveal, with no reload');
    const ownReReadTwo = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_BY_ID_READ });
    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);

    expect((await ownReReadTwo).status).toBe(200);
    await expect(page.getByTestId('daily-reveal')).toBeVisible();
    await expect(page.getByTestId('daily-reveal-mine')).toHaveText(thisText);
    await expect(page.getByTestId('daily-reveal-partner')).toHaveText(thatText);
    await expect(page.getByTestId('daily-reveal-mark')).toHaveText('Different picks');
    expect(ownReads.started(), 'the worker page read no day but the named one').toBe(
      ownReadsBeforeSend
    );
  });
});
