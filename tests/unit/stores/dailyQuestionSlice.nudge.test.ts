/**
 * Nudging the partner in the store: `sendDailyNudge(source)` on the composed
 * `useAppStore`, with only the Supabase client and the API module mocked; the
 * "unknown is not failed" rule for a lost answer (DW-539), an "already sent"
 * refusal as a sent nudge, and the per-source "stays sent" merge.
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

import { NUDGE_FAILED_MESSAGE } from '../../../src/api/dailyQuestionApi';
import { AccountDataError } from '../../../src/services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../src/services/dailyDaysCopy';
import type { NudgeSource } from '../../../src/services/dailyNudges';
import { deleteAccountCopies, readLocalCopy } from '../../../src/services/localCopy';
import { useAppStore } from '../../../src/stores/useAppStore';
import {
  DAY_ID,
  KNOWN_PARTNER_ID,
  NUDGE_CLOSES_AT,
  dailySnapshot,
  knownPartnerState,
  legacyNudgeSnapshot,
  nudgesSnapshot,
  revealSnapshot,
} from './dailyQuestionFixture';
import { deferred } from './loaderIdentityGuardsFixture';
import { setOnline } from './navigatorFixtures';

const A = 'USER-A-ID';
const C = 'USER-C-ID';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);

const SOURCES: NudgeSource[] = ['prompt', 'button'];

function state() {
  return useAppStore.getState();
}

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

/** What `sendDailyNudge` throws for a refusal the server raised: the PostgREST error is its cause. */
const refusal = (code: string) =>
  new AccountDataError('refused', NUDGE_FAILED_MESSAGE, {
    cause: { message: 'server words', code, details: '', hint: '' },
  });

