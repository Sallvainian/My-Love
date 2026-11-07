/**
 * Daily Question API — the client RPCs of the daily this-or-that question
 * (architecture AD-2, AD-6, AD-11, AD-16).
 *
 * `get_daily_day` answers the caller's day for the date in the zone sent, or
 * `unlinked`; `submit_daily_pick` writes the caller's pick and answers the same
 * snapshot; `get_daily_day_by_id` answers one named day of the caller's pair,
 * the re-read a `daily_pick` broadcast asks for. All three are online-only and
 * THROW: offline is `AccountDataError('offline')`
 * before any request, a PostgREST or transport failure is an `AccountDataError`
 * from `toAccountDataError`, and an answer that does not parse is a failure too
 * (never `unlinked`). A pick the server dates to another day than the one shown
 * (SQLSTATE `DQ001`) is `AccountDataError('day-changed', DAY_CHANGED_MESSAGE)`;
 * the other refusals it raises for good (`DQ002`, outside the five-minute
 * window; `P0002`, day not found; `22023`, invalid choice or time) are
 * `AccountDataError('refused', sentence)` with a plain sentence of their own
 * (`PICK_REFUSAL_MESSAGES`), the server error kept as `cause`.
 *
 * `submitWrittenQuestion` sends the day's writer's question for tomorrow
 * (`submit_written_question`, AD-4) and answers the day's snapshot, whose
 * `write.done` is then true. Online-only and throwing, as above. The server
 * judges the options (R4); a refusal it raises for good (`DQ003` to `DQ006`) is
 * `AccountDataError('refused', reason)`, shown as is.
 *
 * `fetchCoupleStreak` reads the couple's streak (`get_couple_streak`, which
 * takes no argument: the server derives the pair and the instant) and answers
 * `{ status: 'ok', streak }` or `{ status: 'unlinked' }`. Online-only and
 * throwing, as above; a failure or an answer that does not parse is never
 * mapped to `unlinked`.
 *
 * `announceDailyPick` tells the partner's open Daily that a day changed: a
 * `daily_pick { day_id }` broadcast on their `mood-updates:<uid>` topic, never
 * a choice. It throws when the broadcast fails; the caller decides.
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
import { sendEphemeralBroadcast } from './ephemeralBroadcast';
import { isOnline, isPostgrestError, logSupabaseError } from './errorHandlers';
import { getPartnerId, supabase } from './supabaseClient';
import { DAILY_PICK_EVENT } from './validation/broadcastSchemas';
import {
  type DailyChoice,
  type DailyDayAnswer,
  DailyDayAnswerSchema,
  type CoupleStreak,
  type CoupleStreakAnswer,
  CoupleStreakAnswerSchema,
  type DailyDaySnapshot,
  DailyDaySnapshotSchema,
} from './validation/dailyQuestionSchemas';

export type { CoupleStreak, CoupleStreakAnswer, DailyChoice, DailyDayAnswer, DailyDaySnapshot };

const FETCH_CONTEXT = 'DailyQuestionApi.fetchDailyDay';
const SUBMIT_CONTEXT = 'DailyQuestionApi.submitDailyPick';
const WRITE_CONTEXT = 'DailyQuestionApi.submitWrittenQuestion';
const FETCH_BY_ID_CONTEXT = 'DailyQuestionApi.fetchDailyDayById';
const STREAK_CONTEXT = 'DailyQuestionApi.fetchCoupleStreak';

/** SQLSTATE `submit_daily_pick` raises when the pick's date is not the shown day's date. */
const PICK_DATE_MISMATCH = 'DQ001';

/**
 * SQLSTATEs `submit_daily_pick` raises for a pick it refuses for good: `DQ001`
 * (date mismatch), `DQ002` (outside the window), `P0002` (day not found) and
 * `22023` (invalid choice or time). Anything else is a transient failure.
 */
const PICK_REFUSAL_CODES: ReadonlySet<string> = new Set([PICK_DATE_MISMATCH, 'DQ002', 'P0002', '22023']);

/** Shown when a pick is refused because the date changed since the question was shown. */
export const DAY_CHANGED_MESSAGE =
  "The date has changed since this question was shown. Check today's question and pick again.";

/**
 * What `submit_daily_pick` refuses with, by SQLSTATE, apart from `DQ001`
 * (`day-changed`). Each sentence stands on its own as the explanation, so
 * Daily shows it with no lead-in.
 */
const PICK_REFUSAL_MESSAGES: Readonly<Record<string, string>> = {
  DQ002:
    "Your phone's clock looks wrong, so this pick couldn't be sent. Check Settings → General → Date & Time, then pick again.",
  P0002: "This question isn't available any more. Open Daily again to see today's question.",
  '22023': "This pick couldn't be sent. Please pick again.",
};

/**
 * What `submit_written_question` refuses with, by SQLSTATE. `DQ003` (an option
 * the rules refuse) is the server's own message; the others have a fixed one.
 */
