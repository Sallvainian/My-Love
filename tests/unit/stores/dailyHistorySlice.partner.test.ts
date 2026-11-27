/**
 * The past questions when the partner changes in the session: the old pair's rows
 * and copy are never shown to or kept by the new partner, and a read started under
 * the old pair writes nothing. The rest of the slice is
 * `dailyHistorySlice.test.ts` (the load itself) and `dailyHistorySlice.copy.test.ts`
 * (the daily-days copy and its background fill).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyHistory = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/api/dailyQuestionApi')>()),
  fetchDailyHistory: (...args: unknown[]) => fetchDailyHistory(...args),
}));

// Call-through spies on the sign-out deletes, so afterEach can wait for them.
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

import { DAILY_HISTORY_PAGE_SIZE } from '../../../src/api/dailyQuestionApi';
import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { lookupPartnerId } from '../../../src/api/supabaseClient';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred } from './loaderIdentityGuardsFixture';
import { A, PAGE, day, installDailyHistoryHooks, older, run, state } from './dailyHistoryFixture';

installDailyHistoryHooks(fetchDailyHistory);

describe('the partner changes in the session', () => {
  const PARTNER_A = 'PARTNER-A-ID';
  const PARTNER_C = 'PARTNER-C-ID';
  const copyOf = () =>
    readLocalCopy<Record<string, Record<string, unknown>>>(A, DAILY_DAYS_COPY_KIND);
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

  beforeEach(async () => {
    useAppStore.setState({ partner: null, partnerKnown: false });
    await deleteAccountCopies(A);
    vi.mocked(lookupPartnerId).mockReset();
  });

  afterEach(() => {
    useAppStore.setState({ partner: null, partnerKnown: false });
  });

  it('a new partner clears the rows, the error, the end flag and the loading flags', () => {
    withPartner(PARTNER_A);
    useAppStore.setState({
      dailyHistory: PAGE,
      dailyHistoryError: 'old',
      dailyHistoryEnd: true,
      dailyHistoryLoading: true,
      dailyHistoryLoadingMore: true,
    });

    withPartner(PARTNER_C);

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryError).toBeNull();
    expect(state().dailyHistoryEnd).toBe(false);
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryLoadingMore).toBe(false);
  });

  it('a first link and a reload of the same partner clear nothing', () => {
    useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: true });
    withPartner(PARTNER_A);
    expect(state().dailyHistory).toEqual(PAGE);

    withPartner(PARTNER_A);

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryEnd).toBe(true);
  });

  it('a first-page read in flight for the old partner writes nothing, to the field or the copy', async () => {
    withPartner(PARTNER_A);
    const request = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const load = state().loadDailyHistory();
    withPartner(PARTNER_C);
    request.settle(PAGE);
    await load;

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoading).toBe(false);
    expect(await copyOf()).toBeNull();
  });

  it('a first-page failure in flight for the old partner leaves no error behind', async () => {
    withPartner(PARTNER_A);
    const request = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const load = state().loadDailyHistory();
    withPartner(PARTNER_C);
    request.fail(new Error('late'));
    await load;

    expect(state().dailyHistoryError).toBeNull();
    expect(state().dailyHistory).toBeNull();
  });

  it('a load-more read in flight for the old partner writes nothing, to the field or the copy', async () => {
    withPartner(PARTNER_A);
    // The page after the full one ends the background fill.
    fetchDailyHistory.mockResolvedValueOnce(run(DAILY_HISTORY_PAGE_SIZE)).mockResolvedValueOnce([]);
    await state().loadDailyHistory();
    await vi.waitFor(async () => expect(await copyOf()).not.toBeNull());
    const before = await copyOf();
    const more = deferred<ReturnType<typeof older>>();
    fetchDailyHistory.mockReturnValueOnce(more.promise);

    const load = state().loadMoreDailyHistory();
    withPartner(PARTNER_C);
    more.settle(older(3));
    await load;

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoadingMore).toBe(false);
    expect(await copyOf()).toEqual(before);
  });

  it('a page shown just before the partner changed is not merged into the copy under the new partner', async () => {
    const lookup = deferred<{ status: 'linked'; partnerId: string }>();
    vi.mocked(lookupPartnerId).mockReturnValue(lookup.promise as never);
    fetchDailyHistory.mockResolvedValueOnce(PAGE);

    const load = state().loadDailyHistory();
    await vi.waitFor(() => expect(lookupPartnerId).toHaveBeenCalled());
    withPartner(PARTNER_A);
    withPartner(PARTNER_C);
    lookup.settle({ status: 'linked', partnerId: PARTNER_C });
    await load;

    expect(await copyOf()).toBeNull();
  });

  it("the new partner's failed read shows no row of the old pair", async () => {
    withPartner(PARTNER_A);
    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();
    expect(state().dailyHistory).toEqual(PAGE);
    await vi.waitFor(async () => expect(Object.keys((await copyOf()) ?? {})).toHaveLength(2));

    withPartner(PARTNER_C);
    fetchDailyHistory.mockRejectedValueOnce(new AccountDataError('transport', 'boom'));
    await state().loadDailyHistory();

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryError).toBe('boom');
  });

  it("a list filled from the old pair's copy is not kept by the new partner's first page", async () => {
    withPartner(PARTNER_A);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      c1: { ...day('c1', '2026-08-01'), partner_id: PARTNER_A },
    });
    fetchDailyHistory.mockRejectedValueOnce(new AccountDataError('offline', 'You are offline.'));
    await state().loadDailyHistory();
    expect(state().dailyHistory).toHaveLength(1);

    withPartner(PARTNER_C);
    // The page after the full one ends the background fill.
    fetchDailyHistory.mockResolvedValueOnce(run(DAILY_HISTORY_PAGE_SIZE)).mockResolvedValueOnce([]);
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(run(DAILY_HISTORY_PAGE_SIZE));
  });
});
