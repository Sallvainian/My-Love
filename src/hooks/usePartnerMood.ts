/**
 * usePartnerMood Hook
 *
 * Manages partner mood data with real-time updates via Supabase Broadcast API.
 * Loads initial partner mood and subscribes to real-time updates when partner logs new moods.
 *
 * Story 5.3: Partner Mood Viewing & Transparency
 */

import { useEffect, useState } from 'react';
import { moodSyncService, type SupabaseMoodRecord } from '../api/moodSyncService';
import { logger } from '../utils/logger';

const REALTIME_LOST_ERROR = 'Real-time connection lost. Refresh to reconnect.';
const LOAD_ERROR = 'Unable to load partner mood. Please try again later.';

interface UsePartnerMoodResult {
  partnerMood: SupabaseMoodRecord | null;
  isLoading: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  error: string | null;
}

/**
 * Hook to manage partner mood with real-time updates
 *
 * @param partnerId - Partner's user ID
 * @returns Partner mood state, loading status, and connection status
 *
 * @example
 * ```typescript
 * function PartnerMoodDisplay({ partnerId }: { partnerId: string }) {
 *   const { partnerMood, isLoading } = usePartnerMood(partnerId);
 *
 *   if (isLoading) return <LoadingState />;
 *   if (!partnerMood) return <NoMoodState />;
 *
 *   return <div>Partner is feeling: {partnerMood.mood_type}</div>;
 * }
 * ```
 */
export function usePartnerMood(partnerId: string): UsePartnerMoodResult {
  const [partnerMood, setPartnerMood] = useState<SupabaseMoodRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(partnerId));
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >(partnerId ? 'connecting' : 'disconnected');

  useEffect(() => {
    if (!partnerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- state reset when partnerId clears
      setPartnerMood(null);
      setError(null);
      setIsLoading(false);
      setConnectionStatus('disconnected');
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    // Load initial partner mood
    async function loadPartnerMood() {
      try {
        setIsLoading(true);
        setError(null);
        const mood = await moodSyncService.getLatestPartnerMood(partnerId);
        if (!isMounted) return;
        setPartnerMood(mood);
        setIsLoading(false);
      } catch (err) {
        console.error('[usePartnerMood] Failed to load partner mood:', err);
        if (!isMounted) return;
        setError(LOAD_ERROR);
        setIsLoading(false);
      }
    }

    // Subscribe to partner mood updates via Broadcast
    async function subscribeToPartnerMoodUpdates() {
      try {
        setConnectionStatus('connecting');
        const unsubscribeFn = await moodSyncService.subscribePartnerEvents({
          new_mood: ({ mood: newMood }) => {
            // Only update if this mood is from our partner
            if (newMood.user_id === partnerId) {
              logger.debug('[usePartnerMood] Received partner mood update:', newMood);
              setPartnerMood(newMood);
            }
          },
          onStatus: (status) => {
            // Update connection status
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
              // Delivery is back, so the lost-connection message is stale. Only
              // that message: the load and subscribe-throw errors describe
              // something a SUBSCRIBED does not fix.
              setError((current) => (current === REALTIME_LOST_ERROR ? null : current));
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('disconnected');
              // A failed load stays the error: the mood on screen is unknown,
              // and a later SUBSCRIBED must not turn it into "no mood logged".
              setError((current) => (current === LOAD_ERROR ? current : REALTIME_LOST_ERROR));
            }
          },
        });

        if (!isMounted) {
          unsubscribeFn();
          return;
        }
        unsubscribe = unsubscribeFn;
      } catch (err) {
        console.error('[usePartnerMood] Failed to subscribe to mood updates:', err);
        if (!isMounted) return;
        setConnectionStatus('disconnected');
        setError('Unable to connect to real-time updates.');
      }
    }

    // Execute async functions
    loadPartnerMood();
    subscribeToPartnerMoodUpdates();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [partnerId]);

  return { partnerMood, isLoading, connectionStatus, error };
}
