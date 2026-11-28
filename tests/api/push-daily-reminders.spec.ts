/**
 * The 8 PM reminder on each person's clock, over the wire against the local stack
 * (epic-daily-pushes-and-nudge, story 8.5; story 11.2 of epic-simpler-daily-pushes-and-nudge
 * removed the 8 AM push and the evening_partner variant). `enqueue_daily_reminders(at)`
 * inserts each due person's `daily_reminders` row, the row's AFTER INSERT trigger posts it to
 * `send-push` through `pg_net`, and the sender records the request it would have sent (CI
 * cannot reach APNs).
 *
 * A throwaway linked pair lives in `Asia/Kathmandu` (+05:45, no DST), Alice with one
 * device and Bob with two. The date D is Kathmandu's yesterday, so the instants sit in
 * the past; they are 08:25 and 20:25 on D in Kathmandu, which are 02:40 and 14:40 UTC.
 * A whole-hour zone reads those as :40, never inside a window (a window ends at :30),
 * so only an account in a half-hour zone could be due too. The function sees every
 * account, so a psql guard first requires that no account but this pair is due at
 * the evening instant: the rpc's return count is then the pair's own, and no other
 * account's rows are touched (the spec never reaches the pool pairs' rows). A Kathmandu
 * pair a killed run of this spec or `push-daily-nudge-held.spec.ts` left behind would be
 * due, so the test first deletes those (`deleteStaleKathmanduPairs`, DW-530), and the
 * guard names any account it still finds.
 *
 * Asserted: the rpc at D 08:25 inserts 0 rows, records no request and assigns the pair no
 * couple day for D; after Alice's pick for D, the rpc at D 20:25 inserts Bob's
 * `evening_self` alone, recorded for his devices only with the one reminder wording and the
 * default sound, and nothing for Alice, who picked, though her partner has not; a repeat
 * inserts 0 and the records are unchanged.
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker.
 */
