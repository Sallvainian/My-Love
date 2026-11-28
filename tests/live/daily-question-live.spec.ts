/**
 * Live check: Daily on the real site (epic daily-question, story 6.11; R1, R2),
 * the streak and Past questions on its Partner page (epic
 * streak-and-partner-page, story 7.11; R6, R7), and a nudge (epic
 * daily-pushes-and-nudge, story 8.11; R2, and epic-simpler-daily-pushes-and-nudge,
 * story 11.1; R1).
 *
 * `deploy.yml` runs this after every deploy (`live-daily-check`) against the
 * deployed site and its hosted project, with `playwright.live.config.ts`. It
 * checks that the hidden-pick gate holds and the reveal works in production:
 * the two claude bot accounts open Daily in two browser pages and see one
 * question; bot A picks This and waits. When A's own day answer says A is the
 * day's writer (`write.mine`), A first answers the write sheet "No thanks", so no
 * question row is written. A then meets the nudge prompt and taps Nudge (one
 * `send_daily_nudge` answered 200). After a reload A sees no prompt and an
 * enabled Nudge button on the waiting card; A taps it (one more
 * `send_daily_nudge`, answered 200), and after another reload A's day answer has
 * the button's nudge sent and the button shows as sent, grey. That reload is the
 * last on A's page before B picks: the server's `ok` to the page's join of its
 * partner channel (`mood-updates:<A's id>`, read off the Realtime socket) and
 * the `get_daily_day` read the join starts must both land first. The spec
 * registers no push device for either bot.
 * Bot B's own RPC answers before B's pick
 * (`get_daily_day`, `get_daily_day_by_id`) carry no choice, mark or count; B's
 * page says A has picked and shows no reveal; B picks That. A's open page then
 * shows the reveal with no reload (R2): one `get_daily_day_by_id` answered 200,
 * the re-read B's `daily_pick` broadcast asks for, and no `get_daily_day` read
 * started after B's send, so the update came by the hosted Realtime and its
 * broadcast authorization, not a read. Then both pages, after a reload, show the
 * reveal with "Different picks". Then each bot loads its
 * Partner page (story 7.11): the streak card is orange with 1 day answered
 * together and 1 in a row, and Past questions holds today's question alone,
 * that bot's pick first, marked Different. One day is all there is, because the
 * reset leaves the pair only today and the streak counts from the pair's first
 * day.
 *
 * It touches only the bot pair: it signs in `claude-bot@test.example.com`
 * (`CLAUDE_BOT_PASSWORD`) and `claude-bot-partner@test.example.com`
 * (`CLAUDE_BOT_PARTNER_PASSWORD`) with the publishable key and nothing else, and
 * clears only their pair's days through their own `reset_bot_daily_days()` RPC,
 * so a rerun starts from an empty pair (a day's nudges and picks go with it).
 * The Supabase secret key appears nowhere.
 *
 * Live mode (`LIVE_BASE_URL` set) never signs up, links or unlinks: a missing or
 * unlinked bot fails the test and says so. Local mode (no `LIVE_BASE_URL`) runs
 * against the local stack and, on a fresh one, first creates and links the bots.
 *
 * Plain `@playwright/test` on purpose: no pooled fixtures, no worker pair. Both
 * browser contexts and both API clients use time zone UTC (offset 0), so all
 * four agree on one date.
 */
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
import { expect, test, type Page, type WebSocket } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.types';
import {
  COUPLE_STREAK_READ,
  DAILY_DAY_BY_ID_READ,
  DAILY_DAY_READ,
  DAILY_HISTORY_READ,
  DAILY_NUDGE_SEND,
  DAILY_PICK_SEND,
  SECOND_CONTEXT_READ_TIMEOUT,
} from '../support/helpers/reads';
import { waitClearOfDailyTurns } from '../support/helpers/events';
import { observeReadAfterNavigation } from '../support/helpers/read-after-navigation';
import { recurseUntil } from '../support/helpers/recurse';
import { type ReadTracker, trackReads } from '../support/helpers/request-tracker';
import { dismissWelcomeSplash } from '../support/helpers/welcome-splash';

