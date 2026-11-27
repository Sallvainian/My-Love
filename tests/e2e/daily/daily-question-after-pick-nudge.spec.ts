/**
 * E2E: right after an answer the app offers a nudge (epic daily-pushes-and-nudge,
 * story 8.9, and epic-simpler-daily-pushes-and-nudge, story 11.1; R1, architecture
 * AD-13, AD-17).
 *
 * Two pages on this worker's own pooled pair, both open on /daily (the partner's
 * read writes the partner's zone, so their date is the worker's). Whoever is not
 * the day's writer picks first and meets the prompt at once; the day's writer meets
 * the write sheet first and the prompt after it, however it closes.
 *
 *   - Nudge: one `send_daily_nudge` request answers 200, the sheet closes, a row
 *     from the prompt is recorded, and the waiting card's own Nudge button is still
 *     enabled (using one never spends the other); a reload offers no prompt. The
 *     button then sends its own nudge, and shows as sent, also after a reload. The
 *     writer who picks second sees no nudge sheet.
 *   - Not now: the sheet closes, no `send_daily_nudge` request is made, the waiting
 *     card's button stays enabled and still sends its one nudge.
 *   - Writer first: the write sheet shows and the nudge sheet waits; once the write
 *     sheet is closed by Escape or by "No thanks" the nudge sheet shows.
 *
 * Whether the server held a nudge (the partner's clock before 08:00) is read from
 * the row, never guessed from the host clock. A run that would cross local midnight
 * between the nudge and the reload waits past the turn first, in the `setup` fixture
 * (`waitClearOfDailyTurns`, which extends the timeout by the wait; DW-541). Nothing
 * here links, unlinks or resets an account; the pair's days (and their nudges) are
 * cleared before each test and again at teardown.
 */
