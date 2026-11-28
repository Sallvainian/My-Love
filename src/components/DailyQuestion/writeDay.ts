/**
 * The date a written question is asked, as the write sheet names it before the
 * send and Daily names it after (DW-494, DW-498).
 */

import { parseEventDate } from '../../services/eventsService';
import { formatDateISO } from '../../utils/dateUtils';

/**
 * The weekday name (`Thursday`) of `targetDay` when it is not the day after
 * `day`; null for tomorrow, a missing target or a date that does not parse.
 */
export function laterWeekday(day: string, targetDay: string | undefined): string | null {
  if (!targetDay) return null;
  const from = parseEventDate(day);
  const target = parseEventDate(targetDay);
  if (!from || !target) return null;
  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return null;
  return target.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * The `YYYY-MM-DD` date the write sheet names: `targetDay`, or the day after
 * `day` when the snapshot has none (one saved before the server sent it); null
 * when `day` does not parse.
 */
export function namedWriteDay(day: string, targetDay: string | undefined): string | null {
  if (targetDay) return targetDay;
  const from = parseEventDate(day);
  if (!from) return null;
  return formatDateISO(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1));
}

/** "{partner} gets it tomorrow." or "{partner} gets it on Saturday." */
export function partnerGetsIt(partnerName: string, day: string, targetDay: string | undefined): string {
  const weekday = laterWeekday(day, targetDay);
  return `${partnerName} gets it ${weekday ? `on ${weekday}` : 'tomorrow'}.`;
}
