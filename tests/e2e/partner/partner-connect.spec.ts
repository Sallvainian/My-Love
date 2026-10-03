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
 * Accounts: throwaway accounts made by each test, never the worker pool — a
 * spec must not link or unlink pool partners (AGENTS.md). A searches and
 * sends, B is found and accepts in a second browser context, and in the
 * search test C and D are linked to each other through the real
 * request/accept RPCs so that D's address is a "taken" answer. Each is deleted
 * at teardown through `cleanup`; the FKs cascade the requests, the links, the
 * notes and the pokes.
 *
 * One behaviour per test: the search answers; the request reaching B and B's
 * accept linking both sides; love notes arriving live; pokes arriving live.
 * Nothing is reloaded after a link. In the accept and love-note tests A waits
 * on Love Notes while B accepts, the one screen that joined its channel and
 * loaded its thread with no partner; each note and poke arrives on the other
 * screen over Realtime, with no re-read on the receiving page.
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Page, Request, TestInfo } from '@playwright/test';
import {
  interceptNetworkCall as observeOn,
  type InterceptNetworkCallFn,
} from '@seontechnologies/playwright-utils/intercept-network-call';
import type { AppState } from '../../../src/stores/types';
import { test, expect } from '../../support/merged-fixtures';
import { closeContext, type Cleanup } from '../../support/fixtures/cleanup';
import type { TypedSupabaseClient } from '../../support/factories';
import { clockAnchor } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import {
  LOVE_NOTE_SEND,
  LOVE_NOTES_READ,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import { createOutsiderClient, deleteOutsider } from '../../support/helpers/rls-security';
import { dismissWelcomeSplashAt, WELCOME_SPLASH_KEY } from '../../support/helpers/welcome-splash';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

const PARTNER_SEARCH = '**/rest/v1/rpc/find_partner_by_email';
const REQUEST_SEND = '**/rest/v1/partner_requests*';
const PENDING_REQUESTS = '**/rest/v1/rpc/get_my_pending_partner_requests';
const REQUEST_ACCEPT = '**/rest/v1/rpc/accept_partner_request';
const INTERACTION_SEND = '**/rest/v1/interactions?*';
// The Partner tab's own read of the signed-in account's link
// (`partnerService.getPartner`); not in reads.ts.
const PARTNER_LOOKUP = '**/rest/v1/users?select=partner_id%2Cupdated_at*';

const NOTES_SUBSCRIBED_LOG = /\[useRealtimeMessages\].*SUBSCRIBED/;
const INTERACTIONS_SUBSCRIBED_LOG = /\[InteractionService\] Realtime subscription status: SUBSCRIBED/;

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

/** A pending request from `from` to `to`, sent as `from` itself; returns its id. */
async function seedRequest(from: Throwaway, to: Throwaway): Promise<string> {
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
  return request.id;
}

/** Link two throwaway accounts the way the app does: a request, then accept. */
async function linkThroughRequest(from: Throwaway, to: Throwaway): Promise<void> {
  const requestId = await seedRequest(from, to);
  const { error: acceptError } = await to.client.rpc('accept_partner_request', {
    p_request_id: requestId,
  });
  if (acceptError) throw new Error(`Failed to accept the seed request: ${acceptError.message}`);
}

/**
 * A context with no session: only the welcome-splash stamp, so Home renders at
 * once. It runs on a clock pinned to `anchor` and the stamp is that same
 * instant, so the splash's 60-minute window starts at a fixed time.
 */
async function newBareContext(
  browser: Browser,
  testInfo: TestInfo,
  anchor: Date
): Promise<BrowserContext> {
  const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:5173';
  const context = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [{ name: WELCOME_SPLASH_KEY, value: String(anchor.getTime()) }],
        },
      ],
    },
  });
  await context.clock.install({ time: anchor });
  return context;
}

/**
 * Put the first browser on the pinned clock and stamp its welcome splash from
 * the same instant, before its first navigation. Both browsers of a test run
 * on this one anchor (see `openSecondBrowser`).
 */
async function pinFirstBrowser(page: Page, anchor: Date): Promise<void> {
  await page.clock.install({ time: anchor });
  await dismissWelcomeSplashAt(page, anchor.getTime());
}

/** A second browser on the same pinned clock, closed at teardown. */
async function openSecondBrowser(
  browser: Browser,
  testInfo: TestInfo,
  cleanup: Cleanup,
  anchor: Date
): Promise<Page> {
  const second = await newBareContext(browser, testInfo, anchor);
  cleanup.defer('close the second context', () => closeContext(second));
  return second.newPage();
}

