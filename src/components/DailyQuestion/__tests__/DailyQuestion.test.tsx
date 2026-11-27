/**
 * The Daily Question view against the real store, with only the API module
 * mocked: one test per row of the story's matrix. The streak and the day
 * changed notice have their own files (DailyQuestion.streak.test.tsx,
 * DailyQuestion.dayChanged.test.tsx).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dailySnapshot,
  DAY_ID,
  revealSnapshot,
  waitingSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';

const fetchDailyDay = vi.fn();
const submitDailyPickRequest = vi.fn();
const fetchCoupleStreak = vi.fn();

vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

// The partner-event subscription has its own test; here it is only mounted.
const useDailyPickListener = vi.fn();
vi.mock('../../../hooks/useDailyPickListener', () => ({
  useDailyPickListener: () => useDailyPickListener(),
}));

vi.mock('../../../api/dailyQuestionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/dailyQuestionApi')>()),
  fetchDailyDay: (...args: unknown[]) => fetchDailyDay(...args),
  fetchCoupleStreak: (...args: unknown[]) => fetchCoupleStreak(...args),
  announceDailyPick: vi.fn(async () => {}),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
}));

import { AccountDataError } from '../../../services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../services/dailyDaysCopy';
import { writeLocalCopy } from '../../../services/localCopy';
import { enqueuePick } from '../../../services/pickQueue';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';
import {
  CLOCK_REFUSAL,
  ok,
  resetDailyQuestionView,
  restoreDailyQuestionView,
  SAME_DAY,
  setPartner,
} from '../../../../tests/unit/stores/dailyQuestionViewFixture';

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  submitDailyPickRequest.mockReset();
  fetchCoupleStreak.mockReset();
  fetchCoupleStreak.mockResolvedValue({ status: 'unlinked' });
  await resetDailyQuestionView();
});

afterEach(restoreDailyQuestionView);

describe('DailyQuestion', () => {
  it('mounts the listener that shows the partner\'s pick without a reload', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-question');

    expect(useDailyPickListener).toHaveBeenCalled();
  });

  it('no picks: shows the question as plain text, two options, a disabled send and the partner status', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-question')).toHaveTextContent(
      'Beach day or Mountain day?'
    );
    expect(screen.getByTestId('daily-option-this')).toHaveTextContent('Beach day');
    expect(screen.getByTestId('daily-option-that')).toHaveTextContent('Mountain day');
    expect(screen.getByTestId('daily-send-pick')).toBeDisabled();
    expect(screen.getByTestId('daily-partner-status')).toHaveTextContent(
      "Jessie hasn't picked yet"
    );
    expect(screen.queryByTestId('daily-waiting')).toBeNull();
    expect(screen.queryByTestId('daily-reveal')).toBeNull();
  });

  it('falls back to "Your partner" when no name is known', async () => {
    setPartner(null);
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-partner-status')).toHaveTextContent(
      "Your partner hasn't picked yet"
    );
  });

  it('a nameless linked partner: "Your partner" starts a sentence, "your partner" sits within one', async () => {
    setPartner('  ');
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this')));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toHaveTextContent('Waiting on your partner');
    expect(screen.getByTestId('daily-streak-waiting')).toHaveTextContent(
      'Your half is in. The streak lights up when your partner answers too.'
    );
  });

  it('a nameless linked partner, no picks yet: the status sentence starts with "Your partner"', async () => {
    setPartner('');
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-partner-status')).toHaveTextContent(
      "Your partner hasn't picked yet"
    );
  });

  it('partner picked: says so and shows no partner choice', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ state: 'partner' })));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-partner-status')).toHaveTextContent('Jessie has picked');
    expect(screen.queryByTestId('daily-reveal')).toBeNull();
    expect(screen.queryByTestId('daily-reveal-partner')).toBeNull();
    expect(screen.getByTestId('daily-option-this')).toBeInTheDocument();
  });

  it('enables send once an option is chosen, then sends it and shows the waiting screen', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('that'));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-that'));
    expect(screen.getByTestId('daily-option-that')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(submitDailyPickRequest).toHaveBeenCalledWith(DAY_ID, 'that', SAME_DAY);
    expect(await screen.findByTestId('daily-waiting')).toHaveTextContent('Waiting on Jessie');
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Mountain day');
    expect(screen.queryByTestId('daily-option-this')).toBeNull();
    expect(screen.queryByTestId('daily-send-pick')).toBeNull();
  });

  it('waiting: shows the own pick and its time as h:mm AM/PM', async () => {
    // 15:45Z is 10:45 AM in the suite's New York zone.
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this', '2026-11-05T15:45:00.000Z')));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-my-pick')).toHaveTextContent('Beach day');
    expect(screen.getByTestId('daily-my-pick-time')).toHaveTextContent(/^10:45\sAM$/);
    expect(screen.getByTestId('daily-waiting')).toHaveTextContent('Waiting on Jessie');
    expect(screen.queryByTestId('daily-option-this')).toBeNull();
    expect(screen.queryByTestId('daily-partner-status')).toBeNull();
  });

  it('reveal with different picks: both option texts and "Different picks"', async () => {
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('this', 'that')));

    render(<DailyQuestion />);

    const reveal = await screen.findByTestId('daily-reveal');
    expect(reveal).toHaveTextContent('Beach day');
    expect(reveal).toHaveTextContent('Mountain day');
    expect(screen.getByTestId('daily-reveal-mine')).toHaveTextContent('Beach day');
    expect(screen.getByTestId('daily-reveal-partner')).toHaveTextContent('Mountain day');
    expect(screen.getByTestId('daily-reveal-mark')).toHaveTextContent('Different picks');
  });

  it('reveal with the same pick: "Same picks"', async () => {
    fetchDailyDay.mockResolvedValue(ok(revealSnapshot('that', 'that')));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-reveal-mark')).toHaveTextContent('Same picks');
  });

  it('shows the loading line while the first fetch is pending', async () => {
    let settle: (value: unknown) => void = () => {};
    fetchDailyDay.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    render(<DailyQuestion />);

    expect(screen.getByTestId('daily-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-question')).toBeNull();
    await act(async () => settle(ok(dailySnapshot())));
    expect(await screen.findByTestId('daily-question')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-loading')).toBeNull();
  });

  it('a new day_id resets the chosen option and the send error', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    submitDailyPickRequest.mockRejectedValue(new AccountDataError('transport', 'nope'));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));
    expect(await screen.findByTestId('daily-send-error')).toBeInTheDocument();
    expect(screen.getByTestId('daily-send-pick')).toBeEnabled();

    fetchDailyDay.mockResolvedValue(
      ok(dailySnapshot({ day_id: 'another-day', day: '2026-11-06' }))
    );
    await act(() => useAppStore.getState().loadDailyDay());

    expect(screen.getByTestId('daily-send-pick')).toBeDisabled();
    expect(screen.getByTestId('daily-option-this')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('daily-send-error')).toBeNull();
  });

  it('unlinked: the invitation, and no question and no pick control', async () => {
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    render(<DailyQuestion />);

    const invite = await screen.findByTestId('daily-invite');
    expect(screen.getByRole('heading', { level: 1, name: 'Link with your partner' })).toBeInTheDocument();
    expect(invite).toHaveTextContent(
      'Daily asks you both one question a day. Link your accounts to start.'
    );
    expect(screen.getByTestId('daily-invite-link')).toHaveTextContent('Go to Partner');
    expect(screen.queryByTestId('daily-question')).toBeNull();
    expect(screen.queryByTestId('daily-option-this')).toBeNull();
    expect(screen.queryByTestId('daily-send-pick')).toBeNull();
    expect(screen.queryByTestId('daily-error')).toBeNull();
    expect(screen.queryByTestId('daily-loading')).toBeNull();
  });

  it('Go to Partner calls navigatePartner', async () => {
    const user = userEvent.setup();
    const navigatePartner = vi.fn();
    useAppStore.setState({ navigatePartner });
    fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-invite-link'));

    expect(navigatePartner).toHaveBeenCalledTimes(1);
  });

  it('shows no invitation for a linked day', async () => {
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    await screen.findByTestId('daily-question');
    expect(screen.queryByTestId('daily-invite')).toBeNull();
  });

  it('shows no invitation when the load fails with nothing saved', async () => {
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'The server is down'));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-error')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-invite')).toBeNull();
  });

  it('a failed load after a saved day keeps the question and shows no invitation', async () => {
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, {
      [DAY_ID]: { ...dailySnapshot(), partner_id: 'USER-B-ID' },
    });
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'The server is down'));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-error')).toHaveTextContent('The server is down');
    expect(screen.getByTestId('daily-question')).toHaveTextContent('Beach day or Mountain day?');
    expect(screen.queryByTestId('daily-invite')).toBeNull();
  });

  it('offline with today saved: the saved question, no error, no invitation, no loading line', async () => {
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, {
      [DAY_ID]: { ...dailySnapshot(), partner_id: 'USER-B-ID' },
    });
    setOnline(false);
    fetchDailyDay.mockRejectedValue(
      new AccountDataError('offline', "You are offline. Today's question needs a connection to load.")
    );

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-question')).toHaveTextContent('Beach day or Mountain day?');
    await waitFor(() => expect(useAppStore.getState().dailyDayLoading).toBe(false));
    expect(screen.queryByTestId('daily-error')).toBeNull();
    expect(screen.queryByTestId('daily-invite')).toBeNull();
    expect(screen.queryByTestId('daily-loading')).toBeNull();
  });

  it('offline with nothing saved: the offline sentence and Retry, no question, no invitation', async () => {
    setOnline(false);
    fetchDailyDay.mockRejectedValue(
      new AccountDataError('offline', "You are offline. Today's question needs a connection to load.")
    );

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-error')).toHaveTextContent(
      "You are offline. Today's question needs a connection to load."
    );
    expect(screen.getByTestId('daily-retry')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-question')).toBeNull();
    expect(screen.queryByTestId('daily-invite')).toBeNull();
  });

  it('load fails with nothing shown: the error and Retry, which loads again', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockRejectedValueOnce(new AccountDataError('transport', 'The server is down'));
    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-error')).toHaveTextContent('The server is down');
    expect(screen.queryByTestId('daily-question')).toBeNull();
    await user.click(screen.getByTestId('daily-retry'));

    expect(await screen.findByTestId('daily-question')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-error')).toBeNull();
  });

  it('load fails after a snapshot: the snapshot stays and the error shows', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(waitingSnapshot('this')));
    fetchDailyDay.mockRejectedValueOnce(new AccountDataError('transport', 'The server is down'));

    render(<DailyQuestion />);
    await screen.findByTestId('daily-waiting');
    await act(() => useAppStore.getState().loadDailyDay());

    expect(await screen.findByTestId('daily-error')).toHaveTextContent('The server is down');
    expect(screen.getByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Beach day');
  });

  it('offline send: queues the pick, sends nothing, and shows it as the own pick with no options', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    setOnline(false);
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-pick-queued')).toHaveTextContent(
      'Waiting for a connection to send your pick.'
    );
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Beach day');
    expect(screen.getByTestId('daily-my-pick-time')).toHaveTextContent('12:00 PM');
    expect(screen.getByTestId('daily-partner-status')).toHaveTextContent("Jessie hasn't picked yet");
    expect(screen.queryByTestId('daily-send-error')).toBeNull();
    expect(screen.queryByTestId('daily-option-this')).toBeNull();
    expect(screen.queryByTestId('daily-option-that')).toBeNull();
    expect(screen.queryByTestId('daily-send-pick')).toBeNull();
    expect(screen.queryByTestId('daily-reveal')).toBeNull();
  });

  it('a queued pick with the partner already picked shows "has picked", never the reveal', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ state: 'partner' })));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-that'));
    setOnline(false);
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Mountain day');
    expect(screen.getByTestId('daily-partner-status')).toHaveTextContent('Jessie has picked');
    expect(screen.queryByTestId('daily-reveal')).toBeNull();
    expect(screen.queryByTestId('daily-reveal-partner')).toBeNull();
  });

  it('a pending queued row shows after a reload', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    fetchDailyDay.mockRejectedValue(new AccountDataError('offline', 'You are offline.'));
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, {
      [DAY_ID]: { ...dailySnapshot(), partner_id: 'USER-B-ID' },
    });

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Mountain day');
    expect(screen.queryByTestId('daily-option-this')).toBeNull();
  });

  it('the server\'s own pick wins over a queued row', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this')));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('daily-my-pick')).toHaveTextContent('Beach day');
    expect(screen.queryByTestId('daily-pick-queued')).toBeNull();
  });

  it('a refused queued row shows the reason on its own and gives the options back; a new Send replaces it', async () => {
    const user = userEvent.setup();
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: true,
      failure: CLOCK_REFUSAL,
    });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    submitDailyPickRequest.mockResolvedValue(waitingSnapshot('this'));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-pick-failed')).toHaveTextContent(CLOCK_REFUSAL);
    // The sentence says the pick was not sent; nothing is put before it.
    expect(screen.getByTestId('daily-pick-failed').textContent).toBe(CLOCK_REFUSAL);
    expect(screen.getByTestId('daily-pick-failed')).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('daily-pick-queued')).toBeNull();
    await user.click(screen.getByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-pick-failed')).toBeNull();
  });

  it('a refused queued row with no stored reason says the pick could not be sent', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: true,
      failure: null,
    });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-pick-failed')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('daily-pick-failed').textContent).toBe('Your pick could not be sent.');
    expect(screen.getByTestId('daily-option-this')).toBeInTheDocument();
  });

  it('a refused queued row with the partner already picked shows the failure and the options, never a reveal', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: true,
      failure: CLOCK_REFUSAL,
    });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ state: 'partner' })));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-pick-failed')).toBeInTheDocument();
    expect(screen.getByTestId('daily-option-this')).toBeInTheDocument();
    expect(screen.getByTestId('daily-send-pick')).toBeInTheDocument();
    expect(screen.getByTestId('daily-partner-status')).toHaveTextContent('has picked');
    expect(screen.queryByTestId('daily-reveal')).toBeNull();
    expect(screen.queryByTestId('daily-pick-queued')).toBeNull();
  });

  it('a queued row of another account is not shown', async () => {
    await enqueuePick({
      user_id: 'USER-B-ID',
      day_id: DAY_ID,
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-option-this')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-pick-queued')).toBeNull();
  });

  it('a pending row of another day_id does not show as the shown day\'s pick', async () => {
    await enqueuePick({
      user_id: 'USER-A-ID',
      day_id: 'some-other-day',
      choice: 'that',
      picked_at: SAME_DAY.toISOString(),
      time_zone: 'America/New_York',
      utc_offset_minutes: -300,
      failed: false,
      failure: null,
    });
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-option-this')).toBeInTheDocument();
    expect(screen.getByTestId('daily-send-pick')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-pick-queued')).toBeNull();
    expect(screen.queryByTestId('daily-my-pick')).toBeNull();
  });

  it('a failed send shows the error and keeps the options', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    const failure = new AccountDataError('transport', 'Could not reach the server');
    submitDailyPickRequest.mockRejectedValue(failure);

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(await screen.findByTestId('daily-send-error')).toHaveTextContent('Could not reach the server');
    expect(console.error).toHaveBeenCalledWith('[DailyQuestion] Could not send the pick:', failure);
    expect(screen.getByTestId('daily-send-pick')).toBeEnabled();
  });

  it('while a pick is sending, both options and Send are disabled', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
    let settle: (value: unknown) => void = () => {};
    submitDailyPickRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(screen.getByTestId('daily-send-pick')).toBeDisabled();
    expect(screen.getByTestId('daily-option-this')).toBeDisabled();
    expect(screen.getByTestId('daily-option-that')).toBeDisabled();
    await user.click(screen.getByTestId('daily-send-pick'));
    expect(submitDailyPickRequest).toHaveBeenCalledTimes(1);

    await act(async () => settle(waitingSnapshot('this')));
    expect(await screen.findByTestId('daily-waiting')).toBeInTheDocument();
  });

  it('Retry is disabled while its load is open', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockRejectedValueOnce(new AccountDataError('transport', 'The server is down'));
    let settle: (value: unknown) => void = () => {};
    fetchDailyDay.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-retry'));

    expect(screen.getByTestId('daily-retry')).toBeDisabled();
    await act(async () => settle(ok(dailySnapshot())));
    expect(await screen.findByTestId('daily-question')).toBeInTheDocument();
  });

  it('an account switch while the view is open loads the new account\'s day', async () => {
    fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
    fetchDailyDay.mockResolvedValueOnce(
      ok(dailySnapshot({ day_id: 'c-day', question: { this: 'Tea', that: 'Coffee' } }))
    );

    render(<DailyQuestion />);
    expect(await screen.findByTestId('daily-question')).toHaveTextContent(
      'Beach day or Mountain day?'
    );
    act(() => useAppStore.getState().setAuthUser('USER-C-ID'));

    expect(await screen.findByTestId('daily-question')).toHaveTextContent('Tea or Coffee?');
    expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('daily-loading')).toBeNull();
  });
});
