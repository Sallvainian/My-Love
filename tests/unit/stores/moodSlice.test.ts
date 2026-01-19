/**
 * MoodSlice Unit Tests
 *
 * Tests for mood state management including:
 * - Initial state verification
 * - Adding mood entries (with auth and service dependencies)
 * - Getting mood for specific dates
 * - Updating mood entries
 * - Loading moods from IndexedDB
 * - Sync status management
 * - Syncing pending moods
 * - Partner mood fetching
 *
 * Anti-patterns avoided:
 * - No reliance on test order
 * - No shared mutable state between tests
 * - Explicit assertions on specific values (not just truthy)
 * - All async operations properly awaited
 * - Mocks cleared between tests
 *
 * @module tests/unit/stores/moodSlice.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStore } from 'zustand';
import type { MoodSlice } from '../../../src/stores/slices/moodSlice';
import { createMoodSlice } from '../../../src/stores/slices/moodSlice';
import type { MoodEntry } from '../../../src/types';

// Mock all external dependencies BEFORE imports
const mockCreate = vi.fn();
const mockGetAll = vi.fn();
const mockUpdateMood = vi.fn();
const mockGetUnsyncedMoods = vi.fn();
const mockMarkAsSynced = vi.fn();

vi.mock('../../../src/services/moodService', () => ({
  moodService: {
    create: (...args: unknown[]) => mockCreate(...args),
    getAll: () => mockGetAll(),
    updateMood: (...args: unknown[]) => mockUpdateMood(...args),
    getUnsyncedMoods: () => mockGetUnsyncedMoods(),
    markAsSynced: (...args: unknown[]) => mockMarkAsSynced(...args),
  },
}));

const mockSyncPendingMoods = vi.fn();
const mockFetchMoods = vi.fn();

vi.mock('../../../src/api/moodSyncService', () => ({
  moodSyncService: {
    syncPendingMoods: () => mockSyncPendingMoods(),
    fetchMoods: (...args: unknown[]) => mockFetchMoods(...args),
  },
}));

const mockGetCurrentUserIdOfflineSafe = vi.fn();

vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserIdOfflineSafe: () => mockGetCurrentUserIdOfflineSafe(),
  },
}));

const mockGetPartnerId = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  getPartnerId: () => mockGetPartnerId(),
}));

// Test data factory
function createMockMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: 'user-123',
    mood: 'happy',
    moods: ['happy'],
    note: 'Test note',
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date(),
    synced: false,
    ...overrides,
  };
}

describe('MoodSlice', () => {
  let store: ReturnType<typeof createStore<MoodSlice>>;

  // Store original navigator.onLine
  const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh store for each test (isolation)
    store = createStore<MoodSlice>()(createMoodSlice);

    // Default mock implementations
    mockGetCurrentUserIdOfflineSafe.mockResolvedValue('user-123');
    mockGetUnsyncedMoods.mockResolvedValue([]);
    mockGetPartnerId.mockResolvedValue('partner-456');
    mockGetAll.mockResolvedValue([]); // Default to empty array for loadMoods
    mockFetchMoods.mockResolvedValue([]); // Default for partner mood fetches

    // Mock navigator.onLine as true by default
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original navigator.onLine
    if (originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine);
    }
  });

  describe('initial state', () => {
    it('should have empty moods array', () => {
      const state = store.getState();
      expect(state.moods).toEqual([]);
      expect(state.moods).toHaveLength(0);
    });

    it('should have empty partnerMoods array', () => {
      const state = store.getState();
      expect(state.partnerMoods).toEqual([]);
      expect(state.partnerMoods).toHaveLength(0);
    });

    it('should have default syncStatus', () => {
      const state = store.getState();
      expect(state.syncStatus).toEqual({
        pendingMoods: 0,
        isOnline: true,
        lastSyncAt: undefined,
        isSyncing: false,
      });
    });

    it('should have syncStatus.pendingMoods as 0', () => {
      const state = store.getState();
      expect(state.syncStatus.pendingMoods).toBe(0);
    });

    it('should have syncStatus.isSyncing as false', () => {
      const state = store.getState();
      expect(state.syncStatus.isSyncing).toBe(false);
    });
  });

  describe('addMoodEntry', () => {
    const mockCreatedMood = createMockMoodEntry({
      id: 42,
      mood: 'grateful',
      moods: ['grateful'],
    });

    beforeEach(() => {
      mockCreate.mockResolvedValue(mockCreatedMood);
      mockSyncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
    });

    it('should throw error if user is not authenticated', async () => {
      mockGetCurrentUserIdOfflineSafe.mockResolvedValue(null);

      await expect(store.getState().addMoodEntry(['happy'])).rejects.toThrow(
        'User not authenticated'
      );

      // Verify moodService.create was NOT called
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should create mood entry via moodService with correct arguments', async () => {
      await store.getState().addMoodEntry(['grateful'], 'Feeling grateful today');

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith('user-123', ['grateful'], 'Feeling grateful today');
    });

    it('should add created mood to state', async () => {
      // After addMoodEntry, syncPendingMoods calls loadMoods which reloads from DB
      // So mock getAll to return the created mood to simulate it being persisted
      mockGetAll.mockResolvedValue([mockCreatedMood]);

      await store.getState().addMoodEntry(['grateful']);

      const state = store.getState();
      expect(state.moods).toHaveLength(1);
      expect(state.moods[0]).toEqual(mockCreatedMood);
      expect(state.moods[0].mood).toBe('grateful');
    });

    it('should call updateSyncStatus after adding mood', async () => {
      await store.getState().addMoodEntry(['happy']);

      // updateSyncStatus calls getUnsyncedMoods
      expect(mockGetUnsyncedMoods).toHaveBeenCalled();
    });

    it('should attempt immediate sync when online', async () => {
      await store.getState().addMoodEntry(['happy']);

      expect(mockSyncPendingMoods).toHaveBeenCalledTimes(1);
    });

    it('should NOT attempt sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      await store.getState().addMoodEntry(['happy']);

      expect(mockSyncPendingMoods).not.toHaveBeenCalled();
    });

    it('should NOT fail if sync fails (graceful degradation)', async () => {
      mockSyncPendingMoods.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(store.getState().addMoodEntry(['happy'])).resolves.not.toThrow();

      // Mood should still be in state
      expect(store.getState().moods).toHaveLength(1);
    });

    it('should update existing mood if mood for today already exists', async () => {
      const today = new Date().toISOString().split('T')[0];
      const existingMood = createMockMoodEntry({ id: 1, date: today, mood: 'happy' });

      // Pre-populate state with existing mood
      store.setState({ moods: [existingMood] });

      const updatedMood = createMockMoodEntry({ id: 1, date: today, mood: 'grateful' });
      mockUpdateMood.mockResolvedValue(updatedMood);

      await store.getState().addMoodEntry(['grateful'], 'Updated note');

      // Should call updateMood, not create
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdateMood).toHaveBeenCalledWith(1, ['grateful'], 'Updated note');
    });
  });

  describe('getMoodForDate', () => {
    it('should return mood for existing date', () => {
      const mood1 = createMockMoodEntry({ date: '2024-01-15', mood: 'happy' });
      const mood2 = createMockMoodEntry({ date: '2024-01-16', mood: 'grateful' });
      store.setState({ moods: [mood1, mood2] });

      const result = store.getState().getMoodForDate('2024-01-15');

      expect(result).toBeDefined();
      expect(result?.date).toBe('2024-01-15');
      expect(result?.mood).toBe('happy');
    });

    it('should return undefined for non-existing date', () => {
      const mood = createMockMoodEntry({ date: '2024-01-15' });
      store.setState({ moods: [mood] });

      const result = store.getState().getMoodForDate('2024-01-20');

      expect(result).toBeUndefined();
    });

    it('should return undefined when moods array is empty', () => {
      const result = store.getState().getMoodForDate('2024-01-15');

      expect(result).toBeUndefined();
    });
  });

  describe('updateMoodEntry', () => {
    const today = new Date().toISOString().split('T')[0];

    beforeEach(() => {
      mockSyncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
    });

    it('should throw error if mood for date does not exist', async () => {
      await expect(store.getState().updateMoodEntry('2024-01-15', ['happy'])).rejects.toThrow(
        'Mood entry for 2024-01-15 not found'
      );

      expect(mockUpdateMood).not.toHaveBeenCalled();
    });

    it('should throw error if mood exists but has no id', async () => {
      const moodWithoutId = createMockMoodEntry({ id: undefined, date: today });
      store.setState({ moods: [moodWithoutId] });

      await expect(store.getState().updateMoodEntry(today, ['happy'])).rejects.toThrow(
        `Mood entry for ${today} not found`
      );
    });

    it('should update mood via moodService with correct arguments', async () => {
      const existingMood = createMockMoodEntry({ id: 5, date: today, mood: 'happy' });
      store.setState({ moods: [existingMood] });

      const updatedMood = createMockMoodEntry({ id: 5, date: today, mood: 'grateful' });
      mockUpdateMood.mockResolvedValue(updatedMood);

      await store.getState().updateMoodEntry(today, ['grateful'], 'New note');

      expect(mockUpdateMood).toHaveBeenCalledTimes(1);
      expect(mockUpdateMood).toHaveBeenCalledWith(5, ['grateful'], 'New note');
    });

    it('should update mood in state after successful update', async () => {
      const existingMood = createMockMoodEntry({ id: 5, date: today, mood: 'happy' });
      store.setState({ moods: [existingMood] });

      const updatedMood = createMockMoodEntry({ id: 5, date: today, mood: 'grateful' });
      mockUpdateMood.mockResolvedValue(updatedMood);
      // After update, syncPendingMoods calls loadMoods which reloads from DB
      mockGetAll.mockResolvedValue([updatedMood]);

      await store.getState().updateMoodEntry(today, ['grateful']);

      const state = store.getState();
      expect(state.moods[0].mood).toBe('grateful');
    });

    it('should attempt immediate sync when online after update', async () => {
      const existingMood = createMockMoodEntry({ id: 5, date: today });
      store.setState({ moods: [existingMood] });
      mockUpdateMood.mockResolvedValue(existingMood);

      await store.getState().updateMoodEntry(today, ['happy']);

      expect(mockSyncPendingMoods).toHaveBeenCalled();
    });
  });

  describe('loadMoods', () => {
    it('should load moods from moodService and update state', async () => {
      const moods = [
        createMockMoodEntry({ id: 1, date: '2024-01-15' }),
        createMockMoodEntry({ id: 2, date: '2024-01-16' }),
      ];
      mockGetAll.mockResolvedValue(moods);

      await store.getState().loadMoods();

      const state = store.getState();
      expect(state.moods).toHaveLength(2);
      expect(state.moods).toEqual(moods);
    });

    it('should call updateSyncStatus after loading', async () => {
      mockGetAll.mockResolvedValue([]);

      await store.getState().loadMoods();

      expect(mockGetUnsyncedMoods).toHaveBeenCalled();
    });

    it('should gracefully handle errors without throwing', async () => {
      mockGetAll.mockRejectedValue(new Error('IndexedDB error'));

      // Should not throw
      await expect(store.getState().loadMoods()).resolves.not.toThrow();
    });
  });

  describe('updateSyncStatus', () => {
    it('should update pendingMoods count from unsynced moods', async () => {
      const unsyncedMoods = [createMockMoodEntry(), createMockMoodEntry()];
      mockGetUnsyncedMoods.mockResolvedValue(unsyncedMoods);

      await store.getState().updateSyncStatus();

      expect(store.getState().syncStatus.pendingMoods).toBe(2);
    });

    it('should update isOnline status based on navigator.onLine', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      mockGetUnsyncedMoods.mockResolvedValue([]);

      await store.getState().updateSyncStatus();

      expect(store.getState().syncStatus.isOnline).toBe(false);
    });

    it('should not throw on error (graceful degradation)', async () => {
      mockGetUnsyncedMoods.mockRejectedValue(new Error('DB error'));

      await expect(store.getState().updateSyncStatus()).resolves.not.toThrow();
    });
  });

  describe('syncPendingMoods', () => {
    it('should set isSyncing to true during sync', async () => {
      mockSyncPendingMoods.mockImplementation(async () => {
        // Check state during sync
        expect(store.getState().syncStatus.isSyncing).toBe(true);
        return { synced: 0, failed: 0 };
      });
      mockGetAll.mockResolvedValue([]);

      await store.getState().syncPendingMoods();
    });

    it('should set isSyncing to false after sync completes', async () => {
      mockSyncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
      mockGetAll.mockResolvedValue([]);

      await store.getState().syncPendingMoods();

      expect(store.getState().syncStatus.isSyncing).toBe(false);
    });

    it('should set lastSyncAt timestamp after successful sync', async () => {
      mockSyncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
      mockGetAll.mockResolvedValue([]);

      const beforeSync = new Date();
      await store.getState().syncPendingMoods();
      const afterSync = new Date();

      const lastSyncAt = store.getState().syncStatus.lastSyncAt;
      expect(lastSyncAt).toBeDefined();
      expect(lastSyncAt!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
      expect(lastSyncAt!.getTime()).toBeLessThanOrEqual(afterSync.getTime());
    });

    it('should reload moods after sync to reflect synced status', async () => {
      mockSyncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
      mockGetAll.mockResolvedValue([]);

      await store.getState().syncPendingMoods();

      expect(mockGetAll).toHaveBeenCalled();
    });

    it('should return sync result with synced and failed counts', async () => {
      mockSyncPendingMoods.mockResolvedValue({ synced: 3, failed: 1 });
      mockGetAll.mockResolvedValue([]);

      const result = await store.getState().syncPendingMoods();

      expect(result).toEqual({ synced: 3, failed: 1 });
    });

    it('should set isSyncing to false even if sync fails', async () => {
      mockSyncPendingMoods.mockRejectedValue(new Error('Sync failed'));

      await expect(store.getState().syncPendingMoods()).rejects.toThrow('Sync failed');

      expect(store.getState().syncStatus.isSyncing).toBe(false);
    });
  });

  describe('fetchPartnerMoods', () => {
    it('should not fetch when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      await store.getState().fetchPartnerMoods();

      expect(mockFetchMoods).not.toHaveBeenCalled();
    });

    it('should not fetch when partner ID is not found', async () => {
      mockGetPartnerId.mockResolvedValue(null);

      await store.getState().fetchPartnerMoods();

      expect(mockFetchMoods).not.toHaveBeenCalled();
    });

    it('should fetch partner moods with correct arguments', async () => {
      mockFetchMoods.mockResolvedValue([]);

      await store.getState().fetchPartnerMoods(15);

      expect(mockFetchMoods).toHaveBeenCalledWith('partner-456', 15);
    });

    it('should use default limit of 30 if not specified', async () => {
      mockFetchMoods.mockResolvedValue([]);

      await store.getState().fetchPartnerMoods();

      expect(mockFetchMoods).toHaveBeenCalledWith('partner-456', 30);
    });

    it('should transform and store partner moods in state', async () => {
      const supabaseMoods = [
        {
          id: 'uuid-1',
          user_id: 'partner-456',
          mood_type: 'happy',
          mood_types: ['happy', 'grateful'],
          note: 'Partner note',
          created_at: '2024-01-15T10:30:00.000Z',
          updated_at: '2024-01-15T10:30:00.000Z',
        },
      ];
      mockFetchMoods.mockResolvedValue(supabaseMoods);

      await store.getState().fetchPartnerMoods();

      const state = store.getState();
      expect(state.partnerMoods).toHaveLength(1);
      expect(state.partnerMoods[0].userId).toBe('partner-456');
      expect(state.partnerMoods[0].mood).toBe('happy');
      expect(state.partnerMoods[0].moods).toEqual(['happy', 'grateful']);
      expect(state.partnerMoods[0].date).toBe('2024-01-15');
      expect(state.partnerMoods[0].synced).toBe(true);
      expect(state.partnerMoods[0].supabaseId).toBe('uuid-1');
    });

    it('should not throw on error (graceful degradation)', async () => {
      mockFetchMoods.mockRejectedValue(new Error('Network error'));

      await expect(store.getState().fetchPartnerMoods()).resolves.not.toThrow();
    });
  });

  describe('getPartnerMoodForDate', () => {
    it('should return partner mood for existing date', () => {
      const partnerMood = createMockMoodEntry({
        date: '2024-01-15',
        mood: 'loved',
        userId: 'partner-456',
      });
      store.setState({ partnerMoods: [partnerMood] });

      const result = store.getState().getPartnerMoodForDate('2024-01-15');

      expect(result).toBeDefined();
      expect(result?.date).toBe('2024-01-15');
      expect(result?.mood).toBe('loved');
    });

    it('should return undefined for non-existing date', () => {
      store.setState({ partnerMoods: [] });

      const result = store.getState().getPartnerMoodForDate('2024-01-15');

      expect(result).toBeUndefined();
    });
  });
});
