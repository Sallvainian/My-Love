/**
 * usePartnerMood Hook
 *
 * Manages partner mood data with real-time updates via Supabase Broadcast API.
 * Loads initial partner mood and subscribes to real-time updates when partner logs new moods.
 *
 * Story 5.3: Partner Mood Viewing & Transparency
 */

import { useState, useEffect } from 'react';
import { moodSyncService, type SupabaseMoodRecord } from '../api/moodSyncService';

export interface UsePartnerMoodResult {
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
      return;
    }

    let unsubscribe: (() => void) | null = null;

    // Load initial partner mood
    async function loadPartnerMood() {
      try {
        setIsLoading(true);
        setError(null);
        const mood = await moodSyncService.getLatestPartnerMood(partnerId);
        setPartnerMood(mood);
        setIsLoading(false);
      } catch (err) {
        console.error('[usePartnerMood] Failed to load partner mood:', err);
        setError('Unable to load partner mood. Please try again later.');
        setIsLoading(false);
      }
    }

    // Subscribe to partner mood updates via Broadcast
    async function subscribeToPartnerMoodUpdates() {
      try {
        setConnectionStatus('connecting');
        unsubscribe = await moodSyncService.subscribeMoodUpdates(
          (newMood) => {
            // Only update if this mood is from our partner
            if (newMood.user_id === partnerId) {
              if (import.meta.env.DEV) {
                console.log('[usePartnerMood] Received partner mood update:', newMood);
              }
              setPartnerMood(newMood);
            }
          },
          (status) => {
            // Update connection status
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('connected');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setConnectionStatus('disconnected');
              setError('Real-time connection lost. Refresh to reconnect.');
            }
          }
        );
      } catch (err) {
        console.error('[usePartnerMood] Failed to subscribe to mood updates:', err);
        setConnectionStatus('disconnected');
        setError('Unable to connect to real-time updates.');
      }
    }

    // Execute async functions
    loadPartnerMood();
    subscribeToPartnerMoodUpdates();

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [partnerId]);

  return { partnerMood, isLoading, connectionStatus, error };
}
