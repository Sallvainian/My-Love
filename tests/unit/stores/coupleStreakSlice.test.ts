/**
 * The couple's streak in the store: `loadCoupleStreak` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked.
 * Covers the ok and unlinked answers, the failed-read rule (a failure keeps the
 * shown answer and never becomes unlinked), the newest-read-wins rule, the
 * session check after the await and the `daily-streak` local copy (real
 * fake-indexeddb): shown first over nothing, replaced by `ok`, deleted by
 * `unlinked`, left by a failure, deleted on sign-out.
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

// Call-through spies on the sign-out deletes and cancel, so afterEach can wait for them.
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
import { DAILY_STREAK_COPY_KIND } from '../../../src/services/dailyStreakCopy';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { deleteAccountImages } from '../../../src/services/imageCache';
import {
  deleteAccountCopies,
  readLocalCopy,
  refreshLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';
import * as localCopy from '../../../src/services/localCopy';
import { moodService } from '../../../src/services/moodService';
import { useAppStore } from '../../../src/stores/useAppStore';
import { accountDeletesSettled, setOnline } from './accountDataFixtures';
import { coupleStreak } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const B = 'USER-B-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

const okStreak = (overrides: Parameters<typeof coupleStreak>[0] = {}) => ({
  status: 'ok' as const,
  streak: coupleStreak(overrides),
});

async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

const savedCopy = (userId: string = A) => readLocalCopy<unknown>(userId, DAILY_STREAK_COPY_KIND);

beforeEach(async () => {
  vi.clearAllMocks();
  fetchCoupleStreak.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(moodService, 'deleteSyncedForUser');
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
  // After the identity setup: clearAuth's copy deletion is fire-and-forget.
  await clearCopies();
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
  await clearCopies();
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
    // The first read must be past its copy read, or the second supersedes it
    // before it fetches.
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
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
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
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

describe('the daily-streak local copy', () => {
  it('saves an ok answer', async () => {
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 12 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual(coupleStreak({ held: 12 }));
  });

  it('replaces an older saved streak with the new ok answer', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 2 }));
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 3 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual(coupleStreak({ held: 3 }));
    expect(state().coupleStreak).toEqual(okStreak({ held: 3 }));
  });

  it('an unlinked answer shows unlinked and deletes the copy', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 2 }));
    fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual({ status: 'unlinked' });
    expect(await savedCopy()).toBeNull();
  });

  it('a failed read leaves the copy and the shown streak, and sets the error', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
    fetchCoupleStreak.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual(coupleStreak({ held: 6 }));
    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));
    expect(state().coupleStreakError).toBe('boom');
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('shows the saved streak before the server answers', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
    const request = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValue(request.promise);

    const load = state().loadCoupleStreak();
    await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 6 })));
    expect(state().coupleStreakLoading).toBe(true);
    request.settle(okStreak({ held: 7 }));
    await load;

    expect(state().coupleStreak).toEqual(okStreak({ held: 7 }));
  });

  it('offline with a saved streak: shows it and sets the error, unlogged', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
    fetchCoupleStreak.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. The streak needs a connection to load.')
    );

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));
    expect(state().coupleStreakError).toBe(
      'You are offline. The streak needs a connection to load.'
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(await savedCopy()).toEqual(coupleStreak({ held: 6 }));
  });

  it('offline with nothing saved: nothing is shown and the error says the streak needs a connection', async () => {
    fetchCoupleStreak.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. The streak needs a connection to load.')
    );

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toBeNull();
    expect(state().coupleStreakError).toBe(
      'You are offline. The streak needs a connection to load.'
    );
  });

  it('does not show the copy over an answer already in memory', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 1 }));
    useAppStore.setState({ coupleStreak: okStreak({ held: 9 }) });
    const request = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValue(request.promise);

    const load = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
    expect(state().coupleStreak).toEqual(okStreak({ held: 9 }));
    request.settle(okStreak({ held: 9 }));
    await load;
  });

  it('does not show the copy over an unlinked answer in memory', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 1 }));
    useAppStore.setState({ coupleStreak: { status: 'unlinked' } });
    fetchCoupleStreak.mockRejectedValue(new Error('boom'));

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual({ status: 'unlinked' });
  });

  it('a save failure is logged and the shown answer is kept', async () => {
    const failure = new Error('WRITE-FAILED');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(failure);
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 4 }));

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual(okStreak({ held: 4 }));
    expect(state().coupleStreakError).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "[DailyQuestion] Failed to save the couple's streak copy:",
      failure
    );
  });

  describe('a session change', () => {
    it('a newer read during the copy read: the older read never fetches', async () => {
      await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 7 }));

      const first = state().loadCoupleStreak();
      await state().loadCoupleStreak();
      await first;

      expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
      expect(state().coupleStreak).toEqual(okStreak({ held: 7 }));
    });

    it('during the copy read: nothing is written to state or copy', async () => {
      await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 7 }));

      const load = state().loadCoupleStreak();
      state().clearAuth();
      await load;
      await vi.waitFor(async () => expect(await savedCopy()).toBeNull());

      expect(fetchCoupleStreak).not.toHaveBeenCalled();
      expect(state().coupleStreak).toBeNull();
    });

    it('during the fetch: the answer is not saved', async () => {
      const request = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak.mockReturnValue(request.promise);

      const load = state().loadCoupleStreak();
      await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
      state().clearAuth();
      request.settle(okStreak({ held: 7 }));
      await load;

      expect(await savedCopy()).toBeNull();
      expect(state().coupleStreak).toBeNull();
    });

    it('a newer read during the fetch: the older answer is not saved', async () => {
      const older = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(okStreak({ held: 8 }));

      const first = state().loadCoupleStreak();
      await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
      await state().loadCoupleStreak();
      older.settle(okStreak({ held: 7 }));
      await first;

      expect(await savedCopy()).toEqual(coupleStreak({ held: 8 }));
    });
  });

  it('refreshLocalCopy runs the streak read', async () => {
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 5 }));

    await refreshLocalCopy(DAILY_STREAK_COPY_KIND);

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state().coupleStreak).toEqual(okStreak({ held: 5 }));
    expect(await savedCopy()).toEqual(coupleStreak({ held: 5 }));
  });

  it("sign-out deletes the outgoing account's copy and keeps another account's", async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 3 }));
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 4 }));

    state().clearAuth();

    await vi.waitFor(async () => expect(await savedCopy(A)).toBeNull());
    expect(await savedCopy(B)).toEqual(coupleStreak({ held: 4 }));
  });
});
