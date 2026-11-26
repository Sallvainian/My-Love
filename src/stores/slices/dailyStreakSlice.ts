/**
 * Daily Streak Slice
 *
 * The couple's streak (Partner page and Daily): `coupleStreak` holds the
 * last `get_couple_streak` answer (`{ status: 'ok', streak }`, `{ status:
 * 'unlinked' }`, or `null` before any), `coupleStreakLoading` a read in flight
 * and `coupleStreakError` the message of the last failed read.
 * `loadCoupleStreak` never throws; a failure keeps the answer shown and sets
 * the error, and only a successful answer writes the field and clears it. The
 * last `ok` streak is the `daily-streak` local copy (`services/dailyStreakCopy.ts`):
 * `loadCoupleStreak` shows it first, but only over `null` (an answer in memory
 * is at least as new), and a successful answer then replaces it (`ok`) or
 * deletes it (`unlinked`); a failed read leaves it. The copy is tagged with the
 * partner it was read with and shown only for the current partner
 * (`shownPartnerId`), as the saved days are. Only the newest started read writes
 * (a sequence counter), and a read that outlives the session writes nothing, to
 * the field or to the copy. `signedOutState()` clears all three fields.
 * Daily shows the streak too, so `submitDailyPick` and the queue drain
 * (`dailyDaySlice`) re-read it (`void loadCoupleStreak()`) after each pick the
 * server confirmed, once the session is still current; a queued pick and a
 * refused row do not.
 *
 * When the shown partner changes from one id to another in a session, the day
 * slice's one pair-change subscriber calls `resetCoupleStreakForNewPair`: the
 * streak, its error and loading flag are cleared and the read in flight for the
 * old pair writes nothing (the sequence counter is bumped). A streak that was
 * shown or being read is then read again for the new partner, since Daily's
 * read effect does not re-run on a partner change.
 *
 * The streak's +1 (R4) is claimed through `claimStreakCelebration(streak)`: the
 * Daily view calls it for each `ok` streak it shows, and the device-state
 * `daily-celebrated` kind (`services/dailyCelebrated.ts`) decides under a lock
 * whether that held total is new to this device and, in the same claim, whether
 * its milestone screen has yet to show. That claim stores the held total alone;
 * `claimStreakMilestone(streak)` stores the milestone count just before its
 * screen shows (R5), so a +1 cut short leaves the milestone for the next open of
 * Daily. Both hold no state here, so sign-out needs nothing in
 * `signedOutState()` (the kind goes with `deleteAccountCopies`). Neither throws.
 */

import {
  fetchCoupleStreak,
  type CoupleStreak,
  type CoupleStreakAnswer,
} from '../../api/dailyQuestionApi';
import { AccountDataError } from '../../services/accountDataError';
import {
  type CelebrationClaim,
  claimCelebration,
  claimMilestone,
  NO_CELEBRATION,
} from '../../services/dailyCelebrated';
import {
  DAILY_STREAK_COPY_KIND,
  readSavedStreak,
  saveStreakAnswer,
} from '../../services/dailyStreakCopy';
import { registerLocalCopy } from '../../services/localCopy';
import { mergePartnerId, shownPartnerId } from '../dailyPartnerIds';
import type { AppStateCreator } from '../types';

export interface DailyStreakSlice {
  /** The last server answer for the couple's streak, or `null` before any. */
  coupleStreak: CoupleStreakAnswer | null;
  /** A `loadCoupleStreak` request is in flight. */
  coupleStreakLoading: boolean;
  /** The message of the last failed streak read; cleared by the next answer. */
  coupleStreakError: string | null;

  /** Read the couple's streak from the server. Never throws; a failure keeps what is shown. */
  loadCoupleStreak: () => Promise<void>;
  /**
   * The old pair's streak is gone and its read in flight writes nothing; a
   * streak that was shown or being read is read again for the new partner.
   * Called only by `dailyDaySlice`'s pair-change subscriber.
   */
  resetCoupleStreakForNewPair: () => void;
  /**
   * Ask whether `streak`'s held total is new to this device (`claimCelebration`)
   * and, when it is, record it as celebrated. Resolves `play: true` once per
   * new held total, with `milestone` when the streak's milestone count is new to
   * this device too; else `play: false`, with `milestone` when that held total's
   * +1 was claimed and its milestone screen is still owed. Never throws: a
   * failure is logged and answers `NO_CELEBRATION`, as does no signed-in user or
   * a session that changed meanwhile.
   */
  claimStreakCelebration: (streak: CoupleStreak) => Promise<CelebrationClaim>;
  /**
   * Claim the milestone screen for `streak` just before showing it
   * (`claimMilestone`): `true` once per milestone on this device. Nothing is
   * recorded once `canShow()` is false (the view is gone), so it stays owed.
   * Never throws: a failure is logged and answers `false`, as does no signed-in
   * user or a session that changed meanwhile.
   */
  claimStreakMilestone: (streak: CoupleStreak, canShow: () => boolean) => Promise<boolean>;
}

export const createDailyStreakSlice: AppStateCreator<DailyStreakSlice> = (set, get, _api) => {
  registerLocalCopy(DAILY_STREAK_COPY_KIND, () => get().loadCoupleStreak());

  // The newest started `loadCoupleStreak`: an older read that lands later writes nothing.
  let streakSeq = 0;

  return {
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
      const savedFor = await shownPartnerId(get, requestedBy);
      if (!isCurrent()) return;
      const saved = await readSavedStreak(requestedBy, savedFor);
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
          // Only an `ok` answer is tagged; `unlinked` deletes the copy and needs no partner.
          const partnerId = answer.status === 'ok' ? await mergePartnerId(get, requestedBy) : null;
          if (!isCurrent()) return;
          await saveStreakAnswer(requestedBy, answer, partnerId);
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

    resetCoupleStreakForNewPair: () => {
      // Daily's read effect does not re-run on a partner change, so a streak that
      // was shown or being read is read again for the new partner.
      const streakWanted = get().coupleStreak !== null || get().coupleStreakLoading;
      streakSeq += 1;
      set({ coupleStreak: null, coupleStreakLoading: false, coupleStreakError: null });
      if (streakWanted && get().userId) void get().loadCoupleStreak();
    },

    claimStreakCelebration: async (streak) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return NO_CELEBRATION;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        const claim = await claimCelebration(requestedBy, streak, isCurrent);
        return isCurrent() ? claim : NO_CELEBRATION;
      } catch (error) {
        if (isCurrent()) {
          console.error('[DailyQuestion] Could not record the streak celebration:', error);
        }
        return NO_CELEBRATION;
      }
    },

    claimStreakMilestone: async (streak, canShow) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return false;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        const claimed = await claimMilestone(
          requestedBy,
          streak,
          () => isCurrent() && canShow()
        );
        return claimed && isCurrent();
      } catch (error) {
        if (isCurrent()) {
          console.error('[DailyQuestion] Could not record the milestone as shown:', error);
        }
        return false;
      }
    },
  };
};
