/**
 * useScriptureBroadcast — Supabase Realtime broadcast channel lifecycle hook
 *
 * Story 4.1: AC #2, #3, #4, #5
 *
 * Manages subscription to the private broadcast channel `scripture-session:{sessionId}`.
 * This hook calls `supabase.channel()` directly instead of going through the shared
 * managers (`moodSyncService`'s refcounted registry, `sendEphemeralBroadcast()`), so it
 * carries its own retry state and does not wait on `waitForSocketReady()`. Prefer those
 * managers for new Realtime work; see also `useScripturePresence` and `interactionService`,
 * which are on the same unmigrated path.
 *
 * Event flow:
 *   partner_joined        → onPartnerJoined() slice action
 *   state_updated         → onBroadcastReceived(payload) slice action
 *   session_converted     → applySessionConverted() slice action (local state only, no RPC)
 *   lock_in_status_changed → onPartnerLockInChanged(locked) slice action
 *
 * Cleanup: supabase.removeChannel(channel) on sessionId change or unmount.
 * Duplicate subscribe guard: checks channelRef.current?.state === 'subscribed'
 * to handle React StrictMode double-mount.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../api/supabaseClient';
import type { ScriptureError } from '../services/scriptureReadingService';
import { handleScriptureError, ScriptureErrorCode } from '../services/scriptureReadingService';
import type { StateUpdatePayload } from '../stores/slices/scriptureReadingSlice';
import { useAppStore } from '../stores/useAppStore';

interface PartnerJoinedPayload {
  user_id: string;
}

interface SessionConvertedPayload {
  mode: 'solo';
  sessionId: string;
}

// Story 4.2: Lock-in status broadcast payload
interface LockInStatusChangedPayload {
  step_index: number;
  user1_locked: boolean;
  user2_locked: boolean;
}

const MAX_BROADCAST_RETRIES = 5;

/** Side-effect hook: subscribes to the scripture session broadcast channel. Returns nothing. */
export function useScriptureBroadcast(sessionId: string | null): void {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Story 4.3: Retry counter — incrementing triggers useEffect re-run to re-subscribe after CHANNEL_ERROR
  const [retryCount, setRetryCount] = useState(0);

  const {
    onPartnerJoined,
    onBroadcastReceived,
    applySessionConverted,
    onPartnerLockInChanged,
    loadSession,
    setBroadcastFn,
    setPartnerDisconnected,
    currentUserId,
    sessionUserId,
    sessionIdFromStore,
    sessionStepIndex,
  } = useAppStore(
    useShallow((state) => ({
      onPartnerJoined: state.onPartnerJoined,
      onBroadcastReceived: state.onBroadcastReceived,
      applySessionConverted: state.applySessionConverted,
      onPartnerLockInChanged: state.onPartnerLockInChanged,
      loadSession: state.loadSession,
      setBroadcastFn: state.setBroadcastFn,
      setPartnerDisconnected: state.setPartnerDisconnected,
      currentUserId: state.userId,
      sessionUserId: state.session?.userId ?? null, // user1_id
      sessionIdFromStore: state.session?.id ?? null,
      sessionStepIndex: state.session?.currentStepIndex ?? null,
    }))
  );

  const identityRef = useRef<{
    currentUserId: string | null;
    sessionUserId: string | null;
    sessionIdFromStore: string | null;
    sessionStepIndex: number | null;
  }>({
    currentUserId,
    sessionUserId,
    sessionIdFromStore,
    sessionStepIndex,
  });

  useEffect(() => {
    identityRef.current = { currentUserId, sessionUserId, sessionIdFromStore, sessionStepIndex };
  }, [currentUserId, sessionUserId, sessionIdFromStore, sessionStepIndex]);

  // Story 4.3: Track whether channel has errored to know when re-subscribe succeeds
  const hasErroredRef = useRef(false);
  // Story 4.3: Guard against retry storms when CHANNEL_ERROR/CLOSED fires before removeChannel resolves
  const isRetryingRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    // Guard: prevent duplicate subscription on React StrictMode double-mount.
    // channelRef.current is null only after cleanup, non-null means a subscription exists.
    if (channelRef.current !== null) return;

    // Set when this effect run is superseded (re-run) or unmounted, so the async
    // setAuth/getUser below does not go on to subscribe a channel this run no
    // longer owns. See the note at the `cancelled` check.
    let cancelled = false;

    const channelName = `scripture-session:${sessionId}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        private: true,
      },
    });

    channel
      .on(
        'broadcast',
        { event: 'partner_joined' },
        (_payload: { payload: PartnerJoinedPayload }) => {
          onPartnerJoined();
        }
      )
      .on('broadcast', { event: 'state_updated' }, (msg: { payload: StateUpdatePayload }) => {
        onBroadcastReceived(msg.payload);
      })
      .on(
        'broadcast',
        { event: 'session_converted' },
        (_msg: { payload: SessionConvertedPayload }) => {
          // Apply local state transition only — do NOT call convertToSolo() RPC.
          // The broadcasting partner already nulled user2_id; re-invoking the RPC
          // would throw "Session not found or access denied" for the removed partner.
          applySessionConverted();
        }
      )
      .on(
        'broadcast',
        { event: 'lock_in_status_changed' },
        (msg: { payload: LockInStatusChangedPayload }) => {
          // Story 4.2: Determine which lock field represents the partner
          const {
            currentUserId: latestCurrentUserId,
            sessionUserId: latestSessionUserId,
            sessionStepIndex: liveStepIndex,
          } = identityRef.current;

          // Drop superseded locks: a lock broadcast for a step we have already left
          // would show a false "partner is ready" on the new verse.
          if (liveStepIndex === null || msg.payload.step_index !== liveStepIndex) return;

          const isUser1 =
            latestCurrentUserId !== null && latestCurrentUserId === latestSessionUserId;
          const partnerLocked = isUser1 ? msg.payload.user2_locked : msg.payload.user1_locked;
          onPartnerLockInChanged(partnerLocked);
        }
      );

    channelRef.current = channel;

    // Set auth before subscribing (required for private channels).
    // Fetch the current user's ID here so the partner_joined payload satisfies the event contract.
    void supabase.realtime
      .setAuth()
      .then(async () => {
        // Use supabase.auth.getUser() instead of get().userId because the Realtime
        // setAuth() handshake requires a fresh token/session, not just the cached user ID.
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }

        // Same hazard as useScripturePresence: supabase.channel() dedupes by topic,
        // so a superseded run and its replacement share one channel object. Letting
        // both call subscribe() sends duplicate phx_join frames, which the server
        // answers with phx_close, and the channel then loops rejoining. This hook is
        // not currently observed to hit it, but the shape is identical.
        if (cancelled) return;

        const userId = authData.user?.id ?? '';

        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Story 4.3: If this is a re-subscribe after error, resync state
            if (hasErroredRef.current) {
              hasErroredRef.current = false;
              const sid = identityRef.current.sessionIdFromStore;
              if (sid) {
                loadSession(sid);
              }
            }

            // Wire broadcast function so Zustand slice actions can broadcast
            // via channel.send() after RPC success (client-side broadcast).
            setBroadcastFn?.((event, payload) => {
              void channel.send({ type: 'broadcast', event, payload });
            });

            // Broadcast our own join on every successful subscription so peers
            // can clear disconnected UI after a reconnection.
            void channel.send({
              type: 'broadcast',
              event: 'partner_joined',
              payload: { user_id: userId },
            });
          } else if (status === 'CHANNEL_ERROR') {
            const scriptureError: ScriptureError = {
              code: ScriptureErrorCode.SYNC_FAILED,
              message: `Broadcast channel subscription error`,
              details: err,
            };
            handleScriptureError(scriptureError);

            // Story 4.3: Mark as errored and attempt re-subscribe
            hasErroredRef.current = true;
            // Guard: do not re-subscribe if session has ended, already retrying, or max retries reached
            if (
              identityRef.current.sessionIdFromStore &&
              !isRetryingRef.current &&
              retryCount < MAX_BROADCAST_RETRIES
            ) {
              isRetryingRef.current = true;
              void supabase.removeChannel(channel).then(() => {
                if (channelRef.current === channel) {
                  channelRef.current = null;
                }
                isRetryingRef.current = false;
                // Increment retry counter to trigger useEffect re-run → new channel subscription
                setRetryCount((c) => c + 1);
              });
            }
          } else if (status === 'CLOSED') {
            // Story 4.3: Channel closed — remove stale channel before re-subscribe
            if (
              identityRef.current.sessionIdFromStore &&
              !isRetryingRef.current &&
              retryCount < MAX_BROADCAST_RETRIES
            ) {
              hasErroredRef.current = true;
              isRetryingRef.current = true;
              void supabase.removeChannel(channel).then(() => {
                if (channelRef.current === channel) {
                  channelRef.current = null;
                }
                isRetryingRef.current = false;
                // Increment retry counter to trigger useEffect re-run → new channel subscription
                setRetryCount((c) => c + 1);
              });
            }
          }
        });
      })
      .catch((err: unknown) => {
        // Superseded run: cleanup already tore this channel down, and the ref
        // clearing below would otherwise clobber the live run's channel.
        if (cancelled) return;

        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SYNC_FAILED,
          message: err instanceof Error ? err.message : 'Failed to authenticate broadcast channel',
          details: err,
        };
        handleScriptureError(scriptureError);
        // Reset partner connection state on auth failure — channel is unusable
        setPartnerDisconnected(true);
        // Clean up dead channel so future effect re-runs can re-subscribe
        if (channelRef.current) {
          void supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      });

    return () => {
      cancelled = true;
      // Clear broadcast function so slice actions don't try to broadcast on a dead channel
      setBroadcastFn?.(null);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    sessionId,
    retryCount,
    onPartnerJoined,
    onBroadcastReceived,
    applySessionConverted,
    onPartnerLockInChanged,
    loadSession,
    setBroadcastFn,
    setPartnerDisconnected,
  ]);
}