import type { Page } from '@playwright/test';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test as base, expect } from '../../support/merged-fixtures';
import { clearPairDays, readPairDayIds, readPairDayWriter } from '../../support/factories/daily-question';
import type { TypedSupabaseClient } from '../../support/factories';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { waitClearOfDailyTurns } from '../../support/helpers/events';
import { closeContext } from '../../support/fixtures/cleanup';
import {
  DAILY_DAY_READ,
  DAILY_NUDGE_SEND,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { trackReads } from '../../support/helpers/request-tracker';
import { dismissStreakUp } from '../../support/helpers/streak-up';

const SEND_DAILY_NUDGE_PATH = '/rest/v1/rpc/send_daily_nudge';

type SendTracker = ReturnType<typeof trackReads>;

interface PairSetup {
  /** The page of whichever partner is the day's writer. */
  writerPage: Page;
  /** The page of the other partner, who is not asked to write. */
  otherPage: Page;
  /** `send_daily_nudge` requests started by the writer's page since it first loaded. */
  writerSends: SendTracker;
  /** `send_daily_nudge` requests started by the other partner's page since it first loaded. */
  otherSends: SendTracker;
  /** The pair's one day, and the id of the partner whose page is `otherPage`. */
  dayId: string;
  otherUserId: string;
}

/** `page` opens /daily and the day's read settles with 200. */
async function openDaily(page: Page, method: 'goto' | 'reload'): Promise<void> {
  const read = observeOn({
    page,
    method: 'POST',
    url: DAILY_DAY_READ,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  if (method === 'goto') await page.goto('/daily');
  else await page.reload();
  expect((await read).status).toBe(200);
}

/** `page` picks This and waits for the server to confirm; the waiting card shows. */
async function pickThis(page: Page): Promise<void> {
  await page.getByTestId('daily-option-this').click();
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
    use,
    testInfo
  ) => {
    // Side effect: writes the partner identity's storage-state file.
    expect(partnerAuthToken).not.toBe('');

    await waitClearOfDailyTurns(testInfo);
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

    // Counters first, then the loads they observe.
    const ownSends = trackReads(page, SEND_DAILY_NUDGE_PATH, 'POST');
    const partnerSends = trackReads(partnerPage, SEND_DAILY_NUDGE_PATH, 'POST');

    // The partner opens first: their read writes their zone.
    await openDaily(partnerPage, 'goto');
    await openDaily(page, 'goto');
    await expect(page.getByTestId('daily-question')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-question')).toBeVisible();

    // The day exists now, so its writer is known.
    const workerIsWriter = (await readPairDayWriter(supabaseAdmin, pair)) === pair.userId;
    const [dayId] = await readPairDayIds(supabaseAdmin, pair);
    expect(dayId, 'the pair has a day').toBeDefined();
    await use({
      writerPage: workerIsWriter ? page : partnerPage,
      otherPage: workerIsWriter ? partnerPage : page,
      writerSends: workerIsWriter ? ownSends : partnerSends,
      otherSends: workerIsWriter ? partnerSends : ownSends,
      dayId,
      otherUserId: workerIsWriter ? pair.partnerId : pair.userId,
    });
  },
});

test.describe('Daily question: the nudge offered right after an answer', () => {
  test.describe.configure({ timeout: 120_000 });

  const nudgeRows = async (supabaseAdmin: TypedSupabaseClient, dayId: string) => {
    const { data, error } = await supabaseAdmin
      .from('daily_nudges')
      .select('source, held, from_user')
      .eq('day_id', dayId)
      .order('source');
    expect(error, "the pair day's nudges").toBeNull();
    return data ?? [];
  };

  test('[P1] the first picker nudges from the sheet once, the button still sends its own, and a reload offers no sheet', async ({
    setup: { writerPage, otherPage, writerSends, otherSends, dayId, otherUserId },
    supabaseAdmin,
  }) => {
    await log.step('The picker who is not the writer picks first: the nudge sheet shows');
    await pickThis(otherPage);
    const sheet = otherPage.getByTestId('daily-nudge-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Do you want to nudge your partner?');
    await expect(otherPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();

    await log.step("Nudge sends one request: 200, the sheet closes, the waiting button is still enabled");
    const nudgeSend = observeOn({
      page: otherPage,
      method: 'POST',
      url: DAILY_NUDGE_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await otherPage.getByTestId('daily-nudge-sheet-send').click();
    expect((await nudgeSend).status).toBe(200);
    await expect(sheet).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-nudge')).toBeEnabled();
    expect(otherSends.started(), 'exactly one send_daily_nudge request').toBe(1);
    expect(await nudgeRows(supabaseAdmin, dayId)).toEqual([
      { source: 'prompt', held: expect.any(Boolean), from_user: otherUserId },
    ]);

    await log.step('After a reload there is no sheet, and the button still offers its own nudge');
    await openDaily(otherPage, 'reload');
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();
    await expect(otherPage.getByTestId('daily-nudge')).toBeEnabled();
    await expect(sheet).toHaveCount(0);

    await log.step("The button sends its own nudge: a second request, a row from the button, shown as sent after a reload");
    const buttonSend = observeOn({
      page: otherPage,
      method: 'POST',
      url: DAILY_NUDGE_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await otherPage.getByTestId('daily-nudge').click();
    expect((await buttonSend).status).toBe(200);
    await expect(otherPage.getByTestId('daily-nudge')).toBeDisabled();
    await expect(otherPage.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
    expect((await nudgeRows(supabaseAdmin, dayId)).map((row) => row.source)).toEqual(['button', 'prompt']);
    await openDaily(otherPage, 'reload');
    await expect(otherPage.getByTestId('daily-nudge')).toBeDisabled();
    await expect(otherPage.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
    await expect(sheet).toHaveCount(0);
    expect(otherSends.started(), 'two requests in all: the prompt and the button').toBe(2);

    await log.step('The writer picks second: no nudge sheet on their page');
    await pickThis(writerPage);
    // The second pick finished the day: the +1 screen shows first, and the
    // write sheet waits behind it.
    await dismissStreakUp(writerPage);
    await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    await writerPage.keyboard.press('Escape');
    await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
    await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
    expect(writerSends.started(), "the writer's page sent no nudge").toBe(0);
  });

  test("[P1] Not now sends nothing, leaves the waiting button enabled, and the button still sends its one nudge", async ({
    setup: { otherPage, otherSends, dayId },
    supabaseAdmin,
  }) => {
    await pickThis(otherPage);
    const sheet = otherPage.getByTestId('daily-nudge-sheet');
    await expect(sheet).toBeVisible();

    await otherPage.getByTestId('daily-nudge-sheet-dismiss').click();

    await expect(sheet).toHaveCount(0);
    await expect(otherPage.getByTestId('daily-waiting')).toBeVisible();
    await expect(otherPage.getByTestId('daily-nudge')).toBeEnabled();
    expect(otherSends.started(), 'no send_daily_nudge request was made').toBe(0);

    const buttonSend = observeOn({
      page: otherPage,
      method: 'POST',
      url: DAILY_NUDGE_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await otherPage.getByTestId('daily-nudge').click();
    expect((await buttonSend).status).toBe(200);
    await expect(otherPage.getByTestId('daily-nudge')).toBeDisabled();
    expect(otherSends.started(), 'the button sent exactly one').toBe(1);
    expect((await nudgeRows(supabaseAdmin, dayId)).map((row) => row.source)).toEqual(['button']);
    await expect(sheet).toHaveCount(0);
  });

  for (const [closes, closeWriteSheet] of [
    ['Escape', (page: Page) => page.keyboard.press('Escape')],
    ['No thanks', (page: Page) => page.getByTestId('daily-write-decline').click()],
  ] as const) {
    test(`[P1] the writer's pick shows the write sheet and the nudge sheet follows it when it is closed by ${closes}`, async ({
      setup: { writerPage, otherPage, writerSends, otherSends },
    }) => {
      await pickThis(writerPage);
      await expect(writerPage.getByTestId('daily-write-sheet')).toBeVisible();
      await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);

      await closeWriteSheet(writerPage);

      await expect(writerPage.getByTestId('daily-write-sheet')).toHaveCount(0);
      await expect(writerPage.getByTestId('daily-nudge-sheet')).toBeVisible();
      await writerPage.getByTestId('daily-nudge-sheet-dismiss').click();
      await expect(writerPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
      await expect(writerPage.getByTestId('daily-waiting')).toBeVisible();
      expect(writerSends.started(), 'Not now sent nothing').toBe(0);

      await log.step('The other partner picks second: the reveal, and no nudge sheet or request');
      await pickThis(otherPage);
      // The second pick finished the day: the +1 screen shows first.
      await dismissStreakUp(otherPage);
      await expect(otherPage.getByTestId('daily-reveal')).toBeVisible();
      await expect(otherPage.getByTestId('daily-nudge-sheet')).toHaveCount(0);
      expect(otherSends.started(), 'the second picker sent no nudge').toBe(0);
    });
  }
});
