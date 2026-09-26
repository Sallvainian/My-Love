import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock services before importing the store
vi.mock('@/services/moodService', () => ({
  moodService: {
    mergeServerMoods: vi.fn(),
    getMergeSnapshot: vi.fn(),
    saveForDate: vi.fn(),
    create: vi.fn(),
    updateMood: vi.fn(),
    getAll: vi.fn(),
    getAllForUser: vi.fn(),
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

vi.mock('@/api/moodApi', () => ({
  moodApi: {
    getMoodHistory: vi.fn(),
  },
}));

// The partner-moods copy lives in a Map here so a case can seed it, read what
// was saved, and hold a read open across an account switch.
const savedCopies = new Map<string, unknown>();
vi.mock('@/services/localCopy', () => ({
  readLocalCopy: vi.fn(),
  writeLocalCopy: vi.fn(),
  registerLocalCopy: vi.fn(() => () => {}),
}));

import { moodService } from '@/services/moodService';
import { moodSyncService } from '@/api/moodSyncService';
import { getPartnerId } from '@/api/supabaseClient';
import { readLocalCopy, writeLocalCopy } from '@/services/localCopy';

import type { MoodSlice } from '@/stores/slices/moodSlice';
import { createTestStore, makeMoodEntry, NOW, syncResult, TODAY } from './moodSliceFixture';

const mockedMoodService = vi.mocked(moodService);
const mockedMoodSyncService = vi.mocked(moodSyncService);
const mockedGetPartnerId = vi.mocked(getPartnerId);
const mockedReadLocalCopy = vi.mocked(readLocalCopy);
const mockedWriteLocalCopy = vi.mocked(writeLocalCopy);

describe('moodSlice', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    // loadMoods runs as a side effect of several actions under test, so give
    // the scoped read a default rather than letting it resolve undefined.
    mockedMoodService.getAllForUser.mockResolvedValue([]);
    mockedMoodService.getMergeSnapshot.mockResolvedValue(new Map());
    savedCopies.clear();
    mockedReadLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? (savedCopies.get(`${userId}|${kind}`) as never) : null
    );
    mockedWriteLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
      mockedMoodService.saveForDate.mockResolvedValue(entry);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([entry]);
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ synced: 1 }));
      // addMoodEntry syncs, and the sync path reloads from IndexedDB — where
      // the entry it just created really would be.
      mockedMoodService.getAllForUser.mockResolvedValue([entry]);

      const { get } = createTestStore({ userId: 'user-123' });
      await get().addMoodEntry(['happy']);

      expect(mockedMoodService.saveForDate).toHaveBeenCalledWith('user-123', entry.date, ['happy'], undefined);
      expect(get().moods).toContainEqual(entry);
    });

    it('throws if user is not authenticated', async () => {
      const { get } = createTestStore();
      await expect(get().addMoodEntry(['happy'])).rejects.toThrow('User not authenticated');
    });

    it('saves by owner/date when the UI already has a mood for today', async () => {
      const existing = makeMoodEntry({ id: 5 });

      const { get, set } = createTestStore({ userId: 'user-123' });
      // Seed state with existing mood for today
      set({ moods: [existing] } as Partial<MoodSlice>);

      const updated = makeMoodEntry({ id: 5, mood: 'sad', moods: ['sad'] });
      mockedMoodService.saveForDate.mockResolvedValue(updated);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult());
      mockedMoodService.getAll.mockResolvedValue([updated]);

      await get().addMoodEntry(['sad']);

      expect(mockedMoodService.saveForDate).toHaveBeenCalledWith('user-123', existing.date, ['sad'], undefined);
    });

    it('handles sync failure gracefully (does not throw)', async () => {
      const entry = makeMoodEntry();
      mockedMoodService.saveForDate.mockResolvedValue(entry);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([entry]);
      mockedMoodSyncService.syncPendingMoods.mockRejectedValue(new Error('network'));
      // syncPendingMoods failure re-throws, but addMoodEntry catches sync errors
      mockedMoodService.getAll.mockResolvedValue([entry]);

      const { get } = createTestStore({ userId: 'user-123' });
      // Should not throw — sync failure is caught internally
      await get().addMoodEntry(['happy']);
      expect(get().moods).toContainEqual(entry);
    });
  });

  describe('getMoodForDate', () => {
    it('returns mood for matching date', () => {
      const today = TODAY;
      const entry = makeMoodEntry({ date: today });
      const { get, set } = createTestStore({ userId: 'user-123' });
      set({ moods: [entry] } as Partial<MoodSlice>);

      expect(get().getMoodForDate(today)).toEqual(entry);
    });

    it('returns undefined when no mood for date', () => {
      const { get } = createTestStore({ userId: 'user-123' });
      expect(get().getMoodForDate('2020-01-01')).toBeUndefined();
    });

    it('does not return another account\'s entry for the same date', () => {
      // The device is shared. A signed out, B signed in; A's row can still be
      // in state, and MoodTracker pre-fills its note straight into B's form.
      const today = TODAY;
      const partnersEntry = makeMoodEntry({ date: today, userId: 'user-A', note: 'private' });
      const { get, set } = createTestStore({ userId: 'user-B' });
      set({ moods: [partnersEntry] } as Partial<MoodSlice>);

      expect(get().getMoodForDate(today)).toBeUndefined();
    });
  });

  describe('loadMoods', () => {
    it('loads moods from IndexedDB into state', async () => {
      const moods = [makeMoodEntry({ id: 1 }), makeMoodEntry({ id: 2, mood: 'sad' })];
      mockedMoodService.getAllForUser.mockResolvedValue(moods);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);

      const { get } = createTestStore({ userId: 'user-123' });
      await get().loadMoods();

      expect(get().moods).toEqual(moods);
    });

    it('asks the service only for the signed-in user\'s rows', async () => {
      // The IndexedDB store holds every account that has used this device, so
      // the scoping has to happen in the query rather than after it. An
      // unfiltered getAll() here is what put one partner's notes in the
      // other's session.
      mockedMoodService.getAllForUser.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);

      const { get } = createTestStore({ userId: 'user-B' });
      await get().loadMoods();

      expect(mockedMoodService.getAllForUser).toHaveBeenCalledWith('user-B');
      expect(mockedMoodService.getAll).not.toHaveBeenCalled();
    });

    it('loads nothing when no one is signed in', async () => {
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);

      const { get } = createTestStore({ userId: null });
      await get().loadMoods();

      expect(get().moods).toEqual([]);
      expect(mockedMoodService.getAllForUser).not.toHaveBeenCalled();
    });

    it('handles error gracefully without throwing', async () => {
      mockedMoodService.getAllForUser.mockRejectedValue(new Error('DB error'));

      const { get } = createTestStore({ userId: 'user-123' });
      // Should not throw
      await get().loadMoods();
      expect(get().moods).toEqual([]);
    });
  });

  describe('updateSyncStatus', () => {
    it('updates pendingMoods count from service', async () => {
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([makeMoodEntry(), makeMoodEntry()]);

      const { get } = createTestStore({ userId: 'user-123' });
      await get().updateSyncStatus();

      expect(get().syncStatus.pendingMoods).toBe(2);
    });

    it('counts only the signed-in user’s moods', async () => {
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([makeMoodEntry()]);

      const { get } = createTestStore({ userId: 'user-123' });
      await get().updateSyncStatus();

      expect(mockedMoodService.getUnsyncedMoods).toHaveBeenCalledWith('user-123');
    });

    it('[no signed-in user] counts nothing rather than everyone', async () => {
      // App.tsx runs this once on mount, unconditionally, and authSlice is not
      // persisted — so on a fresh load userId is still null here. Falling back
      // to the unscoped read badged the previous account's pending moods on a
      // shared device.
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([makeMoodEntry(), makeMoodEntry()]);

      const { get } = createTestStore({ userId: null });
      await get().updateSyncStatus();

      expect(mockedMoodService.getUnsyncedMoods).not.toHaveBeenCalled();
      expect(get().syncStatus.pendingMoods).toBe(0);
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

      expect(get().getPartnerMoodForDate('2025-06-15')).toEqual(entry);
    });

    it('returns undefined when no partner mood for date', () => {
      const { get } = createTestStore();
      expect(get().getPartnerMoodForDate('2025-06-15')).toBeUndefined();
    });
  });
});
