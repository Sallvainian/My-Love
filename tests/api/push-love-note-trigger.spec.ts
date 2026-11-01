/**
 * Story 3.1: a love note becomes a push request, over the wire against the
 * local stack. Story 3.4 adds a second `describe`: a mood, a photo, a poke and
 * a kiss do too (`{kind, id}` through `notify_push`). It lives in this file, not
 * a new one, because the "sender is down" test rewrites the one
 * `push_sender_settings` row and a parallel file's triggers would miss the sender.
 * Story 3.5 adds a third: an event added or changed, the wedding date, the date
 * the couple got together and a birthday each log a `date_changes` row and post
 * `{kind: 'date', id}`.
 * Story 3.6 adds a fourth: a partner request records on the asked person's
 * devices and its acceptance on the asker's (`{kind: 'partner_request' |
 * 'partner_accept', id}` through `notify_push`); a decline records nothing.
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
 * The first three describes use this worker's own pair (the sender is its
 * own account, the recipient its linked partner); every note and device token
 * they create is removed at the end, and nothing links, unlinks or resets that
 * pair. The fourth uses throwaway accounts: it links two of them through
 * `accept_partner_request` and deletes all four at the end.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.types';
import type { TypedSupabaseClient } from '../support/factories';
import { resolveOwnPair } from '../support/helpers/events';
import { createOutsiderClient, deleteOutsider } from '../support/helpers/rls-security';
import { getUserAccessToken } from '../support/helpers/supabase';
import { test, expect } from '../support/merged-fixtures';

/** The `push_requests` column that holds each kind of source row's id. */
type SourceColumn =
  | 'note_id'
  | 'mood_id'
  | 'photo_id'
  | 'interaction_id'
  | 'date_change_id'
  | 'partner_request_id'
  | 'partner_accept_id';

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
    for (const kind of ['mood', 'photo', 'interaction', 'date', 'partner_request', 'partner_accept']) {
      const missing = await postToSender(supabaseAdmin, { kind, id: randomUUID() });
      expect(missing.status, kind).toBe(404);
    }
  });
});

type DateSubject = 'event' | 'wedding_date' | 'relationship_start' | 'birthday';
interface ChangeFilter {
  senderId: string;
  subject: DateSubject;
  eventId?: string;
}

/** The `date_changes` rows matching the filter, oldest first. */
async function changesFor(supabaseAdmin: TypedSupabaseClient, filter: ChangeFilter) {
  let query = supabaseAdmin
    .from('date_changes')
    .select('id, action, created_at')
    .eq('sender_id', filter.senderId)
    .eq('subject', filter.subject);
  if (filter.eventId) query = query.eq('event_id', filter.eventId);
  const { data, error } = await query.order('created_at').order('id');
  if (error) throw new Error(`Failed to read date_changes: ${error.message}`);
  return data ?? [];
}

/**
 * Waits for exactly one change that is not in `known`, adds it to `known` and
 * returns it. Rows the worker's pair already held before the test are in `known`.
 */
async function awaitNewChange(supabaseAdmin: TypedSupabaseClient, filter: ChangeFilter, known: string[]) {
  let fresh: Awaited<ReturnType<typeof changesFor>> = [];
  await expect
    .poll(
      async () => {
        fresh = (await changesFor(supabaseAdmin, filter)).filter((c) => !known.includes(c.id));
        return fresh.length;
      },
      { message: `one new ${filter.subject} change is logged`, timeout: 20_000 }
    )
    .toBe(1);
  known.push(fresh[0].id);
  return fresh[0];
}

/** The trigger's call is asynchronous, so give a (wrongly) fired one time to land before asserting none did. */
async function expectNoNewChange(supabaseAdmin: TypedSupabaseClient, filter: ChangeFilter, known: string[]) {
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const fresh = (await changesFor(supabaseAdmin, filter)).filter((c) => !known.includes(c.id));
  expect(fresh).toEqual([]);
}

