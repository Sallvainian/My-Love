/**
 * The server takes a nudge and pushes it, over the wire against the local stack
 * (epic-daily-pushes-and-nudge, story 8.7). The client RPC `send_daily_nudge(day_id)`
 * writes one `daily_nudges` row through `record_daily_nudge`; the row's AFTER INSERT
 * trigger posts `{kind: 'daily_nudge', id}` to `send-push` through `pg_net`, and the
 * sender records the request it would have sent (CI cannot reach APNs).
 *
 * Every nudge goes through the client RPC as its own party, so the real write path
 * (the pair, the pick and slot rules, the unique key) fires the trigger. Throwaway
 * pairs only; the worker's pool pair's rows are never touched.
 *
 *   1. Alice and Bob (Alice one device, Bob two), today seeded with Alice's pick only:
 *      Alice's nudge answers her snapshot with the slot spent, and Bob's two devices
 *      hear it ("Your streak needs your pick today.": `held` is 0, with the default
 *      sound); a hand post of the same `{kind, id}` is a replay; Alice nudging again
 *      is refused `DQ010` and adds no row; Bob, who has not picked, is refused `DQ007`.
 *   2. (a second test) Carol and Dave, Dave's `daily_nudge` switch off: Carol's nudge succeeds and
 *      records nothing for Dave (shown by a hand post that answers all zeros plus an
 *      empty `requestsFor`, never by a sleep).
 *
 * A host-local midnight or 20:00 inside a test's timeout would turn the Daily day or the
 * nudge slot (so the repeat in the slot would no longer be refused), so each test first
 * calls `waitClearOfDailyTurns`, which waits past the turn (DW-534).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker, so this file and
 * the other push specs never run at once.
 */
import type { TypedSupabaseClient } from '../support/factories';
import type { Cleanup } from '../support/fixtures/cleanup';
import { isoDateDaysFromNow, waitClearOfDailyTurns } from '../support/helpers/events';
import {
  awaitRequests,
  dailyPayload,
  postKindToSender,
  requestsFor,
  setUpPair,
  zeros,
  type Party,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Daily nudge', () => {
  /**
   * A linked pair, `first` with one device and `second` with two, and today's day seeded
   * with `first`'s pick only. `first`'s device is registered so that a nudge recording
   * exactly `second`'s tokens also shows the sender's own device hears nothing.
   */
  async function setUpDailyPair(supabaseAdmin: TypedSupabaseClient, cleanup: Cleanup, roles: [string, string]) {
    const { first, second, secondDevices, dayIds } = await setUpPair(
      supabaseAdmin,
      cleanup,
      { prefix: 'dailynudge', displayPrefix: 'Nudge', roles },
      [{ daysAgo: 0, picks: 'user' }]
    );
    const dayId = dayIds[isoDateDaysFromNow(0, new Date())];
    expect(dayId).toBeDefined();
    return { first, second, secondDevices, dayId };
  }

  async function nudgesFrom(supabaseAdmin: TypedSupabaseClient, party: Party) {
    const { data, error } = await supabaseAdmin
      .from('daily_nudges')
      .select('id, slot, to_user')
      .eq('from_user', party.userId);
    expect(error, `${party.name}'s nudges`).toBeNull();
    return data!;
  }

  test('[P0] a nudge answers with its slot spent and pushes the partner, and a repeat in the slot and a nudge before one\'s own pick are refused', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    // Alice nudges Bob: both of Bob's devices hear it, with the default sound.
    const { first: alice, second: bob, secondDevices, dayId } = await setUpDailyPair(supabaseAdmin, cleanup, ['a', 'b']);

    const sent = await alice.client.rpc('send_daily_nudge', { day_id: dayId });
    expect(sent.error).toBeNull();
    const snapshot = sent.data as { state: string; nudge: { slot: string | null; spent: boolean } };
    expect(snapshot.state).toBe('me');

    const rows = await nudgesFrom(supabaseAdmin, alice);
    expect(rows).toHaveLength(1);
    expect(rows[0].to_user).toBe(bob.userId);
    // The slot is the one the server chose on Alice's own clock, not a guess of the host's.
    expect(snapshot.nudge).toEqual({ slot: rows[0].slot, spent: true });

    const nudgeRows = await awaitRequests(supabaseAdmin, rows[0].id, 'daily_nudge_id', 2);
    expect(nudgeRows.map((r) => r.token).sort()).toEqual([...secondDevices].sort());
    for (const row of nudgeRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_nudge', `${alice.name} nudged you`, 'Your streak needs your pick today.', 'default')
      );
    }

    // A hand post of what the trigger already posted is a replay for every device.
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', rows[0].id)).toEqual({ ...zeros, skipped: 2 });

    // The slot is spent: the same call again is refused and adds no row.
    const again = await alice.client.rpc('send_daily_nudge', { day_id: dayId });
    expect(again.error?.code).toBe('DQ010');
    expect(await nudgesFrom(supabaseAdmin, alice)).toEqual(rows);

    // Bob has not picked, so he cannot nudge, though Alice has.
    const early = await bob.client.rpc('send_daily_nudge', { day_id: dayId });
    expect(early.error?.code).toBe('DQ007');
    expect(await nudgesFrom(supabaseAdmin, bob)).toEqual([]);
  });

  test('[P0] a nudge to a partner whose nudge switch is off lands and records nothing', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    const { first: carol, second: dave, dayId: pairDay } = await setUpDailyPair(supabaseAdmin, cleanup, ['c', 'd']);
    const switchOff = await supabaseAdmin.from('push_preferences').upsert({ user_id: dave.userId, daily_nudge: false });
    expect(switchOff.error).toBeNull();

    const quiet = await carol.client.rpc('send_daily_nudge', { day_id: pairDay });
    expect(quiet.error).toBeNull();
    const [quietRow] = await nudgesFrom(supabaseAdmin, carol);
    expect(quietRow.to_user).toBe(dave.userId);
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', quietRow.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, quietRow.id, 'daily_nudge_id')).toEqual([]);
  });
});
