import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calendarDaysBetween,
  formatMessageTimestamp,
  formatRelativeDate,
  getRelativeTime,
  isJustNow,
  loveNoteDisplayTime,
} from '../dateUtils';

// The suite runs under TZ=America/New_York (vitest.config.ts). Clocks spring
// forward on 2026-03-08 (a 23-hour local day) and fall back on 2026-11-01 (a
// 25-hour one), so a span crossing either is not a whole multiple of 24 hours.
describe('calendarDaysBetween', () => {
  it('counts calendar days, not elapsed 24-hour blocks, across spring-forward', () => {
    expect(calendarDaysBetween(new Date(2026, 2, 9, 0, 30), new Date(2026, 2, 8, 12, 0))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 2, 10, 12, 0), new Date(2026, 2, 7, 12, 0))).toBe(3);
  });

  it('counts calendar days across fall-back', () => {
    expect(calendarDaysBetween(new Date(2026, 10, 1, 23, 30), new Date(2026, 9, 31, 1, 0))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 10, 3, 0, 30), new Date(2026, 9, 31, 23, 0))).toBe(3);
  });

  it('is zero within one day and negative when the first date is earlier', () => {
    expect(calendarDaysBetween(new Date(2026, 2, 8, 23, 59), new Date(2026, 2, 8, 0, 0))).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(-2);
  });
});

describe('formatMessageTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says "Yesterday" for a note from the day clocks sprang forward', () => {
    vi.setSystemTime(new Date(2026, 2, 9, 0, 30)); // Mon 00:30, 23h after Sun midnight
    expect(formatMessageTimestamp(new Date(2026, 2, 8, 12, 0))).toBe('Yesterday');
  });

  it('names the weekday for a note two to six calendar days back across spring-forward', () => {
    vi.setSystemTime(new Date(2026, 2, 9, 0, 30)); // Monday
    expect(formatMessageTimestamp(new Date(2026, 2, 7, 12, 0))).toBe('Saturday');
  });

  it('shows the date, not a weekday, for a note seven calendar days back across spring-forward', () => {
    vi.setSystemTime(new Date(2026, 2, 12, 0, 30)); // Thursday
    expect(formatMessageTimestamp(new Date(2026, 2, 5, 12, 0))).toBe('Mar 5');
  });
});

describe('getRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for timestamps < 1 minute ago', () => {
    // Pinned: day boundaries are calendar-based, so a bare "30 seconds ago"
    // reads "Yesterday" whenever the suite runs in the first 30s after midnight.
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    const timestamp = new Date(Date.now() - 30000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('Just now');
  });

  it('returns minutes for timestamps < 1 hour ago', () => {
    // Pinned: a bare "15 minutes ago" is yesterday before 00:15 local.
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    const timestamp = new Date(Date.now() - 15 * 60000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('15m ago');
  });

  it('returns hours for timestamps < 24 hours ago', () => {
    // Pinned: day boundaries are now calendar-based, so a bare "5 hours ago"
    // would read "Yesterday" whenever the suite runs before 05:00 local.
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    const timestamp = new Date(2026, 2, 15, 7, 0, 0).toISOString();
    expect(getRelativeTime(timestamp)).toBe('5h ago');
  });

  it('returns "Yesterday" for timestamps 1 day ago', () => {
    // Pinned: a bare "25 hours ago" is two calendar days back before 01:00 local.
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    const timestamp = new Date(2026, 2, 14, 11, 0, 0).toISOString();
    expect(getRelativeTime(timestamp)).toBe('Yesterday');
  });

  it('returns formatted date for timestamps > 1 day ago', () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));
    const timestamp = new Date(2026, 2, 12, 12, 0, 0).toISOString();
    expect(getRelativeTime(timestamp)).toBe('Mar 12');
  });

  it('says "Yesterday" for a mood from the day clocks sprang forward', () => {
    vi.setSystemTime(new Date(2026, 2, 9, 0, 30)); // Mon 00:30, 12.5h after Sun noon
    expect(getRelativeTime(new Date(2026, 2, 8, 12, 0).toISOString())).toBe('Yesterday');
  });

  it('does not say "Yesterday" for a mood two calendar days old', () => {
    vi.setSystemTime(new Date(2026, 2, 18, 1, 0, 0)); // Wednesday 01:00
    const monEvening = new Date(2026, 2, 16, 18, 0, 0); // Monday 18:00
    expect(getRelativeTime(monEvening.toISOString())).not.toBe('Yesterday');
  });
});

