/**
 * Daily Question in the store: `loadDailyDay`, `refreshDailyDay` and
 * `submitDailyPick` on the composed `useAppStore`, with only the Supabase
 * client and the API module mocked. Covers the no-regress rule, the failed-load rule and the session
 * check after every await.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();
const fetchDailyDayById = vi.fn();
const submitDailyPickRequest = vi.fn();
const announceDailyPick = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchDailyDayById: (...args: unknown[]) => fetchDailyDayById(...args),
  announceDailyPick: (...args: unknown[]) => announceDailyPick(...args),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
}));

import { DAY_CHANGED_MESSAGE } from '../../../src/api/dailyQuestionApi';
import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { dailySnapshot, revealSnapshot, waitingSnapshot, DAY_ID } from './dailyQuestionFixture';
import { setOnline } from './navigatorFixtures';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);
/** One minute past local midnight: the device's date is no longer the fixture's day. */
const NEXT_DAY = new Date(2026, 10, 6, 0, 1);

function state() {
  return useAppStore.getState();
}

const realLoadCoupleStreak = useAppStore.getState().loadCoupleStreak;
const loadCoupleStreak = vi.fn(async () => {});

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  announceDailyPick.mockReset();
  announceDailyPick.mockResolvedValue(undefined);
  // The streak read has its own tests; here only whether a pick asks for it.
  useAppStore.setState({ loadCoupleStreak });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
});