/** Sign in through the real login form and wait for the app. */
async function signIn(page: Page, account: Throwaway): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('app-container')).toBeVisible();
}

/**
 * Sign in through the real login form and open the Partner tab, once the tab's
 * partner lookup has answered: its heading renders before that read starts.
 */
async function signInToPartnerTab(page: Page, account: Throwaway): Promise<void> {
  await signIn(page, account);
  const partnerLookup = observeOn({
    page,
    method: 'GET',
    url: PARTNER_LOOKUP,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await navigateTo(page, 'partner');
  expect((await partnerLookup).status).toBe(200);
}

/**
 * Every GET a page starts to a table, and how many have settled. Delivery is
 * only proved live if no read of the thread (or the interaction history) is in
 * flight at the send and none starts until the item is on screen.
 */
function trackReads(page: Page, table: string) {
  const counts = { started: 0, settled: 0 };
  const isRead = (request: Request) =>
    request.method() === 'GET' && new URL(request.url()).pathname === `/rest/v1/${table}`;
  // playwright-utils deviation: counts every read a page starts and settles, to prove none is in flight and none follows; interceptNetworkCall's observe mode latches onto the first matching request only.
  page.on('request', (request) => {
    if (isRead(request)) counts.started += 1;
  });
  const settle = (request: Request) => {
    if (isRead(request)) counts.settled += 1;
  };
  // playwright-utils deviation: settles every read that answers or fails against the count above; interceptNetworkCall's observe mode latches onto the first matching request only.
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
  return counts;
}

/** Navigate by the dock and wait for the screen's own Realtime join to report SUBSCRIBED. */
async function openAndJoin(page: Page, view: 'notes' | 'partner', log: RegExp): Promise<void> {
  const joined = page.waitForEvent('console', {
    predicate: (message) => log.test(message.text()),
    timeout: 30_000,
  });
  await navigateTo(page, view);
  await joined;
}

/** Type `text` into the Connect screen's search, press Find, and return the search's answer. */
async function searchFor(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn,
  text: string
) {
  await page.getByLabel("Your partner's email").fill(text);
  const search = interceptNetworkCall({ method: 'POST', url: PARTNER_SEARCH });
  await page.getByTestId('partner-search-submit').click();
  return search;
}

/**
 * Open Love Notes while still unlinked: the chat joins its channel with no
 * partner and its thread load answers "Partner not configured". Returns the
 * page's thread-read counter, started before the screen opened.
 */
async function waitOnNotesUnlinked(page: Page) {
  const threadReads = trackReads(page, 'love_notes_visible');
  await openAndJoin(page, 'notes', NOTES_SUBSCRIBED_LOG);
  await expect(page.getByTestId('notes-error-banner')).toHaveText('Partner not configured');
  return threadReads;
}

/** B accepts `requestId` from its Partner tab, and the accept RPC succeeds. */
async function acceptFromPartnerTab(bPage: Page, requestId: string): Promise<void> {
  const accept = bPage.getByTestId(`accept-request-${requestId}`);
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

  test('[P0] the partner search answers taken, missing and found, by exact email only', async ({
    page,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    const c = await createThrowaway(supabaseAdmin, cleanup, 'c');
    const d = await createThrowaway(supabaseAdmin, cleanup, 'd');
    await linkThroughRequest(c, d);
    expect(await partnerIdOf(supabaseAdmin, d.userId)).toBe(c.userId);

    // ---- A: signed in, unlinked, on the Connect screen ----
    await pinFirstBrowser(page, clockAnchor());
    await signInToPartnerTab(page, a);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })
    ).toBeVisible();

    // A taken account: D already has a partner. The screen says so, offers no
    // request, and shows nothing about D.
    const taken = await searchFor(page, interceptNetworkCall, d.email);
    expect(taken.status).toBe(200);
    expect(taken.responseJson).toEqual([{ id: null, display_name: null, is_taken: true }]);
    await expect(page.getByTestId('partner-search-taken')).toHaveText(TAKEN);
    await expect(page.getByRole('button', { name: /send request/i })).toHaveCount(0);
    await expect(page.getByTestId('partner-search-card')).not.toContainText(d.name);
    await expect(page.getByText(MISSING)).toHaveCount(0);

    // A part of B's address finds nobody: the match is exact. Still
    // email-shaped, so Find is enabled and the question reaches the server.
    const partial = await searchFor(page, interceptNetworkCall, b.email.slice(1));
    expect(partial.responseJson).toEqual([]);
    await expect(page.getByTestId('partner-search-empty')).toHaveText(MISSING);

    // B's exact address, typed in another case with stray spaces, finds B.
    const found = await searchFor(page, interceptNetworkCall, `  ${b.email.toUpperCase()} `);
    expect(found.status).toBe(200);
    expect(found.responseJson).toEqual([{ id: b.userId, display_name: b.name, is_taken: false }]);
    await expect(page.getByTestId('partner-search-results')).toContainText(b.name);
  });

  test('[P0] A sends B a request, B accepts, and each sees the other as partner with no reload', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    // Both browsers run on one pinned clock, and both splash stamps are that
    // same instant.
    const anchor = clockAnchor();

    // ---- A: signed in, unlinked, finds B ----
    await pinFirstBrowser(page, anchor);
    await signInToPartnerTab(page, a);
    expect((await searchFor(page, interceptNetworkCall, b.email)).status).toBe(200);
    const results = page.getByTestId('partner-search-results');
    await expect(results).toContainText(b.name);

    // ---- A sends the request, and A's sent list names B ----
    // Every answer of the pending-requests read, in order: the tab's own mount
    // read waits on auth.getUser() first, so under load it can land after the
    // search, and a first-match wait would take it for the post-send reload.
    const pendingAnswers: unknown[] = [];
    // playwright-utils deviation: keeps every answer of a read that runs more than once, so the assertion can take the latest; interceptNetworkCall's observe mode latches onto the first matching request only.
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/rest/v1/rpc/get_my_pending_partner_requests') {
        void response.json().then((body: unknown) => pendingAnswers.push(body), () => {});
      }
    });
    const sent = interceptNetworkCall({ method: 'POST', url: REQUEST_SEND });
    await page.getByTestId(`send-request-${b.userId}`).click();
    expect((await sent).status).toBe(201);
    await expect(page.getByTestId('sent-requests-list')).toContainText(b.name);
    await recurseUntil(
      async () => pendingAnswers.at(-1),
      (v) => {
        expect(v).toEqual([
          expect.objectContaining({
            from_user_id: a.userId,
            to_user_id: b.userId,
            other_display_name: b.name,
            other_email: b.email,
          }),
        ]);
      }
    );
    await expect(page.getByText('Unknown User')).toHaveCount(0);
    await expect(results).toHaveCount(0);

    const { data: request, error: requestError } = await supabaseAdmin
      .from('partner_requests')
      .select('id, status')
      .eq('from_user_id', a.userId)
      .eq('to_user_id', b.userId)
      .single();
    expect(requestError).toBeNull();
    expect(request!.status).toBe('pending');

    // ---- A waits on Love Notes, still unlinked ----
    // The hardest place to be when the link lands: nothing on this screen
    // listens for the link itself.
    await waitOnNotesUnlinked(page);

    // ---- B, in a second browser, accepts ----
    const bPage = await openSecondBrowser(browser, testInfo, cleanup, anchor);
    const receivedList = observeOn({
      page: bPage,
      method: 'POST',
      url: PENDING_REQUESTS,
      timeout: SECOND_CONTEXT_READ_TIMEOUT,
    });
    await signInToPartnerTab(bPage, b);
    const bPending = await receivedList;
    expect(bPending.status).toBe(200);
    expect(bPending.responseJson).toEqual([
      expect.objectContaining({
        id: request!.id,
        from_user_id: a.userId,
        other_display_name: a.name,
        other_email: a.email,
      }),
    ]);
    // B's received list names A.
    await expect(bPage.getByTestId('received-requests-list')).toContainText(a.name);
    await expect(bPage.getByText('Unknown User')).toHaveCount(0);

    // A's thread load once A learns of the link.
    const aThreadAfterLink = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
    await acceptFromPartnerTab(bPage, request!.id);

    // Server, then store, then screen.
    expect(await partnerIdOf(supabaseAdmin, b.userId)).toBe(a.userId);
    expect(await partnerIdOf(supabaseAdmin, a.userId)).toBe(b.userId);
    await recurseUntil(
      () => storePartnerId(bPage),
      (v) => {
        expect(v).toBe(a.userId);
      }
    );
    await expect(bPage.getByRole('heading', { level: 1, name: a.name })).toBeVisible();
    await expect(bPage.getByTestId('partner-search-card')).toHaveCount(0);

    // ---- A, still on Love Notes and never reloaded, learns of the link ----
    // B's accept announces it on A's mood topic; App's listener re-reads the
    // partner, and the chat loads its thread and names B.
    await recurseUntil(
      () => storePartnerId(page),
      (v) => {
        expect(v).toBe(b.userId);
      }
    );
    expect((await aThreadAfterLink).status).toBe(200);
    await expect(page.getByTestId('notes-error-banner')).toHaveCount(0);
    await expect(page.getByTestId('notes-partner-row')).toContainText(b.name);
  });

  test('[P0] after B accepts, a love note reaches each side live, on a thread A joined unlinked', async ({
    page,
    browser,
    supabaseAdmin,
    interceptNetworkCall,
    cleanup,
  }, testInfo) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    const requestId = await seedRequest(a, b);
    const anchor = clockAnchor();

    // ---- A waits on Love Notes, unlinked, while B accepts ----
    await pinFirstBrowser(page, anchor);
    await signIn(page, a);
    const aThreadReads = await waitOnNotesUnlinked(page);

    const bPage = await openSecondBrowser(browser, testInfo, cleanup, anchor);
    await signInToPartnerTab(bPage, b);
    const aThreadAfterLink = interceptNetworkCall({ method: 'GET', url: LOVE_NOTES_READ });
    await acceptFromPartnerTab(bPage, requestId);
    await recurseUntil(
      () => storePartnerId(page),
      (v) => {
        expect(v).toBe(b.userId);
      }
    );
    expect((await aThreadAfterLink).status).toBe(200);

    // ---- Love notes, each way, live ----
    const bThreadReads = trackReads(bPage, 'love_notes_visible');
    await openAndJoin(bPage, 'notes', NOTES_SUBSCRIBED_LOG);

    await sendNoteAndSeeItArrive(bPage, page, aThreadReads, `From B ${randomUUID()}`);
    await sendNoteAndSeeItArrive(page, bPage, bThreadReads, `From A ${randomUUID()}`);
  });

  test('[P0] a poke reaches each linked partner live', async ({
    page,
    browser,
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    const a = await createThrowaway(supabaseAdmin, cleanup, 'a');
    const b = await createThrowaway(supabaseAdmin, cleanup, 'b');
    await linkThroughRequest(a, b);
    const anchor = clockAnchor();

    await pinFirstBrowser(page, anchor);
    await signIn(page, a);
    const bPage = await openSecondBrowser(browser, testInfo, cleanup, anchor);
    await signIn(bPage, b);

    // ---- A poke, each way, live ----
    const aHistoryReads = trackReads(page, 'interactions');
    const bHistoryReads = trackReads(bPage, 'interactions');
    await Promise.all([
      openAndJoin(page, 'partner', INTERACTIONS_SUBSCRIBED_LOG),
      openAndJoin(bPage, 'partner', INTERACTIONS_SUBSCRIBED_LOG),
    ]);
    await expect(page.getByRole('heading', { level: 1, name: b.name })).toBeVisible();

    await pokeAndSeeItArrive(page, bPage, bHistoryReads);
    await pokeAndSeeItArrive(bPage, page, aHistoryReads);
  });
});

