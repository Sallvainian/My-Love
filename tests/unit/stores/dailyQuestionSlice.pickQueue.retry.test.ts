/**
 * The daily-question pick queue, second half (architecture AD-12): a late pick
 * queued through the store, the backoff retry after a transient stop, a
 * same-account sign-in, and the drain's and the online send's failing queue
 * writes. Same wiring as `dailyQuestionSlice.pickQueue.test.ts`.
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

import { pickZone } from '../../../src/api/dailyQuestionApi';
import { AccountDataError } from '../../../src/services/accountDataError';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { type QueuedPick, enqueuePick, listQueuedPicks } from '../../../src/services/pickQueue';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { useAppStore } from '../../../src/stores/useAppStore';
import { DAY_ID, dailySnapshot, revealSnapshot, waitingSnapshot } from './dailyQuestionFixture';
import { setOnline } from './navigatorFixtures';

const A = 'USER-A-ID';

const SAME_DAY = new Date(2026, 10, 5, 12);
/** 23:50 on the fixture's day, when the pick was made. */
const PICKED_AT = new Date(2026, 10, 5, 23, 50);
/** 00:10 the next day, when the connection came back. */
const DRAINED_AT = new Date(2026, 10, 6, 0, 10);

function state() {
  return useAppStore.getState();
}

const realLoadCoupleStreak = useAppStore.getState().loadCoupleStreak;

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

function queued(overrides: Partial<QueuedPick> = {}): QueuedPick {
  return {
    user_id: A,
    day_id: DAY_ID,
    choice: 'this',
    picked_at: PICKED_AT.toISOString(),
    time_zone: 'Pacific/Honolulu',
    utc_offset_minutes: -600,
    failed: false,
    failure: null,
    ...overrides,
  };
}

async function clearQueue(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('pick-queue');
  } finally {
    db.close();
  }
}

