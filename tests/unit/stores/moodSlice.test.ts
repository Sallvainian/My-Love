import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MoodEntry } from '@/types';

// Mock services before importing the store
vi.mock('@/services/moodService', () => ({
  moodService: {
    create: vi.fn(),
    updateMood: vi.fn(),
    getAll: vi.fn(),
    getUnsyncedMoods: vi.fn(),
  },
}));

vi.mock('@/api/moodSyncService', () => ({
  moodSyncService: {
    syncPendingMoods: vi.fn(),
    fetchMoods: vi.fn(),
  },
}));

vi.mock('@/api/supabaseClient', () => ({
  getPartnerId: vi.fn(),
}));

vi.mock('@/api/auth/sessionService', () => ({
  getCurrentUserIdOfflineSafe: vi.fn(),
}));

import { moodService } from '@/services/moodService';
import { moodSyncService } from '@/api/moodSyncService';
import { getPartnerId } from '@/api/supabaseClient';
import { getCurrentUserIdOfflineSafe } from '@/api/auth/sessionService';

// Import Zustand store factory
import { createMoodSlice, type MoodSlice } from '@/stores/slices/moodSlice';

const mockedMoodService = vi.mocked(moodService);
const mockedMoodSyncService = vi.mocked(moodSyncService);
const mockedGetPartnerId = vi.mocked(getPartnerId);
const mockedGetCurrentUserId = vi.mocked(getCurrentUserIdOfflineSafe);

/** Create a standalone store-like object from the slice */
function createTestStore() {
  let state: MoodSlice;
  const stateRef = { current: null as MoodSlice | null };

  const get = () => stateRef.current!;
  const set = (updater: Partial<MoodSlice> | ((s: MoodSlice) => Partial<MoodSlice>)) => {
    const update = typeof updater === 'function' ? updater(stateRef.current!) : updater;
    stateRef.current = { ...stateRef.current!, ...update };
  };
  const api = {} as never;

  state = createMoodSlice(set as never, get as never, api);
  stateRef.current = state;
  return { get, set: set as never };
}

function makeMoodEntry(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: 1,
    userId: 'user-123',
    mood: 'happy',
    moods: ['happy'],
    note: '',
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date(),
    synced: false,
    ...overrides,
  };
}