describe('isJustNow', () => {
  // Pinned, so each timestamp sits an exact distance from "now" and the
  // 5-minute (300 000 ms) boundary is measured, not approximated.
  const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime();

  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for timestamps < 5 minutes ago', () => {
    expect(isJustNow(new Date(NOW - 2 * 60000).toISOString())).toBe(true);
    expect(isJustNow(new Date(NOW - 299_000).toISOString())).toBe(true);
  });

  it('returns false for timestamps >= 5 minutes ago', () => {
    expect(isJustNow(new Date(NOW - 300_000).toISOString())).toBe(false);
    expect(isJustNow(new Date(NOW - 301_000).toISOString())).toBe(false);
    expect(isJustNow(new Date(NOW - 6 * 60000).toISOString())).toBe(false);
  });
});

describe('formatRelativeDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "today" for a timestamp from earlier today', () => {
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0)); // March 15, 2026 noon
    const earlier = new Date(2026, 2, 15, 1, 0, 0); // March 15, 1 AM
    expect(formatRelativeDate(earlier.toISOString())).toBe('today');
  });

  it('returns "yesterday" for a timestamp from yesterday', () => {
    const now = new Date(2026, 2, 15, 12, 0, 0); // March 15, 2026 noon
    vi.setSystemTime(now);
    const yesterday = new Date(2026, 2, 14, 23, 0, 0); // March 14, 11 PM
    expect(formatRelativeDate(yesterday.toISOString())).toBe('yesterday');
  });

  it('returns "3 days ago" for a timestamp 3 calendar days ago', () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    vi.setSystemTime(now);
    const threeDaysAgo = new Date(2026, 2, 12, 20, 0, 0);
    expect(formatRelativeDate(threeDaysAgo.toISOString())).toBe('3 days ago');
  });

  it('returns months ago for dates 30+ days in the past', () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    vi.setSystemTime(now);
    const twoMonthsAgo = new Date(2026, 0, 10, 12, 0, 0); // Jan 10
    expect(formatRelativeDate(twoMonthsAgo.toISOString())).toBe('2 months ago');
  });

  it('returns years ago for dates 365+ days in the past', () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    vi.setSystemTime(now);
    const twoYearsAgo = new Date(2024, 0, 1, 12, 0, 0); // Jan 1, 2024
    expect(formatRelativeDate(twoYearsAgo.toISOString())).toBe('2 years ago');
  });

  it('counts calendar days across spring-forward', () => {
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0)); // March 10, noon
    expect(formatRelativeDate(new Date(2026, 2, 7, 12, 0, 0).toISOString())).toBe('3 days ago');
  });

  it('reaches "last month" 30 calendar days back across spring-forward', () => {
    vi.setSystemTime(new Date(2026, 3, 7, 12, 0, 0)); // April 7, noon
    expect(formatRelativeDate(new Date(2026, 2, 8, 12, 0, 0).toISOString())).toBe('last month');
  });

  it('uses calendar-day boundary, not wall-clock seconds', () => {
    // 11 PM yesterday → should be "yesterday", not "today"
    const now = new Date(2026, 2, 15, 10, 0, 0); // March 15, 10 AM
    vi.setSystemTime(now);
    const lastNight = new Date(2026, 2, 14, 23, 0, 0); // March 14, 11 PM (11h ago)
    expect(formatRelativeDate(lastNight.toISOString())).toBe('yesterday');
  });
});

describe('loveNoteDisplayTime', () => {
  const delivered = '2026-09-24T14:00:00.123456+00:00';

  it('shows written_at for a note written well before it was delivered', () => {
    const written = '2026-09-24T09:00:00.000Z';
    expect(loveNoteDisplayTime({ created_at: delivered, written_at: written })).toBe(written);
  });

  it('shows created_at when written_at is absent or null (an image note, an older client)', () => {
    expect(loveNoteDisplayTime({ created_at: delivered })).toBe(delivered);
    expect(loveNoteDisplayTime({ created_at: delivered, written_at: null })).toBe(delivered);
  });

  it('shows created_at when the gap is within a minute (a note sent at once)', () => {
    const justBefore = '2026-09-24T13:59:02.000Z';
    expect(loveNoteDisplayTime({ created_at: delivered, written_at: justBefore })).toBe(delivered);
  });

  it('shows written_at once the gap passes a minute', () => {
    const overAMinute = '2026-09-24T13:58:59.000Z';
    expect(loveNoteDisplayTime({ created_at: delivered, written_at: overAMinute })).toBe(overAMinute);
  });

  it('shows created_at when written_at is later than delivery or unparseable', () => {
    expect(
      loveNoteDisplayTime({ created_at: delivered, written_at: '2026-09-24T15:00:00.000Z' })
    ).toBe(delivered);
    expect(loveNoteDisplayTime({ created_at: delivered, written_at: 'not a date' })).toBe(delivered);
  });
});
