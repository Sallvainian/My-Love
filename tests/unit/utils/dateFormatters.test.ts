/**
 * Date Formatters Tests
 *
 * Tests for message timestamp formatting utilities.
 * Story 2.1: AC-2.1.2 (timestamp display)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatMessageTimestamp,
  formatFullTimestamp,
  formatTime,
  formatDayName,
  formatShortDate,
} from '../../../src/utils/dateFormatters';

describe('dateFormatters', () => {
  // Mock date: Saturday, November 29, 2025, 14:30:00 local time
  const mockNow = new Date('2025-11-29T14:30:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatMessageTimestamp', () => {
    it('formats today\'s date as time only', () => {
      const today = '2025-11-29T14:45:00';
      const result = formatMessageTimestamp(today);
      // Should be time format like "2:45 PM"
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('formats yesterday as "Yesterday"', () => {
      const yesterday = '2025-11-28T10:00:00';
      const result = formatMessageTimestamp(yesterday);
      expect(result).toBe('Yesterday');
    });

    it('formats 2 days ago as day name', () => {
      // November 27, 2025 is Thursday
      const twoDaysAgo = '2025-11-27T10:00:00';
      const result = formatMessageTimestamp(twoDaysAgo);
      expect(result).toBe('Thursday');
    });

    it('formats 6 days ago as day name', () => {
      // November 23, 2025 is Sunday
      const sixDaysAgo = '2025-11-23T10:00:00';
      const result = formatMessageTimestamp(sixDaysAgo);
      expect(result).toBe('Sunday');
    });

    it('formats 7+ days ago as short date', () => {
      const sevenDaysAgo = '2025-11-22T10:00:00';
      const result = formatMessageTimestamp(sevenDaysAgo);
      // Should be "Nov 22" format
      expect(result).toBe('Nov 22');
    });

    it('formats older date as month and day', () => {
      const oldDate = '2025-11-15T10:00:00';
      const result = formatMessageTimestamp(oldDate);
      expect(result).toBe('Nov 15');
    });

    it('handles morning time correctly', () => {
      const morning = '2025-11-29T09:30:00';
      const result = formatMessageTimestamp(morning);
      expect(result).toMatch(/9:30\s?AM/i);
    });

    it('handles afternoon time correctly', () => {
      const afternoon = '2025-11-29T15:45:00';
      const result = formatMessageTimestamp(afternoon);
      expect(result).toMatch(/3:45\s?PM/i);
    });

    it('handles midnight timestamp correctly', () => {
      const midnight = '2025-11-29T00:00:00';
      const result = formatMessageTimestamp(midnight);
      expect(result).toMatch(/12:00\s?AM/i);
    });

    it('handles noon timestamp correctly', () => {
      const noon = '2025-11-29T12:00:00';
      const result = formatMessageTimestamp(noon);
      expect(result).toMatch(/12:00\s?PM/i);
    });

    it('accepts Date object as input', () => {
      const dateObj = new Date('2025-11-29T14:30:00');
      const result = formatMessageTimestamp(dateObj);
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });
  });

  describe('formatTime', () => {
    it('formats time in 12-hour format', () => {
      const date = new Date('2025-11-29T14:30:00');
      const result = formatTime(date);
      expect(result).toMatch(/2:30\s?PM/i);
    });

    it('handles single-digit hours', () => {
      const date = new Date('2025-11-29T09:05:00');
      const result = formatTime(date);
      expect(result).toMatch(/9:05\s?AM/i);
    });
  });

  describe('formatDayName', () => {
    it('returns full day name', () => {
      const saturday = new Date('2025-11-29T10:00:00');
      expect(formatDayName(saturday)).toBe('Saturday');
    });

    it('handles different days', () => {
      const monday = new Date('2025-11-24T10:00:00');
      expect(formatDayName(monday)).toBe('Monday');
    });
  });

  describe('formatShortDate', () => {
    it('formats as month and day', () => {
      const date = new Date('2025-11-15T10:00:00');
      expect(formatShortDate(date)).toBe('Nov 15');
    });

    it('handles different months', () => {
      const december = new Date('2025-12-25T10:00:00');
      expect(formatShortDate(december)).toBe('Dec 25');
    });
  });

  describe('formatFullTimestamp', () => {
    it('includes full date and time', () => {
      const date = '2025-11-29T14:45:00';
      const result = formatFullTimestamp(date);
      // Should contain month, day, year, and time
      expect(result).toContain('November');
      expect(result).toContain('29');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('handles ISO string format with Z suffix', () => {
      const isoDate = '2025-11-29T14:45:00.000Z';
      const result = formatFullTimestamp(isoDate);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('accepts Date object as input', () => {
      const dateObj = new Date('2025-11-29T14:45:00');
      const result = formatFullTimestamp(dateObj);
      expect(result).toContain('2025');
    });
  });
});
