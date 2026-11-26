/**
 * useDailyDayRereads — re-read today's day when the nudge slot may have changed
 * and when the app comes back to the front (AD-16, AD-17).
 *
 * `DailyQuestion` mounts this. The snapshot's `nudge.slot` turns from
 * `after_pick` to `evening` at 20:00 in the sender's stored zone (each Daily
 * read stores the zone from this device), and nothing else tells an open
 * Daily, so while the account is signed in:
 *
 *   - a timer fires at the next local 20:00:05 (the 5 s let a server clock a
 *     little behind the device's answer the evening slot), calls `loadDailyDay`
 *     and arms the next day's. The timer is cleared on unmount and on a session
 *     change; the callback itself does not check the session.
 *   - every `visibilitychange` to `visible` calls `loadDailyDay`, because a
 *     page hidden past 20:00 (or past midnight) has missed both the timer and
 *     any broadcast.
 *
 * `loadDailyDay` never throws and keeps what is shown when it fails.
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

/** Local time of the evening re-read: 20:00 and 5 s. */
const EVENING_HOUR = 20;
const EVENING_SECONDS = 5;

/** Milliseconds from `now` to the next local 20:00:05 (tomorrow's once today's has passed). */
function msUntilEvening(now: Date): number {
  const at = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    EVENING_HOUR,
    0,
    EVENING_SECONDS
  );
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at.getTime() - now.getTime();
}

export function useDailyDayRereads(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const loadDailyDay = useAppStore((state) => state.loadDailyDay);

  const signedIn = userId !== null;
  const session = userId ? `${userId}:${authSessionVersion}` : null;

  useEffect(() => {
    if (!signedIn) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      timer = setTimeout(() => {
        void loadDailyDay();
        arm();
      }, msUntilEvening(new Date()));
    };
    arm();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadDailyDay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [signedIn, session, loadDailyDay]);
}
