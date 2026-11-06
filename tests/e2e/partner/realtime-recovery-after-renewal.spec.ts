/**
 * DW-378 / DW-391: browser-level proof that Realtime recovers on its own when
 * the app boots on a stored session the SDK cannot use, and the token renews
 * later.
 *
 * The state: the stored session's `expires_at` is past, and the refresh
 * endpoint cannot be reached. The SDK retries for about 25 s, then reports
 * `INITIAL_SESSION` with no session and the app carries on with the stored
 * one (`sessionService.ts`: "INITIAL_SESSION carried no session; using the
 * stored one"). Realtime joins with the publishable key, and the SDK sits in a
 * 60 s cooldown after the failed refresh. Once the endpoint answers again the
 * token renews (`TOKEN_REFRESHED`, about 85-115 s after load) and the live
 * feeds have to recover without a reload:
 *
 *  - pokes (`interactionService` + `interactionsSlice`): the public channel
 *    never fires a second SUBSCRIBED after the token swap, so the partner
 *    snapshot stayed null and every live poke was refused as "from no partner".
 *    The poke is sent only once the server has confirmed row delivery to the
 *    renewed identity and the history re-read that confirmation starts has
 *    settled, so the badge can only come from the live row;
 *  - love notes (`useRealtimeMessages`): the feed gives up while the token is
 *    stale and is re-armed by the renewal;
 *  - a partner's daily pick on the Daily screen (`useDailyPickListener` over
 *    the partner-event registry in `moodSyncService`). The screen mounts its
 *    subscriber at boot, so the registry opens its channel on a token it cannot
 *    use: the join is refused and the SDK rejoins the errored channel with the
 *    renewed token, whose `SUBSCRIBED` also re-reads the day. After that the
 *    partner picks through the real UI, and "has picked" has to appear with no
 *    reload and no new `get_daily_day` read, only the `get_daily_day_by_id`
 *    re-read the `daily_pick` broadcast asks for.
 *
 * The poke screen only mounts its tiles once it knows the partner, which a
 * cold stale boot never does, so that context saves the partner local copy on
 * a valid session first and is then expired and reloaded.
 *
 * Three receiving contexts, one per screen, each signed in as the worker's
 * user from a fresh `signInWithPassword` session. The worker's shared storage
 * state is deliberately not reused: a refresh rotates its refresh token and can
 * revoke the session family other specs in the worker rely on. Each context
 * gets its own session, so the three refreshes cannot rotate one another's
 * token either. The server sessions are left to expire; a sign-out would
 * default to the global scope and revoke the worker's shared one.
 *
 * The sender is the worker's partner, from the ordinary partner storage state,
 * through the real UI for the daily pick and the note; the poke is an admin
 * insert, as in `interactions-offline-copy.spec.ts`.
 *
 * Nothing here links, unlinks or resets an account. Teardown deletes only the
 * rows carrying this test's own text or id, and clears the pair's days, which a
 * day left behind would fix for the next run.
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Page, Response } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { log } from '@seontechnologies/playwright-utils';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
import { test, expect } from '../../support/merged-fixtures';
import { getWorkerPairEmails } from '../../support/auth/worker-pool';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';
import { closeContext, type Cleanup } from '../../support/fixtures/cleanup';
import { createInteractionInsert } from '../../support/factories/interaction-record-ownership';
import { clearPairDays, ensureTestCoachQuestions } from '../../support/factories/daily-question';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { resolveOwnPair } from '../../support/helpers/events';
import { DAILY_DAY_BY_ID_READ, DAILY_DAY_READ, DAILY_PICK_SEND } from '../../support/helpers/reads';
import { savedLocalCopy } from '../../support/helpers/local-copy';
import { recurseUntil } from '../../support/helpers/recurse';
import {
  MOOD_SUBSCRIBED_LOG,
  type ReadTracker,
  trackReads,
} from '../../support/helpers/request-tracker';
import { deleteRowById } from '../../support/helpers/teardown';
import { dismissWelcomeSplash } from '../../support/helpers/welcome-splash';

/** The SDK's token refresh, the only request the test cuts off. */
const REFRESH_ROUTE = '**/auth/v1/token?grant_type=refresh_token*';

