/**
 * The nudge prompt after an answer (NudgeSheet.tsx, DailyQuestion.tsx) against
 * the real store, with only the API module mocked: right after Send my pick, after
 * the write sheet however it closes, and when a pick saved offline is sent while
 * Daily is open (story 11.1, criteria 1-3, 5, 13, 14); one test per row of the
 * story's matrix, bar the reload (a remount is the closest a unit test gets).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coupleStreak,
  dailySnapshot,
  DAY_ID,
  legacyNudgeSnapshot,
  nudgesSnapshot,
  revealSnapshot,
  waitingSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const fetchCoupleStreak = vi.fn();
const submitDailyPickRequest = vi.fn();
const submitWrittenQuestionRequest = vi.fn();
const sendDailyNudgeRequest = vi.fn();
const fetchDailyDayById = vi.fn();

// The partner-event subscription has its own test: keep the callback the view hands it.
const listener = vi.hoisted(() => ({ onPartnerPick: undefined as undefined | ((id: string) => void) }));

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../hooks/useDailyPickListener', () => ({
  useDailyPickListener: (onPartnerPick?: (id: string) => void) => {
    listener.onPartnerPick = onPartnerPick;
  },
}));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
  fetchDailyDayById: (...args: unknown[]) => fetchDailyDayById(...args),
  announceDailyPick: vi.fn(async () => {}),
  announceDailyNudge: vi.fn(async () => {}),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
  submitWrittenQuestion: (...args: unknown[]) => submitWrittenQuestionRequest(...args),
  sendDailyNudge: (...args: unknown[]) => sendDailyNudgeRequest(...args),
}));

import { NUDGE_FAILED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { DAILY_CELEBRATED_KIND } from '../../../services/dailyCelebrated';
import { openMyLoveDB } from '../../../services/dbSchema';
import { enqueuePick } from '../../../services/pickQueue';
import { deleteAccountCopies, writeLocalCopy } from '../../../services/localCopy';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);
const USER = 'USER-A-ID';
const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

type Snapshot = ReturnType<typeof dailySnapshot>;
const ok = (snapshot: Snapshot) => ({ status: 'ok' as const, snapshot });
const sheet = () => screen.queryByTestId('daily-nudge-sheet');

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
  fetchDailyDayById.mockReset();
  submitDailyPickRequest.mockReset();
  submitWrittenQuestionRequest.mockReset();
  sendDailyNudgeRequest.mockReset();
  listener.onPartnerPick = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(USER);
  useAppStore.setState({
    partner: { id: 'USER-B-ID', displayName: 'Jessie', email: 'b@example.com' },
    coupleStreak: null,
    coupleStreakError: null,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  const queueDb = await openMyLoveDB();
  await queueDb.clear('pick-queue');
  queueDb.close();
  await deleteAccountCopies(USER);
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
});

/** Render Daily on an unpicked day, and pick `this` with the answer the server will give. */
async function pickWith(answer: Snapshot, day: Snapshot = dailySnapshot()) {
  const user = userEvent.setup();
  fetchDailyDay.mockResolvedValue(ok(day));
  submitDailyPickRequest.mockResolvedValue(answer);
  const view = render(<DailyQuestion />);
  await user.click(await screen.findByTestId('daily-option-this'));
  await user.click(screen.getByTestId('daily-send-pick'));
  return { user, view };
}

/** A refusal as `sendDailyNudge` throws it: the server's error is the cause. */
const refusal = (code: string) =>
  new AccountDataError('refused', NUDGE_FAILED_MESSAGE, {
    cause: { message: 'server words', code, details: '', hint: '' },
  });

/** The writer's day after their pick: the turn to write open, nudges as given. */
const writerAnswer = (nudges: Parameters<typeof nudgesSnapshot>[0] = {}) =>
  nudgesSnapshot(nudges, { write: { mine: true, done: false } });

