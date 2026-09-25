/**
 * Countdown Service
 *
 * Provides utilities for calculating and managing anniversary countdowns
 * with edge case handling for leap years, month boundaries, and timezones.
 */

import type { Anniversary } from '../types';

/**
 * Get next 'n' upcoming anniversaries
 *
 * @param anniversaries - Array of anniversaries
 * @param count - Number of anniversaries to return
 * @returns Array of nearest upcoming anniversaries (max 'count')
 */
export function getUpcomingAnniversaries(
  anniversaries: Anniversary[],
  count: number = 3
): Anniversary[] {
  if (!anniversaries || anniversaries.length === 0) {
    return [];
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Get anniversaries with their next occurrence dates
  const upcomingAnniversaries = anniversaries
    .map((anniversary) => {
      const nextDate = getNextAnniversaryDate(anniversary.date);
      return { anniversary, nextDate };
    })
    .filter(({ nextDate }) => nextDate >= startOfToday)
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, count);

  return upcomingAnniversaries.map(({ anniversary }) => anniversary);
}

/**
 * Calculate next occurrence of an anniversary date
 * Handles leap years and month boundary edge cases
 *
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @returns Next occurrence as Date object
 */
export function getNextAnniversaryDate(dateString: string): Date {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [, month, day] = dateString.split('-').map(Number);

  // Try current year first
  let nextDate = new Date(today.getFullYear(), month - 1, day);

  // Handle invalid dates (e.g., Feb 30, Apr 31)
  if (nextDate.getMonth() !== month - 1) {
    // Date rolled over to next month - use last day of target month
    nextDate = new Date(today.getFullYear(), month, 0);
  }

  // If anniversary has already passed this year, try next year
  if (nextDate < startOfToday) {
    nextDate = new Date(today.getFullYear() + 1, month - 1, day);

    // Handle leap year edge case (Feb 29 in non-leap year)
    if (nextDate.getMonth() !== month - 1) {
      nextDate = new Date(today.getFullYear() + 1, month, 0);
    }
  }

  return nextDate;
}