/** Waits for the sender to record `count` requests for a change and returns them. */
async function awaitDateRequests(supabaseAdmin: TypedSupabaseClient, changeId: string, count: number) {
  await expect
    .poll(async () => (await requestsFor(supabaseAdmin, changeId, 'date_change_id')).length, {
      message: `the sender records ${count} request(s) for the change`,
      timeout: 20_000,
    })
    .toBe(count);
  return requestsFor(supabaseAdmin, changeId, 'date_change_id');
}

test.describe('Date change push', () => {
  /** Registers two devices for the partner and one for the sender; removed at the end. */
  async function registerDevices(
    supabaseAdmin: TypedSupabaseClient,
    supabaseAsUser: TypedSupabaseClient,
    partnerId: string,
    cleanup: { defer: (name: string, fn: () => Promise<void>) => void }
  ) {
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [phone, tablet, senderPhone] = [newToken(), newToken(), newToken()];
    cleanup.defer('remove push devices', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [phone, tablet, senderPhone]);
    });
    expect((await partner.rpc('register_push_device', { p_token: phone, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: tablet, p_environment: 'production' })).error).toBeNull();
    expect(
      (await supabaseAsUser.rpc('register_push_device', { p_token: senderPhone, p_environment: 'sandbox' })).error
    ).toBeNull();
    return { phone, tablet, senderPhone };
  }

  /** Expects one recorded request per partner device carrying `body`, none for the sender's. */
  function expectPartnerRequests(
    rows: Awaited<ReturnType<typeof requestsFor>>,
    devices: { phone: string; tablet: string; senderPhone: string },
    title: string,
    body: string
  ) {
    expect(rows.map((r) => [r.token, r.environment, r.delivery]).sort()).toEqual(
      [
        [devices.phone, 'sandbox', 'recorded'],
        [devices.tablet, 'production', 'recorded'],
      ].sort()
    );
    expect(rows.some((r) => r.token === devices.senderPhone)).toBe(false);
    for (const row of rows) expect(row.payload).toEqual(partnerPayload(title, body));
  }

  /**
   * Puts the pair's `couple_settings` row in a known state (both dates NULL, as
   * the service role, which logs nothing) and restores what it held at the end.
   * Returns the pair's key and the ids of changes that already exist.
   */
  async function prepareCoupleSettings(
    supabaseAdmin: TypedSupabaseClient,
    userId: string,
    partnerId: string,
    cleanup: { defer: (name: string, fn: () => Promise<void>) => void }
  ) {
    const [userA, userB] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
    const { data: original, error } = await supabaseAdmin
      .from('couple_settings')
      .select('relationship_start, wedding_date')
      .eq('user_a', userA)
      .eq('user_b', userB)
      .maybeSingle();
    expect(error).toBeNull();
    const knownBefore = await Promise.all(
      (['wedding_date', 'relationship_start'] as const).map((subject) =>
        changesFor(supabaseAdmin, { senderId: userId, subject })
      )
    );
    const known = knownBefore.flat().map((c) => c.id);
    cleanup.defer('restore the pair\'s couple_settings', async () => {
      // As the service role (no session), so the restore logs and pushes nothing.
      if (original) {
        await supabaseAdmin.from('couple_settings').update(original).eq('user_a', userA).eq('user_b', userB);
      } else {
        await supabaseAdmin.from('couple_settings').delete().eq('user_a', userA).eq('user_b', userB);
      }
    });
    const { error: resetError } = await supabaseAdmin
      .from('couple_settings')
      .upsert(
        { user_a: userA, user_b: userB, relationship_start: null, wedding_date: null },
        { onConflict: 'user_a,user_b' }
      );
    expect(resetError).toBeNull();
    return { userA, userB, known };
  }

  test('[P0] an event added then edited records both for the partner only; unchanged saves, deletes and anniversaries record none', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const devices = await registerDevices(supabaseAdmin, supabaseAsUser, partnerId, cleanup);
    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const title = sender?.display_name?.trim() || 'Your partner';
    const anniversaryKey = randomUUID();
    let eventId: string | null = null;
    cleanup.defer('remove the event and anniversary', async () => {
      if (eventId) await supabaseAdmin.from('events').delete().eq('id', eventId);
      await supabaseAdmin.from('anniversaries').delete().eq('client_key', anniversaryKey);
    });

    const { data: event, error } = await supabaseAsUser
      .from('events')
      .insert({ user_id: userId, label: 'Paris trip', event_date: '2027-05-01' })
      .select('id')
      .single();
    expect(error).toBeNull();
    eventId = event!.id;
    const filter: ChangeFilter = { senderId: userId, subject: 'event', eventId: eventId! };
    const known: string[] = [];

    const added = await awaitNewChange(supabaseAdmin, filter, known);
    expect(added.action).toBe('added');
    expectPartnerRequests(await awaitDateRequests(supabaseAdmin, added.id, 2), devices, title, 'Added an event: Paris trip');

    // An edit is a new change for the same event.
    const edit = await supabaseAsUser.from('events').update({ event_date: '2027-05-02' }).eq('id', eventId!);
    expect(edit.error).toBeNull();
    const changed = await awaitNewChange(supabaseAdmin, filter, known);
    expect(changed.action).toBe('changed');
    expectPartnerRequests(
      await awaitDateRequests(supabaseAdmin, changed.id, 2),
      devices,
      title,
      'Changed an event: Paris trip'
    );

    // A save that rewrites the same values with a new updated_at records nothing.
    const unchanged = await supabaseAsUser
      .from('events')
      .update({
        label: 'Paris trip',
        event_date: '2027-05-02',
        description: null,
        icon: 'calendar',
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId!);
    expect(unchanged.error).toBeNull();
    await expectNoNewChange(supabaseAdmin, filter, known);

    // A replay of the trigger's own call is skipped for every device.
    const replay = await postToSender(supabaseAdmin, { kind: 'date', id: added.id });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 2 });

    // An anniversary has no trigger.
    const changesBefore = await supabaseAdmin
      .from('date_changes')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId);
    const anniversary = await supabaseAsUser
      .from('anniversaries')
      .insert({ user_id: userId, label: 'First date', event_date: '2026-01-01', client_key: anniversaryKey });
    expect(anniversary.error).toBeNull();

    // Deleting the event deletes its changes and their requests, and pushes nothing.
    const deleted = await supabaseAsUser.from('events').delete().eq('id', eventId!);
    expect(deleted.error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const changesAfter = await supabaseAdmin
      .from('date_changes')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId);
    expect(changesAfter.count).toBe((changesBefore.count ?? 0) - 2);
    expect(await changesFor(supabaseAdmin, filter)).toEqual([]);
    expect(await requestsFor(supabaseAdmin, added.id, 'date_change_id')).toEqual([]);
    expect(await requestsFor(supabaseAdmin, changed.id, 'date_change_id')).toEqual([]);
  });

  test('[P0] the wedding date set, changed and cleared records the first two only; a write with no session records none', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const devices = await registerDevices(supabaseAdmin, supabaseAsUser, partnerId, cleanup);
    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const title = sender?.display_name?.trim() || 'Your partner';
    const { userA, userB, known } = await prepareCoupleSettings(supabaseAdmin, userId, partnerId, cleanup);
    const baseline = [...known];
    const own = await clientFor(supabaseAdmin, userId);
    const filter: ChangeFilter = { senderId: userId, subject: 'wedding_date' };
    const write = (wedding_date: string | null) =>
      own.from('couple_settings').upsert({ user_a: userA, user_b: userB, wedding_date }, { onConflict: 'user_a,user_b' });
    cleanup.defer('remove the wedding date changes', async () => {
      await supabaseAdmin
        .from('date_changes')
        .delete()
        .eq('sender_id', userId)
        .eq('subject', 'wedding_date')
        .not('id', 'in', `(${baseline.join(',') || randomUUID()})`);
    });

    expect((await write('2027-06-12')).error).toBeNull();
    const set = await awaitNewChange(supabaseAdmin, filter, known);
    expect(set.action).toBe('added');
    expectPartnerRequests(await awaitDateRequests(supabaseAdmin, set.id, 2), devices, title, 'Set the wedding date');

    expect((await write('2027-06-13')).error).toBeNull();
    const changed = await awaitNewChange(supabaseAdmin, filter, known);
    expect(changed.action).toBe('changed');
    expectPartnerRequests(
      await awaitDateRequests(supabaseAdmin, changed.id, 2),
      devices,
      title,
      'Changed the wedding date'
    );

    // Cleared to NULL: nothing.
    expect((await write(null)).error).toBeNull();
    await expectNoNewChange(supabaseAdmin, filter, known);

    // The service role has no session, so the writer is unknown: nothing.
    const service = await supabaseAdmin
      .from('couple_settings')
      .update({ wedding_date: '2027-07-01' })
      .eq('user_a', userA)
      .eq('user_b', userB);
    expect(service.error).toBeNull();
    await expectNoNewChange(supabaseAdmin, filter, known);
  });

  test('[P0] the start date set then changed records "Set …" then "Changed …" for the partner', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const devices = await registerDevices(supabaseAdmin, supabaseAsUser, partnerId, cleanup);
    const { data: sender } = await supabaseAdmin.from('users').select('display_name').eq('id', userId).single();
    const title = sender?.display_name?.trim() || 'Your partner';
    const { userA, userB, known } = await prepareCoupleSettings(supabaseAdmin, userId, partnerId, cleanup);
    const baseline = [...known];
    const own = await clientFor(supabaseAdmin, userId);
    const filter: ChangeFilter = { senderId: userId, subject: 'relationship_start' };
    const write = (relationship_start: string) =>
      own
        .from('couple_settings')
        .upsert({ user_a: userA, user_b: userB, relationship_start }, { onConflict: 'user_a,user_b' });
    cleanup.defer('remove the start date changes', async () => {
      await supabaseAdmin
        .from('date_changes')
        .delete()
        .eq('sender_id', userId)
        .eq('subject', 'relationship_start')
        .not('id', 'in', `(${baseline.join(',') || randomUUID()})`);
    });

    expect((await write('2026-01-01T00:00:00Z')).error).toBeNull();
    const set = await awaitNewChange(supabaseAdmin, filter, known);
    expect(set.action).toBe('added');
    expectPartnerRequests(
      await awaitDateRequests(supabaseAdmin, set.id, 2),
      devices,
      title,
      'Set the date you got together'
    );

    expect((await write('2026-02-02T00:00:00Z')).error).toBeNull();
    const changed = await awaitNewChange(supabaseAdmin, filter, known);
    expect(changed.action).toBe('changed');
    expectPartnerRequests(
      await awaitDateRequests(supabaseAdmin, changed.id, 2),
      devices,
      title,
      'Changed the date you got together'
    );
  });

  test('[P0] a birthday set, saved again, changed and cleared records the first and third only', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const devices = await registerDevices(supabaseAdmin, supabaseAsUser, partnerId, cleanup);
    const { data: sender } = await supabaseAdmin
      .from('users')
      .select('display_name, birthday')
      .eq('id', userId)
      .single();
    const title = sender?.display_name?.trim() || 'Your partner';
    const filter: ChangeFilter = { senderId: userId, subject: 'birthday' };
    const known = (await changesFor(supabaseAdmin, filter)).map((c) => c.id);
    const baseline = [...known];
    cleanup.defer('restore the birthday and remove its changes', async () => {
      await supabaseAdmin.from('users').update({ birthday: sender?.birthday ?? null }).eq('id', userId);
      // Restoring a non-NULL birthday logs a change of its own; drop it with the test's.
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await supabaseAdmin
        .from('date_changes')
        .delete()
        .eq('sender_id', userId)
        .eq('subject', 'birthday')
        .not('id', 'in', `(${baseline.join(',') || randomUUID()})`);
    });
    const own = await clientFor(supabaseAdmin, userId);
    const write = (birthday: string | null) => own.from('users').update({ birthday }).eq('id', userId);

    // Start from no birthday (a NULL write logs nothing).
    expect((await supabaseAdmin.from('users').update({ birthday: null }).eq('id', userId)).error).toBeNull();

    expect((await write('1990-05-01')).error).toBeNull();
    const added = await awaitNewChange(supabaseAdmin, filter, known);
    expect(added.action).toBe('added');
    expectPartnerRequests(await awaitDateRequests(supabaseAdmin, added.id, 2), devices, title, 'Added their birthday');

    // The same value again: nothing.
    expect((await write('1990-05-01')).error).toBeNull();
    await expectNoNewChange(supabaseAdmin, filter, known);

    expect((await write('1990-05-02')).error).toBeNull();
    const changed = await awaitNewChange(supabaseAdmin, filter, known);
    expect(changed.action).toBe('changed');
    expectPartnerRequests(
      await awaitDateRequests(supabaseAdmin, changed.id, 2),
      devices,
      title,
      'Changed their birthday'
    );

    // Cleared to NULL: nothing.
    expect((await write(null)).error).toBeNull();
    await expectNoNewChange(supabaseAdmin, filter, known);
  });
});

