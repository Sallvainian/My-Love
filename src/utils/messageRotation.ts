import type { Message, MessageHistory } from '../types';
import { formatDateISO } from './dateUtils';

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
  const dateString = formatDateISO(date);
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
 * How many past days of daily messages can be browsed: the configured maximum
 * (capped at 30), and never further back than the couple's relationship start.
 *
 * `relationshipStart` is the couple's shared start (`coupleSettings`, an ISO
 * timestamp from `public.couple_settings.relationship_start`). `null` — no
 * partner, not set yet, or not loaded — and an unreadable value leave only the
 * cap. The rotation itself (`getDailyMessage`) hashes the calendar date and
 * never reads the start date.
 */
export function getAvailableHistoryDays(
  messageHistory: MessageHistory,
  relationshipStart: string | null
): number {
  const configuredMax = Math.min(messageHistory.maxHistoryDays || 30, 30);
  if (!relationshipStart) return configuredMax;
  const start = new Date(relationshipStart);
  if (Number.isNaN(start.getTime())) return configuredMax;

  const daysSinceStart = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  // A start still in the future bounds history at today.
  return Math.max(0, Math.min(configuredMax, daysSinceStart));
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
