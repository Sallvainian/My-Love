/**
 * StreakRow -- the streak's row on Daily and the Partner card (story 11.3): the
 * server's calendar week, Sunday to Saturday, with weekday letters, the ring on
 * the viewer's date alone and one plain grey circle for every date that is not
 * done or missed; a streak saved before the calendar week falls back to `week`.
 * The +1 screen's row (`StreakWeek` with no `today`) is unchanged.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CoupleStreak } from '../../../api/dailyQuestionApi';
import { calendarWeek, coupleStreak } from '../../../../tests/unit/stores/dailyQuestionFixture';
import { StreakRow, StreakWeek } from '../StreakWeek';

/** The seven dates ending on `last` (a `YYYY-MM-DD`), oldest first, all open: what `week` holds. */
function weekEnding(last: string): CoupleStreak['week'] {
  const [year, month, day] = last.split('-').map(Number);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - 6 + index));
    return { day: date.toISOString().slice(0, 10), state: 'open' as const };
  });
}

const DAYS = [
  '2030-03-03',
  '2030-03-04',
  '2030-03-05',
  '2030-03-06',
  '2030-03-07',
  '2030-03-08',
  '2030-03-09',
];

/** A streak whose viewer's date is weekday `todayIndex` (0 Sunday to 6 Saturday) of 03-03's week */
function streakOn(todayIndex: number): CoupleStreak {
  return coupleStreak({
    week: weekEnding(DAYS[todayIndex]),
    calendar_week: calendarWeek(todayIndex, { 1: 'done', 2: 'missed' }),
  });
}

function slots() {
  return within(screen.getByTestId('daily-streak-week')).getAllByTestId('daily-streak-day');
}

const renderRow = (streak: CoupleStreak) =>
  render(<StreakRow streak={streak} testIdPrefix="daily-streak" labelClass="text-muted" />);

describe('StreakRow', () => {
  it('labels the seven slots S M T W T F S and none reads Today', () => {
    renderRow(streakOn(4));

    expect(slots().map((slot) => slot.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(screen.queryByText('Today')).toBeNull();
  });

  it.each([
    ['Sunday', 0],
    ['Thursday', 4],
    ['Saturday', 6],
  ])("rings only the slot of the viewer's date: %s is slot %i", (_name, todayIndex) => {
    renderRow(streakOn(todayIndex));

    const ringed = slots().flatMap((slot, index) =>
      slot.getAttribute('data-today') === 'true' ? [index] : []
    );
    expect(ringed).toEqual([todayIndex]);
    // The ring is the outline on the dot's wrapper, on that slot alone.
    const outlined = slots().flatMap((slot, index) =>
      slot.querySelector('.outline-2') ? [index] : []
    );
    expect(outlined).toEqual([todayIndex]);
  });

  it('draws every open and upcoming date as one grey circle, today included, no dashes', () => {
    renderRow(streakOn(4));

    const grey = slots().filter((slot) =>
      ['open', 'upcoming'].includes(slot.getAttribute('data-state')!)
    );
    expect(grey).toHaveLength(5);
    const classes = grey.map(
      (slot) => slot.querySelector('.rounded-full.bg-ash-ink\\/30')?.className
    );
    expect(classes.every((cls) => cls !== undefined)).toBe(true);
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('h-[26px]');
    expect(classes[0]).toContain('w-[26px]');
    for (const slot of grey) expect(slot.innerHTML).not.toContain('dashed');
  });

  it('keeps the check on fire for a done date and the snowflake on cold for a missed one', () => {
    renderRow(streakOn(4));

    const done = slots()[1];
    const missed = slots()[2];
    expect(done.querySelector('.bg-fire svg')?.getAttribute('class')).toContain('lucide-check');
    expect(missed.querySelector('.bg-cold svg')?.getAttribute('class')).toContain(
      'lucide-snowflake'
    );
  });

  it('falls back to week for a streak saved before the calendar week, today last', () => {
    const saved = coupleStreak({ week: weekEnding('2030-03-07') });
    delete saved.calendar_week;
    renderRow(saved);

    // 2030-03-01 is a Friday.
    expect(slots().map((slot) => slot.textContent)).toEqual(['F', 'S', 'S', 'M', 'T', 'W', 'T']);
    expect(slots().map((slot) => slot.getAttribute('data-today'))).toEqual([
      null, null, null, null, null, null, 'true',
    ]);
    expect(screen.queryByText('Today')).toBeNull();
  });
});

describe('StreakWeek without today (the +1 screen)', () => {
  it('still reads Today on the last slot and draws an open date as a dashed ring', () => {
    render(
      <StreakWeek
        week={weekEnding('2030-03-07')}
        testIdPrefix="daily-streak"
        labelClass="text-muted"
      />
    );

    expect(slots().map((slot) => slot.textContent)).toEqual([
      'F',
      'S',
      'S',
      'M',
      'T',
      'W',
      'Today',
    ]);
    expect(slots().every((slot) => slot.getAttribute('data-today') === null)).toBe(true);
    expect(slots()[0].innerHTML).toContain('border-dashed');
  });
});
