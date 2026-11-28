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

import { DAY_CHANGED_MESSAGE, pickZone } from '../../../src/api/dailyQuestionApi';
import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy } from '../../../src/services/localCopy';
import { listQueuedPicks, removeQueuedPick } from '../../../src/services/pickQueue';
import { useAppStore } from '../../../src/stores/useAppStore';
import {
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
  DAY_ID,
  KNOWN_PARTNER_ID,
  knownPartnerState,
} from './dailyQuestionFixture';
import { NEXT_DAY, ok, SAME_DAY, state, useDailySliceHooks } from './dailyQuestionSliceFixture';
import { deferred, A, C } from './loaderIdentityGuardsFixture';

const { loadCoupleStreak } = useDailySliceHooks({
  fetchDailyDay,
  fetchDailyDayById,
  submitDailyPickRequest,
  announceDailyPick,
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
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('invalid-response', 'boom'));

    await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'invalid-response' });

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
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('refused', 'boom'));

    await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'refused' });

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
    const failure = new AccountDataError('invalid-response', 'boom');
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
      submitDailyPickRequest.mockRejectedValue(new AccountDataError('invalid-response', 'boom'));

      await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'invalid-response' });

      expect(fetchDailyDay).not.toHaveBeenCalled();
    });
  });

  // DW-484: a pick whose request fails in transit waits in the queue, as an offline pick does.
  describe('a request that fails in transit', () => {
    const lost = () => new AccountDataError('transport', '[DailyQuestionApi.submitDailyPick] Network error: Failed to fetch.');

    afterEach(async () => {
      await removeQueuedPick(A, DAY_ID);
    });

    it('queues the pick with the instant and zone it was made in, shows it waiting and sends it from the queue', async () => {
      const resend = deferred<ReturnType<typeof waitingSnapshot>>();
      submitDailyPickRequest.mockRejectedValueOnce(lost()).mockReturnValueOnce(resend.promise);

      await expect(state().submitDailyPick('this')).resolves.toBeUndefined();

      const row = {
        user_id: A,
        day_id: DAY_ID,
        choice: 'this',
        picked_at: SAME_DAY.toISOString(),
        ...pickZone(SAME_DAY),
        failed: false,
        failure: null,
      };
      expect(await listQueuedPicks(A)).toEqual([row]);
      expect(state().dailyQueuedPicks).toEqual([
        { day_id: DAY_ID, choice: 'this', picked_at: row.picked_at, failed: false, failure: null },
      ]);
      expect(state().dailyDay).toEqual(ok(dailySnapshot()));
      await vi.waitFor(() => expect(submitDailyPickRequest).toHaveBeenCalledTimes(2));
      expect(submitDailyPickRequest).toHaveBeenLastCalledWith(DAY_ID, 'this', SAME_DAY, pickZone(SAME_DAY));

      resend.settle(waitingSnapshot('this'));
      await vi.waitFor(() => expect(state().dailyQueuedPickSent).toMatchObject({ dayId: DAY_ID }));
      expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
      expect(state().dailyQueuedPicks).toEqual([]);
      expect(await listQueuedPicks(A)).toEqual([]);
    });

    it('still throws an answer that did not parse, and queues nothing', async () => {
      const failure = new AccountDataError('invalid-response', 'The daily question answer was not understood.');
      submitDailyPickRequest.mockRejectedValue(failure);

      await expect(state().submitDailyPick('this')).rejects.toBe(failure);

      expect(await listQueuedPicks(A)).toEqual([]);
      expect(state().dailyQueuedPicks).toEqual([]);
      expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    });

    it('keeps the pick for its account but starts no drain when another account signed in meanwhile', async () => {
      const request = deferred<ReturnType<typeof waitingSnapshot>>();
      submitDailyPickRequest.mockReturnValue(request.promise);

      const submit = state().submitDailyPick('this');
      state().clearAuth();
      state().setAuthUser(C);
      request.fail(lost());
      await submit;

      expect(await listQueuedPicks(A)).toMatchObject([{ user_id: A, day_id: DAY_ID, choice: 'this' }]);
      expect(state().dailyQueuedPicks).toEqual([]);
      expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    });
  });
});
