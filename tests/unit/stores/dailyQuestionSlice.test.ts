/**
 * Daily Question in the store: `loadDailyDay` on the composed `useAppStore`, with
 * only the Supabase client and the API module mocked. Covers the no-regress rule, the
 * failed-load rule, the session check after every await, the saved days copy, the
 * `dailyDayAnswers` growth rule and the sign-out reset. Overlapping calls are in
 * `dailyQuestionSlice.overlap.test.ts`, `refreshDailyDay` in `.refresh.test.ts` and
 * `submitDailyPick` in `.submit.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';
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

import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { dailySnapshot, revealSnapshot, waitingSnapshot, DAY_ID } from './dailyQuestionFixture';
import { NEXT_DAY, ok, state, useDailySliceHooks } from './dailyQuestionSliceFixture';
import { deferred, A, C } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

useDailySliceHooks({ fetchDailyDay, fetchDailyDayById, submitDailyPickRequest, announceDailyPick });

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

    await state().loadDailyDay();

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

describe('the server answers the store shows (dailyDayAnswers, DW-491)', () => {
  const OTHER_DAY = dailySnapshot({ day_id: 'other-day', day: '2026-11-06' });
  const shownAnswers = () => ({
    count: state().dailyDayAnswers,
    dayId: state().dailyDayAnsweredId,
  });

  it('starts at none', () => {
    expect(shownAnswers()).toEqual({ count: 0, dayId: null });
  });

  it('a read grows it and names the day the answer showed', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(shownAnswers()).toEqual({ count: 1, dayId: DAY_ID });
  });

  it('an unlinked read grows it with no day', async () => {
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    await state().loadDailyDay();

    expect(shownAnswers()).toEqual({ count: 1, dayId: null });
  });

  it('a failed read leaves it as it was, though a saved day is shown', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      [DAY_ID]: { ...dailySnapshot(), partner_id: null },
    });
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
    expect(shownAnswers()).toEqual({ count: 0, dayId: null });
  });

  it('a saved day that replaces the answered one leaves the answered day as it was', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
    await state().loadDailyDay();
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      'next-day': { ...dailySnapshot({ day_id: 'next-day', day: '2026-11-06' }), partner_id: null },
    });
    vi.setSystemTime(NEXT_DAY);
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadDailyDay();

    expect(state().dailyDay).toMatchObject({ snapshot: { day_id: 'next-day' } });
    expect(shownAnswers()).toEqual({ count: 1, dayId: DAY_ID });
  });

  it('a re-read of the day on screen grows it', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

    await state().refreshDailyDay(DAY_ID);

    expect(shownAnswers()).toEqual({ count: 1, dayId: DAY_ID });
  });

  it("a re-read with nothing on screen shows today's day and grows it", async () => {
    fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

    await state().refreshDailyDay(DAY_ID);

    expect(shownAnswers()).toEqual({ count: 1, dayId: DAY_ID });
  });

  it('a re-read of another day than the one on screen leaves it as it was', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    fetchDailyDayById.mockResolvedValue({ ...OTHER_DAY, state: 'partner' as const });

    await state().refreshDailyDay('other-day');

    expect(shownAnswers()).toEqual({ count: 0, dayId: null });
  });

  it('a failed re-read leaves it as it was', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    fetchDailyDayById.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().refreshDailyDay(DAY_ID);

    expect(shownAnswers()).toEqual({ count: 0, dayId: null });
  });

  it('a confirmed pick grows it', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    expect(shownAnswers()).toEqual({ count: 1, dayId: DAY_ID });
  });

  it('a refused pick leaves it as it was', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().submitDailyPick('this')).rejects.toThrow('boom');

    expect(shownAnswers()).toEqual({ count: 0, dayId: null });
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

