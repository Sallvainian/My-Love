/**
 * E2E: both partners pick today's question and see the reveal (epic
 * daily-question, story 6.12; R1, R2, R5).
 *
 * Two pages on this worker's own pooled pair: the worker's page and the
 * partner's page both open /daily and show the one question the server assigned
 * to the pair. The worker picks This and waits; the partner then sees that the
 * worker has picked, with no reveal, picks That, and both pages show the reveal
 * with both option texts and "Different picks".
 *
 * The coach pool is shared by every worker's pair, so the spec never asserts a
 * specific question: both pages must agree with the `couple_days` row read
 * through the admin client. Nothing here links, unlinks or resets an account;
 * the pair's days are cleared before the test and again at teardown (a day left
 * behind fixes the question and the picks the next run starts from).
 */
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../../support/merged-fixtures';
import {
  clearPairDays,
  ensureTestCoachQuestions,
  readPairQuestionTexts,
} from '../../support/factories/daily-question';
import { closeContext } from '../../support/fixtures/cleanup';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { DAILY_DAY_READ, DAILY_PICK_SEND, SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';

test.describe('Daily question: pick and reveal', () => {
  test.describe.configure({ timeout: 120_000 });

  test('[P0] both partners see one question, a pick waits, and the second pick reveals both', async ({
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
    await ensureTestCoachQuestions(supabaseAdmin);
    await clearPairDays(supabaseAdmin, pair);
    cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pair));

    await log.step('Both partners open /daily and see the same question');
    const partnerContext = await browser.newContext({
      storageState: getStorageStatePath({ ...authOptions, userIdentifier: partnerUserIdentifier }),
      baseURL,
    });
    // Closed before the clear above runs: the partner's page can still be sending.
    cleanup.defer('close the partner context', () => closeContext(partnerContext));
    const partnerPage = await partnerContext.newPage();

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

    const assignedTexts = await readPairQuestionTexts(supabaseAdmin, pair);
    expect(assignedTexts).toHaveLength(1);
    const [assigned] = assignedTexts;
    await expect(page.getByTestId('daily-question')).toHaveText(assigned);
    await expect(partnerPage.getByTestId('daily-question')).toHaveText(assigned);

    const thisText = await page.getByTestId('daily-option-this').innerText();
    const thatText = await page.getByTestId('daily-option-that').innerText();
    expect(assigned).toBe(`${thisText} or ${thatText}?`);

    await log.step('The worker sends This and sees the waiting screen');
    await expect(page.getByTestId('daily-partner-status')).toContainText("hasn't picked yet");
    await expect(page.getByTestId('daily-send-pick')).toBeDisabled();
    await page.getByTestId('daily-option-this').click();
    const ownPick = interceptNetworkCall({ method: 'POST', url: DAILY_PICK_SEND });
    await page.getByTestId('daily-send-pick').click();
    expect((await ownPick).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    await expect(page.getByTestId('daily-my-pick')).toHaveText(thisText);
    await expect(page.getByTestId('daily-my-pick-time')).toHaveText(/^\d{1,2}:\d{2}\s[AP]M$/);
    await expect(page.getByTestId('daily-option-this')).toHaveCount(0);

    await log.step('The worker reloads and still sees the waiting screen');
    const waitingRead = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.reload();
    expect((await waitingRead).status).toBe(200);
    await expect(page.getByTestId('daily-waiting')).toBeVisible();
    await expect(page.getByTestId('daily-my-pick')).toHaveText(thisText);
    await expect(page.getByTestId('daily-my-pick-time')).toHaveText(/^\d{1,2}:\d{2}\s[AP]M$/);
    await expect(page.getByTestId('daily-option-this')).toHaveCount(0);

    await log.step('The partner sees that a pick was made, and nothing of it');
    const partnerReload = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.reload();
    expect((await partnerReload).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-partner-status')).toContainText('has picked');
    await expect(partnerPage.getByTestId('daily-reveal')).toHaveCount(0);
    await expect(partnerPage.getByTestId('daily-reveal-partner')).toHaveCount(0);

    await log.step('The partner sends That and sees the reveal');
    await partnerPage.getByTestId('daily-option-that').click();
    const partnerPick = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_PICK_SEND,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.getByTestId('daily-send-pick').click();
    expect((await partnerPick).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-reveal')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-reveal-mine')).toHaveText(thatText);
    await expect(partnerPage.getByTestId('daily-reveal-partner')).toHaveText(thisText);
    await expect(partnerPage.getByTestId('daily-reveal-mark')).toHaveText('Different picks');

    await log.step('The partner reloads and still sees the reveal');
    const partnerRevealRead = observeOn({
      page: partnerPage,
      method: 'POST',
      url: DAILY_DAY_READ,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await partnerPage.reload();
    expect((await partnerRevealRead).status).toBe(200);
    await expect(partnerPage.getByTestId('daily-reveal')).toBeVisible();
    await expect(partnerPage.getByTestId('daily-reveal-mine')).toHaveText(thatText);
    await expect(partnerPage.getByTestId('daily-reveal-partner')).toHaveText(thisText);
    await expect(partnerPage.getByTestId('daily-reveal-mark')).toHaveText('Different picks');

    await log.step('The worker reloads and sees the same reveal');
    const reload = interceptNetworkCall({ method: 'POST', url: DAILY_DAY_READ });
    await page.reload();
    expect((await reload).status).toBe(200);
    await expect(page.getByTestId('daily-reveal')).toBeVisible();
    await expect(page.getByTestId('daily-reveal-mine')).toHaveText(thisText);
    await expect(page.getByTestId('daily-reveal-partner')).toHaveText(thatText);
    await expect(page.getByTestId('daily-reveal-mark')).toHaveText('Different picks');
  });
});
