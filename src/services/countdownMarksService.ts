/**
 * Countdown Marks Service — the dates the signed-in account marked for the
 * "In a month" and "In a week" reminders (`public.countdown_marks`, one row per
 * marked date key).
 *
 * Supabase is the source of truth. The marks reach the screens through the
 * `countdown-marks` local copy (`settingsSlice.countdownMarks`), so the date
 * reminders' re-plan reads them offline. A date with no row is not marked.
 * Reads and writes are online-only and THROW — see `accountDataError.ts` for
 * the error convention (offline is `AccountDataError('offline')`).
 *
 * A mark is an insert that ignores a duplicate, so a retry after a timeout is
 * a no-op; an unmark is a delete, which succeeds when the row is already gone.
 * The key forms are listed beside the table's check in
 * `20261101010000_countdown_marks.sql`; the planner's constants are
 * `MARK_KEYS` in `dateReminders.ts`.
 *
 * @module services/countdownMarksService
 */

import { supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';
import { requestTimeout, requireOnline, toAccountDataError } from './accountDataError';

const WHAT = 'Reminders';

export const countdownMarksService = {
  /** The date keys the account has marked; no rows is an answer, and reads as `[]`. */
  async fetchCountdownMarks(userId: string): Promise<string[]> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('countdown_marks')
        .select('date_key')
        .eq('user_id', userId)
        .abortSignal(requestTimeout());
      if (error) throw error;
      return (data ?? []).map((row) => row.date_key);
    } catch (error) {
      throw toAccountDataError('CountdownMarksService.fetchCountdownMarks', error);
    }
  },

  /** Marks (`marked` true) or unmarks (false) one date key. Idempotent either way. */
  async setCountdownMark(userId: string, key: string, marked: boolean): Promise<void> {
    requireOnline(WHAT);
    try {
      if (marked) {
        const { error } = await supabase
          .from('countdown_marks')
          .upsert(
            { user_id: userId, date_key: key },
            { onConflict: 'user_id,date_key', ignoreDuplicates: true }
          )
          .abortSignal(requestTimeout());
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('countdown_marks')
          .delete()
          .eq('user_id', userId)
          .eq('date_key', key)
          .abortSignal(requestTimeout());
        if (error) throw error;
      }
      logger.debug('[CountdownMarksService] Saved a countdown mark');
    } catch (error) {
      throw toAccountDataError('CountdownMarksService.setCountdownMark', error);
    }
  },
};