/** A day with exactly `source`'s nudge sent. */
const sentFrom = (source: NudgeSource) =>
  nudgesSnapshot({ prompt: source === 'prompt', button: source === 'button' });

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
    useAppStore.setState({ dailyDay: ok(nudgesSnapshot()) });
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot());
  });

  it.each(SOURCES)(
    'sends the shown day from the %s, merges the answer into the shown day and the copy, and announces once',
    async (source) => {
      sendDailyNudgeRequest.mockResolvedValue(sentFrom(source));

      await expect(state().sendDailyNudge(source)).resolves.toBe('sent');

      expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
      expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID, source);
      expect(state().dailyDay).toEqual(ok(sentFrom(source)));
      const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
      expect(saved?.[DAY_ID]).toEqual({ ...sentFrom(source), partner_id: null });
      expect(announceDailyNudge).toHaveBeenCalledTimes(1);
      expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
      expect(fetchDailyDayById).not.toHaveBeenCalled();
    }
  );

  it('tags the saved day with the known partner', async () => {
    useAppStore.setState(knownPartnerState());
    sendDailyNudgeRequest.mockResolvedValue(sentFrom('button'));

    await state().sendDailyNudge('button');

    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...sentFrom('button'), partner_id: KNOWN_PARTNER_ID });
  });

  it('grows the shown answers when the nudged day is on screen (DW-491)', async () => {
    sendDailyNudgeRequest.mockResolvedValue(sentFrom('prompt'));

    await state().sendDailyNudge('prompt');

    expect(state().dailyDayAnswers).toBe(1);
    expect(state().dailyDayAnsweredId).toBe(DAY_ID);
  });

  it('logs a failed broadcast and still answers sent', async () => {
    sendDailyNudgeRequest.mockResolvedValue(sentFrom('prompt'));
    const failure = new Error('Unauthorized');
    announceDailyNudge.mockRejectedValue(failure);

    await expect(state().sendDailyNudge('prompt')).resolves.toBe('sent');

    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[DailyQuestion] Could not announce the nudge:',
        failure
      )
    );
    expect(state().dailyDay).toEqual(ok(sentFrom('prompt')));
  });

  describe.each(SOURCES)('a refusal of the %s', (source) => {
    it.each(['DQ007', 'DQ008', 'DQ009', 'P0002', '22023'])(
      '%s answers failed, announces nothing and re-reads the day once without waiting for it',
      async (code) => {
        const error = refusal(code);
        sendDailyNudgeRequest.mockRejectedValue(error);
        const read = deferred<ReturnType<typeof nudgesSnapshot>>();
        fetchDailyDayById.mockReturnValue(read.promise);

        // Resolves while the re-read is still pending: the refusal does not wait for it.
        await expect(state().sendDailyNudge(source)).resolves.toBe('failed');

        expect(announceDailyNudge).not.toHaveBeenCalled();
        expect(fetchDailyDayById).toHaveBeenCalledTimes(1);
        expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID);
        // The API logged the refusal; the store does not log it again (DW-547).
        expect(console.error).not.toHaveBeenCalled();
        read.settle(nudgesSnapshot());
        await vi.waitFor(() => expect(state().dailyDay).toEqual(ok(nudgesSnapshot())));
      }
    );

    it('the re-read after a refusal shows the reveal when the partner picked', async () => {
      sendDailyNudgeRequest.mockRejectedValue(refusal('DQ008'));
      fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));

      await expect(state().sendDailyNudge(source)).resolves.toBe('failed');

      await vi.waitFor(() => expect(state().dailyDay).toMatchObject({ snapshot: { state: 'both' } }));
    });
  });

  /** What says the nudge is on record: an "already sent" refusal, or a successful answer that did not parse (DW-557). */
  const recorded: [string, () => AccountDataError][] = [
    ['an "already sent" refusal (DQ010)', () => refusal('DQ010')],
    ['an answer that is not a snapshot', () => new AccountDataError('invalid-response', 'not understood')],
  ];

  describe.each(SOURCES)('a nudge on record from the %s', (source) => {
    it.each(recorded)('%s ends as sent: the source is marked sent at once, the re-read is waited for and no failure shows', async (_name, make) => {
      sendDailyNudgeRequest.mockRejectedValue(make());
      const read = deferred<ReturnType<typeof nudgesSnapshot>>();
      fetchDailyDayById.mockReturnValue(read.promise);

      let outcome: string | undefined;
      const send = state()
        .sendDailyNudge(source)
        .then((value) => {
          outcome = value;
        });
      await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));

      // Marked sent in memory before the re-read answers; the other source untouched.
      expect(state().dailyDay).toEqual(ok(sentFrom(source)));
      expect(outcome).toBeUndefined();

      read.settle(sentFrom(source));
      await send;

      expect(outcome).toBe('sent');
      expect(announceDailyNudge).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalledWith(
        '[DailyQuestion] The nudge was refused:',
        expect.anything()
      );
    });

    it.each(recorded)('%s still ends as sent when the re-read fails, and writes no saved day', async (_name, make) => {
      sendDailyNudgeRequest.mockRejectedValue(make());
      fetchDailyDayById.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));

      await expect(state().sendDailyNudge(source)).resolves.toBe('sent');

      expect(state().dailyDay).toEqual(ok(sentFrom(source)));
      expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
    });
  });

  describe.each(SOURCES)('a lost answer of the %s', (source) => {
    const lost: [string, () => AccountDataError][] = [
      ['a timeout or network failure', () => new AccountDataError('transport', 'Failed to fetch')],
    ];

    it.each(lost)('%s waits for the re-read and ends as sent when it has the nudge', async (_name, make) => {
      sendDailyNudgeRequest.mockRejectedValue(make());
      const read = deferred<ReturnType<typeof nudgesSnapshot>>();
      fetchDailyDayById.mockReturnValue(read.promise);

      let outcome: string | undefined;
      const send = state()
        .sendDailyNudge(source)
        .then((value) => {
          outcome = value;
        });
      await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
      expect(outcome).toBeUndefined();

      read.settle(sentFrom(source));
      await send;

      expect(outcome).toBe('sent');
      expect(state().dailyDay).toEqual(ok(sentFrom(source)));
      expect(announceDailyNudge).not.toHaveBeenCalled();
      // The API logged the lost answer; the store does not log it again (DW-547).
      expect(console.error).not.toHaveBeenCalled();
    });

    it.each(lost)('%s ends as failed when the re-read has no nudge from that source', async (_name, make) => {
      sendDailyNudgeRequest.mockRejectedValue(make());
      // The other source's nudge does not count for this one.
      fetchDailyDayById.mockResolvedValue(sentFrom(source === 'prompt' ? 'button' : 'prompt'));

      await expect(state().sendDailyNudge(source)).resolves.toBe('failed');
    });

    it.each(lost)('%s ends as unchecked when the re-read fails too', async (_name, make) => {
      sendDailyNudgeRequest.mockRejectedValue(make());
      fetchDailyDayById.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));

      await expect(state().sendDailyNudge(source)).resolves.toBe('unchecked');
    });
  });

  it('offline throws the offline error and starts no re-read and no broadcast', async () => {
    const offline = new AccountDataError(
      'offline',
      'You are offline. Your nudge needs a connection to send.'
    );
    sendDailyNudgeRequest.mockRejectedValue(offline);

    await expect(state().sendDailyNudge('button')).rejects.toBe(offline);

    expect(fetchDailyDayById).not.toHaveBeenCalled();
    expect(announceDailyNudge).not.toHaveBeenCalled();
    expect(state().dailyDay).toEqual(ok(nudgesSnapshot()));
  });

  it('throws signed out, sending nothing', async () => {
    state().clearAuth();

    await expect(state().sendDailyNudge('prompt')).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('throws with no day shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: null });

    await expect(state().sendDailyNudge('prompt')).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('throws when the invitation to link is shown, sending nothing', async () => {
    useAppStore.setState({ dailyDay: { status: 'unlinked' } });

    await expect(state().sendDailyNudge('button')).rejects.toThrow(Error);
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
  });

  it('leaves another day on screen when the shown day changed during the request', async () => {
    const request = deferred<ReturnType<typeof nudgesSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);
    const other = dailySnapshot({ day_id: 'next-day', day: '2026-11-06' });

    const send = state().sendDailyNudge('button');
    useAppStore.setState({ dailyDay: ok(other) });
    request.settle(sentFrom('button'));
    await send;

    expect(state().dailyDay).toEqual(ok(other));
    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(saved?.[DAY_ID]).toEqual({ ...sentFrom('button'), partner_id: null });
    expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
  });

  it('writes and announces nothing when the session changed before the answer', async () => {
    const request = deferred<ReturnType<typeof nudgesSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge('prompt');
    useAppStore.setState({ userId: C, dailyDay: ok(dailySnapshot({ day_id: 'c-day' })) });
    request.settle(sentFrom('prompt'));
    await send;

    expect(state().dailyDay).toEqual(ok(dailySnapshot({ day_id: 'c-day' })));
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('writes nothing after a same-account re-login before the answer', async () => {
    const request = deferred<ReturnType<typeof nudgesSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge('prompt');
    state().clearAuth();
    state().setAuthUser(A);
    await deleteAccountCopies(A);
    request.settle(sentFrom('prompt'));
    await send;

    expect(state().dailyDay).toBeNull();
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('starts no re-read after a failure when the session changed meanwhile', async () => {
    const request = deferred<ReturnType<typeof nudgesSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);

    const send = state().sendDailyNudge('prompt');
    state().clearAuth();
    state().setAuthUser(C);
    request.fail(refusal('DQ009'));
    await send;

    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });

  // DW-561: the lost-answer and on-record branches check the session before their re-read too.
  it.each([
    ['a lost answer', () => new AccountDataError('transport', 'Failed to fetch'), 'unchecked'],
    ['an "already sent" refusal (DQ010)', () => refusal('DQ010'), 'sent'],
    ['an answer that is not a snapshot', () => new AccountDataError('invalid-response', 'not understood'), 'sent'],
  ])('starts no re-read after %s when the session changed meanwhile', async (_name, make, outcome) => {
    const request = deferred<ReturnType<typeof nudgesSnapshot>>();
    sendDailyNudgeRequest.mockReturnValue(request.promise);
    const other = ok(dailySnapshot({ day_id: 'c-day' }));

    const send = state().sendDailyNudge('prompt');
    state().clearAuth();
    state().setAuthUser(C);
    useAppStore.setState({ dailyDay: other });
    request.fail(make());

    await expect(send).resolves.toBe(outcome);
    expect(fetchDailyDayById).not.toHaveBeenCalled();
    expect(state().dailyDay).toEqual(other);
  });

  it('answers unchecked, with no write, when the session changed during the re-read of a lost answer', async () => {
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));
    const read = deferred<ReturnType<typeof nudgesSnapshot>>();
    fetchDailyDayById.mockReturnValue(read.promise);

    const send = state().sendDailyNudge('prompt');
    await vi.waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
    state().clearAuth();
    state().setAuthUser(C);
    read.settle(sentFrom('prompt'));

    await expect(send).resolves.toBe('unchecked');
    expect(await readLocalCopy(A, DAILY_DAYS_COPY_KIND)).toBeNull();
  });
});

describe("a sent nudge stays sent through the shown day and the copy", () => {
  it.each(SOURCES)('a slow read that started before the send cannot unsend the %s (loadDailyDay)', async (source) => {
    useAppStore.setState({ dailyDay: ok(sentFrom(source)) });
    const read = deferred<ReturnType<typeof ok>>();
    fetchDailyDay.mockReturnValue(read.promise);
    const load = state().loadDailyDay();

    read.settle(ok(nudgesSnapshot()));
    await load;

    expect(state().dailyDay).toEqual(ok(sentFrom(source)));
  });

  it.each(SOURCES)('a slow re-read cannot unsend the %s either (refreshDailyDay)', async (source) => {
    useAppStore.setState({ dailyDay: ok(sentFrom(source)) });
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot());

    await state().refreshDailyDay(DAY_ID);

    expect(state().dailyDay).toEqual(ok(sentFrom(source)));
  });

  it('keeps the two sources apart: a read with the button sent does not send the prompt', async () => {
    useAppStore.setState({ dailyDay: ok(nudgesSnapshot()) });
    fetchDailyDay.mockResolvedValue(ok(sentFrom('button')));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(sentFrom('button')));
  });

  it("takes the newer read's closing instant, and a sent source from either", async () => {
    useAppStore.setState({ dailyDay: ok(nudgesSnapshot({ prompt: true })) });
    fetchDailyDay.mockResolvedValue(
      ok(nudgesSnapshot({ button: true, closesAt: '2026-11-08T00:00:00+00:00' }))
    );

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(
      ok(nudgesSnapshot({ prompt: true, button: true, closesAt: '2026-11-08T00:00:00+00:00' }))
    );
  });

  it('a day with no nudges in the answer (a partner who answered) shows no closing instant', async () => {
    useAppStore.setState({ dailyDay: ok(sentFrom('prompt')) });
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt: null })));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(nudgesSnapshot({ prompt: true, closesAt: null })));
  });

  it('reads a day the build before this one saved by slot: its after_pick is the prompt', async () => {
    useAppStore.setState({ dailyDay: ok(legacyNudgeSnapshot('after_pick', true)) });
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(sentFrom('prompt')));
  });

  it('reads its evening slot as the button, and an unspent slot as nothing sent', async () => {
    useAppStore.setState({ dailyDay: ok(legacyNudgeSnapshot('evening', true)) });
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    await state().loadDailyDay();
    expect(state().dailyDay).toEqual(ok(sentFrom('button')));

    useAppStore.setState({ dailyDay: ok(legacyNudgeSnapshot('after_pick', false)) });
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    await state().loadDailyDay();
    expect(state().dailyDay).toEqual(ok(nudgesSnapshot()));
  });

  it('the day it was first shown with: the closing instant is the answer\'s', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt: NUDGE_CLOSES_AT })));

    await state().loadDailyDay();

    expect(state().dailyDay).toEqual(ok(nudgesSnapshot()));
  });
});