type BotClient = SupabaseClient<Database>;

const BOT_A_EMAIL = 'claude-bot@test.example.com';
const BOT_A_PASSWORD_VAR = 'CLAUDE_BOT_PASSWORD';
const BOT_A_NAME = 'Claude Bot';
const BOT_B_EMAIL = 'claude-bot-partner@test.example.com';
const BOT_B_PASSWORD_VAR = 'CLAUDE_BOT_PARTNER_PASSWORD';
const BOT_B_NAME = 'Claude Partner';

const UTC_ZONE = { time_zone: 'UTC', utc_offset_minutes: 0 } as const;
const NUDGE_SEND_PATH = '/rest/v1/rpc/send_daily_nudge';
const GET_DAILY_DAY_PATH = '/rest/v1/rpc/get_daily_day';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

interface Target {
  live: boolean;
  supabaseUrl: string;
  publishableKey: string;
}

interface Bot {
  email: string;
  password: string;
  displayName: string;
  client: BotClient;
  id: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (or is empty); the live Daily check needs it.`);
  }
  return value;
}

/** Live mode reads `LIVE_*`, so a local `supabase status` that fills `VITE_*` can never aim a live run at the wrong project. */
function resolveTarget(): Target {
  if (process.env.LIVE_BASE_URL) {
    return {
      live: true,
      supabaseUrl: requireEnv('LIVE_SUPABASE_URL'),
      publishableKey: requireEnv('LIVE_SUPABASE_PUBLISHABLE_KEY'),
    };
  }
  const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
  const { hostname } = new URL(supabaseUrl);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Local mode (LIVE_BASE_URL unset) refuses ${hostname}: it signs up and links accounts, so ` +
        'the Supabase URL must be localhost or 127.0.0.1. Set LIVE_BASE_URL to check a deployed site.'
    );
  }
  return {
    live: false,
    supabaseUrl,
    publishableKey: requireEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'),
  };
}

