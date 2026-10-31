/**
 * Edge Function: send-push
 *
 * Sends the push a new love note becomes, to every device registered to the
 * recipient. Called by the `love_notes` insert trigger; see `handler.ts` for
 * the contract. This file is only the serve binding and the real database and
 * APNs wiring.
 *
 * Secrets (never in source): APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, and
 * optionally APNS_TOPIC (default dev.sallvain.mylove). With any of the first
 * three missing the function records the requests instead of sending them.
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { apnsConfigFromEnv, createApnsClient } from './apns.ts';
import { handleSendPush, type PushDb } from './handler.ts';

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
    const { data, error } = await admin
      .from('push_requests')
      .upsert(row, { onConflict: 'note_id,token', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },
  async releaseRequest(noteId, token) {
    const { error } = await admin.from('push_requests').delete().eq('note_id', noteId).eq('token', token);
    if (error) throw new Error(error.message);
  },
};

const apnsConfig = apnsConfigFromEnv((name) => Deno.env.get(name));
const apns = apnsConfig ? createApnsClient(apnsConfig) : null;

Deno.serve((req) => handleSendPush(req, { db, apns }));
