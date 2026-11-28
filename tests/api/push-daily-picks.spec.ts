/**
 * A second pick says both answered, and a first pick pushes nobody, over the wire against
 * the local stack (epic-daily-pushes-and-nudge, story 8.6; story 11.2 of
 * epic-simpler-daily-pushes-and-nudge removed the partner-picked push). The one `daily_picks`
 * AFTER INSERT trigger posts `{kind: 'daily_both_answered', id}` to `send-push` through `pg_net`
 * for a second pick, and the sender records the request it would have sent (CI cannot reach
 * APNs).
 *
 * Every pick goes through the client RPC `submit_daily_pick` as its own party, so the
 * real write path (`record_daily_pick`, which sets `is_second`) fires the trigger. A
 * throwaway linked pair (Alice one device, Bob two) has three days seeded with no
 * picks: two days ago, yesterday and today:
 *
 *   1. yesterday: Alice picks (a late first pick), which records nothing, then Bob (a late
 *      second pick): Alice hears "You both answered today's question" / "Click to see what
 *      your partner answered!", the same wording as on the day;
 *   2. today: Alice picks, so Bob's two devices hear nothing (a hand post of the pick as
 *      both answered answers all zeros, and a posted `daily_partner_picked` is a 400); a
 *      retried pick stores no second row;
 *   3. today: Bob picks, so Alice hears the same wording although her streak now counts two
 *      days (two days ago stays missed); the retry posted nothing;
 *   4. Alice turns `daily_both_answered` off, then two days ago: Alice then Bob pick
 *      late, and nothing is recorded for either pick.
 *
 * Absence is never awaited by a sleep: each "none" is the sender's own answer to a hand
 * post of the same `{kind, id}` plus an empty `requestsFor`, and a first pick's records are
 * read only after the second pick's have landed, so a post it had made would be in by then.
 *
 * Throwaway accounts only: the worker's pool pair's `couple_days` and picks are never
 * touched. A host-local midnight inside the test's timeout would turn the Daily day
 * between the seed and the last assertion, so the test first calls
 * `waitClearOfDailyTurns`, which waits past the turn (DW-531); the shared guard also
 * waits past 08:00, which this spec, sending no nudge, does not need. Requires `supabase
 * start` with the edge runtime serving `send-push` (`needs-edge-functions` in CI);
 * the `api` project runs one worker, so this file and
 * the other push specs never run at once.
 */
import { isoDateDaysFromNow, waitClearOfDailyTurns } from '../support/helpers/events';
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

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

test.describe('Daily pick pushes', () => {
  test('[P0] a first pick pushes nobody, a second pick says both answered in one wording, a switched-off kind records nothing, and a retry posts nothing', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    const {
      first: alice,
      second: bob,
      firstDevice: aliceDevice,
      dayIds,
    } = await setUpPair(supabaseAdmin, cleanup, { prefix: 'dailypick', displayPrefix: 'Pick' }, [
      { daysAgo: 2, picks: 'none' },
      { daysAgo: 1, picks: 'none' },
      { daysAgo: 0, picks: 'none' },
    ]);
    const now = new Date();
    const today = isoDateDaysFromNow(0, now);
    const yesterday = isoDateDaysFromNow(-1, now);
    const twoDaysAgo = isoDateDaysFromNow(-2, now);

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

    const bothAnswered = dailyPayload(
      'daily_both_answered',
      "You both answered today's question",
      'Click to see what your partner answered!'
    );

    // ---- 1. yesterday: a late first pick records nothing, a late second pick says both answered ----
    await submitPick(alice, yesterday);
    await submitPick(bob, yesterday);
    const lateSecond = await pickOf(yesterday, bob);
    const lateRows = await awaitRequests(supabaseAdmin, lateSecond, 'daily_pick_id', 1);
    expect(lateRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(lateRows[0].payload).toEqual(bothAnswered);

    const lateFirst = await pickOf(yesterday, alice);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', lateFirst)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, lateFirst, 'daily_pick_id')).toEqual([]);

    // ---- 2. today: Alice picks, and nobody is pushed ----
    await submitPick(alice, today);
    const alicePick = await pickOf(today, alice);
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', alicePick)).toEqual(zeros);
    const removed = await postToSender(supabaseAdmin, { kind: 'daily_partner_picked', id: alicePick });
    expect(removed.status).toBe(400);
    await removed.body?.cancel();

    // A retried pick succeeds and stores no second row.
    await submitPick(alice, today);
    expect(await picksOf(today, alice)).toEqual([alicePick]);

    // ---- 3. today: Bob picks second, and Alice hears both answered, worded as on any other day ----
    await submitPick(bob, today);
    const bobPick = await pickOf(today, bob);
    const bothRows = await awaitRequests(supabaseAdmin, bobPick, 'daily_pick_id', 1);
    expect(bothRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(bothRows[0].payload).toEqual(bothAnswered);
    expect(JSON.stringify(bothRows[0].payload)).not.toMatch(/in a row|That day counts|choice/);
    // Bob's pick is in, so any post Alice's first pick had made would be in too: it recorded nothing,
    // and the retry queued no call (pinned by 49_daily_pick_pushes.sql DAILY-PICK-010).
    expect(await requestsFor(supabaseAdmin, alicePick, 'daily_pick_id')).toEqual([]);

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
    expect(await postKindToSender(supabaseAdmin, 'daily_both_answered', offFirst)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, offFirst, 'daily_pick_id')).toEqual([]);
  });
});
