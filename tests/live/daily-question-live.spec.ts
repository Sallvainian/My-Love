/**
 * Live check: Daily on the real site (epic daily-question, story 6.11; R1, R2).
 *
 * `deploy.yml` runs this after every deploy (`live-daily-check`) against the
 * deployed site and its hosted project, with `playwright.live.config.ts`. It
 * checks that the hidden-pick gate holds and the reveal works in production:
 * the two claude bot accounts open Daily in two browser pages and see one
 * question; bot A picks This and waits; bot B's own RPC answers before B's pick
 * (`get_daily_day`, `get_daily_day_by_id`) carry no choice, mark or count; B's
 * page says A has picked and shows no reveal; B picks That; both pages, after a
 * reload, show the reveal with "Different picks".
 *
 * It touches only the bot pair: it signs in `claude-bot@test.example.com`
 * (`CLAUDE_BOT_PASSWORD`) and `claude-bot-partner@test.example.com`
 * (`CLAUDE_BOT_PARTNER_PASSWORD`) with the publishable key and nothing else, and
 * clears only their pair's days through their own `reset_bot_daily_days()` RPC,
 * so a rerun starts from an empty pair. The Supabase secret key appears nowhere.
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
import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.types';
import { DAILY_DAY_READ, DAILY_PICK_SEND, SECOND_CONTEXT_READ_TIMEOUT } from '../support/helpers/reads';
import { dismissWelcomeSplash } from '../support/helpers/welcome-splash';

type BotClient = SupabaseClient<Database>;

const BOT_A_EMAIL = 'claude-bot@test.example.com';
const BOT_A_PASSWORD_VAR = 'CLAUDE_BOT_PASSWORD';
const BOT_A_NAME = 'Claude Bot';
const BOT_B_EMAIL = 'claude-bot-partner@test.example.com';
const BOT_B_PASSWORD_VAR = 'CLAUDE_BOT_PARTNER_PASSWORD';
const BOT_B_NAME = 'Claude Partner';

const UTC_ZONE = { time_zone: 'UTC', utc_offset_minutes: 0 } as const;
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
  const read = observeRpc(page, DAILY_DAY_READ);
  await goto();
  const result = await read;
  expect(result.status).toBe(200);
  return result.responseJson;
}

test.describe('Live Daily check', () => {
  test('[P0] the bot pair sees one question, a hidden pick, and the reveal on the second pick', async ({
    browser,
    baseURL,
  }) => {
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

      await signInThroughUi(pageA, a);
      await signInThroughUi(pageB, b);

      // Both open /daily and show the same question.
      await openDaily(pageA, () => pageA.goto('/daily'));
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
      await pageB.getByTestId('daily-option-that').click();
      const sentB = observeRpc(pageB, DAILY_PICK_SEND);
      await pageB.getByTestId('daily-send-pick').click();
      expect((await sentB).status).toBe(200);
      await expect(pageB.getByTestId('daily-reveal')).toBeVisible();

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
    } finally {
      for (const context of contexts) await context.close().catch(() => undefined);
      // Local scope: only the sessions these two API clients opened end.
      await botA.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await botB.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  });
});
