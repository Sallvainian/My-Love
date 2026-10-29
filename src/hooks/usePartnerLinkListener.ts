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
 * holds "no partner" after its first partner load settled, it holds one
 * subscriber on the shared mood channel (the refcounted registry, never a
 * channel of its own). The event re-reads the partner and the pending requests
 * from the server; the screens that cache a partner re-take it when the store's
 * partner changes. Once a partner is in the store the subscriber is released,
 * so a linked account opens nothing here that its own screens do not.
 *
 * The broadcast is ephemeral and never replayed, so one that lands while the
 * channel is joining or re-joining is lost. Every SUBSCRIBED — the join, each
 * Realtime re-join, and the replay a subscriber gets when it attaches to an
 * already-open channel — therefore asks the server whether the account is now
 * linked, and re-reads the partner only when it is.
 */

import { useEffect, useState } from 'react';
import { moodSyncService } from '../api/moodSyncService';
import { resolvePartnerLookupForDelivery } from '../api/supabaseClient';
import { useAppStore } from '../stores/useAppStore';

/** What this account's partner loads have shown so far, latched per session. */
interface FirstLoad {
  session: string | null;
  /** A partner load has started or written an answer. */
  seen: boolean;
  /** A partner load has finished. Never lowered within a session. */
  settled: boolean;
}

export function usePartnerLinkListener(): void {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  const isOnline = useAppStore((state) => state.syncStatus.isOnline);
  const hasPartner = useAppStore((state) => state.partner !== null);
  const isLoadingPartner = useAppStore((state) => state.isLoadingPartner);
  const partnerLoadError = useAppStore((state) => state.partnerLoadError);
  const loadPartner = useAppStore((state) => state.loadPartner);
  const loadPendingRequests = useAppStore((state) => state.loadPendingRequests);

  // Wait for the first partner load, then stop watching isLoadingPartner: every
  // later load (each reconnect, each Partner-tab mount) raises it too, and
  // gating on it tore the channel down and re-joined it each time, dropping any
  // broadcast that landed in between. Before a load has even started the store
  // reads "no partner" for a linked account as well, so that is not settled
  // either. A partner or a load error is written only by a finished load.
  const session = userId ? `${userId}:${authSessionVersion}` : null;
  const [firstLoad, setFirstLoad] = useState<FirstLoad>({
    session: null,
    seen: false,
    settled: false,
  });
  const latched = firstLoad.session === session ? firstLoad : null;
  const seen = (latched?.seen ?? false) || isLoadingPartner || hasPartner || partnerLoadError;
  const settled = (latched?.settled ?? false) || (seen && !isLoadingPartner);
  if (latched?.seen !== seen || latched?.settled !== settled) {
    setFirstLoad({ session, seen, settled });
  }

  const listening = userId !== null && isOnline && settled && !hasPartner && !partnerLoadError;

  // `session` is a dependency so an account switch re-subscribes: the topic is
  // the signed-in user's, read once at subscribe.
  useEffect(() => {
    if (!listening) return;

    let active = true;
    let unsubscribe: (() => void) | null = null;

    const reloadPartner = () => {
      void loadPartner();
      void loadPendingRequests();
    };

    moodSyncService
      .subscribeMoodUpdates(
        // Moods are for the screens that show them; this subscriber only waits
        // for the link.
        () => {},
        (status) => {
          if (!active || status !== 'SUBSCRIBED') return;
          // Ask first: a loadPartner from here would run on every join of an
          // unlinked account. Only a successful "linked" answer re-reads; an
          // error is not evidence of a link. Retried, because a healthy socket
          // emits no further SUBSCRIBED to try again.
          void resolvePartnerLookupForDelivery().then((result) => {
            if (active && result.status === 'linked') reloadPartner();
          });
        },
        () => {
          if (active) reloadPartner();
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
  }, [listening, session, loadPartner, loadPendingRequests]);
}
