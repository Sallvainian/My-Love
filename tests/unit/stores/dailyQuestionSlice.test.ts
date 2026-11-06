/**
 * Daily Question in the store: `loadDailyDay` and `submitDailyPick` on the
 * composed `useAppStore`, with only the Supabase client and the API module
 * mocked. Covers the no-regress rule, the failed-load rule and the session
 * check after every await.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();
const submitDailyPickRequest = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', () => ({
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { dailySnapshot, revealSnapshot, waitingSnapshot, DAY_ID } from './dailyQuestionFixture';
import { setOnline } from './navigatorFixtures';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  submitDailyPickRequest.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
});

afterEach(() => {
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

    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'this');
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('stores the reveal when the partner had already picked', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot({ state: 'partner' })) });
    submitDailyPickRequest.mockResolvedValue(revealSnapshot('that', 'this'));

    await state().submitDailyPick('that');

    expect(state().dailyDay).toEqual(ok(revealSnapshot('that', 'this')));
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
});
