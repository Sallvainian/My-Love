/**
 * useRealtimeMessages Hook
 *
 * Handles real-time message reception via Supabase Broadcast API.
 * Story 2.3 - AC-2.3.1 through AC-2.3.5
 *
 * Uses Broadcast API instead of postgres_changes per commit 9a02e56 findings:
 * - postgres_changes doesn't work reliably for cross-user updates
 * - Broadcast API provides consistent cross-user messaging
 *
 * The channel is PRIVATE. `love-notes:<uuid>` used to be a public topic, so
 * anyone holding the project's anon key could join a stranger's topic and both
 * read their notes and publish forged ones. Joining is now authorized by the
 * SELECT policy `couple_broadcast_recipient_can_receive` on
 * `realtime.messages` — receive only on your own topic — which requires
 * `supabase.realtime.setAuth()` to have run before `subscribe()`. There is
 * deliberately no public fallback when a private join is denied.
 *
 * Authorization at the transport is only half of it: RLS says who may send, not
 * what they may send, and it is evaluated at join and cached until the JWT
 * refreshes. So every payload is also parsed and identity-checked by
 * `parseLoveNoteBroadcast` before it reaches the store — which is what strips a
 * forged `imagePreviewUrl` off the wire.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef } from 'react';
import { getPartnerId, supabase } from '../api/supabaseClient';
import { parseLoveNoteBroadcast } from '../api/validation/broadcastSchemas';
import { useAppStore } from '../stores/useAppStore';
import type { LoveNote } from '../types/models';
import { logger } from '../utils/logger';

interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean;
}

// Retry configuration for subscription failures
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds max
};

/** Pull the `message` field out of a broadcast body without trusting its shape. */
function unwrapMessage(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return undefined;
  return (raw as { message?: unknown }).message;
}

