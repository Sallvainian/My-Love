/**
 * Mood Slice
 *
 * Manages all mood tracking state and actions including:
 * - Mood entries (daily mood tracking)
 * - Mood entry retrieval by date
 * - Sync status tracking (pending moods, online status)
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - IndexedDB: moods persisted via MoodService (Story 6.2)
 * - LocalStorage: sync status cached for offline indicator
 * - Will sync to Supabase backend in Story 6.4
 */

import type { AppStateCreator } from '../types';
import type { MoodEntry } from '../../types';
import { moodService } from '../../services/moodService';
import { moodSyncService } from '../../api/moodSyncService';
import { getPartnerId } from '../../api/supabaseClient';
import { getCurrentUserIdOfflineSafe } from '../../api/auth/sessionService';

export interface MoodSlice {
  // State
  moods: MoodEntry[];
  partnerMoods: MoodEntry[];
  syncStatus: {
    pendingMoods: number;
    isOnline: boolean;
    lastSyncAt?: Date;
    isSyncing: boolean;
  };

  // Actions
  addMoodEntry: (moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  updateMoodEntry: (date: string, moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  loadMoods: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
  syncPendingMoods: () => Promise<{ synced: number; failed: number }>;
  fetchPartnerMoods: (limit?: number) => Promise<void>;
  getPartnerMoodForDate: (date: string) => MoodEntry | undefined;
}

export const createMoodSlice: AppStateCreator<MoodSlice> = (set, get, _api) => ({
  // Initial state
  moods: [],
  partnerMoods: [],
  syncStatus: {
    pendingMoods: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncAt: undefined,
    isSyncing: false,
  },

  // Actions
  addMoodEntry: async (moods, note) => {
    try {
      // Get authenticated user ID (offline-safe - uses cached session)
      // Story 5.2: AC-5.2.6 - Use offline-safe auth for local saves
      const userId = await getCurrentUserIdOfflineSafe();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Check if mood already exists for today
      const today = new Date().toISOString().split('T')[0];
      const existingMood = get().moods.find((m) => m.date === today);

      if (existingMood && existingMood.id) {
        // Update existing mood
        await get().updateMoodEntry(today, moods, note);
        return;
      }

      // Create new mood entry via MoodService (validates with MoodEntrySchema)
      const created = await moodService.create(userId, moods, note);

      // Optimistic UI update - add to state immediately
      set((state) => ({
        moods: [...state.moods, created],
      }));

      // Update sync status
      await get().updateSyncStatus();

      // Immediate sync if online (standard pattern)
      if (navigator.onLine) {
        try {
          await get().syncPendingMoods();
          if (import.meta.env.DEV) {
            console.log('[MoodSlice] Immediate sync completed for new mood');
          }
        } catch (syncError) {
          // Don't fail the add if sync fails - background sync will retry
          console.warn(
            '[MoodSlice] Immediate sync failed, will retry via background sync:',
            syncError
          );
        }
      }

      if (import.meta.env.DEV) {
        console.log('[MoodSlice] Added mood entry:', created);
      }
    } catch (error) {
      console.error('[MoodSlice] Error adding mood entry:', error);
      throw error; // Re-throw to allow UI to show error feedback
    }
  },

  getMoodForDate: (date) => {
    return get().moods.find((m) => m.date === date);
  },

  updateMoodEntry: async (date, moods, note) => {
    try {
      const existingMood = get().moods.find((m) => m.date === date);
      if (!existingMood || !existingMood.id) {
        throw new Error(`Mood entry for ${date} not found`);
      }

      // Update via MoodService (validates with MoodEntrySchema)
      const updated = await moodService.updateMood(existingMood.id, moods, note);

      // Update state
      set((state) => ({
        moods: state.moods.map((m) => (m.date === date ? updated : m)),
      }));

      // Update sync status
      await get().updateSyncStatus();

      // Immediate sync if online (standard pattern)
      if (navigator.onLine) {
        try {
          await get().syncPendingMoods();
          if (import.meta.env.DEV) {
            console.log('[MoodSlice] Immediate sync completed for updated mood');
          }
        } catch (syncError) {
          // Don't fail the update if sync fails - background sync will retry
          console.warn(
            '[MoodSlice] Immediate sync failed, will retry via background sync:',
            syncError
          );
        }
      }

      if (import.meta.env.DEV) {
        console.log('[MoodSlice] Updated mood entry:', updated);
      }
    } catch (error) {
      console.error('[MoodSlice] Error updating mood entry:', error);
      throw error; // Re-throw to allow UI to show error feedback
    }
  },

  loadMoods: async () => {
    try {
      // Load all moods from IndexedDB
      const allMoods = await moodService.getAll();

      set({ moods: allMoods });

      // Update sync status
      await get().updateSyncStatus();

      if (import.meta.env.DEV) {
        console.log('[MoodSlice] Loaded moods from IndexedDB:', allMoods.length);
      }
    } catch (error) {
      console.error('[MoodSlice] Error loading moods:', error);
      // Don't throw - graceful degradation with empty state
    }
  },

  updateSyncStatus: async () => {
    try {
      const unsyncedMoods = await moodService.getUnsyncedMoods();
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          pendingMoods: unsyncedMoods.length,
          isOnline,
        },
      }));

      if (import.meta.env.DEV) {
        console.log('[MoodSlice] Sync status updated:', {
          pendingMoods: unsyncedMoods.length,
          isOnline,
        });
      }
    } catch (error) {
      console.error('[MoodSlice] Error updating sync status:', error);
      // Don't throw - graceful degradation
    }
  },

  /**
   * Sync all pending moods to Supabase backend
   *
   * Features:
   * - Tracks sync state (isSyncing flag)
   * - Updates lastSyncAt timestamp on completion
   * - Refreshes syncStatus after sync
   * - Returns summary of synced/failed moods
   *
   * Story 6.4: AC #1 - Background sync with retry logic
   */
  syncPendingMoods: async () => {
    try {
      // Mark sync as in-progress
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          isSyncing: true,
        },
      }));

      if (import.meta.env.DEV) {
        console.log('[MoodSlice] Starting pending moods sync...');
      }

      // Call moodSyncService to sync all pending moods
      const result = await moodSyncService.syncPendingMoods();

      // Reload moods from IndexedDB to reflect synced status
      // This ensures the UI shows the correct sync state after successful sync
      await get().loadMoods();

      // Also refresh partner moods to mimic realtime updates
      // This ensures partner's latest moods are fetched when sync completes
      if (navigator.onLine) {
        get()
          .fetchPartnerMoods(30)
          .catch((err) => {
            // Don't fail sync if partner fetch fails - it's a nice-to-have
            console.warn('[MoodSlice] Failed to refresh partner moods after sync:', err);
          });
      }

      // Update sync status after completion
      await get().updateSyncStatus();

      // Update lastSyncAt timestamp
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          lastSyncAt: new Date(),
          isSyncing: false,
        },
      }));

      if (import.meta.env.DEV) {
        console.log(`[MoodSlice] Sync complete: ${result.synced} synced, ${result.failed} failed`);
      }

      return { synced: result.synced, failed: result.failed };
    } catch (error) {
      console.error('[MoodSlice] Error syncing pending moods:', error);

      // Mark sync as complete even on error
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          isSyncing: false,
        },
      }));

      // Re-throw to allow UI to show error feedback
      throw error;
    }
  },

  /**
   * Fetch partner moods from Supabase
   *
   * Retrieves mood entries for the partner user and stores them in partnerMoods state.
   * Filters results by limit (default: 30 days of moods).
   *
   * Features:
   * - Network status check before fetch
   * - Graceful error handling (logs but doesn't throw)
   * - Automatic state update on success
   * - Partner ID from environment config
   *
   * Story 6.4: Task 3 - AC #3 - Partner mood visibility
   */
  fetchPartnerMoods: async (limit = 30) => {
    try {
      // Check network status first
      if (!navigator.onLine) {
        if (import.meta.env.DEV) {
          console.log('[MoodSlice] Cannot fetch partner moods - device is offline');
        }
        return;
      }

      const partnerId = await getPartnerId();

      if (!partnerId) {
        console.error('[MoodSlice] Partner ID not found');
        return;
      }

      if (import.meta.env.DEV) {
        console.log(
          `[MoodSlice] Fetching partner moods (partnerId: ${partnerId}, limit: ${limit})`
        );
      }

      // Fetch partner moods from Supabase
      const partnerMoodRecords = await moodSyncService.fetchMoods(partnerId, limit);

      // Transform Supabase records to MoodEntry format
      const transformedMoods: MoodEntry[] = partnerMoodRecords.map((record) => {
        // Handle nullable created_at (shouldn't be null in practice, but types say it can be)
        const createdAt = record.created_at || new Date().toISOString();
        // Handle mood_types array (backward compat: use mood_type if mood_types is null)
        const moods =
          record.mood_types && record.mood_types.length > 0
            ? record.mood_types
            : [record.mood_type];
        return {
          id: undefined, // Partner moods don't have local IDB id
          userId: record.user_id,
          mood: record.mood_type,
          moods: moods, // Include all selected moods
          note: record.note || undefined,
          date: createdAt.split('T')[0], // Extract YYYY-MM-DD
          timestamp: new Date(createdAt),
          synced: true, // Partner moods are always synced (from Supabase)
          supabaseId: record.id,
        };
      });

      // Update state
      set({ partnerMoods: transformedMoods });

      if (import.meta.env.DEV) {
        console.log(`[MoodSlice] Fetched ${transformedMoods.length} partner moods`);
      }
    } catch (error) {
      console.error('[MoodSlice] Error fetching partner moods:', error);
      // Don't throw - graceful degradation (partner moods are optional feature)
    }
  },

  /**
   * Get partner's mood for a specific date
   *
   * @param date - ISO date string (YYYY-MM-DD)
   * @returns Partner's mood entry for the date, or undefined if not found
   */
  getPartnerMoodForDate: (date) => {
    return get().partnerMoods.find((m) => m.date === date);
  },
});
