import { describe, it, expect } from 'vitest';
import { groupMoodsByDate } from '../moodGrouping';
import type { SupabaseMood } from '../../api/validation/supabaseSchemas';

describe('groupMoodsByDate', () => {
  it('groups moods by date correctly', () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    const moods: SupabaseMood[] = [
      {
        id: '1',
        user_id: 'user-123',
        mood_type: 'happy',
        note: 'Great day!',
        created_at: today.toISOString(),
        updated_at: null,
      },
      {
        id: '2',
        user_id: 'user-123',
        mood_type: 'content',
        note: null,
        created_at: today.toISOString(),
        updated_at: null,
      },
      {
        id: '3',
        user_id: 'user-123',
        mood_type: 'thoughtful',
        note: null,
        created_at: yesterday.toISOString(),
        updated_at: null,
      },
    ];

    const groups = groupMoodsByDate(moods);

    expect(groups).toHaveLength(2);
    expect(groups[0].dateLabel).toBe('Today');
    expect(groups[0].moods).toHaveLength(2);
    expect(groups[1].dateLabel).toBe('Yesterday');
    expect(groups[1].moods).toHaveLength(1);
  });

  it('returns "Today" label for current day', () => {
    const moods: SupabaseMood[] = [
      {
        id: '1',
        user_id: 'user-123',
        mood_type: 'happy',
        note: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      },
    ];

    const groups = groupMoodsByDate(moods);
    expect(groups[0].dateLabel).toBe('Today');
  });

  it('returns "Yesterday" label for previous day', () => {
    const yesterday = new Date(Date.now() - 86400000);

    const moods: SupabaseMood[] = [
      {
        id: '1',
        user_id: 'user-123',
        mood_type: 'happy',
        note: null,
        created_at: yesterday.toISOString(),
        updated_at: null,
      },
    ];

    const groups = groupMoodsByDate(moods);
    expect(groups[0].dateLabel).toBe('Yesterday');
  });

  it('returns formatted date for older entries', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

    const moods: SupabaseMood[] = [
      {
        id: '1',
        user_id: 'user-123',
        mood_type: 'happy',
        note: null,
        created_at: threeDaysAgo.toISOString(),
        updated_at: null,
      },
    ];

    const groups = groupMoodsByDate(moods);
    expect(groups[0].dateLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // e.g., "Nov 29"
  });

  it('handles empty mood array', () => {
    const groups = groupMoodsByDate([]);
    expect(groups).toHaveLength(0);
  });

  it('handles multiple moods on the same day', () => {
    const today = new Date();

    const moods: SupabaseMood[] = [
      {
        id: '1',
        user_id: 'user-123',
        mood_type: 'happy',
        note: 'Morning',
        created_at: today.toISOString(),
        updated_at: null,
      },
      {
        id: '2',
        user_id: 'user-123',
        mood_type: 'content',
        note: 'Afternoon',
        created_at: today.toISOString(),
        updated_at: null,
      },
      {
        id: '3',
        user_id: 'user-123',
        mood_type: 'grateful',
        note: 'Evening',
        created_at: today.toISOString(),
        updated_at: null,
      },
    ];

    const groups = groupMoodsByDate(moods);
    expect(groups).toHaveLength(1);
    expect(groups[0].moods).toHaveLength(3);
  });
});
