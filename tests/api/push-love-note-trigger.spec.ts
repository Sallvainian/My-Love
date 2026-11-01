/**
 * Story 3.1: a love note becomes a push request, over the wire against the
 * local stack. Story 3.4 adds a second `describe`: a mood, a photo, a poke and
 * a kiss do too (`{kind, id}` through `notify_push`). It lives in this file, not
 * a new one, because the "sender is down" test rewrites the one
 * `push_sender_settings` row and a parallel file's triggers would miss the sender.
 *
 * Path under test: register_push_device (RPC, real user JWTs) -> the
 * `love_notes` AFTER INSERT trigger -> pg_net -> Kong -> the `send-push` Edge
 * Function -> `push_requests`. CI cannot reach APNs, so the sender runs with no
 * APNs key and records the request it would have sent (delivery `recorded`);
 * these cases read those rows. `supabase/functions/send-push/*.test.ts` proves
 * the payload and host rules; this file proves the trigger reaches the sender
 * and the sender reaches the right devices. Story 3.2 adds the sign-out
 * RPC, unregister_push_device, over the same real JWTs.
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI) and `supabase/seed.sql` applied, which holds
 * the local sender URL and secret in `push_sender_settings`.
 *
 * The sender is this worker's own account and the recipient its linked
 * partner; every note and device token this spec creates is removed at the
 * end, and nothing links, unlinks or resets an account.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.types';
import type { TypedSupabaseClient } from '../support/factories';
import { resolveOwnPair } from '../support/helpers/events';
import { getUserAccessToken } from '../support/helpers/supabase';
import { test, expect } from '../support/merged-fixtures';

/** The `push_requests` column that holds each kind of source row's id. */
type SourceColumn = 'note_id' | 'mood_id' | 'photo_id' | 'interaction_id';

