/**
 * Date Formatting Utilities
 *
 * Provides friendly date and time formatting for chat messages.
 * Uses Intl.DateTimeFormat for locale support.
 *
 * Story 2.1: AC-2.1.2 - Timestamp formatting
 */

/**
 * Format a timestamp for chat message display
 *
 * Rules:
 * - Today: "2:45 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Monday"
 * - Older: "Nov 20"
 *
 * @param dateInput - ISO string or Date object
 * @returns Formatted string for display
 *
 * @example
 * formatMessageTimestamp('2025-11-30T14:45:00Z') // "2:45 PM" (if today)
 * formatMessageTimestamp('2025-11-29T10:30:00Z') // "Yesterday" (if yesterday)
 */
export function formatMessageTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();

  // Normalize to start of day for date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Today: Show time only
  if (diffDays === 0) {
    return formatTime(date);
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // This week (2-6 days ago): Show day name
  if (diffDays >= 2 && diffDays <= 6) {
    return formatDayName(date);
  }

  // Older: Show date
  return formatShortDate(date);
}

/**
 * Format time in 12-hour format with AM/PM
 *
 * @param date - Date object
 * @returns Time string like "2:45 PM"
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Format day name (e.g., "Monday")
 *
 * @param date - Date object
 * @returns Day name string
 */
export function formatDayName(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(date);
}

/**
 * Format short date (e.g., "Nov 20")
 *
 * @param date - Date object
 * @returns Short date string
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format full timestamp with date and time
 * Useful for accessibility / screen readers
 *
 * @param dateInput - ISO string or Date object
 * @returns Full datetime string like "November 30, 2025 at 2:45 PM"
 */
export function formatFullTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
