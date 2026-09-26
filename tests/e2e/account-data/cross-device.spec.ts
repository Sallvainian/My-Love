import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { AppState } from '../../../src/stores/types';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import type { TypedSupabaseClient } from '../../support/factories';
import { test, expect } from '../../support/merged-fixtures';
import type { Cleanup } from '../../support/fixtures/cleanup';
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

type AccountTable = 'message_favorites' | 'custom_messages' | 'anniversaries';

async function favoritedTexts(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    const state = useAppStore.getState() as AppState;
    const ids = new Set(state.messageHistory.favoriteIds);
    return state.messages.filter((message) => ids.has(message.id)).map((message) => message.text);
  });
}

async function resolveWorkerAccount(
  supabaseAdmin: TypedSupabaseClient
): Promise<{ email: string; userId: string }> {
  const pair = getWorkerPairEmails();
  if (!pair) throw new Error('This test requires its worker-owned account pair');
  const { data: account, error: accountError } = await supabaseAdmin
    .from('users').select('id').eq('email', pair.user1Email).single();
  if (accountError || !account) throw new Error(`No user row for this worker account: ${accountError?.message}`);
  return { email: pair.user1Email, userId: account.id };
}

// This worker account's own rows only, in the one table a test writes: cleared
// before the test so a re-run is valid, and again at teardown.
async function clearTable(supabaseAdmin: TypedSupabaseClient, table: AccountTable, userId: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq('user_id', userId);
  expect(error, `clearing ${table} for this worker account`).toBeNull();
}

/**
 * Clear `table` at teardown, after both contexts are closed: either one can
 * still be writing when a test times out, and a write that lands after the
 * clear would leak into the next run.
 */
function deferTeardown(
  cleanup: Cleanup,
  page: Page,
  second: BrowserContext,
  clear: () => Promise<void>
) {
  cleanup.defer('clear the table', clear);
  cleanup.defer('close the first page', () => page.close());
  cleanup.defer('close the second context', () => second.close());
}

// Nothing but the welcome-splash timestamp: no session, no mirrors.
async function newBareContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173';
  return browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(baseURL).origin,
        localStorage: [{ name: 'lastWelcomeView', value: String(Date.now()) }],
      }],
    },
  });
}

// ---- Second context: same account, nothing local ----
async function signInFresh(second: BrowserContext, email: string): Promise<Page> {
  const fresh = await second.newPage();
  await fresh.goto('/');
  await fresh.getByLabel('Email', { exact: true }).fill(email);
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
  return fresh;
}

test.describe('Account data follows the account, not the browser', () => {
  test.setTimeout(120_000);

  test('[P1] a favorite made in one context appears in a fresh one', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const { email, userId } = await resolveWorkerAccount(supabaseAdmin);
    await clearTable(supabaseAdmin, 'message_favorites', userId);
    const second = await newBareContext(browser, testInfo);
    deferTeardown(cleanup, page, second, () =>
      clearTable(supabaseAdmin, 'message_favorites', userId)
    );

    // ---- First context: favorite through the UI ----
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

    const fresh = await signInFresh(second, email);

    await recurseUntil(
      () => favoritedTexts(fresh),
      (v) => {
        expect(v).toContain(favoriteText);
      }
    );
  });

  test('[P1] a custom message made in one context appears in a fresh one', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const { email, userId } = await resolveWorkerAccount(supabaseAdmin);
    await clearTable(supabaseAdmin, 'custom_messages', userId);
    const customText = `Cross-device custom message ${testInfo.workerIndex}-${Date.now()}`;
    const second = await newBareContext(browser, testInfo);
    deferTeardown(cleanup, page, second, () =>
      clearTable(supabaseAdmin, 'custom_messages', userId)
    );

    // ---- First context: create through the UI ----
    await page.goto('/admin');
    await page.getByTestId('admin-create-button').click();
    await page.getByTestId('admin-create-form-text').fill(customText);
    const customSaved = interceptNetworkCall({ method: 'POST', url: CUSTOM_MESSAGE_SAVE });
    await page.getByTestId('admin-create-form-save').click();
    expect((await customSaved).status).toBe(201);
    await expect(page.getByTestId('message-row-text').filter({ hasText: customText })).toBeVisible();

    const fresh = await signInFresh(second, email);

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
  });

  test('[P1] an anniversary made in one context appears in a fresh one', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const { email, userId } = await resolveWorkerAccount(supabaseAdmin);
    await clearTable(supabaseAdmin, 'anniversaries', userId);
    const anniversaryLabel = `Cross-device anniversary ${testInfo.workerIndex}-${Date.now()}`;
    const second = await newBareContext(browser, testInfo);
    deferTeardown(cleanup, page, second, () =>
      clearTable(supabaseAdmin, 'anniversaries', userId)
    );

    // ---- First context: add through the UI ----
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Add Anniversary' }).click();
    const anniversaryForm = page.getByRole('dialog', { name: 'Add Anniversary' });
    await anniversaryForm.getByLabel('Label').fill(anniversaryLabel);
    await anniversaryForm.getByLabel('Date').fill('2024-02-14');
    const anniversarySaved = interceptNetworkCall({
      method: 'POST',
      url: '**/rest/v1/anniversaries*',
    });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    expect((await anniversarySaved).status).toBe(201);
    await expect(page.getByRole('heading', { level: 4, name: anniversaryLabel })).toBeVisible();

    const fresh = await signInFresh(second, email);

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
    await expect(fresh.getByRole('heading', { level: 4, name: anniversaryLabel })).toBeVisible();
  });
});