/** Rows the sender records for a note (or another source row), ordered by token. */
async function requestsFor(
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
async function clientFor(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<TypedSupabaseClient> {
  const accessToken = await getUserAccessToken(supabaseAdmin, userId);
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

const newToken = () => `test-${randomUUID().replace(/-/g, '')}`;

test.describe.configure({ mode: 'serial' });

test.describe('Love note push trigger', () => {
  test('[P0] a text note records one request per recipient device, none for the sender', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [phone, tablet, senderPhone] = [newToken(), newToken(), newToken()];
    const noteKey = randomUUID();
    cleanup.defer('remove push devices and notes', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [phone, tablet, senderPhone]);
      await supabaseAdmin.from('love_notes').delete().eq('idempotency_key', noteKey);
    });

    expect((await partner.rpc('register_push_device', { p_token: phone, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: tablet, p_environment: 'production' })).error).toBeNull();
    expect(
      (await supabaseAsUser.rpc('register_push_device', { p_token: senderPhone, p_environment: 'sandbox' })).error
    ).toBeNull();

    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const { data: note, error } = await supabaseAsUser
      .from('love_notes')
      .insert({ from_user_id: userId, to_user_id: partnerId, content: 'Thinking of you', idempotency_key: noteKey })
      .select('id')
      .single();
    expect(error).toBeNull();

    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, note!.id)).length, {
        message: 'the sender records a request for each of the recipient\'s devices',
        timeout: 20_000,
      })
      .toBe(2);

    const rows = await requestsFor(supabaseAdmin, note!.id);
    expect(rows.map((r) => [r.token, r.environment, r.delivery]).sort()).toEqual(
      [
        [phone, 'sandbox', 'recorded'],
        [tablet, 'production', 'recorded'],
      ].sort()
    );
    expect(rows.some((r) => r.token === senderPhone)).toBe(false);
    for (const row of rows) {
      expect(row.payload).toEqual({
        aps: {
          alert: { title: sender?.display_name?.trim() || 'Your partner', body: 'Thinking of you' },
          'thread-id': 'love-notes',
        },
      });
    }
  });

  test('[P0] a picture-only note says a picture was sent', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const token = newToken();
    const noteKey = randomUUID();
    cleanup.defer('remove push device and note', async () => {
      await supabaseAdmin.from('push_devices').delete().eq('token', token);
      await supabaseAdmin.from('love_notes').delete().eq('idempotency_key', noteKey);
    });
    expect((await partner.rpc('register_push_device', { p_token: token, p_environment: 'sandbox' })).error).toBeNull();

    const { data: note, error } = await supabaseAsUser
      .from('love_notes')
      .insert({
        from_user_id: userId,
        to_user_id: partnerId,
        content: ' ',
        image_url: `${userId}/${randomUUID()}.jpg`,
        idempotency_key: noteKey,
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, note!.id)).length, { timeout: 20_000 })
      .toBe(1);
    const [row] = await requestsFor(supabaseAdmin, note!.id);
    expect((row.payload as { aps: { alert: { body: string } } }).aps.alert.body).toBe('Sent you a picture');
  });

  test('[P0] a retried upsert is one row and sends no second push', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const token = newToken();
    const noteKey = randomUUID();
    cleanup.defer('remove push device and note', async () => {
      await supabaseAdmin.from('push_devices').delete().eq('token', token);
      await supabaseAdmin.from('love_notes').delete().eq('idempotency_key', noteKey);
    });
    expect((await partner.rpc('register_push_device', { p_token: token, p_environment: 'sandbox' })).error).toBeNull();

    const send = () =>
      supabaseAsUser
        .from('love_notes')
        .upsert(
          { from_user_id: userId, to_user_id: partnerId, content: 'Once', idempotency_key: noteKey },
          { onConflict: 'from_user_id,idempotency_key', ignoreDuplicates: true }
        )
        .select('id');

    const first = await send();
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    const noteId = first.data![0].id;

    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, noteId)).length, { timeout: 20_000 })
      .toBe(1);

    const retry = await send();
    expect(retry.error).toBeNull();
    expect(retry.data).toHaveLength(0);

    // The same note id posted to the sender again (a retried trigger call) hits
    // the real push_requests upsert: every device is skipped, nothing recorded.
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('push_sender_settings')
      .select('sender_secret')
      .single();
    expect(settingsError).toBeNull();
    const replay = await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': settings!.sender_secret,
      },
      body: JSON.stringify({ note_id: noteId }),
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 1 });
    expect(await requestsFor(supabaseAdmin, noteId)).toHaveLength(1);

    // The trigger's call is asynchronous, so give a (wrongly) fired second one
    // time to land before asserting that none did.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(await requestsFor(supabaseAdmin, noteId)).toHaveLength(1);
    const { count } = await supabaseAdmin
      .from('love_notes')
      .select('id', { count: 'exact', head: true })
      .eq('from_user_id', userId)
      .eq('idempotency_key', noteKey);
    expect(count).toBe(1);
  });

  test('[P0] a token registered again by the other account moves to it', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const token = newToken();
    cleanup.defer('remove push device', async () => {
      await supabaseAdmin.from('push_devices').delete().eq('token', token);
    });

    expect((await supabaseAsUser.rpc('register_push_device', { p_token: token, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: token, p_environment: 'production' })).error).toBeNull();

    const { data } = await supabaseAdmin.from('push_devices').select('user_id, environment').eq('token', token);
    expect(data).toEqual([{ user_id: partnerId, environment: 'production' }]);
    expect(userId).not.toBe(partnerId);

    const refused = await partner.rpc('register_push_device', { p_token: newToken(), p_environment: 'staging' });
    expect(refused.error?.code).toBe('23514');
  });

  test('[P0] unregister_push_device removes the caller\'s row and leaves another account\'s', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [own, partners] = [newToken(), newToken()];
    cleanup.defer('remove push devices', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [own, partners]);
    });

    expect((await supabaseAsUser.rpc('register_push_device', { p_token: own, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: partners, p_environment: 'sandbox' })).error).toBeNull();

    // Sign-out sends this device's token; one held by another account is untouched.
    expect((await supabaseAsUser.rpc('unregister_push_device', { p_token: partners })).error).toBeNull();
    expect((await supabaseAsUser.rpc('unregister_push_device', { p_token: own })).error).toBeNull();

    const { data, error } = await supabaseAdmin
      .from('push_devices')
      .select('token, user_id')
      .in('token', [own, partners]);
    expect(error).toBeNull();
    expect(data).toEqual([{ token: partners, user_id: partnerId }]);
    expect(userId).not.toBe(partnerId);
  });

  test('[P0] a sender that is down leaves the insert fast and committed', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const noteKey = randomUUID();

    const { data: original, error: readError } = await supabaseAdmin
      .from('push_sender_settings')
      .select('sender_url, sender_secret')
      .single();
    expect(readError, 'seed.sql provides the local sender settings').toBeNull();

    cleanup.defer('restore the sender settings and remove the note', async () => {
      await supabaseAdmin.from('push_sender_settings').update({ sender_url: original!.sender_url }).eq('singleton', true);
      await supabaseAdmin.from('love_notes').delete().eq('idempotency_key', noteKey);
    });
    // A port nothing listens on, and a non-routable address that never answers.
    for (const unreachable of ['http://supabase_kong_My-Love:9/send-push', 'http://10.255.255.1:81/send-push']) {
      const { error: updateError } = await supabaseAdmin
        .from('push_sender_settings')
        .update({ sender_url: unreachable })
        .eq('singleton', true);
      expect(updateError).toBeNull();

      const key = noteKey;
      const started = Date.now();
      const { data, error } = await supabaseAsUser
        .from('love_notes')
        .upsert(
          { from_user_id: userId, to_user_id: partnerId, content: `down ${unreachable}`, idempotency_key: key },
          { onConflict: 'from_user_id,idempotency_key', ignoreDuplicates: true }
        )
        .select('id');
      const elapsed = Date.now() - started;

      // The unreachable sender's own timeout is 2 s; the insert must not wait for it.
      expect(error).toBeNull();
      expect(elapsed, `insert took ${elapsed} ms`).toBeLessThan(1_500);
      // Each pass deletes its note below, so each one inserts a new row.
      expect(data).toHaveLength(1);
      const { count } = await supabaseAdmin
        .from('love_notes')
        .select('id', { count: 'exact', head: true })
        .eq('from_user_id', userId)
        .eq('idempotency_key', key);
      expect(count).toBe(1);
      await supabaseAdmin.from('love_notes').delete().eq('idempotency_key', key);
    }
  });
});

