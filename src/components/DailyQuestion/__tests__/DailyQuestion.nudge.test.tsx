/**
 * The Daily Question view's waiting card and its Nudge button (AD-17) against
 * the real store, with only the API module mocked: the button's own nudge per
 * question, grey only when sent, hidden when it can no longer be sent, closing
 * at the question's closing instant with no re-read, and the lost-answer and
 * "already sent" rules the prompt shares (story 11.1, criteria 6, 14, 16, 17, 19).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DAY_ID,
  legacyNudgeSnapshot,
  nudgesSnapshot,
  revealSnapshot,
  waitingSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const fetchCoupleStreak = vi.fn();
const fetchDailyDayById = vi.fn();
const sendDailyNudgeRequest = vi.fn();
const announceDailyNudge = vi.fn(async (_dayId: string) => {});

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

// The partner-event subscription has its own test.
vi.mock('../../../hooks/useDailyPickListener', () => ({ useDailyPickListener: () => {} }));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
  fetchDailyDayById: (...args: unknown[]) => fetchDailyDayById(...args),
  announceDailyNudge: (dayId: string) => announceDailyNudge(dayId),
  sendDailyNudge: (...args: unknown[]) => sendDailyNudgeRequest(...args),
}));

import { NUDGE_FAILED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { deleteAccountCopies } from '../../../services/localCopy';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);

const ok = (snapshot: ReturnType<typeof nudgesSnapshot>) => ({ status: 'ok' as const, snapshot });
/** A refusal as `sendDailyNudge` throws it: the server's error is the cause. */
const refusal = (code: string) =>
  new AccountDataError('refused', NUDGE_FAILED_MESSAGE, {
    cause: { message: 'server words', code, details: '', hint: '' },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
  fetchDailyDayById.mockReset();
  sendDailyNudgeRequest.mockReset();
  announceDailyNudge.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('USER-A-ID');
  useAppStore.setState({
    partner: { id: 'USER-B-ID', displayName: 'Jessie', email: 'b@example.com' },
    coupleStreak: null,
    coupleStreakError: null,
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  await deleteAccountCopies('USER-A-ID');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('DailyQuestion waiting card and nudge', () => {
  const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

  it('shows the dashed waiting card with the partner line and an enabled Nudge button', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));

    render(<DailyQuestion />);

    const card = await screen.findByTestId('daily-waiting');
    expect(card).toHaveTextContent('Waiting on Jessie');
    expect(card).toHaveTextContent("They can't see your pick until they make theirs.");
    expect(screen.getByTestId('daily-nudge')).toHaveTextContent('Nudge Jessie');
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
  });

  it('the button is enabled when only the prompt was sent: using one never spends the other', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ prompt: true })));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();
  });

  it('shows the button greyed as sent once its own nudge is sent, with no failure line', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ button: true })));

    render(<DailyQuestion />);

    const button = await screen.findByTestId('daily-nudge');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-sent', 'true');
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
  });

  it('keeps a sent button greyed when the question no longer takes nudges (no closing instant)', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ button: true, closesAt: null })));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-nudge')).toBeDisabled();
  });

  it.each([
    ['no closing instant: a link that is not both ways, or a day past', nudgesSnapshot({ closesAt: null })],
    ['an old build\'s saved day with nothing sent', legacyNudgeSnapshot('after_pick', false)],
    ['an old build\'s saved day with only the prompt sent', legacyNudgeSnapshot('after_pick', true)],
    ['an old build\'s day with a null slot', legacyNudgeSnapshot(null, false)],
    ['no nudge fields at all', waitingSnapshot('this')],
  ])('hides an unsent button for %s', async (_label, snapshot) => {
    // The server's answer for that day is still pending: nothing says it can be sent.
    fetchDailyDay.mockReturnValue(new Promise(() => {}));
    useAppStore.setState({ dailyDay: ok(snapshot) });

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
  });

  it("shows an old build's saved day with its evening slot sent as the button sent, greyed", async () => {
    fetchDailyDay.mockReturnValue(new Promise(() => {}));
    useAppStore.setState({ dailyDay: ok(legacyNudgeSnapshot('evening', true)) });

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-nudge')).toBeDisabled();
    expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
  });

  it("an old build's saved day gets its button when the server answers with a closing instant", async () => {
    let settle: (answer: ReturnType<typeof ok>) => void = () => {};
    fetchDailyDay.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    useAppStore.setState({ dailyDay: ok(legacyNudgeSnapshot('after_pick', false)) });

    render(<DailyQuestion />);
    await screen.findByTestId('daily-waiting');
    expect(screen.queryByTestId('daily-nudge')).toBeNull();

    await act(async () => settle(ok(nudgesSnapshot())));

    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();
  });

  it('shows no waiting card unless only the own pick is in', async () => {
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-reveal');

    expect(screen.queryByTestId('daily-waiting')).toBeNull();
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
  });

  it('sends the button\'s nudge once, disables the button while it is in flight, and greys it once sent', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    let settle: (snapshot: ReturnType<typeof nudgesSnapshot>) => void = () => {};
    sendDailyNudgeRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toBeDisabled());
    expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
    expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID, 'button');

    await act(async () => settle(nudgesSnapshot({ button: true })));

    await waitFor(() => expect(announceDailyNudge).toHaveBeenCalledTimes(1));
    expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
    expect(screen.getByTestId('daily-nudge')).toBeDisabled();
    expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    expect(useAppStore.getState().dailyDay).toEqual(ok(nudgesSnapshot({ button: true })));
  });

  it('a refusal shows the fixed line, announces nothing and re-reads the day: the reveal replaces the card', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));
    sendDailyNudgeRequest.mockRejectedValue(refusal('DQ008'));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
    expect(announceDailyNudge).not.toHaveBeenCalled();
    expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
  });

  it('a refusal shows the fixed line and keeps the button for another try', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot());
    sendDailyNudgeRequest.mockRejectedValue(refusal('DQ009'));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    expect(await screen.findByTestId('daily-nudge-error')).toHaveTextContent(
      /^Your nudge could not be sent\.$/
    );
    await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledTimes(1));
    expect(announceDailyNudge).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();

    // The next tap clears the line first.
    sendDailyNudgeRequest.mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByTestId('daily-nudge'));
    await waitFor(() => expect(screen.queryByTestId('daily-nudge-error')).toBeNull());
  });

  describe('a send whose answer is lost (DW-539)', () => {
    const lost = () => new AccountDataError('transport', 'Failed to fetch');

    it('shows no failure line at first, keeps the button disabled until the re-read ends, then shows it sent', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
      sendDailyNudgeRequest.mockRejectedValue(lost());
      let settle: (snapshot: ReturnType<typeof nudgesSnapshot>) => void = () => {};
      fetchDailyDayById.mockReturnValue(new Promise((resolve) => (settle = resolve)));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-nudge'));

      await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
      expect(screen.getByTestId('daily-nudge')).toBeDisabled();
      expect(screen.queryByTestId('daily-nudge-error')).toBeNull();

      await act(async () => settle(nudgesSnapshot({ button: true })));

      await waitFor(() => expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true'));
      expect(screen.getByTestId('daily-nudge')).toBeDisabled();
      expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    });

    it('a re-read with no nudge from the button shows "could not be sent" and enables Nudge', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
      sendDailyNudgeRequest.mockRejectedValue(lost());
      // The prompt's nudge is on record, not the button's.
      fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ prompt: true }));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-nudge'));

      expect(await screen.findByTestId('daily-nudge-error')).toHaveTextContent(
        /^Your nudge could not be sent\.$/
      );
      expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    });

    it("a re-read that fails too says it could not check, and enables Nudge", async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
      sendDailyNudgeRequest.mockRejectedValue(lost());
      fetchDailyDayById.mockRejectedValue(lost());

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-nudge'));

      expect(await screen.findByTestId('daily-nudge-error')).toHaveTextContent(
        /^We couldn't check if your nudge went through\. Try again\?$/
      );
      expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    });

    it('an answer that is not a snapshot is treated the same: unknown, so re-read', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
      sendDailyNudgeRequest.mockRejectedValue(
        new AccountDataError('invalid-response', 'The daily question answer was not understood.')
      );
      fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ button: true }));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-nudge'));

      await waitFor(() => expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true'));
      expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    });
  });

  it('an "already sent" refusal ends as a sent nudge: greyed, no failure line, no second push announced', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    sendDailyNudgeRequest.mockRejectedValue(refusal('DQ010'));
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ button: true }));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true'));
    expect(screen.getByTestId('daily-nudge')).toBeDisabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('offline: the button stays enabled, a tap shows the offline sentence and re-reads nothing', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('offline', OFFLINE_SENTENCE));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-nudge');
    setOnline(false);
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    await user.click(screen.getByTestId('daily-nudge'));

    expect(await screen.findByTestId('daily-nudge-error')).toHaveTextContent(OFFLINE_SENTENCE);
    expect(fetchDailyDayById).not.toHaveBeenCalled();
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('a return to the front re-reads the day: a button sent on another device shows as sent', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot()));

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();

    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ button: true })));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toBeDisabled());
    expect(screen.getByTestId('daily-nudge')).toHaveAttribute('data-sent', 'true');
  });
});