afterEach(() => {
  useAppStore.setState({ loadCoupleStreak: realLoadCoupleStreak });
  vi.useRealTimers();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('loadDailyDay', () => {
  it('stores an ok answer and clears the loading flag', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
    expect(state().dailyDayLoading).toBe(false);
    expect(state().dailyDayError).toBeNull();
  });

  it('raises the loading flag while the request is open', async () => {
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(request.promise);

    const load = state().loadDailyDay();
    expect(state().dailyDayLoading).toBe(true);
    request.settle(ok(dailySnapshot()));
    await load;

    expect(state().dailyDayLoading).toBe(false);
  });

  it('stores an unlinked answer', async () => {
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual({ status: 'unlinked' });
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadDailyDay();

    expect(fetchDailyDay).not.toHaveBeenCalled();
  });

  it('never throws: a failed first load sets the error and leaves nothing shown', async () => {
    const failure = new AccountDataError('transport', 'boom');
    fetchDailyDay.mockRejectedValue(failure);

    await expect(state().loadDailyDay()).resolves.toBeUndefined();

    expect(state().dailyDay).toBeNull();
    expect(state().dailyDayError).toBe('boom');
    expect(state().dailyDayLoading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "[DailyQuestion] Failed to load today's question:",
      failure
    );
  });

  it('a failed load keeps the shown answer, and never turns it into unlinked', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(waitingSnapshot('this')));
    await state().loadDailyDay();

    fetchDailyDay.mockRejectedValueOnce(new AccountDataError('transport', 'boom'));
    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    expect(state().dailyDayError).toBe('boom');
  });

  it('a later successful load clears the error', async () => {
    fetchDailyDay.mockRejectedValueOnce(new Error('boom'));
    await state().loadDailyDay();
    expect(state().dailyDayError).toBe('boom');

    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
    await state().loadDailyDay();

    expect(state().dailyDayError).toBeNull();
  });

  it('an unlinked answer replaces a shown snapshot (the server confirmed it)', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
    await state().loadDailyDay();

    fetchDailyDay.mockResolvedValueOnce({ status: 'unlinked' });
    await state().loadDailyDay();

    expect(state().dailyDay).toEqual({ status: 'unlinked' });
  });

  describe('the no-regress rule', () => {
    it.each([
      ['both', revealSnapshot('this', 'that'), dailySnapshot()],
      ['both', revealSnapshot('this', 'that'), waitingSnapshot('this')],
      ['me', waitingSnapshot('this'), dailySnapshot()],
      ['partner', dailySnapshot({ state: 'partner' }), dailySnapshot()],
    ])('a slower %s read is not replaced by a lower state of the same day', async (_s, stored, late) => {
      fetchDailyDay.mockResolvedValueOnce(ok(stored));
      await state().loadDailyDay();

      fetchDailyDay.mockResolvedValueOnce(ok(late));
      await state().loadDailyDay();

      expect(state().dailyDay).toEqual(ok(stored));
    });

    it.each([
      ['none', dailySnapshot(), waitingSnapshot('this')],
      ['none', dailySnapshot(), dailySnapshot({ state: 'partner' })],
      ['me', waitingSnapshot('this'), revealSnapshot('this', 'that')],
    ])('a higher state replaces the stored %s one', async (_s, stored, next) => {
      fetchDailyDay.mockResolvedValueOnce(ok(stored));
      await state().loadDailyDay();

      fetchDailyDay.mockResolvedValueOnce(ok(next));
      await state().loadDailyDay();

      expect(state().dailyDay).toEqual(ok(next));
    });

    it('a different day replaces the stored one whatever its state', async () => {
      fetchDailyDay.mockResolvedValueOnce(ok(revealSnapshot('this', 'that')));
      await state().loadDailyDay();

      const nextDay = dailySnapshot({ day_id: 'another-day', day: '2026-11-06' });
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));
      await state().loadDailyDay();

      expect(state().dailyDay).toEqual(ok(nextDay));
    });

    it.each([
      ['me', dailySnapshot(), waitingSnapshot('this'), dailySnapshot()],
      [
        'both',
        dailySnapshot({ state: 'partner' }),
        revealSnapshot('this', 'that'),
        waitingSnapshot('this'),
      ],
    ])(
      'a read open while a pick stores %s, settling lower, keeps the pick',
      async (_s, shown, picked, late) => {
        useAppStore.setState({ dailyDay: ok(shown) });
        const request = deferred<ReturnType<typeof ok>>();
        fetchDailyDay.mockReturnValue(request.promise);

        const load = state().loadDailyDay();
        submitDailyPickRequest.mockResolvedValue(picked);
        await state().submitDailyPick('this');
        request.settle(ok(late));
        await load;

        expect(state().dailyDay).toEqual(ok(picked));
      }
    );
  });

  describe('a session change while the request is open', () => {
    it('discards the answer after a sign-out', async () => {
      const request = deferred<ReturnType<typeof ok>>();
      fetchDailyDay.mockReturnValue(request.promise);

      const load = state().loadDailyDay();
      state().clearAuth();
      request.settle(ok(dailySnapshot()));
      await load;

      expect(state().dailyDay).toBeNull();
      expect(state().dailyDayLoading).toBe(false);
    });

    it('discards the answer after a switch to another account, keeping its own state', async () => {
      const request = deferred<ReturnType<typeof ok>>();
      fetchDailyDay.mockReturnValue(request.promise);

      const load = state().loadDailyDay();
      useAppStore.setState({ userId: C, dailyDay: ok(waitingSnapshot('that')) });
      request.settle(ok(dailySnapshot()));
      await load;

      expect(state().dailyDay).toEqual(ok(waitingSnapshot('that')));
    });

    it('discards the answer after a same-account re-login', async () => {
      const request = deferred<ReturnType<typeof ok>>();
      fetchDailyDay.mockReturnValue(request.promise);

      const load = state().loadDailyDay();
      state().clearAuth();
      state().setAuthUser(A);
      await deleteAccountCopies(A);
      request.settle(ok(dailySnapshot()));
      await load;

      expect(state().dailyDay).toBeNull();
    });

    it('discards a failure too: the error belongs to the old session', async () => {
      const request = deferred<ReturnType<typeof ok>>();
      fetchDailyDay.mockReturnValue(request.promise);

      const load = state().loadDailyDay();
      state().clearAuth();
      request.fail(new Error('boom'));
      await load;

      expect(state().dailyDayError).toBeNull();
    });
  });
});

