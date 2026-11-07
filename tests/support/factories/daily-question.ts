/**
 * Daily Question Test Factory
 *
 * Service-role helper for the running worker's own couple. The daily tables
 * grant `anon` and `authenticated` nothing, so a spec cannot clear its pair's
 * days through a user client, and no client RPC deletes a day.
 *
 * `seedPairDays` (streak and partner page, story 7.4; stories 6, 7 and 8 use it
 * too) builds a pair's past days, with or without each partner's pick, so a
 * spec can start from a streak instead of living it.
 */
import { isoDateDaysFromNow } from '../helpers/events';
import { runPsql } from '../helpers/migration-replay';
import type { WorkerPairIds } from './events';
import type { TypedSupabaseClient } from './index';

/**
 * Remove every `couple_days` row of this worker's ordered pair. The pair's
 * picks go with them (`daily_picks.day_id` cascades), as does any question the
 * couple wrote from one of those days (`daily_questions.source_day_id`); other
 * pairs' rows are untouched.
 *
 * Call it before each test, and defer it again at teardown: a day left by an
 * earlier test fixes the question, the writer and the picks the next one starts
 * from. The row audit counts the pair's `daily_picks`, not `couple_days`
 * (every signed-in start assigns today's day, through the Daily copy's
 * refresher), so a run that leaves picks behind fails. Checked, because a silently-failed clear leaves
 * stray rows that break the NEXT test's premise.
 */
export async function clearPairDays(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<void> {
  const [userA, userB] = orderedPair(pair);

  const { error } = await supabaseAdmin
    .from('couple_days')
    .delete()
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(`clearPairDays: failed to clear the worker pair's days: ${error.message}`);
  }
}

/** Whose picks a seeded day holds: both partners, the worker user, the partner, or nobody. */
export type SeededPicks = 'both' | 'user' | 'partner' | 'none';

