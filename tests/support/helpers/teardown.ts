/**
 * Teardown bodies for `cleanup.defer`.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { TypedSupabaseClient } from '../factories';
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
