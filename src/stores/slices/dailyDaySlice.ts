/**
 * Daily Day Slice
 *
 * Today's this-or-that question for the signed-in couple (architecture AD-13,
 * AD-16). `dailyDay` holds the last server answer of `get_daily_day` or
 * `submit_daily_pick`: `{ status: 'ok', snapshot }`, `{ status: 'unlinked' }`,
 * or `null` before any answer. The field is NOT persisted; the account's saved
 * days are the `daily-days` local copy (`services/dailyDaysCopy.ts`), which
 * `loadDailyDay` shows first for the device's date and every successful answer
 * (a read or a confirmed pick) is merged into. The view re-reads on each mount.
 * Each merge tags the saved day with the partner it was read with, and the
 * readers show only the current partner's days (the partner from the store or
 * the saved partner copy; `lookupPartnerId()` tags a merge when neither is known).
 *
 * Only a successful answer writes `dailyDay` and the copy: a failed load keeps
 * what is shown and sets `dailyDayError`, and never turns into `unlinked`. A
 * load with no connection and today's saved day shown sets no error. A snapshot of the
 * same `day_id` whose state ranks lower than the stored one (`none` <
 * `me`/`partner` < `both`) does not replace it, so a slow read cannot undo a
 * reveal. Every async action captures `{ userId, authSessionVersion }` before
 * its first await and writes nothing after it if either changed.
 * `signedOutState()` clears all eight fields.
 *
 * Overlapping `loadDailyDay` calls collapse: one read runs per signed-in
 * identity, and a call that arrives meanwhile asks for one more read after it
 * (never joins it, so the read starts after its cause) and gets that trailing
 * pass's promise; the call that started the running read keeps the promise of
 * its own pass, so a caller waiting on it (Daily's claim gate) is not held back
 * by a later trigger's re-read (`trailingRead.ts`). A call in another identity
 * starts its own read; the old one writes nothing.
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
 * it pending, and a pass that stops that way while online, or that waited out
 * another tab's lock and still finds pending rows, is retried on a backoff
 * (5 s, 10 s, 20 s, 40 s, then every 60 s) until a pass completes; a session
 * change cancels it, and offline the `online` event drains instead.
 * `dailyQueuedPicks` mirrors the account's rows for the view. A
 * queued pick never enters `dailyDay` or the copy, so the reveal shows only
 * from a server snapshot. The rows survive sign-out; only the field is cleared.
 * A `failed` row is never sent again: an `ok` answer for the device's date
 * deletes the signed-in account's `failed` rows for other days (never a
 * pending row, never another account's).
 *
 * The day's writer is asked to write tomorrow's question (AD-4, AD-13):
 * `submitWrittenQuestion` sends it and merges the returned snapshot (whose
 * `write.done` is then true), and `declineWrittenQuestion` records the day in
 * the device-state `daily-write-declined` kind (`services/dailyWriteDeclined.ts`)
 * and in `dailyWriteDeclined`, which `loadDailyDay` fills from the kind. The
 * view decides when to ask from the snapshot, this field and the device date.
 *
 * When the shown partner changes from one id to another in a session (an unlink
 * and a new link, or a refreshed partner read that answers a new id), this
 * slice's one `api.subscribe` listener clears the day (`dailyDay`, its error and
 * loading flag) and calls `resetDailyHistoryForNewPair` and
 * `resetCoupleStreakForNewPair` (the history and streak slices), which clear the
 * streak, the past questions and their errors, loading flags and end flag. The
 * reads in flight for the old pair write nothing, to the fields or to the copy;
 * a day or streak that was shown or being read is then read again for the new
 * partner. The `daily-celebrated` kind is not touched there: it is tagged with
 * its partner (`services/dailyCelebrated.ts`), so the next claim re-seeds it.
 * Only a non-null id that differs from the last non-null one seen in the session
 * counts: a first link and a reload of the same partner clear nothing, and an
 * identity change (`userId`/`authSessionVersion`) forgets the last id.
 *
 * A nudge (AD-13, AD-16, AD-17): `sendDailyNudge(source)` sends the prompt's or
 * the button's nudge for the shown day and merges the returned snapshot (whose
 * `nudges` then has that source sent) like `submitWrittenQuestion`, then
 * announces it on the partner's channel (`announceDailyNudge`, fire-and-forget,
 * a failure only logged) and answers `'sent'`. Offline throws with no request and
 * no re-read. A source's nudge never moves back to unsent (`keepNudgesSent`, in
 * `mergeAnswer` and the copy), so a read that started before the send cannot
 * enable its control again. "Unknown is not failed" (DW-539): an `already sent`
 * refusal (`DQ010`) marks that source sent on the shown day in memory, waits for
 * a re-read of the day and answers `'sent'`; any other refusal starts a re-read
 * (not awaited) and answers `'failed'`; a lost answer (timeout, network, an
 * unparsable answer) waits for a re-read of that day and answers `'sent'` when it
 * has the source sent, `'failed'` when it has not, and `'unchecked'` when the
 * re-read failed too. `dailyQueuedPickSent` names the day of a queued pick the
 * drain has just had confirmed, whether or not that day is on screen; Daily,
 * mounted at that moment, checks the day against the one it shows and, when it
 * is that day with only the own pick in, offers the prompt; a value already there
 * when Daily mounts is not one.
 *
 * The couple's streak and past questions live in the streak and history
 * slices; `submitDailyPick` and the queue drain re-read the streak
 * (`void loadCoupleStreak()`) after each pick the server confirmed, once the
 * session is still current; a queued pick and a refused row do not.
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
import { isNudgeSent, keepNudgesSent, type NudgeSource, nudgeState, withNudgeSent } from '../../services/dailyNudges';
import { addDeclinedWriteDay, readDeclinedWriteDays } from '../../services/dailyWriteDeclined';
import { registerLocalCopy } from '../../services/localCopy';
import {
  enqueuePick,
  listQueuedPicks,
  markQueuedPickFailed,
  removeFailedQueuedPicksExcept,
  removeQueuedPick,
} from '../../services/pickQueue';
import { PICK_QUEUE_LOCK, waitForSyncLock, withSyncLock } from '../../services/syncLock';
import { formatDateISO } from '../../utils/dateUtils';

import {
  DAY_CHANGED_MESSAGE,
  type DailyChoice,
  type DailyDayAnswer,
  type DailyDaySnapshot,
  announceDailyNudge,
  announceDailyPick,
  fetchDailyDay,
  fetchDailyDayById,
  isNudgeAlreadySent,
  isNudgeOutcomeUnknown,
  isPickRefusal,
  pickZone,
  sendDailyNudge as sendDailyNudgeRequest,
  submitDailyPick as submitDailyPickRequest,
  submitWrittenQuestion as submitWrittenQuestionRequest,
} from '../../api/dailyQuestionApi';
import { mergePartnerId, NO_PARTNER_TAG, shownPartnerId } from '../dailyPartnerIds';
import type { AppStateCreator } from '../types';
import { createTrailingRead } from '../trailingRead';

/** One of the account's queued picks, as the view needs it. */
export type QueuedDailyPick = Pick<
  StoredQueuedPick,
  'day_id' | 'choice' | 'picked_at' | 'failed' | 'failure'
