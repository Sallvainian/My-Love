/**
 * Daily Question Slice
 *
 * Today's this-or-that question for the signed-in couple (architecture AD-13,
 * AD-16). `dailyDay` holds the last server answer of `get_daily_day` or
 * `submit_daily_pick`: `{ status: 'ok', snapshot }`, `{ status: 'unlinked' }`,
 * or `null` before any answer. It is NOT persisted and has no local copy yet
 * (a later story adds one), so the view re-reads on each mount.
 *
 * Only a successful answer writes `dailyDay`: a failed load keeps what is shown
 * and sets `dailyDayError`, and never turns into `unlinked`. A snapshot of the
 * same `day_id` whose state ranks lower than the stored one (`none` <
 * `me`/`partner` < `both`) does not replace it, so a slow read cannot undo a
 * reveal. Every async action captures `{ userId, authSessionVersion }` before
 * its first await and writes nothing after it if either changed.
 * `signedOutState()` clears all three fields.
 *
 * A pick is dated by the device (AD-2, AD-12): `submitDailyPick` takes
 * `pickedAt = new Date()` once and refuses, before any request, when its local
 * date is not the shown day's `day`. It then re-reads the day and throws
 * `AccountDataError('day-changed', DAY_CHANGED_MESSAGE)`. The server's `DQ001`
 * (the same mismatch, seen in the zone sent) takes the same path.
 */

import { AccountDataError } from '../../services/accountDataError';
import { formatDateISO } from '../../utils/dateUtils';

import {
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDayAnswer,
  type DailyDaySnapshot,
  fetchDailyDay,
  submitDailyPick as submitDailyPickRequest,
} from '../../api/dailyQuestionApi';
import type { AppStateCreator } from '../types';

export interface DailyQuestionSlice {
  /** The last server answer for today, or `null` before any. */
  dailyDay: DailyDayAnswer | null;
  /** A `loadDailyDay` request is in flight. */
  dailyDayLoading: boolean;
  /** The message of the last failed load; cleared by the next answer. */
  dailyDayError: string | null;

  /** Read today's day from the server. Never throws; a failure keeps what is shown. */
  loadDailyDay: () => Promise<void>;
  /**
   * Send the account's pick for the shown day and store the answer. Throws:
   * - a plain `Error` when signed out or with no day shown;
   * - `AccountDataError('day-changed')`, after starting a re-read of the day,
   *   when the device date is not the shown day or the server answers `DQ001`;
   * - `AccountDataError('offline')` without a connection;
   * - the request's own error otherwise.
   */
  submitDailyPick: (choice: DailyChoice) => Promise<void>;
}

/** How far a day has got: `none` < `me` / `partner` < `both`. */
const STATE_RANK: Record<DailyDaySnapshot['state'], number> = {
  none: 0,
  me: 1,
  partner: 1,
  both: 2,
};

/** The answer to keep: `next`, unless it is the same day at an earlier state than `stored`. */
function mergeAnswer(stored: DailyDayAnswer | null, next: DailyDayAnswer): DailyDayAnswer {
  if (
    stored?.status === 'ok' &&
    next.status === 'ok' &&
    stored.snapshot.day_id === next.snapshot.day_id &&
    STATE_RANK[next.snapshot.state] < STATE_RANK[stored.snapshot.state]
  ) {
    return stored;
  }
  return next;
}

export const createDailyQuestionSlice: AppStateCreator<DailyQuestionSlice> = (set, get, _api) => ({
  dailyDay: null,
  dailyDayLoading: false,
  dailyDayError: null,

  loadDailyDay: async () => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) return;
    const isCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    set({ dailyDayLoading: true });
    try {
      const answer = await fetchDailyDay();
      if (!isCurrent()) return;
      set({
        dailyDay: mergeAnswer(get().dailyDay, answer),
        dailyDayLoading: false,
        dailyDayError: null,
      });
    } catch (error) {
      if (!isCurrent()) return;
      console.error('[DailyQuestion] Failed to load today\'s question:', error);
      set({
        dailyDayLoading: false,
        dailyDayError: error instanceof Error ? error.message : 'Could not load today\'s question.',
      });
    }
  },

  submitDailyPick: async (choice) => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) throw new Error('You must be signed in to send your pick');
    const isCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    const shown = get().dailyDay;
    if (shown?.status !== 'ok') throw new Error('There is no question to answer yet');

    const pickedAt = new Date();
    if (formatDateISO(pickedAt) !== shown.snapshot.day) {
      void get().loadDailyDay();
      throw new AccountDataError('day-changed', DAY_CHANGED_MESSAGE);
    }

    let snapshot: DailyDaySnapshot;
    try {
      snapshot = await submitDailyPickRequest(shown.snapshot.day_id, choice, pickedAt);
    } catch (error) {
      if (error instanceof AccountDataError && error.code === 'day-changed' && isCurrent()) {
        void get().loadDailyDay();
      }
      throw error;
    }
    if (!isCurrent()) return;
    set({
      dailyDay: mergeAnswer(get().dailyDay, { status: 'ok', snapshot }),
      dailyDayError: null,
    });
  },
});
