/**
 * Sync Service - Offline-First Sync for Mood Entries
 * Story 6.4: Background Sync Implementation
 *
 * Provides sync operations to upload unsynced mood entries from IndexedDB to Supabase.
 * Implements partial failure handling - continues syncing even if some entries fail.
 *
 * @module services/syncService
 */

import { moodService } from './moodService';
import { moodApi } from '../api/moodApi';
import type { MoodEntry } from '../types';
import type { MoodInsert } from '../api/validation/supabaseSchemas';

/**
 * Sync result for a single mood entry
 */
export interface MoodSyncResult {
  localId: number;
  success: boolean;
  supabaseId?: string;
  error?: string;
}

/**
 * Summary of sync operation results
 */
export interface SyncSummary {
  total: number;
  successful: number;
  failed: number;
  results: MoodSyncResult[];
}

/**
 * Sync Service Class
 *
 * Handles synchronization of mood entries from IndexedDB to Supabase.
 * Implements offline-first pattern with graceful error handling.
 */
export class SyncService {
  /**
   * Transform IndexedDB MoodEntry to Supabase MoodInsert format
   *
   * @param mood - Local mood entry from IndexedDB
   * @returns Supabase-compatible mood insert object
   */
  private transformMoodForSupabase(mood: MoodEntry): MoodInsert {
    return {
      user_id: mood.userId,
      mood_type: mood.mood,
      note: mood.note || null,
      created_at: mood.timestamp.toISOString(),
    };
  }

  /**
   * Sync a single mood entry to Supabase
   *
   * @param mood - Local mood entry to sync
   * @returns Sync result with success status and details
   */
  private async syncSingleMood(mood: MoodEntry): Promise<MoodSyncResult> {
    if (!mood.id) {
      return {
        localId: -1,
        success: false,
        error: 'Mood entry missing local ID',
      };
    }

    try {
      // Transform to Supabase format
      const supabaseMood = this.transformMoodForSupabase(mood);

      // Upload to Supabase
      const created = await moodApi.create(supabaseMood);

      // Mark as synced in IndexedDB
      await moodService.markAsSynced(mood.id, created.id);

      if (import.meta.env.DEV) {
        console.log(`[SyncService] Successfully synced mood ${mood.id} → ${created.id}`);
      }

      return {
        localId: mood.id,
        success: true,
        supabaseId: created.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[SyncService] Failed to sync mood ${mood.id}:`, errorMessage);

      return {
        localId: mood.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Sync all pending (unsynced) mood entries to Supabase
   *
   * Strategy:
   * - Get all unsynced moods from IndexedDB
   * - Attempt to upload each to Supabase
   * - Mark successfully synced moods in IndexedDB
   * - Continue syncing even if some entries fail (partial failure handling)
   * - Return detailed sync results
   *
   * Error Handling:
   * - Network errors: Individual mood sync fails, but continues with others
   * - Validation errors: Individual mood sync fails, but continues with others
   * - Database errors: Individual mood sync fails, but continues with others
   *
   * @returns Sync summary with counts and detailed results
   *
   * @example
   * ```typescript
   * const summary = await syncService.syncPendingMoods();
   * console.log(`Synced ${summary.successful}/${summary.total} moods`);
   *
   * if (summary.failed > 0) {
   *   console.error('Failed moods:', summary.results.filter(r => !r.success));
   * }
   * ```
   */
  async syncPendingMoods(): Promise<SyncSummary> {
    try {
      // Get all unsynced moods from IndexedDB
      const unsyncedMoods = await moodService.getUnsyncedMoods();

      if (import.meta.env.DEV) {
        console.log(`[SyncService] Starting sync for ${unsyncedMoods.length} unsynced moods`);
      }

      // No moods to sync
      if (unsyncedMoods.length === 0) {
        return {
          total: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      // Sync each mood individually (partial failure handling)
      const results = await Promise.all(unsyncedMoods.map((mood) => this.syncSingleMood(mood)));

      // Calculate summary
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      const summary: SyncSummary = {
        total: unsyncedMoods.length,
        successful,
        failed,
        results,
      };

      if (import.meta.env.DEV) {
        console.log(
          `[SyncService] Sync complete: ${successful}/${unsyncedMoods.length} successful, ${failed} failed`
        );
      }

      return summary;
    } catch (error) {
      console.error('[SyncService] Critical error during sync:', error);

      // Critical error - return empty summary
      return {
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      };
    }
  }

  /**
   * Check if there are any unsynced moods
   *
   * @returns True if there are moods pending sync
   */
  async hasPendingSync(): Promise<boolean> {
    try {
      const unsyncedMoods = await moodService.getUnsyncedMoods();
      return unsyncedMoods.length > 0;
    } catch (error) {
      console.error('[SyncService] Error checking for pending sync:', error);
      return false;
    }
  }

  /**
   * Get count of pending moods to sync
   *
   * @returns Number of unsynced moods
   */
  async getPendingCount(): Promise<number> {
    try {
      const unsyncedMoods = await moodService.getUnsyncedMoods();
      return unsyncedMoods.length;
    } catch (error) {
      console.error('[SyncService] Error getting pending count:', error);
      return 0;
    }
  }
}

/**
 * Singleton instance of SyncService
 * Use this instance throughout the app for sync operations
 */
export const syncService = new SyncService();

export default syncService;