describe('the saved days copy', () => {
  const saved = (snapshot: ReturnType<typeof dailySnapshot>) => ({
    [snapshot.day_id]: { ...snapshot, partner_id: null },
  });
  const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);

  it('shows the saved day for the device date before the fetch settles', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(waitingSnapshot('this')));
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(state().dailyDay).toEqual(ok(waitingSnapshot('this'))));
    expect(state().dailyDayLoading).toBe(true);
    request.settle(ok(waitingSnapshot('this')));
    await load;

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it("does not show a saved day that is not the device's date", async () => {
    await writeLocalCopy(
      A,
      DAILY_DAYS_COPY_KIND,
      saved(dailySnapshot({ day_id: 'yesterday', day: '2026-11-04' }))
    );
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));

    expect(state().dailyDay).toBeNull();
    request.settle(ok(dailySnapshot()));
    await load;
  });

  it('a saved day does not replace an unlinked answer that is shown', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: { status: 'unlinked' } });
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual({ status: 'unlinked' });
  });

  it('a saved day of the shown day_id keeps the higher state', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('writes the server answer into the copy, and an unlinked answer as an empty map', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(waitingSnapshot('this')));
    await state().loadDailyDay();
    expect(await copy()).toEqual(saved(waitingSnapshot('this')));

    fetchDailyDay.mockResolvedValueOnce({ status: 'unlinked' });
    await state().loadDailyDay();
    expect(await copy()).toEqual({});
  });

  it('a slower lower read changes neither the copy nor the screen', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(revealSnapshot('this', 'that')));
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this')));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(revealSnapshot('this', 'that')));
    expect(await copy()).toEqual(saved(revealSnapshot('this', 'that')));
  });

  describe('offline', () => {
    it('with today saved: shows it, sets no error and logs nothing when the API refuses offline', async () => {
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(waitingSnapshot('that')));
      setOnline(false);
      // The real API refuses offline before any request; mirror it here.
      fetchDailyDay.mockRejectedValue(
        new AccountDataError('offline', "You are offline. Today's question needs a connection to load.")
      );

      await state().loadDailyDay();

      expect(state().dailyDay).toEqual(ok(waitingSnapshot('that')));
      expect(state().dailyDayError).toBeNull();
      expect(state().dailyDayLoading).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('with none saved: sets the offline message and shows nothing', async () => {
      setOnline(false);
      fetchDailyDay.mockRejectedValue(
        new AccountDataError('offline', "You are offline. Today's question needs a connection to load.")
      );

      await state().loadDailyDay();

      expect(state().dailyDay).toBeNull();
      expect(state().dailyDayError).toBe(
        "You are offline. Today's question needs a connection to load."
      );
    });

    it('with only yesterday saved: sets the offline message and shows nothing', async () => {
      await writeLocalCopy(
        A,
        DAILY_DAYS_COPY_KIND,
        saved(dailySnapshot({ day_id: 'yesterday', day: '2026-11-04' }))
      );
      setOnline(false);
      fetchDailyDay.mockRejectedValue(
        new AccountDataError('offline', "You are offline. Today's question needs a connection to load.")
      );

      await state().loadDailyDay();

      expect(state().dailyDay).toBeNull();
      expect(state().dailyDayError).toMatch(/needs a connection to load/);
    });
  });

  describe('an online failure', () => {
    it('with today saved: keeps it, never the invitation, and shows the request error', async () => {
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
      fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

      await state().loadDailyDay();

      expect(state().dailyDay).toEqual(ok(dailySnapshot()));
      expect(state().dailyDayError).toBe('boom');
      expect(await copy()).toEqual(saved(dailySnapshot()));
    });

    it('with none saved: shows nothing, never unlinked, and does not write the copy', async () => {
      fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

      await state().loadDailyDay();

      expect(state().dailyDay).toBeNull();
      expect(state().dailyDayError).toBe('boom');
      expect(await copy()).toBeNull();
    });
  });

  it('a pick confirmed by the server is merged into the copy', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(await copy()).toEqual(saved(waitingSnapshot('this')));
  });

  it('writes no copy when the session changes while the read is open', async () => {
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    state().clearAuth();
    request.settle(ok(dailySnapshot()));
    await load;

    expect(await copy()).toBeNull();
    expect(state().dailyDay).toBeNull();
  });

  it('writes no copy when the session changes while a pick is open', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(await copy()).toBeNull();
  });
});

