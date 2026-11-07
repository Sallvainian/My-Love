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
 *
 * A pick made offline is queued, not refused (AD-12): `submitDailyPick` writes
 * it to the `pick-queue` store (`services/pickQueue.ts`) with its `picked_at`
 * and zone pair, and `drainQueuedPicks` sends the signed-in account's pending
 * rows, oldest first, under `PICK_QUEUE_LOCK`, on start and on `online`
 * (`App.tsx`). A confirmed row is removed and announced as above; a refusal
 * (`isPickRefusal`) marks it failed with its message; any other failure leaves
 * it pending, and a pass that stops that way while online is retried on a
 * backoff (5 s, 10 s, 20 s, 40 s, then every 60 s) until a pass completes; a
 * session change cancels it, and offline the `online` event drains instead.
 * `dailyQueuedPicks` mirrors the account's rows for the view. A
 * queued pick never enters `dailyDay` or the copy, so the reveal shows only
 * from a server snapshot. The rows survive sign-out; only the field is cleared.
 *
 * The day's writer is asked to write tomorrow's question (AD-4, AD-13):
 * `submitWrittenQuestion` sends it and merges the returned snapshot (whose
 * `write.done` is then true), and `declineWrittenQuestion` records the day in
 * the device-state `daily-write-declined` kind (`services/dailyWriteDeclined.ts`)
 * and in `dailyWriteDeclined`, which `loadDailyDay` fills from the kind. The
 * view decides when to ask from the snapshot, this field and the device date.
 *
 * The couple's streak (Partner page) lives here too: `coupleStreak` holds the
 * last `get_couple_streak` answer (`{ status: 'ok', streak }`, `{ status:
 * 'unlinked' }`, or `null` before any), `coupleStreakLoading` a read in flight
 * and `coupleStreakError` the message of the last failed read.
 * `loadCoupleStreak` never throws; a failure keeps the answer shown and sets
 * the error, and only a successful answer writes the field and clears it. The
 * last `ok` streak is the `daily-streak` local copy (`services/dailyStreakCopy.ts`):
 * `loadCoupleStreak` shows it first, but only over `null` (an answer in memory
 * is at least as new), and a successful answer then replaces it (`ok`) or
 * deletes it (`unlinked`); a failed read leaves it. Only the newest started
 * read writes (a sequence counter), and a read that outlives the session writes
 * nothing, to the field or to the copy. `signedOutState()` clears all three fields.
 */

import { isOnline } from '../../api/errorHandlers';
import { AccountDataError } from '../../services/accountDataError';
import {
  DAILY_DAYS_COPY_KIND,
  dailyStateRank,
  keepWriteDone,
  mergeDailyDay,
  readSavedDailyDay,
} from '../../services/dailyDaysCopy';
import type { StoredQueuedPick } from '../../services/dbSchema';
import { addDeclinedWriteDay, readDeclinedWriteDays } from '../../services/dailyWriteDeclined';
import {
  DAILY_STREAK_COPY_KIND,
  readSavedStreak,
  saveStreakAnswer,
} from '../../services/dailyStreakCopy';
import { registerLocalCopy } from '../../services/localCopy';
import {
  enqueuePick,
  listQueuedPicks,
  markQueuedPickFailed,
  removeQueuedPick,
} from '../../services/pickQueue';
import { PICK_QUEUE_LOCK, waitForSyncLock, withSyncLock } from '../../services/syncLock';
import { formatDateISO } from '../../utils/dateUtils';

import {
  DAY_CHANGED_MESSAGE,
  type CoupleStreakAnswer,
  type DailyChoice,
  type DailyDayAnswer,
  type DailyDaySnapshot,
  announceDailyPick,
  fetchCoupleStreak,
  fetchDailyDay,
  fetchDailyDayById,
  isPickRefusal,
  pickZone,
  submitDailyPick as submitDailyPickRequest,
  submitWrittenQuestion as submitWrittenQuestionRequest,
} from '../../api/dailyQuestionApi';
import type { AppStateCreator } from '../types';

/** One of the account's queued picks, as the view needs it. */
export type QueuedDailyPick = Pick<
  StoredQueuedPick,
  'day_id' | 'choice' | 'picked_at' | 'failed' | 'failure'
>;