function newClient(target: Target): BotClient {
  return createClient<Database>(target.supabaseUrl, target.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Sign the bot in. Only a local run may sign a missing bot up (display name in
 * the metadata, which the profile trigger copies); a live run never creates
 * an account. Whatever session comes back must be the expected bot's before
 * anything is written.
 */
async function signInBot(target: Target, bot: Omit<Bot, 'id'>): Promise<string> {
  const signIn = () =>
    bot.client.auth.signInWithPassword({ email: bot.email, password: bot.password });

  let { data, error } = await signIn();
  if (error && !target.live && error.code === 'invalid_credentials') {
    const signUp = await bot.client.auth.signUp({
      email: bot.email,
      password: bot.password,
      options: { data: { display_name: bot.displayName } },
    });
    if (signUp.error) {
      throw new Error(`Local sign-up of ${bot.email} failed: ${signUp.error.message}`);
    }
    ({ data, error } = await signIn());
  }
  if (error || !data.session) {
    throw new Error(
      target.live
        ? `Cannot sign in ${bot.email} on the live project (${error?.message ?? 'no session'}). ` +
            'The bot account must exist and its password must match the secret; a live run never signs one up.'
        : `Cannot sign in ${bot.email} locally (${error?.message ?? 'no session'}). ` +
            'If the account exists, its password differs from the one in the environment.'
    );
  }
  const signedInAs = data.session.user.email?.toLowerCase();
  if (signedInAs !== bot.email) {
    throw new Error(`Signed in as ${signedInAs ?? 'no email'}, expected ${bot.email}; nothing was written.`);
  }
  return data.session.user.id;
}

async function partnerOf(client: BotClient): Promise<string | null> {
  const { data, error } = await client.rpc('get_my_partner_id');
  if (error) throw new Error(`get_my_partner_id failed: ${error.message}`);
  return data || null;
}

/**
 * The pair must be linked to each other. A local run on a fresh stack links
 * them the way the app does (a pending `partner_requests` row, accepted by the
 * recipient); a live run, and a local run where either bot has another partner,
 * fails instead.
 */
async function ensureLinked(target: Target, a: Bot, b: Bot): Promise<void> {
  let partnerA = await partnerOf(a.client);
  let partnerB = await partnerOf(b.client);

  if (!target.live && partnerA === null && partnerB === null) {
    const { error: insertError } = await a.client
      .from('partner_requests')
      .insert({ from_user_id: a.id, to_user_id: b.id, status: 'pending' });
    if (insertError) throw new Error(`Linking the local bots failed at the request: ${insertError.message}`);

    const { data: pending, error: pendingError } = await b.client.rpc('get_my_pending_partner_requests');
    if (pendingError) throw new Error(`Linking the local bots failed reading requests: ${pendingError.message}`);
    const request = pending?.find((row) => row.from_user_id === a.id);
    if (!request) throw new Error('Linking the local bots failed: the pending request was not found.');

    const { error: acceptError } = await b.client.rpc('accept_partner_request', {
      p_request_id: request.id,
    });
    if (acceptError) throw new Error(`Linking the local bots failed at accept: ${acceptError.message}`);

    partnerA = await partnerOf(a.client);
    partnerB = await partnerOf(b.client);
  }

  if (partnerA !== b.id || partnerB !== a.id) {
    throw new Error(
      `${a.email} and ${b.email} are not linked to each other` +
        (target.live ? ' on the live project; a live run never links or unlinks accounts.' : ' locally.')
    );
  }
}

/** Every string value in `value` that is a bare choice, as a JSON path. */
function choiceValuesIn(value: unknown, path = '$'): string[] {
  if (value === 'this' || value === 'that') return [`${path} = ${String(value)}`];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => choiceValuesIn(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => choiceValuesIn(item, `${path}.${key}`));
  }
  return [];
}

interface PreSnapshot {
  day_id: string;
  state: string;
  my_choice: string | null;
  partner_choice: string | null;
  same: boolean | null;
  question: { this: string; that: string };
}

/** What B's own answer must look like while only A has picked: the partner's pick, never its choice. */
function expectHidden(answer: unknown, snapshot: PreSnapshot): void {
  expect(snapshot.state).toBe('partner');
  expect(snapshot.my_choice).toBeNull();
  expect(snapshot.partner_choice).toBeNull();
  expect(snapshot.same).toBeNull();
  expect(choiceValuesIn(answer)).toEqual([]);
}

/** Observe the next POST of an RPC on this page; start it before the action that sends it. */
function observeRpc(page: Page, url: string) {
  return interceptNetworkCall({ page, method: 'POST', url, timeout: SECOND_CONTEXT_READ_TIMEOUT });
}

/**
 * Observe the first POST of an RPC sent by the document the next navigation
 * loads; start it before navigating (see `observeReadAfterNavigation`).
 */
function observeRpcAfterNavigation(page: Page, url: string) {
  return observeReadAfterNavigation(page, { method: 'POST', url });
}

/** One text frame of the Realtime socket, or null for a binary frame or anything unparsable. */
interface RealtimeFrame {
  ref: string | null;
  topic: string;
  event: string;
  status: unknown;
}

/**
 * realtime-js writes a frame as `[join_ref, ref, topic, event, payload]`
 * (protocol 2.0.0, its default) or as an object of the same fields (1.0.0).
 * A broadcast may come as a binary frame, which no join reply is.
 */
function parseRealtimeFrame(data: string | Buffer): RealtimeFrame | null {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  let fields: { ref: unknown; topic: unknown; event: unknown; payload: unknown };
  if (Array.isArray(parsed)) {
    const [, ref, topic, event, payload] = parsed as unknown[];
    fields = { ref, topic, event, payload };
  } else if (parsed !== null && typeof parsed === 'object') {
    const { ref, topic, event, payload } = parsed as Record<string, unknown>;
    fields = { ref, topic, event, payload };
  } else {
    return null;
  }
  if (typeof fields.topic !== 'string' || typeof fields.event !== 'string') return null;
  const status =
    fields.payload !== null && typeof fields.payload === 'object'
      ? (fields.payload as { status?: unknown }).status
      : undefined;
  return {
    ref: typeof fields.ref === 'string' ? fields.ref : null,
    topic: fields.topic,
    event: fields.event,
    status,
  };
}

/**
 * Watch the page's Realtime sockets for the server's `ok` to a join of the
 * account's own partner channel (`mood-updates:<userId>`, where the partner's
 * `daily_pick` lands) and keep the number of `get_daily_day` reads the page
 * had started then. That reply is when the SDK reports `SUBSCRIBED`; the
 * `[MoodSyncService]` log the local spec waits on is `logger.debug`, which a
 * production build never prints. The join's `SUBSCRIBED` starts one more
 * `get_daily_day` read, after that count. Attach it before the navigation
 * that joins: a reply sent before it is never seen.
 */
function watchPartnerChannelJoin(page: Page, userId: string, reads: ReadTracker) {
  const topic = `realtime:mood-updates:${userId}`;
  let startedAtJoin: number | null = null;
  // playwright-utils deviation: reads the Realtime socket's frames, which interceptNetworkCall (HTTP only) cannot see.
  page.on('websocket', (socket: WebSocket) => {
    const joinRefs = new Set<string>();
    socket.on('framesent', ({ payload }) => {
      const frame = parseRealtimeFrame(payload);
      if (frame?.event === 'phx_join' && frame.topic === topic && frame.ref) joinRefs.add(frame.ref);
    });
    socket.on('framereceived', ({ payload }) => {
      if (startedAtJoin !== null) return;
      const frame = parseRealtimeFrame(payload);
      if (frame?.event !== 'phx_reply' || frame.topic !== topic) return;
      if (frame.ref === null || !joinRefs.has(frame.ref) || frame.status !== 'ok') return;
      startedAtJoin = reads.started();
    });
  });
  return { startedAtJoin: () => startedAtJoin };
}

async function signInThroughUi(page: Page, bot: Bot): Promise<void> {
  await dismissWelcomeSplash(page);
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(bot.email);
  await page.getByTestId('password-input').fill(bot.password);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('app-container')).toBeVisible();
  await expect(page.getByTestId('login-screen')).toHaveCount(0);
}

