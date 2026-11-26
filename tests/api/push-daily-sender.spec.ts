/**
 * The sender's five daily kinds, over the wire against the local stack
 * (epic-daily-pushes-and-nudge, story 8.3). Nothing posts a daily push yet (the
 * triggers are stories 5 to 7), so each case posts `{kind, id}` to `send-push`
 * as a trigger will: `daily_question` and `daily_reminder` for a
 * `daily_reminders` row, `daily_nudge` for a `daily_nudges` row, and
 * `daily_partner_picked` and `daily_both_answered` for a `daily_picks` row. The
 * rows are inserted with the service role.
 *
 * Asserted: the title, body, sound, badge, `partner-activity` thread and `kind`
 * recorded in `push_requests` (CI cannot reach APNs, so the sender records the
 * request it would have sent), for the recipient's devices only; a replay is
 * skipped; one person's `daily_nudge` switch off records no nudge to them
 * while their reminder and the partner's nudge still record; and a pick for a
 * past day records no partner-picked push and words both-answered "That day
 * counts.".
 *
 * Throwaway accounts only: the worker's pool pair's `couple_days` is never
 * touched, because a day there would shift their streak. Each case seeds the
 * pair with `seedPairDays` (psql writes the picks and a `user_time_zones` row in
 * the host's zone, so `user_local_date` answers the host's date): three past
 * days both partners picked, yesterday with no row (missed), and today with
 * Alice's pick only. At that point `couple_streak` gives held 3, run 0, so a
 * nudge says "Your 3-day streak" and the morning push "Day 4"; once Bob's pick
 * lands today, held is 4 and run 1 (only today is after the missed day), which
 * pins the `held` and `run` keys apart. The pick kinds run through the real
 * wiring (`SOURCE_COLUMN` to `daily_pick_id`, the `user_local_date` rpc and the
 * compare with `couple_days.day`).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker, so this
 * file and the other push specs never run at once.
 */
import { randomUUID } from 'node:crypto';
import type { TypedSupabaseClient } from '../support/factories';
import { readPairQuestionsByDay, seedPairDays } from '../support/factories/daily-question';
import { isoDateDaysFromNow } from '../support/helpers/events';
import { runPsql } from '../support/helpers/migration-replay';
import { newToken, postToSender, requestsFor } from '../support/helpers/push-requests';
import { createOutsiderClient, deleteOutsider } from '../support/helpers/rls-security';
import { test, expect } from '../support/merged-fixtures';

test.describe.configure({ mode: 'serial' });

const zeros = { sent: 0, recorded: 0, skipped: 0, failed: 0, gone: 0 };

/** What a daily push records: the `partner-activity` thread, the kind, the badge (0: no love notes) and a sound or none. */
const dailyPayload = (kind: string, title: string, body: string, sound?: 'default') => ({
  kind,
  aps: { alert: { title, body }, 'thread-id': 'partner-activity', badge: 0, ...(sound ? { sound } : {}) },
});

