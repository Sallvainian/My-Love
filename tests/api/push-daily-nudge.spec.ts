/**
 * The server takes a nudge and pushes it, over the wire against the local stack
 * (epic-daily-pushes-and-nudge story 8.7, reshaped by story 11.1). The client RPC
 * `send_daily_nudge(day_id, source)` writes one `daily_nudges` row through
 * `record_daily_nudge`, from the prompt or the button, once per sender, day and
 * source; a row that is not `held` posts `{kind: 'daily_nudge', id}` to `send-push`
 * through `pg_net` on insert, and the sender records the request it would have sent
 * (CI cannot reach APNs).
 *
 * Every nudge goes through the client RPC as its own party, so the real write path
 * (the pair, the pick and source rules, the unique key) fires the trigger. Throwaway
 * pairs only; the worker's pool pair's rows are never touched.
 *
 *   1. Alice and Bob (Alice one device, Bob two), today seeded with Alice's pick only:
 *      Alice's prompt nudge answers her snapshot with the prompt sent and Bob's two
 *      devices hear it (title "{Alice} nudged you", body "{Alice} answered the daily
 *      question and wants to know your answer!", the default sound), unless the
 *      server held it (the host clock before 08:00 on the day, which the row's `held`
 *      says, so the case never guesses the hour); a hand post of the same `{kind, id}`
 *      is a replay; the prompt again is refused `DQ010` and adds no row; the button is
 *      still taken and recorded as the button's; Bob, who has not picked, is refused
 *      `DQ007`; an unknown source is refused `22023`.
 *   2. Carol and Dave, Dave's `daily_nudge` switch off: Carol's nudge succeeds and
 *      records nothing for Dave (shown by a hand post that answers all zeros plus an
 *      empty `requestsFor`, never by a sleep).
 *   3. Erin and Finn: the one-argument call an installed build makes
 *      (`send_daily_nudge({day_id})`) is recorded as the button's nudge, and the day's
 *      answer carries `nudges` and no `nudge`, which the frozen old-build schema parses
 *      (criterion 18).
 *
 * The held branch, the release and the closing instant need instants of their own:
 * `push-daily-nudge-held.spec.ts`.
 *
 * A host-local midnight inside a test's timeout would turn the Daily day (and with it
 * the closing instant), and a host-local 08:00 would release a nudge held before it, so
 * each test first calls `waitClearOfDailyTurns`, which waits past the turn (DW-534,
 * DW-555).
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker, so this file and
 * the other push specs never run at once.
 */
