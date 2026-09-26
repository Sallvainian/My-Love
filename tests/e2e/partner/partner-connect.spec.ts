/**
 * E2E: connecting two accounts from the Partner tab, end to end, unstubbed.
 *
 * The search goes through `find_partner_by_email`
 * (20260926000000_find_partner_by_email.sql), because the users SELECT policy
 * hides every unlinked account from every other one. Before it, the search
 * queried `public.users` directly and could never find anyone; the specs that
 * covered it stubbed the search response, so they passed anyway. This spec
 * stubs nothing: every answer below comes from the local stack.
 *
 * Accounts: four throwaway accounts, never the worker pool — a spec must not
 * link or unlink pool partners (AGENTS.md). A searches, B is found and accepts
 * in a second browser context, and C and D are linked to each other through the
 * real request/accept RPCs so that D's address is a "taken" answer. Each is
 * deleted at teardown through `cleanup`; the FKs cascade the requests and the
 * links.
 */
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { interceptNetworkCall as observeOn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { AppState } from '../../../src/stores/types';
import { test, expect } from '../../support/merged-fixtures';
import { closeContext } from '../../support/fixtures/cleanup';
import type { TypedSupabaseClient } from '../../support/factories';
import { navigateTo } from '../../support/helpers/navigation';
import { SECOND_CONTEXT_READ_TIMEOUT } from '../../support/helpers/reads';
import { createOutsiderClient, deleteOutsider } from '../../support/helpers/rls-security';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

const PARTNER_SEARCH = '**/rest/v1/rpc/find_partner_by_email';
const REQUEST_SEND = '**/rest/v1/partner_requests*';
const REQUEST_ACCEPT = '**/rest/v1/rpc/accept_partner_request';

const MISSING = "No account uses that email — check it's the one they sign in with.";
const TAKEN = 'That account is already connected with a partner.';

type Throwaway = Awaited<ReturnType<typeof createOutsiderClient>> & {
  email: string;
  name: string;
};

/**
 * A throwaway account with a chosen display name, so sign-in lands in the app
 * rather than on the name-setup screen. The name is written by the account
 * itself, through the same column grant the app's own name form uses.
 */
async function createThrowaway(
  supabaseAdmin: TypedSupabaseClient,
  cleanup: { defer: (label: string, fn: () => Promise<unknown>) => void },
  role: string
): Promise<Throwaway> {
  const tag = Math.random().toString(36).slice(2, 8);
  const account = await createOutsiderClient(supabaseAdmin, `connect-${role}-${tag}`);
  cleanup.defer(`delete throwaway account ${role}`, () => deleteOutsider(account));

  const { data, error: userError } = await account.client.auth.getUser();
  if (userError || !data.user?.email) throw new Error(`No email for ${role}: ${userError?.message}`);
  const name = `Connect ${role.toUpperCase()} ${tag}`;
  const { error } = await account.client
    .from('users')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', account.userId);
  if (error) throw new Error(`Failed to name ${role}: ${error.message}`);

  return { ...account, email: data.user.email, name };
}

/** Link two throwaway accounts the way the app does: a request, then accept. */
async function linkThroughRequest(from: Throwaway, to: Throwaway): Promise<void> {
  const { error: sendError } = await from.client
    .from('partner_requests')
    .insert({ from_user_id: from.userId, to_user_id: to.userId, status: 'pending' });
  if (sendError) throw new Error(`Failed to send the seed request: ${sendError.message}`);

  const { data: request, error: readError } = await to.client
    .from('partner_requests')
    .select('id')
    .eq('from_user_id', from.userId)
    .eq('to_user_id', to.userId)
    .single();
  if (readError || !request) throw new Error(`Seed request not visible: ${readError?.message}`);

  const { error: acceptError } = await to.client.rpc('accept_partner_request', {
    p_request_id: request.id,
  });
  if (acceptError) throw new Error(`Failed to accept the seed request: ${acceptError.message}`);
}

/** A context with no session: only the welcome-splash stamp, so Home renders at once. */
async function newBareContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173';
  return browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [{ name: 'lastWelcomeView', value: String(Date.now()) }],
        },
      ],
    },
  });
}

/** Sign in through the real login form and open the Partner tab. */
async function signInToPartnerTab(page: Page, account: Throwaway): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('app-container')).toBeVisible();
  await navigateTo(page, 'partner');
}

/** The store's partner id, read from the running app (observation only). */
async function storePartnerId(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const modulePath = '/src/stores/useAppStore.ts';
    const { useAppStore } = await import(modulePath);
    return (useAppStore.getState() as AppState).partner?.id ?? null;
  });
}

async function partnerIdOf(supabaseAdmin: TypedSupabaseClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('partner_id')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`Failed to read partner_id: ${error.message}`);
  return data.partner_id;
}

