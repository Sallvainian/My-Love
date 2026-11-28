/**
 * A nudge sent before 08:00 on the partner's clock is held and goes out at 08:00 there,
 * over the wire against the local stack (epic-simpler-daily-pushes-and-nudge, story 11.1,
 * criteria 4, 11, 12, 22 and 24). `record_daily_nudge(viewer, day_id, source, at)` records
 * the nudge, `held` before the partner's 08:00; a held row posts nothing on insert;
 * `enqueue_daily_reminders(at)` (the five-minute `daily-reminders` job) releases it at
 * 08:00-08:30 on the partner's clock, which posts `{kind: 'daily_nudge', id}` to `send-push`
 * through `pg_net`, and the sender records the request it would have sent (CI cannot reach
 * APNs). Every instant is passed to the server's functions: no clock is moved.
 *
 * A throwaway linked pair, Alice (one device) and Bob (two), Bob in `Asia/Kathmandu`
 * (+05:45, no DST, so 08:25 there is 02:40 UTC and a whole-hour zone never reads inside a
 * 30-minute window then) and Alice in `Pacific/Kiritimati` (+14), a day ahead of him; Bob's
 * 08:00 on a day D is 02:15 UTC. The days sit in the past (Kathmandu's yesterday and the
 * days before it), each with Alice's pick only unless the case says otherwise. The job
 * sees every account, so the one case that runs it first requires, with a psql guard, that
 * no account but this pair is due at the instant (`otherAccountsDueAt`, which names any it
 * finds); the others call `release_held_daily_nudges(at)`, which touches only held nudges.
 * A Kathmandu pair a killed run of this spec or `push-daily-reminders.spec.ts` left behind
 * would be due, so each pair is made after deleting those (`deleteStaleKathmanduPairs`,
 * DW-530).
 *
 * Asserted: a prompt nudge before Bob's 08:00 and a button nudge at 05:00 are held, record
 * no request and answer a hand post with zeros; the job at 08:25 releases the earlier one
 * and not the other, so Bob's two devices hear one push with the nudge's copy and sound,
 * and a repeat tick adds none; a partner who answered, a window that was missed and a link
 * that went one-way each send nothing while the nudge still counts; a nudge after the
 * partner's 08:00 records at once (not held); a held nudge beside one pushed at 08:02 sends
 * only that one; a one-way link refuses a nudge (`P0002`) and records nothing.
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker.
 */
