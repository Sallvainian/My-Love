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
import { moodApi } from '@/api/moodApi';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '@/services/localCopy';

import { MOOD_HISTORY_PAGE_SIZE, type MoodSlice } from '@/stores/slices/moodSlice';
import { createTestStore, makeMoodEntry, NOW } from './moodSliceFixture';

const mockedMoodService = vi.mocked(moodService);
const mockedMoodApi = vi.mocked(moodApi);
const mockedReadLocalCopy = vi.mocked(readLocalCopy);
const mockedWriteLocalCopy = vi.mocked(writeLocalCopy);
const mockedRegisterLocalCopy = vi.mocked(registerLocalCopy);

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

  describe('loadMoodHistoryFromServer (mood-history backfill)', () => {
    const USER = 'user-123';

    function serverRow(overrides: Record<string, unknown> = {}) {
      return {
        id: 'supa-1',
        user_id: USER,
        mood_type: 'happy',
        mood_types: ['happy'],
        note: null,
        created_at: '2026-08-01T12:00:00.000Z',
        updated_at: null,
        ...overrides,
      } as never;
    }

    function localDate(iso: string) {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    it('registers itself as the mood-history refresher', async () => {
      mockedMoodApi.getMoodHistory.mockResolvedValue([]);
      mockedMoodService.mergeServerMoods.mockResolvedValue(false);
      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });

      const call = mockedRegisterLocalCopy.mock.calls.find(([kind]) => kind === 'mood-history');
      expect(call).toBeDefined();
      await call![1]();
      expect(mockedMoodApi.getMoodHistory).toHaveBeenCalledWith(USER, 0, MOOD_HISTORY_PAGE_SIZE);
      expect(get().moods).toEqual([]);
    });

    it('pages 500 at a time until a short page', async () => {
      const full = Array.from({ length: MOOD_HISTORY_PAGE_SIZE }, (_, i) =>
        serverRow({ id: `p1-${i}`, created_at: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString() })
      );
      mockedMoodApi.getMoodHistory
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce([serverRow({ id: 'p2-0', created_at: '2020-01-01T12:00:00.000Z' })]);
      mockedMoodService.mergeServerMoods.mockResolvedValue(true);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().loadMoodHistoryFromServer();

      expect(mockedMoodApi.getMoodHistory).toHaveBeenCalledTimes(2);
      expect(mockedMoodApi.getMoodHistory).toHaveBeenNthCalledWith(
        1,
        USER,
        0,
        MOOD_HISTORY_PAGE_SIZE
      );
      expect(mockedMoodApi.getMoodHistory).toHaveBeenNthCalledWith(
        2,
        USER,
        MOOD_HISTORY_PAGE_SIZE,
        MOOD_HISTORY_PAGE_SIZE
      );
      // Every row sits on its own local date, so the newest-per-date pass keeps
      // them all: the full first page plus the one-row short page.
      const [, entries] = mockedMoodService.mergeServerMoods.mock.calls[0];
      expect(entries).toHaveLength(MOOD_HISTORY_PAGE_SIZE + 1);
    });

    it('maps rows like partner moods, keeps the newest per date and skips a null created_at', async () => {
      mockedMoodApi.getMoodHistory.mockResolvedValue([
        serverRow({ id: 'newer', mood_type: 'sad', mood_types: ['sad'], note: 'second device', created_at: '2026-08-01T12:30:00.000Z' }),
        serverRow({ id: 'older', created_at: '2026-08-01T12:00:00.000Z' }),
        serverRow({ id: 'no-time', created_at: null }),
      ]);
      mockedMoodService.mergeServerMoods.mockResolvedValue(true);
      const reloaded = [makeMoodEntry({ id: 7, userId: USER, synced: true })];
      mockedMoodService.getAllForUser.mockResolvedValue(reloaded);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().loadMoodHistoryFromServer();

      expect(mockedMoodService.mergeServerMoods).toHaveBeenCalledTimes(1);
      const [owner, entries] = mockedMoodService.mergeServerMoods.mock.calls[0];
      expect(owner).toBe(USER);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        userId: USER,
        mood: 'sad',
        moods: ['sad'],
        note: 'second device',
        date: localDate('2026-08-01T12:30:00.000Z'),
        synced: true,
        supabaseId: 'newer',
      });
      expect(entries[0].timestamp.toISOString()).toBe('2026-08-01T12:30:00.000Z');
      // Changed, so the store reloads from IndexedDB.
      expect(get().moods).toEqual(reloaded);
    });

    it('takes the local snapshot before the first server request and passes it to the merge', async () => {
      const order: string[] = [];
      const snapshot = new Map();
      mockedMoodService.getMergeSnapshot.mockImplementation(async () => {
        order.push('snapshot');
        return snapshot;
      });
      mockedMoodApi.getMoodHistory.mockImplementation(async () => {
        order.push('server');
        return [serverRow()];
      });
      mockedMoodService.mergeServerMoods.mockResolvedValue(false);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().loadMoodHistoryFromServer();

      expect(order).toEqual(['snapshot', 'server']);
      expect(mockedMoodService.getMergeSnapshot).toHaveBeenCalledWith(USER);
      expect(mockedMoodService.mergeServerMoods.mock.calls[0][2]).toBe(snapshot);
    });

    it('does not reload moods when the merge changed nothing', async () => {
      mockedMoodApi.getMoodHistory.mockResolvedValue([serverRow()]);
      mockedMoodService.mergeServerMoods.mockResolvedValue(false);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().loadMoodHistoryFromServer();

      expect(mockedMoodService.getAllForUser).not.toHaveBeenCalled();
    });

    it('changes nothing when the read fails (offline or server error)', async () => {
      const existing = [makeMoodEntry({ userId: USER })];
      mockedMoodApi.getMoodHistory.mockRejectedValue(new Error('Device is offline'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      set({ moods: existing } as Partial<MoodSlice>);
      await expect(get().loadMoodHistoryFromServer()).resolves.toBeUndefined();

      expect(mockedMoodService.mergeServerMoods).not.toHaveBeenCalled();
      expect(get().moods).toBe(existing);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('changes nothing when a later page fails', async () => {
      const full = Array.from({ length: MOOD_HISTORY_PAGE_SIZE }, (_, i) =>
        serverRow({ id: `p1-${i}` })
      );
      mockedMoodApi.getMoodHistory
        .mockResolvedValueOnce(full)
        .mockRejectedValueOnce(new Error('server error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().loadMoodHistoryFromServer();

      expect(mockedMoodService.mergeServerMoods).not.toHaveBeenCalled();
    });

    it('writes nothing when the account changed during the read', async () => {
      let settle: (rows: never[]) => void = () => {};
      mockedMoodApi.getMoodHistory.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().loadMoodHistoryFromServer();
      set({ userId: 'user-B', authSessionVersion: 2 } as never);
      settle([serverRow()]);
      await inFlight;

      expect(mockedMoodService.mergeServerMoods).not.toHaveBeenCalled();
      expect(get().moods).toEqual([]);
    });

    it('writes nothing when the same account signed in again during the read', async () => {
      let settle: (rows: never[]) => void = () => {};
      mockedMoodApi.getMoodHistory.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().loadMoodHistoryFromServer();
      set({ authSessionVersion: 2 } as never);
      settle([serverRow()]);
      await inFlight;

      expect(mockedMoodService.mergeServerMoods).not.toHaveBeenCalled();
    });

    it('does not reload into state when the account changed during the merge', async () => {
      mockedMoodApi.getMoodHistory.mockResolvedValue([serverRow()]);
      let finishMerge: (changed: boolean) => void = () => {};
      mockedMoodService.mergeServerMoods.mockReturnValue(
        new Promise((resolve) => (finishMerge = resolve))
      );

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().loadMoodHistoryFromServer();
      await vi.waitFor(() => expect(mockedMoodService.mergeServerMoods).toHaveBeenCalled());
      set({ userId: 'user-B', authSessionVersion: 2 } as never);
      finishMerge(true);
      await inFlight;

      expect(mockedMoodService.getAllForUser).not.toHaveBeenCalled();
      expect(get().moods).toEqual([]);
    });

    it('does nothing when no one is signed in', async () => {
      const { get } = createTestStore({ userId: null });
      await get().loadMoodHistoryFromServer();
      expect(mockedMoodApi.getMoodHistory).not.toHaveBeenCalled();
    });
  });
});
