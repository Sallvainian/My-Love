/**
 * Daily Question Slice
 *
 * Today's this-or-that question for the signed-in couple (architecture AD-13,
 * AD-16). `dailyDay` holds the last server answer of `get_daily_day` or
 * `submit_daily_pick`: `{ status: 'ok', snapshot }`, `{ status: 'unlinked' }`,
 * or `null` before any answer. The field is NOT persisted; the account's saved
 * days are the `daily-days` local copy (`services/dailyDaysCopy.ts`), which
 * `loadDailyDay` shows first for the device's date and every successful answer
 * (a read or a confirmed pick) is merged into. The view re-reads on each mount.
 *
 * Only a successful answer writes `dailyDay` and the copy: a failed load keeps
 * what is shown and sets `dailyDayError`, and never turns into `unlinked`. A
 * load with no connection and today's saved day shown sets no error. A snapshot of the
 * same `day_id` whose state ranks lower than the stored one (`none` <
 * `me`/`partner` < `both`) does not replace it, so a slow read cannot undo a
 * reveal. Every async action captures `{ userId, authSessionVersion }` before
 * its first await and writes nothing after it if either changed.
 * `signedOutState()` clears all three fields.
 *
 * A partner's pick reaches an open Daily without a reload (AD-11): after a
 * confirmed pick `submitDailyPick` announces the day on the partner's channel
 * (`announceDailyPick`, fire-and-forget: the pick stays shown whatever the
 * broadcast does), and the receiver calls `refreshDailyDay(day_id)`, which
 * re-reads that one day (`get_daily_day_by_id`) and merges it into the copy. It
 * shows the answer only when that day is the one on screen, or today's when
 * nothing is; any other day goes into the copy alone.
 *
 * A pick is dated by the device (AD-2, AD-12): `submitDailyPick` takes
 * `pickedAt = new Date()` once and refuses, before any request, when its local
 * date is not the shown day's `day`. It then re-reads the day and throws
 * `AccountDataError('day-changed', DAY_CHANGED_MESSAGE)`. The server's `DQ001`
 * (the same mismatch, seen in the zone sent) takes the same path.
 */

import { AccountDataError } from '../../services/accountDataError';
import {
  DAILY_DAYS_COPY_KIND,
  dailyStateRank,
  mergeDailyDay,
  readSavedDailyDay,
} from '../../services/dailyDaysCopy';
import { registerLocalCopy } from '../../services/localCopy';
import { formatDateISO } from '../../utils/dateUtils';

import {
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDayAnswer,
  type DailyDaySnapshot,
  announceDailyPick,
  fetchDailyDay,
  fetchDailyDayById,
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
   * Re-read one day by id (a partner's `daily_pick` named it) and merge the
   * answer into the saved days. It is shown only when it is the day on screen,
   * or today's with nothing on screen; any other day writes the copy alone.
   * Never throws; a failure is logged and changes nothing.
   */
  refreshDailyDay: (dayId: string) => Promise<void>;
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

/** The answer to keep: `next`, unless it is the same day at an earlier state than `stored`. */
function mergeAnswer(stored: DailyDayAnswer | null, next: DailyDayAnswer): DailyDayAnswer {
  if (
    stored?.status === 'ok' &&
    next.status === 'ok' &&
    stored.snapshot.day_id === next.snapshot.day_id &&
    dailyStateRank(next.snapshot.state) < dailyStateRank(stored.snapshot.state)
  ) {
    return stored;
  }
  return next;
}

export const createDailyQuestionSlice: AppStateCreator<DailyQuestionSlice> = (set, get, _api) => {
  // A signed-in start and the window `online` event refresh the saved days.
  registerLocalCopy(DAILY_DAYS_COPY_KIND, () => get().loadDailyDay());

  return {
    dailyDay: null,
    dailyDayLoading: false,
    dailyDayError: null,

    loadDailyDay: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      set({ dailyDayLoading: true });

      // 1. The saved day for the device's date, at once: shown when nothing is,
      // or when the shown day is another one; the higher state wins for the
      // same day_id.
      const today = formatDateISO(new Date());
      const saved = await readSavedDailyDay(requestedBy, today);
      if (!isCurrent()) return;
      if (saved) {
        const shown = get().dailyDay;
        const savedAnswer: DailyDayAnswer = { status: 'ok', snapshot: saved };
        if (shown === null || (shown.status === 'ok' && shown.snapshot.day !== saved.day)) {
          set({ dailyDay: savedAnswer });
        } else if (shown.status === 'ok' && shown.snapshot.day_id === saved.day_id) {
          set({ dailyDay: mergeAnswer(shown, savedAnswer) });
        }
      }

      try {
        // 2. The server's answer, merged into the copy and then shown.
        const answer = await fetchDailyDay();
        if (!isCurrent()) return;
        const merged = await mergeDailyDay(requestedBy, answer, isCurrent);
        if (!isCurrent()) return;
        set({
          dailyDay: mergeAnswer(get().dailyDay, merged),
          dailyDayLoading: false,
          dailyDayError: null,
        });
      } catch (error) {
        if (!isCurrent()) return;
        const shown = get().dailyDay;
        if (
          error instanceof AccountDataError &&
          error.code === 'offline' &&
          shown?.status === 'ok' &&
          shown.snapshot.day === today
        ) {
          // No connection and today's saved day is up: nothing to report.
          set({ dailyDayLoading: false, dailyDayError: null });
          return;
        }
        console.error("[DailyQuestion] Failed to load today's question:", error);
        set({
          dailyDayLoading: false,
          dailyDayError: error instanceof Error ? error.message : "Could not load today's question.",
        });
      }
    },

    refreshDailyDay: async (dayId) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        const snapshot = await fetchDailyDayById(dayId);
        if (!isCurrent()) return;
        const merged = await mergeDailyDay(requestedBy, { status: 'ok', snapshot }, isCurrent);
        if (!isCurrent()) return;

        const shown = get().dailyDay;
        const isShownDay = shown?.status === 'ok' && shown.snapshot.day_id === snapshot.day_id;
        const fillsEmptyScreen =
          shown?.status !== 'ok' && snapshot.day === formatDateISO(new Date());
        // Any other day (the partner may be on another date, R9) is in the copy
        // now and stays off the screen.
        if (isShownDay || fillsEmptyScreen) {
          set({ dailyDay: mergeAnswer(shown, merged), dailyDayError: null });
        }
      } catch (error) {
        if (!isCurrent()) return;
        console.error('[DailyQuestion] Failed to re-read a day:', error);
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
      // Tell the partner's open Daily, without waiting for it: the pick is
      // confirmed and stays shown whatever the broadcast does.
      void announceDailyPick(snapshot.day_id).catch((error: unknown) => {
        console.error('[DailyQuestion] Could not announce the pick:', error);
      });
      // A confirmed own write is a fill source for the copy.
      const merged = await mergeDailyDay(requestedBy, { status: 'ok', snapshot }, isCurrent);
      if (!isCurrent()) return;
      set({
        dailyDay: mergeAnswer(get().dailyDay, merged),
        dailyDayError: null,
      });
    },
  };
};
