/**
 * The sender's three daily kinds, over the wire against the local stack
 * (epic-daily-pushes-and-nudge, story 8.3, cut to three by story 11.2 of
 * epic-simpler-daily-pushes-and-nudge). The `daily_reminders` trigger exists (story
 * 8.5), so inserting an `evening_self` row posts `daily_reminder` to `send-push` itself and
 * the case waits for the records; a hand post of the same `{kind, id}` is then a replay
 * (`skipped`). The `daily_picks` trigger exists too (story 8.6), so every second pick,
 * the seed's included, posts `daily_both_answered` itself; a first pick posts nothing. The
 * `daily_nudges` trigger exists too (story 8.7), so each nudge row inserted here posts
 * `daily_nudge` itself: the case waits for the records, and a nudge to a recipient who
 * switched the kind off still answers `zeros` to a hand post and lists no device. The rows
 * are inserted with the service role, which bypasses `send_daily_nudge`'s rules (a row that
 * is not `held` posts on insert; a held one, and its release, are
 * `push-daily-nudge-held.spec.ts`); the client RPC is `push-daily-nudge.spec.ts`.
 *
 * Asserted: the title, body, sound, badge, `partner-activity` thread and `kind`
 * recorded in `push_requests` (CI cannot reach APNs, so the sender records the
 * request it would have sent), for the recipient's devices only; a replay is
 * skipped; one person's `daily_nudge` switch off records no nudge to them
 * while their reminder and the partner's nudge still record; a first pick records
 * nothing and a second pick, on its day or after it, records the one both-answered
 * wording whatever the streak; a posted `daily_question` or `daily_partner_picked` is a
 * 400 that claims nothing; and a `morning` or `evening_partner` reminder row can no longer
 * be stored.
 *
 * Throwaway accounts only: the worker's pool pair's `couple_days` is never
 * touched, because a day there would shift their streak. Each case seeds the
 * pair with `seedPairDays` (psql writes the picks and a `user_time_zones` row in
 * the host's zone, which the seeded days and `couple_streak` are dated in): three past
 * days both partners picked, yesterday with no row (missed), and today with
 * Alice's pick only. At that point `couple_streak` gives held 3, run 0, and once Bob's pick
 * lands today, held is 4 and run 1, so the both-answered wording is checked across two
 * different streaks.
 *
 * A host-local midnight inside a test's timeout would turn the Daily day between the seed
 * and the last assertion, so each test first calls `waitClearOfDailyTurns`, which waits
 * past the turn (DW-527). The first test also inserts Bob's `evening_self` for today, which
 * the live `daily-reminders` job inserts itself on a tick at 20:00 to 20:25 on the host
 * clock (the pair's stored zone), so it first calls `waitClearOfReminderTicks`, which
 * waits past every such tick its timeout could reach (DW-528).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker, so this
 * file and the other push specs never run at once.
 */
