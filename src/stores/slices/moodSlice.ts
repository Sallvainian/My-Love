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

import { moodSyncService } from '../../api/moodSyncService';
import { getPartnerId } from '../../api/supabaseClient';
import { moodService } from '../../services/moodService';
import { MOOD_SYNC_LOCK, withSyncLock } from '../../services/syncLock';
import type { MoodEntry } from '../../types';
import { normalizeMoodEntry, normalizeMoodValues } from '../../types/moods';
import { formatDateISO } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

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
  /** `skipped` means another context held the sync lock and nothing was attempted */
  syncPendingMoods: () => Promise<{ synced: number; failed: number; skipped: boolean }>;
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
    const { userId, authSessionVersion } = get();
    const stillCurrent = () =>
      get().userId === userId && get().authSessionVersion === authSessionVersion;
    if (!userId) throw new Error('User not authenticated');
    try {
      // The UI intentionally hides unrecoverable rows. Resolve the owner/date
      // on disk atomically so replacing a hidden row cannot collide with it.
      const saved = await moodService.saveForDate(userId, formatDateISO(new Date()), moods, note);
      if (!stillCurrent()) return;
      set((state) => ({
        moods: state.moods.some((row) => row.id === saved.id)
          ? state.moods.map((row) => row.id === saved.id ? saved : row)
          : [...state.moods, saved],
      }));
      await get().updateSyncStatus();
      if (!stillCurrent()) return;
      if (navigator.onLine) {
        try {
          await get().syncPendingMoods();
        } catch (error) {
          console.warn('[MoodSlice] Immediate sync failed, will retry:', error);
        }
      }
    } catch (error) {
      console.error('[MoodSlice] Error adding mood entry:', error);
      throw error;
    }
  },

  getMoodForDate: (date) => {
    const userId = get().userId;
    const row = get().moods.find((m) => m.date === date && m.userId === userId);
    return row ? normalizeMoodEntry(row) ?? undefined : undefined;
  },

  updateMoodEntry: async (date, moods, note) => {
    const { userId, authSessionVersion } = get();
    const stillCurrent = () =>
      get().userId === userId && get().authSessionVersion === authSessionVersion;
    if (!userId) throw new Error('User not authenticated');
    try {
      const saved = await moodService.saveForDate(userId, date, moods, note, true);
      if (!stillCurrent()) return;
      set((state) => ({
        moods: state.moods.some((row) => row.id === saved.id)
          ? state.moods.map((row) => row.id === saved.id ? saved : row)
          : [...state.moods, saved],
      }));
      await get().updateSyncStatus();
      if (!stillCurrent()) return;
      if (navigator.onLine) {
        try {
          await get().syncPendingMoods();
        } catch (error) {
          console.warn('[MoodSlice] Immediate sync failed, will retry:', error);
        }
      }
    } catch (error) {
      console.error('[MoodSlice] Error updating mood entry:', error);
      throw error;
    }
  },

  loadMoods: async () => {
    try {
      // Only this user's rows. The IndexedDB store holds every account that has
      // signed in on this device, so getAll() here put one partner's private
      // notes straight into the other's UI state.
      const { userId, authSessionVersion } = get();
      if (!userId) {
        set({ moods: [] });
        return;
      }

      const allMoods = await moodService.getAllForUser(userId);

      // Identity guard, same as fetchPartnerMoods below: Sign Out sits on the
      // same screen that fires this, so the read can land after clearAuth and
      // write this user's own mood notes back over the reset.
      if (get().userId !== userId || get().authSessionVersion !== authSessionVersion) return;

      set({ moods: allMoods });

      // Update sync status
      await get().updateSyncStatus();

      logger.debug('[MoodSlice] Loaded moods from IndexedDB:', allMoods.length);
    } catch (error) {
      console.error('[MoodSlice] Error loading moods:', error);
      // Don't throw - graceful degradation with empty state
    }
  },

  updateSyncStatus: async () => {
    try {
      // Same rule as loadMoods: no signed-in user means nothing to count, not
      // "count everyone". App.tsx runs this once on mount, unconditionally, and
      // authSlice is not persisted -- so on a fresh load userId is still null
      // and `?? undefined` fell through to the unscoped read, badging the
      // previous account's pending moods until a later call corrected it.
      const { userId: currentUserId, authSessionVersion } = get();
      const unsyncedMoods = currentUserId
        ? await moodService.getUnsyncedMoods(currentUserId)
        : [];
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      // Identity guard, same as loadMoods above. Only a count rather than free
      // text, so this is well below the disclosures the other guards close —
      // but it is the same shape, and the badge it feeds is read straight off
      // the store with no re-derivation.
      if (get().userId !== currentUserId || get().authSessionVersion !== authSessionVersion) return;

      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          pendingMoods: unsyncedMoods.length,
          isOnline,
        },
      }));

      logger.debug('[MoodSlice] Sync status updated:', {
        pendingMoods: unsyncedMoods.length,
        isOnline,
      });
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
    // A batch outlives the session that started it: App.tsx fires this from a
    // 5-minute interval and from the `online` event, and Sign Out sits in the
    // bottom nav of the very screen showing the sync badge. Every write below
    // is account-scoped completion state, so a batch raised by A must not clear
    // B's spinner, stamp B's `lastSyncAt`, or overwrite B's pending count when
    // it lands. `authSessionVersion` is the half that catches A signing back in
    // as A — an id-only compare lets that through.
    const { userId, authSessionVersion } = get();
    const stillCurrent = () =>
      get().userId === userId && get().authSessionVersion === authSessionVersion;

    // Concurrency guard: skip if already syncing to prevent duplicate DB rows
    if (get().syncStatus.isSyncing) {
      logger.debug('[MoodSlice] Skipping sync - already in progress');
      return { synced: 0, failed: 0, skipped: true };
    }

    try {
      // Mark sync as in-progress
      set((state) => ({
        syncStatus: {
          ...state.syncStatus,
          isSyncing: true,
        },
      }));

      logger.debug('[MoodSlice] Starting pending moods sync...');

      // `isSyncing` above only guards this tab. The lock guards against the
      // service worker and other tabs, which cannot see that flag at all.
      const locked = await withSyncLock(MOOD_SYNC_LOCK, async () => {
        const first = await moodSyncService.syncPendingMoods();

        // A deferral means the write landed but the user edited the record
        // while it was in flight, so it stayed dirty on purpose. Run one more
        // pass while we still hold the lock so the newer value reaches the
        // server now rather than waiting for an unrelated trigger. Exactly one
        // extra pass: unbounded retries would spin for as long as the user
        // keeps typing.
        if (first.deferred > 0) {
          logger.debug(`[MoodSlice] ${first.deferred} mood(s) edited mid-sync - one more pass`);
          const second = await moodSyncService.syncPendingMoods();
          return {
            synced: first.synced + second.synced,
            // NOT first.failed + second.failed: the second pass re-reads every
            // unsynced mood, so a record that failed in pass one fails again
            // and would be counted twice for a single broken record.
            failed: second.failed,
          };
        }

        return { synced: first.synced, failed: first.failed };
      });

      // Another context owns this batch. Nothing was written, so do not reload,
      // do not stamp lastSyncAt, and tell the caller it was skipped — reporting
      // {synced: 0, failed: 0} is indistinguishable from "nothing to sync" and
      // makes the retry button claim success for a sync that never ran.
      if (!locked.ran) {
        logger.debug('[MoodSlice] Another context holds the sync lock - skipping');
        if (stillCurrent()) {
          set((state) => ({
            syncStatus: { ...state.syncStatus, isSyncing: false },
          }));
        }
        return { synced: 0, failed: 0, skipped: true };
      }

      const result = locked.result;

      // The batch itself is finished and its rows are written; only the UI
      // follow-through is abandoned. Returning before the loaders, not merely
      // before the `set`, is the point: `loadMoods` and `fetchPartnerMoods`
      // would otherwise fire against the new session on the dead one's behalf.
      if (!stillCurrent()) {
        logger.debug('[MoodSlice] Sync completed after the session ended - discarding UI updates');
        return { synced: result.synced, failed: result.failed, skipped: false };
      }

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

      // Update lastSyncAt timestamp. Rechecked because `loadMoods` and
      // `updateSyncStatus` are both awaited above, so the session can end
      // between the check before them and here.
      if (stillCurrent()) {
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            lastSyncAt: new Date(),
            isSyncing: false,
          },
        }));
      }

      logger.debug(`[MoodSlice] Sync complete: ${result.synced} synced, ${result.failed} failed`);

      return { synced: result.synced, failed: result.failed, skipped: false };
    } catch (error) {
      console.error('[MoodSlice] Error syncing pending moods:', error);

      // Mark sync as complete even on error — but only for the session that
      // raised it. A dead session's failure must not clear the live one's
      // spinner, which is also the flag that suppresses a duplicate same-tab
      // batch.
      if (stillCurrent()) {
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            isSyncing: false,
          },
        }));
      }

      // Re-throw to allow UI to show error feedback. Unconditional: the caller
      // that started this batch still needs the rejection.
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
    // Whose data this is, captured before any await.
    const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
    try {
      // Check network status first
      if (!navigator.onLine) {
        logger.debug('[MoodSlice] Cannot fetch partner moods - device is offline');
        return;
      }

      const partnerId = await getPartnerId();

      if (!partnerId) {
        console.error('[MoodSlice] Partner ID not found');
        return;
      }

      logger.debug(`[MoodSlice] Fetching partner moods (partnerId: ${partnerId}, limit: ${limit})`);

      // Fetch partner moods from Supabase
      const partnerMoodRecords = await moodSyncService.fetchMoods(partnerId, limit);

      // Transform Supabase records to MoodEntry format
      const transformedMoods: MoodEntry[] = partnerMoodRecords.flatMap((record) => {
        // Handle nullable created_at (shouldn't be null in practice, but types say it can be)
        const createdAt = record.created_at || new Date().toISOString();
        const normalized = normalizeMoodValues(record.mood_type, record.mood_types);
        if (!normalized) return [];
        return {
          id: undefined, // Partner moods don't have local IDB id
          userId: record.user_id,
          ...normalized,
          note: record.note || undefined,
          date: formatDateISO(new Date(createdAt)), // Extract local YYYY-MM-DD
          timestamp: new Date(createdAt),
          synced: true, // Partner moods are always synced (from Supabase)
          supabaseId: record.id,
        };
      });

      // Update state
      // Identity guard: the Sign Out control is on the same screen that fires
      // this, and the request went out with a still-valid token. Landing after
      // clearAuth would write the previous couple's mood notes — free text —
      // straight back over the reset.
      if (get().userId !== requestedBy || get().authSessionVersion !== requestedInSession) return;
      set({ partnerMoods: transformedMoods });

      logger.debug(`[MoodSlice] Fetched ${transformedMoods.length} partner moods`);
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
    const row = get().partnerMoods.find((m) => m.date === date);
    return row ? normalizeMoodEntry(row) ?? undefined : undefined;
  },
});
