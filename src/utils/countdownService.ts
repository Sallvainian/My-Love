/**
 * Countdown Service
 *
 * Provides utilities for calculating and managing anniversary countdowns
 * with edge case handling for leap years, month boundaries, and timezones.
 */

import { parseEventDate } from '../services/eventsService';
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
 * @param now - The moment to count from (a clock the caller controls; defaults to the current time)
 * @returns Next occurrence as Date object
 */
export function getNextAnniversaryDate(dateString: string, now: Date = new Date()): Date {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [, month, day] = dateString.split('-').map(Number);

  // Try current year first
  let nextDate = new Date(now.getFullYear(), month - 1, day);

  // Handle invalid dates (e.g., Feb 30, Apr 31)
  if (nextDate.getMonth() !== month - 1) {
    // Date rolled over to next month - use last day of target month
    nextDate = new Date(now.getFullYear(), month, 0);
  }

  // If anniversary has already passed this year, try next year
  if (nextDate < startOfToday) {
    nextDate = new Date(now.getFullYear() + 1, month - 1, day);

    // Handle leap year edge case (Feb 29 in non-leap year)
    if (nextDate.getMonth() !== month - 1) {
      nextDate = new Date(now.getFullYear() + 1, month, 0);
    }
  }

  return nextDate;
}

/** A birthday's parts, read from its `YYYY-MM-DD` string. */
export interface BirthdayInfo {
  month: number; // 1-12
  day: number;
  birthYear: number;
}

/** The parts of a `YYYY-MM-DD` birthday, or `null` for an unreadable one. */
export function toBirthdayInfo(birthday: string | null): BirthdayInfo | null {
  if (!birthday) return null;
  const date = parseEventDate(birthday);
  if (!date) return null;
  return { month: date.getMonth() + 1, day: date.getDate(), birthYear: date.getFullYear() };
}

/**
 * Calculate the next occurrence of a birthday
 */
export function getNextBirthday(birthday: BirthdayInfo, now: Date = new Date()): Date {
  const thisYear = now.getFullYear();
  const startOfToday = new Date(thisYear, now.getMonth(), now.getDate());

  // Create date for this year's birthday
  const birthdayThisYear = new Date(thisYear, birthday.month - 1, birthday.day);

  // If birthday has already passed this year, use next year
  if (birthdayThisYear < startOfToday) {
    return new Date(thisYear + 1, birthday.month - 1, birthday.day);
  }

  return birthdayThisYear;
}

/**
 * Calculate the age someone will turn on their next birthday
 */
export function getUpcomingAge(birthday: BirthdayInfo, now: Date = new Date()): number {
  return getNextBirthday(birthday, now).getFullYear() - birthday.birthYear;
}
