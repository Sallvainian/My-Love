/**
 * Daily Question API — the two client RPCs of the daily this-or-that question
 * (architecture AD-2, AD-6, AD-16).
 *
 * `get_daily_day` answers the caller's day for the date in the zone sent, or
 * `unlinked`; `submit_daily_pick` writes the caller's pick and answers the same
 * snapshot. Both are online-only and THROW: offline is `AccountDataError('offline')`
 * before any request, a PostgREST or transport failure is an `AccountDataError`
 * from `toAccountDataError`, and an answer that does not parse is a failure too
 * (never `unlinked`). A pick the server dates to another day than the one shown
 * (SQLSTATE `DQ001`) is `AccountDataError('day-changed', DAY_CHANGED_MESSAGE)`;
 * `DQ002` (outside the five-minute window) stays a transport error.
 *
 * @module api/dailyQuestionApi
 */

import {
  AccountDataError,
  type NeedsConnectionAction,
  offlineMessage,
  requestTimeout,
  toAccountDataError,
} from '../services/accountDataError';
import { isOnline, isPostgrestError, logSupabaseError } from './errorHandlers';
import { supabase } from './supabaseClient';
import {
  type DailyChoice,
  type DailyDayAnswer,
  DailyDayAnswerSchema,
  type DailyDaySnapshot,
  DailyDaySnapshotSchema,
} from './validation/dailyQuestionSchemas';

export type { DailyChoice, DailyDayAnswer, DailyDaySnapshot };

const FETCH_CONTEXT = 'DailyQuestionApi.fetchDailyDay';
const SUBMIT_CONTEXT = 'DailyQuestionApi.submitDailyPick';

/** SQLSTATE `submit_daily_pick` raises when the pick's date is not the shown day's date. */
const PICK_DATE_MISMATCH = 'DQ001';

/** Shown when a pick is refused because the date changed since the question was shown. */
export const DAY_CHANGED_MESSAGE =
  "The date has changed since this question was shown. Check today's question and pick again.";

/** `requireOnline` with the singular verb: "Your pick needs a connection to send." */
function refuseOffline(what: string, action: NeedsConnectionAction): void {
  if (!isOnline()) throw new AccountDataError('offline', offlineMessage(what, action, 'needs'));
}

/** The device's zone pair (AD-2): the IANA name and the east-positive offset in minutes. */
export function deviceZone(): { time_zone: string; utc_offset_minutes: number } {
  return {
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utc_offset_minutes: -new Date().getTimezoneOffset(),
  };
}

/** The caller's day for today's date, or `unlinked`. Throws on any failure. */
export async function fetchDailyDay(): Promise<DailyDayAnswer> {
  refuseOffline('Today\'s question', 'load');
  try {
    const { data, error } = await supabase
      .rpc('get_daily_day', {
        ...deviceZone(),
        reported_at: new Date().toISOString(),
      })
      .abortSignal(requestTimeout());
    if (error) throw error;
    const parsed = DailyDayAnswerSchema.safeParse(data);
    if (!parsed.success) {
      throw new AccountDataError('invalid-response', 'The daily question answer was not understood.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  } catch (error) {
    throw toAccountDataError(FETCH_CONTEXT, error);
  }
}

/**
 * Send the caller's pick for `dayId`. `pickedAt` is the instant the pick was
 * made (default: now). Returns the day's snapshot. Throws on any failure.
 */
export async function submitDailyPick(
  dayId: string,
  choice: DailyChoice,
  pickedAt: Date = new Date()
): Promise<DailyDaySnapshot> {
  refuseOffline('Your pick', 'send');
  try {
    // The offset in force at the pick, not at send time: a DST change between
    // the two must not mismatch `picked_at` and the offset sent with it.
    const { data, error } = await supabase
      .rpc('submit_daily_pick', {
        day_id: dayId,
        choice,
        picked_at: pickedAt.toISOString(),
        time_zone: deviceZone().time_zone,
        utc_offset_minutes: -pickedAt.getTimezoneOffset(),
      })
      .abortSignal(requestTimeout());
    if (error) throw error;
    const parsed = DailyDaySnapshotSchema.safeParse(data);
    if (!parsed.success) {
      throw new AccountDataError('invalid-response', 'The daily question answer was not understood.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  } catch (error) {
    if (isPostgrestError(error) && error.code === PICK_DATE_MISMATCH) {
      logSupabaseError(SUBMIT_CONTEXT, error);
      throw new AccountDataError('day-changed', DAY_CHANGED_MESSAGE, { cause: error });
    }
    throw toAccountDataError(SUBMIT_CONTEXT, error);
  }
}
