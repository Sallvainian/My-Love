/**
 * The `daily-days` copy and the partner, in the store: which saved days
 * `loadDailyDay` shows (only the current partner's), and which partner a merge
 * tags its entries with (the store's, the saved partner copy's, else
 * `lookupPartnerId()`). Same mocks as `dailyQuestionSlice.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
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
