/**
 * Unit Tests for SyncService
 * Story 6.4: Background Sync Implementation
 *
 * Tests sync operations for mood entries:
 * - Complete success (all moods sync)
 * - Partial failure (some moods fail, some succeed)
 * - Complete failure (all moods fail)
 * - Empty sync (no moods to sync)
 * - Network error handling
 * - Validation error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncService, type SyncSummary } from '../../../src/services/syncService';
import { moodService } from '../../../src/services/moodService';
import { moodApi } from '../../../src/api/moodApi';
import type { MoodEntry } from '../../../src/types';
import type { SupabaseMood } from '../../../src/api/validation/supabaseSchemas';
import { USER_ID } from '../../../src/config/constants';

// Mock the moodService and moodApi
vi.mock('../../../src/services/moodService');
vi.mock('../../../src/api/moodApi');

describe('SyncService', () => {
  // Test data factories
  const createMockMoodEntry = (id: number, date: string): MoodEntry => ({
    id,
    userId: USER_ID,
    mood: 'happy',
    note: `Test note ${id}`,
    date,
    timestamp: new Date(),
    synced: false,
    supabaseId: undefined,
  });

  const createMockSupabaseMood = (id: string, userId: string): SupabaseMood => ({
    id,
    user_id: userId,
    mood_type: 'happy',
    note: 'Test note',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  describe('syncPendingMoods()', () => {
    it('successfully syncs all moods when no errors occur', async () => {
      // Arrange: 3 unsynced moods
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
        createMockMoodEntry(3, '2025-11-16'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      // Mock successful Supabase uploads
      const supabaseMoods = [
        createMockSupabaseMood('uuid-1', USER_ID),
        createMockSupabaseMood('uuid-2', USER_ID),
        createMockSupabaseMood('uuid-3', USER_ID),
      ];

      vi.mocked(moodApi.create)
        .mockResolvedValueOnce(supabaseMoods[0])
        .mockResolvedValueOnce(supabaseMoods[1])
        .mockResolvedValueOnce(supabaseMoods[2]);

      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);

      // Verify all moods marked as synced
      expect(moodService.markAsSynced).toHaveBeenCalledTimes(3);
      expect(moodService.markAsSynced).toHaveBeenCalledWith(1, 'uuid-1');
      expect(moodService.markAsSynced).toHaveBeenCalledWith(2, 'uuid-2');
      expect(moodService.markAsSynced).toHaveBeenCalledWith(3, 'uuid-3');

      // Verify all results are successful
      expect(result.results.every((r) => r.success)).toBe(true);
      expect(result.results[0].supabaseId).toBe('uuid-1');
      expect(result.results[1].supabaseId).toBe('uuid-2');
      expect(result.results[2].supabaseId).toBe('uuid-3');
    });

    it('handles partial failure - some moods sync, some fail', async () => {
      // Arrange: 4 moods, 2nd and 4th will fail
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
        createMockMoodEntry(3, '2025-11-16'),
        createMockMoodEntry(4, '2025-11-17'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      // Mock mixed success/failure
      const supabaseMood1 = createMockSupabaseMood('uuid-1', USER_ID);
      const supabaseMood3 = createMockSupabaseMood('uuid-3', USER_ID);

      vi.mocked(moodApi.create)
        .mockResolvedValueOnce(supabaseMood1) // Success
        .mockRejectedValueOnce(new Error('Network timeout')) // Failure
        .mockResolvedValueOnce(supabaseMood3) // Success
        .mockRejectedValueOnce(new Error('Validation failed')); // Failure

      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(4);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.results).toHaveLength(4);

      // Verify only successful moods marked as synced
      expect(moodService.markAsSynced).toHaveBeenCalledTimes(2);
      expect(moodService.markAsSynced).toHaveBeenCalledWith(1, 'uuid-1');
      expect(moodService.markAsSynced).toHaveBeenCalledWith(3, 'uuid-3');

      // Verify successful results
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].supabaseId).toBe('uuid-1');
      expect(result.results[2].success).toBe(true);
      expect(result.results[2].supabaseId).toBe('uuid-3');

      // Verify failed results
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Network timeout');
      expect(result.results[3].success).toBe(false);
      expect(result.results[3].error).toBe('Validation failed');
    });

    it('handles complete failure - all moods fail to sync', async () => {
      // Arrange: 3 moods, all will fail
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
        createMockMoodEntry(3, '2025-11-16'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      // Mock all failures
      vi.mocked(moodApi.create).mockRejectedValue(new Error('Server error 500'));

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(3);
      expect(result.results).toHaveLength(3);

      // Verify no moods marked as synced
      expect(moodService.markAsSynced).not.toHaveBeenCalled();

      // Verify all results failed
      expect(result.results.every((r) => !r.success)).toBe(true);
      expect(result.results.every((r) => r.error === 'Server error 500')).toBe(true);
    });

    it('returns empty summary when no moods to sync', async () => {
      // Arrange: No unsynced moods
      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([]);

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);

      // Verify no API calls made
      expect(moodApi.create).not.toHaveBeenCalled();
      expect(moodService.markAsSynced).not.toHaveBeenCalled();
    });

    it('handles mood entries without local IDs gracefully', async () => {
      // Arrange: Mood without ID (edge case)
      const invalidMood: MoodEntry = {
        userId: USER_ID,
        mood: 'happy',
        note: 'Test',
        date: '2025-11-14',
        timestamp: new Date(),
        synced: false,
        supabaseId: undefined,
        // Missing id property
      };

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([invalidMood]);

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Mood entry missing local ID');
      expect(result.results[0].localId).toBe(-1);

      // Verify no API calls made for invalid entry
      expect(moodApi.create).not.toHaveBeenCalled();
      expect(moodService.markAsSynced).not.toHaveBeenCalled();
    });

    it('continues syncing after network errors', async () => {
      // Arrange: 3 moods, middle one has network error
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
        createMockMoodEntry(3, '2025-11-16'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      const supabaseMood1 = createMockSupabaseMood('uuid-1', USER_ID);
      const supabaseMood3 = createMockSupabaseMood('uuid-3', USER_ID);

      // Mock network error for 2nd mood
      const networkError = new Error('Device is offline');
      networkError.name = 'NetworkError';

      vi.mocked(moodApi.create)
        .mockResolvedValueOnce(supabaseMood1)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(supabaseMood3);

      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);

      // Verify sync continued after network error
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Device is offline');
      expect(result.results[2].success).toBe(true);

      // Verify successful moods were marked as synced
      expect(moodService.markAsSynced).toHaveBeenCalledTimes(2);
    });

    it('handles API validation errors gracefully', async () => {
      // Arrange: 2 moods, 2nd has validation error
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      const supabaseMood1 = createMockSupabaseMood('uuid-1', USER_ID);

      // Mock validation error for 2nd mood
      const validationError = new Error('Invalid mood data received from server');
      validationError.name = 'ApiValidationError';

      vi.mocked(moodApi.create)
        .mockResolvedValueOnce(supabaseMood1)
        .mockRejectedValueOnce(validationError);

      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert
      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);

      // Verify validation error captured
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Invalid mood data received from server');

      // Verify successful mood was marked as synced
      expect(moodService.markAsSynced).toHaveBeenCalledTimes(1);
      expect(moodService.markAsSynced).toHaveBeenCalledWith(1, 'uuid-1');
    });

    it('returns empty summary on critical error', async () => {
      // Arrange: getUnsyncedMoods throws critical error
      vi.mocked(moodService.getUnsyncedMoods).mockRejectedValue(
        new Error('IndexedDB connection failed')
      );

      // Act
      const result: SyncSummary = await syncService.syncPendingMoods();

      // Assert: Should return empty summary instead of throwing
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);

      // Verify no API calls made
      expect(moodApi.create).not.toHaveBeenCalled();
      expect(moodService.markAsSynced).not.toHaveBeenCalled();
    });

    it('transforms IndexedDB MoodEntry to Supabase format correctly', async () => {
      // Arrange: Mood with all fields
      const timestamp = new Date('2025-11-14T10:30:00Z');
      const mood: MoodEntry = {
        id: 1,
        userId: USER_ID,
        mood: 'grateful',
        note: 'Thankful for you',
        date: '2025-11-14',
        timestamp,
        synced: false,
        supabaseId: undefined,
      };

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([mood]);

      const expectedSupabaseMood = createMockSupabaseMood('uuid-1', USER_ID);
      vi.mocked(moodApi.create).mockResolvedValue(expectedSupabaseMood);
      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      await syncService.syncPendingMoods();

      // Assert: Verify correct transformation
      expect(moodApi.create).toHaveBeenCalledWith({
        user_id: USER_ID,
        mood_type: 'grateful',
        note: 'Thankful for you',
        created_at: timestamp.toISOString(),
      });
    });

    it('handles moods with empty notes correctly', async () => {
      // Arrange: Mood with empty note
      const mood: MoodEntry = {
        id: 1,
        userId: USER_ID,
        mood: 'happy',
        note: '',
        date: '2025-11-14',
        timestamp: new Date(),
        synced: false,
        supabaseId: undefined,
      };

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([mood]);

      const supabaseMood = createMockSupabaseMood('uuid-1', USER_ID);
      vi.mocked(moodApi.create).mockResolvedValue(supabaseMood);
      vi.mocked(moodService.markAsSynced).mockResolvedValue();

      // Act
      await syncService.syncPendingMoods();

      // Assert: Empty string should be null
      expect(moodApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          note: null,
        })
      );
    });
  });

  describe('hasPendingSync()', () => {
    it('returns true when there are unsynced moods', async () => {
      // Arrange
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      // Act
      const result = await syncService.hasPendingSync();

      // Assert
      expect(result).toBe(true);
    });

    it('returns false when there are no unsynced moods', async () => {
      // Arrange
      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([]);

      // Act
      const result = await syncService.hasPendingSync();

      // Assert
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      // Arrange: Error getting unsynced moods
      vi.mocked(moodService.getUnsyncedMoods).mockRejectedValue(new Error('DB error'));

      // Act
      const result = await syncService.hasPendingSync();

      // Assert: Should return false instead of throwing
      expect(result).toBe(false);
    });
  });

  describe('getPendingCount()', () => {
    it('returns correct count of unsynced moods', async () => {
      // Arrange
      const unsyncedMoods: MoodEntry[] = [
        createMockMoodEntry(1, '2025-11-14'),
        createMockMoodEntry(2, '2025-11-15'),
        createMockMoodEntry(3, '2025-11-16'),
      ];

      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue(unsyncedMoods);

      // Act
      const count = await syncService.getPendingCount();

      // Assert
      expect(count).toBe(3);
    });

    it('returns 0 when there are no unsynced moods', async () => {
      // Arrange
      vi.mocked(moodService.getUnsyncedMoods).mockResolvedValue([]);

      // Act
      const count = await syncService.getPendingCount();

      // Assert
      expect(count).toBe(0);
    });

    it('returns 0 on error', async () => {
      // Arrange: Error getting unsynced moods
      vi.mocked(moodService.getUnsyncedMoods).mockRejectedValue(new Error('DB error'));

      // Act
      const count = await syncService.getPendingCount();

      // Assert: Should return 0 instead of throwing
      expect(count).toBe(0);
    });
  });
});
