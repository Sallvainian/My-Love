/**
 * Fixed-instant helpers for the Daily push specs that call the server's
 * schedule functions with an instant of their own (`enqueue_daily_reminders(at)`,
 * `record_daily_nudge(..., at)`, `release_held_daily_nudges(at)`), shared by
 * `tests/api/push-daily-reminders.spec.ts` and `tests/api/push-daily-nudge-held.spec.ts`.
 *
 * The pair lives in `Asia/Kathmandu` (+05:45, no DST): 08:25 there is 02:40 UTC, so a
 * whole-hour zone reads :40 and is never inside a 30-minute window (a window ends at
 * :30). Only an account in a half-hour zone could be due too, and `otherAccountsDueAt`
 * checks that none is before a spec relies on `enqueue_daily_reminders`' count.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import { expect } from '../merged-fixtures';
import { runPsql } from './migration-replay';

export const KATHMANDU_ZONE = 'Asia/Kathmandu';
export const KATHMANDU_OFFSET_MINUTES = 345;

/** Kathmandu's yesterday as `YYYY-MM-DD`, or the date `daysBack` days before it. */
export function kathmanduDay(daysBack = 1): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: KATHMANDU_ZONE }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

/** Kathmandu's yesterday as `YYYY-MM-DD`. */
export const kathmanduYesterday = () => kathmanduDay(1);

/** The instant at which Kathmandu's wall clock reads `time` (`HH:MM`) on `day`. */
export const kathmanduInstant = (day: string, time: string) =>
  new Date(`${day}T${time}:00+05:45`).toISOString();

/** Stores a user's zone as `get_daily_day` would (`user_time_zones`), through psql. */
export async function storeZone(userId: string, zone: string, offsetMinutes: number): Promise<void> {
  const stored = await runPsql(
    'insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at) ' +
      `values ('${userId}', '${zone}', ${offsetMinutes}, public.effective_zone('${zone}', ${offsetMinutes}), now());\n`
  );
  expect(stored.code, stored.stderr).toBe(0);
}

/**
 * Accounts other than `own` that are due (linked both ways, a device, a zone, clock in
 * a window) at the instant: `enqueue_daily_reminders` sees every account on the stack.
 */
export async function otherAccountsDueAt(instant: string, own: string[]): Promise<number> {
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

/**
 * The pair's `couple_days` id for `day` (creating it through `assign_couple_day`) and, when
 * `pickers` names users, each one's pick of `this` made at `pickedAt`. A pick cannot be
 * written through the API (`daily_picks` grants no write), so this runs as `postgres`.
 */
export async function seedPairDay(
  pair: { userId: string; partnerId: string },
  day: string,
  pickers: { userId: string; pickedAt: string; isSecond?: boolean }[]
): Promise<string> {
  const [userA, userB] = [pair.userId, pair.partnerId].sort();
  const statements = [`select public.assign_couple_day('${userA}', '${userB}', date '${day}');`];
  for (const { userId, pickedAt, isSecond = false } of pickers) {
    statements.push(
      'insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second) ' +
        `select cd.id, '${userId}', 'this', timestamptz '${pickedAt}', '${KATHMANDU_ZONE}', ${KATHMANDU_OFFSET_MINUTES}, ` +
        `public.effective_zone('${KATHMANDU_ZONE}', ${KATHMANDU_OFFSET_MINUTES}), ${isSecond} ` +
        `from public.couple_days cd where cd.user_a = '${userA}' and cd.user_b = '${userB}' and cd.day = date '${day}';`
    );
  }
  statements.push(
    `select cd.id from public.couple_days cd where cd.user_a = '${userA}' and cd.user_b = '${userB}' and cd.day = date '${day}';`
  );
  const seeded = await runPsql(`${statements.join('\n')}\n`);
  expect(seeded.code, seeded.stderr).toBe(0);
  const dayId = seeded.stdout.trim().split('\n').pop();
  expect(dayId, `the pair's day ${day}`).toMatch(/^[0-9a-f-]{36}$/);
  return dayId!;
}
