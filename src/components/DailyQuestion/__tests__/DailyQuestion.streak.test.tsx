/**
 * The Daily Question view's streak: the header, the chip and strip in each
 * state, the missed-days banner, and a failed streak read. Against the real
 * store, with only the API module mocked.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coupleStreak,
  dailySnapshot,
  revealSnapshot,
  streakWeek,
  waitingSnapshot,
} from '../../../../tests/unit/stores/dailyQuestionFixture';
import {
  fetchCoupleStreak,
  fetchDailyDay,
  resetDailyQuestionMocks,
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

import { AccountDataError } from '../../../services/accountDataError';
import { useAppStore } from '../../../stores/useAppStore';
import { DailyQuestion } from '../DailyQuestion';
import {
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
  describe('the streak', () => {
    const okStreak = (overrides: Parameters<typeof coupleStreak>[0] = {}) => ({
      status: 'ok' as const,
      streak: coupleStreak(overrides),
    });

    it('reads the streak on mount', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));

      render(<DailyQuestion />);
      await screen.findByTestId('daily-question');

      await waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalledTimes(1));
    });

    it('header: "Today\'s question" as plain text and the snapshot\'s date, the question stays the h1', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot({ day: '2026-11-05' })));

      render(<DailyQuestion />);

      const header = await screen.findByTestId('daily-header');
      expect(header).toHaveTextContent("Today's question");
      expect(screen.getByTestId('daily-date')).toHaveTextContent('Thursday, November 5');
      expect(screen.getByRole('heading', { level: 1 })).toBe(screen.getByTestId('daily-question'));
      expect(screen.queryByRole('heading', { name: "Today's question" })).toBeNull();
    });

    it('grey: a grey chip with the held total, the run line and the strip, no banner', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(okStreak({ held: 2, run: 2, today_state: 'grey' }));

      render(<DailyQuestion />);

      const chip = await screen.findByTestId('daily-streak-chip');
      expect(chip).toHaveAttribute('data-state', 'grey');
      expect(chip).toHaveClass('bg-ash-tint', 'text-ash-ink');
      expect(screen.getByTestId('daily-streak-held')).toHaveTextContent('2');
      expect(screen.getByTestId('daily-streak-run')).toHaveTextContent('2 in a row');
      expect(chip.querySelector('svg.lucide-flame')).not.toBeNull();
      expect(chip.querySelector('svg.lucide-snowflake')).toBeNull();
      expect(screen.getByTestId('daily-streak-week')).toBeInTheDocument();
      expect(screen.getAllByTestId('daily-streak-day')).toHaveLength(7);
      expect(screen.queryByTestId('daily-streak-cold')).toBeNull();
    });

    it('orange: an orange chip with a flame, no banner', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(okStreak({ today_state: 'orange' }));

      render(<DailyQuestion />);

      const chip = await screen.findByTestId('daily-streak-chip');
      expect(chip).toHaveAttribute('data-state', 'orange');
      expect(chip).toHaveClass('bg-fire-tint', 'text-fire-ink');
      expect(chip.querySelector('svg.lucide-flame')).not.toBeNull();
      expect(screen.queryByTestId('daily-streak-cold')).toBeNull();
    });

    it('blue with one missed date: a blue chip with a snowflake and the "Yesterday was" banner', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(
        okStreak({
          held: 12,
          run: 0,
          today_state: 'blue',
          missed: 1,
          week: streakWeek(['open', 'open', 'open', 'open', 'done', 'missed', 'open']),
        })
      );

      render(<DailyQuestion />);

      const chip = await screen.findByTestId('daily-streak-chip');
      expect(chip).toHaveAttribute('data-state', 'blue');
      expect(chip).toHaveClass('bg-cold-tint', 'text-cold-ink');
      expect(chip.querySelector('svg.lucide-snowflake')).not.toBeNull();
      expect(chip.querySelector('svg.lucide-flame')).toBeNull();
      const banner = screen.getByTestId('daily-streak-cold');
      expect(banner).toHaveTextContent('Your streak went cold');
      expect(banner).toHaveTextContent(
        "Yesterday was missed, so it's frozen at 12. You keep the 12. Both answer today to light it back up."
      );
    });

    it('blue with several missed dates, yesterday among them: "The last 3 days were missed"', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(
        okStreak({
          held: 5,
          today_state: 'blue',
          missed: 3,
          week: streakWeek(['open', 'open', 'done', 'missed', 'missed', 'missed', 'open']),
        })
      );

      render(<DailyQuestion />);

      expect(await screen.findByTestId('daily-streak-cold')).toHaveTextContent(
        "The last 3 days were missed, so it's frozen at 5. You keep the 5."
      );
    });

    it('one missed date that is the day before yesterday (yesterday still open): names its weekday (DW-515)', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(
        okStreak({
          held: 2,
          run: 0,
          today_state: 'blue',
          missed: 1,
          // The week ends Thursday 2030-03-07: the fifth entry (03-05) is a Tuesday, and
          // yesterday (Wednesday) has not closed yet.
          week: streakWeek(['open', 'open', 'open', 'open', 'missed', 'open', 'open']),
        })
      );

      render(<DailyQuestion />);

      const banner = await screen.findByTestId('daily-streak-cold');
      expect(banner).toHaveTextContent(
        "Tuesday was missed, so it's frozen at 2. You keep the 2. Both answer today to light it back up."
      );
      expect(banner).not.toHaveTextContent('Yesterday');
    });

    it('one missed date, an older one with yesterday not missed: names the newest missed date', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(
        okStreak({
          held: 4,
          today_state: 'blue',
          missed: 1,
          week: streakWeek(['open', 'open', 'open', 'missed', 'open', 'open', 'open']),
        })
      );

      render(<DailyQuestion />);

      // The fourth entry of the week (2030-03-04) is a Monday.
      expect(await screen.findByTestId('daily-streak-cold')).toHaveTextContent(
        "Monday was missed, so it's frozen at 4."
      );
    });

    it('several missed dates, yesterday open and an older one missed: "{n} days were missed"', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(
        okStreak({
          held: 3,
          today_state: 'blue',
          missed: 2,
          week: streakWeek(['open', 'done', 'missed', 'missed', 'open', 'open', 'open']),
        })
      );

      render(<DailyQuestion />);

      const banner = await screen.findByTestId('daily-streak-cold');
      expect(banner).toHaveTextContent("2 days were missed, so it's frozen at 3.");
      expect(banner).not.toHaveTextContent('The last');
    });

    it('the strip shows each date in the state the server gave', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockResolvedValue(okStreak({ today_state: 'orange' }));

      render(<DailyQuestion />);

      const days = await screen.findAllByTestId('daily-streak-day');
      expect(days.map((day) => day.getAttribute('data-state'))).toEqual([
        'open', 'open', 'open', 'open', 'open', 'open', 'done',
      ]);
      expect(days[6]).toHaveTextContent('Today');
    });

    it.each([
      ['not read yet', null],
      ['unlinked', { status: 'unlinked' as const }],
    ])('no streak (%s): the header without a chip, no strip, no banner', async (_label, answer) => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      if (answer) fetchCoupleStreak.mockResolvedValue(answer);
      else fetchCoupleStreak.mockReturnValue(new Promise(() => {}));

      render(<DailyQuestion />);

      await screen.findByTestId('daily-header');
      await waitFor(() => expect(fetchCoupleStreak).toHaveBeenCalled());
      expect(screen.queryByTestId('daily-streak-chip')).toBeNull();
      expect(screen.queryByTestId('daily-streak-week')).toBeNull();
      expect(screen.queryByTestId('daily-streak-cold')).toBeNull();
    });

    it('a failed streak read shows no chip and no error on Daily', async () => {
      fetchDailyDay.mockResolvedValue(ok(dailySnapshot()));
      fetchCoupleStreak.mockRejectedValue(new AccountDataError('transport', 'STREAK-DOWN'));

      render(<DailyQuestion />);

      await screen.findByTestId('daily-header');
      await waitFor(() => expect(useAppStore.getState().coupleStreakError).not.toBeNull());
      expect(screen.queryByTestId('daily-streak-chip')).toBeNull();
      expect(screen.queryByText('STREAK-DOWN')).toBeNull();
      expect(screen.queryByTestId('daily-error')).toBeNull();
    });

    it('the unlinked invitation has no header, chip or strip', async () => {
      fetchDailyDay.mockResolvedValue({ status: 'unlinked' });

      render(<DailyQuestion />);

      await screen.findByTestId('daily-invite');
      expect(screen.queryByTestId('daily-header')).toBeNull();
      expect(screen.queryByTestId('daily-streak-chip')).toBeNull();
    });

    it('waiting: the own pick is in, so the sentence names the partner', async () => {
      fetchDailyDay.mockResolvedValue(ok(waitingSnapshot('this')));

      render(<DailyQuestion />);

      expect(await screen.findByTestId('daily-streak-waiting')).toHaveTextContent(
        'Your half is in. The streak lights up when Jessie answers too.'
      );
      expect(screen.getByTestId('daily-waiting')).toHaveTextContent('Waiting on Jessie');
    });

    it.each([
      ['none', dailySnapshot()],
      ['partner', dailySnapshot({ state: 'partner' })],
      ['both', revealSnapshot('this', 'that')],
    ])('no waiting sentence while the state is %s', async (_label, snapshot) => {
      fetchDailyDay.mockResolvedValue(ok(snapshot));

      render(<DailyQuestion />);

      await screen.findByTestId('daily-question');
      expect(screen.queryByTestId('daily-streak-waiting')).toBeNull();
    });
  });
});
