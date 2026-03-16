import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRelativeTime, isJustNow, formatRelativeDate } from '../dateUtils';

describe('getRelativeTime', () => {
  it('returns "Just now" for timestamps < 1 minute ago', () => {
    const timestamp = new Date(Date.now() - 30000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('Just now');
  });

  it('returns minutes for timestamps < 1 hour ago', () => {
    const timestamp = new Date(Date.now() - 15 * 60000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('15m ago');
  });

  it('returns hours for timestamps < 24 hours ago', () => {
    const timestamp = new Date(Date.now() - 5 * 3600000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('5h ago');
  });

  it('returns "Yesterday" for timestamps 1 day ago', () => {
    const timestamp = new Date(Date.now() - 25 * 3600000).toISOString();
    expect(getRelativeTime(timestamp)).toBe('Yesterday');
  });

  it('returns formatted date for timestamps > 1 day ago', () => {
    const timestamp = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(getRelativeTime(timestamp)).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // e.g., "Nov 29"
  });
});

describe('isJustNow', () => {
  it('returns true for timestamps < 5 minutes ago', () => {
    const timestamp = new Date(Date.now() - 2 * 60000).toISOString();
    expect(isJustNow(timestamp)).toBe(true);
  });

  it('returns false for timestamps >= 5 minutes ago', () => {
    const timestamp = new Date(Date.now() - 6 * 60000).toISOString();
    expect(isJustNow(timestamp)).toBe(false);
  });
});

describe('formatRelativeDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "today" for a timestamp from earlier today', () => {
    // Use a date from 1 hour ago (always same calendar day)
    const now = new Date();
    const earlier = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 0, 0);
    vi.setSystemTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
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

  it('uses calendar-day boundary, not wall-clock seconds', () => {
    // 11 PM yesterday → should be "yesterday", not "today"
    const now = new Date(2026, 2, 15, 10, 0, 0); // March 15, 10 AM
    vi.setSystemTime(now);
    const lastNight = new Date(2026, 2, 14, 23, 0, 0); // March 14, 11 PM (11h ago)
    expect(formatRelativeDate(lastNight.toISOString())).toBe('yesterday');
  });
});