describe('refreshDailyDay', () => {
  const saved = (...snapshots: Array<ReturnType<typeof dailySnapshot>>) =>
    Object.fromEntries(
      snapshots.map((snapshot) => [snapshot.day_id, { ...snapshot, partner_id: null }])
    );
  const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
  const OTHER_DAY = dailySnapshot({ day_id: 'other-day', day: '2026-11-06' });

  it('asks for the named day', async () => {
    fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

    await state().refreshDailyDay(DAY_ID);

    expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID);
    expect(fetchDailyDay).not.toHaveBeenCalled();
  });

  it('shows that the partner picked first, and keeps it in the copy', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()), dailyDayError: 'old error' });
    fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

    await state().refreshDailyDay(DAY_ID);

    expect(state().dailyDay).toEqual(ok(dailySnapshot({ state: 'partner' })));
    expect(state().dailyDayError).toBeNull();
    expect(await copy()).toEqual(saved(dailySnapshot({ state: 'partner' })));
  });

  it('shows the reveal when the partner picks second', async () => {
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));

    await state().refreshDailyDay(DAY_ID);

    expect(state().dailyDay).toEqual(ok(revealSnapshot('this', 'that')));
    expect(await copy()).toEqual(saved(revealSnapshot('this', 'that')));
  });

  it('a slower lower re-read stays at the stored reveal, on screen and in the copy', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(revealSnapshot('this', 'that')));
    useAppStore.setState({ dailyDay: ok(revealSnapshot('this', 'that')) });
    fetchDailyDayById.mockResolvedValue(waitingSnapshot('this'));

    await state().refreshDailyDay(DAY_ID);

    expect(state().dailyDay).toEqual(ok(revealSnapshot('this', 'that')));
    expect(await copy()).toEqual(saved(revealSnapshot('this', 'that')));
  });

  it('another day than the one shown goes into the copy and leaves the screen alone', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()), dailyDayError: 'old error' });
    const partnerPicked = { ...OTHER_DAY, state: 'partner' as const };
    fetchDailyDayById.mockResolvedValue(partnerPicked);

    await state().refreshDailyDay('other-day');

    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
    expect(state().dailyDayError).toBe('old error');
    expect(await copy()).toEqual(saved(dailySnapshot(), partnerPicked));
  });

  describe('with nothing ok on screen', () => {
    it("shows the device's today, and clears the load error", async () => {
      useAppStore.setState({ dailyDay: null, dailyDayError: 'boom' });
      fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

      await state().refreshDailyDay(DAY_ID);

      expect(state().dailyDay).toEqual(ok(dailySnapshot({ state: 'partner' })));
      expect(state().dailyDayError).toBeNull();
      expect(await copy()).toEqual(saved(dailySnapshot({ state: 'partner' })));
    });

    it("does not show a day that is not the device's today, but keeps it in the copy", async () => {
      useAppStore.setState({ dailyDay: null, dailyDayError: 'boom' });
      fetchDailyDayById.mockResolvedValue(OTHER_DAY);

      await state().refreshDailyDay('other-day');

      expect(state().dailyDay).toBeNull();
      expect(state().dailyDayError).toBe('boom');
      expect(await copy()).toEqual(saved(OTHER_DAY));
    });
  });

  it('never throws: a failed re-read logs and changes nothing', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved(dailySnapshot()));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()), dailyDayError: 'old error' });
    const failure = new AccountDataError('transport', 'boom');
    fetchDailyDayById.mockRejectedValue(failure);

    await expect(state().refreshDailyDay(DAY_ID)).resolves.toBeUndefined();

    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
    expect(state().dailyDayError).toBe('old error');
    expect(await copy()).toEqual(saved(dailySnapshot()));
    expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Failed to re-read a day:', failure);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().refreshDailyDay(DAY_ID);

    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });

  it('leaves the copy and the screen alone when the session changes while the read is open', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    const request = deferred<ReturnType<typeof dailySnapshot>>();
    fetchDailyDayById.mockReturnValue(request.promise);

    const refresh = state().refreshDailyDay(DAY_ID);
    await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
    state().clearAuth();
    request.settle(dailySnapshot({ state: 'partner' }));
    await refresh;

    expect(await copy()).toBeNull();
    expect(state().dailyDay).toBeNull();
  });

  it('writes nothing after a same-account re-login while the read is open', async () => {
    const request = deferred<ReturnType<typeof dailySnapshot>>();
    fetchDailyDayById.mockReturnValue(request.promise);

    const refresh = state().refreshDailyDay(DAY_ID);
    await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    request.settle(dailySnapshot({ state: 'partner' }));
    await refresh;

    expect(await copy()).toBeNull();
    expect(state().dailyDay).toBeNull();
  });
});

