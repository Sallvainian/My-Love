/**
 * useDailyPickListener — show the partner's pick, and today's day once a
 * partner request is accepted, on an open Daily without a reload (architecture
 * AD-11).
 *
 * `DailyQuestion` mounts this. While the account is signed in and online it
 * holds one subscriber on the shared partner channel (the refcounted registry
 * in moodSyncService, never a channel of its own):
 *
 *   - `daily_pick { day_id }` re-reads that one day (`refreshDailyDay`). The
 *     event carries no choice and is trusted for nothing else.
 *   - `partner_linked` re-reads today's day (`loadDailyDay`): the device that
 *     accepted this account's partner request sends it, and the topic is the
 *     account's own, so it arrives while Daily shows the invitation to link.
 *     Without it the invitation stays until Daily is opened again (DW-490).
 *   - Every `SUBSCRIBED` — the join, each Realtime re-join, and the replay a
 *     subscriber gets when it attaches to an already-open channel — re-reads
 *     today's day (`loadDailyDay`), because a broadcast is ephemeral and never
 *     replayed: one that lands while the channel joins or re-joins is lost.
 *
 * `session` is a dependency so an account switch re-subscribes: the topic is
 * the signed-in user's, read once at subscribe.
 */

import { useEffect } from 'react';
import { moodSyncService } from '../api/moodSyncService';
import { useAppStore } from '../stores/useAppStore';

export function useDailyPickListener(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const loadDailyDay = useAppStore((state) => state.loadDailyDay);
  const refreshDailyDay = useAppStore((state) => state.refreshDailyDay);

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
        daily_pick: ({ day_id }) => {
          if (active) void refreshDailyDay(day_id);
        },
        partner_linked: () => {
          if (active) void loadDailyDay();
        },
        onStatus: (status) => {
          if (active && status === 'SUBSCRIBED') void loadDailyDay();
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
        console.error('[useDailyPickListener] Could not listen for a partner pick:', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [listening, session, loadDailyDay, refreshDailyDay]);
}