/** Navigate, and answer the page's own `get_daily_day` response once it is 200. */
async function openDaily(page: Page, goto: () => Promise<unknown>): Promise<unknown> {
  const read = observeRpcAfterNavigation(page, DAILY_DAY_READ);
  await goto();
  const result = await read;
  expect(result.status).toBe(200);
  return result.responseJson;
}

/**
 * Load the Partner page and wait for its own streak and past-questions reads,
 * both 200. A fresh load, not the dock: after the second pick Daily's +1 screen
 * and the write-tomorrow sheet cover the dock, and neither shows on Partner.
 */
async function openPartner(page: Page): Promise<void> {
  const streak = observeRpcAfterNavigation(page, COUPLE_STREAK_READ);
  const history = observeRpcAfterNavigation(page, DAILY_HISTORY_READ);
  await page.goto('/partner');
  const [streakResult, historyResult] = await Promise.all([streak, history]);
  expect(streakResult.status).toBe(200);
  expect(historyResult.status).toBe(200);
}

/** The Partner page after the pair's one finished day: 1 and 1 in orange, today's question Different. */
async function expectOneDayTogether(
  page: Page,
  question: string,
  mine: string,
  theirs: string
): Promise<void> {
  const card = page.getByTestId('partner-streak-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-state', 'orange');
  await expect(page.getByTestId('partner-streak-held')).toHaveText('1');
  await expect(card).toContainText('day answered together');
  await expect(page.getByTestId('partner-streak-run')).toHaveText('1');
  await expect(card).toContainText('in a row');

  const rows = page.getByTestId('partner-past-questions').getByTestId('partner-past-question');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-same', 'false');
  await expect(rows.first().getByTestId('partner-past-question-text')).toHaveText(question);
  await expect(rows.first().getByTestId('partner-past-question-picks')).toHaveText(
    `${mine} · ${theirs}`
  );
  await expect(rows.first().getByTestId('partner-past-question-mark')).toHaveText('Different');
}

