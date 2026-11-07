/**
 * The couple's past questions in the store: `loadDailyHistory` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked.
 * Covers the answer replacing the field, the failed-read rule (a failure keeps
 * the rows shown), an offline refusal not being logged, the newest-read-wins
 * rule, the session check after the await, and sign-out clearing the fields.
 * `loadMoreDailyHistory` and the first-page merge (a full page keeps the older
 * rows paged in, a short page is the whole list) have their own describes.
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
import { cancelDateReminders } from '../../../src/services/dateReminders';
import { deleteAccountImages } from '../../../src/services/imageCache';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import * as localCopyModule from '../../../src/services/localCopy';
import { deleteAccountCopies, readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { lookupPartnerId } from '../../../src/api/supabaseClient';
import { moodService } from '../../../src/services/moodService';
import { useAppStore } from '../../../src/stores/useAppStore';
import { accountDeletesSettled, setOnline } from './accountDataFixtures';
import { revealSnapshot } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

function state() {
  return useAppStore.getState();
}

const day = (id: string, date: string) => ({ ...revealSnapshot('this', 'that'), day_id: id, day: date });
const PAGE = [day('d2', '2026-11-05'), day('d1', '2026-11-04')];

/** `count` consecutive days, newest `2026-10-<newest>` down, ids `p<n>`. */
const run = (count: number, newest = 31) =>
  Array.from({ length: count }, (_, i) =>
    day(`p${newest - i}`, `2026-10-${String(newest - i).padStart(2, '0')}`)
  );

/** `count` days older than every `run`: `2026-09-30` down, ids `o<n>`. */
const older = (count: number) =>
  Array.from({ length: count }, (_, i) => day(`o${i}`, `2026-09-${String(30 - i).padStart(2, '0')}`));

beforeEach(() => {
  vi.clearAllMocks();
  fetchDailyHistory.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(moodService, 'deleteSyncedForUser');
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
});

afterEach(async () => {
  // Lets the sign-out deletes a test started finish before the file can end.
  await accountDeletesSettled(
    vi.mocked(deleteAccountCopies),
    vi.mocked(deleteAccountImages),
    vi.mocked(moodService.deleteSyncedForUser),
    vi.mocked(cancelDateReminders)
  );
  vi.restoreAllMocks();
});