test.describe('Daily push sender', () => {
  async function createParty(
    supabaseAdmin: TypedSupabaseClient,
    cleanup: { defer: (name: string, fn: () => Promise<unknown>) => void },
    role: string
  ) {
    const account = await createOutsiderClient(supabaseAdmin, `dailypush-${role}`);
    cleanup.defer(`delete throwaway account ${role}`, () => deleteOutsider(account));
    const name = `Daily ${role.toUpperCase()} ${randomUUID().slice(0, 6)}`;
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

  async function link(supabaseAdmin: TypedSupabaseClient, from: Party, to: Party) {
    const { data, error } = await from.client
      .from('partner_requests')
      .insert({ from_user_id: from.userId, to_user_id: to.userId, status: 'pending' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect((await to.client.rpc('accept_partner_request', { p_request_id: data!.id })).error).toBeNull();
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, partner_id')
      .in('id', [from.userId, to.userId]);
    expect(Object.fromEntries(users!.map((u) => [u.id, u.partner_id]))).toEqual({
      [from.userId]: to.userId,
      [to.userId]: from.userId,
    });
  }

  async function post(supabaseAdmin: TypedSupabaseClient, kind: string, id: string) {
    const response = await postToSender(supabaseAdmin, { kind, id });
    expect(response.status, kind).toBe(200);
    return response.json();
  }

  /**
   * A linked pair with devices (Alice one, Bob two) and its days seeded: three past
   * days both picked, yesterday absent, today with Alice's pick only.
   */
  async function setUpPair(supabaseAdmin: TypedSupabaseClient, cleanup: Parameters<typeof createParty>[1]) {
    const alice = await createParty(supabaseAdmin, cleanup, 'a');
    const bob = await createParty(supabaseAdmin, cleanup, 'b');
    await link(supabaseAdmin, alice, bob);
    const aliceDevice = await registerDevice(alice, 'sandbox');
    const [bobPhone, bobTablet] = [await registerDevice(bob, 'sandbox'), await registerDevice(bob, 'production')];

    const pair = { userId: alice.userId, partnerId: bob.userId };
    await seedPairDays(supabaseAdmin, pair, [
      { daysAgo: 4, picks: 'both' },
      { daysAgo: 3, picks: 'both' },
      { daysAgo: 2, picks: 'both' },
      { daysAgo: 0, picks: 'user' },
    ]);
    const today = isoDateDaysFromNow(0, new Date());
    const days = await readPairQuestionsByDay(supabaseAdmin, pair);
    const todayQuestion = days.find((d) => d.day === today)!;
    const asked = `${todayQuestion.this} or ${todayQuestion.that}?`;

    const [userA, userB] = [alice.userId, bob.userId].sort();
    const { data: dayRows } = await supabaseAdmin
      .from('couple_days')
      .select('id, day')
      .eq('user_a', userA)
      .eq('user_b', userB);
    const dayIds = Object.fromEntries(dayRows!.map((d) => [d.day, d.id]));
    return { alice, bob, aliceDevice, bobPhone, bobTablet, today, asked, dayId: dayIds[today], dayIds };
  }

  test('[P0] a morning reminder, an evening partner reminder and a nudge record their copy for the recipient\'s devices only; an off switch records nothing for that kind and person', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const { alice, bob, aliceDevice, bobPhone, bobTablet, today, asked, dayId } = await setUpPair(
      supabaseAdmin,
      cleanup
    );

    async function addReminder(userId: string, kind: 'morning' | 'evening_self' | 'evening_partner') {
      const { data, error } = await supabaseAdmin
        .from('daily_reminders')
        .insert({ user_id: userId, kind, local_date: today, day_id: dayId })
        .select('id')
        .single();
      expect(error, kind).toBeNull();
      return data!.id;
    }
    async function addNudge(from: Party, to: Party, slot: 'after_pick' | 'evening') {
      const { data, error } = await supabaseAdmin
        .from('daily_nudges')
        .insert({ from_user: from.userId, to_user: to.userId, day_id: dayId, sender_local_date: today, slot })
        .select('id')
        .single();
      expect(error, slot).toBeNull();
      return data!.id;
    }

    // ---- 8 AM: Bob gets the question, with no sound ----
    const morning = await addReminder(bob.userId, 'morning');
    expect(await post(supabaseAdmin, 'daily_question', morning)).toEqual({ ...zeros, recorded: 2 });
    const morningRows = await requestsFor(supabaseAdmin, morning, 'daily_reminder_id');
    expect(morningRows.map((r) => [r.token, r.delivery]).sort()).toEqual(
      [
        [bobPhone, 'recorded'],
        [bobTablet, 'recorded'],
      ].sort()
    );
    for (const row of morningRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_question', asked, "Today's question is here. Day 4 is waiting.")
      );
    }

    // ---- 8 PM, the stored `evening_partner` kind: Alice hears Bob has not, with the default sound ----
    // The variant is the row's kind, which the sender reads and never infers from picks.
    const evening = await addReminder(alice.userId, 'evening_partner');
    expect(await post(supabaseAdmin, 'daily_reminder', evening)).toEqual({ ...zeros, recorded: 1 });
    const eveningRows = await requestsFor(supabaseAdmin, evening, 'daily_reminder_id');
    expect(eveningRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(eveningRows[0].payload).toEqual(
      dailyPayload('daily_reminder', `${bob.name} hasn't done their daily`, 'Nudge them before midnight.', 'default')
    );

    // A reminder posted under the other reminder kind is no push and claims nothing.
    expect(await post(supabaseAdmin, 'daily_question', evening)).toEqual(zeros);
    expect(await post(supabaseAdmin, 'daily_reminder', morning)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, morning, 'daily_reminder_id')).toEqual(morningRows);
    expect(await requestsFor(supabaseAdmin, evening, 'daily_reminder_id')).toEqual(eveningRows);

    // ---- a nudge from Alice to Bob: Bob's devices only, the default sound ----
    const nudge = await addNudge(alice, bob, 'after_pick');
    expect(await post(supabaseAdmin, 'daily_nudge', nudge)).toEqual({ ...zeros, recorded: 2 });
    const nudgeRows = await requestsFor(supabaseAdmin, nudge, 'daily_nudge_id');
    expect(nudgeRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of nudgeRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_nudge', `${alice.name} nudged you`, 'Your 3-day streak needs your pick today.', 'default')
      );
    }

    // A replayed post is skipped for every device.
    expect(await post(supabaseAdmin, 'daily_nudge', nudge)).toEqual({ ...zeros, skipped: 2 });
    expect(await requestsFor(supabaseAdmin, nudge, 'daily_nudge_id')).toEqual(nudgeRows);

    // ---- Bob turns the nudge switch off ----
    const switchOff = await supabaseAdmin.from('push_preferences').upsert({ user_id: bob.userId, daily_nudge: false });
    expect(switchOff.error).toBeNull();

    // A new nudge to Bob records none and lists no device.
    const blocked = await addNudge(alice, bob, 'evening');
    expect(await post(supabaseAdmin, 'daily_nudge', blocked)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, blocked, 'daily_nudge_id')).toEqual([]);

    // His reminder still records (his other switches are on) ...
    const eveningSelf = await addReminder(bob.userId, 'evening_self');
    expect(await post(supabaseAdmin, 'daily_reminder', eveningSelf)).toEqual({ ...zeros, recorded: 2 });
    for (const row of await requestsFor(supabaseAdmin, eveningSelf, 'daily_reminder_id')) {
      expect(row.payload).toEqual(
        dailyPayload('daily_reminder', "You haven't done your daily yet", `${asked} It takes two taps.`, 'default')
      );
    }

    // ... and so does the nudge he sends to Alice, whose own switch is on.
    const back = await addNudge(bob, alice, 'after_pick');
    expect(await post(supabaseAdmin, 'daily_nudge', back)).toEqual({ ...zeros, recorded: 1 });
    const backRows = await requestsFor(supabaseAdmin, back, 'daily_nudge_id');
    expect(backRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(backRows[0].payload).toEqual(
      dailyPayload('daily_nudge', `${bob.name} nudged you`, 'Your 3-day streak needs your pick today.', 'default')
    );
  });

  test('[P0] the pick kinds record under daily_pick_id for the other partner only, drop a late first pick and word a late second pick', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const { alice, bob, aliceDevice, bobPhone, bobTablet, today, dayIds } = await setUpPair(supabaseAdmin, cleanup);
    const twoDaysAgo = isoDateDaysFromNow(-2, new Date());

    async function pickOf(day: string, party: Party) {
      const { data, error } = await supabaseAdmin
        .from('daily_picks')
        .select('id')
        .eq('day_id', dayIds[day])
        .eq('user_id', party.userId)
        .single();
      expect(error, `${party.name} ${day}`).toBeNull();
      return data!.id;
    }

    // ---- today's first pick (Alice): Bob's devices hear it, without a sound or a choice ----
    const alicePick = await pickOf(today, alice);
    expect(await post(supabaseAdmin, 'daily_partner_picked', alicePick)).toEqual({ ...zeros, recorded: 2 });
    const pickedRows = await requestsFor(supabaseAdmin, alicePick, 'daily_pick_id');
    expect(pickedRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of pickedRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_partner_picked', `${alice.name} made their pick`, 'Pick yours to see what they chose.')
      );
      expect(JSON.stringify(row.payload)).not.toContain('choice');
    }
    expect(await post(supabaseAdmin, 'daily_partner_picked', alicePick)).toEqual({ ...zeros, skipped: 2 });

    // ---- today's second pick (Bob): Alice hears both answered; held is 4 and run 1, so the title pins `run` ----
    const inserted = await runPsql(
      'insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second) ' +
        `select '${dayIds[today]}', '${bob.userId}', 'that', now(), z.time_zone, z.utc_offset_minutes, z.effective_zone, true ` +
        `from public.user_time_zones z where z.user_id = '${bob.userId}';\n`
    );
    expect(inserted.code, inserted.stderr).toBe(0);
    const bobPick = await pickOf(today, bob);
    expect(await post(supabaseAdmin, 'daily_both_answered', bobPick)).toEqual({ ...zeros, recorded: 1 });
    const bothRows = await requestsFor(supabaseAdmin, bobPick, 'daily_pick_id');
    expect(bothRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(bothRows[0].payload).toEqual(
      dailyPayload('daily_both_answered', '1 day in a row', `You both answered. See ${bob.name}'s pick.`)
    );

    // ---- a pick for a day that is not the recipient's date ----
    // The first pick is dropped: nothing claimed for any device.
    const latePick = await pickOf(twoDaysAgo, alice);
    expect(await post(supabaseAdmin, 'daily_partner_picked', latePick)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, latePick, 'daily_pick_id')).toEqual([]);

    // The second still sends, with "That day counts." in place of the pick sentence.
    const lateSecond = await pickOf(twoDaysAgo, bob);
    expect(await post(supabaseAdmin, 'daily_both_answered', lateSecond)).toEqual({ ...zeros, recorded: 1 });
    const lateRows = await requestsFor(supabaseAdmin, lateSecond, 'daily_pick_id');
    expect(lateRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(lateRows[0].payload).toEqual(
      dailyPayload('daily_both_answered', '1 day in a row', 'You both answered. That day counts.')
    );
  });
});
