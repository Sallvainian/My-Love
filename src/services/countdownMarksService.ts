/**
 * Countdown Marks Service — the dates whose "Remind me" (the "In a month" and
 * "In a week" reminders) the signed-in account switched off
 * (`public.countdown_marks`, one row per date key the person set).
 *
 * Remind me is on by default (2026-11-05): a date with no row, or with a row
 * whose `reminds` is true (written before the default changed), is on; a row
 * with `reminds` false is off. Supabase is the source of truth. The keys
 * switched off reach the screens through the `reminders-off` local copy
 * (`datesSlice.remindersOff`), so the date reminders' re-plan reads them
 * offline. Reads and writes are online-only and THROW — see
 * `accountDataError.ts` for the error convention (offline is
 * `AccountDataError('offline')`).
 *
 * Switching on deletes the row; switching off deletes it and inserts one with
 * `reminds` false, ignoring a duplicate, so either is a no-op on retry and no
 * UPDATE is needed. The key forms are listed beside the table's check in
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
  /** The date keys whose Remind me the account switched off; none is an answer, and reads as `[]`. */
  async fetchRemindersOff(userId: string): Promise<string[]> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('countdown_marks')
        .select('date_key')
        .eq('user_id', userId)
        .eq('reminds', false)
        .abortSignal(requestTimeout());
      if (error) throw error;
      return (data ?? []).map((row) => row.date_key);
    } catch (error) {
      throw toAccountDataError('CountdownMarksService.fetchRemindersOff', error);
    }
  },

  /** Switches one date's Remind me on (`on` true) or off. Idempotent either way. */
  async setRemindMe(userId: string, key: string, on: boolean): Promise<void> {
    requireOnline(WHAT);
    try {
      const { error: deleteError } = await supabase
        .from('countdown_marks')
        .delete()
        .eq('user_id', userId)
        .eq('date_key', key)
        .abortSignal(requestTimeout());
      if (deleteError) throw deleteError;
      if (!on) {
        const { error } = await supabase
          .from('countdown_marks')
          .upsert(
            { user_id: userId, date_key: key, reminds: false },
            { onConflict: 'user_id,date_key', ignoreDuplicates: true }
          )
          .abortSignal(requestTimeout());
        if (error) throw error;
      }
      logger.debug('[CountdownMarksService] Saved a Remind me switch');
    } catch (error) {
      throw toAccountDataError('CountdownMarksService.setRemindMe', error);
    }
  },
};