describe('loadDailyHistory', () => {
  it('starts as null with nothing loading and no error', () => {
    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });

  it('stores the first page, clears the loading flag and the error', async () => {
    useAppStore.setState({ dailyHistoryError: 'old' });
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect(fetchDailyHistory).toHaveBeenCalledWith();
    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });

  it('replaces the field with the new page', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE).mockResolvedValueOnce([PAGE[0]]);

    await state().loadDailyHistory();
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual([PAGE[0]]);
  });

  it('stores an empty answer as [] (nothing to show), not null', async () => {
    fetchDailyHistory.mockResolvedValue([]);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual([]);
  });

  it('raises the loading flag while the request is open', async () => {
    const request = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const load = state().loadDailyHistory();
    expect(state().dailyHistoryLoading).toBe(true);
    request.settle(PAGE);
    await load;

    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().loadDailyHistory();

    expect(fetchDailyHistory).not.toHaveBeenCalled();
    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('never throws: a failed first read sets the error and shows nothing', async () => {
    const failure = new AccountDataError('transport', 'boom');
    fetchDailyHistory.mockRejectedValue(failure);

    await expect(state().loadDailyHistory()).resolves.toBeUndefined();

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryLoading).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to load the past questions:',
      failure
    );
  });

  it('a failed read keeps the rows shown and sets the error', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();

    fetchDailyHistory.mockRejectedValueOnce(new Error('boom'));
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryErrorOffline).toBe(false);
    expect(state().dailyHistoryErrorMore).toBe(false);
  });

  it('an offline refusal sets the error but is not logged', async () => {
    fetchDailyHistory.mockRejectedValue(
      new AccountDataError('offline', 'You are offline. Past questions needs a connection to load.')
    );

    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBe(
      'You are offline. Past questions needs a connection to load.'
    );
    expect(state().dailyHistoryErrorOffline).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('a first-page failure after a failed load-more marks the error as the first page\'s', async () => {
    useAppStore.setState({ dailyHistoryError: 'more failed', dailyHistoryErrorMore: true });
    fetchDailyHistory.mockRejectedValueOnce(new Error('boom'));

    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryErrorMore).toBe(false);
  });

  it('a later successful read clears an offline refusal', async () => {
    fetchDailyHistory.mockRejectedValueOnce(new AccountDataError('offline', 'You are offline.'));
    await state().loadDailyHistory();
    expect(state().dailyHistoryErrorOffline).toBe(true);

    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBeNull();
    expect(state().dailyHistoryErrorOffline).toBe(false);
  });

  it('a later successful read clears the error', async () => {
    fetchDailyHistory.mockRejectedValueOnce(new Error('boom'));
    await state().loadDailyHistory();
    expect(state().dailyHistoryError).toBe('boom');

    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();

    expect(state().dailyHistoryError).toBeNull();
  });

  it('two overlapping reads: the newer answer is kept when the older lands last', async () => {
    const older = deferred<typeof PAGE>();
    const newer = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const first = state().loadDailyHistory();
    const second = state().loadDailyHistory();
    newer.settle(PAGE);
    await second;
    older.settle([PAGE[1]]);
    await first;

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryLoading).toBe(false);
  });

  it('an older failure landing after a newer answer changes nothing', async () => {
    const older = deferred<typeof PAGE>();
    fetchDailyHistory.mockReturnValueOnce(older.promise).mockResolvedValueOnce(PAGE);

    const first = state().loadDailyHistory();
    await state().loadDailyHistory();
    older.fail(new Error('late'));
    await first;

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryError).toBeNull();
  });

  describe('a session change while the request is open', () => {
    it('discards the answer after a sign-out', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toBeNull();
      expect(state().dailyHistoryLoading).toBe(false);
    });

    it('discards the answer after a switch to another account, keeping its own state', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      useAppStore.setState({ userId: C, dailyHistory: [PAGE[1]] });
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toEqual([PAGE[1]]);
    });

    it('discards the answer after a same-account re-login', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      state().setAuthUser(A);
      request.settle(PAGE);
      await load;

      expect(state().dailyHistory).toBeNull();
    });

    it('discards a failure too: the error belongs to the old session', async () => {
      const request = deferred<typeof PAGE>();
      fetchDailyHistory.mockReturnValue(request.promise);

      const load = state().loadDailyHistory();
      state().clearAuth();
      request.fail(new Error('boom'));
      await load;

      expect(state().dailyHistoryError).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  it('sign-out clears the rows, the flags and the error', async () => {
    fetchDailyHistory.mockResolvedValueOnce(PAGE);
    await state().loadDailyHistory();
    useAppStore.setState({
      dailyHistoryLoading: true,
      dailyHistoryError: 'x',
      dailyHistoryEnd: true,
      dailyHistoryLoadingMore: true,
    });

    state().clearAuth();

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoading).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
    expect(state().dailyHistoryEnd).toBe(false);
    expect(state().dailyHistoryLoadingMore).toBe(false);
  });
});

describe('loadDailyHistory merging pages', () => {
  it('a short first page is the whole list and ends the paging', async () => {
    fetchDailyHistory.mockResolvedValue(PAGE);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryEnd).toBe(true);
  });

  it('a full first page leaves the end open', async () => {
    fetchDailyHistory.mockResolvedValue(run(DAILY_HISTORY_PAGE_SIZE));

    await state().loadDailyHistory();

    expect(state().dailyHistory).toHaveLength(DAILY_HISTORY_PAGE_SIZE);
    expect(state().dailyHistoryEnd).toBe(false);
  });

  it('a full first page after an empty read that set the end opens the paging again', async () => {
    useAppStore.setState({ dailyHistory: [], dailyHistoryEnd: true });
    fetchDailyHistory.mockResolvedValue(run(DAILY_HISTORY_PAGE_SIZE));

    await state().loadDailyHistory();

    expect(state().dailyHistory).toHaveLength(DAILY_HISTORY_PAGE_SIZE);
    expect(state().dailyHistoryEnd).toBe(false);
  });

  it('a full re-read after paging keeps the rows older than its oldest day', async () => {
    const first = run(30);
    const tail = older(5);
    useAppStore.setState({ dailyHistory: [...first, ...tail], dailyHistoryEnd: true });
    const reread = [day('new', '2026-11-01'), ...first.slice(0, 29)];
    fetchDailyHistory.mockResolvedValue(reread);

    await state().loadDailyHistory();

    // The newest day pushed the oldest first-page row off the re-read; it is
    // older than the page's oldest day, so it is kept with the paged tail.
    expect(state().dailyHistory).toEqual([...reread, first[29], ...tail]);
    expect(state().dailyHistory?.[0].day_id).toBe('new');
    // The end is left as it was.
    expect(state().dailyHistoryEnd).toBe(true);
  });

  it('a short re-read after paging replaces everything and sets the end', async () => {
    useAppStore.setState({ dailyHistory: [...run(30), ...older(5)], dailyHistoryEnd: false });
    fetchDailyHistory.mockResolvedValue(PAGE.slice(0, 1));

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(PAGE.slice(0, 1));
    expect(state().dailyHistoryEnd).toBe(true);
  });
});