describe("a held nudge's live signal on the partner's device (criterion 15)", () => {
  /** What the recipient reads of the sender's day: no pick of their own, nothing of the nudge. */
  const recipientView = (overrides: Partial<ReturnType<typeof dailySnapshot>>) =>
    dailySnapshot({
      nudges: { prompt_sent: false, button_sent: false, closes_at: null },
      ...overrides,
    });

  it("leaves the partner's own current day on screen when the signal names a day that has not started for them", async () => {
    // The device's date is 2026-11-05: the sender's 2026-11-06 has not started here.
    const own = dailySnapshot({ day_id: 'own-day', day: '2026-11-05' });
    useAppStore.setState({ dailyDay: ok(own) });
    fetchDailyDayById.mockResolvedValue(
      recipientView({ day_id: 'sender-day', day: '2026-11-06', question: { this: 'Tea', that: 'Coffee' } })
    );

    await state().refreshDailyDay('sender-day');

    expect(fetchDailyDayById).toHaveBeenCalledWith('sender-day');
    expect(state().dailyDay).toEqual(ok(own));
    expect(state().dailyDayAnswers).toBe(0);
    // The named day is in the saved copy, not on screen.
    const saved = await readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);
    expect(Object.keys(saved ?? {})).toEqual(['sender-day']);
  });

  it('leaves an empty screen empty rather than filling it with a day that has not started', async () => {
    fetchDailyDayById.mockResolvedValue(recipientView({ day_id: 'sender-day', day: '2026-11-06' }));

    await state().refreshDailyDay('sender-day');

    expect(state().dailyDay).toBeNull();
  });

  it('shows the partner\'s own day, with its question and state, when the signal names it before 08:00 there', async () => {
    // Before 08:00 on 2026-11-05 the partner's screen already shows that day, unanswered.
    const own = dailySnapshot({ day_id: 'own-day', day: '2026-11-05' });
    useAppStore.setState({ dailyDay: ok(own) });
    const reread = recipientView({ day_id: 'own-day', day: '2026-11-05' });
    fetchDailyDayById.mockResolvedValue(reread);

    await state().refreshDailyDay('own-day');

    expect(state().dailyDay).toEqual(ok(reread));
    const shown = state().dailyDay;
    expect(shown?.status === 'ok' && shown.snapshot.question).toEqual({ this: 'Beach day', that: 'Mountain day' });
    expect(shown?.status === 'ok' && shown.snapshot.state).toBe('none');
  });
});
