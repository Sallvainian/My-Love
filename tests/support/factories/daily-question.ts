/**
 * Daily Question Test Factory
 *
 * Service-role helper for the running worker's own couple. The daily tables
 * grant `anon` and `authenticated` nothing, so a spec cannot clear its pair's
 * days through a user client, and no client RPC deletes a day.
 */
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

/**
 * Three coach questions with fixed ids, so a local stack always has a pool to
 * draw from. Coach rows have no pair (`daily_questions_coach_or_written`), so
 * every worker's pair can draw them, and `couple_days.question_id` is NO ACTION:
 * a row a day still asks cannot be deleted. These rows are therefore upserted
 * with `ignoreDuplicates` and never deleted, and a spec asserts that the page
 * agrees with the question the admin client reads from the pair's
 * `couple_days` row, never a specific text.
 */
export const TEST_COACH_QUESTIONS = [
  {
    id: '00000000-0000-4000-8000-00000000d001',
    this_text: 'Beach day',
    that_text: 'Mountain day',
  },
  {
    id: '00000000-0000-4000-8000-00000000d002',
    this_text: 'Coffee',
    that_text: 'Tea',
  },
  {
    id: '00000000-0000-4000-8000-00000000d003',
    this_text: 'Sunrise',
    that_text: 'Sunset',
  },
] as const;

/** Make sure the test coach rows exist. Idempotent; safe under parallel workers. */
export async function ensureTestCoachQuestions(supabaseAdmin: TypedSupabaseClient): Promise<void> {
  const { error } = await supabaseAdmin
    .from('daily_questions')
    .upsert(
      TEST_COACH_QUESTIONS.map((row) => ({ ...row })),
      { onConflict: 'id', ignoreDuplicates: true }
    );

  if (error) {
    throw new Error(`ensureTestCoachQuestions: failed to upsert the coach rows: ${error.message}`);
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