>;

export interface DailyDaySlice {
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
  /**
   * How many server answers the store has shown since sign-in: a read, a
   * confirmed pick, a written question, a re-read or a nudge that set
   * `dailyDay`. The view compares it with the count it saw when it mounted, to
   * know the server has answered in this mount (the write sheet waits for that,
   * DW-491). Never persisted.
   */
  dailyDayAnswers: number;
  /**
   * The `day_id` the last of those answers showed (`null` for an `unlinked`
   * answer or none yet). The view also requires it to be the day on screen, so
   * a saved day that a later read puts on screen, such as the next date after
   * midnight, waits for the server's answer for itself and not for an earlier
   * day's. Never persisted.
   */
  dailyDayAnsweredId: string | null;
  /**
   * The day of the last queued pick the drain had confirmed (on screen or not), with a
   * counter that makes each one a new value (`null` before any, and after
   * sign-out). Daily offers the nudge prompt when this changes while it is
   * mounted and the day is the one on screen, and ignores the value it finds at mount (an answer sent while Daily
   * was closed is not offered later). Never persisted.
   */
  dailyQueuedPickSent: { dayId: string; seq: number } | null;

  /**
   * Read today's day from the server. Never throws; a failure keeps what is
   * shown. An `ok` answer for the device's date also deletes the signed-in
   * account's `failed` queued picks for other days. Resolves when the read it
   * waited on has ended, whatever it stored. The write sheet does not learn
   * from it whether the server answered: it counts the answers the store shows
   * (`dailyDayAnswers`), which also covers a re-read, a confirmed pick and a
   * refresh.
   */
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
   * Without a connection it queues the pick (no request) and resolves, and so it
   * does when the request fails in transit (`transport`: a network failure or a
   * timeout), starting the drain; a queue write failure throws.
   * Resolves with the answer it stored, or `undefined` when it queued the pick
   * or the session changed before the answer was stored.
   */
  submitDailyPick: (choice: DailyChoice) => Promise<DailyDayAnswer | undefined>;
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
   * Nudge the partner about the shown day from `source` and store the answer,
   * then announce it. Answers `'sent'` (the nudge is on record, whether the
   * request said so, refused it as already sent, answered in a form that did not
   * parse, or a re-read after a lost answer found it), `'failed'` (refused, or a
   * re-read found none) or `'unchecked'` (the answer was lost and the re-read
   * failed too, or the session changed before it could start). Throws a
   * plain `Error` when signed out or with no day shown, and `AccountDataError`
   * (`offline`) when it sent nothing for want of a connection.
   */
  sendDailyNudge: (source: NudgeSource) => Promise<NudgeSendOutcome>;
  /**
   * Record that the account declined to write for `dayId` on this device.
   * Never throws: a write failure is logged, and `dailyWriteDeclined` is left
   * as it was.
   */
  declineWrittenQuestion: (dayId: string) => Promise<void>;
}

