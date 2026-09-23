import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  hashDateString,
  getDailyMessage,
  getMessageForDate,
  getAvailableHistoryDays,
  isNewDay,
  getDaysSinceStart,
  formatRelationshipDuration,
  getDailyMessageId,
  getTodayMessage,
  getNextMessage,
  getPreviousMessage,
} from '@/utils/messageRotation';
import { formatDateISO } from '@/utils/dateUtils';
import type { Message, MessageHistory, Settings } from '@/types';

/** Factory: create a minimal Message */
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    text: 'I love you',
    category: 'reason',
    isCustom: false,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function createMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) =>
    createMessage({ id: i + 1, text: `Message ${i + 1}` })
  );
}

describe('formatDateISO', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatDateISO(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('pads single-digit month and day', () => {
    expect(formatDateISO(new Date(2025, 2, 9))).toBe('2025-03-09');
  });

  it('handles December 31st', () => {
    expect(formatDateISO(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});

describe('hashDateString', () => {
  it('returns a non-negative number', () => {
    expect(hashDateString('2025-01-01')).toBeGreaterThanOrEqual(0);
  });

  it('returns the same hash for the same date string', () => {
    const hash1 = hashDateString('2025-06-15');
    const hash2 = hashDateString('2025-06-15');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different dates', () => {
    const hash1 = hashDateString('2025-01-01');
    const hash2 = hashDateString('2025-01-02');
    expect(hash1).not.toBe(hash2);
  });
});

describe('getDailyMessage', () => {
  it('returns a message from the pool', () => {
    const messages = createMessages(5);
    const result = getDailyMessage(messages, new Date(2025, 0, 1));
    expect(messages).toContain(result);
  });

  it('throws if message pool is empty', () => {
    expect(() => getDailyMessage([], new Date())).toThrow(
      'Cannot get daily message from empty message pool'
    );
  });

  it('is deterministic — same date always returns same message', () => {
    const messages = createMessages(10);
    const date = new Date(2025, 5, 15);
    const first = getDailyMessage(messages, date);
    const second = getDailyMessage(messages, date);
    expect(first).toBe(second);
  });

  it('different dates can return different messages', () => {
    const messages = createMessages(100);
    const results = new Set<number>();
    for (let day = 1; day <= 30; day++) {
      results.add(getDailyMessage(messages, new Date(2025, 0, day)).id);
    }
    // With 100 messages and 30 days, we should see variety
    expect(results.size).toBeGreaterThan(1);
  });

  it('defaults to today when no date provided', () => {
    const messages = createMessages(5);
    const result = getDailyMessage(messages);
    expect(messages).toContain(result);
  });
});

describe('getMessageForDate', () => {
  it('returns same result as getDailyMessage', () => {
    const messages = createMessages(10);
    const date = new Date(2025, 3, 10);
    expect(getMessageForDate(messages, date)).toBe(getDailyMessage(messages, date));
  });
});

describe('getAvailableHistoryDays', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns days since start when less than 30', () => {
    // Fixed clock: a real "now" near midnight across a DST change can land on 9.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));

    const history: MessageHistory = { maxHistoryDays: 30 } as MessageHistory;
    const settings: Settings = {
      relationship: { startDate: '2026-09-12' },
    } as Settings;

    expect(getAvailableHistoryDays(history, settings)).toBe(10);
  });

  it('caps at 30 even if configured higher', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const history: MessageHistory = { maxHistoryDays: 100 } as MessageHistory;
    const settings: Settings = {
      relationship: { startDate: formatDateISO(twoYearsAgo) },
    } as Settings;

    expect(getAvailableHistoryDays(history, settings)).toBe(30);
  });

  it('uses configured max if less than 30 and less than days since start', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const history: MessageHistory = { maxHistoryDays: 14 } as MessageHistory;
    const settings: Settings = {
      relationship: { startDate: formatDateISO(twoYearsAgo) },
    } as Settings;

    expect(getAvailableHistoryDays(history, settings)).toBe(14);
  });

  it('defaults maxHistoryDays to 30 when undefined', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const history: MessageHistory = {} as MessageHistory;
    const settings: Settings = {
      relationship: { startDate: formatDateISO(twoYearsAgo) },
    } as Settings;

    expect(getAvailableHistoryDays(history, settings)).toBe(30);
  });

  // startDate is a bare YYYY-MM-DD (IsoDateStringSchema). `new Date('YYYY-MM-DD')`
  // is UTC midnight, which under the suite's TZ=America/New_York is 20:00 the
  // PREVIOUS local evening — so from 20:00 local every day the count ran one high.
  describe('with a YYYY-MM-DD start date west of UTC', () => {
    it('counts from LOCAL midnight of the start date, not UTC midnight', () => {
      vi.useFakeTimers();
      // 21:00 local on the start date itself: zero whole days have elapsed.
      vi.setSystemTime(new Date(2026, 8, 12, 21, 0, 0));

      const history: MessageHistory = { maxHistoryDays: 30 } as MessageHistory;
      const settings: Settings = { relationship: { startDate: '2026-09-12' } } as Settings;

      expect(getAvailableHistoryDays(history, settings)).toBe(0);
    });

    it('counts whole local days since the start date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 22, 21, 0, 0));

      const history: MessageHistory = { maxHistoryDays: 30 } as MessageHistory;
      const settings: Settings = { relationship: { startDate: '2026-09-12' } } as Settings;

      expect(getAvailableHistoryDays(history, settings)).toBe(10);
    });
  });

  // An unreadable start date cannot bound history, so only the configured cap
  // (itself capped at 30) applies — never NaN, which Math.min would propagate.
  it.each([
    ['empty', ''],
    ['non-date text', 'not-a-date'],
    ['impossible date', '2026-02-30'],
  ])('falls back to the configured cap for an unreadable start date (%s)', (_label, startDate) => {
    const settings: Settings = { relationship: { startDate } } as Settings;

    expect(getAvailableHistoryDays({ maxHistoryDays: 14 } as MessageHistory, settings)).toBe(14);
    expect(getAvailableHistoryDays({ maxHistoryDays: 100 } as MessageHistory, settings)).toBe(30);
    expect(getAvailableHistoryDays({} as MessageHistory, settings)).toBe(30);
  });
});

