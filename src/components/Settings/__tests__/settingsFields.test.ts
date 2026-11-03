/**
 * The Dates list's date forms (`formatListDate`, `formatDayMonth`): day first,
 * `en-US` month names, and the year shown only outside the current one.
 * Dates are built from local components, as `parseEventDate` does.
 */
import { describe, expect, it } from 'vitest';
import { formatDayMonth, formatListDate } from '../settingsFields';

const NOW = new Date(2026, 10, 3, 12);

describe('formatListDate', () => {
  it('reads weekday, day and month in the current year', () => {
    expect(formatListDate(new Date(2026, 10, 14), NOW)).toBe('Sat 14 Nov');
  });

  it('reads day, month and year in any other year', () => {
    expect(formatListDate(new Date(2022, 1, 3), NOW)).toBe('3 Feb 2022');
    expect(formatListDate(new Date(2027, 0, 1), NOW)).toBe('1 Jan 2027');
  });

  it('writes September as Sep, not Sept', () => {
    expect(formatListDate(new Date(2026, 8, 9), NOW)).toBe('Wed 9 Sep');
    expect(formatListDate(new Date(2021, 8, 9), NOW)).toBe('9 Sep 2021');
  });

  it('takes the current year from the clock when none is passed', () => {
    const thisYear = new Date().getFullYear();
    expect(formatListDate(new Date(thisYear, 5, 1))).toMatch(/^\w{3} 1 Jun$/);
  });
});

describe('formatDayMonth', () => {
  it('reads day and month with no year', () => {
    expect(formatDayMonth(new Date(1990, 3, 4))).toBe('4 Apr');
    expect(formatDayMonth(new Date(2000, 8, 30))).toBe('30 Sep');
  });
});
