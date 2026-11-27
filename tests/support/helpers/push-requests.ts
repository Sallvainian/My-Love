/**
 * Push-request helpers for the push specs
 * (`tests/api/push-love-note-trigger.spec.ts`,
 * `tests/api/push-partner-activity-trigger.spec.ts`,
 * `tests/api/push-daily-sender.spec.ts`, `tests/api/push-daily-reminders.spec.ts`,
 * `tests/api/push-daily-picks.spec.ts` and `tests/api/push-daily-nudge.spec.ts`):
 * read what the `send-push` Edge Function recorded in `push_requests`, speak as a
 * user with a real JWT, build and link throwaway pairs with devices (and seed their
 * days), and post to the sender as the triggers do.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';
import type { TypedSupabaseClient } from '../factories';
import { readPairDayIdsByDate, seedPairDays, type SeededDay } from '../factories/daily-question';
import type { Cleanup } from '../fixtures/cleanup';
import { expect } from '../merged-fixtures';
import { createOutsiderClient, deleteOutsider } from './rls-security';
import { getUserAccessToken } from './supabase';

/** The `push_requests` column that holds each kind of source row's id. */
export type SourceColumn =
  | 'note_id'
  | 'mood_id'
  | 'photo_id'
  | 'interaction_id'
  | 'partner_request_id'
  | 'partner_accept_id'
  | 'event_id'
  | 'anniversary_id'
  | 'daily_pick_id'
  | 'daily_nudge_id'
  | 'daily_reminder_id';

/** Rows the sender records for a note (or another source row), ordered by token. */
export async function requestsFor(
  supabaseAdmin: TypedSupabaseClient,
  sourceId: string,
  column: SourceColumn = 'note_id'
) {
  const { data, error } = await supabaseAdmin
    .from('push_requests')
    .select('token, environment, delivery, payload')
    .eq(column, sourceId)
    .order('token');
  if (error) throw new Error(`Failed to read push_requests: ${error.message}`);
  return data ?? [];
}

/**
 * Waits for the sender to record `count` request rows for a source row, then returns them: a trigger
 * posts to `send-push` through `pg_net`, so the rows land a moment after the insert that caused them.
 */
export async function awaitRequests(
  supabaseAdmin: TypedSupabaseClient,
  sourceId: string,
  column: SourceColumn,
  count: number
) {
  await expect
    .poll(async () => (await requestsFor(supabaseAdmin, sourceId, column)).length, {
      message: `the sender records ${count} request(s) in ${column}`,
      timeout: 20_000,
    })
    .toBe(count);
  return requestsFor(supabaseAdmin, sourceId, column);
}

/** A client speaking as `userId` with a real JWT, so RLS and grants apply. */
export async function clientFor(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<TypedSupabaseClient> {
  const accessToken = await getUserAccessToken(supabaseAdmin, userId);
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const newToken = () => `test-${randomUUID().replace(/-/g, '')}`;

/** The R7 text each partner-activity push carries, and the `kind` the tap routes on (story 3.9). */
export const partnerPayload = (kind: string, title: string, body: string) => ({
  kind,
  aps: { alert: { title, body }, 'thread-id': 'partner-activity', badge: expect.any(Number) },
});

/** Posts `{kind, id}` to the sender as the trigger does, with the secret from the settings row. */
export async function postToSender(supabaseAdmin: TypedSupabaseClient, body: Record<string, unknown>) {
  const { data: settings, error } = await supabaseAdmin
    .from('push_sender_settings')
    .select('sender_secret')
    .single();
  expect(error).toBeNull();
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-secret': settings!.sender_secret },
    body: JSON.stringify(body),
  });
}

/** The sender's answer when it claims nothing: no device is sent, recorded, skipped, failed or gone. */
export const zeros = { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 };

/** Posts `{kind, id}` to the sender, asserts it answered 200 and returns its JSON counts. */
export async function postKindToSender(supabaseAdmin: TypedSupabaseClient, kind: string, id: string) {
  const response = await postToSender(supabaseAdmin, { kind, id });
  expect(response.status, kind).toBe(200);
  return response.json();
}

/** A moods.created_at no other run reuses (the table is unique on user and created_at). */
export const uniqueMoodTime = () => new Date(Date.now() - 86_400_000 - Math.floor(Math.random() * 1e9)).toISOString();

