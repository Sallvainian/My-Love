/**
 * Edge Function: send-push
 *
 * Sends the push a new love note, mood, photo, poke, kiss, partner request,
 * accepted partner request, event, anniversary or one of the five daily kinds
 * (a partner's pick, both picked, a nudge, the 8 AM question, the 8 PM reminder)
 * becomes, to every device registered to the recipient, unless the recipient switched that kind off in
 * `push_preferences`. Every push carries the recipient's unread love-note
 * count as the icon badge. Called by the triggers on `love_notes`, `moods`,
 * `photos`, `interactions`, `partner_requests`, `events` and `anniversaries`, and (stories 5 to 7)
 * by those on `daily_picks`, `daily_nudges` and `daily_reminders`; see `handler.ts` for the
 * contract. The daily reads are column-listed (never `daily_picks.choice`), a couple day's
 * question is read in a second select (`couple_days` and `daily_questions` have two
 * relationships), and the recipient's date and streak come from the `user_local_date` and
 * `couple_streak` functions. This file is only the serve binding and the real database and APNs
 * wiring.
 *
 * Secrets (never in source): APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, and
 * optionally APNS_TOPIC (default dev.sallvain.mylove). With any of the first
 * three missing the function records the requests instead of sending them.
 * SUPABASE_URL and the privileged key are injected by the runtime: the secret
 * key from SUPABASE_SECRET_KEYS, else the legacy SUPABASE_SERVICE_ROLE_KEY
 * (see _shared/apiKeys.ts).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0?deps=iceberg-js@0.8.1';

import { apnsConfigFromEnv, createApnsClient } from './apns.ts';
import { handleSendPush, type PushDb, type PushKind } from './handler.ts';
import { apiKeyFromEnv } from '../_shared/apiKeys.ts';

/** The `push_requests` column that holds each kind's source row id. */
const SOURCE_COLUMN: Record<PushKind, string> = {
  love_note: 'note_id',
  mood: 'mood_id',
  photo: 'photo_id',
  interaction: 'interaction_id',
  partner_request: 'partner_request_id',
  partner_accept: 'partner_accept_id',
  event: 'event_id',
  anniversary: 'anniversary_id',
  daily_question: 'daily_reminder_id',
  daily_reminder: 'daily_reminder_id',
  daily_partner_picked: 'daily_pick_id',
  daily_both_answered: 'daily_pick_id',
  daily_nudge: 'daily_nudge_id',
};