test.describe('Partner request push', () => {
  /** A throwaway account with a display name; the cascade from `auth.users` removes everything it owns. */
  async function createParty(
    supabaseAdmin: TypedSupabaseClient,
    cleanup: { defer: (name: string, fn: () => Promise<unknown>) => void },
    role: string
  ) {
    const account = await createOutsiderClient(supabaseAdmin, `pushreq-${role}`);
    cleanup.defer(`delete throwaway account ${role}`, () => deleteOutsider(account));
    const name = `Push ${role.toUpperCase()} ${randomUUID().slice(0, 6)}`;
    const { error } = await account.client
      .from('users')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', account.userId);
    expect(error, `name ${role}`).toBeNull();
    return { ...account, name };
  }

  type Party = Awaited<ReturnType<typeof createParty>>;

  async function registerDevice(party: Party, environment: 'sandbox' | 'production') {
    const token = newToken();
    const { error } = await party.client.rpc('register_push_device', { p_token: token, p_environment: environment });
    expect(error).toBeNull();
    return token;
  }

  /** A pending request from `from` to `to`, sent as `from` itself; returns its id. */
  async function sendRequest(from: Party, to: Party): Promise<string> {
    const { data, error } = await from.client
      .from('partner_requests')
      .insert({ from_user_id: from.userId, to_user_id: to.userId, status: 'pending' })
      .select('id')
      .single();
    expect(error).toBeNull();
    return data!.id;
  }

  async function awaitRequests(
    supabaseAdmin: TypedSupabaseClient,
    requestId: string,
    column: SourceColumn,
    count: number
  ) {
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, requestId, column)).length, {
        message: `the sender records ${count} request(s) in ${column}`,
        timeout: 20_000,
      })
      .toBe(count);
    return requestsFor(supabaseAdmin, requestId, column);
  }

  const zeros = { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 };

  test('[P0] a request records on the asked person\'s devices only, and its acceptance on the asker\'s only; a decline and the auto-declined requests record none', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const asker = await createParty(supabaseAdmin, cleanup, 'a');
    const asked = await createParty(supabaseAdmin, cleanup, 'b');
    const rival = await createParty(supabaseAdmin, cleanup, 'c');
    const decliner = await createParty(supabaseAdmin, cleanup, 'd');
    const askerPhone = await registerDevice(asker, 'sandbox');
    const [phone, tablet] = [await registerDevice(asked, 'sandbox'), await registerDevice(asked, 'production')];
    const rivalPhone = await registerDevice(rival, 'sandbox');
    const declinerPhone = await registerDevice(decliner, 'sandbox');

    // ---- the request goes to the asked person's devices ----
    const accepted = await sendRequest(asker, asked);
    const requestRows = await awaitRequests(supabaseAdmin, accepted, 'partner_request_id', 2);
    expect(requestRows.map((r) => [r.token, r.environment, r.delivery]).sort()).toEqual(
      [
        [phone, 'sandbox', 'recorded'],
        [tablet, 'production', 'recorded'],
      ].sort()
    );
    for (const row of requestRows) {
      expect(row.payload).toEqual(partnerPayload(asker.name, 'Sent you a partner request'));
    }
    expect(await requestsFor(supabaseAdmin, accepted, 'partner_accept_id')).toEqual([]);

    // A second asker, and a request to another person that will be declined.
    const autoDeclined = await sendRequest(rival, asked);
    expect(await awaitRequests(supabaseAdmin, autoDeclined, 'partner_request_id', 2)).toHaveLength(2);
    const declined = await sendRequest(rival, decliner);
    const declinedRows = await awaitRequests(supabaseAdmin, declined, 'partner_request_id', 1);
    expect(declinedRows[0].token).toBe(declinerPhone);

    // A replayed request post is skipped for every device.
    const replay = await postToSender(supabaseAdmin, { kind: 'partner_request', id: accepted });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 2 });

    // A forged accept for a request that is still pending answers all zeros and claims nothing.
    const forged = await postToSender(supabaseAdmin, { kind: 'partner_accept', id: accepted });
    expect(forged.status).toBe(200);
    expect(await forged.json()).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, accepted, 'partner_accept_id')).toEqual([]);

    // ---- the acceptance goes to the asker's devices ----
    const accept = await asked.client.rpc('accept_partner_request', { p_request_id: accepted });
    expect(accept.error).toBeNull();
    const acceptRows = await awaitRequests(supabaseAdmin, accepted, 'partner_accept_id', 1);
    expect(acceptRows.map((r) => [r.token, r.environment, r.delivery])).toEqual([[askerPhone, 'sandbox', 'recorded']]);
    expect(acceptRows[0].payload).toEqual(partnerPayload(asked.name, 'Accepted your partner request'));

    // A replayed acceptance is skipped.
    const acceptReplay = await postToSender(supabaseAdmin, { kind: 'partner_accept', id: accepted });
    expect(acceptReplay.status).toBe(200);
    expect(await acceptReplay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 1 });

    // ---- a decline, and the request the accept declined, push nothing ----
    const decline = await decliner.client.rpc('decline_partner_request', { p_request_id: declined });
    expect(decline.error).toBeNull();
    const states = await supabaseAdmin
      .from('partner_requests')
      .select('id, status')
      .in('id', [accepted, autoDeclined, declined]);
    expect(states.error).toBeNull();
    expect(Object.fromEntries(states.data!.map((r) => [r.id, r.status]))).toEqual({
      [accepted]: 'accepted',
      [autoDeclined]: 'declined',
      [declined]: 'declined',
    });

    // The trigger's call is asynchronous, so give a (wrongly) fired one time to land.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(await requestsFor(supabaseAdmin, autoDeclined, 'partner_accept_id')).toEqual([]);
    expect(await requestsFor(supabaseAdmin, declined, 'partner_accept_id')).toEqual([]);
    expect((await requestsFor(supabaseAdmin, accepted, 'partner_accept_id')).map((r) => r.token)).toEqual([askerPhone]);

    // A forged accept for a declined request is refused too, and the rival's device stays empty.
    for (const id of [autoDeclined, declined]) {
      const refused = await postToSender(supabaseAdmin, { kind: 'partner_accept', id });
      expect(refused.status).toBe(200);
      expect(await refused.json()).toEqual(zeros);
    }
    expect(await requestsFor(supabaseAdmin, autoDeclined, 'partner_accept_id')).toEqual([]);
    expect(await requestsFor(supabaseAdmin, declined, 'partner_accept_id')).toEqual([]);
    const { data: rivalRows } = await supabaseAdmin
      .from('push_requests')
      .select('id')
      .eq('token', rivalPhone);
    expect(rivalRows).toEqual([]);
  });
});