import type { TypedSupabaseClient } from '../support/factories';
import type { Cleanup } from '../support/fixtures/cleanup';
import { isoDateDaysFromNow, waitClearOfDailyTurns } from '../support/helpers/events';
import { OldBuildSnapshotSchema } from '../support/helpers/old-build-day-schema';
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
      .select('id, source, held, released_at, to_user')
      .eq('from_user', party.userId)
      .order('source');
    expect(error, `${party.name}'s nudges`).toBeNull();
    return data!;
  }

  const nudgeBody = (from: Party) => `${from.name} answered the daily question and wants to know your answer!`;

  test('[P0] a nudge answers with its source sent and pushes the partner unless held; a repeat from the source and a nudge before one\'s own pick are refused, the other source is taken', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    // Alice nudges Bob: both of Bob's devices hear it, with the default sound.
    const { first: alice, second: bob, secondDevices, dayId } = await setUpDailyPair(supabaseAdmin, cleanup, ['a', 'b']);

    const sent = await alice.client.rpc('send_daily_nudge', { day_id: dayId, source: 'prompt' });
    expect(sent.error).toBeNull();
    const snapshot = sent.data as {
      state: string;
      nudge?: unknown;
      nudges: { prompt_sent: boolean; button_sent: boolean; closes_at: string | null };
    };
    expect(snapshot.state).toBe('me');
    // The day's answer says what is sent and when the question stops taking nudges: no `nudge` key.
    expect(snapshot.nudge).toBeUndefined();
    expect(snapshot.nudges.prompt_sent).toBe(true);
    expect(snapshot.nudges.button_sent).toBe(false);
    expect(Date.parse(snapshot.nudges.closes_at!)).toBeGreaterThan(Date.now());

    const rows = await nudgesFrom(supabaseAdmin, alice);
    expect(rows).toHaveLength(1);
    expect(rows[0].to_user).toBe(bob.userId);
    expect(rows[0].source).toBe('prompt');

    if (rows[0].held) {
      // Before 08:00 on the partner's clock the server holds it: recorded, no push yet.
      expect(await postKindToSender(supabaseAdmin, 'daily_nudge', rows[0].id)).toEqual(zeros);
      expect(await requestsFor(supabaseAdmin, rows[0].id, 'daily_nudge_id')).toEqual([]);
    } else {
      const nudgeRows = await awaitRequests(supabaseAdmin, rows[0].id, 'daily_nudge_id', 2);
      expect(nudgeRows.map((r) => r.token).sort()).toEqual([...secondDevices].sort());
      for (const row of nudgeRows) {
        expect(row.payload).toEqual(
          dailyPayload('daily_nudge', `${alice.name} nudged you`, nudgeBody(alice), 'default')
        );
      }
      // A hand post of what the trigger already posted is a replay for every device.
      expect(await postKindToSender(supabaseAdmin, 'daily_nudge', rows[0].id)).toEqual({ ...zeros, skipped: 2 });
    }

    // The prompt's nudge is spent: the same call again is refused and adds no row.
    const again = await alice.client.rpc('send_daily_nudge', { day_id: dayId, source: 'prompt' });
    expect(again.error?.code).toBe('DQ010');
    expect(await nudgesFrom(supabaseAdmin, alice)).toEqual(rows);

    // Using the prompt did not spend the button: its own nudge is taken and recorded as the button's.
    const button = await alice.client.rpc('send_daily_nudge', { day_id: dayId, source: 'button' });
    expect(button.error).toBeNull();
    expect((button.data as { nudges: { prompt_sent: boolean; button_sent: boolean } }).nudges).toMatchObject({
      prompt_sent: true,
      button_sent: true,
    });
    expect((await nudgesFrom(supabaseAdmin, alice)).map((r) => r.source)).toEqual(['button', 'prompt']);
    const repeatButton = await alice.client.rpc('send_daily_nudge', { day_id: dayId, source: 'button' });
    expect(repeatButton.error?.code).toBe('DQ010');

    // A source the server does not know is refused and records nothing.
    const other = await alice.client.rpc('send_daily_nudge', { day_id: dayId, source: 'other' });
    expect(other.error?.code).toBe('22023');
    expect(await nudgesFrom(supabaseAdmin, alice)).toHaveLength(2);

    // Bob has not picked, so he cannot nudge, though Alice has.
    const early = await bob.client.rpc('send_daily_nudge', { day_id: dayId, source: 'prompt' });
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

    const quiet = await carol.client.rpc('send_daily_nudge', { day_id: pairDay, source: 'button' });
    expect(quiet.error).toBeNull();
    const [quietRow] = await nudgesFrom(supabaseAdmin, carol);
    expect(quietRow.to_user).toBe(dave.userId);
    expect(await postKindToSender(supabaseAdmin, 'daily_nudge', quietRow.id)).toEqual(zeros);
    expect(await requestsFor(supabaseAdmin, quietRow.id, 'daily_nudge_id')).toEqual([]);
    // It counts as the button's one nudge: a second is refused.
    const again = await carol.client.rpc('send_daily_nudge', { day_id: pairDay, source: 'button' });
    expect(again.error?.code).toBe('DQ010');
  });

  test('[P0] an installed build\'s one-argument call is recorded as the button\'s nudge, and its day answer parses under its old schema with no nudge', async ({
    supabaseAdmin,
    cleanup,
  }, testInfo) => {
    await waitClearOfDailyTurns(testInfo);
    const { first: erin, dayId } = await setUpDailyPair(supabaseAdmin, cleanup, ['e', 'f']);

    const old = await erin.client.rpc('send_daily_nudge', { day_id: dayId });
    expect(old.error).toBeNull();

    const [row] = await nudgesFrom(supabaseAdmin, erin);
    expect(row.source).toBe('button');
    const answer = old.data as Record<string, unknown>;
    expect(answer).not.toHaveProperty('nudge');
    expect(answer.nudges).toMatchObject({ prompt_sent: false, button_sent: true });

    // The old build's schema (frozen) loads the answer: it strips `nudges` and reads no `nudge`.
    const parsed = OldBuildSnapshotSchema.safeParse(answer);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(parsed.data).not.toHaveProperty('nudge');

    // And the day a build reads for itself is the same shape.
    const read = await erin.client.rpc('get_daily_day_by_id', { day_id: dayId });
    expect(read.error).toBeNull();
    expect(OldBuildSnapshotSchema.safeParse(read.data).success).toBe(true);
    expect(read.data).not.toHaveProperty('nudge');
  });
});
