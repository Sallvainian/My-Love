/**
 * useRealtimeMessages Hook
 *
 * Handles real-time message reception via Supabase Broadcast API.
 * Story 2.3 - AC-2.3.1 through AC-2.3.5
 * Story TD-1.0.5 - Subscription Observability Infrastructure
 *
 * Uses Broadcast API instead of postgres_changes per commit 9a02e56 findings:
 * - postgres_changes doesn't work reliably for cross-user updates
 * - Broadcast API provides consistent cross-user messaging
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { supabase } from '../api/supabaseClient';
import { authService } from '../api/authService';
import { useSubscriptionHealth, type SubscriptionHealth, type SubscriptionHealthWithNotify } from './useSubscriptionHealth';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LoveNote } from '../types/models';

export interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean;
}

export interface UseRealtimeMessagesResult {
  /** Subscription health information for observability (TD-1.0.5) */
  subscriptionHealth: SubscriptionHealth;
}

// Retry configuration for subscription failures
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds max
};

export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}): UseRealtimeMessagesResult {
  const { onNewMessage, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addNote = useAppStore((state) => state.addNote);

  // TD-1.0.5: Track subscription health for observability
  // Pass null since we don't need the channel ref at render time - status updates come via notifyStatusChange
  const subscriptionHealth = useSubscriptionHealth(null) as SubscriptionHealthWithNotify;

  // Store notifyStatusChange in a ref to avoid dependency issues in useEffect
  // eslint-disable-next-line react-hooks/refs -- Initial value from hook is intentional
  const notifyStatusChangeRef = useRef(subscriptionHealth.notifyStatusChange);
  // Update ref in effect to avoid lint warning about ref assignment during render
  useEffect(() => {
    notifyStatusChangeRef.current = subscriptionHealth.notifyStatusChange;
  }, [subscriptionHealth.notifyStatusChange]);

  const handleNewMessage = useCallback(
    (payload: { type: string; event: string; payload: { message: LoveNote } }) => {
      const { message } = payload.payload;

      if (import.meta.env.DEV) {
        console.log('[useRealtimeMessages] New message received:', message.id);
      }

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
    if (!enabled) return;

    let subscriptionActive = true;

    const setupSubscription = async () => {
      try {
        const userId = await authService.getCurrentUserId();
        if (!userId) {
          if (import.meta.env.DEV) {
            console.log('[useRealtimeMessages] No user ID, skipping subscription');
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[useRealtimeMessages] Setting up Broadcast subscription for:', userId);
        }

        // Create user-specific channel for receiving messages
        const channel = supabase
          .channel(`love-notes:${userId}`)
          .on('broadcast', { event: 'new_message' }, (payload) => {
            if (!subscriptionActive) return;
            handleNewMessage(payload as unknown as { type: string; event: string; payload: { message: LoveNote } });
          })
          .subscribe((status, err) => {
            if (import.meta.env.DEV) {
              console.log('[useRealtimeMessages] Subscription status:', status, err || '');
            }

            // TD-1.0.5: Notify subscription health of status changes
            notifyStatusChangeRef.current(status);

            // Reset retry count on successful subscription
            if (status === 'SUBSCRIBED') {
              retryCountRef.current = 0;
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

              if (import.meta.env.DEV) {
                console.log(
                  `[useRealtimeMessages] Retry attempt ${retryCountRef.current}/${RETRY_CONFIG.maxRetries} in ${delay}ms`
                );
              }

              // Clear any existing retry timeout
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }

              // Schedule retry with exponential backoff
              retryTimeoutRef.current = setTimeout(() => {
                if (subscriptionActive && channelRef.current) {
                  channelRef.current.subscribe();
                }
              }, delay);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        console.error('[useRealtimeMessages] Error setting up subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      subscriptionActive = false;

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (channelRef.current) {
        if (import.meta.env.DEV) {
          console.log('[useRealtimeMessages] Unsubscribing from channel');
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Reset retry count on cleanup
      retryCountRef.current = 0;
    };
  }, [enabled, handleNewMessage]);

  // TD-1.0.5: Return subscription health for observability
  // Expose health state for E2E testing (development/test/playwright mode)
  // Use VITE_E2E_TESTING env var or DEV mode
  useEffect(() => {
    const isE2ETesting = import.meta.env.VITE_E2E_TESTING === 'true';
    const isDevOrTest = import.meta.env.DEV || import.meta.env.MODE === 'test';

    if (isDevOrTest || isE2ETesting) {
      (window as unknown as { __subscriptionHealth?: SubscriptionHealth }).__subscriptionHealth = subscriptionHealth;
    }

    return () => {
      if (isDevOrTest || isE2ETesting) {
        delete (window as unknown as { __subscriptionHealth?: SubscriptionHealth }).__subscriptionHealth;
      }
    };
  }, [subscriptionHealth]);

  // E2E Testing: Listen for test events to simulate real-time message reception
  // This allows E2E tests to trigger message arrival without actual WebSocket connection
  useEffect(() => {
    const isE2ETesting = import.meta.env.VITE_E2E_TESTING === 'true';
    const isDevOrTest = import.meta.env.DEV || import.meta.env.MODE === 'test';

    if (!isDevOrTest && !isE2ETesting) return;

    const handleTestNewMessage = (event: CustomEvent<{ type: string; new: LoveNote; old: null }>) => {
      const { new: message } = event.detail;

      if (import.meta.env.DEV) {
        console.log('[useRealtimeMessages] E2E test message received:', message.id);
      }

      // Add to store (with deduplication check in addNote)
      addNote(message);

      // Trigger vibration feedback (AC-2.3.3)
      if (navigator.vibrate) {
        navigator.vibrate([30]);
      }

      // Call optional callback
      onNewMessage?.(message);
    };

    window.addEventListener('__test_new_message', handleTestNewMessage as EventListener);

    return () => {
      window.removeEventListener('__test_new_message', handleTestNewMessage as EventListener);
    };
  }, [addNote, onNewMessage]);

  return { subscriptionHealth };
}

export default useRealtimeMessages;
