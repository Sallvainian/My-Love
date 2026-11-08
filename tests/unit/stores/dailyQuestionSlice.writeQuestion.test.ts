/**
 * Writing tomorrow's question in the store: `submitWrittenQuestion`,
 * `declineWrittenQuestion` and the `dailyWriteDeclined` field on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const fetchDailyDay = vi.fn();
const fetchDailyDayById = vi.fn();
const submitWrittenQuestionRequest = vi.fn();

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
  submitWrittenQuestion: (...args: unknown[]) => submitWrittenQuestionRequest(...args),
}));

import { AccountDataError } from '../../../src/services/accountDataError';
import {
  DAILY_WRITE_DECLINED_KIND,
  readDeclinedWriteDays,
} from '../../../src/services/dailyWriteDeclined';
import * as declinedModule from '../../../src/services/dailyWriteDeclined';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import {
  deleteAccountCopies,
  readLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import { DAY_ID, dailySnapshot, writerSnapshot } from './dailyQuestionFixture';
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
const done = () => writerSnapshot('this', { write: { mine: true, done: true } });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchDailyDayById.mockReset();
  submitWrittenQuestionRequest.mockReset();
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

describe('submitWrittenQuestion', () => {
  beforeEach(() => {
    useAppStore.setState({ dailyDay: ok(writerSnapshot()) });
  });

  it('sends the shown day with the texts as typed and stores the answer', async () => {
    submitWrittenQuestionRequest.mockResolvedValue(done());

    await state().submitWrittenQuestion(' Beach ', 'Mountains');

    expect(submitWrittenQuestionRequest).toHaveBeenCalledTimes(1);
    expect(submitWrittenQuestionRequest).toHaveBeenCalledWith(DAY_ID, ' Beach ', 'Mountains');
    expect(state().dailyDay).toEqual(ok(done()));
  });

  it('merges the answer into the saved days', async () => {
    submitWrittenQuestionRequest.mockResolvedValue(done());

    await state().submitWrittenQuestion('a', 'b');

    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...done(), partner_id: null });
  });

  it('does not let the answer undo a higher state', async () => {
    useAppStore.setState({
      dailyDay: ok(writerSnapshot('this', { state: 'both', partner_choice: 'that', same: false })),
    });
    submitWrittenQuestionRequest.mockResolvedValue(done());

    await state().submitWrittenQuestion('a', 'b');

    expect(state().dailyDay).toMatchObject({ snapshot: { state: 'both' } });
  });

  it('throws the request error and leaves the shown day as it was', async () => {
    const refusal = new AccountDataError('refused', 'The two options must differ');
    submitWrittenQuestionRequest.mockRejectedValue(refusal);

    await expect(state().submitWrittenQuestion('Tea', 'tea')).rejects.toBe(refusal);

    expect(state().dailyDay).toEqual(ok(writerSnapshot()));
  });

  it('throws signed out, sending nothing', async () => {
    state().clearAuth();

    await expect(state().submitWrittenQuestion('a', 'b')).rejects.toThrow(Error);
    expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
  });

  it('throws with no day shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: null });

    await expect(state().submitWrittenQuestion('a', 'b')).rejects.toThrow(Error);
    expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
  });

  it('throws when the invitation to link is shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: { status: 'unlinked' } });

    await expect(state().submitWrittenQuestion('a', 'b')).rejects.toThrow(Error);
    expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
  });

  it('writes nothing when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof done>>();
    submitWrittenQuestionRequest.mockReturnValue(request.promise);

    const submit = state().submitWrittenQuestion('a', 'b');
    useAppStore.setState({ userId: C, dailyDay: ok(dailySnapshot({ day_id: 'c-day' })) });
    request.settle(done());
    await submit;

    expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'c-day' })));
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
  });

  it('writes nothing after a sign-out before the answer', async () => {
    const request = deferred<ReturnType<typeof done>>();
    submitWrittenQuestionRequest.mockReturnValue(request.promise);

    const submit = state().submitWrittenQuestion('a', 'b');
    state().clearAuth();
    request.settle(done());
    await submit;

    expect(state().dailyDay).toBeNull();
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
  });

  it('writes nothing after a same-account re-login before the answer', async () => {
    const request = deferred<ReturnType<typeof done>>();
    submitWrittenQuestionRequest.mockReturnValue(request.promise);

    const submit = state().submitWrittenQuestion('a', 'b');
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    request.settle(done());
    await submit;

    expect(state().dailyDay).toBeNull();
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
  });
});

describe('a read that started before the Send', () => {
  const stale = () => writerSnapshot();

  it('does not reopen the turn in dailyDay or the copy (refreshDailyDay)', async () => {
    useAppStore.setState({ dailyDay: ok(writerSnapshot()) });
    const read = deferred<ReturnType<typeof writerSnapshot>>();
    fetchDailyDayById.mockReturnValue(read.promise);
    const refresh = state().refreshDailyDay(DAY_ID);
    submitWrittenQuestionRequest.mockResolvedValue(done());
    await state().submitWrittenQuestion('a', 'b');

    read.settle(stale());
    await refresh;

    expect(state().dailyDay).toEqual(ok(done()));
    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...done(), partner_id: null });
  });

  it('does not reopen the turn when an online load answers late', async () => {
    useAppStore.setState({ dailyDay: ok(writerSnapshot()) });
    const read = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(read.promise);
    const load = state().loadDailyDay();
    submitWrittenQuestionRequest.mockResolvedValue(done());
    await state().submitWrittenQuestion('a', 'b');

    read.settle(ok(stale()));
    await load;

    expect(state().dailyDay).toEqual(ok(done()));
  });
});

describe('declineWrittenQuestion', () => {
  it('saves the day in the kind and in the field', async () => {
    await state().declineWrittenQuestion(DAY_ID);

    expect(await readLocalCopy<string[]>(A, DAILY_WRITE_DECLINED_KIND)).toEqual([DAY_ID]);
    expect(state().dailyWriteDeclined).toEqual([DAY_ID]);
    expect(submitWrittenQuestionRequest).not.toHaveBeenCalled();
  });

  it('keeps earlier days and dedupes', async () => {
    await state().declineWrittenQuestion('d1');
    await state().declineWrittenQuestion('d2');
    await state().declineWrittenQuestion('d1');

    expect(state().dailyWriteDeclined).toEqual(['d2', 'd1']);
  });

  it('never throws: a write failure is logged, and the field stays as it was', async () => {
    vi.spyOn(declinedModule, 'addDeclinedWriteDay').mockRejectedValue(new Error('disk full'));

    await expect(state().declineWrittenQuestion(DAY_ID)).resolves.toBeUndefined();

    expect(state().dailyWriteDeclined).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "[DailyQuestion] Could not save that tomorrow's question was declined:",
      expect.objectContaining({ message: 'disk full' })
    );
  });

  it('does nothing signed out', async () => {
    state().clearAuth();

    await state().declineWrittenQuestion(DAY_ID);

    expect(state().dailyWriteDeclined).toEqual([]);
  });

  it("hands the write the slice's own session check", async () => {
    const add = vi.spyOn(declinedModule, 'addDeclinedWriteDay').mockResolvedValue([DAY_ID]);

    await state().declineWrittenQuestion(DAY_ID);

    expect(add).toHaveBeenCalledWith(A, DAY_ID, expect.any(Function));
    const isCurrent = add.mock.calls[0][2];
    expect(isCurrent()).toBe(true);
    state().clearAuth();
    expect(isCurrent()).toBe(false);
  });

  it('sets the field of no other session when the session changed during the write', async () => {
    const write = deferred<string[]>();
    vi.spyOn(declinedModule, 'addDeclinedWriteDay').mockReturnValue(write.promise);

    const decline = state().declineWrittenQuestion(DAY_ID);
    state().clearAuth();
    state().setAuthUser(C);
    write.settle([DAY_ID]);
    await decline;

    expect(state().dailyWriteDeclined).toEqual([]);
  });

  it('logs nothing after a same-account re-login during a failed write', async () => {
    const write = deferred<string[]>();
    vi.spyOn(declinedModule, 'addDeclinedWriteDay').mockReturnValue(write.promise);

    const decline = state().declineWrittenQuestion(DAY_ID);
    state().clearAuth();
    state().setAuthUser(A);
    write.fail(new Error('late'));
    await decline;

    expect(console.error).not.toHaveBeenCalled();
    expect(state().dailyWriteDeclined).toEqual([]);
  });
});

describe('loadDailyDay and dailyWriteDeclined', () => {
  it('fills the field from the kind', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, ['d1', DAY_ID]);
    fetchDailyDay.mockResolvedValue(ok(writerSnapshot()));

    await state().loadDailyDay();

    expect(state().dailyWriteDeclined).toEqual(['d1', DAY_ID]);
  });

  it('fills the field before the server answers', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, [DAY_ID]);
    const request = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(request.promise);

    const load = state().loadDailyDay();
    await vi.waitFor(() => expect(state().dailyWriteDeclined).toEqual([DAY_ID]));
    request.settle(ok(writerSnapshot()));
    await load;
  });

  it('leaves an empty field when the kind has no value', async () => {
    fetchDailyDay.mockResolvedValue(ok(writerSnapshot()));

    await state().loadDailyDay();

    expect(state().dailyWriteDeclined).toEqual([]);
    expect(await readDeclinedWriteDays(A)).toEqual([]);
  });

  it('is cleared with the rest of the account state on sign-out', async () => {
    await state().declineWrittenQuestion(DAY_ID);

    state().clearAuth();

    expect(state().dailyWriteDeclined).toEqual([]);
  });
});
