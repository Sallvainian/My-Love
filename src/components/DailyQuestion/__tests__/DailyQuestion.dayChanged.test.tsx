/**
 * The Daily Question view's day changed notice: the device date passing the
 * shown day, a server day-changed answer, and what clears the notice. Against
 * the real store, with only the API module mocked.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import { setOnline } from '../../../../tests/unit/stores/navigatorFixtures';
import {
  fetchDailyDay,
  resetDailyQuestionMocks,
  submitDailyPickRequest,
} from '../../../../tests/unit/stores/dailyQuestionViewMocks';

vi.mock('../../../api/supabaseClient', async () =>
  (await import('../../../../tests/unit/stores/dailyQuestionViewMocks')).supabaseClientMock(),
);
vi.mock('../../../hooks/useDailyPickListener', async () =>
  (await import('../../../../tests/unit/stores/dailyQuestionViewMocks')).dailyPickListenerMock(),
);
vi.mock('../../../api/dailyQuestionApi', async (importOriginal) =>
  (await import('../../../../tests/unit/stores/dailyQuestionViewMocks')).dailyQuestionApiMock(
    await importOriginal<typeof import('../../../api/dailyQuestionApi')>(),
  ),
);

import { DAY_CHANGED_MESSAGE } from '../../../api/dailyQuestionApi';
import { AccountDataError } from '../../../services/accountDataError';
import { enqueuePick } from '../../../services/pickQueue';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';
import {
  NEXT_DAY,
  ok,
  resetDailyQuestionView,
  restoreDailyQuestionView,
} from '../../../../tests/unit/stores/dailyQuestionViewFixture';

beforeEach(async () => {
  resetDailyQuestionMocks();
  await resetDailyQuestionView();
});

afterEach(restoreDailyQuestionView);

describe('DailyQuestion', () => {
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

    it('clears at an offline Send too, beside the queued pick', async () => {
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
      expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
      expect(submitDailyPickRequest).not.toHaveBeenCalled();
    });

    /** Pick, let the clock pass midnight and Send: the card is refused and the notice raised. */
    async function refuseSend(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByTestId('daily-option-this'));
      vi.setSystemTime(NEXT_DAY);
      await user.click(screen.getByTestId('daily-send-pick'));
    }

    it('goes when the re-read day is already picked, and stays gone on a later day that takes a pick (DW-496)', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(
        ok({ ...waitingSnapshot('that'), day_id: 'next-day', day: '2026-11-06' })
      );

      render(<DailyQuestion />);
      await refuseSend(user);

      await screen.findByTestId('daily-waiting');
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
      expect(screen.queryByTestId('daily-send-pick')).toBeNull();

      // A later day that offers a Send does not bring the notice back.
      fetchDailyDay.mockResolvedValueOnce(
        ok(dailySnapshot({ day_id: 'later-day', day: '2026-11-07', question: { this: 'Sun', that: 'Rain' } }))
      );
      vi.setSystemTime(new Date(2026, 10, 7, 12));
      await act(async () => {
        await useAppStore.getState().loadDailyDay();
      });
      expect(await screen.findByText('Sun or Rain?', { exact: false })).toBeInTheDocument();
      expect(screen.getByTestId('daily-send-pick')).toBeInTheDocument();
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
    });

    it('goes when the re-read day is the reveal', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(
        ok({ ...revealSnapshot('this', 'that'), day_id: 'next-day', day: '2026-11-06' })
      );

      render(<DailyQuestion />);
      await refuseSend(user);

      await screen.findByTestId('daily-reveal');
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
    });

    it('goes when the re-read answers unlinked, and stays gone after a relink (DW-496)', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce({ status: 'unlinked' });

      render(<DailyQuestion />);
      await refuseSend(user);

      await screen.findByTestId('daily-invite');
      expect(screen.queryByTestId('daily-send-pick')).toBeNull();
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();

      // The pair links again: the later day offers a Send, and the notice stays gone.
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));
      await act(async () => {
        await useAppStore.getState().loadDailyDay();
      });
      expect(await screen.findByText('Tea or Coffee?', { exact: false })).toBeInTheDocument();
      expect(screen.getByTestId('daily-send-pick')).toBeInTheDocument();
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
    });

    it('goes when the re-read day has this account\'s own pick queued, which hides the Send', async () => {
      const user = userEvent.setup();
      await enqueuePick({
        user_id: 'USER-A-ID',
        day_id: 'next-day',
        choice: 'that',
        picked_at: NEXT_DAY.toISOString(),
        time_zone: 'America/New_York',
        utc_offset_minutes: -300,
        failed: false,
        failure: null,
      });
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok(nextDay));

      render(<DailyQuestion />);
      await refuseSend(user);

      expect(await screen.findByTestId('daily-pick-queued')).toBeInTheDocument();
      expect(screen.queryByTestId('daily-send-pick')).toBeNull();
      expect(screen.queryByTestId('daily-day-changed')).toBeNull();
    });

    it('stays while the re-read day offers a Send, even when the partner has picked', async () => {
      const user = userEvent.setup();
      fetchDailyDay.mockResolvedValueOnce(ok(dailySnapshot()));
      fetchDailyDay.mockResolvedValueOnce(ok({ ...nextDay, state: 'partner', partner_choice: 'this' }));

      render(<DailyQuestion />);
      await refuseSend(user);

      await screen.findByText('Tea or Coffee?', { exact: false });
      expect(screen.getByTestId('daily-send-pick')).toBeInTheDocument();
      expect(screen.getByTestId('daily-day-changed')).toHaveTextContent(DAY_CHANGED_MESSAGE);
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
