/**
 * Settings fields -- the values and rules the Profile pages share with the
 * rows that show them: how a date reads (long on a page, short on the Dates
 * list), the earliest and latest birthday, and what makes a birthday or a
 * display name worth saving.
 */

import { parseEventDate } from '../../services/eventsService';

/** A `YYYY-MM-DD` date as a long local date ("May 20, 2000"). */
export function formatDateOnly(value: string): string {
  const date = parseEventDate(value);
  return date ? date.toLocaleDateString(undefined, { dateStyle: 'long' }) : value;
}

/**
 * An ISO instant (a full timestamp, such as a row's `updated_at`) as a long
 * local date ("February 3, 2022"), or `null` when it does not parse. Not for a
 * `YYYY-MM-DD` string: use `formatDateOnly`, since `new Date` reads that as UTC.
 */
export function formatInstantDate(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { dateStyle: 'long' });
}

/** `en-US` date parts by type; `en-US` because `en-GB` prints `Sept`. */
function dateParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', options).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

/**
 * A yearly date (a birthday, an anniversary) as the Dates list shows it, day
 * first and no year: "4 Apr".
 */
export function formatDayMonth(date: Date): string {
  const { day, month } = dateParts(date, { day: 'numeric', month: 'short' });
  return `${day} ${month}`;
}

/**
 * A one-time date (an event, Together since, the wedding) as the Dates list
 * shows it: "Sat 14 Nov" in the current calendar year, "3 Feb 2022" in any
 * other, so a mistyped year shows. `now` is the caller's one clock reading.
 */
export function formatListDate(date: Date, now: Date = new Date()): string {
  if (date.getFullYear() === now.getFullYear()) {
    const { weekday, day, month } = dateParts(date, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${weekday} ${day} ${month}`;
  }
  const { day, month, year } = dateParts(date, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day} ${month} ${year}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The earliest birthday the field accepts: catches a mistyped year such as 0198. */
export const BIRTHDAY_MIN = '1900-01-01';

/** Yesterday as the local `YYYY-MM-DD` a date input takes: the latest birthday. */
export function latestBirthday(): string {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${yesterday.getFullYear()}-${pad2(yesterday.getMonth() + 1)}-${pad2(yesterday.getDate())}`;
}

/** A real `YYYY-MM-DD` that is not before 1900 and is before today. */
export function isValidBirthday(value: string): boolean {
  const parsed = parseEventDate(value);
  if (!parsed || value < BIRTHDAY_MIN) return false;
  const now = new Date();
  return parsed < new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Trimmed, 3 to 30 characters. The account-email and `Unknown` refusals are the service's. */
export function isValidDisplayName(value: string): boolean {
  const length = value.trim().length;
  return length >= 3 && length <= 30;
}