const isRefreshResponse = (response: Response) =>
  response.url().includes('/auth/v1/token') &&
  response.url().includes('grant_type=refresh_token') &&
  response.status() === 200;

/** `sessionService.ts`: the app gave up waiting and uses the stored session. */
const STORED_SESSION_WARNING = 'INITIAL_SESSION carried no session; using the stored one';

/** `interactionService`: the server confirmed the poke channel's row delivery. */
const POKES_ARMED_LOG = /\[InteractionService\] postgres_changes subscription confirmed/;

/** `useRealtimeMessages` reporting a join, as the sibling realtime specs read it. */
const NOTES_SUBSCRIBED_LOG = /\[useRealtimeMessages\].*SUBSCRIBED/;

/** Past `expires_at` by more than the SDK's 90 s expiry margin. */
const EXPIRED_BY_SECONDS = 120;

/** From load to the renewal: ~25 s of init retries, the 60 s cooldown, a 30 s tick. */
const RENEWAL_TIMEOUT_MS = 240_000;

/** The broadcast REST endpoint for one topic and event (`httpSend`). */
const broadcastPath = (topic: string, event: string) =>
  `/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/${encodeURIComponent(event)}`;

type StoredSession = Record<string, unknown> & { expires_at?: number };

/** A fresh server session for the worker's own user, never the shared one. */
async function signInFresh(email: string): Promise<StoredSession> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY are unset; is the local stack running?');
  }
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_USER_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signInWithPassword failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return data.session as unknown as StoredSession;
}

type ReceivingPage = {
  context: BrowserContext;
  page: Page;
  /** The warning that says the app gave up waiting and uses the stored session. */
  storedSessionWarning: Promise<unknown>;
  /** Resolves with the 200 that renews this context's token. */
  armRenewal: () => Promise<Response>;
  /** What `onPage` returned: attached before the page's first load. */
  reads: ReadTracker | null;
};