describe('loadMoreDailyHistory', () => {
  const full = () => run(30);

  it('reads the page before the oldest row and appends it; a short page ends the paging', async () => {
    useAppStore.setState({ dailyHistory: full() });
    const more = older(5);
    fetchDailyHistory.mockResolvedValue(more);

    await state().loadMoreDailyHistory();

    expect(fetchDailyHistory).toHaveBeenCalledWith('2026-10-02');
    expect(state().dailyHistory).toEqual([...full(), ...more]);
    expect(state().dailyHistoryEnd).toBe(true);
    expect(state().dailyHistoryLoadingMore).toBe(false);
  });

  it('a successful load-more clears a failed load-more\'s error', async () => {
    useAppStore.setState({
      dailyHistory: full(),
      dailyHistoryError: 'boom',
      dailyHistoryErrorMore: true,
    });
    fetchDailyHistory.mockResolvedValue(older(5));

    await state().loadMoreDailyHistory();

    expect(state().dailyHistoryError).toBeNull();
    expect(state().dailyHistoryErrorMore).toBe(false);
  });

  it('a successful load-more keeps a failed first page\'s error, which only a first-page read clears', async () => {
    useAppStore.setState({
      dailyHistory: full(),
      dailyHistoryError: 'boom',
      dailyHistoryErrorOffline: false,
      dailyHistoryErrorMore: false,
    });
    fetchDailyHistory.mockResolvedValue(older(5));

    await state().loadMoreDailyHistory();

    expect(state().dailyHistory).toEqual([...full(), ...older(5)]);
    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryErrorMore).toBe(false);
  });

  it('a failed load-more keeps a failed first page\'s error, so a later load-more cannot clear it', async () => {
    useAppStore.setState({
      dailyHistory: full(),
      dailyHistoryError: 'first page failed',
      dailyHistoryErrorOffline: false,
      dailyHistoryErrorMore: false,
    });
    fetchDailyHistory.mockRejectedValueOnce(new AccountDataError('transport', 'more failed'));

    await state().loadMoreDailyHistory();

    expect(state().dailyHistoryError).toBe('first page failed');
    expect(state().dailyHistoryErrorMore).toBe(false);
    expect(state().dailyHistoryLoadingMore).toBe(false);

    fetchDailyHistory.mockResolvedValueOnce(older(5));
    await state().loadMoreDailyHistory();

    expect(state().dailyHistoryError).toBe('first page failed');
    expect(state().dailyHistoryErrorMore).toBe(false);
  });

  it('a full page leaves the end open', async () => {
    useAppStore.setState({ dailyHistory: run(30, 31) });
    fetchDailyHistory.mockResolvedValue(older(30));

    await state().loadMoreDailyHistory();

    expect(state().dailyHistory).toHaveLength(60);
    expect(state().dailyHistoryEnd).toBe(false);
  });

  it('skips rows already present', async () => {
    useAppStore.setState({ dailyHistory: PAGE });
    fetchDailyHistory.mockResolvedValue([PAGE[1], day('d0', '2026-11-03')]);

    await state().loadMoreDailyHistory();

    expect(state().dailyHistory?.map((row) => row.day_id)).toEqual(['d2', 'd1', 'd0']);
  });

  it.each([
    ['signed out', () => state().clearAuth(), null],
    ['nothing loaded', () => {}, null],
    ['at the end', () => {}, PAGE],
  ])('makes no request when %s', async (_name, arrange, rows) => {
    useAppStore.setState({ dailyHistory: rows, dailyHistoryEnd: rows !== null });
    arrange();

    await state().loadMoreDailyHistory();

    expect(fetchDailyHistory).not.toHaveBeenCalled();
  });

  it('makes no request for an empty list', async () => {
    useAppStore.setState({ dailyHistory: [] });

    await state().loadMoreDailyHistory();

    expect(fetchDailyHistory).not.toHaveBeenCalled();
  });

  it('makes no request once the oldest page was read', async () => {
    useAppStore.setState({ dailyHistory: full(), dailyHistoryEnd: true });

    await state().loadMoreDailyHistory();

    expect(fetchDailyHistory).not.toHaveBeenCalled();
    expect(state().dailyHistory).toEqual(full());
  });

  it('makes no second request while one is loading more', async () => {
    useAppStore.setState({ dailyHistory: full() });
    const request = deferred<ReturnType<typeof run>>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const first = state().loadMoreDailyHistory();
    expect(state().dailyHistoryLoadingMore).toBe(true);
    await state().loadMoreDailyHistory();
    request.settle(older(5));
    await first;

    expect(fetchDailyHistory).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when a first-page read replaced the tail meanwhile', async () => {
    useAppStore.setState({ dailyHistory: [...full(), ...older(5)] });
    const request = deferred<ReturnType<typeof run>>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const more = state().loadMoreDailyHistory();
    // A short re-read replaced the whole list under it.
    useAppStore.setState({ dailyHistory: PAGE, dailyHistoryEnd: true });
    request.settle(older(3));
    await more;

    expect(state().dailyHistory).toEqual(PAGE);
    expect(state().dailyHistoryEnd).toBe(true);
    expect(state().dailyHistoryLoadingMore).toBe(false);
  });

  it('writes nothing after a sign-out', async () => {
    useAppStore.setState({ dailyHistory: full() });
    const request = deferred<ReturnType<typeof run>>();
    fetchDailyHistory.mockReturnValue(request.promise);

    const more = state().loadMoreDailyHistory();
    state().clearAuth();
    request.settle(older(5));
    await more;

    expect(state().dailyHistory).toBeNull();
    expect(state().dailyHistoryLoadingMore).toBe(false);
  });

  it('a failure keeps the rows, sets the error and never throws', async () => {
    useAppStore.setState({ dailyHistory: full() });
    const failure = new AccountDataError('transport', 'boom');
    fetchDailyHistory.mockRejectedValue(failure);

    await expect(state().loadMoreDailyHistory()).resolves.toBeUndefined();

    expect(state().dailyHistory).toEqual(full());
    expect(state().dailyHistoryError).toBe('boom');
    expect(state().dailyHistoryLoadingMore).toBe(false);
    expect(state().dailyHistoryErrorMore).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to load more past questions:',
      failure
    );
  });

  it('an offline refusal sets the error but is not logged', async () => {
    useAppStore.setState({ dailyHistory: full() });
    fetchDailyHistory.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadMoreDailyHistory();

    expect(state().dailyHistoryError).toBe('You are offline.');
    expect(state().dailyHistoryErrorOffline).toBe(true);
    expect(state().dailyHistoryErrorMore).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });
});

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
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { c1: savedDone('c1', '2026-10-01', PARTNER_C) });
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
    fetchDailyHistory.mockResolvedValueOnce(fresh);

    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(fresh);
    expect(state().dailyHistoryEnd).toBe(false);
    expect(state().dailyHistoryError).toBeNull();
  });
});

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
    fetchDailyHistory.mockResolvedValueOnce(run(DAILY_HISTORY_PAGE_SIZE));
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
    fetchDailyHistory.mockResolvedValueOnce(run(DAILY_HISTORY_PAGE_SIZE));
    await state().loadDailyHistory();

    expect(state().dailyHistory).toEqual(run(DAILY_HISTORY_PAGE_SIZE));
  });
});
