/**
 * Nudging the partner in the store: `sendDailyNudge` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked, and
 * the `nudge.spent` rule of `mergeAnswer`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();
const fetchDailyDayById = vi.fn();
const sendDailyNudgeRequest = vi.fn();
const announceDailyNudge = vi.fn();

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
  sendDailyNudge: (...args: unknown[]) => sendDailyNudgeRequest(...args),
  announceDailyNudge: (...args: unknown[]) => announceDailyNudge(...args),
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import { deleteAccountCopies, readLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import {
  DAY_ID,
  KNOWN_PARTNER_ID,
  dailySnapshot,
  knownPartnerState,
  nudgeSnapshot,
  revealSnapshot,
} from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);

function state() {
  return useAppStore.getState();
}

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  sendDailyNudgeRequest.mockReset();
  announceDailyNudge.mockReset();
  announceDailyNudge.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  state().clearAuth();
  state().setAuthUser(A);
  await deleteAccountCopies(A);
  await deleteAccountCopies(C);
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('sendDailyNudge', () => {
  beforeEach(() => {
    useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', false)) });
    fetchDailyDayById.mockResolvedValue(nudgeSnapshot('after_pick', false));
  });

  it('sends the shown day, merges the answer into the shown day and the copy, and announces once', async () => {
    sendDailyNudgeRequest.mockResolvedValue(nudgeSnapshot('after_pick', true));

    await state().sendDailyNudge();

    expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
    expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID);
    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', true)));
    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...nudgeSnapshot('after_pick', true), partner_id: null });
    expect(announceDailyNudge).toHaveBeenCalledTimes(1);
    expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });

  it('tags the saved day with the known partner', async () => {
    useAppStore.setState(knownPartnerState());
    sendDailyNudgeRequest.mockResolvedValue(nudgeSnapshot('after_pick', true));

    await state().sendDailyNudge();

    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({
      ...nudgeSnapshot('after_pick', true),
      partner_id: KNOWN_PARTNER_ID,
    });
  });

  it('logs a failed broadcast and still resolves', async () => {
    sendDailyNudgeRequest.mockResolvedValue(nudgeSnapshot('after_pick', true));
    const failure = new Error('Unauthorized');
    announceDailyNudge.mockRejectedValue(failure);

    await expect(state().sendDailyNudge()).resolves.toBeUndefined();

    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[DailyQuestion] Could not announce the nudge:',
        failure
      )
    );
    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', true)));
  });

  it.each(['DQ007', 'DQ008', 'DQ009', 'DQ010', 'P0002'])(
    'a refusal (%s) throws, announces nothing and re-reads the day once',
    async (code) => {
      const refusal = new AccountDataError('refused', 'Your nudge could not be sent.', {
        cause: { code },
      });
      sendDailyNudgeRequest.mockRejectedValue(refusal);

      await expect(state().sendDailyNudge()).rejects.toBe(refusal);

      expect(announceDailyNudge).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
      expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID);
      expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', false)));
    }
  );

  it('a failed request throws, announces nothing and re-reads the day once', async () => {
    const failure = new AccountDataError('transport', 'Failed to fetch');
    sendDailyNudgeRequest.mockRejectedValue(failure);

    await expect(state().sendDailyNudge()).rejects.toBe(failure);

    expect(announceDailyNudge).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
  });

  it('the re-read after a refusal shows the reveal when the partner picked', async () => {
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('refused', 'x'));
    fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));

    await expect(state().sendDailyNudge()).rejects.toThrow();

    await vi.waitFor(() => expect(state().dailyDay).toMatchObject({ snapshot: { state: 'both' } }));
  });

  it('offline throws the offline error and starts no re-read and no broadcast', async () => {
    const offline = new AccountDataError(
      'offline',
      'You are offline. Your nudge needs a connection to send.'
    );
    sendDailyNudgeRequest.mockRejectedValue(offline);

    await expect(state().sendDailyNudge()).rejects.toBe(offline);

    expect(fetchDailyDayById).not.toHaveBeenCalled();
    expect(announceDailyNudge).not.toHaveBeenCalled();
    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', false)));
  });

  it('throws signed out, sending nothing', async () => {
    state().clearAuth();

    await expect(state().sendDailyNudge()).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('throws with no day shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: null });

    await expect(state().sendDailyNudge()).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('throws when the invitation to link is shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: { status: 'unlinked' } });

    await expect(state().sendDailyNudge()).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('leaves another day on screen when the shown day changed during the request', async () => {
    const request = deferred<ReturnType<typeof nudgeSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);
    const other = dailySnapshot({ day_id: 'next-day', day: '2026-11-06' });

    const send = state().sendDailyNudge();
    useAppStore.setState({ dailyDay: ok(other) });
    request.settle(nudgeSnapshot('after_pick', true));
    await send;

    expect(state().dailyDay).toEqual(ok(other));
    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...nudgeSnapshot('after_pick', true), partner_id: null });
    expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
  });

  it('writes and announces nothing when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof nudgeSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge();
    useAppStore.setState({ userId: C, dailyDay: ok(dailySnapshot({ day_id: 'c-day' })) });
    request.settle(nudgeSnapshot('after_pick', true));
    await send;

    expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'c-day' })));
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('writes nothing after a same-account re-login before the answer', async () => {
    const request = deferred<ReturnType<typeof nudgeSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge();
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    request.settle(nudgeSnapshot('after_pick', true));
    await send;

    expect(state().dailyDay).toBeNull();
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('starts no re-read after a failure when the session changed meanwhile', async () => {
    const request = deferred<ReturnType<typeof nudgeSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge();
    state().clearAuth();
    state().setAuthUser(C);
    request.fail(new AccountDataError('transport', 'Failed to fetch'));
    await expect(send).rejects.toThrow();

    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });
});

describe('nudge.spent through the shown day and the copy', () => {
  it('a slow read of the same slot cannot enable the button again (loadDailyDay)', async () => {
    useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', true)) });
    const read = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(read.promise);
    const load = state().loadDailyDay();

    read.settle(ok(nudgeSnapshot('after_pick', false)));
    await load;

    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', true)));
  });

  it('a slow re-read of the same slot cannot enable it either (refreshDailyDay)', async () => {
    useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', true)) });
    fetchDailyDayById.mockResolvedValue(nudgeSnapshot('after_pick', false));

    await state().refreshDailyDay(DAY_ID);

    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', true)));
  });

  it('a new slot starts unspent', async () => {
    useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', true)) });
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('evening', false)));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(nudgeSnapshot('evening', false)));
  });

  it('an answer without nudge reads as no slot, so it is shown as it is', async () => {
    useAppStore.setState({ dailyDay: ok(nudgeSnapshot('after_pick', true)) });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ state: 'me', my_choice: 'this', my_picked_at: 'x' })));

    await state().loadDailyDay();

    const shown = state().dailyDay;
    expect(shown?.status === 'ok' && shown.snapshot.nudge).toBeUndefined();
  });
});
