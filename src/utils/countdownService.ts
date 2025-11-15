/**
 * Countdown Service
 *
 * Provides utilities for calculating and managing anniversary countdowns
 * with edge case handling for leap years, month boundaries, and timezones.
 */

import type { Anniversary } from '../types';

/**
 * Time remaining breakdown
 */
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
}

/**
 * Calculate time remaining until a target date
 * Handles edge cases: leap years, month boundaries, timezone consistency
 *
 * @param targetDate - Future date to count down to
 * @returns Object with days, hours, minutes remaining (rounded down)
 */
export function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  // If target is in the past, return zeros
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes };
}

/**
 * Get the next upcoming anniversary from a list
 * Filters to future dates, sorts by date ascending, returns nearest
 *
 * @param anniversaries - Array of anniversaries
 * @returns Nearest upcoming anniversary or null if none found
 */
export function getNextAnniversary(anniversaries: Anniversary[]): Anniversary | null {
  if (!anniversaries || anniversaries.length === 0) {
    return null;
  }

  const now = new Date();

  // Get anniversaries with their next occurrence dates
  const upcomingAnniversaries = anniversaries
    .map((anniversary) => {
      const nextDate = getNextAnniversaryDate(anniversary.date);
      return { anniversary, nextDate };
    })
    .filter(({ nextDate }) => nextDate > now)
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  return upcomingAnniversaries.length > 0 ? upcomingAnniversaries[0].anniversary : null;
}

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

  const now = new Date();

  // Get anniversaries with their next occurrence dates
  const upcomingAnniversaries = anniversaries
    .map((anniversary) => {
      const nextDate = getNextAnniversaryDate(anniversary.date);
      return { anniversary, nextDate };
    })
    .filter(({ nextDate }) => nextDate > now)
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
  const [, month, day] = dateString.split('-').map(Number);

  // Try current year first
  let nextDate = new Date(today.getFullYear(), month - 1, day);

  // Handle invalid dates (e.g., Feb 30, Apr 31)
  if (nextDate.getMonth() !== month - 1) {
    // Date rolled over to next month - use last day of target month
    nextDate = new Date(today.getFullYear(), month, 0);
  }

  // If anniversary has already passed this year, try next year
  if (nextDate <= today) {
    nextDate = new Date(today.getFullYear() + 1, month - 1, day);

    // Handle leap year edge case (Feb 29 in non-leap year)
    if (nextDate.getMonth() !== month - 1) {
      nextDate = new Date(today.getFullYear() + 1, month, 0);
    }
  }

  return nextDate;
}

/**
 * Check if countdown should trigger celebration animation
 * Returns true when countdown reaches 0 days, 0 hours, 0 minutes
 * Uses 1-minute tolerance to account for update intervals
 *
 * @param targetDate - Anniversary date to check
 * @returns True if celebration should trigger
 */
export function shouldTriggerCelebration(targetDate: Date): boolean {
  const { days, hours, minutes } = calculateTimeRemaining(targetDate);
  return days === 0 && hours === 0 && minutes === 0;
}

/**
 * Check if an anniversary has passed (is in the past)
 *
 * @param anniversaryDate - ISO date string
 * @returns True if anniversary is in the past
 */
export function isAnniversaryPast(anniversaryDate: string): boolean {
  const nextDate = getNextAnniversaryDate(anniversaryDate);
  const today = new Date();

  // Reset time components for date-only comparison
  today.setHours(0, 0, 0, 0);
  nextDate.setHours(0, 0, 0, 0);

  // If the next occurrence is in a future year, the anniversary has already passed this year
  if (nextDate.getFullYear() > today.getFullYear()) {
    return true;
  }

  // If next occurrence is same year, check if it has passed (strictly less than, not equal)
  if (nextDate.getFullYear() === today.getFullYear()) {
    return nextDate < today;
  }

  return false;
}

/**
 * Format countdown for display
 *
 * @param timeRemaining - Time breakdown object
 * @param label - Anniversary label
 * @returns Formatted countdown string
 */
export function formatCountdownDisplay(
  timeRemaining: TimeRemaining,
  label: string
): string {
  const { days, hours, minutes } = timeRemaining;

  if (days === 0 && hours === 0 && minutes === 0) {
    return `Today is ${label}!`;
  }

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  // If all zeros but not celebration time, show "Less than a minute"
  if (parts.length === 0) {
    return `Less than a minute until ${label}`;
  }

  return `${parts.join(', ')} until ${label}`;
}
