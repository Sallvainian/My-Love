import { describe, it, expect } from 'vitest';
import { getRelativeTime, isJustNow } from '../dateFormat';

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
