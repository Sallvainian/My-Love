/**
 * The couple's streak in the store: `loadCoupleStreak` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked.
 * Covers the ok and unlinked answers, the failed-read rule (a failure keeps the
 * shown answer and never becomes unlinked), the newest-read-wins rule and the
 * session check after the await.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchCoupleStreak = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/dailyQuestionApi')>()),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import { useAppStore } from '../../../src/stores/useAppStore';
import { coupleStreak } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

const okStreak = (overrides: Parameters<typeof coupleStreak>[0] = {}) => ({
  status: 'ok' as const,
  streak: coupleStreak(overrides),
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchCoupleStreak.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state().clearAuth();
  state().setAuthUser(A);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadCoupleStreak', () => {
  it('stores an ok answer, clears the loading flag and the error', async () => {
    useAppStore.setState({ coupleStreakError: 'old' });
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 12 }));

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual(okStreak({ held: 12 }));
    expect(state().coupleStreakLoading).toBe(false);
    expect(state().coupleStreakError).toBeNull();
  });

  it('raises the loading flag while the request is open', async () => {
    const request = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValue(request.promise);

    const load = state().loadCoupleStreak();
    expect(state().coupleStreakLoading).toBe(true);
    request.settle(okStreak());
    await load;

    expect(state().coupleStreakLoading).toBe(false);
  });

  it('stores an unlinked answer', async () => {
    fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual({ status: 'unlinked' });
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadCoupleStreak();

    expect(fetchCoupleStreak).not.toHaveBeenCalled();
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('never throws: a failed first read sets the error and leaves nothing shown', async () => {
    const failure = new AccountDataError('transport', 'boom');
    fetchCoupleStreak.mockRejectedValue(failure);

    await expect(state().loadCoupleStreak()).resolves.toBeUndefined();

    expect(state().coupleStreak).toBeNull();
    expect(state().coupleStreakError).toBe('boom');
    expect(state().coupleStreakLoading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "[DailyQuestion] Failed to load the couple's streak:",
      failure
    );
  });

  it('an offline refusal sets the error but is not logged', async () => {
    fetchCoupleStreak.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. The streak needs a connection to load.')
    );

    await state().loadCoupleStreak();

    expect(state().coupleStreakError).toBe(
      'You are offline. The streak needs a connection to load.'
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('a failed read keeps the shown answer, and never turns it into unlinked', async () => {
    fetchCoupleStreak.mockResolvedValueOnce(okStreak({ held: 5 }));
    await state().loadCoupleStreak();

    fetchCoupleStreak.mockRejectedValueOnce(new AccountDataError('offline', 'You are offline.'));
    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual(okStreak({ held: 5 }));
    expect(state().coupleStreakError).toBe('You are offline.');
  });

  it('a later successful read clears the error', async () => {
    fetchCoupleStreak.mockRejectedValueOnce(new Error('boom'));
    await state().loadCoupleStreak();
    expect(state().coupleStreakError).toBe('boom');

    fetchCoupleStreak.mockResolvedValueOnce(okStreak());
    await state().loadCoupleStreak();

    expect(state().coupleStreakError).toBeNull();
  });

  it('two overlapping reads: the newer answer is kept when the older lands last', async () => {
    const older = deferred<ReturnType<typeof okStreak>>();
    const newer = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const first = state().loadCoupleStreak();
    const second = state().loadCoupleStreak();
    newer.settle(okStreak({ held: 8 }));
    await second;
    older.settle(okStreak({ held: 7 }));
    await first;

    expect(state().coupleStreak).toEqual(okStreak({ held: 8 }));
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('an older failure landing after a newer answer changes nothing', async () => {
    const older = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(okStreak({ held: 8 }));

    const first = state().loadCoupleStreak();
    await state().loadCoupleStreak();
    older.fail(new Error('late'));
    await first;

    expect(state().coupleStreak).toEqual(okStreak({ held: 8 }));
    expect(state().coupleStreakError).toBeNull();
  });

  describe('a session change while the request is open', () => {
    it('discards the answer after a sign-out', async () => {
      const request = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak.mockReturnValue(request.promise);

      const load = state().loadCoupleStreak();
      state().clearAuth();
      request.settle(okStreak());
      await load;

      expect(state().coupleStreak).toBeNull();
      expect(state().coupleStreakLoading).toBe(false);
    });

    it('discards the answer after a switch to another account, keeping its own state', async () => {
      const request = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak.mockReturnValue(request.promise);

      const load = state().loadCoupleStreak();
      useAppStore.setState({ userId: C, coupleStreak: okStreak({ held: 3 }) });
      request.settle(okStreak({ held: 9 }));
      await load;

      expect(state().coupleStreak).toEqual(okStreak({ held: 3 }));
    });

    it('discards the answer after a same-account re-login', async () => {
      const request = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak.mockReturnValue(request.promise);

      const load = state().loadCoupleStreak();
      state().clearAuth();
      state().setAuthUser(A);
      request.settle(okStreak());
      await load;

      expect(state().coupleStreak).toBeNull();
    });

    it('discards a failure too: the error belongs to the old session', async () => {
      const request = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak.mockReturnValue(request.promise);

      const load = state().loadCoupleStreak();
      state().clearAuth();
      request.fail(new Error('boom'));
      await load;

      expect(state().coupleStreakError).toBeNull();
    });
  });
});
