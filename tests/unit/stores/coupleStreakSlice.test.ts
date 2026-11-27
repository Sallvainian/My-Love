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

import { lookupPartnerId } from '../../../src/api/supabaseClient';
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
import { deferred, storeWritesDuring } from './loaderIdentityGuardsFixture';

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

// Sets the shown partner; a change from one id to another is a new pair.
const withPartner = (id: string) =>
  useAppStore.setState({
    partner: {
      id,
      email: 'p@example.com',
      displayName: 'Harper',
      linkedSince: null,
      birthday: null,
    },
    partnerKnown: true,
  });

const savedCopy = (userId: string = A) => readLocalCopy<unknown>(userId, DAILY_STREAK_COPY_KIND);

beforeEach(async () => {
  vi.clearAllMocks();
  fetchCoupleStreak.mockReset();
  vi.mocked(lookupPartnerId).mockReset();
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

  it('an overlapping call asks for one more read after the running one: its answer is kept', async () => {
    const older = deferred<ReturnType<typeof okStreak>>();
    const newer = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const shown: number[] = [];
    const unsubscribe = useAppStore.subscribe((next) => {
      if (next.coupleStreak?.status !== 'ok') return;
      const held = next.coupleStreak.streak.held;
      if (shown.at(-1) !== held) shown.push(held);
    });

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    // The second call asks for its trailing pass as it is made and sends nothing while the
    // first read runs. A read that started at once would set the loading flag in this same
    // turn; a read of its own would also show a third answer, which `shown` below rules out.
    let second!: Promise<void>;
    const writes = storeWritesDuring(() => {
      second = state().loadCoupleStreak();
    });
    expect(writes).toBe(0);
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
    older.settle(okStreak({ held: 7 }));
    // The trailing read starts after the first one ends, and both promises wait for it.
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(2));
    expect(state().coupleStreakLoading).toBe(true);
    newer.settle(okStreak({ held: 8 }));
    await Promise.all([first, second]);
    unsubscribe();

    // The running read's answer was shown, then the trailing read's replaced it.
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(shown).toEqual([7, 8]);
    expect(state().coupleStreak).toEqual(okStreak({ held: 8 }));
    expect(state().coupleStreakLoading).toBe(false);
  });

  it("the streak stays loading from the running read's answer to the trailing read's", async () => {
    const running = deferred<ReturnType<typeof okStreak>>();
    const trailing = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValueOnce(running.promise).mockReturnValueOnce(trailing.promise);
    const loadingWhenShown: boolean[] = [];
    const unsubscribe = useAppStore.subscribe((next, previous) => {
      if (next.coupleStreak !== previous.coupleStreak && next.coupleStreak?.status === 'ok') {
        loadingWhenShown.push(next.coupleStreakLoading);
      }
    });

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    const second = state().loadCoupleStreak();
    running.settle(okStreak({ held: 7 }));
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(2));
    // The 7 is shown, but Daily's claim gate must wait for the 8 that is already on its way.
    expect(state().coupleStreak).toEqual(okStreak({ held: 7 }));
    expect(state().coupleStreakLoading).toBe(true);
    trailing.settle(okStreak({ held: 8 }));
    await Promise.all([first, second]);
    unsubscribe();

    expect(loadingWhenShown).toEqual([true, false]);
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('three overlapping calls send exactly two reads', async () => {
    const running = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReturnValueOnce(running.promise)
      .mockResolvedValueOnce(okStreak({ held: 9 }));
    const shown: number[] = [];
    const unsubscribe = useAppStore.subscribe((next) => {
      if (next.coupleStreak?.status !== 'ok') return;
      const held = next.coupleStreak.streak.held;
      if (shown.at(-1) !== held) shown.push(held);
    });

    const calls = [state().loadCoupleStreak()];
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    // A call asks for its trailing pass as it is made, so no wait is needed between the calls.
    // A read that started at once would set the loading flag in this same turn.
    const writes = storeWritesDuring(() => {
      calls.push(state().loadCoupleStreak());
      calls.push(state().loadCoupleStreak());
    });
    expect(writes).toBe(0);
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
    running.settle(okStreak({ held: 8 }));
    await Promise.all(calls);
    unsubscribe();

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(shown).toEqual([8, 9]);
    expect(state().coupleStreak).toEqual(okStreak({ held: 9 }));
  });

  it("the first caller's promise settles after its own read, and a call that arrived mid-read settles after the trailing read", async () => {
    const running = deferred<ReturnType<typeof okStreak>>();
    const trailing = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValueOnce(running.promise).mockReturnValueOnce(trailing.promise);
    const settled: string[] = [];

    const first = state()
      .loadCoupleStreak()
      .then(() => {
        settled.push('first');
      });
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    const second = state()
      .loadCoupleStreak()
      .then(() => {
        settled.push('second');
      });
    running.settle(okStreak({ held: 7 }));
    await first;
    // The trailing read is out and the first caller is already done.
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(2));
    expect(settled).toEqual(['first']);
    expect(state().coupleStreakLoading).toBe(true);
    trailing.settle(okStreak({ held: 8 }));
    await second;

    expect(settled).toEqual(['first', 'second']);
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
  });

  it('a call after the reads ended starts a new read', async () => {
    fetchCoupleStreak
      .mockResolvedValueOnce(okStreak({ held: 1 }))
      .mockResolvedValueOnce(okStreak({ held: 2 }));

    await state().loadCoupleStreak();
    await state().loadCoupleStreak();

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state().coupleStreak).toEqual(okStreak({ held: 2 }));
  });

  it('a failed running read still gets its trailing read, and its answer clears the error', async () => {
    const running = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReturnValueOnce(running.promise)
      .mockResolvedValueOnce(okStreak({ held: 3 }));

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    const second = state().loadCoupleStreak();
    running.fail(new Error('boom'));
    await Promise.all([first, second]);

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state().coupleStreak).toEqual(okStreak({ held: 3 }));
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

    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 12 }), partner_id: null });
  });

  it('keeps the saved tag when the partner lookup answers an error', async () => {
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'error', reason: 'x' });
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, { ...coupleStreak({ held: 2 }), partner_id: 'PARTNER-OLD' });
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 3 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 3 }), partner_id: 'PARTNER-OLD' });
  });

  it('keeps the saved tag when the partner lookup throws', async () => {
    vi.mocked(lookupPartnerId).mockRejectedValue(new Error('boom'));
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, { ...coupleStreak({ held: 2 }), partner_id: 'PARTNER-OLD' });
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 3 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 3 }), partner_id: 'PARTNER-OLD' });
  });

  it('replaces an older saved streak, one saved before the calendar week included, with the new ok answer', async () => {
    const before = coupleStreak({ held: 2 });
    delete before.calendar_week;
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, before);
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 3 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 3 }), partner_id: null });
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
    const saved = coupleStreak({ held: 6 });
    delete saved.calendar_week;
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, saved);
    fetchCoupleStreak.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. The streak needs a connection to load.')
    );

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual({ status: 'ok', streak: saved });
    expect(state().coupleStreak).not.toHaveProperty('streak.calendar_week');
    expect(state().coupleStreakError).toBe(
      'You are offline. The streak needs a connection to load.'
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(await savedCopy()).toEqual(saved);
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
      // Only a new pair starts a read beside the running one: a plain call joins it.
      withPartner('PARTNER-A-ID');
      await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 7 }));

      const first = state().loadCoupleStreak();
      withPartner('PARTNER-C-ID');
      await first;
      await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 7 })));

      expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
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
      withPartner('PARTNER-A-ID');
      const older = deferred<ReturnType<typeof okStreak>>();
      fetchCoupleStreak
        .mockReturnValueOnce(older.promise)
        .mockResolvedValueOnce(okStreak({ held: 8 }));

      const first = state().loadCoupleStreak();
      await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
      withPartner('PARTNER-C-ID');
      await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 8 })));
      older.settle(okStreak({ held: 7 }));
      await first;

      expect(await savedCopy()).toEqual({
        ...coupleStreak({ held: 8 }),
        partner_id: 'PARTNER-C-ID',
      });
    });
  });

  it('refreshLocalCopy runs the streak read', async () => {
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 5 }));

    await refreshLocalCopy(DAILY_STREAK_COPY_KIND);

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
    expect(state().coupleStreak).toEqual(okStreak({ held: 5 }));
    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 5 }), partner_id: null });
  });

  it("sign-out deletes the outgoing account's copy and keeps another account's", async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 3 }));
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 4 }));

    state().clearAuth();

    await vi.waitFor(async () => expect(await savedCopy(A)).toBeNull());
    expect(await savedCopy(B)).toEqual(coupleStreak({ held: 4 }));
  });
});