test.describe('Connecting with a partner', () => {
  // Signs in as its own throwaway accounts, not the worker's pool account.
  test.use({ authSessionEnabled: false });
  test.setTimeout(120_000);

  test('[P0] A finds B by exact email, B accepts, and each sees the other as partner', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    const c = await createThrowaway(supabaseAdmin, cleanup, 'c');
    const d = await createThrowaway(supabaseAdmin, cleanup, 'd');
    await linkThroughRequest(c, d);
    expect(await partnerIdOf(supabaseAdmin, d.userId)).toBe(c.userId);

    // ---- A: signed in, unlinked, on the Connect screen ----
    await page.addInitScript(() => {
      localStorage.setItem('lastWelcomeView', String(Date.now()));
    });
    await signInToPartnerTab(page, a);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })
    ).toBeVisible();
    const input = page.getByLabel("Your partner's email");
    const find = page.getByTestId('partner-search-submit');

    // A taken account: D already has a partner. The screen says so, offers no
    // request, and shows nothing about D.
    await input.fill(d.email);
    const takenSearch = interceptNetworkCall({ method: 'POST', url: PARTNER_SEARCH });
    await find.click();
    const taken = await takenSearch;
    expect(taken.status).toBe(200);
    expect(taken.responseJson).toEqual([{ id: null, display_name: null, is_taken: true }]);
    await expect(page.getByTestId('partner-search-taken')).toHaveText(TAKEN);
    await expect(page.getByRole('button', { name: /send request/i })).toHaveCount(0);
    await expect(page.getByTestId('partner-search-card')).not.toContainText(d.name);
    await expect(page.getByText(MISSING)).toHaveCount(0);

    // A part of B's address finds nobody: the match is exact. Still
    // email-shaped, so Find is enabled and the question reaches the server.
    await input.fill(b.email.slice(1));
    const partialSearch = interceptNetworkCall({ method: 'POST', url: PARTNER_SEARCH });
    await find.click();
    expect((await partialSearch).responseJson).toEqual([]);
    await expect(page.getByTestId('partner-search-empty')).toHaveText(MISSING);

    // B's exact address, typed in another case with stray spaces, finds B.
    await input.fill(`  ${b.email.toUpperCase()} `);
    const foundSearch = interceptNetworkCall({ method: 'POST', url: PARTNER_SEARCH });
    await find.click();
    const found = await foundSearch;
    expect(found.status).toBe(200);
    expect(found.responseJson).toEqual([{ id: b.userId, display_name: b.name, is_taken: false }]);
    const results = page.getByTestId('partner-search-results');
    await expect(results).toContainText(b.name);

    // ---- A sends the request ----
    const sent = interceptNetworkCall({ method: 'POST', url: REQUEST_SEND });
    await page.getByTestId(`send-request-${b.userId}`).click();
    expect((await sent).status).toBe(201);
    await expect(page.getByTestId('sent-requests-list')).toBeVisible();
    await expect(results).toHaveCount(0);

    const { data: request, error: requestError } = await supabaseAdmin
      .from('partner_requests')
      .select('id, status')
      .eq('from_user_id', a.userId)
      .eq('to_user_id', b.userId)
      .single();
    expect(requestError).toBeNull();
    expect(request!.status).toBe('pending');

    // ---- B, in a second browser, accepts ----
    const second = await newBareContext(browser, testInfo);
    cleanup.defer('close the second context', () => closeContext(second));
    const bPage = await second.newPage();
    await signInToPartnerTab(bPage, b);
    const accept = bPage.getByTestId(`accept-request-${request!.id}`);
    await expect(accept).toBeVisible();

    const accepted = observeOn({
      page: bPage,
      method: 'POST',
      url: REQUEST_ACCEPT,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await accept.click();
    const acceptResponse = await accepted;
    expect(acceptResponse.status).toBeGreaterThanOrEqual(200);
    expect(acceptResponse.status).toBeLessThan(300);

    // Server, then store, then screen.
    expect(await partnerIdOf(supabaseAdmin, b.userId)).toBe(a.userId);
    expect(await partnerIdOf(supabaseAdmin, a.userId)).toBe(b.userId);
    await expect.poll(() => storePartnerId(bPage)).toBe(a.userId);
    await expect(bPage.getByRole('heading', { level: 1, name: a.name })).toBeVisible();
    await expect(bPage.getByTestId('partner-search-card')).toHaveCount(0);

    // ---- A sees B as partner once the tab reloads its partner ----
    await page.reload();
    await navigateTo(page, 'partner');
    await expect.poll(() => storePartnerId(page)).toBe(b.userId);
    await expect(page.getByRole('heading', { level: 1, name: b.name })).toBeVisible();
    await expect(page.getByTestId('partner-search-card')).toHaveCount(0);
  });
});
