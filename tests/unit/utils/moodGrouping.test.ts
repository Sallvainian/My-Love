/**
 * P0 Unit: Mood Grouping Utilities
 *
 * Critical path: Mood history grouping must display correctly.
 * Covers groupMoodsByDate, which buckets moods by local calendar day and
 * labels each bucket. The suite runs under TZ=America/New_York
 * (vitest.config.ts), and the clock is pinned so the labels are fixed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SupabaseMood } from '@/api/validation/supabaseSchemas';
import { groupMoodsByDate } from '@/utils/moodGrouping';

function mood(id: string, created_at: string): SupabaseMood {
  return {
    id,
    user_id: 'user-casey',
    mood_type: 'happy',
    note: null,
    created_at,
    updated_at: null,
  };
}

describe('Mood Grouping', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('[P0] should group moods by date', () => {
    // GIVEN: Moods on 25 Sep (local), just after and just before local
    // midnight, and on 20 Sep — the 04:30Z and 03:59:59Z instants share a
    // UTC date but fall on different New York days
    const m1 = mood('m1', '2026-09-25T14:00:00.000Z');
    const m2 = mood('m2', '2026-09-25T04:30:00.000Z');
    const m3 = mood('m3', '2026-09-25T03:59:59.000Z');
    const m4 = mood('m4', '2026-09-20T16:00:00.000Z');

    // WHEN: Grouped by date
    const groups = groupMoodsByDate([m1, m2, m3, m4]);

    // THEN: One group per local day, in input order, with its label
    expect(groups).toEqual([
      { date: new Date(2026, 8, 25), dateLabel: 'Today', moods: [m1, m2] },
      { date: new Date(2026, 8, 24), dateLabel: 'Yesterday', moods: [m3] },
      { date: new Date(2026, 8, 20), dateLabel: 'Sep 20', moods: [m4] },
    ]);
  });

  it('[P0] should handle empty mood arrays', () => {
    // GIVEN: Empty mood array
    // WHEN: Grouped
    // THEN: Returns no groups
    expect(groupMoodsByDate([])).toEqual([]);
  });
});