/** The R7 text each partner-activity push carries. */
const partnerPayload = (title: string, body: string) => ({
  aps: { alert: { title, body }, 'thread-id': 'partner-activity' },
});

/** Posts `{kind, id}` to the sender as the trigger does, with the secret from the settings row. */
async function postToSender(supabaseAdmin: TypedSupabaseClient, body: Record<string, unknown>) {
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
const uniqueMoodTime = () => new Date(Date.now() - 86_400_000 - Math.floor(Math.random() * 1e9)).toISOString();

test.describe('Mood, photo, poke and kiss push', () => {
  test('[P0] a mood records the labels for the partner\'s devices only, and a re-send adds none', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [phone, tablet, senderPhone] = [newToken(), newToken(), newToken()];
    const createdAt = uniqueMoodTime();
    cleanup.defer('remove push devices and mood', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [phone, tablet, senderPhone]);
      await supabaseAdmin.from('moods').delete().eq('user_id', userId).eq('created_at', createdAt);
    });
    expect((await partner.rpc('register_push_device', { p_token: phone, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: tablet, p_environment: 'production' })).error).toBeNull();
    expect(
      (await supabaseAsUser.rpc('register_push_device', { p_token: senderPhone, p_environment: 'sandbox' })).error
    ).toBeNull();

    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const title = sender?.display_name?.trim() || 'Your partner';

    const { data: mood, error } = await supabaseAsUser
      .from('moods')
      .upsert(
        { user_id: userId, mood_type: 'happy', mood_types: ['happy', 'grateful'], note: 'a private note', created_at: createdAt },
        { onConflict: 'user_id,created_at' }
      )
      .select('id')
      .single();
    expect(error).toBeNull();

    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, mood!.id, 'mood_id')).length, {
        message: 'the sender records a request for each of the partner\'s devices',
        timeout: 20_000,
      })
      .toBe(2);
    const rows = await requestsFor(supabaseAdmin, mood!.id, 'mood_id');
    expect(rows.map((r) => [r.token, r.environment, r.delivery]).sort()).toEqual(
      [
        [phone, 'sandbox', 'recorded'],
        [tablet, 'production', 'recorded'],
      ].sort()
    );
    for (const row of rows) {
      expect(row.payload).toEqual(partnerPayload(title, 'Logged a mood: Happy, Grateful'));
    }

    // The same (user_id, created_at) sent again is merged into the row: no INSERT, no push.
    const resent = await supabaseAsUser
      .from('moods')
      .upsert(
        { user_id: userId, mood_type: 'sad', mood_types: ['sad'], created_at: createdAt },
        { onConflict: 'user_id,created_at' }
      )
      .select('id');
    expect(resent.error).toBeNull();
    expect(resent.data).toEqual([{ id: mood!.id }]);

    // The trigger's call is asynchronous, so give a (wrongly) fired one time to land.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const after = await requestsFor(supabaseAdmin, mood!.id, 'mood_id');
    expect(after).toEqual(rows);
    const { count } = await supabaseAdmin
      .from('moods')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('created_at', createdAt);
    expect(count).toBe(1);

    // A replay of the trigger's own call is skipped per device, nothing recorded.
    const replay = await postToSender(supabaseAdmin, { kind: 'mood', id: mood!.id });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 2 });
    expect(await requestsFor(supabaseAdmin, mood!.id, 'mood_id')).toEqual(rows);
  });

  test('[P0] a photo records "Added a photo" for the partner, and a retry ignored on storage_path adds none', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [token, senderPhone] = [newToken(), newToken()];
    const storagePath = `${userId}/${randomUUID()}.jpg`;
    cleanup.defer('remove push devices and photo', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [token, senderPhone]);
      await supabaseAdmin.from('photos').delete().eq('storage_path', storagePath);
    });
    expect((await partner.rpc('register_push_device', { p_token: token, p_environment: 'sandbox' })).error).toBeNull();
    expect(
      (await supabaseAsUser.rpc('register_push_device', { p_token: senderPhone, p_environment: 'sandbox' })).error
    ).toBeNull();
    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();

    const send = () =>
      supabaseAsUser
        .from('photos')
        .upsert(
          { user_id: userId, storage_path: storagePath, filename: 'p.jpg', file_size: 1000, width: 10, height: 10 },
          { onConflict: 'storage_path', ignoreDuplicates: true }
        )
        .select('id');
    const first = await send();
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    const photoId = first.data![0].id;

    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, photoId, 'photo_id')).length, { timeout: 20_000 })
      .toBe(1);
    const [row] = await requestsFor(supabaseAdmin, photoId, 'photo_id');
    expect(row.token).toBe(token);
    expect(row.payload).toEqual(partnerPayload(sender?.display_name?.trim() || 'Your partner', 'Added a photo'));

    const retry = await send();
    expect(retry.error).toBeNull();
    expect(retry.data).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(await requestsFor(supabaseAdmin, photoId, 'photo_id')).toHaveLength(1);
  });

  test('[P0] a poke and a kiss each record their text for the partner', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [token, senderPhone] = [newToken(), newToken()];
    const interactionIds: string[] = [];
    cleanup.defer('remove push devices and interactions', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [token, senderPhone]);
      if (interactionIds.length > 0) await supabaseAdmin.from('interactions').delete().in('id', interactionIds);
    });
    expect((await partner.rpc('register_push_device', { p_token: token, p_environment: 'sandbox' })).error).toBeNull();
    expect(
      (await supabaseAsUser.rpc('register_push_device', { p_token: senderPhone, p_environment: 'sandbox' })).error
    ).toBeNull();
    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const title = sender?.display_name?.trim() || 'Your partner';

    for (const [type, body] of [
      ['poke', 'Poked you'],
      ['kiss', 'Sent you a kiss'],
    ] as const) {
      const { data: interaction, error } = await supabaseAsUser
        .from('interactions')
        .insert({ from_user_id: userId, to_user_id: partnerId, type, viewed: false })
        .select('id')
        .single();
      expect(error).toBeNull();
      interactionIds.push(interaction!.id);

      await expect
        .poll(async () => (await requestsFor(supabaseAdmin, interaction!.id, 'interaction_id')).length, {
          message: `the sender records a ${type}`,
          timeout: 20_000,
        })
        .toBe(1);
      const [row] = await requestsFor(supabaseAdmin, interaction!.id, 'interaction_id');
      expect(row.token).toBe(token);
      expect(row.payload).toEqual(partnerPayload(title, body));

      // The same {kind, id} posted again is skipped.
      const replay = await postToSender(supabaseAdmin, { kind: 'interaction', id: interaction!.id });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 1 });
      expect(await requestsFor(supabaseAdmin, interaction!.id, 'interaction_id')).toHaveLength(1);
    }
  });

  test('[P1] the sender refuses an unknown kind and a non-uuid id, and finds no row for a missing one', async ({
    supabaseAdmin,
  }) => {
    const unknownKind = await postToSender(supabaseAdmin, { kind: 'dance', id: randomUUID() });
    expect(unknownKind.status).toBe(400);
    const badId = await postToSender(supabaseAdmin, { kind: 'mood', id: 'not-a-uuid' });
    expect(badId.status).toBe(400);
    for (const kind of ['mood', 'photo', 'interaction']) {
      const missing = await postToSender(supabaseAdmin, { kind, id: randomUUID() });
      expect(missing.status, kind).toBe(404);
    }
  });
});
