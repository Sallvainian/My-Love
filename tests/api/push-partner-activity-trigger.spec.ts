/**
 * Push triggers for the partner's activity, over the wire against the local
 * stack. Story 3.4: a mood, a photo, a poke and a kiss each become a push
 * request (`{kind, id}` through `notify_push`) for the partner's devices only.
 * Story 3.5 added a push for an event, the wedding date, the date the couple
 * got together and a birthday; story 5.4 removed it; since 2026-11-05 an added
 * event or anniversary pushes again (`{kind: 'event' | 'anniversary', id}`
 * through `notify_push`), so the second describe asserts an added event and
 * anniversary record on the partner's devices, while their edits, the wedding
 * date, the start date and a birthday record nothing; the trigger set is pinned
 * by `supabase/tests/database/35_push_devices.sql`. Story 3.6: a partner
 * request records on the asked person's devices and its acceptance on the
 * asker's (`{kind: 'partner_request' | 'partner_accept', id}` through
 * `notify_push`); a decline records nothing. The describes here assert only
 * that the badge is a number, since their recipients' read markers are not
 * theirs to set; the love-note pushes, the switches and the badge count are in
 * `push-love-note-trigger.spec.ts`.
 *
 * Path under test: the source table's AFTER trigger -> pg_net -> Kong -> the
 * `send-push` Edge Function -> `push_requests`, with devices registered through
 * register_push_device over real user JWTs. CI cannot reach APNs, so the sender
 * records the request it would have sent (delivery `recorded`); these cases
 * read those rows.
 *
 * `push-love-note-trigger.spec.ts`'s "sender is down" test rewrites the one
 * `push_sender_settings` row, and a trigger that fires here meanwhile would miss
 * the sender. The `api` Playwright project runs one worker (`workers: 1` in
 * `playwright.config.ts`), so the two files never run at once; the describes
 * here run in order (serial mode).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI) and `supabase/seed.sql` applied, which holds
 * the local sender URL and secret in `push_sender_settings`.
 *
 * The first two describes use this worker's own pair (the sender is its own
 * account, the recipient its linked partner); every row they create is removed
 * at the end, and nothing links, unlinks or resets that pair. The third uses
 * throwaway accounts: it links two of them through `accept_partner_request` and
 * deletes all four at the end.
 */
import { randomUUID } from 'node:crypto';
import type { TypedSupabaseClient } from '../support/factories';
import { resolveOwnPair } from '../support/helpers/events';
import {
  clientFor,
  newToken,
  partnerPayload,
  postToSender,
  requestsFor,
  uniqueMoodTime,
  type SourceColumn,
} from '../support/helpers/push-requests';
import { createOutsiderClient, deleteOutsider } from '../support/helpers/rls-security';
import { test, expect } from '../support/merged-fixtures';

test.describe.configure({ mode: 'serial' });

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
      expect(row.payload).toEqual(partnerPayload('mood', title, 'Logged a mood: Happy, Grateful'));
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
    expect(row.payload).toEqual(partnerPayload('photo', sender?.display_name?.trim() || 'Your partner', 'Added a photo'));

    const retry = await send();
    expect(retry.error).toBeNull();
    expect(retry.data).toHaveLength(0);
    // The retry inserted no row, so no trigger fired; a replay of the first
    // one's own call is skipped, nothing recorded.
    const replay = await postToSender(supabaseAdmin, { kind: 'photo', id: photoId });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ recorded: 0, sent: 0, skipped: 1 });
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
      expect(row.payload).toEqual(partnerPayload('interaction', title, body));

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
    // Story 5.4 removed the date kind: a post from an older trigger is refused like any unknown kind.
    const oldDate = await postToSender(supabaseAdmin, { kind: 'date', id: randomUUID() });
    expect(oldDate.status).toBe(400);
    for (const kind of ['mood', 'photo', 'interaction', 'partner_request', 'partner_accept', 'event', 'anniversary']) {
      const missing = await postToSender(supabaseAdmin, { kind, id: randomUUID() });
      expect(missing.status, kind).toBe(404);
    }
  });
});