const WRITE_REFUSAL_MESSAGES: Readonly<Record<string, string | null>> = {
  DQ003: null,
  DQ004: "It is your partner's turn to write tomorrow's question.",
  DQ005: "Send your own pick before writing tomorrow's question.",
  DQ006: "Today's turn to write has ended. Tomorrow's question will come from the pool.",
};

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

/**
 * The zone pair a pick made at `at` is dated by (AD-2): the device's IANA name
 * and the east-positive offset in force at `at`, not at send time.
 */
export function pickZone(at: Date): { time_zone: string; utc_offset_minutes: number } {
  return { time_zone: deviceZone().time_zone, utc_offset_minutes: -at.getTimezoneOffset() };
}

/**
 * True when `error` is the server refusing a pick for good (see
 * `PICK_REFUSAL_CODES`) or `AccountDataError('day-changed')`. Offline, network,
 * timeout, 401/5xx and `invalid-response` failures are transient: a later
 * attempt may succeed.
 */
export function isPickRefusal(error: unknown): error is AccountDataError {
  if (!(error instanceof AccountDataError)) return false;
  if (error.code === 'day-changed') return true;
  const code = (error.cause as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && PICK_REFUSAL_CODES.has(code);
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

/** The couple's streak, or `unlinked`. Throws on any failure; a failure is never `unlinked`. */
export async function fetchCoupleStreak(): Promise<CoupleStreakAnswer> {
  refuseOffline('The streak', 'load');
  try {
    const { data, error } = await supabase.rpc('get_couple_streak').abortSignal(requestTimeout());
    if (error) throw error;
    const parsed = CoupleStreakAnswerSchema.safeParse(data);
    if (!parsed.success) {
      throw new AccountDataError('invalid-response', 'The streak answer was not understood.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  } catch (error) {
    throw toAccountDataError(STREAK_CONTEXT, error);
  }
}

/** The caller's snapshot of one day of their pair (`dayId`). Throws on any failure. */
export async function fetchDailyDayById(dayId: string): Promise<DailyDaySnapshot> {
  refuseOffline('The question', 'load');
  try {
    const { data, error } = await supabase
      .rpc('get_daily_day_by_id', { day_id: dayId })
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
    throw toAccountDataError(FETCH_BY_ID_CONTEXT, error);
  }
}

/**
 * Tell the partner that `dayId` changed: `daily_pick { day_id }` on their
 * `mood-updates:<uid>` topic. The partner is resolved with plain
 * `getPartnerId()` -- the send side, as `syncMood` does -- and with none there
 * is nobody to tell. Throws when the broadcast is refused or fails.
 */
export async function announceDailyPick(dayId: string): Promise<void> {
  const partnerId = await getPartnerId();
  if (!partnerId) return;
  await sendEphemeralBroadcast(`mood-updates:${partnerId}`, DAILY_PICK_EVENT, { day_id: dayId });
}

/**
 * Send the caller's pick for `dayId`. `pickedAt` is the instant the pick was
 * made (default: now) and `zone` the zone pair it was made in (default: the
 * device's, with the offset in force at `pickedAt`). Returns the day's
 * snapshot. Throws on any failure.
 */
export async function submitDailyPick(
  dayId: string,
  choice: DailyChoice,
  pickedAt: Date = new Date(),
  zone: { time_zone: string; utc_offset_minutes: number } = pickZone(pickedAt)
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
        time_zone: zone.time_zone,
        utc_offset_minutes: zone.utc_offset_minutes,
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
    if (isPostgrestError(error) && Object.hasOwn(PICK_REFUSAL_MESSAGES, error.code)) {
      logSupabaseError(SUBMIT_CONTEXT, error);
      throw new AccountDataError('refused', PICK_REFUSAL_MESSAGES[error.code], { cause: error });
    }
    throw toAccountDataError(SUBMIT_CONTEXT, error);
  }
}

/**
 * Send the caller's question for tomorrow, written on `dayId` (the caller's
 * turn to write). The texts go as typed: the server trims and judges them.
 * Returns the day's snapshot. Throws on any failure; a refusal the server
 * raises for good is `AccountDataError('refused', reason)`.
 */
export async function submitWrittenQuestion(
  dayId: string,
  thisText: string,
  thatText: string
): Promise<DailyDaySnapshot> {
  refuseOffline("Tomorrow's question", 'send');
  try {
    const { data, error } = await supabase
      .rpc('submit_written_question', {
        day_id: dayId,
        this_text: thisText,
        that_text: thatText,
      })
      .abortSignal(requestTimeout());
    if (error) throw error;
    const parsed = DailyDaySnapshotSchema.safeParse(data);
    if (!parsed.success) {
      throw new AccountDataError(
        'invalid-response',
        'The daily question answer was not understood.',
        { cause: parsed.error }
      );
    }
    return parsed.data;
  } catch (error) {
    if (isPostgrestError(error) && Object.hasOwn(WRITE_REFUSAL_MESSAGES, error.code)) {
      logSupabaseError(WRITE_CONTEXT, error);
      throw new AccountDataError('refused', WRITE_REFUSAL_MESSAGES[error.code] ?? error.message, {
        cause: error,
      });
    }
    throw toAccountDataError(WRITE_CONTEXT, error);
  }
}
