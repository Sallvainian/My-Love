import type { Page } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { AppState } from '../../../src/stores/types';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { test, expect } from '../../support/merged-fixtures';
import {
  ANNIVERSARIES_READ,
  CUSTOM_MESSAGE_SAVE,
  CUSTOM_MESSAGES_READ,
  FAVORITES_READ,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

// Anniversaries, favorites and custom messages now live in Supabase, with the
// browser's copies as read mirrors. A second browser context has none of the
// first one's localStorage or IndexedDB, so everything it shows for these three
// came from the server. Store reads below are observation only; every write
// goes through the UI.

const ACCOUNT_TABLES = ['message_favorites', 'custom_messages', 'anniversaries'] as const;

async function favoritedTexts(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    const state = useAppStore.getState() as AppState;
    const ids = new Set(state.messageHistory.favoriteIds);
    return state.messages.filter((message) => ids.has(message.id)).map((message) => message.text);
  });
}

test.describe('Account data follows the account, not the browser', () => {
  test.setTimeout(120_000);

  test('[P1] a favorite, a custom message and an anniversary made in one context appear in a fresh one', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
  }, testInfo) => {
    const pair = getWorkerPairEmails();
    if (!pair) throw new Error('This test requires its worker-owned account pair');
    const { data: account, error: accountError } = await supabaseAdmin
      .from('users').select('id').eq('email', pair.user1Email).single();
    if (accountError || !account) throw new Error(`No user row for this worker account: ${accountError?.message}`);
    const userId = account.id;
    // This worker account's own rows only: start clean so a re-run is valid.
    // Hard before the test, so it never runs on leftover rows; soft in the
    // teardown, so every table is attempted and the test's own error stands.
    const clear = async ({ soft }: { soft: boolean }) => {
      for (const table of ACCOUNT_TABLES) {
        const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
        const message = `clearing ${table} for this worker account`;
        (soft ? expect.soft(error, message) : expect(error, message)).toBeNull();
      }
    };
    await clear({ soft: false });

    const stamp = `${testInfo.workerIndex}-${Date.now()}`;
    const customText = `Cross-device custom message ${stamp}`;
    const anniversaryLabel = `Cross-device anniversary ${stamp}`;
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173';
    // Nothing but the welcome-splash timestamp: no session, no mirrors.
    const second = await browser.newContext({
      baseURL,
      storageState: {
        cookies: [],
        origins: [{
          origin: new URL(baseURL).origin,
          localStorage: [{ name: 'lastWelcomeView', value: String(Date.now()) }],
        }],
      },
    });

    try {
      // ---- First context: make one of each through the UI ----
      // The favorites read of the mirror refresh App runs on every signed-in start.
      const refreshed = interceptNetworkCall({ method: 'GET', url: FAVORITES_READ });
      await page.goto('/');
      const favorite = page.getByTestId('message-favorite-button');
      await expect(favorite).toHaveAccessibleName('Add to favorites');
      expect((await refreshed).status).toBe(200);
      const favoriteText = (await page.getByTestId('message-text').textContent())?.trim();
      expect(favoriteText).toBeTruthy();

      const favoriteSaved = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/message_favorites*',
      });
      await favorite.click();
      expect((await favoriteSaved).status).toBe(201);
      await expect(favorite).toHaveAccessibleName('Remove from favorites');

      await page.goto('/admin');
      await page.getByTestId('admin-create-button').click();
      await page.getByTestId('admin-create-form-text').fill(customText);
      const customSaved = interceptNetworkCall({ method: 'POST', url: CUSTOM_MESSAGE_SAVE });
      await page.getByTestId('admin-create-form-save').click();
      expect((await customSaved).status).toBe(201);
      await expect(page.getByTestId('message-row-text').filter({ hasText: customText })).toBeVisible();

      await page.goto('/settings');
      await page.getByRole('button', { name: 'Add Anniversary' }).click();
      await page.locator('#anniversary-label').fill(anniversaryLabel);
      await page.locator('#anniversary-date').fill('2024-02-14');
      const anniversarySaved = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/anniversaries*',
      });
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      expect((await anniversarySaved).status).toBe(201);
      await expect(page.getByText(anniversaryLabel)).toBeVisible();

      // ---- Second context: same account, nothing local ----
      const fresh = await second.newPage();
      await fresh.goto('/');
      await fresh.getByLabel('Email', { exact: true }).fill(pair.user1Email);
      await fresh.getByTestId('password-input').fill(TEST_USER_PASSWORD);
      const freshRefreshed = observeOn({
        page: fresh,
        method: 'GET',
        url: FAVORITES_READ,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await fresh.getByTestId('submit-button').click();
      await expect(fresh.getByTestId('app-container')).toBeVisible();
      expect((await freshRefreshed).status).toBe(200);

      await recurseUntil(
        () => favoritedTexts(fresh),
        (v) => {
          expect(v).toContain(favoriteText);
        }
      );

      const customRead = observeOn({
        page: fresh,
        method: 'GET',
        url: CUSTOM_MESSAGES_READ,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await fresh.goto('/admin');
      const customRows = await customRead;
      expect(customRows.status).toBe(200);
      expect(customRows.responseJson).toEqual([expect.objectContaining({ text: customText })]);
      await expect(fresh.getByTestId('message-row-text').filter({ hasText: customText })).toBeVisible();

      const anniversaryRead = observeOn({
        page: fresh,
        method: 'GET',
        url: ANNIVERSARIES_READ,
        timeout: SECOND_CONTEXT_READ_TIMEOUT,
      });
      await fresh.goto('/settings');
      const anniversaryRows = await anniversaryRead;
      expect(anniversaryRows.status).toBe(200);
      expect(anniversaryRows.responseJson).toEqual([
        expect.objectContaining({ label: anniversaryLabel }),
      ]);
      await expect(fresh.getByText(anniversaryLabel)).toBeVisible();
    } finally {
      // A close that rejects must not skip the clear below.
      await second.close().catch(() => {});
      await page.close().catch(() => {});
      await clear({ soft: true });
    }
  });
});
