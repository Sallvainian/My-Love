/**
 * Mood Grouping Utilities
 *
 * Provides utilities for grouping mood entries by date for timeline display.
 * Used by MoodHistoryTimeline component to organize moods with day separators.
 *
 * @module utils/moodGrouping
 */

import type { SupabaseMood } from '../api/validation/supabaseSchemas';

export interface MoodGroup {
  date: Date;
  dateLabel: string;
  moods: SupabaseMood[];
}

/**
 * Group mood entries by date
 *
 * @param moods - Array of mood entries to group
 * @returns Array of mood groups organized by date
 *
 * @example
 * ```typescript
 * const moods = await moodApi.fetchByUser(userId);
 * const groups = groupMoodsByDate(moods);
 * // Returns: [{ date: Date, dateLabel: 'Today', moods: [...] }, ...]
 * ```
 */
export function groupMoodsByDate(moods: SupabaseMood[]): MoodGroup[] {
  const groups = new Map<string, SupabaseMood[]>();

  moods.forEach((mood) => {
    const date = new Date(mood.created_at || '');
    const dateKey = date.toDateString();

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(mood);
  });

  return Array.from(groups.entries()).map(([dateKey, moods]) => ({
    date: new Date(dateKey),
    dateLabel: getDateLabel(new Date(dateKey)),
    moods,
  }));
}

/**
 * Get human-readable date label
 *
 * @param date - Date to format
 * @returns Date label ('Today', 'Yesterday', or formatted date)
 *
 * @example
 * ```typescript
 * getDateLabel(new Date()); // 'Today'
 * // on 15 Nov 2024:
 * getDateLabel(new Date(2024, 10, 14)); // 'Yesterday'
 * getDateLabel(new Date(2024, 10, 10)); // 'Nov 10'
 * ```
 */
function getDateLabel(date: Date): string {
  const now = new Date();
  // Whole calendar days between the two local dates. Elapsed milliseconds
  // divided by 24h mislabels around DST, where a local day is 23 or 25 hours
  // long; the UTC stamps of the local components are always a whole number of
  // days apart.
  const diffDays = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