test.describe('Added dates push, date changes do not', () => {
  test('[P0] an added event and anniversary record for the partner; their edits, the wedding date, the start date and a birthday record none', async ({
    supabaseAdmin,
    supabaseAsUser,
    cleanup,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const partner = await clientFor(supabaseAdmin, partnerId);
    const [phone, tablet] = [newToken(), newToken()];
    const createdAt = uniqueMoodTime();
    let eventId: string | null = null;
    let anniversaryId: string | null = null;
    const [userA, userB] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
    const [{ data: original, error: originalError }, { data: sender, error: senderError }] = await Promise.all([
      supabaseAdmin
        .from('couple_settings')
        .select('relationship_start, wedding_date')
        .eq('user_a', userA)
        .eq('user_b', userB)
        .maybeSingle(),
      supabaseAdmin.from('users').select('birthday').eq('id', userId).single(),
    ]);
    expect(originalError).toBeNull();
    expect(senderError).toBeNull();
    cleanup.defer('remove push devices, event and mood, restore the dates', async () => {
      await supabaseAdmin.from('push_devices').delete().in('token', [phone, tablet]);
      await supabaseAdmin.from('moods').delete().eq('user_id', userId).eq('created_at', createdAt);
      if (eventId) await supabaseAdmin.from('events').delete().eq('id', eventId);
      if (anniversaryId) await supabaseAdmin.from('anniversaries').delete().eq('id', anniversaryId);
      if (original) {
        await supabaseAdmin.from('couple_settings').update(original).eq('user_a', userA).eq('user_b', userB);
      } else {
        await supabaseAdmin.from('couple_settings').delete().eq('user_a', userA).eq('user_b', userB);
      }
      await supabaseAdmin.from('users').update({ birthday: sender?.birthday ?? null }).eq('id', userId);
    });

    expect((await partner.rpc('register_push_device', { p_token: phone, p_environment: 'sandbox' })).error).toBeNull();
    expect((await partner.rpc('register_push_device', { p_token: tablet, p_environment: 'production' })).error).toBeNull();

    // Both dates start empty, so each write below is a first set and then a change.
    const { error: resetError } = await supabaseAdmin
      .from('couple_settings')
      .upsert(
        { user_a: userA, user_b: userB, relationship_start: null, wedding_date: null },
        { onConflict: 'user_a,user_b' }
      );
    expect(resetError).toBeNull();
    expect((await supabaseAdmin.from('users').update({ birthday: null }).eq('id', userId)).error).toBeNull();

    // The user's own writes, as the app makes them.
    const { data: event, error: eventError } = await supabaseAsUser
      .from('events')
      .insert({ user_id: userId, label: 'Paris trip', event_date: '2027-05-01' })
      .select('id')
      .single();
    expect(eventError).toBeNull();
    eventId = event!.id;
    expect((await supabaseAsUser.from('events').update({ event_date: '2027-05-02' }).eq('id', eventId)).error).toBeNull();

    const { data: anniversary, error: anniversaryError } = await supabaseAsUser
      .from('anniversaries')
      .insert({ user_id: userId, label: 'First date', event_date: '2020-02-14' })
      .select('id')
      .single();
    expect(anniversaryError).toBeNull();
    anniversaryId = anniversary!.id;
    expect(
      // The date, not the name: the sender reads the row when pg_net's call
      // lands, so a renamed row could already carry the new name.
      (await supabaseAsUser.from('anniversaries').update({ event_date: '2020-02-15' }).eq('id', anniversaryId)).error
    ).toBeNull();

    const own = await clientFor(supabaseAdmin, userId);
    const writeDates = (dates: { wedding_date?: string; relationship_start?: string }) =>
      own.from('couple_settings').upsert({ user_a: userA, user_b: userB, ...dates }, { onConflict: 'user_a,user_b' });
    expect((await writeDates({ wedding_date: '2027-06-12' })).error).toBeNull();
    expect((await writeDates({ wedding_date: '2027-06-13' })).error).toBeNull();
    expect((await writeDates({ relationship_start: '2026-01-01T00:00:00Z' })).error).toBeNull();
    expect((await writeDates({ relationship_start: '2026-02-02T00:00:00Z' })).error).toBeNull();

    expect((await own.from('users').update({ birthday: '1990-05-01' }).eq('id', userId)).error).toBeNull();
    expect((await own.from('users').update({ birthday: '1990-05-02' }).eq('id', userId)).error).toBeNull();

    // The added event and anniversary each record a request per partner device,
    // titled with the sender and naming the date as it was added.
    for (const [column, id, body] of [
      ['event_id', eventId, 'Added an event: Paris trip'],
      ['anniversary_id', anniversaryId, 'Added an anniversary: First date'],
    ] as const) {
      await expect
        .poll(async () => (await requestsFor(supabaseAdmin, id!, column)).length, {
          message: `the sender records a request for each of the partner's devices (${column})`,
          timeout: 20_000,
        })
        .toBe(2);
      for (const row of await requestsFor(supabaseAdmin, id!, column)) {
        const payload = row.payload as { kind: string; aps: { alert: { body: string } } };
        expect(payload.aps.alert.body).toBe(body);
        expect(payload.kind).toBe(column === 'event_id' ? 'event' : 'anniversary');
      }
    }

    // The control: a mood after those writes still records a request per device.
    // Once it has, every row on the partner's devices is the event's, the
    // anniversary's or the mood's: no edit and no couple date or birthday added
    // one (the triggers are pinned by 35_push_devices.sql, PUSH-DB-060, 064-068).
    const { data: mood, error: moodError } = await supabaseAsUser
      .from('moods')
      .upsert(
        { user_id: userId, mood_type: 'happy', mood_types: ['happy'], created_at: createdAt },
        { onConflict: 'user_id,created_at' }
      )
      .select('id')
      .single();
    expect(moodError).toBeNull();
    await expect
      .poll(async () => (await requestsFor(supabaseAdmin, mood!.id, 'mood_id')).length, {
        message: 'the sender records a request for each of the partner\'s devices',
        timeout: 20_000,
      })
      .toBe(2);

    const { data: all, error } = await supabaseAdmin
      .from('push_requests')
      .select('token, mood_id, event_id, anniversary_id')
      .in('token', [phone, tablet]);
    expect(error).toBeNull();
    expect(all).toHaveLength(6);
    const sources = (all ?? []).map((row) => row.mood_id ?? row.event_id ?? row.anniversary_id).sort();
    expect(sources).toEqual([mood!.id, mood!.id, eventId!, eventId!, anniversaryId!, anniversaryId!].sort());
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
      expect(row.payload).toEqual(partnerPayload('partner_request', asker.name, 'Sent you a partner request'));
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
    expect(acceptRows[0].payload).toEqual(partnerPayload('partner_accept', asked.name, 'Accepted your partner request'));

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

    // Only the accepted request moved to `accepted`, the one transition the
    // acceptance trigger fires on, so the declined ones started no call.
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