const secretKey = apiKeyFromEnv('secret', (name) => Deno.env.get(name)).key;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const db: PushDb = {
  async getSenderSecret() {
    const { data, error } = await admin.from('push_sender_settings').select('sender_secret').maybeSingle();
    if (error) throw new Error(error.message);
    return data?.sender_secret ?? null;
  },
  async getNote(noteId) {
    const { data, error } = await admin
      .from('love_notes')
      .select('id, from_user_id, to_user_id, content, image_url')
      .eq('id', noteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getMood(moodId) {
    const { data, error } = await admin
      .from('moods')
      .select('id, user_id, mood_type, mood_types')
      .eq('id', moodId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getPhoto(photoId) {
    const { data, error } = await admin.from('photos').select('id, user_id').eq('id', photoId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getInteraction(interactionId) {
    const { data, error } = await admin
      .from('interactions')
      .select('id, from_user_id, to_user_id, type')
      .eq('id', interactionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getPartnerRequest(requestId) {
    const { data, error } = await admin
      .from('partner_requests')
      .select('id, from_user_id, to_user_id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getEvent(eventId) {
    const { data, error } = await admin.from('events').select('id, user_id, label').eq('id', eventId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getAnniversary(anniversaryId) {
    const { data, error } = await admin
      .from('anniversaries')
      .select('id, user_id, label')
      .eq('id', anniversaryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getDailyPick(pickId) {
    // Never `choice`: the sender has no SELECT on it and no push carries it. `is_second` it does read.
    const { data, error } = await admin
      .from('daily_picks')
      .select('id, day_id, user_id, is_second')
      .eq('id', pickId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getDailyNudge(nudgeId) {
    const { data, error } = await admin
      .from('daily_nudges')
      .select('id, from_user, to_user, day_id, held, released_at')
      .eq('id', nudgeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getDailyReminder(reminderId) {
    const { data, error } = await admin
      .from('daily_reminders')
      .select('id, user_id, kind, day_id')
      .eq('id', reminderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async getCoupleDay(dayId) {
    // Two selects, not an embed: couple_days and daily_questions are related twice.
    const { data: day, error } = await admin
      .from('couple_days')
      .select('id, user_a, user_b, day, question_id')
      .eq('id', dayId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!day) return null;
    const { data: question, error: questionError } = await admin
      .from('daily_questions')
      .select('this_text, that_text')
      .eq('id', day.question_id)
      .maybeSingle();
    if (questionError) throw new Error(questionError.message);
    if (!question) throw new Error('couple day has no question');
    return {
      id: day.id,
      user_a: day.user_a,
      user_b: day.user_b,
      day: day.day,
      this_text: question.this_text,
      that_text: question.that_text,
    };
  },
  async getUserLocalDate(userId, atIso) {
    const { data, error } = await admin.rpc('user_local_date', { user_id: userId, at: atIso });
    if (error) throw new Error(error.message);
    if (typeof data !== 'string') throw new Error('user_local_date returned no date');
    return data;
  },
  async getCoupleStreak(userA, userB, viewer, atIso) {
    const { data, error } = await admin.rpc('couple_streak', {
      user_a: userA,
      user_b: userB,
      viewer,
      at: atIso,
    });
    if (error) throw new Error(error.message);
    const streak = data as { held?: unknown; run?: unknown } | null;
    if (typeof streak?.held !== 'number' || typeof streak.run !== 'number') {
      throw new Error('couple_streak returned no held and run');
    }
    return { held: streak.held, run: streak.run };
  },
  async getPartnerId(userId) {
    const { data, error } = await admin.from('users').select('partner_id').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.partner_id ?? null;
  },
  async isPushEnabled(userId, preference) {
    // No row means every switch is on; a failed read throws, so the sender answers 500.
    const { data, error } = await admin
      .from('push_preferences')
      .select(preference)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? (data as Record<string, unknown>)[preference] !== false : true;
  },
  async getDisplayName(userId) {
    const { data, error } = await admin.from('users').select('display_name').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.display_name ?? null;
  },
  async listDevices(userId) {
    const { data, error } = await admin
      .from('push_devices')
      .select('token, environment, updated_at')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async countUnreadNotes(userId) {
    const { data, error } = await admin.rpc('unread_love_note_count', { p_user_id: userId });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },
  async claimRequest(row) {
    const column = SOURCE_COLUMN[row.kind];
    const { kind: _kind, source_id, ...rest } = row;
    const { data, error } = await admin
      .from('push_requests')
      .upsert({ ...rest, [column]: source_id }, { onConflict: `${column},token`, ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },
  async releaseRequest(kind, sourceId, token) {
    const { error } = await admin
      .from('push_requests')
      .delete()
      .eq(SOURCE_COLUMN[kind], sourceId)
      .eq('token', token);
    if (error) throw new Error(error.message);
  },
  async deleteGoneDevice(token, goneAt) {
    // register_push_device bumps updated_at, so a row registered again after
    // APNs found the token gone is kept.
    const { error } = await admin
      .from('push_devices')
      .delete()
      .eq('token', token)
      .lte('updated_at', new Date(goneAt).toISOString());
    if (error) throw new Error(error.message);
  },
};

const apnsConfig = apnsConfigFromEnv((name) => Deno.env.get(name));
const apns = apnsConfig ? createApnsClient(apnsConfig) : null;

Deno.serve((req) => handleSendPush(req, { db, apns }));