export interface SeededDay {
  /** 0 is today, 1 yesterday, ... in the Node host's local date (the browser's zone). */
  daysAgo: number;
  picks: SeededPicks;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONE_NAME = /^[A-Za-z0-9_+\-/]+$/;

function localDate(daysAgo: number): { iso: string; offsetMinutes: number } {
  const now = new Date();
  const iso = isoDateDaysFromNow(-daysAgo, now);
  // The offset in force at the pick's own instant: now for today, local noon otherwise.
  const [year, month, day] = iso.split('-').map(Number);
  const at = daysAgo === 0 ? now : new Date(year, month - 1, day, 12);
  // East-positive, as the app sends it.
  return { iso, offsetMinutes: -at.getTimezoneOffset() };
}

/**
 * Seed this worker pair's past days: one `couple_days` row per entry through
 * `assign_couple_day`, its `created_at` moved to the day, and the picks the
 * entry names. Dates run from the Node host's local date, which is the
 * browser's zone because the browser runs on the same host with no
 * `timezoneId`, and `get_daily_day` stores that zone, which `couple_streak`
 * reads. Each pick is made in the host zone at local noon of its date (now,
 * for `daysAgo: 0`, so it is never in the future) and the pick's choice is
 * `this`; the partner's pick comes second, so `is_second` is true for it on a
 * `both` day.
 *
 * Why psql: `daily_picks` grants `service_role` SELECT only and
 * `record_daily_pick` is security invoker, so no API role can write a past
 * pick. The script runs as `postgres` in one transaction, so a failure leaves
 * nothing behind. `user_time_zones` is filled for both partners only where a
 * row is absent (the app overwrites it at the next `get_daily_day`, and it
 * stays after `clearPairDays`, which removes the days and, by cascade, the
 * picks). Throws on any error.
 *
 * Call `clearPairDays` first: a date the pair already holds keeps the row it
 * has, and its picks collide with the ones seeded here.
 */
export async function seedPairDays(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds,
  days: readonly SeededDay[]
): Promise<void> {
  const [userA, userB] = orderedPair(pair);
  for (const id of [userA, userB]) {
    if (!UUID.test(id)) throw new Error(`seedPairDays: not a user id: ${id}`);
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!ZONE_NAME.test(zone)) throw new Error(`seedPairDays: unusable host zone: ${zone}`);
  const seen = new Set<number>();
  for (const { daysAgo } of days) {
    if (!Number.isInteger(daysAgo) || daysAgo < 0 || seen.has(daysAgo)) {
      throw new Error(`seedPairDays: daysAgo must be a distinct non-negative integer: ${daysAgo}`);
    }
    seen.add(daysAgo);
  }

  const pairWhere = `user_a = '${userA}' and user_b = '${userB}'`;
  const pairWhereCd = `cd.user_a = '${userA}' and cd.user_b = '${userB}'`;
  const statements: string[] = ['begin;'];

  for (const { daysAgo, picks } of days) {
    const { iso, offsetMinutes } = localDate(daysAgo);
    const instant =
      daysAgo === 0 ? 'now()' : `((date '${iso}' + time '12:00') at time zone '${zone}')`;
    statements.push(
      `select public.assign_couple_day('${userA}', '${userB}', date '${iso}');`,
      `update public.couple_days set created_at = ${instant} where ${pairWhere} and day = date '${iso}';`
    );

    const pickers: string[] = [];
    if (picks === 'both' || picks === 'user') pickers.push(pair.userId);
    if (picks === 'both' || picks === 'partner') pickers.push(pair.partnerId);
    pickers.forEach((userId, index) => {
      statements.push(
        'insert into public.daily_picks ' +
          '(day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second) ' +
          `select cd.id, '${userId}', 'this', ${instant}, '${zone}', ${offsetMinutes}, ` +
          `public.effective_zone('${zone}', ${offsetMinutes}), ${index > 0} ` +
          `from public.couple_days cd where ${pairWhereCd} ` +
          `and cd.day = date '${iso}';`
      );
    });
  }

  const { offsetMinutes: nowOffset } = localDate(0);
  for (const userId of [userA, userB]) {
    statements.push(
      'insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at) ' +
        `values ('${userId}', '${zone}', ${nowOffset}, public.effective_zone('${zone}', ${nowOffset}), now()) ` +
        'on conflict (user_id) do nothing;'
    );
  }
  statements.push('commit;', '');

  const result = await runPsql(statements.join('\n'));
  if (result.code !== 0) {
    throw new Error(
      `seedPairDays: psql failed (exit ${result.code ?? 'signal'}): ${result.stderr.trim() || '<no stderr>'}`
    );
  }

  const dayIds = await readPairDayIds(supabaseAdmin, pair);
  if (dayIds.length < days.length) {
    throw new Error(
      `seedPairDays: expected at least ${days.length} days for the pair, found ${dayIds.length}`
    );
  }
}

/** The question of this worker pair's `couple_days` rows (at most one per date), as `This or That?`. */
export async function readPairQuestionTexts(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<string[]> {
  const [userA, userB] = orderedPair(pair);

  const { data, error } = await supabaseAdmin
    .from('couple_days')
    .select('question_id, daily_questions!couple_days_question_id_fkey(this_text, that_text)')
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(`readPairQuestionTexts: failed to read the pair's days: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const question = row.daily_questions;
    if (!question) throw new Error('readPairQuestionTexts: a day has no question row');
    return `${question.this_text} or ${question.that_text}?`;
  });
}

/** The pair in `couple_days` order: `user_a < user_b`. */
function orderedPair(pair: WorkerPairIds): [string, string] {
  return pair.userId < pair.partnerId ? [pair.userId, pair.partnerId] : [pair.partnerId, pair.userId];
}

/** The ids of this worker pair's `couple_days` rows. */
export async function readPairDayIds(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<string[]> {
  const [userA, userB] = orderedPair(pair);
  const { data, error } = await supabaseAdmin
    .from('couple_days')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(`readPairDayIds: failed to read the pair's days: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

/** Set `created_at` on every `couple_days` row of this worker pair. */
export async function setPairDaysCreatedAt(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds,
  createdAt: Date
): Promise<void> {
  const [userA, userB] = orderedPair(pair);
  const { error } = await supabaseAdmin
    .from('couple_days')
    .update({ created_at: createdAt.toISOString() })
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(`setPairDaysCreatedAt: failed to move the pair's days: ${error.message}`);
  }
}

/**
 * The `couple_days.writer` of one of this worker pair's days: the user whose
 * turn it is to write tomorrow's question. Without `day` it reads the pair's
 * one day and throws unless there is exactly one (both pages must have opened
 * `/daily` first, which assigns it); with `day` (`YYYY-MM-DD`) it reads that
 * date's day, for a pair seeded with past days by `seedPairDays`.
 */
export async function readPairDayWriter(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds,
  day?: string
): Promise<string> {
  const [userA, userB] = orderedPair(pair);
  let query = supabaseAdmin
    .from('couple_days')
    .select('writer')
    .eq('user_a', userA)
    .eq('user_b', userB);
  if (day !== undefined) query = query.eq('day', day);
  const { data, error } = await query;

  if (error) {
    throw new Error(`readPairDayWriter: failed to read the pair's days: ${error.message}`);
  }
  if (data?.length !== 1) {
    throw new Error(`readPairDayWriter: expected one day for the pair, found ${data?.length ?? 0}`);
  }
  return data[0].writer;
}

/** A question this worker pair wrote, as stored. */
export interface WrittenQuestionRow {
  this_text: string;
  that_text: string;
  source_day_id: string | null;
}

/** The `daily_questions` rows the pair wrote (their `user_a/user_b` set), not the coach's. */
export async function readPairWrittenQuestions(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<WrittenQuestionRow[]> {
  const [userA, userB] = orderedPair(pair);
  const { data, error } = await supabaseAdmin
    .from('daily_questions')
    .select('this_text, that_text, source_day_id')
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(
      `readPairWrittenQuestions: failed to read the pair's questions: ${error.message}`
    );
  }
  return data ?? [];
}
