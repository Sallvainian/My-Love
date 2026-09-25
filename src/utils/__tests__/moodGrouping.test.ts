import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMood } from '../../api/validation/supabaseSchemas';
import { groupMoodsByDate } from '../moodGrouping';

// Every instant below is built from local calendar components under the
// suite's pinned America/New_York zone (vitest.config.ts), and the clock is
// pinned to one of them, so no label depends on when or where the suite runs.
const NOW = new Date(2026, 8, 25, 12, 0, 0);

function moodAt(id: string, at: Date, overrides: Partial<SupabaseMood> = {}): SupabaseMood {
  return {
    id,
    user_id: 'user-123',
    mood_type: 'happy',
    note: null,
    created_at: at.toISOString(),
    updated_at: null,
    ...overrides,
  };
}

/** The label `groupMoodsByDate` gives one mood logged at `at`. */
function labelFor(at: Date): string {
  return groupMoodsByDate([moodAt('1', at)])[0].dateLabel;
}

describe('groupMoodsByDate', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups moods by date correctly', () => {
    const moods: SupabaseMood[] = [
      moodAt('1', new Date(2026, 8, 25, 9), { note: 'Great day!' }),
      moodAt('2', new Date(2026, 8, 25, 11), { mood_type: 'content' }),
      moodAt('3', new Date(2026, 8, 24, 21), { mood_type: 'thoughtful' }),
    ];

    const groups = groupMoodsByDate(moods);

    expect(groups).toHaveLength(2);
    expect(groups[0].dateLabel).toBe('Today');
    expect(groups[0].moods.map((mood) => mood.id)).toEqual(['1', '2']);
    expect(groups[1].dateLabel).toBe('Yesterday');
    expect(groups[1].moods.map((mood) => mood.id)).toEqual(['3']);
  });

  it('returns "Today" label for current day', () => {
    expect(labelFor(new Date(2026, 8, 25, 9))).toBe('Today');
  });

  it('returns "Yesterday" label for previous day', () => {
    expect(labelFor(new Date(2026, 8, 24, 21))).toBe('Yesterday');
  });

  it('returns formatted date for older entries', () => {
    expect(labelFor(new Date(2026, 8, 22, 12))).toBe('Sep 22');
  });

  describe('across a DST change, labels follow the calendar day', () => {
    it('after the 23-hour spring-forward day', () => {
      vi.setSystemTime(new Date(2026, 2, 9, 0, 30));

      expect(labelFor(new Date(2026, 2, 8, 12))).toBe('Yesterday');
      expect(labelFor(new Date(2026, 2, 7, 12))).toBe('Mar 7');
    });

    it('late on the 25-hour fall-back day', () => {
      vi.setSystemTime(new Date(2026, 10, 1, 23, 30));

      expect(labelFor(new Date(2026, 10, 1, 0, 30))).toBe('Today');
      expect(labelFor(new Date(2026, 9, 31, 12))).toBe('Yesterday');
    });
  });

  it('handles empty mood array', () => {
    const groups = groupMoodsByDate([]);
    expect(groups).toHaveLength(0);
  });

  it('handles multiple moods on the same day', () => {
    const moods: SupabaseMood[] = [
      moodAt('1', new Date(2026, 8, 25, 8), { note: 'Morning' }),
      moodAt('2', new Date(2026, 8, 25, 10), { mood_type: 'content', note: 'Mid-morning' }),
      moodAt('3', new Date(2026, 8, 25, 11, 30), { mood_type: 'grateful', note: 'Late morning' }),
    ];

    const groups = groupMoodsByDate(moods);
    expect(groups).toHaveLength(1);
    expect(groups[0].moods).toHaveLength(3);
  });
});
