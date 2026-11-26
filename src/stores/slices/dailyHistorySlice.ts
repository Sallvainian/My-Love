/**
 * Daily History Slice
 *
 * The couple's past questions (Partner page): `dailyHistory`
 * holds `get_daily_history`'s pages read so far (the pair's done days as
 * snapshots, newest first, 30 a page; `null` before any answer, `[]` for none
 * or unlinked), `dailyHistoryLoading` a read of the first page in flight and
 * `dailyHistoryError` the message of the last failed read. `loadDailyHistory`
 * reads the first page and merges it: a full page replaces only the newest
 * rows (loaded rows older than its oldest day stay, `dailyHistoryEnd` as it
 * was, or false when none stay), a short page is the whole list (it replaces all and sets
 * `dailyHistoryEnd`). `loadMoreDailyHistory` reads the page before the oldest
 * row, appends the rows not yet present and sets `dailyHistoryEnd` when the page
 * is short; it does nothing unless signed in with rows, not at the end and not
 * already loading more (`dailyHistoryLoadingMore`), and writes nothing when the
 * session changed or the list's oldest day is no longer the one it asked
 * before, or when the pair changed. Both never throw: a failure keeps the rows
 * shown and sets the error (an offline refusal is not logged). Only the newest
 * started first-page read writes (its own sequence counter), nothing if the
 * session or the pair changed. Every
 * page read is merged into the `daily-days` copy (the same map as Daily's days,
 * no cap), and a failed first read with nothing shown fills the list from that
 * copy (the current partner's `both` days, newest first, `dailyHistoryEnd`
 * set); the next successful first page replaces such a list rather than
 * merging with it, and a failed read never writes the copy.
 * `signedOutState()` clears all seven fields.
 *
 * When the shown partner changes from one id to another in a session, the day
 * slice's one pair-change subscriber calls `resetDailyHistoryForNewPair`: the
 * past questions and their errors, loading flags and end flag are cleared, and
 * the reads in flight for the old pair write nothing, to the fields or to the
 * copy (the sequence counter and a generation are bumped).
 */

import {
  DAILY_HISTORY_PAGE_SIZE,
  type DailyDaySnapshot,
  fetchDailyHistory,
} from '../../api/dailyQuestionApi';
import { AccountDataError } from '../../services/accountDataError';
import { mergeDailyDays, readSavedDailyHistory } from '../../services/dailyDaysCopy';
import { mergePartnerId, shownPartnerId } from '../dailyPartnerIds';
import type { AppStateCreator } from '../types';

export interface DailyHistorySlice {
  /** The first page of the pair's past questions, newest first, or `null` before any answer. */
  dailyHistory: DailyDaySnapshot[] | null;
  /** A `loadDailyHistory` request is in flight. */
  dailyHistoryLoading: boolean;
  /** The message of the last failed history read; cleared by the next answer. */
  dailyHistoryError: string | null;
  /** That failed read was an offline refusal, not a server or network fault. */
  dailyHistoryErrorOffline: boolean;
  /** That failed read was a `loadMoreDailyHistory`, not the first page. */
  dailyHistoryErrorMore: boolean;
  /** The oldest page of past questions has been read (a page shorter than a full one). */
  dailyHistoryEnd: boolean;
  /** A `loadMoreDailyHistory` request is in flight. */
  dailyHistoryLoadingMore: boolean;

  /** Read the first page of past questions and merge it into the field. Never throws; a failure keeps what is shown. */
  loadDailyHistory: () => Promise<void>;
  /** Read the page of past questions before the oldest row shown and append it. Never throws; a failure keeps what is shown. */
  loadMoreDailyHistory: () => Promise<void>;
  /**
   * The old pair's past questions are gone and their reads in flight write
   * nothing. Called only by `dailyDaySlice`'s pair-change subscriber.
   */
  resetDailyHistoryForNewPair: () => void;
}

