/**
 * Push triggers for the user's own writes, over the wire against the local
 * stack. Story 3.1: a love note becomes a push request, one per recipient
 * device; a retried upsert sends no second push; a token moves to the account
 * that registers it last; story 3.2's sign-out RPC, unregister_push_device,
 * removes only the caller's row; and a sender that is down leaves the insert
 * fast and committed. Story 3.7: the receiver's `push_preferences` switch. With
 * the partner's `love_notes` off a note records nothing on any of their
 * devices, and with it back on the next note records on both; one account
 * cannot read or write another's row. Story 3.8: every push carries the
 * recipient's unread love-note count as `aps.badge`, counted from the
 * partner's `love_notes_read_markers` row, which only `mark_love_notes_read()`
 * writes. The mood, photo, poke, kiss, added-date and partner-request pushes
 * are in `push-partner-activity-trigger.spec.ts`.
 *
 * Path under test: register_push_device (RPC, real user JWTs) -> the
 * `love_notes` AFTER INSERT trigger -> pg_net -> Kong -> the `send-push` Edge
 * Function -> `push_requests`. CI cannot reach APNs, so the sender runs with no
 * APNs key and records the request it would have sent (delivery `recorded`);
 * these cases read those rows. `supabase/functions/send-push/*.test.ts` proves
 * the payload and host rules; this file proves the trigger reaches the sender
 * and the sender reaches the right devices.
 *
 * The "sender is down" test rewrites the one `push_sender_settings` row, and a
 * trigger that fires meanwhile in any other file would miss the sender. The
 * `api` Playwright project runs one worker (`workers: 1` in
 * `playwright.config.ts`), so no other api file runs beside this one, and the
 * describes here run in order (serial mode).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI) and `supabase/seed.sql` applied, which holds
 * the local sender URL and secret in `push_sender_settings`.
 *
 * Every describe uses this worker's own pair (the sender is its own account,
 * the recipient its linked partner); every note, device token, switch row and
 * read marker it creates is removed at the end, and nothing links, unlinks or
 * resets that pair.
 */
import { randomUUID } from 'node:crypto';
import { resolveOwnPair } from '../support/helpers/events';
import {
  clientFor,
  newToken,
  postToSender,
  recordedAps,
  requestsFor,
  uniqueMoodTime,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

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
        kind: 'love_note',
        aps: {
          alert: { title: sender?.display_name?.trim() || 'Your partner', body: 'Thinking of you' },
          'thread-id': 'love-notes',
          badge: expect.any(Number),
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

    // The retry inserted no row (its data is empty above), so the AFTER INSERT
    // trigger had nothing to fire for: one row, and one request.
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

test.describe('Push switches', () => {
  test('[P0] a switch off stops the push on every device, and on restores it; no one else can touch the row', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [phone, tablet] = [newToken(), newToken()];
    const noteKeys = [randomUUID(), randomUUID(), randomUUID()];
    const pokeIds: string[] = [];
    cleanup.defer('remove push devices, notes, the poke and the partner\'s switches', async () => {
      await supabaseAdmin.from('push_preferences').delete().eq('user_id', partnerId);
      await supabaseAdmin.from('push_devices').delete().in('token', [phone, tablet]);
      await supabaseAdmin.from('love_notes').delete().in('idempotency_key', noteKeys);
      if (pokeIds.length > 0) await supabaseAdmin.from('interactions').delete().in('id', pokeIds);
    });

    expect((await partner.rpc('register_push_device', { p_token: phone, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: tablet, p_environment: 'production' })).error).toBeNull();

    const sendNote = async (idempotencyKey: string) => {
      const { data, error } = await supabaseAsUser
        .from('love_notes')
        .insert({ from_user_id: userId, to_user_id: partnerId, content: 'Switch test', idempotency_key: idempotencyKey })
        .select('id')
        .single();
      expect(error).toBeNull();
      return data!.id;
    };

    // ---- the receiver switches love notes off, one column per write ----
    const off = await partner
      .from('push_preferences')
      .upsert({ user_id: partnerId, love_notes: false }, { onConflict: 'user_id' })
      .select('love_notes, moods')
      .single();
    expect(off.error).toBeNull();
    expect(off.data).toEqual({ love_notes: false, moods: true });

    // A second switch, written on its own, leaves the first as it was.
    const second = await partner
      .from('push_preferences')
      .upsert({ user_id: partnerId, moods: false }, { onConflict: 'user_id' })
      .select('love_notes, moods')
      .single();
    expect(second.error).toBeNull();
    expect(second.data).toEqual({ love_notes: false, moods: false });

    // ---- off: a note records nothing on any of their devices ----
    const silenced = await sendNote(noteKeys[0]);
    // A poke sent after it (pokes and kisses stay on) is the barrier: once the
    // sender has recorded the poke, a request for the note would have landed too.
    const { data: poke, error: pokeError } = await supabaseAsUser
      .from('interactions')
      .insert({ from_user_id: userId, to_user_id: partnerId, type: 'poke', viewed: false })
      .select('id')
      .single();
    expect(pokeError).toBeNull();
    pokeIds.push(poke!.id);
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, poke!.id, 'interaction_id')).length, {
        message: 'the sender records the poke sent after the silenced note',
        timeout: 20_000,
      })
      .toBe(2);
    expect(await requestsFor(supabaseAdmin, silenced)).toEqual([]);

    const direct = await postToSender(supabaseAdmin, { note_id: silenced });
    expect(direct.status).toBe(200);
    expect(await direct.json()).toEqual({ sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 });
    expect(await requestsFor(supabaseAdmin, silenced)).toEqual([]);

    // ---- on again: the next note records on both devices ----
    const on = await partner
      .from('push_preferences')
      .upsert({ user_id: partnerId, love_notes: true }, { onConflict: 'user_id' })
      .select('love_notes, moods')
      .single();
    expect(on.error).toBeNull();
    expect(on.data).toEqual({ love_notes: true, moods: false });

    const heard = await sendNote(noteKeys[1]);
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, heard)).length, {
        message: 'the sender records a request for each of the recipient\'s devices',
        timeout: 20_000,
      })
      .toBe(2);
    expect((await requestsFor(supabaseAdmin, heard)).map((r) => r.token).sort()).toEqual([phone, tablet].sort());

    // ---- the sender's own client cannot see or change the receiver's row ----
    const peek = await supabaseAsUser.from('push_preferences').select('*').eq('user_id', partnerId);
    expect(peek.error).toBeNull();
    expect(peek.data).toEqual([]);

    const tamper = await supabaseAsUser
      .from('push_preferences')
      .update({ love_notes: false })
      .eq('user_id', partnerId)
      .select('user_id');
    expect(tamper.error).toBeNull();
    expect(tamper.data).toEqual([]);

    const forge = await supabaseAsUser
      .from('push_preferences')
      .upsert({ user_id: partnerId, love_notes: false }, { onConflict: 'user_id' });
    expect(forge.error).not.toBeNull();

    const { data: stored } = await supabaseAdmin
      .from('push_preferences')
      .select('love_notes, moods')
      .eq('user_id', partnerId)
      .single();
    expect(stored).toEqual({ love_notes: true, moods: false });

    // The receiver's own row cannot be deleted by the receiver either.
    const del = await partner.from('push_preferences').delete().eq('user_id', partnerId);
    expect(del.error).not.toBeNull();

    // Another switch off never stops this kind: the note above went out with moods off.
    const afterwards = await sendNote(noteKeys[2]);
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, afterwards)).length, { timeout: 20_000 })
      .toBe(2);
  });
});