const storageKey = () =>
  `sb-${new URL(process.env.SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;

/** The partner the poke screen checks incoming rows against (`interactionPartnerId`). */
const partnerSnapshot = (page: Page) =>
  page.evaluate(() => window.__APP_STORE__?.getState().interactionPartnerId ?? null);

const pastExpiry = () => Math.floor(Date.now() / 1000) - EXPIRED_BY_SECONDS;

/**
 * A context signed in as `email` on a fresh server session, stored with
 * `expires_at` as given.
 */
async function newReceivingContext(
  browser: Browser,
  baseURL: string,
  email: string,
  expiresAt: number | null
): Promise<BrowserContext> {
  const session = await signInFresh(email);
  const stored: StoredSession = expiresAt === null ? session : { ...session, expires_at: expiresAt };
  return browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            { name: storageKey(), value: JSON.stringify(stored) },
            { name: 'lastWelcomeView', value: Date.now().toString() },
          ],
        },
      ],
    },
  });
}

function receivingPage(context: BrowserContext, page: Page, reads: ReadTracker | null): ReceivingPage {
  return {
    context,
    page,
    reads,
    // Armed before the navigation that logs it, once, mid-boot.
    storedSessionWarning: page.waitForEvent('console', {
      predicate: (message) => message.text().includes(STORED_SESSION_WARNING),
      timeout: 90_000,
    }),
    armRenewal: () => page.waitForResponse(isRefreshResponse, { timeout: RENEWAL_TIMEOUT_MS }),
  };
}

/**
 * A context that boots signed in on an expired stored session, with the refresh
 * endpoint cut off, and the page open on `path`.
 */
async function bootExpired(
  browser: Browser,
  cleanup: Cleanup,
  baseURL: string,
  email: string,
  path: string,
  trackedPath?: string,
  trackedMethod?: 'GET' | 'POST'
): Promise<ReceivingPage> {
  const context = await newReceivingContext(browser, baseURL, email, pastExpiry());
  // Registered at once, so a boot that fails later still closes its context.
  cleanup.defer('close a receiving context', () => closeContext(context));
  // Before any page exists, so the very first refresh attempt is cut off.
  await context.route(REFRESH_ROUTE, (route) => route.abort());
  const page = await context.newPage();
  await dismissWelcomeSplash(page);
  const reads = trackedPath ? trackReads(page, trackedPath, trackedMethod) : null;
  const receiving = receivingPage(context, page, reads);
  await page.goto(path);
  return receiving;
}

/**
 * The partner screen only mounts the poke tiles once it knows the partner, and
 * a cold boot that cannot read the server never does: it shows "Couldn't load
 * your partner". The partner is kept as a local copy, so this context first
 * opens the screen on a valid session to save it, then expires the stored
 * session, cuts the refresh off and reloads: the app boots with the partner
 * from its copy and a session it cannot use.
 */
async function bootExpiredWithSavedPartner(
  browser: Browser,
  cleanup: Cleanup,
  baseURL: string,
  email: string,
  path: string,
  trackedTable: string
): Promise<ReceivingPage> {
  const context = await newReceivingContext(browser, baseURL, email, null);
  cleanup.defer('close a receiving context', () => closeContext(context));
  const page = await context.newPage();
  await dismissWelcomeSplash(page);
  // Before the first load and the reload after it, so no read goes unseen.
  const reads = trackReads(page, trackedTable);
  await page.goto(path);
  await expect(page.getByTestId('poke-kiss-interface')).toBeVisible();
  await recurseUntil(
    () => savedLocalCopy<{ status: string }>(page, 'partner'),
    (copy) => {
      expect(copy?.status, 'the partner local copy is saved').toBe('linked');
    }
  );

  await context.route(REFRESH_ROUTE, (route) => route.abort());
  await page.evaluate(
    ({ key, expiresAt }) => {
      const stored = JSON.parse(localStorage.getItem(key)!);
      localStorage.setItem(key, JSON.stringify({ ...stored, expires_at: expiresAt }));
    },
    { key: storageKey(), expiresAt: pastExpiry() }
  );
  const receiving = receivingPage(context, page, reads);
  await page.reload();
  return receiving;
}

test.describe('Realtime recovery after the token renews', () => {
  // Boot-to-renewal alone is ~85-115 s, run once for all three contexts
  // together; the rest are bounded waits on top of it.
  test.describe.configure({ timeout: 300_000 });

  test(
    '[P1] DW-378-E2E-001 a poke, a daily pick and a note arrive live after an expired session renews',
    async ({
      browser,
      baseURL,
      supabaseAdmin,
      authOptions,
      partnerUserIdentifier,
      partnerAuthToken,
      cleanup,
    }) => {
      // Depended on for its side effect: it writes the partner's storage-state
      // file read below.
      expect(partnerAuthToken).not.toBe('');
      const origin = baseURL!;
      const pair = getWorkerPairEmails();
      if (!pair) throw new Error('no worker identity (TEST_PARALLEL_INDEX unset)');
      const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
      const pairIds = await resolveWorkerPairIds(supabaseAdmin);

      const noteText = `DW-378 renewal note ${randomUUID()}`;

      // A day left behind would fix the question and the picks the next run
      // starts from; the pick this test sends is gone with its day.
      await ensureTestCoachQuestions(supabaseAdmin);
      await clearPairDays(supabaseAdmin, pairIds);
      cleanup.defer("clear the pair's daily days", () => clearPairDays(supabaseAdmin, pairIds));

      let noteRowCommitted = false;
      cleanup.defer('delete the note row this test created', async () => {
        const { data, error } = await supabaseAdmin
          .from('love_notes')
          .delete()
          .eq('content', noteText)
          .in('from_user_id', [userId, partnerId])
          .select('id');
        if (error) throw error;
        if (noteRowCommitted) {
          expect.soft(data ?? [], 'Teardown must delete exactly the one note row').toHaveLength(1);
        }
      });

      await log.step('Boot three receiving contexts on an expired session, refresh cut off');
      const [daily, partner, notes] = await Promise.all([
        bootExpired(
          browser,
          cleanup,
          origin,
          pair.user1Email,
          '/daily',
          '/rest/v1/rpc/get_daily_day',
          'POST'
        ),
        bootExpiredWithSavedPartner(
          browser,
          cleanup,
          origin,
          pair.user1Email,
          '/partner',
          '/rest/v1/interactions'
        ),
        bootExpired(browser, cleanup, origin, pair.user1Email, '/notes', '/rest/v1/love_notes_visible'),
      ]);
      // Tracked from before each page's load: a poke or a note is only live if
      // no read of its list delivered it instead.
      const interactionReads = partner.reads!;
      const noteReads = notes.reads!;
      const dailyReads: ReadTracker = daily.reads!;

      await Promise.all([
        daily.storedSessionWarning,
        partner.storedSessionWarning,
        notes.storedSessionWarning,
      ]);

      await log.step('The poke screen is up on the saved partner, with no partner snapshot');
      await expect(partner.page.getByTestId('poke-kiss-interface')).toBeVisible();
      await expect(partner.page.getByTestId('notification-badge')).toHaveCount(0);
      // The state the fix is for: every lookup failed, so the snapshot every
      // incoming poke is checked against is empty.
      expect(await partnerSnapshot(partner.page)).toBeNull();

      await log.step('Let the refresh through and wait for each context to renew');
      const renewals = Promise.all([
        daily.armRenewal(),
        partner.armRenewal(),
        notes.armRenewal(),
      ]);
      // The server's confirmation that the poke channel now delivers rows to
      // the renewed identity: it comes a few seconds after the token, and a row
      // inserted before it can be missed (`interactionService.ts`).
      const pokesArmed = partner.page.waitForEvent('console', {
        predicate: (message) => POKES_ARMED_LOG.test(message.text()),
        timeout: RENEWAL_TIMEOUT_MS,
      });
      // Armed before the unroute below: the Daily screen subscribed at boot on
      // a token it cannot use, and its channel joins once the renewal lands.
      const dailyJoined = daily.page.waitForEvent('console', {
        predicate: (message) => MOOD_SUBSCRIBED_LOG.test(message.text()),
        timeout: RENEWAL_TIMEOUT_MS,
      });
      const notesJoined = notes.page.waitForEvent('console', {
        predicate: (message) => NOTES_SUBSCRIBED_LOG.test(message.text()),
        timeout: RENEWAL_TIMEOUT_MS,
      });
      // Before the renewal the screen has no question: every read failed.
      await expect(daily.page.getByTestId('daily-question')).toHaveCount(0);
      for (const receiving of [daily, partner, notes]) {
        await receiving.context.unroute(REFRESH_ROUTE);
      }
      await renewals;

      await log.step('The notes feed rejoins; the Daily screen joins and shows its question in place');
      await notesJoined;
      // The registry's channel was refused on the stale token and is rejoined
      // by the SDK on the renewed one. Its `SUBSCRIBED` re-reads the day, so
      // the question appears on the screen that is already open. Nothing
      // navigates.
      await dailyJoined;
      await expect(daily.page.getByTestId('daily-question')).toBeVisible();
      await expect(daily.page.getByTestId('daily-partner-status')).toContainText(
        "hasn't picked yet"
      );
      await recurseUntil(
        async () => dailyReads.inFlight(),
        (inFlight) => {
          expect(inFlight, 'no get_daily_day read is in flight on the receiver').toBe(0);
        },
        { timeout: 15_000 }
      );

      // The poke screen re-resolves its partner snapshot after the renewal,
      // and re-reads its history once the channel is armed; the poke is sent
      // after both, with no read in flight.
      await expect
        .poll(() => partnerSnapshot(partner.page), {
          message: 'the poke screen re-resolves its partner after the renewal',
          timeout: 60_000,
        })
        .toBe(partnerId);
      await pokesArmed;
      await recurseUntil(
        async () => ({ started: interactionReads.started(), inFlight: interactionReads.inFlight() }),
        ({ started, inFlight }) => {
          expect(started, 'the armed channel re-read the history').toBeGreaterThan(0);
          expect(inFlight, 'no interactions read is in flight').toBe(0);
        },
        { timeout: 15_000 }
      );

      await log.step('The partner picks on Daily and sends a note through the real UI');
      const partnerContext = await browser.newContext({
        storageState: getStorageStatePath({
          ...authOptions,
          userIdentifier: partnerUserIdentifier,
        }),
        baseURL: origin,
      });
      cleanup.defer('close the partner context', () => closeContext(partnerContext));
      const sender = await partnerContext.newPage();
      await dismissWelcomeSplash(sender);

      const senderDay = interceptNetworkCall({
        page: sender,
        method: 'POST',
        url: DAILY_DAY_READ,
        timeout: 30_000,
      });
      await sender.goto('/daily');
      expect((await senderDay).status).toBe(200);
      await expect(sender.getByTestId('daily-question')).toBeVisible();
      await sender.getByTestId('daily-option-this').click();
      // The announcement is fire-and-forget; leaving the screen before it lands
      // would abort it, so it is awaited. The topic is the receiver's own.
      const dailyBroadcast = interceptNetworkCall({
        page: sender,
        method: 'POST',
        url: `**${broadcastPath(`mood-updates:${userId}`, 'daily_pick')}?*`,
        timeout: 30_000,
      });
      const sendPick = interceptNetworkCall({
        page: sender,
        method: 'POST',
        url: DAILY_PICK_SEND,
        timeout: 30_000,
      });
      const dailyReadsBeforeSend = dailyReads.started();
      const dayReRead = interceptNetworkCall({
        page: daily.page,
        method: 'POST',
        url: DAILY_DAY_BY_ID_READ,
        timeout: 30_000,
      });
      await sender.getByTestId('daily-send-pick').click();
      expect((await sendPick).status).toBe(200);
      expect((await dailyBroadcast).status).toBe(202);

      await sender.goto('/notes');
      const messageInput = sender.getByLabel(/love note message input/i);
      await expect(messageInput).toBeVisible();
      await messageInput.fill(noteText);
      const noteBroadcast = interceptNetworkCall({
        page: sender,
        method: 'POST',
        url: `**${broadcastPath(`love-notes:${userId}`, 'new_message')}?*`,
        timeout: 30_000,
      });
      // The re-arm's catch-up read must have settled, or it could show the note.
      await recurseUntil(
        async () => noteReads.inFlight(),
        (inFlight) => {
          expect(inFlight, 'no love-notes read is in flight on the receiver').toBe(0);
        },
        { timeout: 15_000 }
      );
      const noteReadsBeforeSend = noteReads.started();
      await sender.getByLabel(/send message/i).click();
      expect((await noteBroadcast).status).toBe(202);

      await log.step('And pokes: an admin insert from the partner, on the poke screen');
      const readsBeforePoke = interactionReads.started();
      const { data: poke, error: pokeError } = await supabaseAdmin
        .from('interactions')
        .insert(
          createInteractionInsert({ type: 'poke', from_user_id: partnerId, to_user_id: userId })
        )
        .select('id')
        .single();
      expect(pokeError).toBeNull();
      cleanup.defer('delete the poke this test created', () =>
        deleteRowById(supabaseAdmin, 'interactions', poke!.id)
      );

      await log.step('All three arrive live, with no reload');
      expect((await dayReRead).status).toBe(200);
      await expect(daily.page.getByTestId('daily-partner-status')).toContainText('has picked');
      await expect(daily.page.getByTestId('daily-reveal')).toHaveCount(0);
      expect(dailyReads.started(), 'no get_daily_day read may deliver the pick instead').toBe(
        dailyReadsBeforeSend
      );
      await expect(
        notes.page.getByTestId('love-note-message').getByText(noteText)
      ).toBeVisible();
      noteRowCommitted = true;
      expect(noteReads.started(), 'no love-notes read may deliver the note instead').toBe(
        noteReadsBeforeSend
      );
      await expect(partner.page.getByTestId('notification-badge')).toBeVisible();
      expect(interactionReads.started(), 'no interactions read may deliver the poke instead').toBe(
        readsBeforePoke
      );
    }
  );
});
