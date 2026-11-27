/**
 * E2E: Settings > Notifications shows three daily switches, and no request names the two
 * removed columns (story 11.2, criteria 4 and 6).
 *
 * The Notifications page renders only where `hasNativePush()` is true, so a browser never
 * reaches it through Settings (`push-switches-web.spec.ts` keeps that). The harness mounts the
 * real `NotificationsPage`, store, `supabase` client and CSS for the pool account whose
 * session the fixture already holds, so the requests below are the ones the iOS shell makes.
 *
 * Every `/rest/v1/push_preferences` request is recorded from before the navigation, because
 * the page loads the switches when it mounts.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';

const HARNESS = '/tests/support/harnesses/notifications-page.html';

const DAILY_SWITCHES = [
  ['settings-push-nudges', 'Nudges', 'dailyNudge'],
  ['settings-push-evening-reminder', 'Evening reminder', 'dailyReminder'],
  ['settings-push-both-answered', 'Both answered', 'dailyBothAnswered'],
] as const;

/** `daily_question` as a whole word, so `daily_questions` (the questions table) does not match. */
const REMOVED_QUESTION_COLUMN = /\bdaily_question\b/;
const REMOVED_PICKED_COLUMN = /\bdaily_partner_picked\b/;

interface PreferenceRequest {
  method: string;
  url: string;
  body: string;
}

function isPreferencesRequest(url: string): boolean {
  return new URL(url).pathname === '/rest/v1/push_preferences';
}

async function storedSwitch(page: Page, key: string): Promise<boolean | undefined> {
  return page.evaluate((name) => window.__notificationsPage?.preferences()?.[name as 'dailyNudge'], key);
}

test.describe('Settings > Notifications: the daily switches', () => {
  test('[P1] shows Nudges, Evening reminder and Both answered, and no request names the two removed columns', async ({
    page,
  }) => {
    // Attached before the navigation: the page reads the switches as it mounts.
    const requests: PreferenceRequest[] = [];
    page.on('request', (request) => {
      if (isPreferencesRequest(request.url())) {
        requests.push({ method: request.method(), url: request.url(), body: request.postData() ?? '' });
      }
    });

    await page.goto(HARNESS);
    const notificationsPage = page.getByTestId('settings-notifications');
    await expect(notificationsPage).toBeVisible();
    expect(await page.evaluate(() => window.__notificationsPageError)).toBeUndefined();
    const notifyGroup = page.getByRole('region', { name: 'Notify me about' });
    await expect(notifyGroup).toBeVisible();

    // The load settled: the store holds the account's switches and the rows are enabled.
    await expect
      .poll(() => page.evaluate(() => window.__notificationsPage?.preferences() !== null))
      .toBe(true);
    await expect(page.getByTestId('settings-push-nudges')).toBeEnabled();

    // THEN the daily switches are exactly Nudges, Evening reminder and Both answered, in that
    // order, after the six switches the earlier epics added; New question and Partner picked are gone.
    const ids = await notifyGroup.getByRole('switch').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid')));
    expect(ids.slice(-3)).toEqual(DAILY_SWITCHES.map(([id]) => id));
    expect(ids).toHaveLength(9);
    for (const [id, label] of DAILY_SWITCHES) {
      await expect(page.getByTestId(id)).toHaveAccessibleName(label);
    }
    await expect(page.getByRole('switch', { name: 'New question' })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Partner picked' })).toHaveCount(0);
    await expect(page.getByTestId('settings-push-new-question')).toHaveCount(0);
    await expect(page.getByTestId('settings-push-partner-picked')).toHaveCount(0);

    // WHEN each of the three is turned off and on again (the account's own row ends as it began).
    for (const [id, , key] of DAILY_SWITCHES) {
      const row = page.getByTestId(id);
      const original = (await row.getAttribute('aria-checked')) === 'true';
      expect(await storedSwitch(page, key)).toBe(original);
      try {
        for (const next of [!original, original]) {
          // The response first, then the store, then the UI.
          const saved = page.waitForResponse(
            (response) =>
              isPreferencesRequest(response.url()) &&
              response.request().method() === 'POST' &&
              response.ok() &&
              (response.request().postData() ?? '').includes(`"${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}":${next}`)
          );
          await row.click();
          await saved;
          await expect.poll(() => storedSwitch(page, key)).toBe(next);
          await expect(row).toHaveAttribute('aria-checked', String(next));
          await expect(row).toBeEnabled();
        }
      } finally {
        // Best effort: a failed step must not leave the pool account's switch flipped.
        if ((await row.getAttribute('aria-checked').catch(() => null)) === String(!original)) {
          await row.click().catch(() => undefined);
          await page.waitForResponse((response) => isPreferencesRequest(response.url())).catch(() => undefined);
        }
      }
    }

    // THEN no request the page made, on load or on a save, names either removed column.
    const reads = requests.filter((request) => request.method === 'GET');
    const writes = requests.filter((request) => request.method === 'POST');
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(writes).toHaveLength(DAILY_SWITCHES.length * 2);
    for (const request of requests) {
      const text = `${request.url}\n${decodeURIComponent(request.url)}\n${request.body}`;
      expect(text, `${request.method} ${request.url}`).not.toMatch(REMOVED_QUESTION_COLUMN);
      expect(text, `${request.method} ${request.url}`).not.toMatch(REMOVED_PICKED_COLUMN);
    }
    // The select names the ten columns the app maps, and the read-back of a save names the same ten.
    for (const request of [...reads, ...writes]) {
      expect(decodeURIComponent(new URL(request.url).searchParams.get('select') ?? '').split(',')).toHaveLength(10);
    }
  });
});