export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { onNewMessage, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Who this subscription will accept notes from, resolved before the join and
   * refreshed on every `SUBSCRIBED`. Held in a ref rather than state so that
   * refreshing it does not re-render the chat or re-run the effect.
   */
  const partnerIdRef = useRef<string | null>(null);
  const addNote = useAppStore((state) => state.addNote);
  const userId = useAppStore((state) => state.userId);

  const handleNewMessage = useCallback(
    (raw: unknown, currentUserId: string) => {
      // Parsed, not destructured. The wire carries only server columns after
      // this: every client-only LoveNote field is stripped, `imagePreviewUrl`
      // above all, because LoveNoteMessage prefers it over the signed Storage
      // URL and a forged one would make this browser fetch an attacker host.
      const message = parseLoveNoteBroadcast(unwrapMessage(raw), {
        currentUserId,
        partnerId: partnerIdRef.current,
      });

      if (!message) {
        logger.debug('[useRealtimeMessages] Dropped an unauthorized or malformed broadcast');
        return;
      }

      logger.debug('[useRealtimeMessages] New message received:', message.id);

      // Add to store (with deduplication check in addNote)
      addNote(message);

      // Trigger vibration feedback (AC-2.3.3)
      if (navigator.vibrate) {
        navigator.vibrate([30]);
      }

      // Call optional callback
      onNewMessage?.(message);
    },
    [addNote, onNewMessage]
  );

  useEffect(() => {
    if (!enabled || !userId) return;

    let subscriptionActive = true;
    // Set when this effect run is superseded or unmounted, so the async
    // partner lookup and setAuth below do not go on to subscribe a channel this
    // run no longer owns. supabase.channel() dedupes by topic, so a superseded
    // run and its replacement share one object, and letting both call
    // subscribe() sends duplicate phx_join frames — the same guard
    // useScriptureBroadcast carries.
    let cancelled = false;

    // The signed-in user is captured here, for the life of this effect run.
    // A different account re-runs the effect with a different topic, and this
    // run's handlers are already inert by then.
    const currentUserId = userId;

    // Never carry the previous run's partner over; until it resolves, every
    // broadcast is dropped rather than trusted.
    partnerIdRef.current = null;

    logger.info('[useRealtimeMessages] Setting up Broadcast subscription for:', currentUserId);

    const refreshPartnerSnapshot = () => {
      // Cleared BEFORE the await, not after it. A refresh runs on every
      // SUBSCRIBED, and a re-join after a disconnect is precisely when the
      // relationship may have changed — so holding the pre-disconnect partner
      // for the length of the round-trip would check the first notes off the
      // rejoined channel against the relationship this refresh exists to
      // replace. Dropping them for that window is the safe direction.
      partnerIdRef.current = null;

      void getPartnerId().then((partnerId) => {
        if (cancelled) return;
        partnerIdRef.current = partnerId;
      });
    };

    // Create user-specific channel for receiving messages
    const channel = supabase
      .channel(`love-notes:${currentUserId}`, {
        config: { private: true },
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        if (!subscriptionActive) return;
        handleNewMessage((payload as { payload?: unknown })?.payload, currentUserId);
      });

    channelRef.current = channel;

    const handleStatus = (status: string, err?: Error) => {
      logger.info('[useRealtimeMessages] Subscription status:', status, err || '');

      // Reset retry count on successful subscription
      if (status === 'SUBSCRIBED') {
        retryCountRef.current = 0;
        // A join is also a re-join. The relationship may have changed while the
        // channel was down, so re-take the snapshot rather than trusting the
        // one from the original join.
        refreshPartnerSnapshot();
        return;
      }

      // Handle subscription errors with exponential backoff (AC-2.3.5)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('[useRealtimeMessages] Subscription error:', err);

        // Check if max retries exceeded
        if (retryCountRef.current >= RETRY_CONFIG.maxRetries) {
          console.error(
            `[useRealtimeMessages] Max retries (${RETRY_CONFIG.maxRetries}) exceeded. Giving up.`
          );
          return;
        }

        // Calculate delay with exponential backoff: baseDelay * 2^retryCount
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, retryCountRef.current),
          RETRY_CONFIG.maxDelay
        );

        retryCountRef.current++;

        logger.debug(
          `[useRealtimeMessages] Retry attempt ${retryCountRef.current}/${RETRY_CONFIG.maxRetries} in ${delay}ms`
        );

        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        // Schedule retry with exponential backoff. The delays are unchanged;
        // what is new is the setAuth() ahead of the re-subscribe.
        //
        // A retry is a re-join, and a private join is authorized against the
        // token on the socket. Re-installing it first is the same contract the
        // first subscribe follows, and without it a retry that was scheduled
        // because the token had gone stale would re-join with the stale token
        // and be denied again — five times, and then give up.
        retryTimeoutRef.current = setTimeout(() => {
          if (!subscriptionActive || !channelRef.current) return;
          void supabase.realtime.setAuth().then(() => {
            if (!subscriptionActive || !channelRef.current) return;
            // `handleStatus` again, not a bare subscribe(). RealtimeChannel wires
            // the callback it is HANDED into _onError/_onClose and the joinPush
            // receives; a retry that passes none reports nothing, so neither the
            // retry-count reset nor the partner refresh below ever runs again and
            // the rejoined channel keeps checking notes against the snapshot from
            // the original join.
            channelRef.current.subscribe(handleStatus);
          });
        }, delay);
      }
    };

    void (async () => {
      // Snapshot the partner BEFORE the join, so the very first broadcast is
      // already checked against a known sender.
      const partnerId = await getPartnerId();
      if (cancelled) return;
      partnerIdRef.current = partnerId;

      // Required for a private channel: Realtime authorizes the join against
      // the socket's access token, which is the anon key until this runs.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel.subscribe(handleStatus);
    })();

    return () => {
      cancelled = true;
      subscriptionActive = false;
      partnerIdRef.current = null;

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (channelRef.current) {
        logger.debug('[useRealtimeMessages] Unsubscribing from channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Reset retry count on cleanup
      retryCountRef.current = 0;
    };
  }, [enabled, userId, handleNewMessage]);

  // Return empty object - subscription status can be checked via side effects
  // Note: Accessing refs during render is not recommended
  return {};
}