describe('the nudge prompt after an answer', () => {
  it('first picker: the sheet shows once, with the question, beside the waiting card', async () => {
    await pickWith(nudgesSnapshot());

    const dialog = await screen.findByTestId('daily-nudge-sheet');
    expect(dialog).toHaveAccessibleName('Do you want to nudge your partner?');
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
  });

  it("Nudge sends the prompt's nudge once, closes the sheet and leaves the waiting button enabled", async () => {
    const { user } = await pickWith(nudgesSnapshot());
    sendDailyNudgeRequest.mockResolvedValue(nudgesSnapshot({ prompt: true }));

    await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

    await waitFor(() => expect(sheet()).toBeNull());
    expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
    expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID, 'prompt');
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    // The prompt does not come back for the question.
    await act(async () => {
      await useAppStore.getState().refreshDailyDay(DAY_ID);
    });
    expect(sheet()).toBeNull();
  });

  it.each([
    ['Not now', async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByTestId('daily-nudge-sheet-dismiss'))],
    ['a scrim tap', async (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByTestId('daily-nudge-sheet'))],
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
  ])('%s ends the prompt only: sends nothing and the waiting button still offers its own nudge', async (_l, close) => {
    const { user } = await pickWith(nudgesSnapshot());
    await screen.findByTestId('daily-nudge-sheet');

    await close(user);

    expect(sheet()).toBeNull();
    expect(sendDailyNudgeRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    // A later re-read of the same day does not bring it back.
    await act(async () => {
      await useAppStore.getState().refreshDailyDay(DAY_ID);
    });
    expect(sheet()).toBeNull();

    // And the button's own nudge is still taken.
    sendDailyNudgeRequest.mockResolvedValue(nudgesSnapshot({ button: true }));
    await user.click(screen.getByTestId('daily-nudge'));
    await waitFor(() =>
      expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID, 'button')
    );
  });

  it('second picker: the reveal, no sheet', async () => {
    await pickWith(revealSnapshot('this', 'that'));

    expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it.each([
    ['no closing instant (the day ended on the partner\'s clock, or the link is one-way)', nudgesSnapshot({ closesAt: null })],
    ['the prompt\'s nudge already sent', nudgesSnapshot({ prompt: true })],
    ['no nudge fields at all (an answer from a server without them)', waitingSnapshot('this')],
    ['an old build\'s day with its slot spent', legacyNudgeSnapshot('after_pick', true)],
  ])('%s: no sheet', async (_label, answer) => {
    await pickWith(answer);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a day that opens already picked offers nothing: only an answer confirmed in view raises it', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a remount after the offer shows nothing', async () => {
    const { view } = await pickWith(nudgesSnapshot());
    await screen.findByTestId('daily-nudge-sheet');

    view.unmount();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });

  it('a remount after Not now shows nothing either, and the button still offers a nudge', async () => {
    const { view, user } = await pickWith(nudgesSnapshot());
    await user.click(await screen.findByTestId('daily-nudge-sheet-dismiss'));

    view.unmount();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();
    expect(sheet()).toBeNull();
  });

  it('an account switch hides the offer', async () => {
    await pickWith(nudgesSnapshot());
    await screen.findByTestId('daily-nudge-sheet');

    await act(async () => {
      useAppStore.getState().clearAuth();
    });

    expect(sheet()).toBeNull();
  });

  describe('after the write sheet (the writer)', () => {
    /** Pick as the day's writer; the write sheet opens first. */
    async function pickAsWriter(answer = writerAnswer()) {
      const picked = await pickWith(answer, dailySnapshot({ write: { mine: true, done: false } }));
      await screen.findByTestId('daily-write-sheet');
      expect(sheet()).toBeNull();
      return picked;
    }

    it.each([
      ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
      ['a tap outside it', async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByTestId('daily-write-sheet'))],
      ['No thanks', async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByTestId('daily-write-decline'))],
    ])('%s closes it and the prompt shows', async (_label, close) => {
      const { user } = await pickAsWriter();

      await close(user);

      await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });

    it("writing tomorrow's question closes it and the prompt shows", async () => {
      const { user } = await pickAsWriter();
      submitWrittenQuestionRequest.mockResolvedValue(
        nudgesSnapshot({}, { write: { mine: true, done: true } })
      );

      await user.type(screen.getByTestId('daily-write-this'), 'Tea');
      await user.type(screen.getByTestId('daily-write-that'), 'Coffee');
      await user.click(screen.getByTestId('daily-write-send'));

      await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });

    it('Nudge on the prompt after it sends the prompt\'s nudge', async () => {
      const { user } = await pickAsWriter();
      await user.keyboard('{Escape}');
      sendDailyNudgeRequest.mockResolvedValue(nudgesSnapshot({ prompt: true }));

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      await waitFor(() => expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID, 'prompt'));
      await waitFor(() => expect(sheet()).toBeNull());
    });

    it('the partner answering while the write sheet is open: no prompt after it closes', async () => {
      const { user } = await pickAsWriter();

      act(() => listener.onPartnerPick?.(DAY_ID));
      await act(async () => {
        useAppStore.setState({
          dailyDay: ok({ ...revealSnapshot('this', 'that'), write: { mine: true, done: false } }),
        });
      });
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
      expect(sheet()).toBeNull();
    });

    it("a partner's daily_pick for the day while the write sheet is open drops the offer for good", async () => {
      const { user } = await pickAsWriter();

      act(() => listener.onPartnerPick?.(DAY_ID));
      await user.keyboard('{Escape}');
      // A stale read shows the own pick alone again.
      await act(async () => {
        useAppStore.setState({ dailyDay: ok(writerAnswer()) });
      });

      expect(sheet()).toBeNull();
    });

    it('the day ending while the write sheet is open: no prompt after it closes', async () => {
      const { user } = await pickAsWriter();

      // A re-read says the day has ended on the partner\'s clock: no closing instant.
      await act(async () => {
        useAppStore.setState({ dailyDay: ok(writerAnswer({ closesAt: null })) });
      });
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
      expect(sheet()).toBeNull();
    });
  });

  describe('a pick saved offline', () => {
    /** Pick offline: the row queues and the card says it is waiting to send. */
    async function pickOffline() {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      const view = render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      setOnline(false);
      await user.click(screen.getByTestId('daily-send-pick'));
      expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
      expect(sheet()).toBeNull();
      expect(submitDailyPickRequest).not.toHaveBeenCalled();
      setOnline(true);
      return { user, view };
    }

    it('offers the prompt when it sends while Daily is open and the partner has not answered', async () => {
      await pickOffline();
      submitDailyPickRequest.mockResolvedValue(nudgesSnapshot());

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });

      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
      expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);
    });

    it('offers nothing when the partner had answered by then (the reveal)', async () => {
      await pickOffline();
      submitDailyPickRequest.mockResolvedValue(revealSnapshot('this', 'that'));

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });

      expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
      expect(sheet()).toBeNull();
    });

    it('offers nothing when the day has ended on the partner\'s clock (no closing instant)', async () => {
      await pickOffline();
      submitDailyPickRequest.mockResolvedValue(nudgesSnapshot({ closesAt: null }));

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });

      expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
      expect(sheet()).toBeNull();
    });

    it('the writer gets the write sheet first and the prompt after it', async () => {
      const { user } = await pickOffline();
      fetchDailyDayById.mockResolvedValue(writerAnswer());
      submitDailyPickRequest.mockResolvedValue(writerAnswer());
      useAppStore.setState({
        dailyDay: ok(dailySnapshot({ write: { mine: true, done: false } })),
      });

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });

      await screen.findByTestId('daily-write-sheet');
      expect(sheet()).toBeNull();
      await user.keyboard('{Escape}');
      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });

    it('when Daily is not open at that moment, the prompt is not offered later', async () => {
      const { view } = await pickOffline();
      view.unmount();
      submitDailyPickRequest.mockResolvedValue(nudgesSnapshot());

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });
      // The signal is in the store while Daily is closed.
      expect(useAppStore.getState().dailyQueuedPickSent).toMatchObject({ dayId: DAY_ID });

      fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
      render(<DailyQuestion />);

      expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
      expect(sheet()).toBeNull();
    });

    it('the same signal value never re-raises the prompt once it was closed', async () => {
      await pickOffline();
      submitDailyPickRequest.mockResolvedValue(nudgesSnapshot());
      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });
      const user = userEvent.setup();
      await user.click(await screen.findByTestId('daily-nudge-sheet-dismiss'));
      expect(sheet()).toBeNull();

      // The same signal value never re-raises it.
      await act(async () => {
        useAppStore.setState({ dailyDay: ok(nudgesSnapshot()) });
      });
      expect(sheet()).toBeNull();
    });

    it('one drain pass that confirms an earlier day and then the shown day offers the prompt for the shown day', async () => {
      await pickOffline();
      const EARLIER = '00000000-0000-4000-8000-0000000000d0';
      await enqueuePick({
        user_id: USER,
        day_id: EARLIER,
        choice: 'this',
        picked_at: new Date(SAME_DAY.getTime() - 86_400_000).toISOString(),
        time_zone: 'UTC',
        utc_offset_minutes: 0,
        failed: false,
        failure: null,
      });
      // The queue is oldest first: the earlier day's row, then the shown day's.
      submitDailyPickRequest
        .mockResolvedValueOnce(
          nudgesSnapshot({}, { day_id: EARLIER, day: '2026-11-04' })
        )
        .mockResolvedValueOnce(nudgesSnapshot());

      await act(async () => {
        await useAppStore.getState().drainQueuedPicks();
      });

      expect(submitDailyPickRequest).toHaveBeenCalledTimes(2);
      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
      expect(useAppStore.getState().dailyQueuedPickSent).toMatchObject({ dayId: DAY_ID });
    });
  });

  describe('behind the overlays', () => {
    it('waits for the +1, then shows when it closes', async () => {
      await writeLocalCopy(USER, DAILY_CELEBRATED_KIND, { held: 1, milestones: 0 });
      fetchCoupleStreak.mockResolvedValue({ status: 'ok', streak: coupleStreak({ held: 2 }) });

      const { user } = await pickWith(nudgesSnapshot());

      expect(await screen.findByTestId('daily-streak-up')).toBeInTheDocument();
      expect(sheet()).toBeNull();

      await user.click(screen.getByTestId('daily-streak-up-continue'));

      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });

    it('waits for the milestone screen too', async () => {
      await writeLocalCopy(USER, DAILY_CELEBRATED_KIND, { held: 24, milestones: 0 });
      fetchCoupleStreak.mockResolvedValue({
        status: 'ok',
        streak: coupleStreak({ held: 25, milestones: 1 }),
      });

      const { user } = await pickWith(nudgesSnapshot());

      await user.click(await screen.findByTestId('daily-streak-up-continue'));
      const milestone = await screen.findByTestId('daily-milestone');
      expect(milestone).toBeInTheDocument();
      expect(sheet()).toBeNull();

      await user.click(screen.getByTestId('daily-milestone-continue'));

      expect(await screen.findByTestId('daily-nudge-sheet')).toBeInTheDocument();
    });
  });

  describe("the partner's pick", () => {
    it('a daily_pick for that day closes the sheet and it does not return', async () => {
      await pickWith(nudgesSnapshot());
      await screen.findByTestId('daily-nudge-sheet');

      act(() => listener.onPartnerPick?.(DAY_ID));

      expect(sheet()).toBeNull();
      // Even if a stale read shows the own pick alone again.
      await act(async () => {
        useAppStore.setState({ dailyDay: ok(nudgesSnapshot()) });
      });
      expect(sheet()).toBeNull();
    });

    it('a daily_pick for another day leaves the sheet', async () => {
      await pickWith(nudgesSnapshot());
      await screen.findByTestId('daily-nudge-sheet');

      act(() => listener.onPartnerPick?.('00000000-0000-4000-8000-0000000000d2'));

      expect(sheet()).toBeInTheDocument();
    });

    it('a re-read to both closes the sheet', async () => {
      await pickWith(nudgesSnapshot());
      await screen.findByTestId('daily-nudge-sheet');
      fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));

      await act(async () => {
        await useAppStore.getState().refreshDailyDay(DAY_ID);
      });

      expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
      expect(sheet()).toBeNull();
    });
  });

  describe('Nudge on the sheet fails', () => {
    it('a refusal: the sheet stays with the fixed line, Nudge enabled, and the day is re-read', async () => {
      const { user } = await pickWith(nudgesSnapshot());
      sendDailyNudgeRequest.mockRejectedValue(refusal('DQ009'));
      fetchDailyDayById.mockResolvedValue(nudgesSnapshot());

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
        /^Your nudge could not be sent\.$/
      );
      expect(sheet()).toBeInTheDocument();
      expect(screen.getByTestId('daily-nudge-sheet-send')).toBeEnabled();
      await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
    });

    it('a lost answer: no line first, both buttons disabled until the re-read ends, then the sheet closes as sent', async () => {
      const { user } = await pickWith(nudgesSnapshot());
      sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));
      let settle: (snapshot: ReturnType<typeof nudgesSnapshot>) => void = () => {};
      fetchDailyDayById.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
      expect(screen.queryByTestId('daily-nudge-sheet-error')).toBeNull();
      expect(screen.getByTestId('daily-nudge-sheet-send')).toBeDisabled();
      expect(screen.getByTestId('daily-nudge-sheet-dismiss')).toBeDisabled();
      // A tap outside and Escape do nothing meanwhile.
      await user.click(screen.getByTestId('daily-nudge-sheet'));
      await user.keyboard('{Escape}');
      expect(sheet()).toBeInTheDocument();

      await act(async () => settle(nudgesSnapshot({ prompt: true })));

      await waitFor(() => expect(sheet()).toBeNull());
    });

    it('a lost answer with a failed re-read says it could not check, and Nudge is enabled', async () => {
      const { user } = await pickWith(nudgesSnapshot());
      sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));
      fetchDailyDayById.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
        /^We couldn't check if your nudge went through\. Try again\?$/
      );
      expect(screen.getByTestId('daily-nudge-sheet-send')).toBeEnabled();
    });

    it('an "already sent" refusal closes the sheet as a sent nudge, with no line', async () => {
      const { user } = await pickWith(nudgesSnapshot());
      sendDailyNudgeRequest.mockRejectedValue(refusal('DQ010'));
      fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ prompt: true }));

      await user.click(await screen.findByTestId('daily-nudge-sheet-send'));

      await waitFor(() => expect(sheet()).toBeNull());
      expect(screen.queryByTestId('daily-nudge-sheet-error')).toBeNull();
    });

    it('offline: the offline sentence on the sheet, and no re-read', async () => {
      const { user } = await pickWith(nudgesSnapshot());
      await screen.findByTestId('daily-nudge-sheet');
      // The request layer refuses offline before any request, as in the waiting card's test.
      sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('offline', OFFLINE_SENTENCE));
      setOnline(false);

      await user.click(screen.getByTestId('daily-nudge-sheet-send'));

      expect(await screen.findByTestId('daily-nudge-sheet-error')).toHaveTextContent(
        OFFLINE_SENTENCE
      );
      expect(fetchDailyDayById).not.toHaveBeenCalled();
      expect(sheet()).toBeInTheDocument();
    });
  });
});

