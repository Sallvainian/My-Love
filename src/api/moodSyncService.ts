/**
 * Mood Sync Service
 *
 * Handles synchronization of mood entries with Supabase backend.
 * Provides methods for uploading moods, subscribing to partner updates,
 * and batch syncing pending moods.
 *
 * Uses validated moodApi for all database operations to ensure data integrity.
 *
 * @module api/moodSyncService
 */

import { supabase, getPartnerId } from './supabaseClient';
import { moodApi } from './moodApi';
import type { SupabaseMood, MoodInsert } from './validation/supabaseSchemas';
import { isOnline, handleNetworkError } from './errorHandlers';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { moodService } from '../services/moodService';
import type { MoodEntry } from '../types';

/**
 * Supabase mood record type (using validated schema)
 */
export type SupabaseMoodRecord = SupabaseMood;

/**
 * Mood entry insert type (using validated schema)
 */
export type MoodEntryInsert = MoodInsert;

/**
 * Sync result summary
 */
export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Mood Sync Service Class
 *
 * Responsibilities:
 * - Upload individual mood entries to Supabase
 * - Batch sync pending moods from IndexedDB
 * - Subscribe to real-time partner mood updates
 * - Handle network errors and retry logic
 */
export class MoodSyncService {
  private realtimeChannel: RealtimeChannel | null = null;

