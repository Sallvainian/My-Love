/**
 * The Daily Question view against the real store, with only the API module
 * mocked: one test per row of the story's matrix.
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
  announceDailyPick: vi.fn(async () => {}),
  submitDailyPick: (...args: unknown[]) => submitDailyPickRequest(...args),
}));

import { DAY_CHANGED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { DAILY_DAYS_COPY_KIND } from '../../../services/dailyDaysCopy';
import { deleteAccountCopies, writeLocalCopy } from '../../../services/localCopy';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';

/** A local-time instant on the fixture's day (2026-11-05), whatever the machine's zone. */
const SAME_DAY = new Date(2026, 10, 5, 12);
/** One minute past local midnight: the device's date is no longer the fixture's day. */
const NEXT_DAY = new Date(2026, 10, 6, 0, 1);

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });

function setPartner(displayName: string | null) {
  useAppStore.setState({
    partner: displayName === null ? null : { id: 'USER-B-ID', displayName, email: 'b@example.com' },
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
}

const realNavigatePartner = useAppStore.getState().navigatePartner;

beforeEach(async () => {
  vi.clearAllMocks();
  fetchDailyDay.mockReset();
  submitDailyPickRequest.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  // Only Date: Testing Library recognises Jest fake timers alone (AGENTS user-event note).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SAME_DAY);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('USER-A-ID');
  setPartner('Jessie');
  // A day saved by an earlier test must not be shown first in this one.
  await deleteAccountCopies('USER-A-ID');
  await deleteAccountCopies('USER-C-ID');
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
  useAppStore.setState({ navigatePartner: realNavigatePartner });
});

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
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, { [DAY_ID]: dailySnapshot() });
    fetchDailyDay.mockRejectedValue(new AccountDataError('transport', 'The server is down'));

    render(<DailyQuestion />);

    expect(await screen.findByTestId('daily-error')).toHaveTextContent('The server is down');
    expect(screen.getByTestId('daily-question')).toHaveTextContent('Beach day or Mountain day?');
    expect(screen.queryByTestId('daily-invite')).toBeNull();
  });

  it('offline with today saved: the saved question, no error, no invitation, no loading line', async () => {
    await writeLocalCopy('USER-A-ID', DAILY_DAYS_COPY_KIND, { [DAY_ID]: dailySnapshot() });
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

  it('offline send: shows the offline message and sends nothing', async () => {
    const user = userEvent.setup();
    fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

    render(<DailyQuestion />);
    await user.click(await screen.findByTestId('daily-option-this'));
    setOnline(false);
    await user.click(screen.getByTestId('daily-send-pick'));

    expect(screen.getByTestId('daily-send-error')).toHaveTextContent(
      'You are offline. Your pick needs a connection to send.'
    );
    expect(submitDailyPickRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('daily-option-this')).toBeInTheDocument();
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

  describe('the day changed notice', () => {
    const nextDay = dailySnapshot({
      day_id: 'next-day',
      day: '2026-11-06',
      question: { this: 'Tea', that: 'Coffee' },
    });

    it('device date past the shown day: no request, the new question, and the notice above it', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));

      // The old card is still up until the re-read (which reads the saved copy first) lands.
      await waitFor(() =>
        expect(screen.getByTestId('daily-question')).toHaveTextContent('Tea or Coffee?')
      );
      const notice = screen.getByTestId('daily-day-changed');
      expect(notice).toHaveTextContent(DAY_CHANGED_MESSAGE);
      expect(notice).toHaveAttribute('role', 'status');
      expect(submitDailyPickRequest).not.toHaveBeenCalled();
      expect(screen.queryByTestId('daily-send-error')).toBeNull();
      expect(screen.getByTestId('daily-send-pick')).toBeDisabled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('the notice sits outside the card, so it survives the card remounting on the new day', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));
      await screen.findByText('Tea or Coffee?', { exact: false });

      const notice = screen.getByTestId('daily-day-changed');
      expect(screen.getByTestId('daily-question').parentElement).not.toContainElement(notice);
    });

    it('a server day-changed answer shows the same notice and re-reads the day', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));
      submitDailyPickRequest.mockRejectedValue(new AccountDataError('day-changed', DAY_CHANGED_MESSAGE));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-that'));
      await user.click(screen.getByTestId('daily-send-pick'));

      expect(await screen.findByTestId('daily-day-changed')).toHaveTextContent(DAY_CHANGED_MESSAGE);
      await waitFor(() =>
        expect(screen.getByTestId('daily-question')).toHaveTextContent('Tea or Coffee?')
      );
      expect(screen.queryByTestId('daily-send-error')).toBeNull();
      expect(fetchDailyDay).toHaveBeenCalledTimes(2);
    });

    it('clears at the next Send', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));
      await screen.findByTestId('daily-day-changed');
      await screen.findByText('Tea or Coffee?', { exact: false });

      let settle: (value: unknown) => void = () => {};
      submitDailyPickRequest.mockReturnValue(new Promise((resolve) => (settle = resolve)));
      await user.click(screen.getByTestId('daily-option-that'));
      await user.click(screen.getByTestId('daily-send-pick'));

      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
      expect(submitDailyPickRequest).toHaveBeenCalledWith('next-day', 'that', NEXT_DAY);
      await act(async () => settle(waitingSnapshot('that')));
    });

    it('clears at an offline Send too, beside the offline message', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));
      await screen.findByTestId('daily-day-changed');
      await screen.findByText('Tea or Coffee?', { exact: false });

      await user.click(screen.getByTestId('daily-option-that'));
      setOnline(false);
      await user.click(screen.getByTestId('daily-send-pick'));

      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
      expect(screen.getByTestId('daily-send-error')).toHaveTextContent(
        'You are offline. Your pick needs a connection to send.'
      );
    });

    it('clears on an account change', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));
      fetchDailyDay.mockResolvedValueOnce(
        ok(dailySnapshot({ day_id: 'c-day', day: '2026-11-06', question: { this: 'Sun', that: 'Rain' } }))
      );

      render(<DailyQuestion />);
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));
      await screen.findByTestId('daily-day-changed');

      act(() => useAppStore.getState().setAuthUser('USER-C-ID'));

      expect(await screen.findByText('Sun or Rain?', { exact: false })).toBeInTheDocument();
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
    });
  });
});
