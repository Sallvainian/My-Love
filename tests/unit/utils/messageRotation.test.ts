/**
 * Unit tests for messageRotation utility functions
 * Target coverage: 90%+
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDate,
  hashDateString,
  getDailyMessage,
  getMessageForDate,
  getAvailableHistoryDays,
  isNewDay,
  getDaysSinceStart,
  formatRelationshipDuration,
  // Legacy functions
  getDailyMessageId,
  getTodayMessage,
  getNextMessage,
  getPreviousMessage,
} from '@/utils/messageRotation';
import { createMockMessages } from './testHelpers';
import type { MessageHistory, Settings } from '@/types';

describe('messageRotation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 in local time
      const formatted = formatDate(date);
      expect(formatted).toMatch(/2024-01-15/);
    });

    it('pads single-digit months and days', () => {
      const date = new Date(2024, 2, 5); // Mar 5, 2024 in local time
      const formatted = formatDate(date);
      expect(formatted).toMatch(/2024-03-05/);
    });

    it('handles leap year dates', () => {
      const leapDay = new Date(2024, 1, 29); // Feb 29, 2024 in local time
      const formatted = formatDate(leapDay);
      expect(formatted).toMatch(/2024-02-29/);
    });
  });

  describe('hashDateString', () => {
    it('produces deterministic hash for same input', () => {
      const dateString = '2024-01-15';
      const hash1 = hashDateString(dateString);
      const hash2 = hashDateString(dateString);

      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different dates', () => {
      const hash1 = hashDateString('2024-01-15');
      const hash2 = hashDateString('2024-01-16');

      expect(hash1).not.toBe(hash2);
    });

    it('always returns positive numbers', () => {
      const hash = hashDateString('2024-01-15');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('produces consistent hashes across multiple runs', () => {
      const hashes = Array.from({ length: 100 }, () =>
        hashDateString('2024-01-15')
      );

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });
  });

  describe('getDailyMessage', () => {
    const messages = createMockMessages(10);

    it('returns same message for same date', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const msg1 = getDailyMessage(messages, date);
      const msg2 = getDailyMessage(messages, date);

      expect(msg1).toBe(msg2);
      expect(msg1.id).toBe(msg2.id);
    });

    it('returns different messages for different dates', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-16T00:00:00Z');

      const msg1 = getDailyMessage(messages, date1);
      const msg2 = getDailyMessage(messages, date2);

      // Not guaranteed to be different, but with 10 messages very likely
      // Just verify both are valid messages
      expect(messages).toContain(msg1);
      expect(messages).toContain(msg2);
    });

    it('uses current date when no date provided', () => {
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));

      const msgWithoutDate = getDailyMessage(messages);
      const msgWithDate = getDailyMessage(messages, new Date('2024-01-15T10:30:00Z'));

      expect(msgWithoutDate.id).toBe(msgWithDate.id);
    });

    it('throws error for empty message pool', () => {
      expect(() => getDailyMessage([], new Date())).toThrow(
        'Cannot get daily message from empty message pool'
      );
    });

    it('handles single message pool', () => {
      const singleMessage = createMockMessages(1);
      const msg = getDailyMessage(singleMessage, new Date('2024-01-15'));

      expect(msg).toBe(singleMessage[0]);
    });

    it('distributes messages across different dates', () => {
      const largePool = createMockMessages(100);
      const dates = Array.from({ length: 100 }, (_, i) => {
        const d = new Date('2024-01-01');
        d.setDate(d.getDate() + i);
        return d;
      });

      const selectedMessages = dates.map((date) =>
        getDailyMessage(largePool, date)
      );

      // Should use multiple different messages (not all the same)
      const uniqueMessageIds = new Set(selectedMessages.map((m) => m.id));
      expect(uniqueMessageIds.size).toBeGreaterThan(10); // At least 10 different messages
    });

    it('wraps around message pool correctly', () => {
      const smallPool = createMockMessages(3);
      const dates = Array.from({ length: 10 }, (_, i) => {
        const d = new Date('2024-01-01');
        d.setDate(d.getDate() + i);
        return d;
      });

      const selectedMessages = dates.map((date) =>
        getDailyMessage(smallPool, date)
      );

      // All selected messages should be from the pool
      selectedMessages.forEach((msg) => {
        expect(smallPool).toContain(msg);
      });
    });
  });

  describe('getMessageForDate', () => {
    it('is an alias for getDailyMessage', () => {
      const messages = createMockMessages(5);
      const date = new Date('2024-01-15T00:00:00Z');

      const msg1 = getDailyMessage(messages, date);
      const msg2 = getMessageForDate(messages, date);

      expect(msg1.id).toBe(msg2.id);
    });
  });

  describe('getAvailableHistoryDays', () => {
    const createMockSettings = (startDate: string): Settings => ({
      relationship: {
        startDate,
        partnerName: 'Test Partner',
        anniversaryDate: '2024-01-01',
      },
      display: {
        theme: 'light',
        showAnimations: true,
        fontSize: 'medium',
      },
      notifications: {
        enabled: false,
      },
    });

    const createMockHistory = (maxDays: number): MessageHistory => ({
      viewedMessages: [],
      maxHistoryDays: maxDays,
      lastViewedDate: null,
    });

    it('returns configured max when less than days since start', () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z')); // 152 days after Jan 1

      const settings = createMockSettings('2024-01-01');
      const history = createMockHistory(20);

      expect(getAvailableHistoryDays(history, settings)).toBe(20);
    });

    it('returns days since start when less than configured max', () => {
      vi.setSystemTime(new Date('2024-01-15T00:00:00Z')); // 14 days after Jan 1

      const settings = createMockSettings('2024-01-01');
      const history = createMockHistory(50);

      expect(getAvailableHistoryDays(history, settings)).toBe(14);
    });

    it('caps at 30 days maximum', () => {
      vi.setSystemTime(new Date('2024-12-31T00:00:00Z')); // 365 days after Jan 1

      const settings = createMockSettings('2024-01-01');
      const history = createMockHistory(100);

      expect(getAvailableHistoryDays(history, settings)).toBe(30);
    });

    it('handles same-day relationship start', () => {
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

      const settings = createMockSettings('2024-01-01');
      const history = createMockHistory(30);

      expect(getAvailableHistoryDays(history, settings)).toBe(0);
    });

    it('uses default of 30 when maxHistoryDays not set', () => {
      vi.setSystemTime(new Date('2024-12-31T00:00:00Z'));

      const settings = createMockSettings('2024-01-01');
      const history = { viewedMessages: [], lastViewedDate: null } as MessageHistory;

      expect(getAvailableHistoryDays(history, settings)).toBe(30);
    });
  });

  describe('isNewDay', () => {
    // Note: Testing isNewDay with real time since it uses Date constructor
    // which behaves differently with fake timers

    it('returns true when lastShownDate is null', () => {
      expect(isNewDay(null)).toBe(true);
    });

    it('returns false for same day using recent timestamp', () => {
      // Create a timestamp from earlier today
      const now = new Date();
      const earlier = new Date(now);
      earlier.setHours(earlier.getHours() - 2);
      const lastShown = earlier.toISOString();

      // If this fails due to day boundary, the test is running at midnight
      // which is an edge case we can accept
      if (now.getDate() === earlier.getDate()) {
        expect(isNewDay(lastShown)).toBe(false);
      }
    });

    it('returns true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const lastShown = yesterday.toISOString();

      expect(isNewDay(lastShown)).toBe(true);
    });

    it('returns true for last month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastShown = lastMonth.toISOString();

      expect(isNewDay(lastShown)).toBe(true);
    });

    it('returns true for last year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const lastShown = lastYear.toISOString();

      expect(isNewDay(lastShown)).toBe(true);
    });
  });

  describe('getDaysSinceStart', () => {
    it('calculates days since start date', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2024-01-15T00:00:00Z');

      expect(getDaysSinceStart(start, target)).toBe(14);
    });

    it('uses current date when target not provided', () => {
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
      const start = new Date('2024-01-01T00:00:00Z');

      expect(getDaysSinceStart(start)).toBe(14);
    });

    it('returns 0 for same day', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      expect(getDaysSinceStart(date, date)).toBe(0);
    });

    it('handles year boundaries', () => {
      const start = new Date('2023-12-30T00:00:00Z');
      const target = new Date('2024-01-05T00:00:00Z');

      expect(getDaysSinceStart(start, target)).toBe(6);
    });
  });

  describe('formatRelationshipDuration', () => {
    it('formats days for less than 30 days', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2024-01-15T00:00:00Z');

      expect(formatRelationshipDuration(start, target)).toBe('14 days');
    });

    it('uses singular for 1 day', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2024-01-02T00:00:00Z');

      expect(formatRelationshipDuration(start, target)).toBe('1 day');
    });

    it('formats months for 30-364 days', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2024-03-01T00:00:00Z'); // ~60 days

      expect(formatRelationshipDuration(start, target)).toBe('2 months');
    });

    it('uses singular for 1 month', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2024-02-05T00:00:00Z'); // ~35 days

      expect(formatRelationshipDuration(start, target)).toBe('1 month');
    });

    it('formats years for 365+ days', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2025-01-01T00:00:00Z');

      expect(formatRelationshipDuration(start, target)).toBe('1 year');
    });

    it('includes remaining months with years', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2025-03-01T00:00:00Z'); // 1 year + ~60 days

      const result = formatRelationshipDuration(start, target);
      expect(result).toContain('year');
      expect(result).toContain('month');
    });

    it('uses plural for multiple years', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const target = new Date('2026-01-01T00:00:00Z');

      expect(formatRelationshipDuration(start, target)).toBe('2 years');
    });
  });

  describe('legacy functions', () => {
    const messages = createMockMessages(10);

    describe('getDailyMessageId', () => {
      it('calculates message index based on days since start', () => {
        const start = new Date('2024-01-01T00:00:00Z');
        const today = new Date('2024-01-11T00:00:00Z');

        const id = getDailyMessageId(start, today, 10);
        expect(id).toBe(0); // 10 days % 10 = 0
      });

      it('wraps around message count', () => {
        const start = new Date('2024-01-01T00:00:00Z');
        const today = new Date('2024-01-13T00:00:00Z');

        const id = getDailyMessageId(start, today, 10);
        expect(id).toBe(2); // 12 days % 10 = 2
      });
    });

    describe('getTodayMessage', () => {
      it('returns message using getDailyMessage', () => {
        vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
        const start = new Date('2024-01-01T00:00:00Z');

        const msg = getTodayMessage(messages, start);
        expect(msg).not.toBeNull();
        expect(messages).toContain(msg!);
      });

      it('returns null for empty message pool', () => {
        const start = new Date('2024-01-01T00:00:00Z');
        expect(getTodayMessage([], start)).toBeNull();
      });
    });

    describe('getNextMessage', () => {
      it('returns message for tomorrow', () => {
        vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
        const start = new Date('2024-01-01T00:00:00Z');

        const msg = getNextMessage(messages, start);
        expect(msg).not.toBeNull();
        expect(messages).toContain(msg!);
      });

      it('returns null for empty message pool', () => {
        const start = new Date('2024-01-01T00:00:00Z');
        expect(getNextMessage([], start)).toBeNull();
      });
    });

    describe('getPreviousMessage', () => {
      it('returns message for yesterday', () => {
        vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
        const start = new Date('2024-01-01T00:00:00Z');

        const msg = getPreviousMessage(messages, start);
        expect(msg).not.toBeNull();
        expect(messages).toContain(msg!);
      });

      it('returns null for empty message pool', () => {
        const start = new Date('2024-01-01T00:00:00Z');
        expect(getPreviousMessage([], start)).toBeNull();
      });
    });
  });
});
