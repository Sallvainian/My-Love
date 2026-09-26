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
import { createTestStore, makeMoodEntry, NOW } from './moodSliceFixture';

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

  describe('fetchPartnerMoods (partner-moods local copy)', () => {
    const USER = 'user-A';
    const PARTNER = 'partner-uuid';
    const copyKey = `${USER}|partner-moods`;

    const savedMood = {
      userId: PARTNER,
      mood: 'loved',
      moods: ['loved', 'happy'],
      note: 'SAVED-NOTE',
      date: '2026-08-02',
      timestamp: '2026-08-02T09:00:00.000Z',
      supabaseId: 'saved-1',
    };

    const serverRecord = {
      id: 'server-1',
      user_id: PARTNER,
      mood_type: 'tired',
      mood_types: ['tired'],
      note: 'SERVER-NOTE',
      created_at: '2026-08-03T09:00:00.000Z',
    } as never;

    it('offline with a copy: lists the saved moods and does not ask the server', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      savedCopies.set(copyKey, [savedMood]);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(mockedGetPartnerId).not.toHaveBeenCalled();
      expect(get().partnerMoods).toHaveLength(1);
      expect(get().partnerMoods[0]).toMatchObject({
        userId: PARTNER,
        mood: 'loved',
        moods: ['loved', 'happy'],
        note: 'SAVED-NOTE',
        date: '2026-08-02',
        synced: true,
        supabaseId: 'saved-1',
      });
      expect(get().partnerMoods[0].timestamp).toEqual(new Date('2026-08-02T09:00:00.000Z'));
      expect(mockedWriteLocalCopy).not.toHaveBeenCalled();
    });

    it('offline with no copy: stays empty', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods).toEqual([]);
      expect(mockedGetPartnerId).not.toHaveBeenCalled();
    });

    it('online: shows the copy first, then replaces it with the server list and saves that', async () => {
      savedCopies.set(copyKey, [savedMood]);
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      let settle: (rows: never[]) => void = () => {};
      mockedMoodSyncService.fetchMoods.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().fetchPartnerMoods(30);
      await vi.waitFor(() => expect(mockedMoodSyncService.fetchMoods).toHaveBeenCalled());
      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['saved-1']);

      settle([serverRecord]);
      await inFlight;

      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['server-1']);
      expect(mockedWriteLocalCopy).toHaveBeenCalledWith(USER, 'partner-moods', [
        {
          userId: PARTNER,
          mood: 'tired',
          moods: ['tired'],
          note: 'SERVER-NOTE',
          date: get().partnerMoods[0].date,
          timestamp: '2026-08-03T09:00:00.000Z',
          supabaseId: 'server-1',
        },
      ]);
    });

    it('online: zero rows replaces the list and saves []', async () => {
      savedCopies.set(copyKey, [savedMood]);
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      mockedMoodSyncService.fetchMoods.mockResolvedValue([]);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods).toEqual([]);
      expect(savedCopies.get(copyKey)).toEqual([]);
    });

    it('a failed server read keeps the copy and the state', async () => {
      savedCopies.set(copyKey, [savedMood]);
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      mockedMoodSyncService.fetchMoods.mockRejectedValue(new Error('network'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['saved-1']);
      expect(mockedWriteLocalCopy).not.toHaveBeenCalled();
      expect(savedCopies.get(copyKey)).toEqual([savedMood]);
    });

    it('a failed partner lookup keeps the copy and the state', async () => {
      savedCopies.set(copyKey, [savedMood]);
      mockedGetPartnerId.mockResolvedValue(null);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['saved-1']);
      expect(mockedWriteLocalCopy).not.toHaveBeenCalled();
    });

    it.each([
      ['not an array', { nope: true }],
      ['an entry with an unknown mood', [{ ...savedMood, mood: 'bogus', moods: ['bogus'] }]],
      ['an entry with a bad timestamp', [{ ...savedMood, timestamp: 'not-a-date' }]],
      ['an entry with a malformed date', [savedMood, { ...savedMood, date: '2026/08/02' }]],
    ])('ignores a malformed copy (%s)', async (_label, copy) => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      savedCopies.set(copyKey, copy);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods).toEqual([]);
    });

    it('never shows the copy again once this session has a server answer, even if saving it failed', async () => {
      savedCopies.set(copyKey, [savedMood]);
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      mockedMoodSyncService.fetchMoods.mockResolvedValue([]);
      mockedWriteLocalCopy.mockRejectedValue(new Error('quota'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);
      expect(get().partnerMoods).toEqual([]);
      // The failed save left the old copy in place.
      expect(savedCopies.get(copyKey)).toEqual([savedMood]);

      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods).toEqual([]);
    });

    it('does not lay the copy over moods already shown', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      savedCopies.set(copyKey, [savedMood]);
      const shown = [makeMoodEntry({ userId: PARTNER, supabaseId: 'shown' })];

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      set({ partnerMoods: shown } as Partial<MoodSlice>);
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods).toBe(shown);
    });

    it('skips a server row with a null created_at', async () => {
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      mockedMoodSyncService.fetchMoods.mockResolvedValue([
        serverRecord,
        { ...(serverRecord as object), id: 'no-time', created_at: null } as never,
      ]);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      await get().fetchPartnerMoods(30);

      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['server-1']);
    });

    it('shows and saves nothing when the account changed during the copy read', async () => {
      let settleCopy: (value: unknown) => void = () => {};
      mockedReadLocalCopy.mockReturnValue(new Promise((resolve) => (settleCopy = resolve)) as never);

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().fetchPartnerMoods(30);
      set({ userId: 'user-B', authSessionVersion: 2, partnerMoods: [] } as never);
      settleCopy([savedMood]);
      await inFlight;

      expect(get().partnerMoods).toEqual([]);
      expect(mockedGetPartnerId).not.toHaveBeenCalled();
      expect(mockedWriteLocalCopy).not.toHaveBeenCalled();
    });

    it('shows and saves nothing when the account changed during the server read', async () => {
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      let settle: (rows: never[]) => void = () => {};
      mockedMoodSyncService.fetchMoods.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      const { get, set } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const inFlight = get().fetchPartnerMoods(30);
      await vi.waitFor(() => expect(mockedMoodSyncService.fetchMoods).toHaveBeenCalled());
      set({ userId: 'user-B', authSessionVersion: 2, partnerMoods: [] } as never);
      settle([serverRecord]);
      await inFlight;

      expect(get().partnerMoods).toEqual([]);
      expect(mockedWriteLocalCopy).not.toHaveBeenCalled();
    });

    it('an older call landing after a newer one writes nothing', async () => {
      mockedGetPartnerId.mockResolvedValue(PARTNER);
      let settleOld: (rows: never[]) => void = () => {};
      mockedMoodSyncService.fetchMoods
        .mockReturnValueOnce(new Promise((resolve) => (settleOld = resolve)))
        .mockResolvedValueOnce([serverRecord]);

      const { get } = createTestStore({ userId: USER, authSessionVersion: 1 });
      const older = get().fetchPartnerMoods(30);
      await vi.waitFor(() => expect(mockedMoodSyncService.fetchMoods).toHaveBeenCalledTimes(1));
      await get().fetchPartnerMoods(30);
      settleOld([]);
      await older;

      expect(get().partnerMoods.map((m) => m.supabaseId)).toEqual(['server-1']);
      expect(mockedWriteLocalCopy).toHaveBeenCalledTimes(1);
    });
  });
});
