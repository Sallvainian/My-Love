/**
 * Unit tests for dateHelpers utility functions
 * Target coverage: 90%+
 *
 * Note: Using real dates to avoid timezone issues with fake timers
 */

import { describe, it, expect } from 'vitest';
import {
  isToday,
  isSameDay,
  formatDateISO,
  parseDateISO,
  formatDateLong,
  formatDateShort,
  getDaysUntil,
  getDaysSince,
  addDays,
  getNextAnniversary,
  formatCountdown,
  getDayOfWeek,
  isPast,
  isFuture,
} from '@/utils/dateHelpers';

describe('dateHelpers', () => {
  describe('isToday', () => {
    it('returns true for current date', () => {
      const now = new Date();
      expect(isToday(now)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('returns true for same calendar day', () => {
      const date1 = new Date(2024, 0, 15, 0, 0, 0);
      const date2 = new Date(2024, 0, 15, 23, 59, 59);

      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('returns false for different days', () => {
      const date1 = new Date(2024, 0, 15);
      const date2 = new Date(2024, 0, 16);

      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('formatDateISO', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      const formatted = formatDateISO(date);
      expect(formatted).toMatch(/2024-01-15/);
    });

    it('pads single-digit months and days', () => {
      const date = new Date(2024, 2, 5); // Mar 5, 2024
      const formatted = formatDateISO(date);
      expect(formatted).toMatch(/2024-03-05/);
    });
  });

  describe('parseDateISO', () => {
    it('parses ISO date string to Date object', () => {
      const parsed = parseDateISO('2024-01-15');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getFullYear()).toBe(2024);
    });
  });

  describe('formatDateLong', () => {
    it('formats date in long format', () => {
      const date = new Date(2024, 0, 15);
      const formatted = formatDateLong(date);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
    });
  });

  describe('formatDateShort', () => {
    it('formats date in short format', () => {
      const date = new Date(2024, 0, 15);
      const formatted = formatDateShort(date);
      expect(formatted).toContain('15');
    });
  });

  describe('getDaysUntil', () => {
    it('calculates days until future date', () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 10);

      const days = getDaysUntil(future);
      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(11); // Allow for rounding
    });

    it('returns negative for past dates', () => {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 5);

      expect(getDaysUntil(past)).toBeLessThan(0);
    });
  });

  describe('getDaysSince', () => {
    it('calculates days since past date', () => {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 10);

      const days = getDaysSince(past);
      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(11);
    });
  });

  describe('addDays', () => {
    it('adds positive days to date', () => {
      const date = new Date(2024, 0, 15);
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(0);
    });

    it('adds negative days (subtracts)', () => {
      const date = new Date(2024, 0, 15);
      const result = addDays(date, -5);

      expect(result.getDate()).toBe(10);
    });

    it('handles month boundaries', () => {
      const date = new Date(2024, 0, 30);
      const result = addDays(date, 5);

      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });

    it('does not mutate original date', () => {
      const original = new Date(2024, 0, 15);
      const originalTime = original.getTime();

      addDays(original, 5);

      expect(original.getTime()).toBe(originalTime);
    });
  });

  describe('getNextAnniversary', () => {
    it('returns anniversary date', () => {
      const anniversary = getNextAnniversary('2024-06-15');
      expect(anniversary).toBeInstanceOf(Date);
      expect(anniversary.getMonth()).toBe(5); // June
      expect(anniversary.getDate()).toBe(15);
    });
  });

  describe('formatCountdown', () => {
    it('formats 0 days as "Today!"', () => {
      expect(formatCountdown(0)).toBe('Today!');
    });

    it('formats 1 day singular', () => {
      expect(formatCountdown(1)).toBe('1 day');
    });

    it('formats multiple days', () => {
      expect(formatCountdown(5)).toBe('5 days');
    });

    it('formats weeks', () => {
      expect(formatCountdown(14)).toBe('2 weeks');
    });

    it('formats months', () => {
      expect(formatCountdown(60)).toBe('2 months');
    });

    it('formats years', () => {
      expect(formatCountdown(365)).toBe('1 year');
    });

    it('formats negative days', () => {
      expect(formatCountdown(-5)).toContain('ago');
    });
  });

  describe('getDayOfWeek', () => {
    it('returns day name for date', () => {
      const monday = new Date(2024, 0, 15); // A Monday
      const dayName = getDayOfWeek(monday);
      expect(dayName).toBeTruthy();
      expect(typeof dayName).toBe('string');
    });
  });

  describe('isPast', () => {
    it('returns true for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      expect(isPast(past)).toBe(true);
    });

    it('returns false for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isPast(future)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('returns true for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isFuture(future)).toBe(true);
    });

    it('returns false for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      expect(isFuture(past)).toBe(false);
    });
  });
});
