/**
 * The Daily Question view's waiting card and its Nudge button (AD-17) against
 * the real store, with only the API module mocked.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DAY_ID,
  nudgeSnapshot,
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

const ok = (snapshot: ReturnType<typeof nudgeSnapshot>) => ({ status: 'ok' as const, snapshot });

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
  setOnline(true);
});

describe('DailyQuestion waiting card and nudge', () => {
  const OFFLINE_SENTENCE = 'You are offline. Your nudge needs a connection to send.';

  it('shows the dashed waiting card with the partner line and an enabled Nudge button', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));

    render(<DailyQuestion />);

    const card = await screen.findByTestId('daily-waiting');
    expect(card).toHaveTextContent('Waiting on Jessie');
    expect(card).toHaveTextContent("They can't see your pick until they make theirs.");
    expect(screen.getByTestId('daily-nudge')).toHaveTextContent('Nudge Jessie');
    expect(screen.getByTestId('daily-nudge')).toBeEnabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
  });

  it.each([
    ['spent', nudgeSnapshot('after_pick', true)],
    ['a null slot', nudgeSnapshot(null, false)],
    ['no nudge at all', waitingSnapshot('this')],
  ])('disables the button for %s', async (_label, snapshot) => {
    fetchDailyDay.mockResolvedValue(ok(snapshot));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-nudge')).toBeDisabled();
  });

  it('shows no waiting card unless only the own pick is in', async () => {
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-reveal');

    expect(screen.queryByTestId('daily-waiting')).toBeNull();
    expect(screen.queryByTestId('daily-nudge')).toBeNull();
  });

  it('sends one nudge, disables the button while it is in flight, and stays disabled once spent', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
    let settle: (snapshot: ReturnType<typeof nudgeSnapshot>) => void = () => {};
    sendDailyNudgeRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toBeDisabled());
    expect(sendDailyNudgeRequest).toHaveBeenCalledTimes(1);
    expect(sendDailyNudgeRequest).toHaveBeenCalledWith(DAY_ID);

    await act(async () => settle(nudgeSnapshot('after_pick', true)));

    await waitFor(() => expect(announceDailyNudge).toHaveBeenCalledTimes(1));
    expect(announceDailyNudge).toHaveBeenCalledWith(DAY_ID);
    expect(screen.getByTestId('daily-nudge')).toBeDisabled();
    expect(screen.queryByTestId('daily-nudge-error')).toBeNull();
    expect(useAppStore.getState().dailyDay).toEqual(ok(nudgeSnapshot('after_pick', true)));
  });

  it('a refusal shows the fixed line, announces nothing and re-reads the day', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
    fetchDailyDayById.mockResolvedValue(revealSnapshot('this', 'that'));
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('refused', NUDGE_FAILED_MESSAGE));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    await waitFor(() => expect(fetchDailyDayById).toHaveBeenCalledWith(DAY_ID));
    expect(announceDailyNudge).not.toHaveBeenCalled();
    // The re-read found the partner's pick: the reveal replaces the card.
    expect(await screen.findByTestId('daily-reveal')).toBeInTheDocument();
  });

  it('a refusal shows the fixed line and follows the re-read: the button is disabled', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
    fetchDailyDayById.mockResolvedValue(nudgeSnapshot('after_pick', true));
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('refused', NUDGE_FAILED_MESSAGE));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-nudge'));

    expect(await screen.findByTestId('daily-nudge-error')).toHaveTextContent(
      /^Your nudge could not be sent\.$/
    );
    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toBeDisabled());
    expect(announceDailyNudge).not.toHaveBeenCalled();
  });

  it('a failed request shows exactly the fixed line and keeps the button for another try', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
    fetchDailyDayById.mockResolvedValue(nudgeSnapshot('after_pick', false));
    sendDailyNudgeRequest.mockRejectedValue(new AccountDataError('transport', 'Failed to fetch'));

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

  it('offline: the button stays enabled, a tap shows the offline sentence and re-reads nothing', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', false)));
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

  it('a return to the front re-reads the day: a new slot enables the button', async () => {
    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('after_pick', true)));

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-nudge')).toBeDisabled();

    fetchDailyDay.mockResolvedValue(ok(nudgeSnapshot('evening', false)));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    await waitFor(() => expect(screen.getByTestId('daily-nudge')).toBeEnabled());
  });
});