describe('sign-out', () => {
  it('clears dailyDay, dailyDayLoading and dailyDayError', () => {
    useAppStore.setState({
      dailyDay: ok(waitingSnapshot('this')),
      dailyDayLoading: true,
      dailyDayError: 'boom',
    });

    state().clearAuth();

    expect(state().dailyDay).toBeNull();
    expect(state().dailyDayLoading).toBe(false);
    expect(state().dailyDayError).toBeNull();
  });
});

describe('submitDailyPick', () => {
  beforeEach(() => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
  });

  it('sends the shown day and stores the answer', async () => {
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'this', SAME_DAY);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('stores the reveal when the partner had already picked', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot({ state: 'partner' })) });
    submitDailyPickRequest.mockResolvedValue(revealSnapshot('that', 'this'));

    await state().submitDailyPick('that');

    expect(state().dailyDay).toEqual(ok(revealSnapshot('that', 'this')));
  });

  it('announces the confirmed pick to the partner, by day id', async () => {
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(announceDailyPick).toHaveBeenCalledTimes(1);
    expect(announceDailyPick).toHaveBeenCalledWith(DAY_ID);
  });

  it('keeps the pick shown and logs when the announcement fails', async () => {
    const failure = new Error('broadcast refused');
    announceDailyPick.mockRejectedValue(failure);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await expect(state().submitDailyPick('this')).resolves.toBeUndefined();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[DailyQuestion] Could not announce the pick:',
        failure
      )
    );
  });

  it('does not wait for the announcement', async () => {
    const announcement = deferred<undefined>();
    announceDailyPick.mockReturnValue(announcement.promise);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    announcement.settle(undefined);
  });

  it('re-reads the couple streak once after a confirmed pick', async () => {
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(loadCoupleStreak).toHaveBeenCalledTimes(1);
  });

  it('does not re-read the streak when the pick fails', async () => {
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'transport' });

    expect(loadCoupleStreak).not.toHaveBeenCalled();
  });

  it('does not re-read the streak when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(loadCoupleStreak).not.toHaveBeenCalled();
  });

  it('announces nothing when the pick is refused', async () => {
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'transport' });

    expect(announceDailyPick).not.toHaveBeenCalled();
  });

  it('announces nothing when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(announceDailyPick).not.toHaveBeenCalled();
  });

  it('does not let a lower-state answer undo a stored reveal', async () => {
    useAppStore.setState({ dailyDay: ok(revealSnapshot('this', 'that')) });
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(state().dailyDay).toEqual(ok(revealSnapshot('this', 'that')));
  });

  it('throws the request error and leaves the shown day as it was', async () => {
    const failure = new AccountDataError('transport', 'boom');
    submitDailyPickRequest.mockRejectedValue(failure);

    await expect(state().submitDailyPick('this')).rejects.toBe(failure);

    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
  });

  it('throws without a shown day, sending nothing', async () => {
    useAppStore.setState({ dailyDay: { status: 'unlinked' } });

    await expect(state().submitDailyPick('this')).rejects.toThrow();
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
  });

  it('throws signed out, sending nothing', async () => {
    state().clearAuth();

    await expect(state().submitDailyPick('this')).rejects.toThrow();
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
  });

  it('writes nothing when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    useAppStore.setState({ userId: C, dailyDay: ok(dailySnapshot({ day_id: 'c-day' })) });
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'c-day' })));
  });

  it('writes nothing after a sign-out before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(state().dailyDay).toBeNull();
  });

  it('writes nothing after a same-account re-login before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(state().dailyDay).toBeNull();
  });

  describe('the device date and the shown day', () => {
    const nextDay = dailySnapshot({ day_id: 'next-day', day: '2026-11-06' });

    it('refuses a pick on a day the device no longer shows: no request, a re-read, day-changed', async () => {
      vi.setSystemTime(NEXT_DAY);
      fetchDailyDay.mockResolvedValue(ok(nextDay));

      await expect(state().submitDailyPick('this')).rejects.toMatchObject({
        name: 'AccountDataError',
        code: 'day-changed',
        message: DAY_CHANGED_MESSAGE,
      });

      expect(submitDailyPickRequest).not.toHaveBeenCalled();
      // The re-read reads the saved copy first, so its request follows a tick later.
      await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(state().dailyDay).toEqual(ok(nextDay)));
    });

    it('sends the pick when the device date is the shown day, however late in it', async () => {
      vi.setSystemTime(new Date(2026, 10, 5, 23, 59));
      submitDailyPickRequest.mockResolvedValue(waitingSnapshot('that'));

      await state().submitDailyPick('that');

      expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'that', new Date(2026, 10, 5, 23, 59));
      expect(fetchDailyDay).not.toHaveBeenCalled();
    });

    it('re-reads the day when the server answers day-changed, and rethrows it', async () => {
      const refusal = new AccountDataError('day-changed', DAY_CHANGED_MESSAGE);
      submitDailyPickRequest.mockRejectedValue(refusal);
      fetchDailyDay.mockResolvedValue(ok(nextDay));

      await expect(state().submitDailyPick('this')).rejects.toBe(refusal);

      await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(state().dailyDay).toEqual(ok(nextDay)));
    });

    it('does not re-read after a day-changed answer that arrives in another session', async () => {
      const request = deferred<ReturnType<typeof waitingSnapshot>>();
      submitDailyPickRequest.mockReturnValue(request.promise);

      const submit = state().submitDailyPick('this');
      useAppStore.setState({ userId: C, dailyDay: ok(dailySnapshot({ day_id: 'c-day' })) });
      request.fail(new AccountDataError('day-changed', DAY_CHANGED_MESSAGE));

      await expect(submit).rejects.toMatchObject({ code: 'day-changed' });
      expect(fetchDailyDay).not.toHaveBeenCalled();
      expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'c-day' })));
    });

    it('does not re-read after a day-changed answer that arrives after a same-account re-login', async () => {
      const request = deferred<ReturnType<typeof waitingSnapshot>>();
      submitDailyPickRequest.mockReturnValue(request.promise);

      const submit = state().submitDailyPick('this');
      state().clearAuth();
      state().setAuthUser(A);
      await deleteAccountCopies(A);
      request.fail(new AccountDataError('day-changed', DAY_CHANGED_MESSAGE));

      await expect(submit).rejects.toMatchObject({ code: 'day-changed' });
      expect(fetchDailyDay).not.toHaveBeenCalled();
    });

    it('discards the re-read when the session changes while it is open', async () => {
      vi.setSystemTime(NEXT_DAY);
      const reread = deferred<ReturnType<typeof ok>>();
      fetchDailyDay.mockReturnValue(reread.promise);

      await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'day-changed' });
      state().clearAuth();
      reread.settle(ok(nextDay));
      await vi.waitFor(() => expect(state().dailyDayLoading).toBe(false));

      expect(state().dailyDay).toBeNull();
    });

    it('leaves every other failure on the old path: no re-read', async () => {
      submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

      await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'transport' });

      expect(fetchDailyDay).not.toHaveBeenCalled();
    });
  });
});
