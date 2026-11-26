/**
 * useDatesChangedListener — re-read the couple's events and anniversaries the
 * moment the partner adds, edits or deletes one, on any screen.
 *
 * The partner's device sends DATES_CHANGED_EVENT on this account's own
 * `mood-updates:<id>` topic after every successful date write (moodSyncService).
 * App mounts this once. While the account is signed in, online and linked, it
 * holds one subscriber on the shared mood channel (the refcounted registry,
 * never a channel of its own); the event re-reads both lists from the server,
 * so a date the partner deleted leaves Home, the Dates list and its own page
 * (which goes back to the Dates list) without a reload.
 *
 * The broadcast is ephemeral and never replayed, so one sent while this phone
 * was in the background, closed, offline or re-joining never arrives. Two more
 * re-reads cover that: every return of the app to the front (at most once per
 * `FOREGROUND_REREAD_GAP_MS`, whenever signed in, linked or not), and every
 * SUBSCRIBED after the channel's first join (a Realtime re-join). Home and the
 * Dates list also re-read both whenever they open.
 */

import { useEffect, useRef } from 'react';
import { listenToPartnerEvents } from '../api/listenToPartnerEvents';
import { useAppStore } from '../stores/useAppStore';

/** A return to the front re-reads the dates only this long after the last such re-read. */
export const FOREGROUND_REREAD_GAP_MS = 30 * 1000;

export function useDatesChangedListener(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const hasPartner = useAppStore((state) => state.partner !== null);
  const loadEvents = useAppStore((state) => state.loadEvents);
  const loadAnniversariesFromServer = useAppStore((state) => state.loadAnniversariesFromServer);

  const listening = userId !== null && isOnline && hasPartner;
  // An account switch re-subscribes: the topic is the signed-in user's.
  const session = userId ? `${userId}:${authSessionVersion}` : null;
  const signedIn = userId !== null;
  const lastForegroundReread = useRef(0);

  // Back to the front: whatever changed while the app was away (a delete by
  // the partner whose broadcast this phone never heard) shows now.
  useEffect(() => {
    if (!signedIn) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundReread.current < FOREGROUND_REREAD_GAP_MS) return;
      lastForegroundReread.current = now;
      void loadEvents();
      void loadAnniversariesFromServer();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [signedIn, session, loadEvents, loadAnniversariesFromServer]);

  useEffect(() => {
    if (!listening) return;

    let active = true;
    let joinedOnce = false;
    const reread = () => {
      void loadEvents();
      void loadAnniversariesFromServer();
    };

    const stop = listenToPartnerEvents(
      {
        onStatus: (status) => {
          if (!active || status !== 'SUBSCRIBED') return;
          // The first join follows the start's own loads; a re-join may have
          // missed a broadcast while the channel was down.
          if (joinedOnce) reread();
          joinedOnce = true;
        },
        dates_changed: () => {
          if (active) reread();
        },
      },
      {
        failureMessage: '[useDatesChangedListener] Could not listen for date changes:',
        // A subscribe that failed first is no longer covered by the start's
        // own loads, so the join after a retry re-reads like a re-join.
        onRetry: () => {
          joinedOnce = true;
        },
      }
    );

    return () => {
      active = false;
      stop();
    };
  }, [listening, session, loadEvents, loadAnniversariesFromServer]);
}
