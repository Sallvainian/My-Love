/**
 * The daily-question pick queue in the store (architecture AD-12):
 * `submitDailyPick` without a connection, `drainQueuedPicks`, and
 * `dailyQueuedPicks`, on the composed `useAppStore` against fake-indexeddb, with
 * only the Supabase client and the request/announce functions of the API module
 * mocked (`isPickRefusal` and `pickZone` are the real ones).
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
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy } from '../../../src/services/localCopy';
import { type QueuedPick, enqueuePick, listQueuedPicks } from '../../../src/services/pickQueue';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { PICK_QUEUE_LOCK } from '../../../src/services/syncLock';
import { useAppStore } from '../../../src/stores/useAppStore';
import { DAY_ID, dailySnapshot, revealSnapshot, waitingSnapshot } from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

const A = 'USER-A-ID';
const B = 'USER-B-ID';
const C = 'USER-C-ID';
const DAY_2 = '00000000-0000-4000-8000-0000000000d2';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);
/** 23:50 on the fixture's day, when the pick was made. */
const PICKED_AT = new Date(2026, 10, 5, 23, 50);
/** 00:10 the next day, when the connection came back. */
const DRAINED_AT = new Date(2026, 10, 6, 0, 10);
const QUEUED_ZONE = { time_zone: 'Pacific/Honolulu', utc_offset_minutes: -600 };

function state() {
  return useAppStore.getState();
}

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

function queued(overrides: Partial<QueuedPick> = {}): QueuedPick {
  return {
    user_id: A,
    day_id: DAY_ID,
    choice: 'this',
    picked_at: PICKED_AT.toISOString(),
    ...QUEUED_ZONE,
    failed: false,
    failure: null,
    ...overrides,
  };
}

/** A refusal the way the API throws it: a transport error whose cause carries the SQLSTATE. */
function refusal(code: string, message = `refused ${code}`) {
  return new AccountDataError('transport', message, { cause: { code } });
}

const copy = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);

async function clearQueue(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('pick-queue');
  } finally {
    db.close();
  }
}

/** A same-origin Web Locks stand-in: `ifAvailable` answers null while the lock is held. */
function stubWebLocks() {
  const held = new Map<string, Promise<void>>();
  const fakeNavigator = Object.create(navigator) as Navigator;
  Object.defineProperty(fakeNavigator, 'onLine', { value: true });
  Object.defineProperty(fakeNavigator, 'locks', {
    value: {
      request: async (
        name: string,
        optionsOrFn: { ifAvailable?: boolean } | ((lock: object | null) => Promise<unknown>),
        maybeFn?: (lock: object | null) => Promise<unknown>
      ) => {
        const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn;
        const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!;
        if (options.ifAvailable && held.has(name)) return fn(null);
        while (held.has(name)) await held.get(name);
        const release = deferred<void>();
        held.set(name, release.promise);
        try {
          return await fn({ name });
        } finally {
          held.delete(name);
          release.settle();
        }
      },
    },
  });
  vi.stubGlobal('navigator', fakeNavigator);
  return fakeNavigator;
}

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  announceDailyPick.mockReset();
  announceDailyPick.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  await clearQueue();
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
});