import type { TypedSupabaseClient } from '../support/factories';
import {
  KATHMANDU_ZONE,
  deleteStaleKathmanduPairs,
  kathmanduDay,
  kathmanduInstant,
  otherAccountsDueAt,
  seedPairDay,
  storeZone,
} from '../support/helpers/daily-clock';
import { runPsql } from '../support/helpers/migration-replay';
import {
  awaitRequests,
  createParty,
  dailyPayload,
  link,
  postKindToSender,
  registerDevice,
  requestsFor,
  zeros,
  type Party,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';
import type { Cleanup } from '../support/fixtures/cleanup';

test.describe.configure({ mode: 'serial' });

test.describe('A held daily nudge', () => {
  /** Alice (one device) and Bob (two) linked, Alice on UTC+14 and Bob on Kathmandu. */
  async function setUpHeldPair(supabaseAdmin: TypedSupabaseClient, cleanup: Cleanup) {
    await deleteStaleKathmanduPairs(supabaseAdmin);
    const alice = await createParty(supabaseAdmin, cleanup, 'dailyheld', 'Held', 'a');
    const bob = await createParty(supabaseAdmin, cleanup, 'dailyheld', 'Held', 'b');
    await link(supabaseAdmin, alice, bob);
    await registerDevice(alice, 'sandbox');
    const bobDevices = [await registerDevice(bob, 'sandbox'), await registerDevice(bob, 'production')];
    await storeZone(alice.userId, 'Pacific/Kiritimati', 840);
    await storeZone(bob.userId, KATHMANDU_ZONE, 345);
    return { alice, bob, bobDevices, pair: { userId: alice.userId, partnerId: bob.userId } };
  }

  /** `record_daily_nudge` as the service role, at a fixed instant. */
  async function record(supabaseAdmin: TypedSupabaseClient, from: Party, dayId: string, source: 'prompt' | 'button', at: string) {
    return supabaseAdmin.rpc('record_daily_nudge', { viewer: from.userId, day_id: dayId, source, at });
  }

  async function rowOf(supabaseAdmin: TypedSupabaseClient, from: Party, dayId: string, source: 'prompt' | 'button') {
    const { data, error } = await supabaseAdmin
      .from('daily_nudges')
      .select('id, held, released_at')
      .eq('from_user', from.userId)
      .eq('day_id', dayId)
      .eq('source', source)
      .single();
    expect(error, `${source} nudge`).toBeNull();
    return data!;
  }

  const nudgeCopy = (alice: Party) =>
    dailyPayload(
      'daily_nudge',
      `${alice.name} nudged you`,
      `${alice.name} answered the daily question and wants to know your answer!`,
      'default'
    );

  test('[P0] two nudges held before the partner\'s 08:00 send one push at 08:00-08:30 through the job, and a repeat sends none', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const { alice, bob, bobDevices, pair } = await setUpHeldPair(supabaseAdmin, cleanup);
    const day = kathmanduDay(1);
    const dayId = await seedPairDay(pair, day, [{ userId: alice.userId, pickedAt: kathmanduInstant(day, '04:00') }]);
    const promptAt = kathmanduInstant(day, '05:00');
    const buttonAt = kathmanduInstant(day, '06:30');
    const releaseAt = kathmanduInstant(day, '08:25');

    // Both are recorded at once, as held, and the answer is the normal one.
    const prompt = await record(supabaseAdmin, alice, dayId, 'prompt', promptAt);
    expect(prompt.error).toBeNull();
    expect((prompt.data as { nudges: { prompt_sent: boolean } }).nudges.prompt_sent).toBe(true);
    expect((await record(supabaseAdmin, alice, dayId, 'button', buttonAt)).error).toBeNull();
    const first = await rowOf(supabaseAdmin, alice, dayId, 'prompt');
    const second = await rowOf(supabaseAdmin, alice, dayId, 'button');
    expect([first.held, first.released_at, second.held, second.released_at]).toEqual([true, null, true, null]);
    // The earlier one is the first to be released.
    const ordered = await runPsql(
      `update public.daily_nudges set created_at = timestamptz '${promptAt}' where id = '${first.id}';\n` +
        `update public.daily_nudges set created_at = timestamptz '${buttonAt}' where id = '${second.id}';\n`
    );
    expect(ordered.code, ordered.stderr).toBe(0);

    // A held nudge posts nothing yet: the sender answers a hand post with zeros and records nothing.
    for (const row of [first, second]) {
      expect(await postKindToSender(supabaseAdmin, 'daily_nudge', row.id)).toEqual(zeros);
      expect(await requestsFor(supabaseAdmin, row.id, 'daily_nudge_id')).toEqual([]);
    }

    // The same source again is refused and the other source stays taken: nothing new is recorded.
    expect((await record(supabaseAdmin, alice, dayId, 'prompt', buttonAt)).error?.code).toBe('DQ010');

    // 08:25 on Bob's clock: the job releases the earlier nudge and only it.
    expect(await otherAccountsDueAt(releaseAt, [alice.userId, bob.userId]), 'accounts due at the release instant').toEqual([]);
    const tick = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: releaseAt });
    expect(tick.error).toBeNull();

    const released = await rowOf(supabaseAdmin, alice, dayId, 'prompt');
    const dropped = await rowOf(supabaseAdmin, alice, dayId, 'button');
    expect(released.released_at).not.toBeNull();
    expect(dropped.released_at).toBeNull();

    const rows = await awaitRequests(supabaseAdmin, released.id, 'daily_nudge_id', 2);
    expect(rows.map((r) => r.token).sort()).toEqual([...bobDevices].sort());
    for (const row of rows) expect(row.payload).toEqual(nudgeCopy(alice));

    // The other one never sends: a hand post of it is no push, and nothing is recorded.
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', dropped.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, dropped.id, 'daily_nudge_id')).toEqual([]);

    // A repeat tick, and one a few minutes later in the window, send nothing more.
    expect((await supabaseAdmin.rpc('release_held_daily_nudges', { at: releaseAt })).error).toBeNull();
    expect((await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(day, '08:29') })).error).toBeNull();
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', dropped.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, released.id, 'daily_nudge_id')).toEqual(rows);
    expect(await requestsFor(supabaseAdmin, dropped.id, 'daily_nudge_id')).toEqual([]);
  });

  test('[P0] a partner who answered, a missed window and a one-way link send nothing, and each nudge still counts', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const { alice, bob, pair } = await setUpHeldPair(supabaseAdmin, cleanup);
    const answered = kathmanduDay(2);
    const missed = kathmanduDay(3);
    const oneWay = kathmanduDay(4);

    // Bob answered before 08:00: his nudge-free day sends nothing at his 08:00.
    const answeredId = await seedPairDay(pair, answered, [
      { userId: alice.userId, pickedAt: kathmanduInstant(answered, '04:00') },
    ]);
    expect((await record(supabaseAdmin, alice, answeredId, 'prompt', kathmanduInstant(answered, '05:00'))).error).toBeNull();
    await seedPairDay(pair, answered, [
      { userId: bob.userId, pickedAt: kathmanduInstant(answered, '07:00'), isSecond: true },
    ]);
    await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(answered, '08:10') });
    const answeredRow = await rowOf(supabaseAdmin, alice, answeredId, 'prompt');
    expect([answeredRow.held, answeredRow.released_at]).toEqual([true, null]);
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', answeredRow.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, answeredRow.id, 'daily_nudge_id')).toEqual([]);

    // A window the job missed sends nothing later: 08:30:00 is past it, and so is the next day.
    const missedId = await seedPairDay(pair, missed, [
      { userId: alice.userId, pickedAt: kathmanduInstant(missed, '04:00') },
    ]);
    expect((await record(supabaseAdmin, alice, missedId, 'button', kathmanduInstant(missed, '05:00'))).error).toBeNull();
    await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(missed, '08:30') });
    await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(kathmanduDay(2), '08:10') });
    const missedRow = await rowOf(supabaseAdmin, alice, missedId, 'button');
    expect([missedRow.held, missedRow.released_at]).toEqual([true, null]);
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', missedRow.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, missedRow.id, 'daily_nudge_id')).toEqual([]);
    // It still counts: the same source again is refused.
    expect((await record(supabaseAdmin, alice, missedId, 'button', kathmanduInstant(missed, '09:00'))).error?.code).toBe('DQ010');

    // The link going one-way (a service-role write) refuses a new nudge and releases a held one to nobody.
    const oneWayId = await seedPairDay(pair, oneWay, [
      { userId: alice.userId, pickedAt: kathmanduInstant(oneWay, '04:00') },
    ]);
    expect((await record(supabaseAdmin, alice, oneWayId, 'prompt', kathmanduInstant(oneWay, '05:00'))).error).toBeNull();
    const unlink = await supabaseAdmin.from('users').update({ partner_id: null }).eq('id', bob.userId);
    expect(unlink.error).toBeNull();
    const refused = await record(supabaseAdmin, alice, oneWayId, 'button', kathmanduInstant(oneWay, '05:30'));
    expect(refused.error?.code).toBe('P0002');
    await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(oneWay, '08:10') });
    const oneWayRow = await rowOf(supabaseAdmin, alice, oneWayId, 'prompt');
    expect([oneWayRow.held, oneWayRow.released_at]).toEqual([true, null]);
    const none = await supabaseAdmin.from('daily_nudges').select('id').eq('from_user', alice.userId).eq('day_id', oneWayId);
    expect(none.data).toHaveLength(1);
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', oneWayRow.id)).toEqual(zeros);
  });

  test('[P0] a nudge after the partner\'s 08:00 is not held and pushes at once, and a held one beside it is dropped at the next tick', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const { alice, bobDevices, pair } = await setUpHeldPair(supabaseAdmin, cleanup);
    const day = kathmanduDay(5);
    const dayId = await seedPairDay(pair, day, [{ userId: alice.userId, pickedAt: kathmanduInstant(day, '04:00') }]);

    // Held at 06:00, then the button at 08:02 goes out at once.
    expect((await record(supabaseAdmin, alice, dayId, 'prompt', kathmanduInstant(day, '06:00'))).error).toBeNull();
    expect((await record(supabaseAdmin, alice, dayId, 'button', kathmanduInstant(day, '08:02'))).error).toBeNull();
    const heldRow = await rowOf(supabaseAdmin, alice, dayId, 'prompt');
    const pushed = await rowOf(supabaseAdmin, alice, dayId, 'button');
    expect([heldRow.held, pushed.held]).toEqual([true, false]);

    const rows = await awaitRequests(supabaseAdmin, pushed.id, 'daily_nudge_id', 2);
    expect(rows.map((r) => r.token).sort()).toEqual([...bobDevices].sort());
    for (const row of rows) expect(row.payload).toEqual(nudgeCopy(alice));

    // The 08:05 tick drops the held one: no second push, both count as used.
    await supabaseAdmin.rpc('release_held_daily_nudges', { at: kathmanduInstant(day, '08:05') });
    const after = await rowOf(supabaseAdmin, alice, dayId, 'prompt');
    expect(after.released_at).toBeNull();
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', after.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, after.id, 'daily_nudge_id')).toEqual([]);
    expect((await record(supabaseAdmin, alice, dayId, 'prompt', kathmanduInstant(day, '09:00'))).error?.code).toBe('DQ010');
  });
});
