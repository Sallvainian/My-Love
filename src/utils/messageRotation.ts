import type { Message, MessageHistory, Settings } from '../types';

/**
 * Format date as YYYY-MM-DD string (deterministic format for hashing)
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Hash a date string to a deterministic number
 * Uses simple character code sum algorithm for consistency
 */
export function hashDateString(dateString: string): number {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    hash = (hash << 5) - hash + dateString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get the daily message for a specific date using deterministic hash algorithm
 * Same date always returns same message (deterministic rotation)
 *
 * @param allMessages - Full message pool
 * @param date - Target date (defaults to today)
 * @returns Message for that date
 */
export function getDailyMessage(allMessages: Message[], date: Date = new Date()): Message {
  if (allMessages.length === 0) {
    throw new Error('Cannot get daily message from empty message pool');
  }

  // Generate deterministic hash from date
  const dateString = formatDate(date);
  const hash = hashDateString(dateString);

  // Calculate message index using modulo
  const messageIndex = hash % allMessages.length;

  // Return message at calculated index
  return allMessages[messageIndex];
}

/**
 * Get message for a specific date (alias for clarity)
 */
export function getMessageForDate(allMessages: Message[], targetDate: Date): Message {
  return getDailyMessage(allMessages, targetDate);
}

/**
 * Get available history days based on configuration and relationship duration
 * Returns minimum of: configured max, days since relationship start, or hard cap
 */
export function getAvailableHistoryDays(
  messageHistory: MessageHistory,
  settings: Settings
): number {
  const relationshipStartDate = new Date(settings.relationship.startDate);
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - relationshipStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Return minimum of: configured max, days since start, or 30 default
  return Math.min(messageHistory.maxHistoryDays || 30, daysSinceStart, 30);
}

/**
 * Check if a new day has started (for legacy compatibility)
 */
export function isNewDay(lastShownDate: string | null): boolean {
  if (!lastShownDate) return true;

  const lastDate = new Date(lastShownDate);
  const today = new Date();

  return (
    lastDate.getDate() !== today.getDate() ||
    lastDate.getMonth() !== today.getMonth() ||
    lastDate.getFullYear() !== today.getFullYear()
  );
}

// Legacy functions kept for backward compatibility (deprecated in Story 3.3)
// These will be removed in future refactoring

/**
 * @deprecated Use getDailyMessage with date parameter instead
 */
export function getDailyMessageId(startDate: Date, today: Date, totalMessages: number): number {
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceStart % totalMessages;
}

/**
 * @deprecated Use getDailyMessage instead
 */
export function getTodayMessage(
  messages: Message[],
  _startDate: Date,
  _favoriteIds: number[] = []
): Message | null {
  if (messages.length === 0) return null;

  // Story 3.3: Remove favorite rotation logic, use pure date-hash algorithm
  const today = new Date();
  return getDailyMessage(messages, today);
}

/**
 * @deprecated Use getDailyMessage with tomorrow's date instead
 */
export function getNextMessage(messages: Message[], _startDate: Date): Message | null {
  if (messages.length === 0) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getDailyMessage(messages, tomorrow);
}

/**
 * @deprecated Use getDailyMessage with yesterday's date instead
 */
export function getPreviousMessage(messages: Message[], _startDate: Date): Message | null {
  if (messages.length === 0) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getDailyMessage(messages, yesterday);
}

/**
 * Calculate which day of the relationship it is
 * @param startDate - Relationship start date
 * @param targetDate - Optional target date (defaults to today)
 */
export function getDaysSinceStart(startDate: Date, targetDate?: Date): number {
  const endDate = targetDate || new Date();
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format the relationship duration
 * @param startDate - Relationship start date
 * @param targetDate - Optional target date (defaults to today)
 */
export function formatRelationshipDuration(startDate: Date, targetDate?: Date): string {
  const days = getDaysSinceStart(startDate, targetDate);

  if (days < 30) {
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} ${years === 1 ? 'year' : 'years'} and ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
    }
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
}