import type { TypedSupabaseClient } from '../support/factories';
import { readPairQuestionsByDay } from '../support/factories/daily-question';
import {
  KATHMANDU_OFFSET_MINUTES,
  KATHMANDU_ZONE,
  deleteStaleKathmanduPairs,
  kathmanduInstant,
  kathmanduYesterday,
  otherAccountsDueAt,
  seedPairDay,
  storeZone,
} from '../support/helpers/daily-clock';
import {
  awaitRequests,
  createParty as createThrowawayParty,
  dailyPayload,
  link,
  registerDevice,
  requestsFor,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

const ZONE = KATHMANDU_ZONE;
const OFFSET_MINUTES = KATHMANDU_OFFSET_MINUTES;

test.describe('Daily reminders on each person\'s clock', () => {
  async function reminderId(supabaseAdmin: TypedSupabaseClient, userId: string, day: string) {
    const { data, error } = await supabaseAdmin
      .from('daily_reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('slot', 'evening')
      .eq('local_date', day)
      .single();
    expect(error, 'evening reminder').toBeNull();
    return data!.id;
  }

  /** The reminder rows these accounts hold, as the columns the pair's assertions compare. */
  async function remindersOf(supabaseAdmin: TypedSupabaseClient, userIds: string[]) {
    const { data, error } = await supabaseAdmin
      .from('daily_reminders')
      .select('user_id, kind, slot, local_date, day_id')
      .in('user_id', userIds)
      .order('user_id');
    expect(error, 'reminders').toBeNull();
    return data ?? [];
  }

  test('[P0] the 8 PM reminder is queued on the pair\'s own clock, once, only for whoever has not picked, and recorded for the right devices', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    await deleteStaleKathmanduPairs(supabaseAdmin);
    const alice = await createThrowawayParty(supabaseAdmin, cleanup, 'dailyrem', 'Rem', 'a');
    const bob = await createThrowawayParty(supabaseAdmin, cleanup, 'dailyrem', 'Rem', 'b');
    await link(supabaseAdmin, alice, bob);
    const aliceDevice = await registerDevice(alice, 'sandbox');
    const [bobPhone, bobTablet] = [await registerDevice(bob, 'sandbox'), await registerDevice(bob, 'production')];

    for (const userId of [alice.userId, bob.userId]) await storeZone(userId, ZONE, OFFSET_MINUTES);

    const day = kathmanduYesterday();
    const morningAt = kathmanduInstant(day, '08:25');
    const eveningAt = kathmanduInstant(day, '20:25');
    const own = [alice.userId, bob.userId];
    const pair = { userId: alice.userId, partnerId: bob.userId };

    // No other account is due at the evening instant, so the rpc's count is this pair's own.
    expect(await otherAccountsDueAt(eveningAt, own), 'accounts due at the evening instant').toEqual([]);

    // ---- 8 AM on D in Kathmandu: no reminder, no request and no day assigned ----
    const morning = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: morningAt });
    expect(morning.error).toBeNull();
    // Nothing is inserted at 08:25, for this pair or any other account on the stack.
    expect(morning.data).toBe(0);
    expect(await remindersOf(supabaseAdmin, own)).toEqual([]);
    expect(await readPairQuestionsByDay(supabaseAdmin, pair)).toEqual([]);

    // ---- Alice picks D at 07:25; a second 8 AM tick then records nothing for either partner ----
    const dayId = await seedPairDay(pair, day, [{ userId: alice.userId, pickedAt: kathmanduInstant(day, '07:25') }]);
    const lateMorning = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: kathmanduInstant(day, '08:29') });
    expect(lateMorning.error).toBeNull();
    expect(lateMorning.data).toBe(0);
    // No reminder row exists for either partner, so no `daily_reminder_id` request can either.
    expect(await remindersOf(supabaseAdmin, own)).toEqual([]);

    // ---- 8 PM then tells Bob, who has not picked, and not Alice ----

    const evening = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: eveningAt });
    expect(evening.error).toBeNull();
    expect(evening.data).toBe(1);

    expect(await remindersOf(supabaseAdmin, own)).toEqual([
      { user_id: bob.userId, kind: 'evening_self', slot: 'evening', local_date: day, day_id: dayId },
    ]);
    const bobEvening = await reminderId(supabaseAdmin, bob.userId, day);

    const bobEveningRows = await awaitRequests(supabaseAdmin, bobEvening, 'daily_reminder_id', 2);
    expect(bobEveningRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of bobEveningRows) {
      expect(row.payload).toEqual(
        dailyPayload(
          'daily_reminder',
          "Time's running out!",
          'Answer your daily question before the day is over!',
          'default'
        )
      );
    }

    // ---- the same instant again inserts nothing and records nothing new ----
    const repeat = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: eveningAt });
    expect(repeat.error).toBeNull();
    expect(repeat.data).toBe(0);
    expect(await requestsFor(supabaseAdmin, bobEvening, 'daily_reminder_id')).toEqual(bobEveningRows);

    // ---- Bob answers late in the evening: Alice hears both answered, and that is the day's last push ----
    await seedPairDay(pair, day, [
      { userId: bob.userId, pickedAt: new Date(Date.parse(eveningAt) + 60_000).toISOString(), isSecond: true, choice: 'that' },
    ]);
    const { data: picks, error: picksError } = await supabaseAdmin
      .from('daily_picks')
      .select('id, user_id')
      .eq('day_id', dayId);
    expect(picksError).toBeNull();
    const alicePick = picks!.find((p) => p.user_id === alice.userId)!.id;
    const bobPick = picks!.find((p) => p.user_id === bob.userId)!.id;
    const bothRows = await awaitRequests(supabaseAdmin, bobPick, 'daily_pick_id', 1);
    expect(bothRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(bothRows[0].payload).toEqual(
      dailyPayload(
        'daily_both_answered',
        "You both answered today's question",
        'Click to see what your partner answered!'
      )
    );
    // Altogether the pair was pushed twice: the reminder to Bob and both answered to Alice, and Alice's
    // own first pick pushed nobody.
    expect(await requestsFor(supabaseAdmin, alicePick, 'daily_pick_id')).toEqual([]);
    expect(await requestsFor(supabaseAdmin, bobEvening, 'daily_reminder_id')).toEqual(bobEveningRows);
  });
});
