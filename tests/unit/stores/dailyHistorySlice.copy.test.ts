/**
 * The daily-days copy behind the past questions: `loadDailyHistory` and
 * `loadMoreDailyHistory` on the composed `useAppStore` merging each page into the
 * per-account copy tagged with the partner, the offline refusal with rows already
 * shown, and the background fill of the copy up to the streak's done days. The
 * rest of the slice is `dailyHistorySlice.test.ts`.
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
import * as localCopyModule from '../../../src/services/localCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { lookupPartnerId } from '../../../src/api/supabaseClient';
import { useAppStore } from '../../../src/stores/useAppStore';
import { coupleStreak } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';
import { A, PAGE, daysFrom, day, installDailyHistoryHooks, older, run, state } from './dailyHistoryFixture';

installDailyHistoryHooks(fetchDailyHistory);

describe('the daily-days copy behind the past questions', () => {
  afterEach(() => {
    useAppStore.setState({ partner: null, partnerKnown: false });
  });

  const PARTNER_C = 'PARTNER-C';
  const PARTNER_B = 'PARTNER-B';
  const copyOf = () => readLocalCopy<Record<string, Record<string, unknown>>>(A, DAILY_DAYS_COPY_KIND);
  const withPartner = (id: string) =>
    useAppStore.setState({
      partner: { id, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
      partnerKnown: true,
    });
  const offlineRefusal = () =>
    new AccountDataError('offline', 'You are offline. Past questions needs a connection to load.');
  /** A done day for the copy: the pair's both pick, tagged with `partner`. */
  const savedDone = (id: string, date: string, partner: string | null) => ({
    ...day(id, date),
    partner_id: partner,
  });

  beforeEach(async () => {
    useAppStore.setState({ partner: null, partnerKnown: false });
    await deleteAccountCopies(A);
    vi.mocked(lookupPartnerId).mockReset();
  });

  it('merges the first page into the copy, every day tagged with the partner in the store', async () => {
    withPartner(PARTNER_C);
    fetchDailyHistory.mockResolvedValue([day('d3', '2026-11-06'), ...PAGE]);

    await state().loadDailyHistory();

    const saved = await copyOf();
    expect(Object.keys(saved ?? {}).sort()).toEqual(['d1', 'd2', 'd3']);
    expect(Object.values(saved ?? {}).map((row) => row.partner_id)).toEqual([
      PARTNER_C,
      PARTNER_C,
      PARTNER_C,
    ]);
    expect(lookupPartnerId).not.toHaveBeenCalled();
  });

  it('merges a loadMore page into the copy too', async () => {
    withPartner(PARTNER_C);
    useAppStore.setState({ dailyHistory: run(30) });
    fetchDailyHistory.mockResolvedValue(older(3));

    await state().loadMoreDailyHistory();

    expect(Object.keys((await copyOf()) ?? {}).sort()).toEqual(['o0', 'o1', 'o2']);
  });

  it('tags with lookupPartnerId when neither the store nor the saved partner knows one', async () => {
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'linked', partnerId: PARTNER_C });
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect((await copyOf())?.d2?.partner_id).toBe(PARTNER_C);
  });

  it.each([
    ['an undefined answer', () => vi.mocked(lookupPartnerId).mockResolvedValue(undefined as never)],
    [
      'an error answer',
      () => vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'error', reason: 'x' }),
    ],
    ['an unlinked answer', () => vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'unlinked' })],
    ['a throw', () => vi.mocked(lookupPartnerId).mockRejectedValue(new Error('boom'))],
  ])('tags null on %s from lookupPartnerId', async (_name, arrange) => {
    arrange();
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect((await copyOf())?.d2?.partner_id).toBeNull();
    expect(state().dailyHistory).toEqual(PAGE);
  });

  it.each([
    ['an undefined answer', () => vi.mocked(lookupPartnerId).mockResolvedValue(undefined as never)],
    [
      'an error answer',
      () => vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'error', reason: 'x' }),
    ],
    ['a throw', () => vi.mocked(lookupPartnerId).mockRejectedValue(new Error('boom'))],
  ])("keeps a saved day's tag on %s from lookupPartnerId", async (_name, arrange) => {
    arrange();
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { d2: savedDone('d2', '2026-11-05', PARTNER_B) });
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    const saved = await copyOf();
    expect(saved?.d2?.partner_id).toBe(PARTNER_B);
    expect(saved?.d1?.partner_id).toBeNull();
  });

  it('a failed write is logged and the list is still shown', async () => {
    withPartner(PARTNER_C);
    const failure = new Error('disk full');
    vi.spyOn(localCopyModule, 'writeLocalCopy').mockRejectedValue(failure);
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE);
    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to save the daily days copy:',
      failure
    );
  });

  it('offline with nothing shown, fills the list from the current partner\'s copy', async () => {
    withPartner(PARTNER_C);
    const mine = Array.from({ length: 35 }, (_, i) =>
      savedDone(`c${i}`, `2026-${i < 20 ? '10' : '09'}-${String(30 - (i % 20)).padStart(2, '0')}`, PARTNER_C)
    );
    const other = [savedDone('b1', '2026-11-01', PARTNER_B), savedDone('b2', '2026-11-02', PARTNER_B)];
    const notDone = {
      ...savedDone('m1', '2026-11-03', PARTNER_C),
      state: 'me',
      partner_choice: null,
    };
    await writeLocalCopy(
      A,
      DAILY_DAYS_COPY_KIND,
      Object.fromEntries([...mine, ...other, notDone].map((row) => [row.day_id, row]))
    );
    fetchDailyHistory.mockRejectedValue(offlineRefusal());

    await state().loadDailyHistory();

    const rows = state().dailyHistory ?? [];
    expect(rows).toHaveLength(35);
    expect(rows.every((row) => row.day_id.startsWith('c'))).toBe(true);
    expect(rows.every((row) => !('partner_id' in row))).toBe(true);
    const days = rows.map((row) => row.day);
    expect(days).toEqual([...days].sort().reverse());
    expect(state().dailyHistoryEnd).toBe(true);
    expect(state().dailyHistoryError).toBe(offlineRefusal().message);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keeps the copy as it was after a failed read', async () => {
    withPartner(PARTNER_C);
    const saved = { d2: savedDone('d2', '2026-11-05', PARTNER_C) };
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, saved);
    const writeSpy = vi.spyOn(localCopyModule, 'writeLocalCopy');
    fetchDailyHistory.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await state().loadDailyHistory();

    expect(writeSpy).not.toHaveBeenCalled();
    expect(await copyOf()).toEqual(saved);
  });

  it('does not touch rows already shown when the read fails', async () => {
    withPartner(PARTNER_C);
    // The copy holds only a row already shown: an older saved row would follow them (see below).
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { d2: savedDone('d2', '2026-11-05', PARTNER_C) });
    useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: false });
    fetchDailyHistory.mockRejectedValue(offlineRefusal());

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryEnd).toBe(false);
  });

  it('fills from the saved partner when the store has not loaded one yet', async () => {
    await writeLocalCopy(A, 'partner', {
      status: 'linked',
      partner: { id: PARTNER_C, email: 'p@example.com', displayName: 'Harper', linkedSince: null, birthday: null },
    });
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      c1: savedDone('c1', '2026-10-01', PARTNER_C),
      b1: savedDone('b1', '2026-10-02', PARTNER_B),
    });
    fetchDailyHistory.mockRejectedValue(offlineRefusal());

    await state().loadDailyHistory();

    expect(state().dailyHistory?.map((row) => row.day_id)).toEqual(['c1']);
  });

  it('shows nothing, and leaves the field null, when the copy holds no day for the partner', async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { b1: savedDone('b1', '2026-10-02', PARTNER_B) });
    fetchDailyHistory.mockRejectedValue(offlineRefusal());

    await state().loadDailyHistory();

    expect(state().dailyHistory).toBeNull();
  });

  it('writes nothing from the copy after a sign-out while it is read', async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { c1: savedDone('c1', '2026-10-01', PARTNER_C) });
    const request = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const load = state().loadDailyHistory();
    state().clearAuth();
    request.fail(offlineRefusal());
    await load;

    expect(state().dailyHistory).toBeNull();
  });

  it('back online after a copy fill, a full server page replaces the list and opens the paging', async () => {
    withPartner(PARTNER_C);
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      c1: savedDone('c1', '2026-08-01', PARTNER_C),
      c2: savedDone('c2', '2026-08-02', PARTNER_C),
    });
    fetchDailyHistory.mockRejectedValueOnce(offlineRefusal());
    await state().loadDailyHistory();
    expect(state().dailyHistory).toHaveLength(2);
    expect(state().dailyHistoryEnd).toBe(true);
    const fresh = run(DAILY_HISTORY_PAGE_SIZE);
    // The page after the full one ends the background fill.
    fetchDailyHistory.mockResolvedValueOnce(fresh).mockResolvedValueOnce([]);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(fresh);
    expect(state().dailyHistoryEnd).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });

  describe('an offline refusal with rows already shown', () => {
    it('appends the saved rows older than the oldest shown, ends the paging, and the next online page replaces the list and resumes it', async () => {
      withPartner(PARTNER_C);
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
        d2: savedDone('d2', '2026-11-05', PARTNER_C),
        d1: savedDone('d1', '2026-11-04', PARTNER_C),
        c2: savedDone('c2', '2026-10-02', PARTNER_C),
        c1: savedDone('c1', '2026-10-01', PARTNER_C),
        b1: savedDone('b1', '2026-09-01', PARTNER_B),
      });
      useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: false });
      fetchDailyHistory.mockRejectedValueOnce(offlineRefusal());

      await state().loadDailyHistory();

      expect(state().dailyHistory?.map((row) => row.day_id)).toEqual(['d2', 'd1', 'c2', 'c1']);
      expect(state().dailyHistoryEnd).toBe(true);
      expect(state().dailyHistoryError).toBe(offlineRefusal().message);
      expect(state().dailyHistoryErrorOffline).toBe(true);
      expect(console.error).not.toHaveBeenCalled();

      // Back online: a full first page replaces the filled list and opens the paging.
      const fresh = run(DAILY_HISTORY_PAGE_SIZE);
      fetchDailyHistory.mockResolvedValueOnce(fresh).mockResolvedValueOnce([]);
      await state().loadDailyHistory();

      expect(state().dailyHistory).toEqual(fresh);
      expect(state().dailyHistoryEnd).toBe(false);
      expect(state().dailyHistoryError).toBeNull();
      // The fill the fresh page started has already asked for the page before its oldest day.
      const callsBefore = fetchDailyHistory.mock.calls.length;
      fetchDailyHistory.mockResolvedValueOnce([]);
      await state().loadMoreDailyHistory();
      expect(fetchDailyHistory).toHaveBeenCalledTimes(callsBefore + 1);
      expect(fetchDailyHistory).toHaveBeenLastCalledWith('2026-10-02');
    });

    it('leaves the list and the end flag as they were when no saved row is older', async () => {
      withPartner(PARTNER_C);
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
        d2: savedDone('d2', '2026-11-05', PARTNER_C),
        d1: savedDone('d1', '2026-11-04', PARTNER_C),
        n1: savedDone('n1', '2026-11-20', PARTNER_C),
        b1: savedDone('b1', '2026-09-01', PARTNER_B),
      });
      useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: false });
      fetchDailyHistory.mockRejectedValueOnce(offlineRefusal());

      await state().loadDailyHistory();

      expect(state().dailyHistory).toEqual(PAGE);
      expect(state().dailyHistoryEnd).toBe(false);
    });

    it('appends nothing after a failure that is not an offline refusal', async () => {
      withPartner(PARTNER_C);
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { c1: savedDone('c1', '2026-10-01', PARTNER_C) });
      useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: false });
      fetchDailyHistory.mockRejectedValueOnce(new AccountDataError('transport', 'boom'));

      await state().loadDailyHistory();

      expect(state().dailyHistory).toEqual(PAGE);
      expect(state().dailyHistoryEnd).toBe(false);
    });

    it('a refused "more" appends the saved older rows too, and the end is set', async () => {
      withPartner(PARTNER_C);
      await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
        c1: savedDone('c1', '2026-10-01', PARTNER_C),
        b1: savedDone('b1', '2026-09-01', PARTNER_B),
      });
      const shown = run(DAILY_HISTORY_PAGE_SIZE);
      useAppStore.setState({ dailyHistory: shown, dailyHistoryEnd: false });
      fetchDailyHistory.mockRejectedValueOnce(offlineRefusal());

      await state().loadMoreDailyHistory();

      expect(state().dailyHistory?.map((row) => row.day_id)).toEqual([
        ...shown.map((row) => row.day_id),
        'c1',
      ]);
      expect(state().dailyHistoryEnd).toBe(true);
      expect(state().dailyHistoryErrorOffline).toBe(true);
      expect(state().dailyHistoryLoadingMore).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('the background fill of the copy', () => {
    const FIRST = run(DAILY_HISTORY_PAGE_SIZE); // 2026-10-31 down to 2026-10-02
    const MIDDLE = daysFrom('2026-10-01', DAILY_HISTORY_PAGE_SIZE, 'm'); // down to 2026-09-02
    const TAIL = daysFrom('2026-09-01', 7, 't');
    const doneInCopy = async () =>
      Object.values((await copyOf()) ?? {}).filter(
        (entry) => entry.state === 'both' && entry.partner_id === PARTNER_C
      ).length;
    const streakOf = (done: number) =>
      useAppStore.setState({ coupleStreak: { status: 'ok', streak: coupleStreak({ done }) } });

    beforeEach(() => withPartner(PARTNER_C));

    it('pages every older done day into the copy only, until a short page', async () => {
      fetchDailyHistory
        .mockResolvedValueOnce(FIRST)
        .mockResolvedValueOnce(MIDDLE)
        .mockResolvedValueOnce(TAIL);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(3);
      expect(fetchDailyHistory).toHaveBeenNthCalledWith(1);
      expect(fetchDailyHistory).toHaveBeenNthCalledWith(2, '2026-10-02');
      expect(fetchDailyHistory).toHaveBeenNthCalledWith(3, '2026-09-02');
      expect(await doneInCopy()).toBe(67);
      // The list still holds the first page alone and is not at its end.
      expect(state().dailyHistory).toEqual(FIRST);
      expect(state().dailyHistoryEnd).toBe(false);
      expect(state().dailyHistoryError).toBeNull();
      expect(state().dailyHistoryLoadingMore).toBe(false);
    });

    it('stops once the saved done days for the partner reach the streak\'s done', async () => {
      streakOf(60);
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockResolvedValueOnce(MIDDLE);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(2);
      expect(await doneInCopy()).toBe(60);
    });

    it('asks for nothing more when the copy already holds the streak\'s done days', async () => {
      streakOf(30);
      await writeLocalCopy(
        A,
        DAILY_DAYS_COPY_KIND,
        Object.fromEntries(FIRST.map((row) => [row.day_id, { ...row, partner_id: PARTNER_C }]))
      );
      fetchDailyHistory.mockResolvedValueOnce(FIRST);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
    });

    it('does not count another partner\'s saved days toward the streak', async () => {
      streakOf(60);
      await writeLocalCopy(
        A,
        DAILY_DAYS_COPY_KIND,
        Object.fromEntries(MIDDLE.map((row) => [row.day_id, { ...row, partner_id: PARTNER_B }]))
      );
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockResolvedValueOnce(MIDDLE);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(2);
      expect(await doneInCopy()).toBe(60);
    });

    it('waits for a streak read under way before deciding how far to page', async () => {
      useAppStore.setState({ coupleStreakLoading: true });
      fetchDailyHistory.mockResolvedValueOnce(FIRST);

      const load = state().loadDailyHistory();
      // The first page is merged into the copy, so the fill is next; with the streak
      // read still open it must not ask for a second page.
      await vi.waitFor(async () => expect(await doneInCopy()).toBe(30));
      expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
      useAppStore.setState({
        coupleStreak: { status: 'ok', streak: coupleStreak({ done: 30 }) },
        coupleStreakLoading: false,
      });
      await load;

      expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
    });

    it('does not fill after a short first page', async () => {
      fetchDailyHistory.mockResolvedValueOnce(PAGE);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
    });

    it('does not fill when no partner is known and the lookup fails: a null tag would hide every day it saved', async () => {
      useAppStore.setState({ partner: null, partnerKnown: false });
      vi.mocked(lookupPartnerId).mockRejectedValue(new Error('lookup failed'));
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockResolvedValueOnce(MIDDLE);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
      expect(fetchDailyHistory).toHaveBeenCalledWith();
      expect(state().dailyHistory).toEqual(FIRST);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('stops when a page goes no further back', async () => {
      fetchDailyHistory.mockResolvedValue(FIRST);

      await state().loadDailyHistory();

      expect(fetchDailyHistory).toHaveBeenCalledTimes(2);
    });

    it('an offline refusal ends the fill quietly and leaves the first page shown with no error', async () => {
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockRejectedValueOnce(offlineRefusal());

      await state().loadDailyHistory();

      expect(state().dailyHistory).toEqual(FIRST);
      expect(state().dailyHistoryError).toBeNull();
      expect(state().dailyHistoryErrorOffline).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('a failure ends the fill with a log and never sets the error', async () => {
      const failure = new AccountDataError('transport', 'boom');
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockRejectedValueOnce(failure);

      await state().loadDailyHistory();

      expect(console.error).toHaveBeenCalledWith(
        '[DailyQuestion] Failed to fill the past questions copy:',
        failure
      );
      expect(state().dailyHistory).toEqual(FIRST);
      expect(state().dailyHistoryError).toBeNull();
    });

    it('writes nothing when the session ends while a page is read', async () => {
      const page = deferred<typeof MIDDLE>();
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockReturnValueOnce(page.promise);
      const writeSpy = vi.spyOn(localCopyModule, 'writeLocalCopy');

      const load = state().loadDailyHistory();
      await vi.waitFor(() => expect(fetchDailyHistory).toHaveBeenCalledTimes(2));
      const writes = writeSpy.mock.calls.length;
      state().clearAuth();
      page.settle(MIDDLE);
      await load;

      expect(writeSpy.mock.calls).toHaveLength(writes);
      expect(fetchDailyHistory).toHaveBeenCalledTimes(2);
    });

    it('writes nothing when the partner changes while a page is read', async () => {
      const page = deferred<typeof MIDDLE>();
      fetchDailyHistory.mockResolvedValueOnce(FIRST).mockReturnValueOnce(page.promise);
      const writeSpy = vi.spyOn(localCopyModule, 'writeLocalCopy');

      const load = state().loadDailyHistory();
      await vi.waitFor(() => expect(fetchDailyHistory).toHaveBeenCalledTimes(2));
      const writes = writeSpy.mock.calls.length;
      state().resetDailyHistoryForNewPair();
      page.settle(MIDDLE);
      await load;

      expect(writeSpy.mock.calls).toHaveLength(writes);
      expect(fetchDailyHistory).toHaveBeenCalledTimes(2);
    });

    it('a second first-page read while a fill runs starts no second fill', async () => {
      const page = deferred<typeof TAIL>();
      fetchDailyHistory
        .mockResolvedValueOnce(FIRST)
        .mockReturnValueOnce(page.promise)
        .mockResolvedValueOnce(FIRST);

      const first = state().loadDailyHistory();
      await vi.waitFor(() => expect(fetchDailyHistory).toHaveBeenCalledTimes(2));
      await state().loadDailyHistory();
      page.settle(TAIL);
      await first;

      expect(fetchDailyHistory).toHaveBeenCalledTimes(3);
    });
  });
});
