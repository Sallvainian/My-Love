/**
 * Teardown bodies for `cleanup.defer`.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { TypedSupabaseClient } from '../factories';
import type { Cleanup } from '../fixtures/cleanup';
import { expect } from '../merged-fixtures';

type RowTable = 'events' | 'interactions' | 'love_notes' | 'moods' | 'photos';

/**
 * Delete one row a test created, by its id, and check that it went.
 *
 * The count is checked, not just the error, because a filter that matches
 * nothing also answers `error: null`. It is checked only when `committed` says
 * the row is known to exist, so a test that failed before its write gets no
 * second, false failure — the shape of `deleteSentNote`.
 */
export async function deleteRowById(
  supabaseAdmin: TypedSupabaseClient,
  table: RowTable,
  id: string,
  committed = true
): Promise<void> {
  const { data, error } = await supabaseAdmin.from(table).delete().eq('id', id).select('id');
  if (error) throw error;
  if (committed) {
    expect
      .soft(data, `Teardown must delete exactly the one ${table} row this test created`)
      .toHaveLength(1);
  }
}

/**
 * Defer deleting the pair's `couple_settings` row when it does not exist yet.
 *
 * A spec that upserts its pool pair's row creates it whenever no earlier run
 * left one, and a reset that only clears columns keeps it, so the row would
 * outlive the run. Call this before the first write and before deferring any
 * reset that writes the row again: deferred functions run newest first, so the
 * delete then runs last. A row that already existed is left alone.
 */
export async function deferCoupleRowRemovalIfNew(
  supabaseAdmin: TypedSupabaseClient,
  cleanup: Cleanup,
  userId: string,
  partnerId: string
): Promise<void> {
  const [user_a, user_b] = userId < partnerId ? [userId, partnerId] : [partnerId, userId];
  const { count, error } = await supabaseAdmin
    .from('couple_settings')
    .select('*', { count: 'exact', head: true })
    .eq('user_a', user_a)
    .eq('user_b', user_b);
  if (error) throw error;
  if (count !== 0) return;
  cleanup.defer("delete the pair's couple_settings row this test created", async () => {
    const { error: deleteError } = await supabaseAdmin
      .from('couple_settings')
      .delete()
      .eq('user_a', user_a)
      .eq('user_b', user_b);
    if (deleteError) throw deleteError;
  });
}
