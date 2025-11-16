/**
 * Calendar Utilities
 * Story 6.3: Mood History Calendar View
 *
 * Pure functions for calendar grid calculations and date manipulation.
 * Used by MoodHistoryCalendar component for month view rendering.
 */

/**
 * Calendar Day Cell
 * Represents a single day in the calendar grid
 */
export interface CalendarDay {
  date: Date | null; // null for empty cells (padding before month start)
  dayNumber: number | null; // 1-31 for actual days, null for empty cells
  isToday: boolean;
  isCurrentMonth: boolean;
}

/**
 * Get number of days in a given month
 * @param year - Full year (e.g., 2025)
 * @param month - Month (0-11, where 0 = January)
 * @returns Number of days in month (28-31)
 *
 * @example
 * getDaysInMonth(2025, 0) // 31 (January)
 * getDaysInMonth(2024, 1) // 29 (February leap year)
 */
export function getDaysInMonth(year: number, month: number): number {
  // Create date for first day of next month, then get day 0 (last day of current month)
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of week for the first day of a month
 * @param year - Full year (e.g., 2025)
 * @param month - Month (0-11, where 0 = January)
 * @returns Day of week (0-6, where 0 = Sunday)
 *
 * @example
 * getFirstDayOfMonth(2025, 10) // Returns day of week for Nov 1, 2025
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Generate calendar grid days for a given month
 * Creates array of 35-42 cells to fill complete calendar grid (5-6 weeks)
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (0-11, where 0 = January)
 * @returns Array of CalendarDay objects (empty cells + month days)
 *
 * Grid Layout:
 * - Row 1: Sun, Mon, Tue, Wed, Thu, Fri, Sat (7 columns)
 * - Rows 2-6: Day cells (5-6 rows for weeks)
 * - Empty cells before first day of month (padding)
 * - Empty cells after last day (if needed to complete grid)
 *
 * @example
 * generateCalendarDays(2025, 10) // November 2025 grid
 * // Returns 35-42 cells with actual days and padding
 */
export function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const days: CalendarDay[] = [];

  // Empty cells before month start (Sunday = 0, so if month starts on Wednesday = 3, need 3 empty cells)
  for (let i = 0; i < firstDay; i++) {
    days.push({
      date: null,
      dayNumber: null,
      isToday: false,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = year === todayYear && month === todayMonth && day === todayDate;

    days.push({
      date,
      dayNumber: day,
      isToday,
      isCurrentMonth: true,
    });
  }

  return days;
}

/**
 * Format date as YYYY-MM-DD (ISO date string)
 * Used for IndexedDB by-date index queries
 *
 * @param date - Date to format
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * formatDateKey(new Date(2025, 10, 15)) // '2025-11-15'
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start and end dates for a calendar month (for getMoodsInRange queries)
 * @param year - Full year
 * @param month - Month (0-11)
 * @returns Object with startOfMonth and endOfMonth Date objects
 *
 * @example
 * getMonthBoundaries(2025, 10)
 * // { startOfMonth: Date(2025-11-01 00:00:00), endOfMonth: Date(2025-11-30 23:59:59) }
 */
export function getMonthBoundaries(
  year: number,
  month: number
): {
  startOfMonth: Date;
  endOfMonth: Date;
} {
  const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0); // First day at midnight
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day at 23:59:59.999
  return { startOfMonth, endOfMonth };
}

/**
 * Format date for modal display
 * @param date - Date to format
 * @returns Formatted string like "Monday, Nov 15, 2025"
 *
 * @example
 * formatModalDate(new Date(2025, 10, 15)) // "Friday, Nov 15, 2025"
 */
export function formatModalDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format timestamp for modal display
 * @param date - Date to format
 * @returns Formatted string like "3:42 PM"
 *
 * @example
 * formatModalTime(new Date(2025, 10, 15, 15, 42)) // "3:42 PM"
 */
export function formatModalTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return date.toLocaleTimeString('en-US', options);
}

/**
 * Get month name from month index
 * @param month - Month (0-11)
 * @returns Month name (e.g., "January", "February")
 *
 * @example
 * getMonthName(0) // "January"
 * getMonthName(10) // "November"
 */
export function getMonthName(month: number): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return monthNames[month];
}

/**
 * Navigate to previous month
 * @param year - Current year
 * @param month - Current month (0-11)
 * @returns New {year, month} after going back one month
 *
 * @example
 * navigateToPreviousMonth(2025, 0) // { year: 2024, month: 11 } (Jan → Dec prev year)
 * navigateToPreviousMonth(2025, 5) // { year: 2025, month: 4 } (Jun → May)
 */
export function navigateToPreviousMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 0) {
    return { year: year - 1, month: 11 }; // January → December of previous year
  }
  return { year, month: month - 1 };
}

/**
 * Navigate to next month
 * @param year - Current year
 * @param month - Current month (0-11)
 * @returns New {year, month} after advancing one month
 *
 * @example
 * navigateToNextMonth(2025, 11) // { year: 2026, month: 0 } (Dec → Jan next year)
 * navigateToNextMonth(2025, 5) // { year: 2025, month: 6 } (Jun → Jul)
 */
export function navigateToNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) {
    return { year: year + 1, month: 0 }; // December → January of next year
  }
  return { year, month: month + 1 };
}