test.describe('Badge', () => {
  test('[P0] every push carries the partner\'s unread love notes, and opening Love Notes resets the count', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const device = newToken();
    const noteKeys = [randomUUID(), randomUUID(), randomUUID()];
    const moodTime = uniqueMoodTime();
    cleanup.defer('remove push devices, notes, the mood and the partner\'s marker', async () => {
      await supabaseAdmin.from('love_notes_read_markers').delete().eq('user_id', partnerId);
      await supabaseAdmin.from('push_devices').delete().eq('token', device);
      await supabaseAdmin.from('love_notes').delete().in('idempotency_key', noteKeys);
      await supabaseAdmin.from('moods').delete().eq('user_id', userId).eq('created_at', moodTime);
    });
    expect((await partner.rpc('register_push_device', { p_token: device, p_environment: 'sandbox' })).error).toBeNull();

    /** Sends a note from the user and waits for the sender's recorded request, so counts cannot overlap. */
    const sendNote = async (idempotencyKey: string) => {
      const { data, error } = await supabaseAsUser
        .from('love_notes')
        .insert({ from_user_id: userId, to_user_id: partnerId, content: 'Badge test', idempotency_key: idempotencyKey })
        .select('id')
        .single();
      expect(error).toBeNull();
      await expect
        .poll(async () => (await requestsFor(supabaseAdmin, data!.id)).length, {
          message: 'the sender records the note\'s push',
          timeout: 20_000,
        })
        .toBe(1);
      return data!.id;
    };

    // The partner opens Love Notes: the marker is the server's now.
    expect((await partner.rpc('mark_love_notes_read')).error).toBeNull();

    // ---- two notes from the user: the badge counts them as they arrive ----
    const first = await sendNote(noteKeys[0]);
    expect(await recordedAps(supabaseAdmin, first, 'note_id')).toEqual({ badge: 1, threadId: 'love-notes' });
    const second = await sendNote(noteKeys[1]);
    expect(await recordedAps(supabaseAdmin, second, 'note_id')).toEqual({ badge: 2, threadId: 'love-notes' });

    // ---- a mood carries the same count, on the other thread ----
    const { data: mood, error } = await supabaseAsUser
      .from('moods')
      .upsert(
        { user_id: userId, mood_type: 'happy', mood_types: ['happy'], created_at: moodTime },
        { onConflict: 'user_id,created_at' }
      )
      .select('id')
      .single();
    expect(error).toBeNull();
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, mood!.id, 'mood_id')).length, {
        message: 'the sender records the mood\'s push',
        timeout: 20_000,
      })
      .toBe(1);
    expect(await recordedAps(supabaseAdmin, mood!.id, 'mood_id')).toEqual({
      badge: 2,
      threadId: 'partner-activity',
    });

    // ---- the partner opens Love Notes again: the next note counts 1 ----
    expect((await partner.rpc('mark_love_notes_read')).error).toBeNull();
    const third = await sendNote(noteKeys[2]);
    expect(await recordedAps(supabaseAdmin, third, 'note_id')).toEqual({ badge: 1, threadId: 'love-notes' });

    // ---- the marker is the partner's own, and no client can write it ----
    const peek = await supabaseAsUser.from('love_notes_read_markers').select('*').eq('user_id', partnerId);
    expect(peek.error).toBeNull();
    expect(peek.data).toEqual([]);
    const forge = await partner
      .from('love_notes_read_markers')
      .upsert({ user_id: partnerId, last_opened_at: '2000-01-01T00:00:00Z' }, { onConflict: 'user_id' });
    expect(forge.error).not.toBeNull();
    const count = await partner.rpc('unread_love_note_count', { p_user_id: partnerId });
    expect(count.error).not.toBeNull();
  });
});
