/**
 * Push-request helpers for the push trigger specs
 * (`tests/api/push-love-note-trigger.spec.ts` and
 * `tests/api/push-partner-activity-trigger.spec.ts`): read what the `send-push`
 * Edge Function recorded in `push_requests`, speak as a user with a real JWT,
 * and post to the sender as the triggers do.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';
import type { TypedSupabaseClient } from '../factories';
import { expect } from '../merged-fixtures';
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
  | 'anniversary_id';

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

/** A moods.created_at no other run reuses (the table is unique on user and created_at). */
export const uniqueMoodTime = () => new Date(Date.now() - 86_400_000 - Math.floor(Math.random() * 1e9)).toISOString();

/** What the sender recorded as the first row's `aps.badge` and `aps['thread-id']`. */
export async function recordedAps(supabaseAdmin: TypedSupabaseClient, sourceId: string, column: SourceColumn) {
  const [row] = await requestsFor(supabaseAdmin, sourceId, column);
  const { badge, 'thread-id': threadId } = (row.payload as { aps: { badge: number; 'thread-id': string } }).aps;
  return { badge, threadId };
}