export interface DailyQuestionSlice {
  /** The last server answer for today, or `null` before any. */
  dailyDay: DailyDayAnswer | null;
  /** A `loadDailyDay` request is in flight. */
  dailyDayLoading: boolean;
  /** The message of the last failed load; cleared by the next answer. */
  dailyDayError: string | null;
  /** The signed-in account's queued picks (pending and failed); never persisted here. */
  dailyQueuedPicks: QueuedDailyPick[];
  /** The `day_id`s whose write prompt this account declined on this device. */
  dailyWriteDeclined: string[];
  /** The last server answer for the couple's streak, or `null` before any. */
  coupleStreak: CoupleStreakAnswer | null;
  /** A `loadCoupleStreak` request is in flight. */
  coupleStreakLoading: boolean;
  /** The message of the last failed streak read; cleared by the next answer. */
  coupleStreakError: string | null;

  /** Read the couple's streak from the server. Never throws; a failure keeps what is shown. */
  loadCoupleStreak: () => Promise<void>;
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
   * - the request's own error otherwise.
   * Without a connection it queues the pick (no request) and resolves; a queue
   * write failure throws.
   */
  submitDailyPick: (choice: DailyChoice) => Promise<void>;
  /**
   * Send the account's pending queued picks, oldest first, under
   * `PICK_QUEUE_LOCK`. Never throws; does nothing signed out or offline.
   */
  drainQueuedPicks: () => Promise<void>;
  /**
   * Send the account's question for tomorrow, written on the shown day, and
   * store the answer. Throws a plain `Error` when signed out or with no day
   * shown, and otherwise the request's own error (`AccountDataError`).
   */
  submitWrittenQuestion: (thisText: string, thatText: string) => Promise<void>;
  /**
   * Record that the account declined to write for `dayId` on this device.
   * Never throws: a write failure is logged, and `dailyWriteDeclined` is left
   * as it was.
   */
  declineWrittenQuestion: (dayId: string) => Promise<void>;
}

/** What one drain pass ended on (see `drainOnce`). */
type DrainPassOutcome = 'done' | 'transient' | 'stale' | 'offline' | 'other-tab' | 'failed';

/**
 * After a pass stops on a transient failure while online, the drain runs
 * again after 5 s, 10 s, 20 s and 40 s, then every 60 s, until a pass
 * completes. Offline, the `online` event triggers it instead.
 */
const PICK_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000];
const PICK_RETRY_MAX_DELAY_MS = 60_000;

/**
 * The answer to keep: `next`, unless it is the same day at an earlier state than
 * `stored`. For the same day `write.done` never goes back to false.
 */
function mergeAnswer(stored: DailyDayAnswer | null, next: DailyDayAnswer): DailyDayAnswer {
  if (
    stored?.status === 'ok' &&
    next.status === 'ok' &&
    stored.snapshot.day_id === next.snapshot.day_id
  ) {
    const keepStored = dailyStateRank(next.snapshot.state) < dailyStateRank(stored.snapshot.state);
    const [kept, other] = keepStored
      ? [stored.snapshot, next.snapshot]
      : [next.snapshot, stored.snapshot];
    return { status: 'ok', snapshot: keepWriteDone(kept, other) };
  }
  return next;
}