import type { TypedSupabaseClient } from '../support/factories';
import { pairDaySql } from '../support/factories/daily-question';
import type { Cleanup } from '../support/fixtures/cleanup';
import { isoDateDaysFromNow, waitClearOfDailyTurns, waitClearOfReminderTicks } from '../support/helpers/events';
import { runPsql } from '../support/helpers/migration-replay';
import {
  awaitRequests,
  dailyPayload,
  postKindToSender,
  postToSender,
  requestsFor,
  setUpPair,
  zeros,
  type Party,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Daily push sender', () => {
  /**
   * A linked pair with devices (Alice one, Bob two) and its days seeded: three past
   * days both picked, yesterday absent, today with Alice's pick only.
   */
  async function setUpDailyPair(supabaseAdmin: TypedSupabaseClient, cleanup: Cleanup) {
    const {
      first: alice,
      second: bob,
      firstDevice: aliceDevice,
      secondDevices: [bobPhone, bobTablet],
      pair,
      dayIds,
    } = await setUpPair(
      supabaseAdmin,
      cleanup,
      { prefix: 'dailypush', displayPrefix: 'Daily' },
      [
        { daysAgo: 4, picks: 'both' },
        { daysAgo: 3, picks: 'both' },
        { daysAgo: 2, picks: 'both' },
        { daysAgo: 0, picks: 'user' },
      ]
    );
    const today = isoDateDaysFromNow(0, new Date());
    return { alice, bob, aliceDevice, bobPhone, bobTablet, pair, today, dayId: dayIds[today], dayIds };
  }

  test('[P0] the 8 PM reminder and a nudge record their copy for the recipient\'s devices only; an off switch records nothing for that kind and person', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    await waitClearOfReminderTicks(testInfo);
    const { alice, bob, aliceDevice, bobPhone, bobTablet, today, dayId, dayIds } = await setUpDailyPair(
      supabaseAdmin,
      cleanup
    );
    const twoDaysAgo = isoDateDaysFromNow(-2, new Date());

    async function addReminder(userId: string, localDate: string, forDayId: string) {
      const { data, error } = await supabaseAdmin
        .from('daily_reminders')
        .insert({ user_id: userId, kind: 'evening_self', local_date: localDate, day_id: forDayId })
        .select('id')
        .single();
      expect(error, `reminder for ${localDate}`).toBeNull();
      return data!.id;
    }
    async function addNudge(from: Party, to: Party, source: 'prompt' | 'button') {
      const { data, error } = await supabaseAdmin
        .from('daily_nudges')
        .insert({ from_user: from.userId, to_user: to.userId, day_id: dayId, source })
        .select('id')
        .single();
      expect(error, source).toBeNull();
      return data!.id;
    }

    // ---- 8 PM: Bob, who has not picked, is told to, with the default sound ----
    const evening = await addReminder(bob.userId, today, dayId);
    // The insert's trigger posts it; the sender records both of Bob's devices.
    const eveningRows = await awaitRequests(supabaseAdmin, evening, 'daily_reminder_id', 2);
    expect(eveningRows.map((r) => [r.token, r.delivery]).sort()).toEqual(
      [
        [bobPhone, 'recorded'],
        [bobTablet, 'recorded'],
      ].sort()
    );
    for (const row of eveningRows) {
      expect(row.payload).toEqual(
        dailyPayload(
          'daily_reminder',
          "Time's running out!",
          'Answer your daily question before the day is over!',
          'default'
        )
      );
    }

    // A hand post of what the trigger already posted is a replay for every device.
    expect(await postKindToSender(supabaseAdmin, 'daily_reminder', evening)).toEqual({ ...zeros, skipped: 2 });
    expect(await requestsFor(supabaseAdmin, evening, 'daily_reminder_id')).toEqual(eveningRows);

    // The two kinds story 11.2 removed: a stored `morning` or `evening_partner` row is refused by the
    // kind check, and a post of either removed kind is a 400 that claims nothing.
    for (const kind of ['morning', 'evening_partner']) {
      const refused = await supabaseAdmin
        .from('daily_reminders')
        .insert({ user_id: alice.userId, kind, local_date: today, day_id: dayId });
      expect(refused.error?.code, kind).toBe('23514');
    }
    for (const [kind, id] of [
      ['daily_question', evening],
      ['daily_partner_picked', evening],
    ]) {
      const response = await postToSender(supabaseAdmin, { kind, id });
      expect(response.status, kind).toBe(400);
      await response.body?.cancel();
    }
    expect(await requestsFor(supabaseAdmin, evening, 'daily_reminder_id')).toEqual(eveningRows);

    // ---- a nudge from Alice to Bob: Bob's devices only, the default sound ----
    const nudge = await addNudge(alice, bob, 'prompt');
    // The insert's trigger posts it; the sender records both of Bob's devices.
    const nudgeRows = await awaitRequests(supabaseAdmin, nudge, 'daily_nudge_id', 2);
    expect(nudgeRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of nudgeRows) {
      expect(row.payload).toEqual(
        dailyPayload(
          'daily_nudge',
          `${alice.name} nudged you`,
          `${alice.name} answered the daily question and wants to know your answer!`,
          'default'
        )
      );
    }

    // A hand post of what the trigger already posted is a replay, skipped for every device.
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', nudge)).toEqual({ ...zeros, skipped: 2 });
    expect(await requestsFor(supabaseAdmin, nudge, 'daily_nudge_id')).toEqual(nudgeRows);

    // ---- Bob turns the nudge switch off ----
    const switchOff = await supabaseAdmin.from('push_preferences').upsert({ user_id: bob.userId, daily_nudge: false });
    expect(switchOff.error).toBeNull();

    // A new nudge to Bob records none and lists no device.
    const blocked = await addNudge(alice, bob, 'button');
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', blocked)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, blocked, 'daily_nudge_id')).toEqual([]);

    // His reminder still records (his other switches are on) ...
    const laterEvening = await addReminder(bob.userId, twoDaysAgo, dayIds[twoDaysAgo]);
    for (const row of await awaitRequests(supabaseAdmin, laterEvening, 'daily_reminder_id', 2)) {
      expect(row.payload).toEqual(
        dailyPayload(
          'daily_reminder',
          "Time's running out!",
          'Answer your daily question before the day is over!',
          'default'
        )
      );
    }

    // ... and so does the nudge he sends to Alice, whose own switch is on.
    const back = await addNudge(bob, alice, 'prompt');
    const backRows = await awaitRequests(supabaseAdmin, back, 'daily_nudge_id', 1);
    expect(backRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(backRows[0].payload).toEqual(
      dailyPayload(
        'daily_nudge',
        `${bob.name} nudged you`,
        `${bob.name} answered the daily question and wants to know your answer!`,
        'default'
      )
    );
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', back)).toEqual({ ...zeros, skipped: 1 });

    // ---- Alice turns her reminder switch off: her 8 PM reminder records none, Bob's own earlier ones stay ----
    const aliceOff = await supabaseAdmin
      .from('push_preferences')
      .upsert({ user_id: alice.userId, daily_reminder: false });
    expect(aliceOff.error).toBeNull();
    const aliceReminder = await addReminder(alice.userId, today, dayId);
    expect(await postKindToSender(supabaseAdmin, 'daily_reminder', aliceReminder)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, aliceReminder, 'daily_reminder_id')).toEqual([]);
    expect(await requestsFor(supabaseAdmin, evening, 'daily_reminder_id')).toEqual(eveningRows);
  });

  test('[P0] a first pick records nothing, and a second pick records the one both-answered wording for the first picker, on its day or after it', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    const { alice, bob, aliceDevice, pair, today, dayIds } = await setUpDailyPair(supabaseAdmin, cleanup);
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
    const bothAnswered = dailyPayload(
      'daily_both_answered',
      "You both answered today's question",
      'Click to see what your partner answered!'
    );

    // ---- today's first pick (Alice): nobody is pushed, and no post of it records anything ----
    const alicePick = await pickOf(today, alice);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', alicePick)).toEqual(zeros);
    const removed = await postToSender(supabaseAdmin, { kind: 'daily_partner_picked', id: alicePick });
    expect(removed.status).toBe(400);
    await removed.body?.cancel();
    expect(await requestsFor(supabaseAdmin, alicePick, 'daily_pick_id')).toEqual([]);

    // ---- a second pick two days ago (Bob), after its day: Alice hears the same wording ----
    // Today holds Alice's pick only, so the streak's `run` is 0 here.
    const lateSecond = await pickOf(twoDaysAgo, bob);
    const lateRows = await awaitRequests(supabaseAdmin, lateSecond, 'daily_pick_id', 1);
    expect(lateRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(lateRows[0].payload).toEqual(bothAnswered);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', lateSecond)).toEqual({ ...zeros, skipped: 1 });

    // ---- today's second pick (Bob): held is 4 and run 1, and the wording is the same ----
    // In the host zone the seed dated the days and stored for Bob, through the seed's own SQL.
    const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const secondPick = pairDaySql(pair, today, [
      {
        userId: bob.userId,
        at: 'now()',
        zone: hostZone,
        offsetMinutes: -new Date().getTimezoneOffset(),
        isSecond: true,
        choice: 'that',
      },
    ]);
    const inserted = await runPsql(`${secondPick.join('\n')}\n`);
    expect(inserted.code, inserted.stderr).toBe(0);
    const bobPick = await pickOf(today, bob);
    const bothRows = await awaitRequests(supabaseAdmin, bobPick, 'daily_pick_id', 1);
    expect(bothRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(bothRows[0].payload).toEqual(bothAnswered);
    expect(JSON.stringify(bothRows[0].payload)).not.toMatch(/in a row|That day counts|choice/);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', bobPick)).toEqual({ ...zeros, skipped: 1 });
  });
});
