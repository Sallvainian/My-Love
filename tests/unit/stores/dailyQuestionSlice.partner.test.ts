/**
 * The `daily-days` copy and the partner, in the store: which saved days
 * `loadDailyDay` shows (only the current partner's), and which partner a merge
 * tags its entries with (the store's, the saved partner copy's, else
 * `lookupPartnerId()`). Same mocks as `dailyQuestionSlice.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();
const fetchDailyDayById = vi.fn();
const submitDailyPickRequest = vi.fn();

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
  announceDailyPick: vi.fn().mockResolvedValue(undefined),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
}));

import { lookupPartnerId } from '../../../src/api/supabaseClient';
import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { dailySnapshot, waitingSnapshot, DAY_ID } from './dailyQuestionFixture';
import { setOnline } from './navigatorFixtures';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const SAME_DAY = new Date(2026, 10, 5, 12);

function state() {
  return useAppStore.getState();
}

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  state().clearAuth();
  state().setAuthUser(A);
  useAppStore.setState({ partner: null, partnerKnown: false });
  await deleteAccountCopies(A);
});

afterEach(() => {
  useAppStore.setState({ partner: null, partnerKnown: false });
  vi.useRealTimers();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('the saved days copy and the partner', () => {
  const PARTNER_B = 'PARTNER-B';
  const PARTNER_C = 'PARTNER-C';
  const tagged = (snapshot: ReturnType<typeof dailySnapshot>, partner: string | null) => ({
    [snapshot.day_id]: { ...snapshot, partner_id: partner },
  });
  const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
  const withPartner = (id: string) =>
    useAppStore.setState({
      partner: { id, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
      partnerKnown: true,
    });

  beforeEach(() => {
    vi.mocked(lookupPartnerId).mockReset();
  });

  it("shows no day saved with another partner, offline, and leaves the copy unchanged", async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, tagged(waitingSnapshot('this'), PARTNER_B));
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyDay).toBeNull();
    // The old pairing's day stays saved; the filter only hides it.
    expect(await copy()).toEqual(tagged(waitingSnapshot('this'), PARTNER_B));
  });

  it("shows the current partner's saved day before the fetch settles", async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, tagged(waitingSnapshot('this'), PARTNER_C));
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('shows a legacy entry (no partner_id) offline while a partner is known', async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { [DAY_ID]: waitingSnapshot('this') });
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('shows a legacy entry while no partner is known (the saved partner copy is empty)', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { [DAY_ID]: waitingSnapshot('this') });
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('reads the partner from the saved partner copy when the store has none yet', async () => {
    await writeLocalCopy(A, 'partner', {
      status: 'linked',
      partner: { id: PARTNER_C, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
    });
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, tagged(waitingSnapshot('this'), PARTNER_C));
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('tags a merge with the partner in the store, without a lookup', async () => {
    withPartner(PARTNER_C);
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(await copy()).toEqual(tagged(dailySnapshot(), PARTNER_C));
    expect(lookupPartnerId).not.toHaveBeenCalled();
  });

  it('tags a merge from lookupPartnerId when no partner is known', async () => {
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'linked', partnerId: PARTNER_C });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(await copy()).toEqual(tagged(dailySnapshot(), PARTNER_C));
  });

  it.each([
    ['an undefined answer', () => vi.mocked(lookupPartnerId).mockResolvedValue(undefined as never)],
    ['an error answer', () => vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'error', reason: 'x' })],
    ['a throw', () => vi.mocked(lookupPartnerId).mockRejectedValue(new Error('boom'))],
  ])('tags null on %s from lookupPartnerId', async (_name, arrange) => {
    arrange();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(await copy()).toEqual(tagged(dailySnapshot(), null));
    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
  });

  it("an answer for the date drops the old pairing's day_id for it", async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(
      A,
      DAILY_DAYS_COPY_KIND,
      tagged(dailySnapshot({ day_id: 'old-pairing' }), PARTNER_B)
    );
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(await copy()).toEqual(tagged(dailySnapshot(), PARTNER_C));
  });

  it('an unlinked answer sends no partner lookup and writes an empty map', async () => {
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    await state().loadDailyDay();

    expect(lookupPartnerId).not.toHaveBeenCalled();
    expect(state().dailyDay).toEqual({ status: 'unlinked' });
    expect(await copy()).toEqual({});
  });

  it('writes nothing when the session changes while the partner is looked up', async () => {
    const lookup = deferred<{ status: 'linked'; partnerId: string }>();
    vi.mocked(lookupPartnerId).mockReturnValue(lookup.promise);
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(lookupPartnerId).toHaveBeenCalled());
    state().clearAuth();
    lookup.settle({ status: 'linked', partnerId: PARTNER_C });
    await load;

    expect(state().dailyDay).toBeNull();
    expect(await copy()).toBeNull();
  });
});

describe('the partner changes in the session', () => {
  const PARTNER_B = 'PARTNER-B';
  const PARTNER_C = 'PARTNER-C';
  const withPartner = (id: string) =>
    useAppStore.setState({
      partner: { id, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
      partnerKnown: true,
    });
  const unlink = () => useAppStore.setState({ partner: null, partnerKnown: true });
  const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);

  beforeEach(() => {
    vi.mocked(lookupPartnerId).mockReset();
    // A read started by a partner change stays open unless a test answers it.
    fetchDailyDay.mockReturnValue(new Promise(() => {}));
  });

  it('a new partner clears the shown day and its error, and reads the day again', async () => {
    withPartner(PARTNER_B);
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')), dailyDayError: 'old' });

    withPartner(PARTNER_C);

    expect(state().dailyDay).toBeNull();
    expect(state().dailyDayError).toBeNull();
    // This is the new partner's read.
    expect(state().dailyDayLoading).toBe(true);
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
  });

  it("the new partner's answer replaces the old pair's day on screen", async () => {
    withPartner(PARTNER_B);
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot({ day_id: 'new-pairing' })));

    withPartner(PARTNER_C);

    await vi.waitFor(() =>
      expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'new-pairing' })))
    );
    expect(await copy()).toEqual({
      'new-pairing': { ...dailySnapshot({ day_id: 'new-pairing' }), partner_id: PARTNER_C },
    });
  });

  it('a new partner after an unlink clears the day too', () => {
    withPartner(PARTNER_B);
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    unlink();
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));

    withPartner(PARTNER_C);

    expect(state().dailyDay).toBeNull();
  });

  it('a first link and a reload of the same partner clear nothing', () => {
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    withPartner(PARTNER_B);
    withPartner(PARTNER_B);
    unlink();
    withPartner(PARTNER_B);

    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    expect(fetchDailyDay).not.toHaveBeenCalled();
  });

  it('a change with no day shown or loading starts no read', () => {
    withPartner(PARTNER_B);

    withPartner(PARTNER_C);

    expect(fetchDailyDay).not.toHaveBeenCalled();
    expect(state().dailyDayLoading).toBe(false);
  });

  it('a change while signed out starts no read', () => {
    withPartner(PARTNER_B);
    state().clearAuth();
    useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
    withPartner(PARTNER_B);

    withPartner(PARTNER_C);

    expect(fetchDailyDay).not.toHaveBeenCalled();
  });

  it('a read in flight for the old partner writes nothing, to the field or the copy', async () => {
    withPartner(PARTNER_B);
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    request.settle(ok(dailySnapshot({ day_id: 'old-pairing' })));
    await load;

    expect(state().dailyDay).toBeNull();
    expect(await copy()).toBeNull();
  });

  describe('a re-read in flight for the old partner', () => {
    const oldPairing = () => dailySnapshot({ day_id: 'old-pairing' });

    async function startRefresh() {
      withPartner(PARTNER_B);
      useAppStore.setState({ dailyDay: ok(oldPairing()) });
      const request = deferred<ReturnType<typeof dailySnapshot>>();
      fetchDailyDayById.mockReturnValueOnce(request.promise);
      const refresh = state().refreshDailyDay('old-pairing');
      await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
      return { request, refresh };
    }

    it('landing after the reset does not put the old day back on the cleared screen', async () => {
      const { request, refresh } = await startRefresh();

      withPartner(PARTNER_C);
      expect(state().dailyDay).toBeNull();
      request.settle(oldPairing());
      await refresh;

      expect(state().dailyDay).toBeNull();
      expect(await copy()).toBeNull();
    });

    it("landing after the new partner's own read does not tag the old day with the new partner", async () => {
      const { request, refresh } = await startRefresh();
      fetchDailyDay.mockReset();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot({ day_id: 'new-pairing' })));

      withPartner(PARTNER_C);
      await vi.waitFor(() =>
        expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'new-pairing' })))
      );
      request.settle(oldPairing());
      await refresh;

      expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'new-pairing' })));
      expect(await copy()).toEqual({
        'new-pairing': { ...dailySnapshot({ day_id: 'new-pairing' }), partner_id: PARTNER_C },
      });
    });

    it('a pick confirmed after the change is not saved for the new partner', async () => {
      withPartner(PARTNER_B);
      useAppStore.setState({ dailyDay: ok(waitingSnapshot('this')) });
      const request = deferred<ReturnType<typeof dailySnapshot>>();
      submitDailyPickRequest.mockReturnValueOnce(request.promise);
      const submit = state().submitDailyPick('this');
      await vi.waitFor(() => expect(submitDailyPickRequest).toHaveBeenCalledTimes(1));

      withPartner(PARTNER_C);
      request.settle(dailySnapshot({ day_id: 'old-pairing', my_choice: 'this' }));
      await expect(submit).resolves.toBeUndefined();

      expect(state().dailyDay).toBeNull();
      expect(await copy()).toBeNull();
    });
  });

  it('a failure of the old partner read leaves no error behind', async () => {
    withPartner(PARTNER_B);
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    withPartner(PARTNER_C);
    request.fail(new Error('late'));
    await load;

    expect(state().dailyDayError).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
