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
 * The broadcast is ephemeral and never replayed: one missed while the app was
 * closed or the channel re-joining is caught by the ordinary loads (Home and
 * the Dates list re-read both whenever they open).
 */

import { useEffect } from 'react';
import { moodSyncService } from '../api/moodSyncService';
import { useAppStore } from '../stores/useAppStore';

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

  useEffect(() => {
    if (!listening) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;

    moodSyncService
      .subscribeMoodUpdates(
        // Moods are for the screens that show them.
        () => {},
        undefined,
        undefined,
        () => {
          if (!active) return;
          void loadEvents();
          void loadAnniversariesFromServer();
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
        console.error('[useDatesChangedListener] Could not listen for date changes:', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [listening, session, loadEvents, loadAnniversariesFromServer]);
}
