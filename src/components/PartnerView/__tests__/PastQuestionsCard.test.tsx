/**
 * PastQuestionsCard: the three newest days both partners picked, each with the
 * question, both option texts and the server's Same or Different; nothing at
 * all when no day qualifies.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dailySnapshot, revealSnapshot } from '../../../../tests/unit/stores/dailyQuestionFixture';
import { useAppStore } from '../../../stores/useAppStore';
import { PastQuestionsCard } from '../PastQuestionsCard';

const day = (
  id: string,
  mine: 'this' | 'that',
  theirs: 'this' | 'that',
  question = { this: `${id} this`, that: `${id} that` }
) => ({ ...revealSnapshot(mine, theirs), day_id: id, day: '2026-11-05', question });

describe('PastQuestionsCard', () => {
  beforeEach(cleanup);

  it('shows the first three days in the order given', () => {
    render(
      <PastQuestionsCard
        history={[day('d4', 'this', 'this'), day('d3', 'this', 'that'), day('d2', 'that', 'that'), day('d1', 'this', 'this')]}
      />
    );

    const rows = screen.getAllByTestId('partner-past-question');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => within(row).getByTestId('partner-past-question-text').textContent)).toEqual([
      'd4 this or d4 that?',
      'd3 this or d3 that?',
      'd2 this or d2 that?',
    ]);
  });

  it('opens the history page from See all', async () => {
    const openPartnerPage = vi.fn();
    useAppStore.setState({ openPartnerPage });
    render(<PastQuestionsCard history={[day('d1', 'this', 'this')]} />);

    const seeAll = screen.getByTestId('partner-past-questions-see-all');
    expect(seeAll).toHaveTextContent('See all');
    expect(seeAll).toHaveClass('min-h-11', 'text-accent');
    await userEvent.click(seeAll);

    expect(openPartnerPage).toHaveBeenCalledWith('history');
  });

  it('shows the label and the section test id', () => {
    render(<PastQuestionsCard history={[day('d1', 'this', 'this')]} />);

    expect(screen.getByTestId('partner-past-questions')).toHaveTextContent('Past questions');
  });

  it('shows my option, then the partner option, with a dot between', () => {
    render(<PastQuestionsCard history={[day('d1', 'this', 'that', { this: 'Tea', that: 'Coffee' })]} />);

    expect(screen.getByTestId('partner-past-question-picks')).toHaveTextContent(/^Tea · Coffee$/);
  });

  it('marks a Same day with a check and data-same true', () => {
    render(<PastQuestionsCard history={[day('d1', 'that', 'that')]} />);

    const row = screen.getByTestId('partner-past-question');
    expect(row).toHaveAttribute('data-same', 'true');
    expect(within(row).getByTestId('partner-past-question-mark')).toHaveTextContent(/^Same$/);
    expect(row.querySelector('svg')!.getAttribute('class')).toContain('lucide-check');
  });

  it('marks a Different day with the word alone and data-same false', () => {
    render(<PastQuestionsCard history={[day('d1', 'this', 'that')]} />);

    const row = screen.getByTestId('partner-past-question');
    expect(row).toHaveAttribute('data-same', 'false');
    expect(within(row).getByTestId('partner-past-question-mark')).toHaveTextContent(/^Different$/);
    expect(row.querySelector('svg')).toBeNull();
  });

  it('uses the server mark, not the choices', () => {
    render(<PastQuestionsCard history={[{ ...day('d1', 'this', 'that'), same: true }]} />);

    expect(screen.getByTestId('partner-past-question')).toHaveAttribute('data-same', 'true');
  });

  it('skips a day that is not both or lacks a choice, and fills from the next', () => {
    render(
      <PastQuestionsCard
        history={[
          dailySnapshot({ day_id: 'half', state: 'me', my_choice: 'this' }),
          { ...day('nochoice', 'this', 'this'), partner_choice: null },
          day('d2', 'this', 'this'),
        ]}
      />
    );

    expect(screen.getAllByTestId('partner-past-question')).toHaveLength(1);
    expect(screen.getByTestId('partner-past-question-text')).toHaveTextContent('d2 this or d2 that?');
  });

  it.each([[[]], [[dailySnapshot()]]])('renders no section for %j', (history) => {
    render(<PastQuestionsCard history={history} />);

    expect(screen.queryByTestId('partner-past-questions')).not.toBeInTheDocument();
  });
});
