/**
 * Installed builds keep their Settings (story 11.2, criterion 7), over the wire against
 * the shared local stack.
 *
 * A shell installed before the epic has not taken the live update, so it still selects all
 * twelve `push_preferences` columns by name and writes `daily_question` or
 * `daily_partner_picked` alone. The server this story builds drops neither column (epic 10 does,
 * DW-548), so those requests must still succeed and keep the stored values. The select string
 * below is the old build's `COLUMNS`, typed out by hand on purpose: the app's own
 * `pushPreferencesService` no longer names the two columns, and this spec must not follow it.
 *
 * Speaks as this worker's own pool user (`supabaseAsUser`, a real JWT, so RLS and grants apply).
 * Both switches are put back to on at the end, whatever happened.
 */
import { resolveWorkerPairIds } from '../support/factories/events';
import { test, expect } from '../support/merged-fixtures';

/** What the build before story 11.2 selects, in its order. */
const OLD_BUILD_COLUMNS =
  'love_notes, moods, photos, pokes_and_kisses, partner_requests, dates, date_reminders, ' +
  'daily_question, daily_partner_picked, daily_nudge, daily_reminder, daily_both_answered';

test.describe('An installed build before the epic still reads and writes its switches', () => {
  test('[P0] selects all twelve columns, and upserts either removed column alone with its value kept', async ({
    supabaseAdmin,
    supabaseAsUser,
  }) => {
    const { userId } = await resolveWorkerPairIds(supabaseAdmin);

    try {
      // GIVEN the old build's full select, WHEN it loads its switches, THEN all twelve columns come back
      // (an account with no row yet answers no row, which the build reads as every switch on).
      const read = await supabaseAsUser
        .from('push_preferences')
        .select(OLD_BUILD_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle();
      expect(read.error).toBeNull();
      if (read.data) {
        expect(Object.keys(read.data).sort()).toEqual(OLD_BUILD_COLUMNS.split(', ').sort());
      }

      // WHEN it writes the New question switch alone and reads the row back with the twelve columns,
      // THEN the write succeeds and the value is kept.
      const first = await supabaseAsUser
        .from('push_preferences')
        .upsert({ user_id: userId, daily_question: false }, { onConflict: 'user_id' })
        .select(OLD_BUILD_COLUMNS)
        .single();
      expect(first.error).toBeNull();
      expect(Object.keys(first.data!).sort()).toEqual(OLD_BUILD_COLUMNS.split(', ').sort());
      expect(first.data).toMatchObject({ daily_question: false });

      // AND the Partner picked switch alone, with the first one's value still kept.
      const second = await supabaseAsUser
        .from('push_preferences')
        .upsert({ user_id: userId, daily_partner_picked: false }, { onConflict: 'user_id' })
        .select(OLD_BUILD_COLUMNS)
        .single();
      expect(second.error).toBeNull();
      expect(second.data).toMatchObject({ daily_question: false, daily_partner_picked: false });

      // AND the stored row, read through the same twelve-column select, still holds both values.
      const stored = await supabaseAsUser
        .from('push_preferences')
        .select(OLD_BUILD_COLUMNS)
        .eq('user_id', userId)
        .single();
      expect(stored.error).toBeNull();
      expect(stored.data).toMatchObject({
        daily_question: false,
        daily_partner_picked: false,
        daily_nudge: true,
        daily_reminder: true,
        daily_both_answered: true,
      });
    } finally {
      const restored = await supabaseAsUser
        .from('push_preferences')
        .upsert({ user_id: userId, daily_question: true, daily_partner_picked: true }, { onConflict: 'user_id' });
      expect(restored.error).toBeNull();
    }
  });
});
