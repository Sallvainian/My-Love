/**
 * The couple's past questions in the store: `loadDailyHistory` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked.
 * Covers the answer replacing the field, the failed-read rule (a failure keeps
 * the rows shown), an offline refusal not being logged, the newest-read-wins
 * rule, the session check after the await, and sign-out clearing the fields.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyHistory = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/dailyQuestionApi')>()),
  fetchDailyHistory: (...args: unknown[]) => fetchDailyHistory(...args),
}));

// Call-through spies on the sign-out deletes, so afterEach can wait for them.
vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return { ...actual, deleteAccountCopies: vi.fn(actual.deleteAccountCopies) };
});
vi.mock('../../../src/services/imageCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/imageCache')>();
  return { ...actual, deleteAccountImages: vi.fn(actual.deleteAccountImages) };
});
vi.mock('../../../src/services/dateReminders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/dateReminders')>();
  return { ...actual, cancelDateReminders: vi.fn(actual.cancelDateReminders) };
});

import { AccountDataError } from '../../../src/services/accountDataError';
import { cancelDateReminders } from '../../../src/services/dateReminders';
import { deleteAccountImages } from '../../../src/services/imageCache';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { moodService } from '../../../src/services/moodService';
import { useAppStore } from '../../../src/stores/useAppStore';
import { accountDeletesSettled, setOnline } from './accountDataFixtures';
import { revealSnapshot } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

const day = (id: string, date: string) => ({ ...revealSnapshot('this', 'that'), day_id: id, day: date });
const PAGE = [day('d2', '2026-11-05'), day('d1', '2026-11-04')];

beforeEach(() => {
  vi.clearAllMocks();
  fetchDailyHistory.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(moodService, 'deleteSyncedForUser');
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
});

afterEach(async () => {
  // Lets the sign-out deletes a test started finish before the file can end.
  await accountDeletesSettled(
    vi.mocked(deleteAccountCopies),
    vi.mocked(deleteAccountImages),
    vi.mocked(moodService.deleteSyncedForUser),
    vi.mocked(cancelDateReminders)
  );
  vi.restoreAllMocks();
});

describe('loadDailyHistory', () => {
  it('starts as null with nothing loading and no error', () => {
    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });

  it('stores the first page, clears the loading flag and the error', async () => {
    useAppStore.setState({ dailyHistoryError: 'old' });
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect(fetchDailyHistory).toHaveBeenCalledWith();
    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });

  it('replaces the field with the new page', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE).mockResolvedValueOnce([PAGE[0]]);

    await state().loadDailyHistory();
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual([PAGE[0]]);
  });

  it('stores an empty answer as [] (nothing to show), not null', async () => {
    fetchDailyHistory.mockResolvedValue([]);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual([]);
  });

  it('raises the loading flag while the request is open', async () => {
    const request = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const load = state().loadDailyHistory();
    expect(state().dailyHistoryLoading).toBe(true);
    request.settle(PAGE);
    await load;

    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadDailyHistory();

    expect(fetchDailyHistory).not.toHaveBeenCalled();
    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('never throws: a failed first read sets the error and shows nothing', async () => {
    const failure = new AccountDataError('transport', 'boom');
    fetchDailyHistory.mockRejectedValue(failure);

    await expect(state().loadDailyHistory()).resolves.toBeUndefined();

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryLoading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to load the past questions:',
      failure
    );
  });

  it('a failed read keeps the rows shown and sets the error', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();

    fetchDailyHistory.mockRejectedValueOnce(new Error('boom'));
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryError).toBe('boom');
  });

  it('an offline refusal sets the error but is not logged', async () => {
    fetchDailyHistory.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. Past questions needs a connection to load.')
    );

    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBe(
      'You are offline. Past questions needs a connection to load.'
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('a later successful read clears the error', async () => {
    fetchDailyHistory.mockRejectedValueOnce(new Error('boom'));
    await state().loadDailyHistory();
    expect(state().dailyHistoryError).toBe('boom');

    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBeNull();
  });

  it('two overlapping reads: the newer answer is kept when the older lands last', async () => {
    const older = deferred<typeof PAGE>();
    const newer = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const first = state().loadDailyHistory();
    const second = state().loadDailyHistory();
    newer.settle(PAGE);
    await second;
    older.settle([PAGE[1]]);
    await first;

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('an older failure landing after a newer answer changes nothing', async () => {
    const older = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValueOnce(older.promise).mockResolvedValueOnce(PAGE);

    const first = state().loadDailyHistory();
    await state().loadDailyHistory();
    older.fail(new Error('late'));
    await first;

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryError).toBeNull();
  });

  describe('a session change while the request is open', () => {
    it('discards the answer after a sign-out', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toBeNull();
      expect(state().dailyHistoryLoading).toBe(false);
    });

    it('discards the answer after a switch to another account, keeping its own state', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      useAppStore.setState({ userId: C, dailyHistory: [PAGE[1]] });
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toEqual([PAGE[1]]);
    });

    it('discards the answer after a same-account re-login', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      state().setAuthUser(A);
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toBeNull();
    });

    it('discards a failure too: the error belongs to the old session', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      request.fail(new Error('boom'));
      await load;

      expect(state().dailyHistoryError).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  it('sign-out clears the rows, the loading flag and the error', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();
    useAppStore.setState({ dailyHistoryLoading: true, dailyHistoryError: 'x' });

    state().clearAuth();

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });
});
