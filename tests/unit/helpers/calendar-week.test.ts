import { describe, expect, it } from 'vitest';
import { calendarWeekFrom, sevenDatesEnding, sevenDatesFrom } from '../../support/factories/calendar-week';

describe('sevenDatesFrom', () => {
  it('gives the seven dates from the first, across a month end', () => {
    expect(sevenDatesFrom('2030-02-26')).toEqual([
      '2030-02-26',
      '2030-02-27',
      '2030-02-28',
      '2030-03-01',
      '2030-03-02',
      '2030-03-03',
      '2030-03-04',
    ]);
  });
});

describe('sevenDatesEnding', () => {
  it('gives the seven dates ending on the last, oldest first', () => {
    expect(sevenDatesEnding('2030-03-06')).toEqual([
      '2030-02-28',
      '2030-03-01',
      '2030-03-02',
      '2030-03-03',
      '2030-03-04',
      '2030-03-05',
      '2030-03-06',
    ]);
  });

  it('keeps the dates whatever the host zone, across a DST change', () => {
    // 8 March 2026 is the spring-forward day in New York, Vitest's pinned zone.
    expect(sevenDatesEnding('2026-03-09')[0]).toBe('2026-03-03');
  });
});

describe('calendarWeekFrom', () => {
  it('marks the dates after today upcoming, gives each other its state, and open where none', () => {
    const states: Record<string, 'done' | 'missed'> = { '2030-03-04': 'done', '2030-03-05': 'missed' };
    expect(calendarWeekFrom('2030-03-03', '2030-03-06', (day) => states[day])).toEqual([
      { day: '2030-03-03', state: 'open' },
      { day: '2030-03-04', state: 'done' },
      { day: '2030-03-05', state: 'missed' },
      { day: '2030-03-06', state: 'open' },
      { day: '2030-03-07', state: 'upcoming' },
      { day: '2030-03-08', state: 'upcoming' },
      { day: '2030-03-09', state: 'upcoming' },
    ]);
  });

  it('passes each date its index, Sunday 0 to Saturday 6', () => {
    const week = calendarWeekFrom('2030-03-03', '2030-03-09', (_day, index) => (index === 6 ? 'done' : undefined));
    expect(week.map((entry) => entry.state)).toEqual(['open', 'open', 'open', 'open', 'open', 'open', 'done']);
  });
});