export const createDailyQuestionSlice: AppStateCreator<DailyQuestionSlice> = (set, get, api) => {
  // A signed-in start and the window `online` event refresh the saved days.
  registerLocalCopy(DAILY_DAYS_COPY_KIND, () => get().loadDailyDay());
  registerLocalCopy(DAILY_STREAK_COPY_KIND, () => get().loadCoupleStreak());

  /** Re-read the account's queued picks into `dailyQueuedPicks`, while `isCurrent()`. */
  const showQueuedPicks = async (userId: string, isCurrent: () => boolean): Promise<void> => {
    const rows = await listQueuedPicks(userId);
    if (!isCurrent()) return;
    set({
      dailyQueuedPicks: rows.map((row) => ({
        day_id: row.day_id,
        choice: row.choice,
        picked_at: row.picked_at,
        failed: row.failed,
        failure: row.failure,
      })),
    });
  };

  /**
   * Show a merged answer when its day is the one on screen, or today's with
   * nothing on screen; any other day (the partner may be on another date, R9)
   * is in the copy already and stays off the screen.
   */
  const showIfOnScreen = (snapshot: DailyDaySnapshot, merged: DailyDayAnswer): void => {
    const shown = get().dailyDay;
    const isShownDay = shown?.status === 'ok' && shown.snapshot.day_id === snapshot.day_id;
    const fillsEmptyScreen = shown?.status !== 'ok' && snapshot.day === formatDateISO(new Date());
    if (isShownDay || fillsEmptyScreen) {
      set({ dailyDay: mergeAnswer(shown, merged), dailyDayError: null });
    }
  };

  // The newest started `loadCoupleStreak`: an older read that lands later writes nothing.
  let streakSeq = 0;

  // The tab's running drain, and whether a call arrived while it ran.
  let drainInFlight: Promise<void> | null = null;
  let drainRequested = false;

  // The retry after a pass stops on a transient failure while online. One timer
  // at a time; `retryAttempt` picks its delay and resets on a completed pass.
  // `retryFor` is the session it was set for: any change of account or session
  // cancels it (the subscription below), and a timer that fires anyway
  // re-checks the session before it drains.
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;
  let retryFor: { userId: string; authSessionVersion: number } | null = null;

  const cancelDrainRetry = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    retryFor = null;
    retryAttempt = 0;
  };

  const scheduleDrainRetry = (userId: string, authSessionVersion: number) => {
    if (retryTimer !== null) return;
    const delay = PICK_RETRY_DELAYS_MS[retryAttempt] ?? PICK_RETRY_MAX_DELAY_MS;
    retryAttempt += 1;
    retryFor = { userId, authSessionVersion };
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (get().userId !== userId || get().authSessionVersion !== authSessionVersion) return;
      void get().drainQueuedPicks();
    }, delay);
  };

  // Sign-out and an account switch change the identity in one set(); the
  // pending retry belongs to the old one.
  api.subscribe((state) => {
    if (
      retryFor &&
      (state.userId !== retryFor.userId || state.authSessionVersion !== retryFor.authSessionVersion)
    ) {
      cancelDrainRetry();
    }
  });

  /**
   * One pass over the signed-in account's pending rows. Never throws. Answers
   * what the pass ended on, which decides the retry.
   */
  const drainOnce = async (): Promise<DrainPassOutcome> => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy || !isOnline()) return 'offline';
    const isCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;

    let result: DrainPassOutcome;
    try {
      const pass = await withSyncLock<DrainPassOutcome>(PICK_QUEUE_LOCK, async () => {
        const pending = (await listQueuedPicks(requestedBy)).filter((row) => !row.failed);
        for (const row of pending) {
          if (!isCurrent()) return 'stale';
          if (!isOnline()) return 'offline';
          let snapshot: DailyDaySnapshot;
          try {
            // No device-date check: a late pick is the server's to date by
            // its own `picked_at` and the zone it was made in.
            snapshot = await submitDailyPickRequest(
              row.day_id,
              row.choice,
              new Date(row.picked_at),
              { time_zone: row.time_zone, utc_offset_minutes: row.utc_offset_minutes }
            );
          } catch (error) {
            if (isPickRefusal(error)) {
              await markQueuedPickFailed(requestedBy, row.day_id, error.message);
              continue;
            }
            console.error('[DailyQuestion] Could not send a queued pick:', error);
            return 'transient';
          }
          // Confirmed: the pick is committed, whatever the session did meanwhile.
          await removeQueuedPick(requestedBy, row.day_id);
          if (!isCurrent()) return 'stale';
          void announceDailyPick(snapshot.day_id).catch((error: unknown) => {
            console.error('[DailyQuestion] Could not announce the pick:', error);
          });
          const merged = await mergeDailyDay(requestedBy, { status: 'ok', snapshot }, isCurrent);
          if (!isCurrent()) return 'stale';
          showIfOnScreen(snapshot, merged);
        }
        return 'done';
      });
      if (pass.ran) {
        result = pass.result;
      } else {
        // Another tab is sending: look at what it did once it lets go. Its
        // own retry covers a transient stop there.
        result = 'other-tab';
        await waitForSyncLock(PICK_QUEUE_LOCK);
        if (isCurrent()) await get().loadDailyDay();
      }
    } catch (error) {
      console.error('[DailyQuestion] Could not send the queued picks:', error);
      result = 'failed';
    }
    // The field is refreshed on every path; an unreadable queue reads as empty.
    await showQueuedPicks(requestedBy, isCurrent);
    return result;
  };

  return {
    dailyDay: null,
    dailyDayLoading: false,
    dailyDayError: null,
    dailyQueuedPicks: [],
    dailyWriteDeclined: [],
    coupleStreak: null,
    coupleStreakLoading: false,
    coupleStreakError: null,

    loadCoupleStreak: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const mine = ++streakSeq;
      const isCurrent = () =>
        get().userId === requestedBy &&
        get().authSessionVersion === requestedInSession &&
        streakSeq === mine;

      set({ coupleStreakLoading: true });

      // 1. The saved streak, at once, over nothing only.
      const saved = await readSavedStreak(requestedBy);
      if (!isCurrent()) return;
      if (saved && get().coupleStreak === null) {
        set({ coupleStreak: { status: 'ok', streak: saved } });
      }

      try {
        // 2. The server's answer, shown and then saved.
        const answer = await fetchCoupleStreak();
        if (!isCurrent()) return;
        set({ coupleStreak: answer, coupleStreakLoading: false, coupleStreakError: null });
        try {
          await saveStreakAnswer(requestedBy, answer);
        } catch (error) {
          console.error("[DailyQuestion] Failed to save the couple's streak copy:", error);
        }
      } catch (error) {
        if (!isCurrent()) return;
        // An offline refusal is expected, not a fault: the error is still set.
        if (!(error instanceof AccountDataError && error.code === 'offline')) {
          console.error("[DailyQuestion] Failed to load the couple's streak:", error);
        }
        set({
          coupleStreakLoading: false,
          coupleStreakError:
            error instanceof Error ? error.message : "Could not load your couple's streak.",
        });
      }
    },

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
      const [saved, declined] = await Promise.all([
        readSavedDailyDay(requestedBy, today),
        readDeclinedWriteDays(requestedBy),
        showQueuedPicks(requestedBy, isCurrent),
      ]);
      if (!isCurrent()) return;
      set({ dailyWriteDeclined: declined });
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
        showIfOnScreen(snapshot, merged);
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

      if (!isOnline()) {
        // The pick waits in the queue with the instant and zone it was made in.
        await enqueuePick({
          user_id: requestedBy,
          day_id: shown.snapshot.day_id,
          choice,
          picked_at: pickedAt.toISOString(),
          ...pickZone(pickedAt),
          failed: false,
          failure: null,
        });
        await showQueuedPicks(requestedBy, isCurrent);
        // The connection may have returned while the row was being written: an
        // `online` drain that read the queue before it would have missed it.
        if (isOnline() && isCurrent()) void get().drainQueuedPicks();
        return;
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
      // The pick is committed: any row for the day (a failed one) is done.
      try {
        await removeQueuedPick(requestedBy, snapshot.day_id);
      } catch (error) {
        console.error('[DailyQuestion] Could not clear the queued pick:', error);
      }
      await showQueuedPicks(requestedBy, isCurrent);
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

    drainQueuedPicks: () => {
      // One drain per tab: a call while one runs asks for one more pass, so the
      // lock is only ever found held by another tab.
      if (drainInFlight) {
        drainRequested = true;
        return drainInFlight;
      }
      const run = (async () => {
        try {
          let outcome: DrainPassOutcome;
          do {
            drainRequested = false;
            outcome = await drainOnce();
          } while (drainRequested);

          // A transient stop while online retries on a backoff; a completed
          // pass resets it. Known offline, the `online` event drains instead.
          const { userId, authSessionVersion } = get();
          if (outcome === 'done' || outcome === 'offline') {
            cancelDrainRetry();
          } else if ((outcome === 'transient' || outcome === 'failed') && userId && isOnline()) {
            scheduleDrainRetry(userId, authSessionVersion);
          }
        } finally {
          drainInFlight = null;
        }
      })();
      drainInFlight = run;
      return run;
    },

    submitWrittenQuestion: async (thisText, thatText) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error("You must be signed in to send tomorrow's question");
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      const shown = get().dailyDay;
      if (shown?.status !== 'ok') throw new Error('There is no question to write from yet');

      const snapshot = await submitWrittenQuestionRequest(
        shown.snapshot.day_id,
        thisText,
        thatText
      );
      if (!isCurrent()) return;
      const merged = await mergeDailyDay(requestedBy, { status: 'ok', snapshot }, isCurrent);
      if (!isCurrent()) return;
      set({
        dailyDay: mergeAnswer(get().dailyDay, merged),
        dailyDayError: null,
      });
    },

    declineWrittenQuestion: async (dayId) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        const declined = await addDeclinedWriteDay(requestedBy, dayId, isCurrent);
        if (!isCurrent()) return;
        set({ dailyWriteDeclined: declined });
      } catch (error) {
        if (!isCurrent()) return;
        console.error(
          "[DailyQuestion] Could not save that tomorrow's question was declined:",
          error
        );
      }
    },
  };
};