describe('isNewDay', () => {
  it('returns true when lastShownDate is null', () => {
    expect(isNewDay(null)).toBe(true);
  });

  it('returns false when lastShownDate is today', () => {
    expect(isNewDay(new Date().toISOString())).toBe(false);
  });

  it('returns true when lastShownDate is yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isNewDay(yesterday.toISOString())).toBe(true);
  });
});

describe('getDaysSinceStart', () => {
  it('returns 0 for today', () => {
    const today = new Date();
    expect(getDaysSinceStart(today)).toBe(0);
  });

  it('returns correct number of days', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 0, 11);
    expect(getDaysSinceStart(start, target)).toBe(10);
  });

  it('accepts optional target date', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 0, 11);
    expect(getDaysSinceStart(start, target)).toBe(10);
  });
});

describe('formatRelationshipDuration', () => {
  it('formats days when less than 30', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 0, 6);
    expect(formatRelationshipDuration(start, target)).toBe('5 days');
  });

  it('uses singular for 1 day', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 0, 2);
    expect(formatRelationshipDuration(start, target)).toBe('1 day');
  });

  it('formats months when 30-364 days', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 2, 2); // 60 days later
    expect(formatRelationshipDuration(start, target)).toBe('2 months');
  });

  it('uses singular for 1 month', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2025, 0, 31); // 30 days later
    expect(formatRelationshipDuration(start, target)).toBe('1 month');
  });

  it('formats years with remaining months', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2026, 2, 1); // 1 year, ~2 months
    const result = formatRelationshipDuration(start, target);
    expect(result).toMatch(/1 year/);
  });

  it('formats years without remaining months', () => {
    const start = new Date(2025, 0, 1);
    const target = new Date(2026, 0, 1);
    expect(formatRelationshipDuration(start, target)).toBe('1 year');
  });
});

describe('legacy functions', () => {
  it('getDailyMessageId returns modulo of days since start', () => {
    const start = new Date(2025, 0, 1);
    const today = new Date(2025, 0, 11); // 10 days
    expect(getDailyMessageId(start, today, 7)).toBe(3); // 10 % 7
  });

  it('getTodayMessage returns null for empty array', () => {
    expect(getTodayMessage([], new Date())).toBeNull();
  });

  it('getTodayMessage returns a message for non-empty array', () => {
    const messages = createMessages(5);
    const result = getTodayMessage(messages, new Date());
    expect(result).not.toBeNull();
    expect(messages).toContain(result);
  });

  it('getNextMessage returns null for empty array', () => {
    expect(getNextMessage([], new Date())).toBeNull();
  });

  it('getNextMessage returns a message', () => {
    const messages = createMessages(5);
    expect(getNextMessage(messages, new Date())).not.toBeNull();
  });

  it('getPreviousMessage returns null for empty array', () => {
    expect(getPreviousMessage([], new Date())).toBeNull();
  });

  it('getPreviousMessage returns a message', () => {
    const messages = createMessages(5);
    expect(getPreviousMessage(messages, new Date())).not.toBeNull();
  });
});
