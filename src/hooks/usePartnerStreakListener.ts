/**
 * usePartnerStreakListener — keep the couple's streak on the Partner page
 * current without a reload.
 *
 * `PartnerView` mounts this. While the account is signed in and online it holds
 * one subscriber on the shared partner channel (the refcounted registry in
 * moodSyncService, never a channel of its own):
 *
 *   - `daily_pick { day_id }` re-reads the streak (`loadCoupleStreak`) and the
 *     past questions (`loadDailyHistory`): a partner's pick can finish a day.
 *     The event carries nothing the page trusts.
 *   - `partner_linked` re-reads the streak, the partner and the pending
 *     requests: the topic is the account's own, so it arrives while the page
 *     shows Connect, and without it the page stays on Connect until reopened.
 *   - Every `SUBSCRIBED` -- the join, each Realtime re-join, and the replay a
 *     subscriber gets when it attaches to an already-open channel -- re-reads
 *     the streak and the past questions, because a broadcast is ephemeral and never replayed.
 *
 * `partner_linked` leaves the history alone: a new partner id re-runs the
 * page's own load effect. There is no `new_mood` or `dates_changed` handler:
 * this page shows neither.
 * `session` is a dependency so an account switch re-subscribes: the topic is
 * the signed-in user's, read once at subscribe.
 */

import { useEffect } from 'react';
import { moodSyncService } from '../api/moodSyncService';
import { useAppStore } from '../stores/useAppStore';

export function usePartnerStreakListener(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const loadCoupleStreak = useAppStore((state) => state.loadCoupleStreak);
  const loadDailyHistory = useAppStore((state) => state.loadDailyHistory);
  const loadPartner = useAppStore((state) => state.loadPartner);
  const loadPendingRequests = useAppStore((state) => state.loadPendingRequests);

  const session = userId ? `${userId}:${authSessionVersion}` : null;
  const listening = userId !== null && isOnline;

  useEffect(() => {
    if (!listening) return;

    // `subscribePartnerEvents` is async, so the effect can be torn down before
    // it resolves: release a subscription that arrives after unmount.
    let active = true;
    let unsubscribe: (() => void) | null = null;

    moodSyncService
      .subscribePartnerEvents({
        daily_pick: () => {
          if (!active) return;
          void loadCoupleStreak();
          void loadDailyHistory();
        },
        partner_linked: () => {
          if (!active) return;
          void loadCoupleStreak();
          void loadPartner();
          void loadPendingRequests();
        },
        onStatus: (status) => {
          if (!active || status !== 'SUBSCRIBED') return;
          void loadCoupleStreak();
          void loadDailyHistory();
        },
      })
      .then((release) => {
        if (!active) {
          release();
          return;
        }
        unsubscribe = release;
      })
      .catch((error: unknown) => {
        console.error('[usePartnerStreakListener] Could not listen for the streak:', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [listening, session, loadCoupleStreak, loadDailyHistory, loadPartner, loadPendingRequests]);
}
