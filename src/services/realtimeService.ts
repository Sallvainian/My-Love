import { supabase } from '../api/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SupabaseMood } from '../api/validation/supabaseSchemas';

type MoodChangeCallback = (mood: SupabaseMood) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Realtime Service - Supabase Realtime subscriptions with error handling
 * Story 6.4: Foundation for partner mood visibility
 */
export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private errorCallback: ErrorCallback | null = null;

  /**
   * Subscribe to mood changes for a specific user
   * Story 6.4: AC-4 - Real-time partner mood updates
   *
   * @param userId - User ID to watch for mood changes
   * @param onMoodChange - Callback when mood is inserted/updated
   * @param onError - Optional error handler
   * @returns Channel ID for unsubscribing
   */
  subscribeMoodChanges(
    userId: string,
    onMoodChange: MoodChangeCallback,
    onError?: ErrorCallback
  ): string {
    const channelId = `moods:${userId}`;

    // Check if already subscribed
    if (this.channels.has(channelId)) {
      console.warn(`[RealtimeService] Already subscribed to ${channelId}`);
      return channelId;
    }

    try {
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'moods',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            try {
              if (import.meta.env.DEV) {
                console.log(`[RealtimeService] Mood change event:`, payload);
              }

              // Extract mood data from payload
              const mood = payload.new as SupabaseMood;

              if (mood) {
                onMoodChange(mood);
              }
            } catch (error) {
              this.handleError(error as Error, onError);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            if (import.meta.env.DEV) {
              console.log(`[RealtimeService] Subscribed to ${channelId}`);
            }
          } else if (status === 'CHANNEL_ERROR') {
            this.handleError(
              new Error(`Realtime subscription error: ${err?.message || 'Unknown'}`),
              onError
            );
          } else if (status === 'TIMED_OUT') {
            this.handleError(new Error(`Realtime subscription timed out`), onError);
          }
        });

      this.channels.set(channelId, channel);
      return channelId;
    } catch (error) {
      this.handleError(error as Error, onError);
      throw error;
    }
  }

  /**
   * Unsubscribe from mood changes
   *
   * @param channelId - Channel ID from subscribeMoodChanges()
   */
  async unsubscribe(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);

    if (!channel) {
      console.warn(`[RealtimeService] No subscription found for ${channelId}`);
      return;
    }

    try {
      await supabase.removeChannel(channel);
      this.channels.delete(channelId);

      if (import.meta.env.DEV) {
        console.log(`[RealtimeService] Unsubscribed from ${channelId}`);
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Unsubscribe from all channels (cleanup)
   */
  async unsubscribeAll(): Promise<void> {
    const channelIds = Array.from(this.channels.keys());

    for (const channelId of channelIds) {
      await this.unsubscribe(channelId);
    }
  }

  /**
   * Set global error handler
   *
   * @param callback - Global error handler for all subscriptions
   */
  setErrorHandler(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Handle errors with fallback to global handler
   */
  private handleError(error: Error, localCallback?: ErrorCallback): void {
    console.error('[RealtimeService] Error:', error);

    if (localCallback) {
      localCallback(error);
    } else if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptions(): number {
    return this.channels.size;
  }
}

// Export singleton
export const realtimeService = new RealtimeService();
