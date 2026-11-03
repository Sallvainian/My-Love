/**
 * The Dates list's date forms (`formatListDate`, `formatDayMonth`): day first,
 * `en-US` month names, and the year shown only outside the current one.
 * Dates are built from local components, as `parseEventDate` does. Also the
 * Together since field's local date and time rules.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDayMonth,
  formatListDate,
  fromLocalDateTime,
  isValidTogetherSince,
  toLocalDateTime,
} from '../settingsFields';

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

describe('toLocalDateTime', () => {
  it('reads an instant as the local date and time a datetime-local input takes', () => {
    expect(toLocalDateTime(new Date(2025, 9, 4, 18, 5).toISOString())).toBe('2025-10-04T18:05');
  });

  it('is empty for no value or one that does not parse', () => {
    expect(toLocalDateTime(null)).toBe('');
    expect(toLocalDateTime(undefined)).toBe('');
    expect(toLocalDateTime('')).toBe('');
    expect(toLocalDateTime('not a date')).toBe('');
  });
});

describe('fromLocalDateTime', () => {
  it('builds the instant from the local components', () => {
    expect(fromLocalDateTime('2025-10-04T18:05')).toBe(new Date(2025, 9, 4, 18, 5).toISOString());
  });

  it('round-trips through toLocalDateTime', () => {
    expect(toLocalDateTime(fromLocalDateTime('2024-02-29T00:00'))).toBe('2024-02-29T00:00');
  });

  it('is null for an empty, partial or impossible value', () => {
    expect(fromLocalDateTime('')).toBeNull();
    expect(fromLocalDateTime('2025-10-04')).toBeNull();
    expect(fromLocalDateTime('2025-02-30T10:00')).toBeNull();
    expect(fromLocalDateTime('2025-10-04T25:00')).toBeNull();
    expect(fromLocalDateTime('2025-10-04T10:61')).toBeNull();
  });

  it('checks the date parts only, so a time a clock change skips still reads as an instant', () => {
    // 02:30 on 9 Mar 2025 does not exist in US zones (spring forward) and does elsewhere;
    // either way it is a valid pick, and the date part is unchanged.
    const iso = fromLocalDateTime('2025-03-09T02:30');
    expect(iso).not.toBeNull();
    expect(Number.isNaN(new Date(iso!).getTime())).toBe(false);
  });
});

describe('isValidTogetherSince', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a past value and exactly now, and refuses one a minute ahead', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0, 0));

    expect(isValidTogetherSince('2025-10-04T18:00')).toBe(true);
    expect(isValidTogetherSince('2026-09-25T12:00')).toBe(true);
    expect(isValidTogetherSince('2026-09-25T12:01')).toBe(false);
    expect(isValidTogetherSince('2026-09-26T00:00')).toBe(false);
  });

  it('refuses an empty or impossible value', () => {
    expect(isValidTogetherSince('')).toBe(false);
    expect(isValidTogetherSince('2025-02-30T10:00')).toBe(false);
  });
});
