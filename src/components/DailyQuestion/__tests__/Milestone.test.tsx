/**
 * The milestone screen (Milestone.tsx) on its own: the badge block, the text
 * and the buttons. The flow from the +1 is in DailyQuestion.celebration.test.tsx.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', () => ({ useReducedMotion: () => false }));

import { Milestone } from '../Milestone';
import { milestoneBadges } from '../milestoneBadges';

describe('milestoneBadges', () => {
  it.each([
    [1, [25, 50, 75, 100], [true, false, false, false]],
    [2, [25, 50, 75, 100], [true, true, false, false]],
    [3, [25, 50, 75, 100], [true, true, true, false]],
    [4, [25, 50, 75, 100], [true, true, true, true]],
    [5, [125, 150, 175, 200], [true, false, false, false]],
    [8, [125, 150, 175, 200], [true, true, true, true]],
    [9, [225, 250, 275, 300], [true, false, false, false]],
  ])('%i milestones: the block %j, reached %j', (milestones, days, reached) => {
    const badges = milestoneBadges(milestones);

    expect(badges.map((badge) => badge.days)).toEqual(days);
    expect(badges.map((badge) => badge.reached)).toEqual(reached);
  });

  it('a count under 1 shows the first block with nothing reached', () => {
    expect(milestoneBadges(0)).toEqual([
      { days: 25, reached: false },
      { days: 50, reached: false },
      { days: 75, reached: false },
      { days: 100, reached: false },
    ]);
  });
});

describe('Milestone', () => {
  it('shows the held total, the message and the badges as the server counted them', () => {
    render(
      <Milestone streak={{ held: 130, milestones: 5 }} partnerName="Jessie" onClose={vi.fn()} />
    );

    expect(screen.getByTestId('daily-milestone-held')).toHaveTextContent('130');
    expect(screen.getByTestId('daily-milestone-message')).toHaveTextContent(
      'You and Jessie have answered together on 130 days.'
    );
    expect(screen.getByTestId('daily-milestone-badge-125')).toHaveAttribute('data-reached', 'true');
    for (const days of [150, 175, 200]) {
      expect(screen.getByTestId(`daily-milestone-badge-${days}`)).toHaveAttribute(
        'data-reached',
        'false'
      );
    }
    expect(screen.queryByTestId('daily-milestone-badge-25')).toBeNull();
  });

  it('the big heart animates; the badges never do', () => {
    render(
      <Milestone streak={{ held: 25, milestones: 1 }} partnerName="Jessie" onClose={vi.fn()} />
    );

    expect(screen.getByTestId('daily-milestone-heart')).toHaveAttribute('data-animated', 'true');
    const badge = screen.getByTestId('daily-milestone-badge-25');
    expect(badge.querySelector('svg')).toHaveAttribute('data-animated', 'false');
    expect(badge.querySelectorAll('[class*="animate-"]')).toHaveLength(0);
  });

  it('Continue and Close each call onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Milestone streak={{ held: 25, milestones: 1 }} partnerName="Jessie" onClose={onClose} />
    );

    await user.click(screen.getByTestId('daily-milestone-continue'));
    await user.click(within(screen.getByTestId('daily-milestone')).getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
