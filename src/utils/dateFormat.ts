/**
 * Date formatting utilities for relative time display
 */

/**
 * Convert a timestamp to relative time display (e.g., "2h ago", "Yesterday")
 * @param timestamp - ISO timestamp string
 * @returns Formatted relative time string
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

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(past);
}

/**
 * Check if a timestamp is within the last 5 minutes
 * Used to display "Just now" badge for recent updates
 * @param timestamp - ISO timestamp string
 * @returns true if timestamp is < 5 minutes old
 */
export function isJustNow(timestamp: string): boolean {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  return diffMs < 5 * 60 * 1000; // < 5 minutes
}
