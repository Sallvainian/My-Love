/**
 * usePartnerLinkListener — learn, on any screen, that a sent partner request
 * was accepted.
 *
 * The accepting device announces the link with PARTNER_LINKED_EVENT on this
 * account's own `mood-updates:<id>` topic (moodSyncService). A broadcast only
 * reaches a device that has joined that topic, and until now only the Partner
 * tab joined it, so a sender waiting on Love Notes, Mood or Home heard nothing
 * and kept a null partner — no thread, no partner mood, every note from the new
 * partner dropped — until they happened to open the Partner tab or reloaded.
 *
 * App mounts this once. While the account is signed in, online and the store
 * holds a settled "no partner", it holds one subscriber on the shared mood
 * channel (the refcounted registry, never a channel of its own). The event
 * re-reads the partner and the pending requests from the server; the screens
 * that cache a partner re-take it when the store's partner changes. Once a
 * partner is in the store the subscriber is released, so a linked account opens
 * nothing here that its own screens do not.
 */

import { useEffect } from 'react';
import { moodSyncService } from '../api/moodSyncService';
import { useAppStore } from '../stores/useAppStore';

export function usePartnerLinkListener(): void {
  const userId = useAppStore((state) => state.userId);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  // Settled "no partner": not while a load is deciding, and not when the
  // partner could not be determined at all.
  const settledUnlinked = useAppStore(
    (state) => state.partner === null && !state.isLoadingPartner && !state.partnerLoadError
  );
  const loadPartner = useAppStore((state) => state.loadPartner);
  const loadPendingRequests = useAppStore((state) => state.loadPendingRequests);

  useEffect(() => {
    if (!userId || !isOnline || !settledUnlinked) return;
    // Re-read rather than trust this render: the signed-in start's partner load
    // is kicked off by an effect in the same commit, and a linked account would
    // otherwise open and close a channel it never needed.
    // eslint-disable-next-line no-restricted-properties -- a same-commit read: the partner load this waits on starts in an earlier effect of this commit, which no render value can show yet
    const now = useAppStore.getState();
    if (now.partner !== null || now.isLoadingPartner) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;

    moodSyncService
      .subscribeMoodUpdates(
        // Moods are for the screens that show them; this subscriber only waits
        // for the link.
        () => {},
        undefined,
        () => {
          if (!active) return;
          void loadPartner();
          void loadPendingRequests();
        }
      )
      .then((release) => {
        if (!active) {
          release();
          return;
        }
        unsubscribe = release;
      })
      .catch((error: unknown) => {
        console.error('[usePartnerLinkListener] Could not listen for a partner link:', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [userId, isOnline, settledUnlinked, loadPartner, loadPendingRequests]);
}
