/**
 * Overlapping `loadDailyDay` calls in the store: one read in flight plus one trailing
 * pass per session (`trailingRead.ts`), with only the Supabase client and the API
 * module mocked. Each read is held open by a `deferred`, and every wait is on the
 * mock's call count or on the promise a call returned, never on a fixed sleep.
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

import { AccountDataError } from '../../../src/services/accountDataError';
import { deleteAccountCopies } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { dailySnapshot, waitingSnapshot } from './dailyQuestionFixture';
import { ok, SAME_DAY, state } from './dailyQuestionSliceFixture';
import { deferred, A } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

const realLoadCoupleStreak = useAppStore.getState().loadCoupleStreak;
const loadCoupleStreak = vi.fn(async () => {});

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  announceDailyPick.mockReset();
  announceDailyPick.mockResolvedValue(undefined);
  // The streak read has its own tests; here only whether a pick asks for it.
  useAppStore.setState({ loadCoupleStreak });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
});

afterEach(() => {
  useAppStore.setState({ loadCoupleStreak: realLoadCoupleStreak });
  vi.useRealTimers();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('overlapping loadDailyDay calls', () => {
  it('three overlapping calls send exactly two reads: the running one and one trailing pass', async () => {
    const running = deferred<ReturnType<typeof ok>>();
    fetchDailyDay
      .mockReturnValueOnce(running.promise)
      .mockResolvedValueOnce(ok(waitingSnapshot('this')));

    const calls = [state().loadDailyDay()];
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    // A call asks for its trailing pass as it is made, so no wait is needed between the calls.
    calls.push(state().loadDailyDay());
    calls.push(state().loadDailyDay());
    expect(fetchDailyDay).toHaveBeenCalledTimes(1);
    running.settle(ok(dailySnapshot()));
    await Promise.all(calls);

    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    expect(state().dailyDayLoading).toBe(false);
  });

  it("a call that arrives while a read runs gets a read started after the call, and its promise settles after that read's pass", async () => {
    const running = deferred<ReturnType<typeof ok>>();
    const trailing = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(running.promise).mockReturnValueOnce(trailing.promise);

    const first = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    let secondSettled = false;
    const second = state()
      .loadDailyDay()
      .then(() => {
        secondSettled = true;
      });
    running.settle(ok(dailySnapshot()));
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(2));
    // The second call waits for the trailing pass, which started after it and is held open.
    expect(secondSettled).toBe(false);
    expect(state().dailyDayLoading).toBe(true);
    trailing.settle(ok(waitingSnapshot('this')));
    await Promise.all([first, second]);

    expect(secondSettled).toBe(true);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it("the first caller's promise settles after its own pass, while a trailing pass is still reading", async () => {
    const running = deferred<ReturnType<typeof ok>>();
    const trailing = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(running.promise).mockReturnValueOnce(trailing.promise);

    let firstSettled = false;
    const first = state()
      .loadDailyDay()
      .then(() => {
        firstSettled = true;
      });
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    let secondSettled = false;
    const second = state()
      .loadDailyDay()
      .then(() => {
        secondSettled = true;
      });
    running.settle(ok(dailySnapshot()));
    await first;
    // The trailing pass is requested and its read is out, but the first caller is done.
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(2));
    expect(firstSettled).toBe(true);
    expect(secondSettled).toBe(false);
    expect(state().dailyDayLoading).toBe(true);
    trailing.settle(ok(waitingSnapshot('this')));
    await second;
    expect(secondSettled).toBe(true);
  });

  it('calls that arrive during the trailing pass share a third pass; each settles after the pass that covers it', async () => {
    const reads = [
      deferred<ReturnType<typeof ok>>(),
      deferred<ReturnType<typeof ok>>(),
      deferred<ReturnType<typeof ok>>(),
    ];
    fetchDailyDay
      .mockReturnValueOnce(reads[0].promise)
      .mockReturnValueOnce(reads[1].promise)
      .mockReturnValueOnce(reads[2].promise);
    const settled: string[] = [];
    const track = (name: string, call: Promise<void>) =>
      call.then(() => {
        settled.push(name);
      });

    const a = track('a', state().loadDailyDay());
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    const b = track('b', state().loadDailyDay());
    reads[0].settle(ok(dailySnapshot()));
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(2));
    // Arrives while the trailing pass reads: it asks for one more.
    const c = track('c', state().loadDailyDay());
    const d = track('d', state().loadDailyDay());
    reads[1].settle(ok(dailySnapshot()));
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(3));
    expect(settled).toEqual(['a', 'b']);
    reads[2].settle(ok(waitingSnapshot('this')));
    await Promise.all([a, b, c, d]);

    expect(settled).toEqual(['a', 'b', 'c', 'd']);
    expect(fetchDailyDay).toHaveBeenCalledTimes(3);
  });

  it('a read that fails still gets its trailing pass, and a later pass clears the error', async () => {
    const running = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(running.promise).mockResolvedValueOnce(ok(dailySnapshot()));

    const first = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    const second = state().loadDailyDay();
    running.fail(new AccountDataError('transport', 'boom'));
    await Promise.all([first, second]);

    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    expect(state().dailyDay).toEqual(ok(dailySnapshot()));
    expect(state().dailyDayError).toBeNull();
  });

  it('a call after the reads ended starts a new read', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    await state().loadDailyDay();
    await state().loadDailyDay();

    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
  });

  it("a call in a new session starts its own read and never joins the old session's", async () => {
    const old = deferred<ReturnType<typeof ok>>();
    fetchDailyDay
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(ok(waitingSnapshot('this')));

    const oldLoad = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    await state().loadDailyDay();

    // The new session's read sent while the old one was still open.
    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
    old.settle(ok(dailySnapshot()));
    await oldLoad;

    // The old read's end writes nothing and sends no trailing pass.
    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });

  it('a call that asks for a trailing pass in a session that ended sends nothing for it', async () => {
    const old = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(old.promise);

    const oldLoad = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    const dropped = state().loadDailyDay();
    state().clearAuth();
    old.settle(ok(dailySnapshot()));
    await oldLoad;

    // The call that asked for the dropped pass settles; it is not left hanging.
    await expect(dropped).resolves.toBeUndefined();
    expect(fetchDailyDay).toHaveBeenCalledTimes(1);
    expect(state().dailyDay).toBeNull();
  });

  it('a trailing pass asked for before a same-account re-login is never sent in the new session', async () => {
    const old = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValueOnce(old.promise).mockResolvedValue(ok(dailySnapshot()));

    const oldLoad = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    const dropped = state().loadDailyDay();
    // The same account signs in again: the user id is the same, the session is not.
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    old.settle(ok(dailySnapshot()));
    await oldLoad;
    await expect(dropped).resolves.toBeUndefined();

    expect(fetchDailyDay).toHaveBeenCalledTimes(1);
    expect(state().dailyDay).toBeNull();
  });

  it("the old session's read ending leaves the new session's read in its slot", async () => {
    const old = deferred<ReturnType<typeof ok>>();
    const fresh = deferred<ReturnType<typeof ok>>();
    fetchDailyDay
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise)
      .mockResolvedValueOnce(ok(waitingSnapshot('this')));

    const oldLoad = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(1));
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    const freshLoad = state().loadDailyDay();
    await vi.waitFor(() => expect(fetchDailyDay).toHaveBeenCalledTimes(2));
    old.settle(ok(dailySnapshot()));
    await oldLoad;

    // The new session's read is still open, so this call asks for a pass after it.
    const joined = state().loadDailyDay();
    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    fresh.settle(ok(dailySnapshot()));
    await Promise.all([freshLoad, joined]);

    expect(fetchDailyDay).toHaveBeenCalledTimes(3);
    expect(state().dailyDay).toEqual(ok(waitingSnapshot('this')));
  });
});