describe('the prompt closes at the question\'s closing instant (criterion 14)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(SAME_DAY);
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('hides the sheet at the instant, with no re-read, and the unsent button goes too', async () => {
    const closesAt = new Date(SAME_DAY.getTime() + 60_000).toISOString();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    submitDailyPickRequest.mockResolvedValue(nudgesSnapshot({ closesAt }));
    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));
    await screen.findByTestId('daily-nudge-sheet');
    const reads = fetchDailyDay.mock.calls.length;

    act(() => void vi.advanceTimersByTime(Date.parse(closesAt) - Date.now() - 1));
    expect(sheet()).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1));
    expect(sheet()).toBeNull();
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    expect(fetchDailyDay).toHaveBeenCalledTimes(reads);
    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });

  it('a prompt that was waiting behind the write sheet never shows once its instant has passed', async () => {
    const closesAt = new Date(SAME_DAY.getTime() + 60_000).toISOString();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ write: { mine: true, done: false } })));
    submitDailyPickRequest.mockResolvedValue(writerAnswer({ closesAt }));
    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));
    await screen.findByTestId('daily-write-sheet');

    act(() => void vi.advanceTimersByTime(Date.parse(closesAt) - Date.now() + 1));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByTestId('daily-write-sheet')).toBeNull());
    expect(sheet()).toBeNull();
  });
});