afterEach(() => {
  // Sign-out cancels any drain retry a test left scheduled, so no timer fires
  // after this file ends (AGENTS: fire-and-forget work must not outlive the file).
  state().clearAuth();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('submitDailyPick offline', () => {
  it('queues the pick with its instant and zone, sends nothing, and shows the row', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    setOnline(false);

    await expect(state().submitDailyPick('this')).resolves.toBeUndefined();

    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(await listQueuedPicks(A)).toEqual([
      {
        user_id: A,
        day_id: DAY_ID,
        choice: 'this',
        picked_at: SAME_DAY.toISOString(),
        ...pickZone(SAME_DAY),
        failed: false,
        failure: null,
      },
    ]);
    expect(state().dailyQueuedPicks).toEqual([
      { day_id: DAY_ID, choice: 'this', picked_at: SAME_DAY.toISOString(), failed: false, failure: null },
    ]);
  });

  it('leaves dailyDay and the copy as the server last answered, even with the partner picked', async () => {
    const partnerPicked = dailySnapshot({ state: 'partner' });
    useAppStore.setState({ dailyDay: ok(partnerPicked) });
    setOnline(false);

    await state().submitDailyPick('that');

    expect(state().dailyDay).toEqual(ok(partnerPicked));
    expect(await copy()).toBeNull();
    expect(announceDailyPick).not.toHaveBeenCalled();
  });

  it('refuses a device date past the shown day before queueing anything', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    vi.setSystemTime(DRAINED_AT);
    setOnline(false);

    await expect(state().submitDailyPick('this')).rejects.toMatchObject({ code: 'day-changed' });

    expect(await listQueuedPicks(A)).toEqual([]);
    expect(state().dailyQueuedPicks).toEqual([]);
  });

  it('throws when the queue write fails, and shows no row', async () => {
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    setOnline(false);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('IDB-DOWN');
    });

    await expect(state().submitDailyPick('this')).rejects.toThrow('IDB-DOWN');

    expect(state().dailyQueuedPicks).toEqual([]);
  });
});

describe('submitDailyPick online', () => {
  it('removes a failed row for the day after the server confirms the new pick', async () => {
    await enqueuePick(queued({ failed: true, failure: 'REFUSED' }));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    await state().loadDailyDay().catch(() => {});
    expect(state().dailyQueuedPicks).toHaveLength(1);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('that'));

    await state().submitDailyPick('that');

    expect(await listQueuedPicks(A)).toEqual([]);
    expect(state().dailyQueuedPicks).toEqual([]);
  });

  it('keeps a failed row when the new send fails', async () => {
    await enqueuePick(queued({ failed: true, failure: 'REFUSED' }));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'boom'));

    await expect(state().submitDailyPick('that')).rejects.toMatchObject({ code: 'transport' });

    expect(await listQueuedPicks(A)).toEqual([queued({ failed: true, failure: 'REFUSED' })]);
  });
});

describe('loadDailyDay and the queued picks', () => {
  it("shows the account's rows, never another account's", async () => {
    await enqueuePick(queued());
    await enqueuePick(queued({ user_id: B, day_id: DAY_2 }));
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();

    expect(state().dailyQueuedPicks.map((row) => row.day_id)).toEqual([DAY_ID]);
  });

  it('still shows the rows when the server read fails', async () => {
    await enqueuePick(queued());
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));

    await state().loadDailyDay();

    expect(state().dailyQueuedPicks.map((row) => row.day_id)).toEqual([DAY_ID]);
  });
});

