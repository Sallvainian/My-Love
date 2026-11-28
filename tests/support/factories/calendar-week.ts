/**
 * Seven-date weeks for the streak's fixtures, the one copy the unit fixtures and the
 * browser specs import (DW-565). A streak's `week` is the seven dates ending on the
 * viewer's date; its `calendar_week` is the Sunday-to-Saturday week holding that date, as
 * `get_couple_streak` answers it: a date after the viewer's is `upcoming`, any other
 * takes its own state or `open`.
 *
 * Dates are `YYYY-MM-DD` strings, stepped on the UTC calendar from their own components,
 * so the host's zone never moves a date. Import by this deep path.
 */

/** The seven `YYYY-MM-DD` dates from `first`, oldest first. */
export function sevenDatesFrom(first: string): string[] {
  const [year, month, day] = first.split('-').map(Number);
  return Array.from({ length: 7 }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10)
  );
}

/** The seven `YYYY-MM-DD` dates ending on `last`, oldest first: the dates a `week` holds. */
export function sevenDatesEnding(last: string): string[] {
  const [year, month, day] = last.split('-').map(Number);
  return sevenDatesFrom(new Date(Date.UTC(year, month - 1, day - 6)).toISOString().slice(0, 10));
}

/**
 * The calendar week from `sunday` as the server answers it for a viewer whose date is
 * `today`: a date after `today` is `upcoming`, any other is `stateOf` its date and index
 * (0 Sunday .. 6 Saturday), or `open` when that gives none.
 */
export function calendarWeekFrom<State extends string>(
  sunday: string,
  today: string,
  stateOf: (day: string, index: number) => State | undefined = () => undefined
): { day: string; state: State | 'open' | 'upcoming' }[] {
  return sevenDatesFrom(sunday).map((day, index) => ({
    day,
    state: day > today ? 'upcoming' : (stateOf(day, index) ?? 'open'),
  }));
}
