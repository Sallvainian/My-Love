import type { Message } from '../types';

/**
 * Get the daily message ID based on the relationship start date
 * Uses deterministic rotation so the same message shows on the same day
 */
export function getDailyMessageId(
  startDate: Date,
  today: Date,
  totalMessages: number
): number {
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceStart % totalMessages;
}

/**
 * Get the daily message for today
 */
export function getTodayMessage(
  messages: Message[],
  startDate: Date,
  favoriteIds: number[] = []
): Message | null {
  if (messages.length === 0) return null;

  // Separate favorites and regular messages
  const favorites = messages.filter(m => favoriteIds.includes(m.id));
  const regular = messages.filter(m => !favoriteIds.includes(m.id));

  // If we have favorites, show them more frequently (every 3 days)
  const today = new Date();
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Every 3rd day, show a favorite (if available)
  if (favorites.length > 0 && daysSinceStart % 3 === 0) {
    const favoriteIndex = Math.floor(daysSinceStart / 3) % favorites.length;
    return favorites[favoriteIndex];
  }

  // Otherwise, rotate through regular messages
  const messageIndex = getDailyMessageId(startDate, today, regular.length || messages.length);
  return regular.length > 0 ? regular[messageIndex] : messages[messageIndex];
}

/**
 * Get message for a specific date (for viewing past/future messages)
 */
export function getMessageForDate(
  messages: Message[],
  startDate: Date,
  targetDate: Date
): Message | null {
  if (messages.length === 0) return null;

  const messageIndex = getDailyMessageId(startDate, targetDate, messages.length);
  return messages[messageIndex];
}

/**
 * Check if a new day has started
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

/**
 * Get the next message (tomorrow's message)
 */
export function getNextMessage(
  messages: Message[],
  startDate: Date
): Message | null {
  if (messages.length === 0) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getMessageForDate(messages, startDate, tomorrow);
}

/**
 * Get the previous message (yesterday's message)
 */
export function getPreviousMessage(
  messages: Message[],
  startDate: Date
): Message | null {
  if (messages.length === 0) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getMessageForDate(messages, startDate, yesterday);
}

/**
 * Calculate which day of the relationship it is
 */
export function getDaysSinceStart(startDate: Date): number {
  const today = new Date();
  return Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format the relationship duration
 */
export function formatRelationshipDuration(startDate: Date): string {
  const days = getDaysSinceStart(startDate);

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
