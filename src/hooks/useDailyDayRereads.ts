/**
 * useDailyDayRereads — re-read today's day when the app comes back to the front
 * (AD-16).
 *
 * `DailyQuestion` mounts this. While the account is signed in, every
 * `visibilitychange` to `visible` calls `loadDailyDay`, because a page hidden
 * past midnight, or while a partner answered, has missed any broadcast. There is
 * no timer: the evening re-read at 20:00:05 that followed the sender's nudge slot
 * went with the slots (story 11.1), and the nudge controls close themselves at
 * the day's closing instant (`useNudgeClosed`) with no re-read.
 *
 * `loadDailyDay` never throws and keeps what is shown when it fails.
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useDailyDayRereads(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const loadDailyDay = useAppStore((state) => state.loadDailyDay);

  const signedIn = userId !== null;
  const session = userId ? `${userId}:${authSessionVersion}` : null;

  useEffect(() => {
    if (!signedIn) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadDailyDay();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [signedIn, session, loadDailyDay]);
}
