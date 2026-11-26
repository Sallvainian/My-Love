/**
 * A pick pushes the partner, and both answered, over the wire against the local
 * stack (epic-daily-pushes-and-nudge, story 8.6). The two `daily_picks` AFTER INSERT
 * triggers post `{kind, id}` to `send-push` through `pg_net` (`daily_partner_picked`
 * for a first pick, `daily_both_answered` for a second), and the sender records the
 * request it would have sent (CI cannot reach APNs).
 *
 * Every pick goes through the client RPC `submit_daily_pick` as its own party, so the
 * real write path (`record_daily_pick`, which sets `is_second`) fires the triggers. A
 * throwaway linked pair (Alice one device, Bob two) has three days seeded with no
 * picks: two days ago, yesterday and today. The order fixes the streak's `run`:
 *
 *   1. yesterday: Alice picks (a late first pick), then Bob (a late second pick):
 *      Alice hears "1 day in a row" / "That day counts."; the late first pick records
 *      nothing (the sender's own drop, shown by a hand post that answers all zeros);
 *   2. today: Alice picks, so Bob's two devices hear it with no choice and no sound; a
 *      retried pick stores no second row;
 *   3. today: Bob picks, so Alice hears "2 days in a row" (two days ago stays missed)
 *      and "See {Bob}'s pick."; the retry posted nothing;
 *   4. Alice turns `daily_both_answered` off, then two days ago: Alice then Bob pick
 *      late, and nothing is recorded for either pick.
 *
 * Absence is never awaited by a sleep: each "none" is the sender's own answer to a hand
 * post of the same `{kind, id}` plus an empty `requestsFor`.
 *
 * Throwaway accounts only: the worker's pool pair's `couple_days` and picks are never
 * touched. A host-local midnight inside the test's timeout would turn the Daily day
 * between the seed and the last assertion, so the test first calls
 * `waitClearOfDailyTurns`, which waits past the turn (DW-531); the shared guard also
 * waits past 20:00, which this spec, sending no nudge, does not need. Requires `supabase
 * start` with the edge runtime serving `send-push` (`needs-edge-functions` in CI);
 * the `api` project runs one worker, so this file and
 * the other push specs never run at once.
 */
