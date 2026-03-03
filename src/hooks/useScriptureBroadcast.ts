/**
 * useScriptureBroadcast — Supabase Realtime broadcast channel lifecycle hook
 *
 * Story 4.1: AC #2, #3, #4, #5
 *
 * Manages subscription to the private broadcast channel `scripture-session:{sessionId}`.
 * This is the ONLY place in the codebase that imports supabase for Broadcast —
 * do NOT import supabase for broadcast in components or other hooks.
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

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../api/supabaseClient';
import { useAppStore } from '../stores/useAppStore';
import type { StateUpdatePayload } from '../stores/slices/scriptureReadingSlice';
import { handleScriptureError, ScriptureErrorCode } from '../services/scriptureReadingService';
import type { ScriptureError } from '../services/scriptureReadingService';
import { scheduleRetry, SCRIPTURE_RETRY_CONFIG } from './scriptureRetryUtils';

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

/** Side-effect hook: subscribes to the scripture session broadcast channel. Returns nothing. */
export function useScriptureBroadcast(sessionId: string | null): void {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Story 4.3: Retry counter — incrementing triggers useEffect re-run to re-subscribe after CHANNEL_ERROR
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    onPartnerJoined,
    onBroadcastReceived,
    applySessionConverted,
    onPartnerLockInChanged,
    loadSession,
    setBroadcastFn,
    currentUserId,
    sessionUserId,
    sessionIdFromStore,
  } = useAppStore(
    useShallow((state) => ({
      onPartnerJoined: state.onPartnerJoined,
      onBroadcastReceived: state.onBroadcastReceived,
      applySessionConverted: state.applySessionConverted,
      onPartnerLockInChanged: state.onPartnerLockInChanged,
      loadSession: state.loadSession,
      setBroadcastFn: state.setBroadcastFn,
      currentUserId: state.currentUserId,
      sessionUserId: state.session?.userId ?? null, // user1_id
      sessionIdFromStore: state.session?.id ?? null,
    }))
  );

  const identityRef = useRef<{
    currentUserId: string | null;
    sessionUserId: string | null;
    sessionIdFromStore: string | null;
  }>({
    currentUserId,
    sessionUserId,
    sessionIdFromStore,
  });

  useEffect(() => {
    identityRef.current = { currentUserId, sessionUserId, sessionIdFromStore };
  }, [currentUserId, sessionUserId, sessionIdFromStore]);

  // Story 4.3: Track whether channel has errored to know when re-subscribe succeeds
  const hasErroredRef = useRef(false);
  // Story 4.3: Guard against retry storms when CHANNEL_ERROR/CLOSED fires before removeChannel resolves
  const isRetryingRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    // Guard: prevent duplicate subscription on React StrictMode double-mount.
    // channelRef.current is null only after cleanup, non-null means a subscription exists.
    if (channelRef.current !== null) return;

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
          const { currentUserId: latestCurrentUserId, sessionUserId: latestSessionUserId } =
            identityRef.current;
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
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }
        const userId = authData.user?.id;
        if (!userId) {
          handleScriptureError({
            code: ScriptureErrorCode.UNAUTHORIZED,
            message: 'No user ID available for broadcast channel',
          });
          return;
        }

        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            // Reset retry count on successful subscription
            retryCountRef.current = 0;
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
              try {
                void channel
                  .send({ type: 'broadcast', event, payload })
                  .catch((err: unknown) => {
                    handleScriptureError({
                      code: ScriptureErrorCode.SYNC_FAILED,
                      message: 'Broadcast send failed',
                      details: err,
                    });
                  });
              } catch (err: unknown) {
                handleScriptureError({
                  code: ScriptureErrorCode.SYNC_FAILED,
                  message: 'Broadcast send threw synchronously',
                  details: err,
                });
              }
            });

            // Broadcast our own join on every successful subscription so peers
            // can clear disconnected UI after a reconnection.
            void channel
              .send({
                type: 'broadcast',
                event: 'partner_joined',
                payload: { user_id: userId },
              })
              .catch((err: unknown) => {
                handleScriptureError({
                  code: ScriptureErrorCode.SYNC_FAILED,
                  message: 'Broadcast send failed',
                  details: err,
                });
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
            // Guard: do not re-subscribe if session has ended or already retrying
            if (identityRef.current.sessionIdFromStore && !isRetryingRef.current) {
              isRetryingRef.current = true;
              void supabase
                .removeChannel(channel)
                .then(() => {
                  if (channelRef.current === channel) {
                    channelRef.current = null;
                  }
                  isRetryingRef.current = false;
                  const retried = scheduleRetry(retryCountRef, setRetryCount, retryTimerRef);
                  if (!retried) {
                    handleScriptureError({
                      code: ScriptureErrorCode.SYNC_FAILED,
                      message: `Broadcast channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
                    });
                  }
                })
                .catch((removeErr: unknown) => {
                  handleScriptureError({
                    code: ScriptureErrorCode.SYNC_FAILED,
                    message: 'Channel cleanup failed',
                    details: removeErr,
                  });
                  isRetryingRef.current = false;
                  if (channelRef.current === channel) {
                    channelRef.current = null;
                  }
                  const retried = scheduleRetry(retryCountRef, setRetryCount, retryTimerRef);
                  if (!retried) {
                    handleScriptureError({
                      code: ScriptureErrorCode.SYNC_FAILED,
                      message: `Broadcast channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
                    });
                  }
                });
            }
          } else if (status === 'CLOSED') {
            // Story 4.3: Channel closed — remove stale channel before re-subscribe
            if (identityRef.current.sessionIdFromStore && !isRetryingRef.current) {
              hasErroredRef.current = true;
              isRetryingRef.current = true;
              void supabase
                .removeChannel(channel)
                .then(() => {
                  if (channelRef.current === channel) {
                    channelRef.current = null;
                  }
                  isRetryingRef.current = false;
                  // Guard: session may have ended while removeChannel was in-flight
                  if (!identityRef.current.sessionIdFromStore) return;
                  const retried = scheduleRetry(retryCountRef, setRetryCount, retryTimerRef);
                  if (!retried) {
                    handleScriptureError({
                      code: ScriptureErrorCode.SYNC_FAILED,
                      message: `Broadcast channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
                    });
                  }
                })
                .catch((removeErr: unknown) => {
                  handleScriptureError({
                    code: ScriptureErrorCode.SYNC_FAILED,
                    message: 'Channel cleanup failed',
                    details: removeErr,
                  });
                  isRetryingRef.current = false;
                  if (channelRef.current === channel) {
                    channelRef.current = null;
                  }
                  const retried = scheduleRetry(retryCountRef, setRetryCount, retryTimerRef);
                  if (!retried) {
                    handleScriptureError({
                      code: ScriptureErrorCode.SYNC_FAILED,
                      message: `Broadcast channel: max retries (${SCRIPTURE_RETRY_CONFIG.maxRetries}) exceeded`,
                    });
                  }
                });
            }
          }
        });
      })
      .catch((err: unknown) => {
        const scriptureError: ScriptureError = {
          code: ScriptureErrorCode.SYNC_FAILED,
          message: err instanceof Error ? err.message : 'Failed to authenticate broadcast channel',
          details: err,
        };
        handleScriptureError(scriptureError);
      });

    return () => {
      // Clear broadcast function so slice actions don't try to broadcast on a dead channel
      setBroadcastFn?.(null);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current).catch(() => {
          // Swallow cleanup errors on unmount — component is already gone
        });
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
  ]);
}