/** Let real I/O (fake-indexeddb) run until `done()`; the fake clock stays where it is. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !done(); i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  expect(done()).toBe(true);
}

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  announceDailyPick.mockReset();
  announceDailyPick.mockResolvedValue(undefined);
  // A confirmed pick re-reads the streak; its own tests cover that read.
  useAppStore.setState({ loadCoupleStreak: vi.fn(async () => {}) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  await clearQueue();
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
});

afterEach(() => {
  useAppStore.setState({ loadCoupleStreak: realLoadCoupleStreak });
  // Sign-out cancels any drain retry a test left scheduled, so no timer fires
  // after this file ends (AGENTS: fire-and-forget work must not outlive the file).
  state().clearAuth();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('a late pick queued through the store', () => {
  it('is queued at 23:50 offline and sent at 00:10 with its own day, instant and zone pair', async () => {
    let deviceZoneName = 'Pacific/Honolulu';
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
      this: Intl.DateTimeFormat
    ) {
      return { ...real.call(this), timeZone: deviceZoneName };
    });
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    vi.setSystemTime(PICKED_AT);
    setOnline(false);
    await state().submitDailyPick('this');
    const queuedZone = pickZone(PICKED_AT);
    expect(queuedZone.time_zone).toBe('Pacific/Honolulu');
    expect(submitDailyPickRequest).not.toHaveBeenCalled();

    // The connection returns after midnight, in another zone.
    vi.setSystemTime(DRAINED_AT);
    deviceZoneName = 'Asia/Tokyo';
    setOnline(true);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'this', PICKED_AT, queuedZone);
    expect(await listQueuedPicks(A)).toEqual([]);
  });
});

describe('the backoff retry after a transient stop', () => {
  beforeEach(() => {
    vi.useRealTimers();
    // setTimeout is faked for the retry timer; fake-indexeddb runs on setImmediate.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(SAME_DAY);
  });

  const down = () => new AccountDataError('transport', 'Network error');

  it('retries after 5 s, 10 s, 20 s, 40 s, then every 60 s, and stops once a pass completes', async () => {
    await enqueuePick(queued());
    submitDailyPickRequest.mockRejectedValue(down());
    await state().drainQueuedPicks();
    expect(vi.getTimerCount()).toBe(1);

    for (const delay of [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
      const before = submitDailyPickRequest.mock.calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(submitDailyPickRequest).toHaveBeenCalledTimes(before);
      await vi.advanceTimersByTimeAsync(1);
      await until(() => submitDailyPickRequest.mock.calls.length === before + 1);
      await until(() => vi.getTimerCount() === 1);
    }

    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    await vi.advanceTimersByTimeAsync(60_000);
    await until(() => state().dailyQueuedPicks.length === 0);
    const sent = submitDailyPickRequest.mock.calls.length;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(submitDailyPickRequest).toHaveBeenCalledTimes(sent);
    expect(vi.getTimerCount()).toBe(0);

    // The next transient stop starts again from 5 s.
    await enqueuePick(queued({ day_id: 'DAY-LATER' }));
    submitDailyPickRequest.mockRejectedValue(down());
    await state().drainQueuedPicks();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(submitDailyPickRequest).toHaveBeenCalledTimes(sent + 1);
    await vi.advanceTimersByTimeAsync(1);
    await until(() => submitDailyPickRequest.mock.calls.length === sent + 2);
  });

  it('is cancelled by a session change', async () => {
    await enqueuePick(queued());
    submitDailyPickRequest.mockRejectedValue(down());
    await state().drainQueuedPicks();
    expect(vi.getTimerCount()).toBe(1);

    state().clearAuth();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing offline, and the online event drains instead', async () => {
    await enqueuePick(queued());
    submitDailyPickRequest.mockImplementationOnce(async () => {
      setOnline(false);
      throw down();
    });
    await state().drainQueuedPicks();
    expect(vi.getTimerCount()).toBe(0);

    setOnline(true);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(2);
    expect(await listQueuedPicks(A)).toEqual([]);
  });

  it('a failing removal after a confirmed send retries; the next pass removes, announces and shows', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
      throw new Error('IDB-DOWN');
    });

    await state().drainQueuedPicks();

    expect(announceDailyPick).not.toHaveBeenCalled();
    expect(state().dailyQueuedPicks).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(5_000);
    await until(() => state().dailyQueuedPicks.length === 0);

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(2);
    expect(await listQueuedPicks(A)).toEqual([]);
    expect(announceDailyPick).toHaveBeenCalledWith(DAY_ID);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('a timer that fires while offline sends nothing and ends the retry', async () => {
    await enqueuePick(queued());
    submitDailyPickRequest.mockRejectedValue(down());
    await state().drainQueuedPicks();
    expect(vi.getTimerCount()).toBe(1);

    setOnline(false);
    await vi.advanceTimersByTimeAsync(5_000);
    await until(() => vi.getTimerCount() === 0);

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
  });
});

describe('a pick queued as the connection returns', () => {
  it('starts a drain when the device is online again once the row is written', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    setOnline(false);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    const realPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      // The `online` event drain has already come and gone by the time the row exists.
      setOnline(true);
      return realPut.apply(this, args);
    });

    await state().submitDailyPick('this');
    await until(() => submitDailyPickRequest.mock.calls.length === 1);
    await until(() => state().dailyQueuedPicks.length === 0);

    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'this', SAME_DAY, pickZone(SAME_DAY));
    expect(await listQueuedPicks(A)).toEqual([]);
  });

  it('starts no drain while still offline', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    setOnline(false);

    await state().submitDailyPick('this');

    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(await listQueuedPicks(A)).toHaveLength(1);
  });
});

describe('a same-account sign-in after sign-out', () => {
  it('sends the row the sign-out kept', async () => {
    await enqueuePick(queued());
    state().clearAuth();
    await state().drainQueuedPicks();
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(await listQueuedPicks(A)).toHaveLength(1);

    state().setAuthUser(A);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(await listQueuedPicks(A)).toEqual([]);
  });
});

describe('failing queue writes', () => {
  it('a failing row removal after a confirmed drain send resolves, logs, and refreshes the field', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyQueuedPicks: [] });
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new Error('IDB-DOWN');
    });

    await expect(state().drainQueuedPicks()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not send the queued picks:',
      expect.objectContaining({ message: 'IDB-DOWN' })
    );
    expect(state().dailyQueuedPicks.map((row) => row.day_id)).toEqual([DAY_ID]);
  });

  it('a failing refusal mark resolves, logs, and refreshes the field', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyQueuedPicks: [] });
    submitDailyPickRequest.mockRejectedValue(
      new AccountDataError('transport', 'REFUSED', { cause: { code: 'DQ002' } })
    );
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('IDB-DOWN');
    });

    await expect(state().drainQueuedPicks()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not send the queued picks:',
      expect.objectContaining({ message: 'IDB-DOWN' })
    );
    expect(state().dailyQueuedPicks).toEqual([
      expect.objectContaining({ day_id: DAY_ID, failed: false }),
    ]);
  });

  it('a failing cleanup after a confirmed online send still shows and announces the pick', async () => {
    await enqueuePick(queued({ failed: true, failure: 'REFUSED' }));
    useAppStore.setState({ dailyDay: ok(dailySnapshot({ state: 'partner' })) });
    submitDailyPickRequest.mockResolvedValue(revealSnapshot('that', 'this'));
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new Error('IDB-DOWN');
    });

    await expect(state().submitDailyPick('that')).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DailyQuestion] Could not clear the queued pick:',
      expect.objectContaining({ message: 'IDB-DOWN' })
    );
    expect(announceDailyPick).toHaveBeenCalledWith(DAY_ID);
    expect(state().dailyDay).toEqual(ok(revealSnapshot('that', 'this')));
  });
});
