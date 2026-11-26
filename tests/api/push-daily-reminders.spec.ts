/**
 * The 8 AM and 8 PM pushes on each person's clock, over the wire against the local
 * stack (epic-daily-pushes-and-nudge, story 8.5). `enqueue_daily_reminders(at)`
 * inserts each due person's `daily_reminders` row, the row's AFTER INSERT trigger
 * posts it to `send-push` through `pg_net`, and the sender records the request it
 * would have sent (CI cannot reach APNs).
 *
 * A throwaway linked pair lives in `Asia/Kathmandu` (+05:45, no DST), Alice with one
 * device and Bob with two. The date D is Kathmandu's yesterday, so the instants sit in
 * the past; they are 08:25 and 20:25 on D in Kathmandu, which are 02:40 and 14:40 UTC.
 * A whole-hour zone reads those as :40, never inside a window (a window ends at :30),
 * so only an account in a half-hour zone could be due too. The function sees every
 * account, so a psql guard first requires that no account but this pair is due at
 * either instant: the rpc's return count is then the pair's own, and no other
 * account's rows are touched (the spec never reaches the pool pairs' rows).
 *
 * Asserted: the rpc at D 08:25 inserts 2 rows, both `morning`, whose records quote
 * D's question with no streak ("Day 1") and no sound; a repeat inserts 0 and the
 * records are unchanged; after Alice's pick for D, the rpc at D 20:25 inserts
 * Alice's `evening_partner` and Bob's `evening_self`, each recorded for that
 * person's devices only, with the default sound.
 *
 * Requires `supabase start` with the edge runtime serving `send-push`
 * (`needs-edge-functions` in CI); the `api` project runs one worker.
 */
import type { TypedSupabaseClient } from '../support/factories';
import { readPairQuestionsByDay } from '../support/factories/daily-question';
import { runPsql } from '../support/helpers/migration-replay';
import {
  awaitRequests,
  createParty as createThrowawayParty,
  dailyPayload,
  link,
  registerDevice,
  requestsFor,
} from '../support/helpers/push-requests';
import { test, expect } from '../support/merged-fixtures';

const ZONE = 'Asia/Kathmandu';
const OFFSET_MINUTES = 345;

/** Kathmandu's yesterday as `YYYY-MM-DD`. */
function kathmanduYesterday(): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** The instant at which Kathmandu's wall clock reads `time` on `day`. */
const kathmanduInstant = (day: string, time: string) => new Date(`${day}T${time}:00+05:45`).toISOString();