/** What the sender recorded as the first row's `aps.badge` and `aps['thread-id']`. */
export async function recordedAps(supabaseAdmin: TypedSupabaseClient, sourceId: string, column: SourceColumn) {
  const [row] = await requestsFor(supabaseAdmin, sourceId, column);
  const { badge, 'thread-id': threadId } = (row.payload as { aps: { badge: number; 'thread-id': string } }).aps;
  return { badge, threadId };
}

/** What a daily push records: the `partner-activity` thread, the kind, the badge (0: no love notes) and a sound or none. */
export const dailyPayload = (kind: string, title: string, body: string, sound?: 'default') => ({
  kind,
  aps: { alert: { title, body }, 'thread-id': 'partner-activity', badge: 0, ...(sound ? { sound } : {}) },
});

/**
 * A throwaway account named `<prefix> <ROLE> <suffix>`, deleted at teardown; `prefix` is also the
 * account-name prefix `createOutsiderClient` takes (as `${prefix}-${role}`).
 */
export async function createParty(
  supabaseAdmin: TypedSupabaseClient,
  cleanup: Cleanup,
  prefix: string,
  displayPrefix: string,
  role: string
) {
  const account = await createOutsiderClient(supabaseAdmin, `${prefix}-${role}`);
  cleanup.defer(`delete throwaway account ${role}`, () => deleteOutsider(account));
  const name = `${displayPrefix} ${role.toUpperCase()} ${randomUUID().slice(0, 6)}`;
  const { error } = await account.client
    .from('users')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', account.userId);
  expect(error, `name ${role}`).toBeNull();
  return { ...account, name };
}

export type Party = Awaited<ReturnType<typeof createParty>>;

/** Registers a new device token for the party and returns it. */
export async function registerDevice(party: Party, environment: 'sandbox' | 'production') {
  const token = newToken();
  const { error } = await party.client.rpc('register_push_device', { p_token: token, p_environment: environment });
  expect(error).toBeNull();
  return token;
}

/** Links two throwaway accounts as partners: a request from `from`, accepted by `to`. */
export async function link(supabaseAdmin: TypedSupabaseClient, from: Party, to: Party) {
  const { data, error } = await from.client
    .from('partner_requests')
    .insert({ from_user_id: from.userId, to_user_id: to.userId, status: 'pending' })
    .select('id')
    .single();
  expect(error).toBeNull();
  expect((await to.client.rpc('accept_partner_request', { p_request_id: data!.id })).error).toBeNull();
  const { data: users } = await supabaseAdmin.from('users').select('id, partner_id').in('id', [from.userId, to.userId]);
  expect(Object.fromEntries(users!.map((u) => [u.id, u.partner_id]))).toEqual({
    [from.userId]: to.userId,
    [to.userId]: from.userId,
  });
}

/**
 * A linked pair of throwaway accounts (`roles[0]` with one device, `roles[1]` with two: a sandbox
 * and a production token) whose `days` are seeded with `seedPairDays`. `dayIds` maps each seeded
 * date (`YYYY-MM-DD`) to its `couple_days` id. `prefix` and `displayPrefix` name the accounts as
 * `createParty` does.
 */
export async function setUpPair(
  supabaseAdmin: TypedSupabaseClient,
  cleanup: Cleanup,
  names: { prefix: string; displayPrefix: string; roles?: [string, string] },
  days: readonly SeededDay[]
) {
  const [firstRole, secondRole] = names.roles ?? ['a', 'b'];
  const first = await createParty(supabaseAdmin, cleanup, names.prefix, names.displayPrefix, firstRole);
  const second = await createParty(supabaseAdmin, cleanup, names.prefix, names.displayPrefix, secondRole);
  await link(supabaseAdmin, first, second);
  const firstDevice = await registerDevice(first, 'sandbox');
  const secondDevices: [string, string] = [
    await registerDevice(second, 'sandbox'),
    await registerDevice(second, 'production'),
  ];

  const pair = { userId: first.userId, partnerId: second.userId };
  await seedPairDays(supabaseAdmin, pair, days);
  const dayIds = await readPairDayIdsByDate(supabaseAdmin, pair);
  return { first, second, firstDevice, secondDevices, pair, dayIds };
}