  /**
   * Upload a single mood entry to Supabase
   *
   * Uses validated moodApi.create() to ensure data integrity.
   *
   * @param mood - MoodEntry to sync
   * @returns Validated Supabase mood record with server-generated ID and timestamps
   * @throws SupabaseServiceError on failure
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const mood: MoodEntry = {
   *   userId: getCurrentUserId(),
   *   mood: 'happy',
   *   note: 'Great day!',
   *   timestamp: new Date(),
   * };
   *
   * try {
   *   const syncedMood = await moodSyncService.syncMood(mood);
   *   console.log('Mood synced:', syncedMood.id);
   * } catch (error) {
   *   console.error('Sync failed:', error);
   * }
   * ```
   */
  async syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord> {
    // Check network status
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'MoodSyncService.syncMood');
    }

    // Transform local mood to Supabase insert format
    // Include mood_types array for multi-mood support
    const moodTypes = mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood];
    const moodInsert: MoodEntryInsert = {
      user_id: mood.userId,
      mood_type: mood.mood,
      mood_types: moodTypes,
      note: mood.note || null,
      created_at: mood.timestamp.toISOString(),
    };

    // Use validated moodApi.create() for insert with automatic validation
    const syncedMood = await moodApi.create(moodInsert);

    // Broadcast to partner after successful sync (fire-and-forget)
    const partnerId = await getPartnerId();
    if (partnerId) {
      this.broadcastMoodToPartner(syncedMood, partnerId).catch((err) => {
        console.error('[MoodSyncService] Background broadcast failed:', err);
      });
    }

    return syncedMood;
  }

  /**
   * Broadcast a mood update to partner's channel
   *
   * Uses Supabase Broadcast API (client-to-client messaging) which
   * doesn't require RLS permissions. Called after successful mood sync.
   *
   * @param mood - The synced mood record from Supabase
   * @param partnerId - Partner's user ID to broadcast to
   * @returns void - Fire-and-forget, errors are logged but not thrown
   */
  private async broadcastMoodToPartner(
    mood: SupabaseMoodRecord,
    partnerId: string
  ): Promise<void> {
    try {
      if (!isOnline()) {
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] Skipping broadcast - device is offline');
        }
        return;
      }

      // Create ephemeral channel to partner's mood-updates channel
      const channel = supabase.channel(`mood-updates:${partnerId}`);

      // Subscribe briefly to send the broadcast
      await new Promise<void>((resolve, reject) => {
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              // Send broadcast to partner (includes mood_types for multi-mood support)
              const result = await channel.send({
                type: 'broadcast',
                event: 'new_mood',
                payload: {
                  id: mood.id,
                  user_id: mood.user_id,
                  mood_type: mood.mood_type,
                  mood_types: mood.mood_types,
                  note: mood.note,
                  created_at: mood.created_at,
                },
              });

              if (import.meta.env.DEV) {
                console.log('[MoodSyncService] Broadcast sent to partner:', result);
              }
              resolve();
            } catch (sendError) {
              reject(sendError);
            } finally {
              // Always cleanup: unsubscribe and remove channel
              await supabase.removeChannel(channel);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            await supabase.removeChannel(channel);
            reject(new Error(`Channel subscription failed: ${status}`));
          }
        });
      });
    } catch (error) {
      // Fire-and-forget: log error but don't throw
      console.error('[MoodSyncService] Failed to broadcast mood to partner:', error);
    }
  }

  /**
   * Sync pending moods from IndexedDB to Supabase
   *
   * Fetches all unsynced moods from local IndexedDB and uploads them to Supabase
   * with automatic retry logic (exponential backoff: 1s, 2s, 4s, max 3 retries).
   *
   * Features:
   * - Batch sync of all pending moods
   * - Retry logic with exponential backoff (1s, 2s, 4s)
   * - Network status check before attempting sync
   * - Marks successfully synced moods in IndexedDB
   * - Returns detailed sync summary with error information
   *
   * @returns Summary of sync operation (synced count, failed count, errors)
   *
   * @example
   * ```typescript
   * const result = await moodSyncService.syncPendingMoods();
   * console.log(`Synced ${result.synced} moods, ${result.failed} failed`);
   * if (result.errors.length > 0) {
   *   console.error('Sync errors:', result.errors);
   * }
   * ```
   */
  async syncPendingMoods(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Check network status first
      if (!isOnline()) {
        const error = 'Device is offline - cannot sync moods';
        result.errors.push(error);
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] ' + error);
        }
        return result;
      }

      // Fetch all unsynced moods from IndexedDB
      const unsyncedMoods = await moodService.getUnsyncedMoods();

      if (unsyncedMoods.length === 0) {
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] No pending moods to sync');
        }
        return result;
      }

      if (import.meta.env.DEV) {
        console.log(`[MoodSyncService] Starting sync for ${unsyncedMoods.length} pending moods`);
      }

      // Sync each mood with retry logic
      for (const mood of unsyncedMoods) {
        try {
          // Attempt to sync mood with retry logic
          const syncedMood = await this.syncMoodWithRetry(mood);

          // On success: Mark mood as synced in IndexedDB
          if (mood.id) {
            await moodService.markAsSynced(mood.id, syncedMood.id);
            result.synced++;

            if (import.meta.env.DEV) {
              console.log(
                `[MoodSyncService] Synced mood ${mood.id} → Supabase ID: ${syncedMood.id}`
              );
            }
          }
        } catch (error) {
          // On failure: Log error and continue with next mood
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Mood ${mood.id || 'unknown'}: ${errorMessage}`);

          if (import.meta.env.DEV) {
            console.error(`[MoodSyncService] Failed to sync mood ${mood.id}:`, error);
          }
        }
      }

      if (import.meta.env.DEV) {
        console.log(
          `[MoodSyncService] Sync complete: ${result.synced} synced, ${result.failed} failed`
        );
      }

      return result;
    } catch (error) {
      // Catch-all for unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Unexpected error during sync: ${errorMessage}`);
      console.error('[MoodSyncService] Unexpected error in syncPendingMoods:', error);
      return result;
    }
  }

  /**
   * Sync a single mood with exponential backoff retry logic
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: 1 second delay
   * - Attempt 3: 2 seconds delay
   * - Attempt 4: 4 seconds delay
   * - Max: 3 retries (4 total attempts)
   *
   * @param mood - MoodEntry to sync
   * @returns Validated Supabase mood record
   * @throws Error if all retry attempts fail
   * @private
   */
  private async syncMoodWithRetry(mood: MoodEntry): Promise<SupabaseMoodRecord> {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s in milliseconds
    let lastError: Error;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Check network status before each attempt
        if (!isOnline()) {
          throw handleNetworkError(
            new Error('Device is offline'),
            'MoodSyncService.syncMoodWithRetry'
          );
        }

        // Attempt sync
        const syncedMood = await this.syncMood(mood);
        return syncedMood; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was the last retry, throw the error
        if (attempt === MAX_RETRIES) {
          if (import.meta.env.DEV) {
            console.error(
              `[MoodSyncService] All ${MAX_RETRIES + 1} sync attempts failed for mood ${mood.id}`
            );
          }
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        const delay = RETRY_DELAYS[attempt];
        if (import.meta.env.DEV) {
          console.warn(
            `[MoodSyncService] Sync attempt ${attempt + 1} failed for mood ${mood.id}, retrying in ${delay}ms...`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError!;
  }

  /**
   * Subscribe to real-time partner mood updates via Broadcast API
   *
   * Listens for broadcast events on the current user's mood-updates channel.
   * Partner sends broadcasts to this channel when they log new moods.
   *
   * NOTE: This uses Broadcast API instead of postgres_changes because
   * RLS policies on moods table prevent postgres_changes from working
   * (complex subquery for partner lookup cannot be evaluated by Realtime).
   *
   * @param callback - Function called with new mood record
   * @param onStatusChange - Optional callback for connection status changes
   * @returns Promise that resolves to unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = await moodSyncService.subscribeMoodUpdates(
   *   (mood) => {
   *     console.log('Partner logged mood:', mood.mood_type);
   *   },
   *   (status) => {
   *     console.log('Connection status:', status);
   *   }
   * );
   *
   * // Later, when component unmounts:
   * unsubscribe();
   * ```
   */
  async subscribeMoodUpdates(
    callback: (mood: SupabaseMoodRecord) => void,
    onStatusChange?: (status: string) => void
  ): Promise<() => void> {
    // Get current user ID - we subscribe to OUR OWN channel
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      console.error('[MoodSyncService] Cannot subscribe: User not authenticated');
      return () => {};
    }

    if (import.meta.env.DEV) {
      console.log(`[MoodSyncService] Subscribing to mood-updates:${currentUserId}`);
    }

    // Create Broadcast channel for receiving mood updates
    // Each user subscribes to their OWN channel; partner broadcasts TO this channel
    this.realtimeChannel = supabase
      .channel(`mood-updates:${currentUserId}`, {
        config: {
          broadcast: { self: false }, // Don't receive own broadcasts
        },
      })
      .on('broadcast', { event: 'new_mood' }, (payload) => {
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] Received partner mood broadcast:', payload);
        }

        // Transform broadcast payload to SupabaseMoodRecord format
        const mood: SupabaseMoodRecord = {
          id: payload.payload.id,
          user_id: payload.payload.user_id,
          mood_type: payload.payload.mood_type,
          note: payload.payload.note,
          created_at: payload.payload.created_at,
          updated_at: payload.payload.created_at, // Use created_at as fallback
        };

        callback(mood);
      })
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] Broadcast subscription status:', status);
        }
        if (onStatusChange) {
          onStatusChange(status);
        }
      });

    // Return unsubscribe function
    return () => {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
        if (import.meta.env.DEV) {
          console.log('[MoodSyncService] Unsubscribed from mood broadcasts');
        }
      }
    };
  }

  /**
   * Fetch recent moods for a user (current user or partner)
   *
   * Uses validated moodApi.fetchByUser() to ensure data integrity.
   *
   * @param userId - User ID to fetch moods for
   * @param limit - Maximum number of moods to fetch (default: 50)
   * @returns Validated array of mood records, sorted by created_at descending
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const moods = await moodSyncService.fetchMoods(partnerId, 10);
   * console.log('Partner last 10 moods:', moods);
   * ```
   */
  async fetchMoods(userId: string, limit: number = 50): Promise<SupabaseMoodRecord[]> {
    // Use validated moodApi.fetchByUser() for query with automatic validation
    return await moodApi.fetchByUser(userId, limit);
  }

  /**
   * Fetch the most recent mood for a specific user (typically partner)
   *
   * Used for displaying partner's current emotional state.
   *
   * @param userId - User ID to fetch mood for (partner ID)
   * @returns Latest mood record or null if user has no moods logged
   * @throws ApiValidationError if response validation fails
   *
   * @example
   * ```typescript
   * const latestMood = await moodSyncService.getLatestPartnerMood(partnerId);
   * if (latestMood) {
   *   console.log('Partner is feeling:', latestMood.mood_type);
   * }
   * ```
   */
  async getLatestPartnerMood(userId: string): Promise<SupabaseMoodRecord | null> {
    try {
      const moods = await this.fetchMoods(userId, 1);
      return moods.length > 0 ? moods[0] : null;
    } catch (error) {
      console.error('[MoodSyncService] Failed to fetch latest partner mood:', error);
      return null; // Graceful degradation for read operations
    }
  }
}

/**
 * Singleton instance of MoodSyncService
 * Use this instance throughout the app for mood synchronization
 */
export const moodSyncService = new MoodSyncService();

export default moodSyncService;
