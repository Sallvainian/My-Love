/**
 * Edge Function: send-push
 *
 * Sends the push a new love note, mood, photo, poke, kiss, date change,
 * partner request or accepted partner request becomes, to every device
 * registered to the recipient. Called by the triggers on `love_notes`,
 * `moods`, `photos`, `interactions`, `events`, `couple_settings`, `users` and
 * `partner_requests`; see `handler.ts` for the contract. This file is only
 * the serve binding and the real database and APNs wiring.
 *
 * Secrets (never in source): APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, and
 * optionally APNS_TOPIC (default dev.sallvain.mylove). With any of the first
 * three missing the function records the requests instead of sending them.
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { apnsConfigFromEnv, createApnsClient } from './apns.ts';
import { handleSendPush, type DateChangeRow, type PushDb, type PushKind } from './handler.ts';

/** The `push_requests` column that holds each kind's source row id. */
const SOURCE_COLUMN: Record<PushKind, string> = {
  love_note: 'note_id',
  mood: 'mood_id',
  photo: 'photo_id',
  interaction: 'interaction_id',
  date: 'date_change_id',
  partner_request: 'partner_request_id',
  partner_accept: 'partner_accept_id',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
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
  async getDateChange(changeId) {
    const { data, error } = await admin
      .from('date_changes')
      .select('id, sender_id, subject, action, event_id')
      .eq('id', changeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    let eventLabel: string | null = null;
    if (data.event_id) {
      const event = await admin.from('events').select('label').eq('id', data.event_id).maybeSingle();
      if (event.error) throw new Error(event.error.message);
      eventLabel = event.data?.label ?? null;
    }
    return {
      id: data.id,
      sender_id: data.sender_id,
      subject: data.subject as DateChangeRow['subject'],
      action: data.action as DateChangeRow['action'],
      event_label: eventLabel,
    };
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
  async getPartnerId(userId) {
    const { data, error } = await admin.from('users').select('partner_id').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.partner_id ?? null;
  },
  async getDisplayName(userId) {
    const { data, error } = await admin.from('users').select('display_name').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.display_name ?? null;
  },
  async listDevices(userId) {
    const { data, error } = await admin.from('push_devices').select('token, environment').eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data ?? [];
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