describe('drainQueuedPicks', () => {
  it('dates a late pick by its own day, instant and zone pair, with no device-date check', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    vi.setSystemTime(DRAINED_AT);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'this', PICKED_AT, QUEUED_ZONE);
  });

  it('confirmed: removes the row, announces the day, merges the copy and shows the reveal', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyDay: ok(dailySnapshot({ state: 'partner' })) });
    await state().loadDailyDay().catch(() => {});
    submitDailyPickRequest.mockResolvedValue(revealSnapshot('this', 'that'));

    await state().drainQueuedPicks();

    expect(await listQueuedPicks(A)).toEqual([]);
    expect(state().dailyQueuedPicks).toEqual([]);
    expect(announceDailyPick).toHaveBeenCalledWith(DAY_ID);
    expect(await copy()).toEqual({ [DAY_ID]: revealSnapshot('this', 'that') });
    expect(state().dailyDay).toEqual(ok(revealSnapshot('this', 'that')));
  });

  it('logs an announce failure and still shows the confirmed pick', async () => {
    await enqueuePick(queued());
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    const failure = new Error('BROADCAST-DOWN');
    announceDailyPick.mockRejectedValue(failure);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().drainQueuedPicks();

    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Could not announce the pick:', failure)
    );
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('an answer for a day that is not on screen goes into the copy alone', async () => {
    await enqueuePick(queued());
    const nextDay = dailySnapshot({ day_id: DAY_2, day: '2026-11-06' });
    useAppStore.setState({ dailyDay: ok(nextDay) });
    vi.setSystemTime(DRAINED_AT);
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().drainQueuedPicks();

    expect(state().dailyDay).toEqual(ok(nextDay));
    expect(await copy()).toEqual({ [DAY_ID]: waitingSnapshot('this') });
    expect(await listQueuedPicks(A)).toEqual([]);
  });

  it('an idempotent answer for a pick made elsewhere removes the row', async () => {
    await enqueuePick(queued({ choice: 'that' }));
    useAppStore.setState({ dailyDay: ok(dailySnapshot()) });
    // The server holds an earlier own pick of This and answers it unchanged.
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().drainQueuedPicks();

    expect(await listQueuedPicks(A)).toEqual([]);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it.each(['DQ002', 'P0002', 'DQ001', '22023'])(
    'a %s refusal marks the row failed with its message and sends the next row',
    async (code) => {
      await enqueuePick(queued({ picked_at: new Date(2026, 10, 5, 8).toISOString() }));
      await enqueuePick(queued({ day_id: DAY_2, picked_at: new Date(2026, 10, 5, 9).toISOString() }));
      submitDailyPickRequest
        .mockRejectedValueOnce(refusal(code, 'THE-REFUSAL'))
        .mockResolvedValueOnce(waitingSnapshot('this'));

      await state().drainQueuedPicks();

      expect(submitDailyPickRequest).toHaveBeenCalledTimes(2);
      const rows = await listQueuedPicks(A);
      expect(rows).toEqual([
        queued({
          picked_at: new Date(2026, 10, 5, 8).toISOString(),
          failed: true,
          failure: 'THE-REFUSAL',
        }),
      ]);
      expect(state().dailyQueuedPicks).toEqual([
        expect.objectContaining({ day_id: DAY_ID, failed: true, failure: 'THE-REFUSAL' }),
      ]);
    }
  );

  it('day-changed from the server is a refusal too', async () => {
    await enqueuePick(queued());
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('day-changed', 'DATE-MOVED'));

    await state().drainQueuedPicks();

    expect(await listQueuedPicks(A)).toEqual([queued({ failed: true, failure: 'DATE-MOVED' })]);
  });

  it('sends oldest first and skips a failed row', async () => {
    await enqueuePick(queued({ day_id: DAY_2, picked_at: new Date(2026, 10, 5, 11).toISOString() }));
    await enqueuePick(queued({ picked_at: new Date(2026, 10, 5, 10).toISOString() }));
    await enqueuePick(
      queued({ day_id: 'DAY-FAILED', picked_at: new Date(2026, 10, 5, 9).toISOString(), failed: true })
    );
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    await state().drainQueuedPicks();

    expect(submitDailyPickRequest.mock.calls.map((call) => call[0])).toEqual([DAY_ID, DAY_2]);
    expect((await listQueuedPicks(A)).map((row) => row.day_id)).toEqual(['DAY-FAILED']);
  });

  it('a transient failure keeps the row pending, logs, and stops the pass', async () => {
    await enqueuePick(queued({ picked_at: new Date(2026, 10, 5, 8).toISOString() }));
    await enqueuePick(queued({ day_id: DAY_2, picked_at: new Date(2026, 10, 5, 9).toISOString() }));
    const failure = new AccountDataError('transport', 'Network error');
    submitDailyPickRequest.mockRejectedValue(failure);

    await expect(state().drainQueuedPicks()).resolves.toBeUndefined();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Could not send a queued pick:', failure);
    expect((await listQueuedPicks(A)).map((row) => [row.day_id, row.failed])).toEqual([
      [DAY_ID, false],
      [DAY_2, false],
    ]);
    expect(state().dailyQueuedPicks).toHaveLength(2);
  });

  it("never sends or shows another account's rows", async () => {
    await enqueuePick(queued({ user_id: B }));

    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(state().dailyQueuedPicks).toEqual([]);
    expect(await listQueuedPicks(B)).toHaveLength(1);
  });

  it('does nothing signed out or offline', async () => {
    await enqueuePick(queued());
    setOnline(false);
    await state().drainQueuedPicks();
    setOnline(true);
    state().clearAuth();
    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(await listQueuedPicks(A)).toHaveLength(1);
  });

  it('stops before the next row when the connection drops mid-pass', async () => {
    await enqueuePick(queued({ picked_at: new Date(2026, 10, 5, 8).toISOString() }));
    await enqueuePick(queued({ day_id: DAY_2, picked_at: new Date(2026, 10, 5, 9).toISOString() }));
    submitDailyPickRequest.mockImplementationOnce(async () => {
      setOnline(false);
      return waitingSnapshot('this');
    });

    await state().drainQueuedPicks();

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect((await listQueuedPicks(A)).map((row) => row.day_id)).toEqual([DAY_2]);
  });

  it('session change after the RPC answers: the row goes, nothing else is written or announced', async () => {
    await enqueuePick(queued());
    const request = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(request.promise);

    const drain = state().drainQueuedPicks();
    await vi.waitFor(() => expect(submitDailyPickRequest).toHaveBeenCalled());
    // The other real transition: the account switches while the request is open.
    useAppStore.setState({ userId: C, dailyDay: null, dailyQueuedPicks: [] });
    request.settle(waitingSnapshot('this'));
    await drain;

    expect(await listQueuedPicks(A)).toEqual([]);
    expect(announceDailyPick).not.toHaveBeenCalled();
    expect(await copy()).toBeNull();
    expect(state().dailyDay).toBeNull();
    expect(state().dailyQueuedPicks).toEqual([]);
  });

  it('lock held by another tab: sends nothing here, then reloads the day once it lets go', async () => {
    const tab = stubWebLocks();
    await enqueuePick(queued());
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this')));
    const holder = deferred<void>();
    const holding = tab.locks.request(PICK_QUEUE_LOCK, () => holder.promise);

    const drain = state().drainQueuedPicks();
    await Promise.resolve();
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(fetchDailyDay).not.toHaveBeenCalled();

    holder.settle();
    await holding;
    await drain;

    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(fetchDailyDay).toHaveBeenCalledTimes(1);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    // The field is refreshed after the wait: the row is still there to show.
    expect(state().dailyQueuedPicks.map((row) => row.day_id)).toEqual([DAY_ID]);
  });
});