export const createDailyHistorySlice: AppStateCreator<DailyHistorySlice> = (set, get) => {
  // The newest started `loadDailyHistory`: an older read that lands later writes nothing.
  let historySeq = 0;
  // The shown history was filled from the copy after a failed first read: the
  // next successful first page replaces it instead of merging with it.
  let historyFromCopy = false;
  // Bumped when the shown partner changes: a history read started under an
  // older generation belongs to the old pair and writes nothing.
  let pairGeneration = 0;

  return {
    dailyHistory: null,
    dailyHistoryLoading: false,
    dailyHistoryError: null,
    dailyHistoryErrorOffline: false,
    dailyHistoryErrorMore: false,
    dailyHistoryEnd: false,
    dailyHistoryLoadingMore: false,

    loadDailyHistory: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const mine = ++historySeq;
      const generation = pairGeneration;
      const inSession = () =>
        get().userId === requestedBy &&
        get().authSessionVersion === requestedInSession &&
        pairGeneration === generation;
      const isCurrent = () => inSession() && historySeq === mine;

      set({ dailyHistoryLoading: true });
      try {
        const days = await fetchDailyHistory();
        if (!isCurrent()) return;
        // A list filled from the copy is stale: this page is the first thing loaded.
        const loaded = historyFromCopy ? [] : (get().dailyHistory ?? []);
        historyFromCopy = false;
        const oldest = days[days.length - 1];
        if (days.length >= DAILY_HISTORY_PAGE_SIZE && oldest) {
          // A full first page: rows paged in below it stay, `dailyHistoryEnd` as it
          // was; with none kept (an earlier empty read set it) there is more to page.
          const kept = loaded.filter((row) => row.day < oldest.day);
          set({
            dailyHistory: [...days, ...kept],
            ...(kept.length === 0 ? { dailyHistoryEnd: false } : {}),
            dailyHistoryLoading: false,
            dailyHistoryError: null,
            dailyHistoryErrorOffline: false,
            dailyHistoryErrorMore: false,
          });
        } else {
          // A short page is the whole list.
          set({
            dailyHistory: days,
            dailyHistoryEnd: true,
            dailyHistoryLoading: false,
            dailyHistoryError: null,
            dailyHistoryErrorOffline: false,
            dailyHistoryErrorMore: false,
          });
        }
        // Save the page for offline; the session decides, not a newer read.
        if (days.length === 0) return;
        const partnerId = await mergePartnerId(get, requestedBy);
        if (!inSession()) return;
        await mergeDailyDays(requestedBy, days, partnerId, inSession);
      } catch (error) {
        if (!isCurrent()) return;
        // An offline refusal is expected, not a fault: the error is still set.
        if (!(error instanceof AccountDataError && error.code === 'offline')) {
          console.error('[DailyQuestion] Failed to load the past questions:', error);
        }
        set({
          dailyHistoryLoading: false,
          dailyHistoryError:
            error instanceof Error ? error.message : 'Could not load your past questions.',
          dailyHistoryErrorOffline: error instanceof AccountDataError && error.code === 'offline',
          dailyHistoryErrorMore: false,
        });
        // Nothing shown: fill the list from the copy (never written on a failure).
        if (get().dailyHistory === null) {
          const partnerId = await shownPartnerId(get, requestedBy);
          if (!isCurrent()) return;
          const saved = await readSavedDailyHistory(requestedBy, partnerId);
          if (!isCurrent() || get().dailyHistory !== null) return;
          if (saved.length > 0) {
            set({ dailyHistory: saved, dailyHistoryEnd: true });
            historyFromCopy = true;
          }
        }
      }
    },

    loadMoreDailyHistory: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const loaded = get().dailyHistory;
      const asked = loaded?.[loaded.length - 1]?.day;
      if (!requestedBy || asked === undefined) return;
      if (get().dailyHistoryEnd || get().dailyHistoryLoadingMore) return;
      const generation = pairGeneration;
      const inSession = () =>
        get().userId === requestedBy &&
        get().authSessionVersion === requestedInSession &&
        pairGeneration === generation;

      set({ dailyHistoryLoadingMore: true });
      try {
        const days = await fetchDailyHistory(asked);
        if (!inSession()) return;
        const rows = get().dailyHistory ?? [];
        // A first-page re-read can have replaced the tail while this ran.
        if (rows[rows.length - 1]?.day !== asked) {
          set({ dailyHistoryLoadingMore: false });
          return;
        }
        const present = new Set(rows.map((row) => row.day_id));
        set({
          dailyHistory: [...rows, ...days.filter((row) => !present.has(row.day_id))],
          dailyHistoryEnd: days.length < DAILY_HISTORY_PAGE_SIZE,
          dailyHistoryLoadingMore: false,
          // An older page answers only a failed "more": a failed first page
          // stays failed (and its Retry stays) until the first page is read.
          ...(get().dailyHistoryErrorMore
            ? { dailyHistoryError: null, dailyHistoryErrorOffline: false, dailyHistoryErrorMore: false }
            : {}),
        });
        if (days.length === 0) return;
        const partnerId = await mergePartnerId(get, requestedBy);
        if (!inSession()) return;
        await mergeDailyDays(requestedBy, days, partnerId, inSession);
      } catch (error) {
        if (!inSession()) return;
        if (!(error instanceof AccountDataError && error.code === 'offline')) {
          console.error('[DailyQuestion] Failed to load more past questions:', error);
        }
        // A failed first page still pending outranks this: it keeps the error
        // (and its Retry) until a first-page read answers.
        if (get().dailyHistoryError !== null && !get().dailyHistoryErrorMore) {
          set({ dailyHistoryLoadingMore: false });
          return;
        }
        set({
          dailyHistoryLoadingMore: false,
          dailyHistoryError:
            error instanceof Error ? error.message : 'Could not load your past questions.',
          dailyHistoryErrorOffline: error instanceof AccountDataError && error.code === 'offline',
          dailyHistoryErrorMore: true,
        });
      }
    },

    resetDailyHistoryForNewPair: () => {
      historySeq += 1;
      pairGeneration += 1;
      historyFromCopy = false;
      set({
        dailyHistory: null,
        dailyHistoryLoading: false,
        dailyHistoryError: null,
        dailyHistoryErrorOffline: false,
        dailyHistoryErrorMore: false,
        dailyHistoryEnd: false,
        dailyHistoryLoadingMore: false,
      });
    },
  };
};