test.describe('Live Daily check', () => {
  test('[P0] the bot pair sees one question, a hidden pick, a nudge, the reveal on the second pick, and the day on Partner', async ({
    browser,
    baseURL,
  }, testInfo) => {
    const passwordA = requireEnv(BOT_A_PASSWORD_VAR);
    const passwordB = requireEnv(BOT_B_PASSWORD_VAR);
    const target = resolveTarget();

    const botA: Omit<Bot, 'id'> = {
      email: BOT_A_EMAIL,
      password: passwordA,
      displayName: BOT_A_NAME,
      client: newClient(target),
    };
    const botB: Omit<Bot, 'id'> = {
      email: BOT_B_EMAIL,
      password: passwordB,
      displayName: BOT_B_NAME,
      client: newClient(target),
    };
    const contexts: { close(): Promise<void> }[] = [];

    try {
      const a: Bot = { ...botA, id: await signInBot(target, botA) };
      const b: Bot = { ...botB, id: await signInBot(target, botB) };

      await ensureLinked(target, a, b);

      // The bots' day turns at 00:00 UTC (both store UTC, which is also where
      // a nudge's closing instant falls), so the guard reads the UTC clock
      // whatever zone the host is on (DW-542); wait past a turn before the reset.
      await waitClearOfDailyTurns(testInfo, 'UTC');

      for (const bot of [a, b]) {
        const { error } = await bot.client.rpc('reset_bot_daily_days');
        if (error) throw new Error(`reset_bot_daily_days failed for ${bot.email}: ${error.message}`);
      }

      // Contexts made here get no video from the config's `video` setting, so
      // record it here; a failed deploy run uploads these .webm files.
      const contextOptions = {
        baseURL,
        timezoneId: 'UTC',
        recordVideo: { dir: test.info().outputPath('videos') },
      } as const;
      const contextA = await browser.newContext(contextOptions);
      contexts.push(contextA);
      const contextB = await browser.newContext(contextOptions);
      contexts.push(contextB);
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();
      // Before sign-in: a read the counter never saw start would look settled
      // when it ends, so A's day reads are counted from the page's first load.
      const dayReadsA = trackReads(pageA, GET_DAILY_DAY_PATH, 'POST');

      await signInThroughUi(pageA, a);
      await signInThroughUi(pageB, b);

      // Both open /daily and show the same question.
      const openedA = (await openDaily(pageA, () => pageA.goto('/daily'))) as {
        snapshot: { write: { mine: boolean } };
      };
      await openDaily(pageB, () => pageB.goto('/daily'));
      const questionA = await pageA.getByTestId('daily-question').innerText();
      await expect(pageB.getByTestId('daily-question')).toHaveText(questionA);
      const thisText = await pageA.getByTestId('daily-option-this').innerText();
      const thatText = await pageA.getByTestId('daily-option-that').innerText();
      expect(questionA).toBe(`${thisText} or ${thatText}?`);

      // A picks This and waits.
      await pageA.getByTestId('daily-option-this').click();
      const sent = observeRpc(pageA, DAILY_PICK_SEND);
      await pageA.getByTestId('daily-send-pick').click();
      expect((await sent).status).toBe(200);
      await expect(pageA.getByTestId('daily-waiting')).toBeVisible();
      await expect(pageA.getByTestId('daily-my-pick')).toHaveText(thisText);

      // A's pick raises the nudge prompt. As the day's writer A first meets the
      // write sheet and declines it, so no question row is written, and the
      // prompt follows it.
      if (openedA.snapshot.write.mine) {
        await expect(pageA.getByTestId('daily-write-sheet')).toBeVisible();
        await expect(pageA.getByTestId('daily-nudge-sheet')).toHaveCount(0);
        await pageA.getByTestId('daily-write-decline').click();
        await expect(pageA.getByTestId('daily-write-sheet')).toHaveCount(0);
      }
      const nudgeSheet = pageA.getByTestId('daily-nudge-sheet');
      await expect(nudgeSheet).toBeVisible();

      // A taps Nudge on the prompt: one send_daily_nudge on the project, answered 200.
      const nudgeSends = trackReads(pageA, NUDGE_SEND_PATH, 'POST');
      const promptNudged = observeRpc(pageA, DAILY_NUDGE_SEND);
      await pageA.getByTestId('daily-nudge-sheet-send').click();
      expect((await promptNudged).status).toBe(200);
      await expect(nudgeSheet).toHaveCount(0);
      expect(nudgeSends.started()).toBe(1);

      // After a reload A sees no prompt and an enabled Nudge button on the waiting card.
      const afterPrompt = (await openDaily(pageA, () => pageA.reload())) as {
        snapshot: { nudges?: { prompt_sent: boolean; button_sent: boolean } };
      };
      expect(afterPrompt.snapshot.nudges).toMatchObject({ prompt_sent: true, button_sent: false });
      await expect(pageA.getByTestId('daily-waiting')).toBeVisible();
      await expect(nudgeSheet).toHaveCount(0);
      const nudgeButton = pageA.getByTestId('daily-nudge');
      await expect(nudgeButton).toBeEnabled();

      // A taps it: one more request, answered 200, and after another reload the
      // button shows as sent. The button is also disabled while the send is in
      // flight, so "sent" is read from the server's answer after the reload.
      // That reload is A's last before B picks, so the partner channel's join
      // watch goes on first: it must see only the reloaded page's join.
      const buttonNudged = observeRpc(pageA, DAILY_NUDGE_SEND);
      await nudgeButton.click();
      expect((await buttonNudged).status).toBe(200);
      expect(nudgeSends.started()).toBe(2);
      const joinA = watchPartnerChannelJoin(pageA, a.id, dayReadsA);
      const afterNudge = (await openDaily(pageA, () => pageA.reload())) as {
        snapshot: { nudges?: { prompt_sent: boolean; button_sent: boolean } };
      };
      expect(afterNudge.snapshot.nudges).toMatchObject({ prompt_sent: true, button_sent: true });
      await expect(nudgeButton).toBeDisabled();
      await expect(nudgeButton).toHaveAttribute('data-sent', 'true');
      await expect(pageA.getByTestId('daily-nudge-error')).toHaveCount(0);
      await expect(nudgeSheet).toHaveCount(0);
      expect(nudgeSends.started()).toBe(2);

      // A's page has joined its partner channel on the live project, and every
      // get_daily_day read has settled: the join's own read starts after the
      // count taken at the join, so it must be passed, with none in flight. A
      // read left in flight could carry B's pick and stand in for the broadcast.
      const dayReadsAtJoinA = await recurseUntil(
        async () => joinA.startedAtJoin(),
        (startedAtJoin) => {
          expect(startedAtJoin, "the server's ok to A's join of its partner channel").not.toBeNull();
        },
        { timeout: 30_000 }
      );
      await recurseUntil(
        async () => ({ started: dayReadsA.started(), inFlight: dayReadsA.inFlight() }),
        ({ started, inFlight }) => {
          expect(started, "the join's own read started").toBeGreaterThan(dayReadsAtJoinA ?? 0);
          expect(inFlight, 'no get_daily_day read is in flight').toBe(0);
        },
        { timeout: 15_000 }
      );

      // B has not picked: B's own answers say a pick was made and nothing of it.
      const { data: answer, error: dayError } = await b.client.rpc('get_daily_day', {
        ...UTC_ZONE,
        reported_at: new Date().toISOString(),
      });
      if (dayError) throw new Error(`get_daily_day failed for ${b.email}: ${dayError.message}`);
      const dayAnswer = answer as unknown as { status: string; snapshot: PreSnapshot };
      expect(dayAnswer.status).toBe('ok');
      expectHidden(dayAnswer, dayAnswer.snapshot);
      expect(`${dayAnswer.snapshot.question.this} or ${dayAnswer.snapshot.question.that}?`).toBe(questionA);

      const { data: byId, error: byIdError } = await b.client.rpc('get_daily_day_by_id', {
        day_id: dayAnswer.snapshot.day_id,
      });
      if (byIdError) throw new Error(`get_daily_day_by_id failed for ${b.email}: ${byIdError.message}`);
      const byIdSnapshot = byId as unknown as PreSnapshot;
      expect(byIdSnapshot.day_id).toBe(dayAnswer.snapshot.day_id);
      expectHidden(byId, byIdSnapshot);

      // B's page, reloaded, receives the same hidden answer, says A has picked
      // and shows no reveal.
      const pageAnswer = (await openDaily(pageB, () => pageB.reload())) as { snapshot: PreSnapshot };
      expectHidden(pageAnswer, pageAnswer.snapshot);
      await expect(pageB.getByTestId('daily-partner-status')).toContainText('has picked');
      await expect(pageB.getByTestId('daily-reveal')).toHaveCount(0);
      await expect(pageB.getByTestId('daily-reveal-partner')).toHaveCount(0);

      // B picks That and sees the reveal.
      const dayReadsBeforeSendA = dayReadsA.started();
      const reReadA = observeRpc(pageA, DAILY_DAY_BY_ID_READ);
      await pageB.getByTestId('daily-option-that').click();
      const sentB = observeRpc(pageB, DAILY_PICK_SEND);
      await pageB.getByTestId('daily-send-pick').click();
      expect((await sentB).status).toBe(200);
      await expect(pageB.getByTestId('daily-reveal')).toBeVisible();

      // A's open page shows the reveal with no reload: B's daily_pick broadcast
      // asked for the one re-read, and no day read stood in for it.
      expect((await reReadA).status).toBe(200);
      await expect(pageA.getByTestId('daily-reveal')).toBeVisible();
      await expect(pageA.getByTestId('daily-reveal-mine')).toHaveText(thisText);
      await expect(pageA.getByTestId('daily-reveal-partner')).toHaveText(thatText);
      await expect(pageA.getByTestId('daily-reveal-mark')).toHaveText('Different picks');
      expect(dayReadsA.started(), "A's page read no day but the named one").toBe(dayReadsBeforeSendA);

      // After a reload each page shows the same reveal from its own side.
      await openDaily(pageB, () => pageB.reload());
      await expect(pageB.getByTestId('daily-reveal')).toBeVisible();
      await expect(pageB.getByTestId('daily-reveal-mine')).toHaveText(thatText);
      await expect(pageB.getByTestId('daily-reveal-partner')).toHaveText(thisText);
      await expect(pageB.getByTestId('daily-reveal-mark')).toHaveText('Different picks');

      await openDaily(pageA, () => pageA.reload());
      await expect(pageA.getByTestId('daily-reveal')).toBeVisible();
      await expect(pageA.getByTestId('daily-reveal-mine')).toHaveText(thisText);
      await expect(pageA.getByTestId('daily-reveal-partner')).toHaveText(thatText);
      await expect(pageA.getByTestId('daily-reveal-mark')).toHaveText('Different picks');

      // Each Partner page shows the finished day: the streak and today's question.
      await openPartner(pageA);
      await expectOneDayTogether(pageA, questionA, thisText, thatText);
      await openPartner(pageB);
      await expectOneDayTogether(pageB, questionA, thatText, thisText);
    } finally {
      for (const context of contexts) await context.close().catch(() => undefined);
      // Local scope: only the sessions these two API clients opened end.
      await botA.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await botB.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  });
});
