/**
 * useDailyDayRereads — re-read today's day when the app comes back to the front,
 * and at the device's local midnight (AD-16, DW-538).
 *
 * `DailyQuestion` mounts this. While the account is signed in:
 *
 *   - every `visibilitychange` to `visible` calls `loadDailyDay` and
 *     `loadCoupleStreak`, because a page hidden past midnight, or while a
 *     partner answered, has missed any broadcast, and the streak's chip, week
 *     and cold banner move with the day (DW-566).
 *   - a timer fires at the next local 00:00:05, calls `loadDailyDay` and
 *     `loadCoupleStreak`, and arms the next night's, so a page left on screen
 *     across midnight moves to the new day (header, question, chip, week, and a
 *     write sheet left open, which closes as its day is no longer the device's
 *     date). When the day then shown is still not the device's date (a server
 *     clock a little behind the device's, or a failed read), it reads both once
 *     more 5 s after the midnight read answered, and no more that night. The
 *     timers are cleared on unmount and on a session change, and a read that
 *     answers after that arms nothing.
 *
 * The evening re-read at 20:00:05 that followed the sender's nudge slot went
 * with the slots (story 11.1), and the nudge controls close themselves at the
 * day's closing instant (`useNudgeClosed`) with no re-read.
 *
 * `loadDailyDay` and `loadCoupleStreak` never throw and keep what is shown
 * when they fail.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { formatDateISO } from '../utils/dateUtils';

/** Seconds after local midnight of the night re-read. */
const MIDNIGHT_SECONDS = 5;
/** Wait before the one further read when the day shown is still the old date. */
const RETRY_MS = 5_000;

/** Milliseconds from `now` to the next local 00:00:05 (tomorrow's). */
function msUntilMidnight(now: Date): number {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, MIDNIGHT_SECONDS);
  return at.getTime() - now.getTime();
}

export function useDailyDayRereads(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const loadDailyDay = useAppStore((state) => state.loadDailyDay);
  const loadCoupleStreak = useAppStore((state) => state.loadCoupleStreak);
  // The shown day's date (null for none or `unlinked`), read by the check after
  // the midnight read, so a ref the effect below keeps current.
  const shownDay = useAppStore((state) =>
    state.dailyDay?.status === 'ok' ? state.dailyDay.snapshot.day : null
  );
  const shownDayRef = useRef(shownDay);
  useEffect(() => {
    shownDayRef.current = shownDay;
  }, [shownDay]);

  const signedIn = userId !== null;
  const session = userId ? `${userId}:${authSessionVersion}` : null;

  useEffect(() => {
    if (!signedIn) return;

    let stopped = false;
    let midnight: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const readDayAndStreak = () => Promise.all([loadDailyDay(), loadCoupleStreak()]);

    // The check runs when the retry is due, by when the answer is on screen.
    const atMidnight = async () => {
      await readDayAndStreak();
      if (stopped) return;
      retry = setTimeout(() => {
        retry = null;
        const date = shownDayRef.current;
        if (date !== null && date !== formatDateISO(new Date())) void readDayAndStreak();
      }, RETRY_MS);
    };

    const arm = () => {
      midnight = setTimeout(() => {
        void atMidnight();
        arm();
      }, msUntilMidnight(new Date()));
    };
    arm();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void readDayAndStreak();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      if (midnight !== null) clearTimeout(midnight);
      if (retry !== null) clearTimeout(retry);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [signedIn, session, loadDailyDay, loadCoupleStreak]);
}
