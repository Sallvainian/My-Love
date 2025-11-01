/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return isSameDay(date, today);
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse ISO date string to Date
 */
export function parseDateISO(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Format date for display (e.g., "January 1, 2024")
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date for short display (e.g., "Jan 1")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get days until a future date
 */
export function getDaysUntil(targetDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diff = targetDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get days since a past date
 */
export function getDaysSince(pastDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  pastDate.setHours(0, 0, 0, 0);

  const diff = today.getTime() - pastDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get the next occurrence of an anniversary
 */
export function getNextAnniversary(anniversaryDate: string): Date {
  const today = new Date();
  const [, month, day] = anniversaryDate.split('-').map(Number);

  let nextDate = new Date(today.getFullYear(), month - 1, day);

  // If the anniversary has passed this year, get next year's
  if (nextDate < today) {
    nextDate = new Date(today.getFullYear() + 1, month - 1, day);
  }

  return nextDate;
}

/**
 * Format countdown text
 */
export function formatCountdown(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return '1 day';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

/**
 * Get day of week name
 */
export function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}