describe('the partner changes in the session', () => {
  const PARTNER_A = 'PARTNER-A-ID';
  const PARTNER_C = 'PARTNER-C-ID';
  const unlink = () => useAppStore.setState({ partner: null, partnerKnown: true });

  beforeEach(() => {
    // A read started by a partner change stays open unless a test answers it.
    fetchCoupleStreak.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    useAppStore.setState({ partner: null, partnerKnown: false });
  });

  it('tags the saved streak with the partner in the store', async () => {
    withPartner(PARTNER_A);
    fetchCoupleStreak.mockResolvedValue(okStreak({ held: 6 }));

    await state().loadCoupleStreak();

    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 6 }), partner_id: PARTNER_A });
  });

  it('shows a saved streak first only for the partner it was read with', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, {
      ...coupleStreak({ held: 6 }),
      partner_id: PARTNER_A,
    });
    withPartner(PARTNER_A);
    fetchCoupleStreak.mockRejectedValue(new Error('boom'));

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));
  });

  it("does not show another partner's saved streak, so offline there is nothing to show", async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, {
      ...coupleStreak({ held: 6 }),
      partner_id: PARTNER_A,
    });
    withPartner(PARTNER_C);
    fetchCoupleStreak.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. The streak needs a connection to load.')
    );

    await state().loadCoupleStreak();

    expect(state().coupleStreak).toBeNull();
    expect(state().coupleStreakError).toBe(
      'You are offline. The streak needs a connection to load.'
    );
  });

  it('an untagged saved streak is hidden for a known partner and shown when none is known', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 6 }));
    fetchCoupleStreak.mockRejectedValue(new Error('boom'));

    withPartner(PARTNER_A);
    await state().loadCoupleStreak();
    expect(state().coupleStreak).toBeNull();

    useAppStore.setState({ partner: null, partnerKnown: true, coupleStreak: null });
    await state().loadCoupleStreak();
    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));
  });

  it('a new partner clears the streak and its error, and reads it again for the new partner', () => {
    withPartner(PARTNER_A);
    useAppStore.setState({
      coupleStreak: okStreak({ held: 6 }),
      coupleStreakError: 'old',
      coupleStreakLoading: true,
    });

    withPartner(PARTNER_C);

    expect(state().coupleStreak).toBeNull();
    expect(state().coupleStreakError).toBeNull();
    // The old read's flag is gone; this one is the new partner's read.
    expect(state().coupleStreakLoading).toBe(true);
  });

  it('a new partner after an unlink clears it too', () => {
    withPartner(PARTNER_A);
    useAppStore.setState({ coupleStreak: okStreak({ held: 6 }) });
    unlink();
    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));

    withPartner(PARTNER_C);

    expect(state().coupleStreak).toBeNull();
  });

  it('a first link and a reload of the same partner clear nothing', () => {
    useAppStore.setState({ coupleStreak: okStreak({ held: 6 }) });
    withPartner(PARTNER_A);
    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));

    withPartner(PARTNER_A);
    unlink();
    withPartner(PARTNER_A);

    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));
  });

  it('an identity change forgets the last partner', () => {
    withPartner(PARTNER_A);
    state().clearAuth();
    state().setAuthUser(A);

    useAppStore.setState({
      partner: {
        id: PARTNER_C,
        email: 'p@example.com',
        displayName: 'Harper',
        linkedSince: null,
        birthday: null,
      },
      partnerKnown: true,
      coupleStreak: okStreak({ held: 2 }),
    });

    expect(state().coupleStreak).toEqual(okStreak({ held: 2 }));
  });

  it("a change during an in-flight read ends with the new partner's answer, no view needed", async () => {
    withPartner(PARTNER_A);
    const old = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValueOnce(old.promise).mockResolvedValueOnce(okStreak({ held: 9 }));

    const load = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 9 })));
    old.settle(okStreak({ held: 1 }));
    await load;

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state().coupleStreak).toEqual(okStreak({ held: 9 }));
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('a change with a streak shown starts a read for the new partner', async () => {
    withPartner(PARTNER_A);
    useAppStore.setState({ coupleStreak: okStreak({ held: 6 }) });
    fetchCoupleStreak.mockResolvedValueOnce(okStreak({ held: 2 }));

    withPartner(PARTNER_C);

    await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 2 })));
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(1);
  });

  it('a change with nothing shown or loading starts no read', async () => {
    withPartner(PARTNER_A);

    withPartner(PARTNER_C);
    await Promise.resolve();

    expect(fetchCoupleStreak).not.toHaveBeenCalled();
    expect(state().coupleStreakLoading).toBe(false);
  });

  it('a change while signed out starts no read', async () => {
    withPartner(PARTNER_A);
    state().clearAuth();
    useAppStore.setState({ coupleStreak: okStreak({ held: 6 }) });
    withPartner(PARTNER_A);

    withPartner(PARTNER_C);
    await Promise.resolve();

    expect(fetchCoupleStreak).not.toHaveBeenCalled();
  });

  it('a read in flight for the old partner writes nothing, to the field or the copy', async () => {
    withPartner(PARTNER_A);
    const request = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValue(request.promise);

    const load = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
    withPartner(PARTNER_C);
    request.settle(okStreak({ held: 9 }));
    await load;

    expect(state().coupleStreak).toBeNull();
    // Only the new partner's read, still open, holds the flag.
    expect(state().coupleStreakLoading).toBe(true);
    expect(await savedCopy()).toBeNull();
  });

  it('a failure of the old partner read leaves no error behind', async () => {
    withPartner(PARTNER_A);
    const request = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak.mockReturnValue(request.promise);

    const load = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
    withPartner(PARTNER_C);
    request.fail(new Error('late'));
    await load;

    expect(state().coupleStreakError).toBeNull();
  });

  it("the new partner's failed read shows no streak of the old pair", async () => {
    withPartner(PARTNER_A);
    fetchCoupleStreak.mockResolvedValueOnce(okStreak({ held: 6 }));
    await state().loadCoupleStreak();
    expect(state().coupleStreak).toEqual(okStreak({ held: 6 }));

    // The pair change itself starts the new partner's read.
    fetchCoupleStreak.mockRejectedValueOnce(new AccountDataError('transport', 'boom'));
    withPartner(PARTNER_C);
    await vi.waitFor(() => expect(state().coupleStreakError).toBe('boom'));

    expect(state().coupleStreak).toBeNull();
    expect(await savedCopy()).toEqual({ ...coupleStreak({ held: 6 }), partner_id: PARTNER_A });
  });

  it("a new pair's read never joins the old pair's: an old failure landing last changes nothing", async () => {
    withPartner(PARTNER_A);
    const older = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReset()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(okStreak({ held: 8 }));

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    // The new pair's own read sends at once, though the old pair's is still open.
    await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 8 })));
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    older.fail(new Error('late'));
    await first;

    // Nothing asked the old read for a trailing pass, so its end sends nothing more.
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state().coupleStreak).toEqual(okStreak({ held: 8 }));
    expect(state().coupleStreakError).toBeNull();
  });

  it('a call during the new pair read joins that read, not the old one', async () => {
    withPartner(PARTNER_A);
    const older = deferred<ReturnType<typeof okStreak>>();
    const newer = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReset()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
      .mockResolvedValueOnce(okStreak({ held: 5 }));

    void state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(2));
    const joined = state().loadCoupleStreak();
    newer.settle(okStreak({ held: 4 }));
    await joined;

    // One trailing pass for the new pair after its running read.
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(3);
    expect(state().coupleStreak).toEqual(okStreak({ held: 5 }));
    older.settle(okStreak({ held: 1 }));
  });

  it('a trailing pass asked for before a pair change is never sent for the old pair', async () => {
    withPartner(PARTNER_A);
    const older = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReset()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValue(okStreak({ held: 8 }));

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    const dropped = state().loadCoupleStreak();
    // The pair change starts the new pair's read, which is the second and last one.
    withPartner(PARTNER_C);
    await vi.waitFor(() => expect(state().coupleStreak).toEqual(okStreak({ held: 8 })));
    older.settle(okStreak({ held: 1 }));
    await first;
    // The call that asked for the dropped pass settles; it is not left hanging.
    await expect(dropped).resolves.toBeUndefined();

    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    expect(state().coupleStreak).toEqual(okStreak({ held: 8 }));
  });

  it("the old pair's read ending leaves the new pair's read in its slot", async () => {
    withPartner(PARTNER_A);
    const older = deferred<ReturnType<typeof okStreak>>();
    const newer = deferred<ReturnType<typeof okStreak>>();
    fetchCoupleStreak
      .mockReset()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
      .mockResolvedValueOnce(okStreak({ held: 5 }));

    // The loading flag each time an ok answer is shown: a pass already asked for keeps it true.
    const loadingWhenShown: Array<[number, boolean]> = [];
    const unsubscribe = useAppStore.subscribe((next, previous) => {
      if (next.coupleStreak !== previous.coupleStreak && next.coupleStreak?.status === 'ok') {
        loadingWhenShown.push([next.coupleStreak.streak.held, next.coupleStreakLoading]);
      }
    });

    const first = state().loadCoupleStreak();
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    await vi.waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(2));
    older.settle(okStreak({ held: 1 }));
    await first;

    // The new pair's read is still open, so this call asks for a pass after it. A read of
    // its own would set the loading flag in this same turn, which is the old read leaving the
    // slot empty for the call to take.
    let joined!: Promise<void>;
    const writes = storeWritesDuring(() => {
      joined = state().loadCoupleStreak();
    });
    expect(writes).toBe(0);
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(2);
    newer.settle(okStreak({ held: 4 }));
    await joined;
    unsubscribe();

    // The new pair's 4 is shown while the pass asked for behind it is still to come.
    expect(loadingWhenShown).toEqual([
      [4, true],
      [5, false],
    ]);
    expect(fetchCoupleStreak).toHaveBeenCalledTimes(3);
    expect(state().coupleStreak).toEqual(okStreak({ held: 5 }));
  });
});
