import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  hashDateString,
  getDailyMessage,
  getMessageForDate,
  getAvailableHistoryDays,
  isNewDay,
} from '@/utils/messageRotation';
import { formatDateISO } from '@/utils/dateUtils';
import type { Message, MessageHistory } from '@/types';

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

  it('returns whole days since the couple start when less than 30', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));

    const history: MessageHistory = { maxHistoryDays: 30 } as MessageHistory;
    const start = new Date(2026, 8, 12, 12, 0, 0).toISOString();

    expect(getAvailableHistoryDays(history, start)).toBe(10);
  });

  it('counts from the start instant, including its time of day', () => {
    vi.useFakeTimers();
    // 9 days and 23 hours after an 18:00 start: nine whole days.
    vi.setSystemTime(new Date(2026, 8, 22, 17, 0, 0));

    const history: MessageHistory = { maxHistoryDays: 30 } as MessageHistory;
    const start = new Date(2026, 8, 12, 18, 0, 0).toISOString();

    expect(getAvailableHistoryDays(history, start)).toBe(9);
  });

  it('caps at 30 even if configured higher', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const history: MessageHistory = { maxHistoryDays: 100 } as MessageHistory;

    expect(getAvailableHistoryDays(history, twoYearsAgo.toISOString())).toBe(30);
  });

  it('uses configured max if less than 30 and less than days since start', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const history: MessageHistory = { maxHistoryDays: 14 } as MessageHistory;

    expect(getAvailableHistoryDays(history, twoYearsAgo.toISOString())).toBe(14);
  });

  it('defaults maxHistoryDays to 30 when undefined', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    expect(getAvailableHistoryDays({} as MessageHistory, twoYearsAgo.toISOString())).toBe(30);
  });

  it('never goes below zero for a start still in the future', () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    expect(
      getAvailableHistoryDays({ maxHistoryDays: 30 } as MessageHistory, nextWeek.toISOString())
    ).toBe(0);
  });

  // No start date (unlinked, not set yet, not loaded) and an unreadable one
  // cannot bound history, so only the configured cap (itself capped at 30)
  // applies — never NaN, which Math.min would propagate.
  it.each([
    ['not set', null],
    ['empty', ''],
    ['non-date text', 'not-a-date'],
  ])('falls back to the configured cap without a usable start (%s)', (_label, start) => {
    expect(getAvailableHistoryDays({ maxHistoryDays: 14 } as MessageHistory, start)).toBe(14);
    expect(getAvailableHistoryDays({ maxHistoryDays: 100 } as MessageHistory, start)).toBe(30);
    expect(getAvailableHistoryDays({} as MessageHistory, start)).toBe(30);
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