describe('moodSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has empty moods and partnerMoods', () => {
      const { get } = createTestStore();
      expect(get().moods).toEqual([]);
      expect(get().partnerMoods).toEqual([]);
    });

    it('has default syncStatus', () => {
      const { get } = createTestStore();
      expect(get().syncStatus.pendingMoods).toBe(0);
      expect(get().syncStatus.isSyncing).toBe(false);
      expect(get().syncStatus.lastSyncAt).toBeUndefined();
    });
  });

  describe('addMoodEntry', () => {
    it('creates a mood entry and adds to state', async () => {
      const entry = makeMoodEntry();
      mockedGetCurrentUserId.mockResolvedValue('user-123');
      mockedMoodService.create.mockResolvedValue(entry);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([entry]);
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
      mockedMoodService.getAll.mockResolvedValue([entry]);

      const { get } = createTestStore();
      await get().addMoodEntry(['happy']);

      expect(mockedMoodService.create).toHaveBeenCalledWith('user-123', ['happy'], undefined);
      expect(get().moods).toContainEqual(entry);
    });

    it('throws if user is not authenticated', async () => {
      mockedGetCurrentUserId.mockResolvedValue(null);

      const { get } = createTestStore();
      await expect(get().addMoodEntry(['happy'])).rejects.toThrow('User not authenticated');
    });

    it('delegates to updateMoodEntry if mood already exists for today', async () => {
      const existing = makeMoodEntry({ id: 5 });
      mockedGetCurrentUserId.mockResolvedValue('user-123');

      const { get, set } = createTestStore();
      // Seed state with existing mood for today
      set({ moods: [existing] } as Partial<MoodSlice>);

      const updated = makeMoodEntry({ id: 5, mood: 'sad', moods: ['sad'] });
      mockedMoodService.updateMood.mockResolvedValue(updated);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue({ synced: 0, failed: 0 });
      mockedMoodService.getAll.mockResolvedValue([updated]);

      await get().addMoodEntry(['sad']);

      expect(mockedMoodService.updateMood).toHaveBeenCalledWith(5, ['sad'], undefined);
    });

    it('handles sync failure gracefully (does not throw)', async () => {
      const entry = makeMoodEntry();
      mockedGetCurrentUserId.mockResolvedValue('user-123');
      mockedMoodService.create.mockResolvedValue(entry);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([entry]);
      mockedMoodSyncService.syncPendingMoods.mockRejectedValue(new Error('network'));
      // syncPendingMoods failure re-throws, but addMoodEntry catches sync errors
      mockedMoodService.getAll.mockResolvedValue([entry]);

      const { get } = createTestStore();
      // Should not throw — sync failure is caught internally
      await get().addMoodEntry(['happy']);
      expect(get().moods).toContainEqual(entry);
    });
  });

  describe('getMoodForDate', () => {
    it('returns mood for matching date', () => {
      const today = new Date().toISOString().split('T')[0];
      const entry = makeMoodEntry({ date: today });
      const { get, set } = createTestStore();
      set({ moods: [entry] } as Partial<MoodSlice>);

      expect(get().getMoodForDate(today)).toBe(entry);
    });

    it('returns undefined when no mood for date', () => {
      const { get } = createTestStore();
      expect(get().getMoodForDate('2020-01-01')).toBeUndefined();
    });
  });

  describe('loadMoods', () => {
    it('loads moods from IndexedDB into state', async () => {
      const moods = [makeMoodEntry({ id: 1 }), makeMoodEntry({ id: 2, mood: 'sad' })];
      mockedMoodService.getAll.mockResolvedValue(moods);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);

      const { get } = createTestStore();
      await get().loadMoods();

      expect(get().moods).toEqual(moods);
    });

    it('handles error gracefully without throwing', async () => {
      mockedMoodService.getAll.mockRejectedValue(new Error('DB error'));

      const { get } = createTestStore();
      // Should not throw
      await get().loadMoods();
      expect(get().moods).toEqual([]);
    });
  });

  describe('updateSyncStatus', () => {
    it('updates pendingMoods count from service', async () => {
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([makeMoodEntry(), makeMoodEntry()]);

      const { get } = createTestStore();
      await get().updateSyncStatus();

      expect(get().syncStatus.pendingMoods).toBe(2);
    });
  });

  describe('syncPendingMoods', () => {
    it('sets isSyncing during sync and clears after', async () => {
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue({ synced: 1, failed: 0 });
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      await get().syncPendingMoods();

      expect(get().syncStatus.isSyncing).toBe(false);
      expect(get().syncStatus.lastSyncAt).toBeInstanceOf(Date);
    });

    it('returns synced/failed counts', async () => {
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue({ synced: 3, failed: 1 });
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      const result = await get().syncPendingMoods();

      expect(result).toEqual({ synced: 3, failed: 1 });
    });

    it('resets isSyncing on error and re-throws', async () => {
      mockedMoodSyncService.syncPendingMoods.mockRejectedValue(new Error('sync failed'));

      const { get } = createTestStore();
      await expect(get().syncPendingMoods()).rejects.toThrow('sync failed');
      expect(get().syncStatus.isSyncing).toBe(false);
    });
  });

  describe('fetchPartnerMoods', () => {
    it('fetches and transforms partner moods', async () => {
      mockedGetPartnerId.mockResolvedValue('partner-uuid');
      mockedMoodSyncService.fetchMoods.mockResolvedValue([
        {
          id: 'supa-1',
          user_id: 'partner-uuid',
          mood_type: 'happy',
          mood_types: ['happy', 'grateful'],
          note: 'Great day',
          created_at: '2025-06-15T12:00:00Z',
        } as never,
      ]);

      const { get } = createTestStore();
      await get().fetchPartnerMoods(10);

      expect(get().partnerMoods).toHaveLength(1);
      expect(get().partnerMoods[0].moods).toEqual(['happy', 'grateful']);
      expect(get().partnerMoods[0].date).toBe('2025-06-15');
      expect(get().partnerMoods[0].synced).toBe(true);
    });

    it('does nothing when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { get } = createTestStore();
      await get().fetchPartnerMoods();

      expect(mockedGetPartnerId).not.toHaveBeenCalled();
      expect(get().partnerMoods).toEqual([]);
    });

    it('returns early when no partner ID', async () => {
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      await get().fetchPartnerMoods();

      expect(mockedMoodSyncService.fetchMoods).not.toHaveBeenCalled();
    });

    it('handles fetch error gracefully without throwing', async () => {
      mockedGetPartnerId.mockResolvedValue('partner-uuid');
      mockedMoodSyncService.fetchMoods.mockRejectedValue(new Error('network'));

      const { get } = createTestStore();
      // Should not throw
      await get().fetchPartnerMoods();
      expect(get().partnerMoods).toEqual([]);
    });

    it('falls back to mood_type when mood_types is null', async () => {
      mockedGetPartnerId.mockResolvedValue('partner-uuid');
      mockedMoodSyncService.fetchMoods.mockResolvedValue([
        {
          id: 'supa-2',
          user_id: 'partner-uuid',
          mood_type: 'sad',
          mood_types: null,
          note: null,
          created_at: '2025-06-15T12:00:00Z',
        } as never,
      ]);

      const { get } = createTestStore();
      await get().fetchPartnerMoods();

      expect(get().partnerMoods[0].moods).toEqual(['sad']);
    });
  });

  describe('getPartnerMoodForDate', () => {
    it('returns partner mood for matching date', () => {
      const entry = makeMoodEntry({ date: '2025-06-15' });
      const { get, set } = createTestStore();
      set({ partnerMoods: [entry] } as Partial<MoodSlice>);

      expect(get().getPartnerMoodForDate('2025-06-15')).toBe(entry);
    });

    it('returns undefined when no partner mood for date', () => {
      const { get } = createTestStore();
      expect(get().getPartnerMoodForDate('2025-06-15')).toBeUndefined();
    });
  });
});