import { seedPairDays } from '../support/factories/daily-question';
import { isoDateDaysFromNow, waitClearOfDailyTurns } from '../support/helpers/events';
import {
  awaitRequests,
  createParty as createThrowawayParty,
  dailyPayload,
  link,
  postKindToSender,
  registerDevice,
  requestsFor,
  zeros,
  type Party,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

test.describe('Daily pick pushes', () => {
  test('[P0] a first pick pushes the partner without the choice, a second pick says both answered, a late first pick and a switched-off kind record nothing, and a retry posts nothing', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    const createParty = (role: string) => createThrowawayParty(supabaseAdmin, cleanup, 'dailypick', 'Pick', role);
    const alice = await createParty('a');
    const bob = await createParty('b');
    await link(supabaseAdmin, alice, bob);
    const aliceDevice = await registerDevice(alice, 'sandbox');
    const [bobPhone, bobTablet] = [await registerDevice(bob, 'sandbox'), await registerDevice(bob, 'production')];

    await seedPairDays(supabaseAdmin, { userId: alice.userId, partnerId: bob.userId }, [
      { daysAgo: 2, picks: 'none' },
      { daysAgo: 1, picks: 'none' },
      { daysAgo: 0, picks: 'none' },
    ]);
    const now = new Date();
    const today = isoDateDaysFromNow(0, now);
    const yesterday = isoDateDaysFromNow(-1, now);
    const twoDaysAgo = isoDateDaysFromNow(-2, now);

    const [userA, userB] = [alice.userId, bob.userId].sort();
    const { data: dayRows, error: dayError } = await supabaseAdmin
      .from('couple_days')
      .select('id, day')
      .eq('user_a', userA)
      .eq('user_b', userB);
    expect(dayError).toBeNull();
    const dayIds = Object.fromEntries(dayRows!.map((d) => [d.day, d.id]));

    /** `submit_daily_pick` as `party`: today at the current instant, a past date at host-local noon. */
    async function submitPick(party: Party, day: string) {
      const pickedAt = day === today ? new Date() : new Date(`${day}T12:00:00`);
      const { error } = await party.client.rpc('submit_daily_pick', {
        day_id: dayIds[day],
        choice: 'this',
        picked_at: pickedAt.toISOString(),
        time_zone: hostZone,
        utc_offset_minutes: -pickedAt.getTimezoneOffset(),
      });
      expect(error, `${party.name} picks ${day}`).toBeNull();
    }

    async function picksOf(day: string, party: Party) {
      const { data, error } = await supabaseAdmin
        .from('daily_picks')
        .select('id')
        .eq('day_id', dayIds[day])
        .eq('user_id', party.userId);
      expect(error, `${party.name} ${day}`).toBeNull();
      return data!.map((p) => p.id);
    }

    async function pickOf(day: string, party: Party) {
      const ids = await picksOf(day, party);
      expect(ids, `${party.name} ${day}`).toHaveLength(1);
      return ids[0];
    }

    // ---- 1. yesterday: a late first pick records nothing, a late second pick says "That day counts." ----
    await submitPick(alice, yesterday);
    await submitPick(bob, yesterday);
    const lateSecond = await pickOf(yesterday, bob);
    const lateRows = await awaitRequests(supabaseAdmin, lateSecond, 'daily_pick_id', 1);
    expect(lateRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(lateRows[0].payload).toEqual(
      dailyPayload('daily_both_answered', '1 day in a row', 'You both answered. That day counts.')
    );

    const lateFirst = await pickOf(yesterday, alice);
    expect(await postKindToSender(supabaseAdmin, 'daily_partner_picked', lateFirst)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, lateFirst, 'daily_pick_id')).toEqual([]);

    // ---- 2. today: Alice picks, and Bob's two devices hear it, without the choice or a sound ----
    await submitPick(alice, today);
    const alicePick = await pickOf(today, alice);
    const pickedRows = await awaitRequests(supabaseAdmin, alicePick, 'daily_pick_id', 2);
    expect(pickedRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of pickedRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_partner_picked', `${alice.name} made their pick`, 'Pick yours to see what they chose.')
      );
      expect(JSON.stringify(row.payload)).not.toContain('choice');
    }

    // A retried pick succeeds and stores no second row.
    await submitPick(alice, today);
    expect(await picksOf(today, alice)).toEqual([alicePick]);

    // ---- 3. today: Bob picks second, and Alice hears both answered; two days ago stays missed, so run is 2 ----
    await submitPick(bob, today);
    const bobPick = await pickOf(today, bob);
    const bothRows = await awaitRequests(supabaseAdmin, bobPick, 'daily_pick_id', 1);
    expect(bothRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(bothRows[0].payload).toEqual(
      dailyPayload('daily_both_answered', '2 days in a row', `You both answered. See ${bob.name}'s pick.`)
    );
    // The retry recorded nothing more: Alice's pick still holds the two records of step 2. That the
    // retry queues no call is pinned by 49_daily_pick_pushes.sql DAILY-PICK-010.
    expect(await requestsFor(supabaseAdmin, alicePick, 'daily_pick_id')).toEqual(pickedRows);

    // ---- 4. Alice turns the both-answered switch off, then two days ago is picked late ----
    const switchOff = await supabaseAdmin
      .from('push_preferences')
      .upsert({ user_id: alice.userId, daily_both_answered: false });
    expect(switchOff.error).toBeNull();

    await submitPick(alice, twoDaysAgo);
    await submitPick(bob, twoDaysAgo);
    const offFirst = await pickOf(twoDaysAgo, alice);
    const offSecond = await pickOf(twoDaysAgo, bob);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', offSecond)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, offSecond, 'daily_pick_id')).toEqual([]);
    expect(await postKindToSender(supabaseAdmin, 'daily_partner_picked', offFirst)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, offFirst, 'daily_pick_id')).toEqual([]);
  });
});