/** How a nudge send ended: see `DailyDaySlice.sendDailyNudge`. */
export type NudgeSendOutcome = 'sent' | 'failed' | 'unchecked';

/**
 * What one drain pass ended on (see `drainOnce`). `other-tab` means another
 * tab held the lock and pending rows remain after it let go.
 */
type DrainPassOutcome = 'done' | 'transient' | 'stale' | 'offline' | 'other-tab' | 'failed';

/**
 * After a pass stops on a transient failure while online, or waits out another
 * tab's lock and still finds pending rows, the drain runs again after 5 s, 10 s, 20 s and 40 s, then every 60 s, until a pass
 * completes. Offline, the `online` event triggers it instead.
 */
const PICK_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000];
const PICK_RETRY_MAX_DELAY_MS = 60_000;

/**
 * The answer to keep: `next`, unless it is the same day at an earlier state than
 * `stored`. For the same day `write.done` never goes back to false, nor a
 * source's nudge sent back to unsent.
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
    return { status: 'ok', snapshot: keepNudgesSent(keepWriteDone(kept, other), other) };
  }
  return next;
}

/**
 * The fields that record one more server answer shown: the count, and the day
 * it showed, for the day now on screen (`shown`).
 */
function countAnswer(
  state: { dailyDayAnswers: number },
  shown: DailyDayAnswer
): Pick<DailyDaySlice, 'dailyDayAnswers' | 'dailyDayAnsweredId'> {
  return {
    dailyDayAnswers: state.dailyDayAnswers + 1,
    dailyDayAnsweredId: shown.status === 'ok' ? shown.snapshot.day_id : null,
  };
}

