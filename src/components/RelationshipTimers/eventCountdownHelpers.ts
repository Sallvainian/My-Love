/**
 * Pure helpers behind the Home events slot and EventCountdown's own day math.
 *
 * They live outside `EventCountdown.tsx` so that file exports only its
 * component: `react-refresh/only-export-components` warns on a module that
 * mixes the two, and a mixed module makes Fast Refresh fall back to a full
 * page reload while editing it.
 */

/**
 * Local-midnight calendar-day difference between today and `date`.
 *
 * Extracted so the Home render's auto-hide filter (CAP-3) reuses this exact
 * comparison instead of re-deriving it — see `integration-points.md` §4.
 *
 * `now` is a parameter so a caller that has already sampled the clock passes
 * that same instant in rather than taking a second reading: two independent
 * `new Date()` calls can straddle a midnight tick, and
 * `computeEventCountdownState` would then derive `isToday` and `calendarDays`
 * from different days.
 */
export function getCalendarDaysDiff(date: Date, now: Date = new Date()): number {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

/** Whole days plus the clock remainder, as a countdown card shows them. */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Time from `now` until the local midnight that starts `date`'s day, or `null`
 * once that day has arrived (or passed).
 *
 * Counted in wall-clock time, not elapsed milliseconds, so the day figure is
 * always `getCalendarDaysDiff` minus the part of today already gone: a 23- or
 * 25-hour DST day never shifts the count by a day, and the clock simply reads
 * what a wall clock would.
 */
export function getCountdownToDay(date: Date, now: Date = new Date()): CountdownParts | null {
  const calendarDays = getCalendarDaysDiff(date, now);
  if (calendarDays <= 0) return null;
  const secondsIntoToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const total = calendarDays * 86400 - secondsIntoToday;
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** "3 days" / "1 day" / "0 days". */
export function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** The padded clock remainder, "05h 03m 09s", the same shape Together for shows. */
export function formatCountdownClock({ hours, minutes, seconds }: CountdownParts): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export type EventsSlotView = 'hidden' | 'empty' | 'list' | 'error';

/**
 * What Home's events slot should show: nothing until the account's first
 * `loadEvents()` call has settled (avoids an empty-state flash on first
 * paint), the empty-state placeholder once settled with zero upcoming
 * events, a truthful failure notice when that settle was a FAILED load with
 * nothing to show, or the event list otherwise — including mid-reload, so
 * cards already on screen never blank out during a background refetch.
 *
 * `firstLoadSettled` is deliberately NOT `eventsIsLoading`. That flag
 * initializes `false` (`eventsSlice.ts`) and is only raised once the effect
 * that calls `loadEvents()` runs, which happens after Home's first paint —
 * so keying on it renders the placeholder, then a gap, then the cards on
 * every cold load. The caller tracks "this account's first load has
 * returned" instead, which is the state this decision actually needs.
 */
export function getEventsSlotView(
  rawEventCount: number,
  upcomingEventCount: number,
  firstLoadSettled: boolean,
  lastLoadFailed: boolean
): EventsSlotView {
  if (!firstLoadSettled && rawEventCount === 0) return 'hidden';
  if (upcomingEventCount > 0) return 'list';
  // Zero cards to show: only claim "No upcoming events yet." if a load
  // actually observed that. The caller records the invocation's returned
  // success/failure outcome and ignores `stale`, so it can distinguish
  // "loaded nothing" from "could not load" without consulting shared state.
  // When last-good cards exist the list already wins above: stale-but-real
  // cards beat an error banner.
  return lastLoadFailed ? 'error' : 'empty';
}

/**
 * Which events Home's column shows, and how many are eligible.
 *
 * Two answers rather than one, because they feed different decisions and must
 * not be the same number: `visible` is the capped list that renders, while
 * `upcomingCount` is the UNCAPPED eligible count that `getEventsSlotView`
 * needs. Passing the capped length there would be harmless today but would
 * make "more events than fit" indistinguishable from "exactly the cap", and
 * any future rule keyed on that count would silently read the wrong one.
 *
 * The cap is applied AFTER the filter, so it is always the soonest `maxCards`
 * events that are eligible *right now*. That is what makes the hidden tail
 * transient: when the soonest card retires at local midnight and the caller
 * re-runs this with a later `now`, the retired event leaves the filter and the
 * next one moves into the freed slot without a reload.
 *
 * Generic over the element so this stays a leaf: it never imports the events
 * service's `CoupleEvent`, it only requires a real `Date`.
 *
 * @param events - The store's events, already soonest-first
 * @param now - One clock reading for the whole pass, for the same reason
 *   `getCalendarDaysDiff` takes it: two readings can straddle a midnight tick
 * @param maxCards - How many cards the column renders
 */
export function getUpcomingEventCards<T extends { date: Date }>(
  events: T[],
  now: Date,
  maxCards: number
): { upcomingCount: number; visible: T[] } {
  const upcoming = events.filter((event) => getCalendarDaysDiff(event.date, now) >= 0);
  return { upcomingCount: upcoming.length, visible: upcoming.slice(0, maxCards) };
}
