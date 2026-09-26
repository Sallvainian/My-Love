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

import { createTestStore, NOW, syncResult, type SyncBatch } from './moodSliceFixture';

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

  describe('syncPendingMoods', () => {
    it('sets isSyncing during sync and clears after', async () => {
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ synced: 1 }));
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      await get().syncPendingMoods();

      expect(get().syncStatus.isSyncing).toBe(false);
      expect(get().syncStatus.lastSyncAt).toBeInstanceOf(Date);
    });

    it('returns synced/failed counts', async () => {
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ synced: 3, failed: 1 }));
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      const result = await get().syncPendingMoods();

      expect(result).toEqual({ synced: 3, failed: 1, skipped: false });
    });

    it('resets isSyncing on error and re-throws', async () => {
      mockedMoodSyncService.syncPendingMoods.mockRejectedValue(new Error('sync failed'));

      const { get } = createTestStore();
      await expect(get().syncPendingMoods()).rejects.toThrow('sync failed');
      expect(get().syncStatus.isSyncing).toBe(false);
    });

    it('runs a second pass when a record was edited mid-sync', async () => {
      // A deferral means the write landed but the record stayed dirty on
      // purpose. Without a second pass the newer value sits unsynced until some
      // unrelated trigger fires, and the partner sees the stale mood meanwhile.
      mockedMoodSyncService.syncPendingMoods
        .mockResolvedValueOnce(syncResult({ deferred: 1 }))
        .mockResolvedValueOnce(syncResult({ synced: 1 }));
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      const result = await get().syncPendingMoods();

      expect(mockedMoodSyncService.syncPendingMoods).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ synced: 1, failed: 0, skipped: false });
    });

    it('runs no second pass when nothing was deferred', async () => {
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ synced: 1 }));
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      await get().syncPendingMoods();

      expect(mockedMoodSyncService.syncPendingMoods).toHaveBeenCalledTimes(1);
    });

    it('stops at two passes even if the second also defers', async () => {
      // Bounded on purpose: a user typing continuously would otherwise keep
      // producing deferrals and spin this loop for as long as they type.
      mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ deferred: 1 }));
      mockedMoodService.getAll.mockResolvedValue([]);
      mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
      mockedGetPartnerId.mockResolvedValue(null);

      const { get } = createTestStore();
      await get().syncPendingMoods();

      expect(mockedMoodSyncService.syncPendingMoods).toHaveBeenCalledTimes(2);
    });

    describe('when another context holds the sync lock', () => {
      beforeEach(() => {
        // Models the service worker, or a second tab, mid-batch. `isSyncing` is
        // per-context so it cannot see that; the lock can.
        Object.defineProperty(navigator, 'locks', {
          configurable: true,
          value: {
            request: async (
              _name: string,
              _options: { ifAvailable?: boolean },
              callback: (lock: null) => Promise<unknown>
            ) => callback(null),
          },
        });
      });

      // Cleanup in afterEach, not inline: an assertion failure above would
      // otherwise leak the always-null lock fake into every later describe.
      afterEach(() => {
        Reflect.deleteProperty(navigator, 'locks');
      });

      it('attempts nothing and reports the batch as skipped', async () => {
        const { get } = createTestStore();
        const result = await get().syncPendingMoods();

        expect(mockedMoodSyncService.syncPendingMoods).not.toHaveBeenCalled();
        // `skipped` matters: {synced: 0, failed: 0} alone is indistinguishable
        // from "nothing to sync", and the retry button treats that as success.
        expect(result).toEqual({ synced: 0, failed: 0, skipped: true });
        expect(get().syncStatus.isSyncing).toBe(false);
      });

      it('does not stamp lastSyncAt for a sync that never ran', async () => {
        const { get } = createTestStore();
        await get().syncPendingMoods();

        expect(get().syncStatus.lastSyncAt).toBeUndefined();
      });

      it('does not reload moods or overwrite the pending count', async () => {
        const { get } = createTestStore();
        await get().syncPendingMoods();

        expect(mockedMoodService.getAll).not.toHaveBeenCalled();
      });
    });

    /**
     * A batch outlives the session that raised it.
     *
     * App.tsx fires this from a 5-minute interval and from the `online` event,
     * and Sign Out is in the bottom nav of the screen showing the sync badge.
     * So A's batch routinely settles after B has signed in — and every write in
     * this action is account-scoped completion state: the spinner, the pending
     * count and `lastSyncAt`.
     *
     * Each case seeds a RECOGNISABLE successor status and asserts the whole
     * object is untouched, not just one field. Asserting `isSyncing === false`
     * alone would pass against a stale write, since that is what the stale
     * write sets it to.
     */
    describe('when the session ends before the batch settles', () => {
      const SUCCESSOR_STATUS = {
        pendingMoods: 7,
        isOnline: true,
        isSyncing: true,
        lastSyncAt: new Date('2026-01-01T00:00:00.000Z'),
      };

      /** A promise the test settles by hand, to hold the batch open across the switch */
      function gate<T>() {
        let settle: (value: T) => void = () => {};
        let fail: (reason: unknown) => void = () => {};
        const promise = new Promise<T>((resolve, reject) => {
          settle = resolve;
          fail = reject;
        });
        promise.catch(() => {});
        return { promise, settle, fail };
      }

      beforeEach(() => {
        mockedMoodService.getUnsyncedMoods.mockResolvedValue([]);
        mockedGetPartnerId.mockResolvedValue(null);
      });

      // Cleanup in afterEach, not inline: the lock-held case below installs a
      // gated lock fake, and an assertion failure there would otherwise leak it
      // into every later describe.
      afterEach(() => {
        Reflect.deleteProperty(navigator, 'locks');
      });

      it('leaves the replacement account’s sync status untouched on success', async () => {
        const pending = gate<SyncBatch>();
        mockedMoodSyncService.syncPendingMoods.mockReturnValue(pending.promise);

        const { get, set } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        const inFlight = get().syncPendingMoods();

        set({ userId: 'USER-B', authSessionVersion: 2, syncStatus: { ...SUCCESSOR_STATUS } });
        pending.settle(syncResult({ synced: 3 }));
        const result = await inFlight;

        expect(get().syncStatus).toEqual(SUCCESSOR_STATUS);
        // The caller that started the batch still gets the truth about it.
        expect(result).toEqual({ synced: 3, failed: 0, skipped: false });
      });

      it('launches no loaders on the replacement account’s behalf', async () => {
        const pending = gate<SyncBatch>();
        mockedMoodSyncService.syncPendingMoods.mockReturnValue(pending.promise);

        const { get, set } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        const inFlight = get().syncPendingMoods();

        set({ userId: 'USER-B', authSessionVersion: 2, syncStatus: { ...SUCCESSOR_STATUS } });
        pending.settle(syncResult({ synced: 1 }));
        await inFlight;

        // Skipping only the `set` is not enough: these reload B's moods and
        // refresh B's partner on a dead session's schedule.
        expect(mockedMoodService.getAllForUser).not.toHaveBeenCalled();
        expect(mockedGetPartnerId).not.toHaveBeenCalled();
      });

      it('leaves the replacement account’s sync status untouched on failure', async () => {
        const pending = gate<never>();
        mockedMoodSyncService.syncPendingMoods.mockReturnValue(pending.promise);

        const { get, set } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        const inFlight = get().syncPendingMoods();

        set({ userId: 'USER-B', authSessionVersion: 2, syncStatus: { ...SUCCESSOR_STATUS } });
        pending.fail(new Error('network'));

        // The rejection still reaches the caller; only the store write is dropped.
        await expect(inFlight).rejects.toThrow('network');
        expect(get().syncStatus).toEqual(SUCCESSOR_STATUS);
      });

      it('leaves the replacement account’s sync status untouched when the lock was held', async () => {
        const opened = gate<void>();
        Object.defineProperty(navigator, 'locks', {
          configurable: true,
          value: {
            request: async (
              _name: string,
              _options: { ifAvailable?: boolean },
              callback: (lock: null) => Promise<unknown>
            ) => {
              await opened.promise;
              return callback(null);
            },
          },
        });

        const { get, set } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        const inFlight = get().syncPendingMoods();

        set({ userId: 'USER-B', authSessionVersion: 2, syncStatus: { ...SUCCESSOR_STATUS } });
        opened.settle();
        const result = await inFlight;

        expect(get().syncStatus).toEqual(SUCCESSOR_STATUS);
        expect(result).toEqual({ synced: 0, failed: 0, skipped: true });
      });

      it('discards the batch when the same account signs back in', async () => {
        // The version-only half of the guard. `userId` is USER-A on both sides,
        // so an id-only compare lets this stale completion straight through.
        const pending = gate<SyncBatch>();
        mockedMoodSyncService.syncPendingMoods.mockReturnValue(pending.promise);

        const { get, set } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        const inFlight = get().syncPendingMoods();

        set({ userId: 'USER-A', authSessionVersion: 2, syncStatus: { ...SUCCESSOR_STATUS } });
        pending.settle(syncResult({ synced: 2 }));
        await inFlight;

        expect(get().syncStatus).toEqual(SUCCESSOR_STATUS);
        expect(mockedMoodService.getAllForUser).not.toHaveBeenCalled();
      });

      it('still completes normally for an uninterrupted session', async () => {
        // The control. Without it the guard could simply discard everything and
        // every assertion above would still pass.
        mockedMoodSyncService.syncPendingMoods.mockResolvedValue(syncResult({ synced: 1 }));

        const { get } = createTestStore({ userId: 'USER-A', authSessionVersion: 1 });
        await get().syncPendingMoods();

        expect(get().syncStatus.isSyncing).toBe(false);
        expect(get().syncStatus.lastSyncAt).toBeInstanceOf(Date);
        expect(mockedMoodService.getAllForUser).toHaveBeenCalledWith('USER-A');
      });
    });
  });
});
