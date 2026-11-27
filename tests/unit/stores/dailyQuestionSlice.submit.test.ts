/**
 * `submitDailyPick` in the store: the pick request, the announcement to the partner,
 * the streak re-read, the session check after the await and the device-date guard,
 * with only the Supabase client and the API module mocked.
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
import { deleteAccountCopies, readLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import {
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
  DAY_ID,
  KNOWN_PARTNER_ID,
  knownPartnerState,
} from './dailyQuestionFixture';
import { NEXT_DAY, ok, SAME_DAY, state } from './dailyQuestionSliceFixture';
import { deferred, A, C } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

const realLoadCoupleStreak = useAppStore.getState().loadCoupleStreak;
const loadCoupleStreak = vi.fn(async () => {});

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

  it('tags the saved day with the known partner', async () => {
    useAppStore.setState(knownPartnerState());
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().submitDailyPick('this');

    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved).toEqual({
      [DAY_ID]: { ...waitingSnapshot('this'), partner_id: KNOWN_PARTNER_ID },
    });
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

    await expect(state().submitDailyPick('this')).resolves.toEqual(ok(waitingSnapshot('this')));

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

  it('announces the confirmed pick after a same-account re-login during the send', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    state().setAuthUser(A);
    request.settle(waitingSnapshot('this'));
    await submit;

    expect(announceDailyPick).toHaveBeenCalledTimes(1);
    expect(announceDailyPick).toHaveBeenCalledWith(DAY_ID);
  });

  it('announces nothing when another account signed in before the answer', async () => {
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const submit = state().submitDailyPick('this');
    state().clearAuth();
    state().setAuthUser(C);
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