test.describe('Daily reminders on each person\'s clock', () => {
  /** Accounts other than these two that are due (linked both ways, a device, a zone, clock in a window) at the instant. */
  async function otherAccountsDueAt(instant: string, own: string[]) {
    const ids = own.map((id) => `'${id}'`).join(', ');
    const result = await runPsql(
      `select count(*) from public.users u
         join public.users p on p.id = u.partner_id and p.partner_id = u.id
         join public.user_time_zones z on z.user_id = u.id
        cross join lateral (select ((timestamptz '${instant}') at time zone z.effective_zone)::time as local_time) t
        where exists (select 1 from public.push_devices d where d.user_id = u.id)
          and u.id not in (${ids})
          and ((t.local_time >= '08:00' and t.local_time < '08:30') or (t.local_time >= '20:00' and t.local_time < '20:30'));\n`
    );
    expect(result.code, result.stderr).toBe(0);
    return Number(result.stdout.trim());
  }

  async function reminderId(supabaseAdmin: TypedSupabaseClient, userId: string, slot: 'morning' | 'evening', day: string) {
    const { data, error } = await supabaseAdmin
      .from('daily_reminders')
      .select('id, kind, local_date')
      .eq('user_id', userId)
      .eq('slot', slot)
      .eq('local_date', day)
      .single();
    expect(error, `${slot} reminder`).toBeNull();
    return data!;
  }

  test('[P0] the morning and evening pushes are queued on the pair\'s own clock, once, and recorded for the right devices', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const alice = await createThrowawayParty(supabaseAdmin, cleanup, 'dailyrem', 'Rem', 'a');
    const bob = await createThrowawayParty(supabaseAdmin, cleanup, 'dailyrem', 'Rem', 'b');
    await link(supabaseAdmin, alice, bob);
    const aliceDevice = await registerDevice(alice, 'sandbox');
    const [bobPhone, bobTablet] = [await registerDevice(bob, 'sandbox'), await registerDevice(bob, 'production')];

    for (const userId of [alice.userId, bob.userId]) {
      const stored = await runPsql(
        'insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at) ' +
          `values ('${userId}', '${ZONE}', ${OFFSET_MINUTES}, public.effective_zone('${ZONE}', ${OFFSET_MINUTES}), now());\n`
      );
      expect(stored.code, stored.stderr).toBe(0);
    }

    const day = kathmanduYesterday();
    const morningAt = kathmanduInstant(day, '08:25');
    const eveningAt = kathmanduInstant(day, '20:25');
    const own = [alice.userId, bob.userId];

    // No other account is due at either instant, so the rpc's count is this pair's own.
    expect(await otherAccountsDueAt(morningAt, own), 'accounts due at the morning instant').toBe(0);
    expect(await otherAccountsDueAt(eveningAt, own), 'accounts due at the evening instant').toBe(0);

    // ---- 8 AM on D in Kathmandu: both get a morning row ----
    const morning = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: morningAt });
    expect(morning.error).toBeNull();
    expect(morning.data).toBe(2);

    const aliceMorning = await reminderId(supabaseAdmin, alice.userId, 'morning', day);
    const bobMorning = await reminderId(supabaseAdmin, bob.userId, 'morning', day);
    expect([aliceMorning.kind, bobMorning.kind]).toEqual(['morning', 'morning']);

    const pair = { userId: alice.userId, partnerId: bob.userId };
    const question = (await readPairQuestionsByDay(supabaseAdmin, pair)).find((d) => d.day === day);
    expect(question, `the pair's day ${day}`).toBeDefined();
    const asked = `${question!.this} or ${question!.that}?`;
    const morningPayload = dailyPayload('daily_question', asked, "Today's question is here. Day 1 is waiting.");

    const aliceMorningRows = await awaitRequests(supabaseAdmin, aliceMorning.id, 'daily_reminder_id', 1);
    expect(aliceMorningRows.map((r) => [r.token, r.delivery])).toEqual([[aliceDevice, 'recorded']]);
    const bobMorningRows = await awaitRequests(supabaseAdmin, bobMorning.id, 'daily_reminder_id', 2);
    expect(bobMorningRows.map((r) => [r.token, r.delivery]).sort()).toEqual(
      [
        [bobPhone, 'recorded'],
        [bobTablet, 'recorded'],
      ].sort()
    );
    for (const row of [...aliceMorningRows, ...bobMorningRows]) {
      expect(row.payload).toEqual(morningPayload);
    }

    // ---- the same instant again inserts nothing and records nothing new ----
    const repeat = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: morningAt });
    expect(repeat.error).toBeNull();
    expect(repeat.data).toBe(0);
    expect(await requestsFor(supabaseAdmin, aliceMorning.id, 'daily_reminder_id')).toEqual(aliceMorningRows);
    expect(await requestsFor(supabaseAdmin, bobMorning.id, 'daily_reminder_id')).toEqual(bobMorningRows);

    // ---- Alice picks D; 8 PM then tells her Bob has not, and Bob to pick ----
    const picked = await runPsql(
      'insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second) ' +
        `select cd.id, '${alice.userId}', 'this', timestamptz '${morningAt}' + interval '1 hour', '${ZONE}', ${OFFSET_MINUTES}, ` +
        `public.effective_zone('${ZONE}', ${OFFSET_MINUTES}), false ` +
        `from public.couple_days cd where cd.user_a = '${[alice.userId, bob.userId].sort()[0]}' ` +
        `and cd.user_b = '${[alice.userId, bob.userId].sort()[1]}' and cd.day = date '${day}';\n`
    );
    expect(picked.code, picked.stderr).toBe(0);

    const evening = await supabaseAdmin.rpc('enqueue_daily_reminders', { at: eveningAt });
    expect(evening.error).toBeNull();
    expect(evening.data).toBe(2);

    const aliceEvening = await reminderId(supabaseAdmin, alice.userId, 'evening', day);
    const bobEvening = await reminderId(supabaseAdmin, bob.userId, 'evening', day);
    expect([aliceEvening.kind, bobEvening.kind]).toEqual(['evening_partner', 'evening_self']);

    const aliceEveningRows = await awaitRequests(supabaseAdmin, aliceEvening.id, 'daily_reminder_id', 1);
    expect(aliceEveningRows.map((r) => r.token)).toEqual([aliceDevice]);
    expect(aliceEveningRows[0].payload).toEqual(
      dailyPayload('daily_reminder', `${bob.name} hasn't done their daily`, 'Nudge them before midnight.', 'default')
    );

    const bobEveningRows = await awaitRequests(supabaseAdmin, bobEvening.id, 'daily_reminder_id', 2);
    expect(bobEveningRows.map((r) => r.token).sort()).toEqual([bobPhone, bobTablet].sort());
    for (const row of bobEveningRows) {
      expect(row.payload).toEqual(
        dailyPayload('daily_reminder', "You haven't done your daily yet", `${asked} It takes two taps.`, 'default')
      );
    }
  });
});