/**
 * Send a note from `from` through the real input, and see it on `to` with no
 * thread read on `to` in flight at the send or started after it.
 */
async function sendNoteAndSeeItArrive(
  from: Page,
  to: Page,
  toReads: { started: number; settled: number },
  text: string
): Promise<void> {
  await recurseUntil(
    async () => toReads.started - toReads.settled,
    (v) => {
      expect(v).toBe(0);
    },
    { timeout: 15_000 }
  );
  const readsBefore = toReads.started;
  await from.getByLabel(/love note message input/i).fill(text);
  const saved = observeOn({
    page: from,
    method: 'POST',
    url: LOVE_NOTE_SEND,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await from.getByLabel(/send message/i).click();
  expect((await saved).status).toBe(201);

  await expect(to.getByTestId('love-note-message').filter({ hasText: text })).toBeVisible();
  expect(toReads.started, 'the note arrived over Realtime, not a thread re-read').toBe(readsBefore);
}

/**
 * Poke from `from`, and see the unviewed badge on `to` with no history read on
 * `to` in flight at the send or started after it.
 */
async function pokeAndSeeItArrive(
  from: Page,
  to: Page,
  toReads: { started: number; settled: number }
): Promise<void> {
  await recurseUntil(
    async () => toReads.started - toReads.settled,
    (v) => {
      expect(v).toBe(0);
    },
    { timeout: 15_000 }
  );
  const readsBefore = toReads.started;
  await expect(to.getByTestId('notification-badge')).toHaveCount(0);
  const sent = observeOn({
    page: from,
    method: 'POST',
    url: INTERACTION_SEND,
    timeout: SECOND_CONTEXT_READ_TIMEOUT,
  });
  await from.getByTestId('poke-button').click();
  expect((await sent).status).toBe(201);

  await expect(to.getByTestId('notification-badge')).toHaveText('1');
  expect(toReads.started, 'the poke arrived over Realtime, not a history re-read').toBe(readsBefore);
}
