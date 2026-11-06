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
 * from, and the row audit (`couple_days` is in `AUDITED_TABLES`) fails a run
 * that leaves days behind. Checked, because a silently-failed clear leaves
 * stray rows that break the NEXT test's premise.
 */
export async function clearPairDays(
  supabaseAdmin: TypedSupabaseClient,
  pair: WorkerPairIds
): Promise<void> {
  const [userA, userB] =
    pair.userId < pair.partnerId ? [pair.userId, pair.partnerId] : [pair.partnerId, pair.userId];

  const { error } = await supabaseAdmin
    .from('couple_days')
    .delete()
    .eq('user_a', userA)
    .eq('user_b', userB);

  if (error) {
    throw new Error(`clearPairDays: failed to clear the worker pair's days: ${error.message}`);
  }
}
