/**
 * Consolidated Date Utilities
 *
 * Provides all date formatting, comparison, and calculation functions
 * used across the application.
 */

// ─── Constants ───────────────────────────────────────────────────────

const JUST_NOW_THRESHOLD_MS = 5 * 60 * 1000;

// ─── Relative Time ───────────────────────────────────────────────────

/**
 * Convert a timestamp to relative time display (e.g., "2h ago", "Yesterday")
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';

  return formatShortDate(past);
}

/**
 * Check if a timestamp is within the "just now" threshold (5 minutes)
 */
export function isJustNow(timestamp: string): boolean {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  return diffMs < JUST_NOW_THRESHOLD_MS;
}

// ─── Chat / Message Formatting ───────────────────────────────────────

/**
 * Format a timestamp for chat message display
 *
 * Rules:
 * - Today: "2:45 PM"
 * - Yesterday: "Yesterday"
 * - This week: "Monday"
 * - Older: "Nov 20"
 */
export function formatMessageTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 6) return formatDayName(date);
  return formatShortDate(date);
}

/**
 * Format time in 12-hour format with AM/PM (e.g., "2:45 PM")
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Format day name (e.g., "Monday")
 */
function formatDayName(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(date);
}

/**
 * Format short date (e.g., "Nov 20")
 */
function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format full timestamp with date and time (e.g., "November 30, 2025 at 2:45 PM")
 * Useful for accessibility / screen readers
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

// ─── Date Formatting ─────────────────────────────────────────────────

/**
 * Format date as YYYY-MM-DD using local timezone
 *
 * Uses local date components (not UTC) so the formatted date always
 * matches the user's wall-clock date. The old implementation used
 * `toISOString().split('T')[0]` which is UTC-based — at 11 PM EST
 * that returns tomorrow's date, causing the wrong daily message.
 *
 * Output is persisted as cache keys in `messageHistory.shownMessages`
 * (localStorage). A key mismatch from the format change is harmless:
 * cache miss → deterministic recalculation via `getDailyMessage()`.
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date for long display (e.g., "January 1, 2024")
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Relative Date (calendar-day) ────────────────────────────────────

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Format an ISO date string as a human-readable relative date
 * using calendar-day boundaries (via getDaysSince), not wall-clock seconds.
 *
 * Examples: "today", "yesterday", "3 days ago", "2 months ago", "1 year ago"
 */
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const days = getDaysSince(date);

  if (days === 0) return relativeFormatter.format(0, 'day'); // "today"
  if (days < 30) return relativeFormatter.format(-days, 'day');
  if (days < 365) {
    const months = Math.floor(days / 30);
    return relativeFormatter.format(-months, 'month');
  }
  const years = Math.floor(days / 365);
  return relativeFormatter.format(-years, 'year');
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Get days since a past date
 */
function getDaysSince(pastDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = new Date(pastDate);
  past.setHours(0, 0, 0, 0);

  const diff = today.getTime() - past.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