describe('the question\'s closing instant (criterion 14)', () => {
  /** An instant `ms` after the faked "now". */
  const after = (ms: number) => new Date(SAME_DAY.getTime() + ms).toISOString();

  beforeEach(() => {
    // The closing instant is a timer: fake it with the clock, and let Testing
    // Library's waits advance it (AGENTS: user-event under a faked setTimeout).
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(SAME_DAY);
    vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
  });

  it('hides an unsent button at the instant, and not a millisecond before, with no re-read', async () => {
    const closesAt = after(60_000);
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt })));

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();
    expect(fetchDailyDay).toHaveBeenCalledTimes(1);

    // Testing Library's waits moved the faked clock a little: count from now.
    const remaining = Date.parse(closesAt) - Date.now();
    expect(remaining).toBeGreaterThan(1);
    act(() => void vi.advanceTimersByTime(remaining - 1));
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();

    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
    expect(fetchDailyDay).toHaveBeenCalledTimes(1);
    expect(fetchDailyDayById).not.toHaveBeenCalled();
  });

  it('keeps a sent button shown as sent, greyed, after the instant', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ button: true, closesAt: after(60_000) })));

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-nudge')).toBeDisabled();

    act(() => void vi.advanceTimersByTime(60_000));

    const button = screen.getByTestId('daily-nudge');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-sent', 'true');
  });

  it('hides the failure line of an unsent button with it', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt: after(60_000) })));
    sendDailyNudgeRequest.mockResolvedValue('unused');
    sendDailyNudgeRequest.mockRejectedValue(refusal('DQ007'));
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ closesAt: after(60_000) }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));
    await screen.findByTestId('daily-nudge-error');

    act(() => void vi.advanceTimersByTime(60_000));

    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
  });

  it('a button shown after the instant has passed is never offered', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt: after(-1_000) })));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
  });

  it('a nudge reaching the server after the instant is still refused: the button is hidden and the re-read, which keeps the instant, leaves it hidden', async () => {
    const closesAt = after(60_000);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt })));
    let refuse: (error: Error) => void = () => {};
    sendDailyNudgeRequest.mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)));
    // The server keeps `closes_at` after the instant (pgTAP DAILY-NUDGE-053).
    fetchDailyDayById.mockResolvedValue(nudgesSnapshot({ closesAt }));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    // The instant passes while the request is in flight, then the server refuses it (DQ009).
    act(() => void vi.advanceTimersByTime(Date.parse(closesAt) - Date.now()));
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    await act(async () => refuse(refusal('DQ009')));

    await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
  });

  it('a closing instant that has already passed when a re-read delivers it hides the button at once, with no timer advanced', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgesSnapshot({ closesAt: after(60_000) })));

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-nudge')).toBeEnabled();

    await act(async () => {
      useAppStore.setState({ dailyDay: ok(nudgesSnapshot({ closesAt: after(-1_000) })) });
    });

    expect(screen.queryByTestId('daily-nudge')).toBeNull();
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
  });
});
