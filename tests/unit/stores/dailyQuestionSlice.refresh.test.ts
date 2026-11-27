/**
 * `refreshDailyDay` in the store: the named day's re-read, merged into the copy and
 * shown only when it is the shown day or the device's today, with only the Supabase
 * client and the API module mocked.
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
import {
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
  DAY_ID,
  KNOWN_PARTNER_ID,
  knownPartnerState,
} from './dailyQuestionFixture';
import { ok, state, useDailySliceHooks } from './dailyQuestionSliceFixture';
import { deferred, A } from './loaderIdentityGuardsFixture';

useDailySliceHooks({ fetchDailyDay, fetchDailyDayById, submitDailyPickRequest, announceDailyPick });

describe('refreshDailyDay', () => {
  const saved = (...snapshots: Array<ReturnType<typeof dailySnapshot>>) =>
    Object.fromEntries(
      snapshots.map((snapshot) => [snapshot.day_id, { ...snapshot, partner_id: null }])
    );
  const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
  const OTHER_DAY = dailySnapshot({ day_id: 'other-day', day: '2026-11-06' });

  it('tags the merged day with the known partner', async () => {
    useAppStore.setState(knownPartnerState());
    fetchDailyDayById.mockResolvedValue(dailySnapshot({ state: 'partner' }));

    await state().refreshDailyDay(DAY_ID);

    expect(await copy()).toEqual({
      [DAY_ID]: { ...dailySnapshot({ state: 'partner' }), partner_id: KNOWN_PARTNER_ID },
    });
  });

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