export const createDailyDaySlice: AppStateCreator<DailyDaySlice> = (set, get, api) => {
  // A signed-in start and the window `online` event refresh the saved days.
  registerLocalCopy(DAILY_DAYS_COPY_KIND, () => get().loadDailyDay());

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
   * Delete the account's `failed` queue rows for days other than `keepDayId`,
   * then refresh the shown rows. Never throws: a failure is logged and the rows
   * stay for the next read. The delete is scoped to `userId`, so it cannot
   * touch another account's rows even if the session changed meanwhile.
   */
  const pruneFailedPicks = async (
    userId: string,
    keepDayId: string,
    isCurrent: () => boolean
  ): Promise<void> => {
    try {
      if (!isCurrent()) return;
      const removed = await removeFailedQueuedPicksExcept(userId, keepDayId);
      if (removed > 0) await showQueuedPicks(userId, isCurrent);
    } catch (error) {
      console.error('[DailyQuestion] Could not clear refused picks for other days:', error);
    }
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
      const next = mergeAnswer(shown, merged);
      set((state) => ({
        dailyDay: next,
        dailyDayError: null,
        ...countAnswer(state, next),
      }));
    }
  };

  // Counts the queued picks the drain has had confirmed (`dailyQueuedPickSent`).
  let queuedPickSeq = 0;

  // The last non-null partner id seen in this identity, and the identity it was
  // seen in (`userId:authSessionVersion`).
  let lastPartnerId: string | null = null;
  let seenIdentity = '';

  // Bumped when the partner changes: a read or a write that began before it
  // (`loadDailyDay`, `refreshDailyDay`, a drained or submitted pick, a written
  // question, a nudge) is the old pair's and puts nothing on screen and nothing
  // in the copy.
  let pairEpoch = 0;

  /**
   * The old pair's day is gone and the reads in flight for it write nothing; a
   * day that was shown or being read is read again for the new partner, since
   * Daily's read effect does not re-run on a partner change.
   */
  const resetDayForNewPair = () => {
    const dayWanted = get().dailyDay !== null || get().dailyDayLoading;
    pairEpoch += 1;
    set({ dailyDay: null, dailyDayLoading: false, dailyDayError: null });
    if (dayWanted && get().userId) void get().loadDailyDay();
  };

  // The tab's running drain, and whether a call arrived while it ran.
  let drainInFlight: Promise<void> | null = null;
  let drainRequested = false;

  // The retry after a pass stops on a transient failure while online, or ends
  // 'other-tab' (pending rows remain after another tab's lock let go). One timer
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

    // A new partner id after another one (never a first link or the same
    // partner again) ends the old pair's day, streak and past questions.
    const identity = `${state.userId}:${state.authSessionVersion}`;
    if (identity !== seenIdentity) {
      seenIdentity = identity;
      lastPartnerId = null;
    }
    const partnerId = state.partner?.id ?? null;
    if (!partnerId) return;
    const changed = lastPartnerId !== null && partnerId !== lastPartnerId;
    lastPartnerId = partnerId;
    if (changed) {
      // History first, so the streak re-read starts last.
      get().resetDailyHistoryForNewPair();
      resetDayForNewPair();
      get().resetCoupleStreakForNewPair();
    }
  });

  /** Tell the partner's open Daily about a confirmed pick, without waiting for it. */
  const announceConfirmedPick = (dayId: string): void => {
    void announceDailyPick(dayId).catch((error: unknown) => {
      console.error('[DailyQuestion] Could not announce the pick:', error);
    });
  };

  /**
   * One pass over the signed-in account's pending rows. Never throws. Answers
   * what the pass ended on, which decides the retry.
   */
  const drainOnce = async (): Promise<DrainPassOutcome> => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy || !isOnline()) return 'offline';
    const epoch = pairEpoch;
    const isCurrent = () =>
      get().userId === requestedBy && get().authSessionVersion === requestedInSession;
    const isSamePair = () => isCurrent() && pairEpoch === epoch;

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
          // Announce while the same account is signed in, even across a
          // same-account re-login (it bumps the session version): the
          // announcement resolves the partner from the current session, so a
          // switch to another account or a sign-out must send nothing.
          if (get().userId === requestedBy) announceConfirmedPick(snapshot.day_id);
          if (!isCurrent()) return 'stale';
          // A late pick can finish a past date: the streak corrects itself.
          void get().loadCoupleStreak();
          const partner = await mergePartnerId(get, requestedBy);
          if (!isCurrent()) return 'stale';
          // The partner changed while the pick was sent: the day is the old
          // pair's, so it stays out of the copy and off the screen, and the
          // pass goes on with the next row.
          if (!isSamePair()) continue;
          const merged = await mergeDailyDay(
            requestedBy,
            { status: 'ok', snapshot },
            partner,
            isSamePair
          );
          if (!isCurrent()) return 'stale';
          if (!isSamePair()) continue;
          showIfOnScreen(snapshot, merged);
          // Tell an open Daily that an answer it did not send itself was confirmed.
          queuedPickSeq += 1;
          set({ dailyQueuedPickSent: { dayId: snapshot.day_id, seq: queuedPickSeq } });
        }
        return 'done';
      });
      if (pass.ran) {
        result = pass.result;
      } else {
        // Another tab is sending: look at what it did once it lets go. If it
        // left pending rows (it stopped on a transient failure and may have
        // closed, taking its retry timer along), this tab retries them.
        result = 'stale';
        await waitForSyncLock(PICK_QUEUE_LOCK);
        if (isCurrent()) {
          await get().loadDailyDay();
          if (isCurrent()) {
            const left = (await listQueuedPicks(requestedBy)).filter((row) => !row.failed);
            result = left.length > 0 ? 'other-tab' : 'done';
          }
        }
      }
    } catch (error) {
      console.error('[DailyQuestion] Could not send the queued picks:', error);
      result = 'failed';
    }
    // The field is refreshed on every path; an unreadable queue reads as empty.
    await showQueuedPicks(requestedBy, isCurrent);
    return result;
  };

  /**
   * One read: the saved day, then the server's answer. Never throws.
   */
  const readDayOnce = async (): Promise<void> => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) return;
    const epoch = pairEpoch;
    const isCurrent = () =>
      get().userId === requestedBy &&
      get().authSessionVersion === requestedInSession &&
      pairEpoch === epoch;

    set({ dailyDayLoading: true });

    // 1. The saved day for the device's date, at once: shown when nothing is,
    // or when the shown day is another one; the higher state wins for the
    // same day_id.
    const today = formatDateISO(new Date());
    const [saved, declined] = await Promise.all([
      shownPartnerId(get, requestedBy).then((partnerId) =>
        readSavedDailyDay(requestedBy, today, partnerId)
      ),
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
      // Only an `ok` answer is tagged; `unlinked` writes `{}` and needs no partner.
      const partner =
        answer.status === 'ok' ? await mergePartnerId(get, requestedBy) : NO_PARTNER_TAG;
      if (!isCurrent()) return;
      const merged = await mergeDailyDay(requestedBy, answer, partner, isCurrent);
      if (!isCurrent()) return;
      set((state) => {
        const next = mergeAnswer(state.dailyDay, merged);
        return {
          dailyDay: next,
          dailyDayLoading: false,
          dailyDayError: null,
          ...countAnswer(state, next),
        };
      });
      // A server answer for today: a refused pick for another day is shown
      // nowhere and no new pick can replace it, so it goes (DW-483).
      if (answer.status === 'ok' && answer.snapshot.day === today) {
        await pruneFailedPicks(requestedBy, answer.snapshot.day_id, isCurrent);
      }
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
  };

  /**
   * Re-read one day by id and merge the answer into the saved days; it is shown
   * only when it is the day on screen, or today's with nothing on screen. Never
   * throws. Answers the merged snapshot, or `null` when the read failed or the
   * session or pair changed meanwhile (a failure is logged and changes nothing).
   */
  const readDayById = async (dayId: string): Promise<DailyDaySnapshot | null> => {
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    if (!requestedBy) return null;
    const epoch = pairEpoch;
    const isCurrent = () =>
      get().userId === requestedBy &&
      get().authSessionVersion === requestedInSession &&
      pairEpoch === epoch;

    try {
      const snapshot = await fetchDailyDayById(dayId);
      if (!isCurrent()) return null;
      const partner = await mergePartnerId(get, requestedBy);
      if (!isCurrent()) return null;
      const merged = await mergeDailyDay(
        requestedBy,
        { status: 'ok', snapshot },
        partner,
        isCurrent
      );
      if (!isCurrent()) return null;
      showIfOnScreen(snapshot, merged);
      return merged.status === 'ok' ? merged.snapshot : snapshot;
    } catch (error) {
      if (!isCurrent()) return null;
      console.error('[DailyQuestion] Failed to re-read a day:', error);
      return null;
    }
  };

  // The tab's day reads, one in flight plus one trailing pass per identity and
  // pair (`userId:authSessionVersion:pairEpoch`): see `trailingRead.ts`. A call
  // in another identity or pair starts its own read, and the old read, now
  // stale, writes nothing.
  const dayReads = createTrailingRead(() => {
    const { userId, authSessionVersion } = get();
    return userId ? `${userId}:${authSessionVersion}:${pairEpoch}` : null;
  }, readDayOnce);

  return {
    dailyDay: null,
    dailyDayLoading: false,
    dailyDayError: null,
    dailyQueuedPicks: [],
    dailyWriteDeclined: [],
    dailyDayAnswers: 0,
    dailyDayAnsweredId: null,
    dailyQueuedPickSent: null,

    loadDailyDay: () => dayReads.call(),

    refreshDailyDay: async (dayId) => {
      await readDayById(dayId);
    },

    submitDailyPick: async (choice) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to send your pick');
      const epoch = pairEpoch;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;
      const isSamePair = () => isCurrent() && pairEpoch === epoch;

      const shown = get().dailyDay;
      if (shown?.status !== 'ok') throw new Error('There is no question to answer yet');

      const pickedAt = new Date();
      if (formatDateISO(pickedAt) !== shown.snapshot.day) {
        void get().loadDailyDay();
        throw new AccountDataError('day-changed', DAY_CHANGED_MESSAGE);
      }

      // The pick waits in the queue with the instant and zone it was made in.
      const queuePick = async () => {
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
      };

      if (!isOnline()) {
        await queuePick();
        return;
      }

      let snapshot: DailyDaySnapshot;
      try {
        snapshot = await submitDailyPickRequest(shown.snapshot.day_id, choice, pickedAt);
      } catch (error) {
        if (error instanceof AccountDataError && error.code === 'day-changed' && isCurrent()) {
          void get().loadDailyDay();
        }
        // Lost in transit, or answered after the timeout: the server may have the
        // pick or not. It waits in the queue as an offline pick does, and the
        // drain sends it again; the server keeps a pick already stored (DW-484).
        if (error instanceof AccountDataError && error.code === 'transport') {
          await queuePick();
          return;
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
      // Tell the partner's open Daily, without waiting for it: the pick is
      // confirmed and stays shown whatever the broadcast does. A same-account
      // re-login still announces; a switch or sign-out does not (the partner
      // is resolved from the current session).
      if (get().userId === requestedBy) announceConfirmedPick(snapshot.day_id);
      if (!isCurrent()) return;
      // The pick may finish the day: re-read the streak, without waiting.
      void get().loadCoupleStreak();
      // A confirmed own write is a fill source for the copy.
      const partner = await mergePartnerId(get, requestedBy);
      if (!isSamePair()) return;
      const merged = await mergeDailyDay(
        requestedBy,
        { status: 'ok', snapshot },
        partner,
        isSamePair
      );
      if (!isSamePair()) return;
      const stored = mergeAnswer(get().dailyDay, merged);
      set((state) => ({
        dailyDay: stored,
        dailyDayError: null,
        ...countAnswer(state, stored),
      }));
      return stored;
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

          // A transient stop, or an other-tab pass that left pending rows, while
          // online retries on a backoff; a completed pass resets it. Known
          // offline, the `online` event drains instead.
          const { userId, authSessionVersion } = get();
          if (outcome === 'done' || outcome === 'offline') {
            cancelDrainRetry();
          } else if (
            (outcome === 'transient' || outcome === 'failed' || outcome === 'other-tab') &&
            userId &&
            isOnline()
          ) {
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
      const epoch = pairEpoch;
      const isCurrent = () =>
        get().userId === requestedBy &&
        get().authSessionVersion === requestedInSession &&
        pairEpoch === epoch;

      const shown = get().dailyDay;
      if (shown?.status !== 'ok') throw new Error('There is no question to write from yet');

      const snapshot = await submitWrittenQuestionRequest(
        shown.snapshot.day_id,
        thisText,
        thatText
      );
      if (!isCurrent()) return;
      const partner = await mergePartnerId(get, requestedBy);
      if (!isCurrent()) return;
      const merged = await mergeDailyDay(
        requestedBy,
        { status: 'ok', snapshot },
        partner,
        isCurrent
      );
      if (!isCurrent()) return;
      set((state) => {
        const next = mergeAnswer(state.dailyDay, merged);
        return { dailyDay: next, dailyDayError: null, ...countAnswer(state, next) };
      });
    },

    sendDailyNudge: async (source) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to send a nudge');
      const epoch = pairEpoch;
      const isCurrent = () =>
        get().userId === requestedBy &&
        get().authSessionVersion === requestedInSession &&
        pairEpoch === epoch;

      const shown = get().dailyDay;
      if (shown?.status !== 'ok') throw new Error('There is no day to nudge about yet');
      const dayId = shown.snapshot.day_id;

      let snapshot: DailyDaySnapshot;
      try {
        snapshot = await sendDailyNudgeRequest(dayId, source);
      } catch (error) {
        // Offline sent nothing: the caller shows the offline sentence, with no re-read.
        if (error instanceof AccountDataError && error.code === 'offline') throw error;
        if (isNudgeAlreadySent(error)) {
          // The nudge from this source is on record: this send ends as sent.
          // After a session change the day is another account's: no re-read (DW-561).
          if (!isCurrent()) return 'sent';
          set((state) => {
            const current = state.dailyDay;
            if (current?.status !== 'ok' || current.snapshot.day_id !== dayId) return {};
            return {
              dailyDay: { status: 'ok', snapshot: withNudgeSent(current.snapshot, source) },
            };
          });
          await readDayById(dayId);
          return 'sent';
        }
        // The API logged the failure: it is not logged again here (DW-547).
        if (!isNudgeOutcomeUnknown(error)) {
          // A refusal: the day may have moved on (the partner picked), so look.
          if (isCurrent()) void readDayById(dayId);
          return 'failed';
        }
        // The answer was lost: the server may have recorded it. Unknown is not failed.
        if (!isCurrent()) return 'unchecked';
        const reread = await readDayById(dayId);
        if (reread === null) return 'unchecked';
        return isNudgeSent(nudgeState(reread), source) ? 'sent' : 'failed';
      }
      if (!isCurrent()) return 'sent';
      const partner = await mergePartnerId(get, requestedBy);
      if (!isCurrent()) return 'sent';
      const merged = await mergeDailyDay(
        requestedBy,
        { status: 'ok', snapshot },
        partner,
        isCurrent
      );
      if (!isCurrent()) return 'sent';
      // Only when that day is still the one on screen: a re-read may have moved on.
      showIfOnScreen(snapshot, merged);
      // Tell the partner's open Daily, without waiting for it: the nudge is
      // confirmed and stays shown whatever the broadcast does.
      void announceDailyNudge(snapshot.day_id).catch((error: unknown) => {
        console.error('[DailyQuestion] Could not announce the nudge:', error);
      });
      return 'sent';
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
