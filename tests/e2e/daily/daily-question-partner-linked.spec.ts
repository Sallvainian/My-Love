/**
 * E2E: an open Daily replaces the invitation to link with today's question
 * when the account's partner request is accepted (DW-490).
 *
 * A, unlinked, sits on /daily showing "Link with your partner", its partner
 * channel joined (the `SUBSCRIBED` log) and every `get_daily_day` read
 * settled. B accepts A's request from its Partner tab in a second browser; the
 * accept announces `partner_linked` on A's own topic, and A's open Daily
 * re-reads today. Server, then store, then screen: A's next `get_daily_day`
 * answers `ok`, the store holds that day, and the question shows where the
 * invitation was, with A never leaving /daily.
 *
 * Accounts: throwaway accounts made by the test, never the worker pool — a spec
 * must not link or unlink pool partners (AGENTS.md). Each is deleted at
 * teardown through `cleanup`; the FKs cascade the request, the link and the
 * couple's day. Listeners and request trackers are attached before the
 * navigation they observe.
 */
import type { Page } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import type { AppState } from '../../../src/stores/types';
import { test, expect } from '../../support/merged-fixtures';
import { readPairQuestionTexts } from '../../support/factories/daily-question';
import { closeContext } from '../../support/fixtures/cleanup';
import { navigateTo } from '../../support/helpers/navigation';
import { acceptFromPartnerTab, seedRequest } from '../../support/helpers/partner-requests';
import { DAILY_DAY_READ, SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { MOOD_SUBSCRIBED_LOG, trackReads } from '../../support/helpers/request-tracker';
import { createThrowaway, signIn } from '../../support/helpers/throwaway-account';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

const GET_DAILY_DAY_PATH = '/rest/v1/rpc/get_daily_day';

/** The status of the store's `dailyDay`, read from the running app (observation only). */
async function storeDailyStatus(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    return (useAppStore.getState() as AppState).dailyDay?.status ?? null;
  });
}

/** The next log of a partner-channel join on `page`; arm it before the load that logs it. */
function channelJoined(page: Page): Promise<unknown> {
  return page.waitForEvent('console', {
    predicate: (message) => MOOD_SUBSCRIBED_LOG.test(message.text()),
    timeout: 30_000,
  });
}

test.describe('Daily: the invitation to link gives way when the request is accepted', () => {
  // Signs in as its own throwaway accounts, not the worker's pool account.
  test.use({ authSessionEnabled: false });
  test.describe.configure({ timeout: 120_000 });

  test("[P1] an open Daily shows today's question once the partner accepts, with no reload", async ({
    page,
    browser,
    baseURL,
    supabaseAdmin,
    cleanup,
  }) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    const requestId = await seedRequest(a, b);

    await log.step('A, unlinked, sits on /daily with its channel joined');
    // Tracker and join logs first, then the sign-in and navigation they observe.
    // The page signed in on Home joins the channel too; its log is waited out
    // so that the one counted below is the /daily load's.
    const aReads = trackReads(page, GET_DAILY_DAY_PATH, 'POST');
    const homeJoined = channelJoined(page);
    await dismissWelcomeSplash(page);
    await signIn(page, a);
    await homeJoined;
    const joined = channelJoined(page).then(() => aReads.started());
    const unlinkedRead = observeOn({
      page,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await page.goto('/daily');
    const unlinked = await unlinkedRead;
    expect(unlinked.status).toBe(200);
    expect(unlinked.responseJson).toEqual({ status: 'unlinked' });
    const startedAtJoin = await joined;

    // The join re-reads today once more, after its log line; it must have
    // started and every read settled, so the day that shows below can only come
    // from a read started after the accept.
    await recurseUntil(
      async () => ({ started: aReads.started(), inFlight: aReads.inFlight() }),
      (v) => {
        expect(v.started).toBeGreaterThan(startedAtJoin);
        expect(v.inFlight).toBe(0);
      }
    );
    await expect(page.getByTestId('daily-invite')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Link with your partner' })).toBeVisible();
    await expect(page.getByTestId('daily-question')).toHaveCount(0);

    await log.step('B accepts the request from its Partner tab');
    const bContext = await browser.newContext({ baseURL });
    cleanup.defer('close the partner context', () => closeContext(bContext));
    const bPage = await bContext.newPage();
    await dismissWelcomeSplash(bPage);
    await signIn(bPage, b);
    await navigateTo(bPage, 'partner');

    const readsBeforeAccept = aReads.started();
    const linkedRead = observeOn({
      page,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await acceptFromPartnerTab(bPage, requestId);

    await log.step("A's open Daily re-reads today and shows the question");
    // Server, then store, then screen.
    const linked = await linkedRead;
    expect(linked.status).toBe(200);
    expect(linked.responseJson).toEqual(expect.objectContaining({ status: 'ok' }));
    expect(aReads.started()).toBeGreaterThan(readsBeforeAccept);
    await recurseUntil(
      () => storeDailyStatus(page),
      (v) => {
        expect(v).toBe('ok');
      }
    );

    const [assigned] = await readPairQuestionTexts(supabaseAdmin, {
      userId: a.userId,
      partnerId: b.userId,
    });
    await expect(page.getByTestId('daily-question')).toBeVisible();
    await expect(page.getByTestId('daily-question')).toHaveText(assigned);
    await expect(page.getByTestId('daily-invite')).toHaveCount(0);
    await expect(page).toHaveURL(/\/daily$/);
  });
});
