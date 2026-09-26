/**
 * Love-note test helpers — teardown for the notes a spec sends.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * A spec that sends a note through the UI never learns the row's id, so the
 * note's unique content is the only handle there is. The delete is also keyed
 * on THIS worker's own pair (`resolveOwnPair`, keyed on `TEST_WORKER_INDEX`),
 * so a content collision or a mis-resolved identity deletes nothing of another
 * worker's — the same shape as the teardown in `love-notes-realtime.spec.ts`.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '../factories';
import { expect } from '../merged-fixtures';
import { resolveOwnPair } from './events';

/**
 * Delete the `love_notes` rows with exactly this content sent by either half of
 * this worker's pair, and return the deleted ids.
 *
 * The delete's own error is returned, not thrown; resolving the pair can still
 * throw.
 */
export async function deleteOwnPairNotes(
  supabaseAdmin: TypedSupabaseClient,
  content: string
): Promise<{ data: string[] | null; error: PostgrestError | null }> {
  const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
  const { data, error } = await supabaseAdmin
    .from('love_notes')
    .delete()
    .eq('content', content)
    .in('from_user_id', [userId, partnerId])
    .select('id');

  return { data: data ? data.map((row) => row.id) : null, error };
}

/**
 * Teardown for a spec's `test.afterEach`: delete the note it sent and check the
 * delete worked.
 *
 * Every check is soft, so one failed check does not stop the next from running,
 * and a throw from resolving the pair or from the delete is recorded the same
 * way. The count is checked, not just the error, because a filter that matches
 * nothing also answers `error: null`; it is checked only when `committed` says
 * the POST answered 2xx, so a test that failed before its send gets no second,
 * false failure.
 */
export async function deleteSentNote(
  supabaseAdmin: TypedSupabaseClient,
  content: string,
  committed: boolean
): Promise<void> {
  try {
    const { data, error } = await deleteOwnPairNotes(supabaseAdmin, content);
    expect.soft(error, 'Teardown must delete the note this test sent').toBeNull();
    if (committed) {
      expect
        .soft(data ?? [], 'Teardown must delete exactly the one note this test sent')
        .toHaveLength(1);
    }
  } catch (error) {
    expect.soft(error, 'Teardown must delete the note this test sent').toBeUndefined();
  }
}