describe('drainQueuedPicks called again while it runs, in the same tab', () => {
  it('joins the running drain: one send, and no day re-read from the lock-held path', async () => {
    stubWebLocks();
    await enqueuePick(queued());
    const answer = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValue(answer.promise);

    const first = state().drainQueuedPicks();
    const second = state().drainQueuedPicks();
    await vi.waitFor(() => expect(submitDailyPickRequest).toHaveBeenCalledTimes(1));
    answer.settle(waitingSnapshot('this'));
    await Promise.all([first, second]);

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    expect(fetchDailyDay).not.toHaveBeenCalled();
    expect(await listQueuedPicks(A)).toEqual([]);
  });

  it('runs one more pass for a row queued while the first pass was sending', async () => {
    stubWebLocks();
    await enqueuePick(queued());
    const answer = deferred<ReturnType<typeof waitingSnapshot>>();
    submitDailyPickRequest.mockReturnValueOnce(answer.promise);
    submitDailyPickRequest.mockResolvedValueOnce(waitingSnapshot('that'));

    const first = state().drainQueuedPicks();
    await vi.waitFor(() => expect(submitDailyPickRequest).toHaveBeenCalledTimes(1));
    await enqueuePick(queued({ day_id: DAY_2, choice: 'that' }));
    const second = state().drainQueuedPicks();
    answer.settle(waitingSnapshot('this'));
    await Promise.all([first, second]);

    expect(submitDailyPickRequest).toHaveBeenCalledTimes(2);
    expect(submitDailyPickRequest.mock.calls[1]?.[0]).toBe(DAY_2);
    expect(await listQueuedPicks(A)).toEqual([]);
  });
});

describe('sign-out with queued picks', () => {
  it("keeps the rows on disk and clears the view's copy", async () => {
    await enqueuePick(queued());
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    await state().loadDailyDay();
    expect(state().dailyQueuedPicks).toHaveLength(1);

    state().clearAuth();

    expect(state().dailyQueuedPicks).toEqual([]);
    expect(await listQueuedPicks(A)).toEqual([queued()]);
  });
});
