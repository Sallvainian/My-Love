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
 * merging with it, and a failed read never writes the copy. An offline refusal
 * (of the first page or of a "more") with rows already shown appends the saved
 * rows older than the oldest shown, sets `dailyHistoryEnd` and marks the list
 * as filled from the copy, so the next online first page replaces it and the
 * paging resumes; with no older saved row nothing changes.
 *
 * The copy is filled in the background too: after a full first page lands
 * online, `fillCopyInBackground` pages every older done day into the
 * `daily-days` copy only (never into `dailyHistory`), through `mergeDailyDays`,
 * until a short page, a page that goes no further back, or until the saved done
 * days for the partner reach the streak's `done` (it waits for a streak read
 * under way and reads the count before each page, so a copy already complete
 * asks for nothing). One fill runs at a time per session and pair; a session or
 * pair change stops it before its next write, an offline refusal or a failure
 * ends it quietly or with a log, and it never sets the error fields.
 * `loadDailyHistory` resolves after it. `signedOutState()` clears all seven fields.
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

const isOfflineRefusal = (error: unknown): boolean =>
  error instanceof AccountDataError && error.code === 'offline';

export const createDailyHistorySlice: AppStateCreator<DailyHistorySlice> = (set, get, api) => {
  // The newest started `loadDailyHistory`: an older read that lands later writes nothing.
  let historySeq = 0;
  // The shown history was filled from the copy after a failed first read: the
  // next successful first page replaces it instead of merging with it.
  let historyFromCopy = false;
  // Bumped when the shown partner changes: a history read started under an
  // older generation belongs to the old pair and writes nothing.
  let pairGeneration = 0;
  // The background copy fill under way, if any: one at a time per session and pair.
  let activeFill: { userId: string; version: number; generation: number } | null = null;

  /**
   * Rows saved in the copy older than the oldest shown are appended to the list
   * after an offline refusal, which then counts as filled from the copy. Writes
   * nothing when the copy has no older row, the list is empty, or the session,
   * the pair or the list's oldest day changed meanwhile.
   */
  const appendSavedOlder = async (userId: string, inSession: () => boolean) => {
    const asked = get().dailyHistory?.at(-1)?.day;
    if (asked === undefined) return;
    const partnerId = await shownPartnerId(get, userId);
    if (!inSession()) return;
    const saved = await readSavedDailyHistory(userId, partnerId);
    if (!inSession()) return;
    const rows = get().dailyHistory;
    if (!rows || rows[rows.length - 1]?.day !== asked) return;
    const present = new Set(rows.map((row) => row.day_id));
    const older = saved.filter((row) => row.day < asked && !present.has(row.day_id));
    if (older.length === 0) return;
    historyFromCopy = true;
    set({ dailyHistory: [...rows, ...older], dailyHistoryEnd: true });
  };

  /** Resolves once no streak read is in flight (or `inSession` stops holding). */
  const streakSettled = (inSession: () => boolean) =>
    new Promise<void>((resolve) => {
      if (!get().coupleStreakLoading || !inSession()) return resolve();
      const unsubscribe = api.subscribe(() => {
        if (get().coupleStreakLoading && inSession()) return;
        unsubscribe();
        resolve();
      });
    });

  /**
   * Page every done day older than `cursor` into the `daily-days` copy and
   * nothing else, until a short page, a page that goes no further back, the
   * streak's `done` is saved for the partner, or the session or the pair
   * changes. Never throws and never sets a field.
   */
  const fillCopyInBackground = async (userId: string, startCursor: string) => {
    const version = get().authSessionVersion;
    const generation = pairGeneration;
    const inSession = () =>
      get().userId === userId &&
      get().authSessionVersion === version &&
      pairGeneration === generation;
    if (
      activeFill &&
      activeFill.userId === userId &&
      activeFill.version === version &&
      activeFill.generation === generation
    ) {
      return;
    }
    const mine = { userId, version, generation };
    activeFill = mine;
    try {
      // The server's count decides when the copy is complete; wait for a read under way.
      await streakSettled(inSession);
      if (!inSession()) return;
      const partner = await mergePartnerId(get, userId);
      // A full first page means the server has a partner; anything but `linked`
      // here is a failed lookup, and an untagged day would be hidden once paged in.
      if (partner.status !== 'linked' || !inSession()) return;
      const { partnerId } = partner;
      let cursor = startCursor;
      for (;;) {
        if (!inSession()) return;
        const streak = get().coupleStreak;
        const wanted = streak?.status === 'ok' ? streak.streak.done : null;
        if (wanted !== null) {
          const saved = await readSavedDailyHistory(userId, partnerId);
          if (!inSession() || saved.length >= wanted) return;
        }
        const days = await fetchDailyHistory(cursor);
        if (!inSession()) return;
        await mergeDailyDays(userId, days, partner, inSession);
        const oldest = days[days.length - 1];
        if (days.length < DAILY_HISTORY_PAGE_SIZE || !oldest || oldest.day >= cursor) return;
        cursor = oldest.day;
      }
    } catch (error) {
      if (!inSession() || isOfflineRefusal(error)) return;
      console.error('[DailyQuestion] Failed to fill the past questions copy:', error);
    } finally {
      if (activeFill === mine) activeFill = null;
    }
  };

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
        const partner = await mergePartnerId(get, requestedBy);
        if (!inSession()) return;
        await mergeDailyDays(requestedBy, days, partner, inSession);
        // A full page means older done days exist: save them for offline too.
        const oldestRead = days[days.length - 1];
        if (days.length >= DAILY_HISTORY_PAGE_SIZE && oldestRead && inSession()) {
          await fillCopyInBackground(requestedBy, oldestRead.day);
        }
      } catch (error) {
        if (!isCurrent()) return;
        // An offline refusal is expected, not a fault: the error is still set.
        if (!isOfflineRefusal(error)) {
          console.error('[DailyQuestion] Failed to load the past questions:', error);
        }
        set({
          dailyHistoryLoading: false,
          dailyHistoryError:
            error instanceof Error ? error.message : 'Could not load your past questions.',
          dailyHistoryErrorOffline: isOfflineRefusal(error),
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
        } else if (isOfflineRefusal(error)) {
          // Rows shown: the saved ones older than the oldest follow them.
          await appendSavedOlder(requestedBy, isCurrent);
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
        const partner = await mergePartnerId(get, requestedBy);
        if (!inSession()) return;
        await mergeDailyDays(requestedBy, days, partner, inSession);
      } catch (error) {
        if (!inSession()) return;
        if (!isOfflineRefusal(error)) {
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
          dailyHistoryErrorOffline: isOfflineRefusal(error),
          dailyHistoryErrorMore: true,
        });
        // Offline, the saved rows older than the oldest shown follow it.
        if (isOfflineRefusal(error)) await appendSavedOlder(requestedBy, inSession);
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
