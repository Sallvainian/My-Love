import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ScheduleOn } from '@capacitor/local-notifications';
import {
  getNextAnniversaryDate,
  getNextBirthday,
  getUpcomingAge,
  toBirthdayInfo,
} from '../utils/countdownService';
import { formatDateISO } from '../utils/dateUtils';
import { parseEventDate } from './eventsService';
import { routeNotificationTap } from './pushNotifications';

/**
 * Date reminders for the native iOS shell (epic 4).
 *
 * `planDateReminders` is pure: it turns the dates the app shows countdowns to
 * into the local notifications that should be pending, and
 * `scheduleDateReminders` hands that list to the shell. The re-plan that feeds
 * them from the saved local copies, and its triggers (launch, foreground, a
 * date copy written), is `dateRemindersAtLaunch.ts`; this module must not
 * import the store, so later callers (the Settings switch) can share it.
 *
 * Every native reminder call runs in one serial chain (`runSerial`), so a
 * sign-out `cancelDateReminders()` never interleaves with a schedule: a cancel
 * requested while a schedule is in flight runs after it. Every reminder carries
 * thread id `partner-activity`, which stacks it with the non-love-note pushes
 * on the lock screen. A tapped reminder opens Home through the push taps'
 * fan-out (`listenForReminderTaps`).
 *
 * Every date gets a "Tomorrow: ..." reminder and, except an event, a
 * "Today: ..." one, both at 9:00 local time. A date the person marked for the
 * countdown (`marks`, story 4.2) also gets "In a month: ..." (the same day of
 * the previous month, clamped to the last day of a shorter one) and "In a
 * week: ..." (7 days before), at 9:00 too, for the same occurrence as the
 * day-before reminder. `reminderDateEntries` lists the dates a person can mark
 * and the key each is marked under. Each is a dated calendar trigger
 * (`schedule.on` with the year set): the plugin always makes it repeating, but
 * with the year pinned it matches only once. Each occurrence is its own
 * request because a birthday's text names an age and the wedding's text
 * changes once it has passed, so the next launch plans the next occurrence
 * afresh. The trigger carries no time zone,
 * so 9:00 stays 9:00 local when the device changes zone. `schedule.at` would
 * become a relative interval trigger instead, and is not used.
 *
 * Only the soonest `MAX_SCHEDULED_REMINDERS` are scheduled: iOS keeps at most
 * 64 pending local notifications per app and drops the rest.
 *
 * Native calls are gated on `Capacitor.isNativePlatform()` and then
 * `Capacitor.isPluginAvailable()`, as in `pushNotifications.ts`: on the web the
 * plugin reports itself available, and a shell installed before the plugin
 * existed has none. Nothing here asks for notification permission (the push
 * registration owns the prompt); it schedules only once permission is granted.
 */

/** The hour, local time, every reminder fires at. */
export const REMINDER_HOUR = 9;

/** iOS keeps at most this many pending local notifications for an app. */
export const MAX_SCHEDULED_REMINDERS = 64;

/**
 * `threadIdentifier` of every reminder: the lock-screen stack of a partner's
 * mood, photo, poke and kiss. Keep equal to `PARTNER_ACTIVITY_THREAD_ID` in
 * `supabase/functions/send-push/payload.ts`.
 */
export const REMINDER_THREAD_ID = 'partner-activity';

/** One person's birthday; `name` `null` reads as "You" (Home's own card with no name chosen). */
export interface ReminderBirthday {
  name: string | null;
  /** `YYYY-MM-DD`, or `null` when not set. */
  birthday: string | null;
}

/**
 * The keys a date is marked under (`public.countdown_marks.date_key`). An event
 * is `event:<events.id>` and an anniversary `anniversary:<anniversaries.id>`
 * (its copy's `serverId`); the four fixed dates have a key of their own.
 */
export const MARK_KEYS = {
  relationshipStart: 'relationship-start',
  wedding: 'wedding',
  ownBirthday: 'own-birthday',
  partnerBirthday: 'partner-birthday',
  event: (id: string) => `event:${id}`,
  anniversary: (serverId: string) => `anniversary:${serverId}`,
} as const;

/** Every date the planner reads. */
export interface ReminderDates {
  events: { id: string; label: string; date: Date }[];
  /** The person's own anniversaries; `date` is `YYYY-MM-DD`, `serverId` is `anniversaries.id`. */
  anniversaries: { label: string; date: string; serverId?: string }[];
  /** ISO instant, or `null` when not set. */
  relationshipStart: string | null;
  /** `YYYY-MM-DD`, or `null` when not set. */
  weddingDate: string | null;
  ownBirthday: ReminderBirthday | null;
  partnerBirthday: ReminderBirthday | null;
  /** The keys of the dates marked for the month and week reminders. */
  marks: ReadonlySet<string>;
}

export interface PlannedReminder {
  /** The notification title: "In a month: {name}", "In a week: {name}", "Tomorrow: {name}" or "Today: {name}". */
  text: string;
  /** The moment it fires (9:00 local). */
  fireAt: Date;
  /** `fireAt`'s calendar and clock parts, as the plugin's calendar trigger. */
  on: Required<Pick<ScheduleOn, 'year' | 'month' | 'day' | 'hour' | 'minute'>>;
}

/** 9:00 local on `day` shifted by `offsetDays` calendar days. */
function reminderMoment(day: Date, offsetDays: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, REMINDER_HOUR, 0);
}

function addReminder(planned: PlannedReminder[], prefix: string, name: string, fireAt: Date, now: Date) {
  if (fireAt.getTime() <= now.getTime()) return;
  planned.push({
    text: `${prefix}: ${name}`,
    fireAt,
    on: {
      year: fireAt.getFullYear(),
      month: fireAt.getMonth() + 1,
      day: fireAt.getDate(),
      hour: fireAt.getHours(),
      minute: fireAt.getMinutes(),
    },
  });
}

/**
 * 9:00 local on the same day of the month, one month before `day`; the day is
 * clamped to the last day of a shorter month (31 March gives 28 or 29 February).
 */
function monthBefore(day: Date): Date {
  const month = new Date(day.getFullYear(), day.getMonth() - 1, 1, REMINDER_HOUR, 0);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  month.setDate(Math.min(day.getDate(), last));
  return month;
}

/**
 * The day-before reminder for `day`, and the on-the-day one unless `onTheDay`
 * is false. A `marked` date also gets the month-before and week-before ones.
 */
function addDay(
  planned: PlannedReminder[],
  day: Date,
  name: string,
  onTheDay: boolean,
  marked: boolean,
  now: Date
) {
  if (marked) {
    addReminder(planned, 'In a month', name, monthBefore(day), now);
    addReminder(planned, 'In a week', name, reminderMoment(day, -7), now);
  }
  addReminder(planned, 'Tomorrow', name, reminderMoment(day, -1), now);
  if (onTheDay) addReminder(planned, 'Today', name, reminderMoment(day, 0), now);
}

function addBirthday(
  planned: PlannedReminder[],
  birthday: ReminderBirthday | null,
  marked: boolean,
  now: Date
) {
  const info = toBirthdayInfo(birthday?.birthday ?? null);
  if (!birthday || !info) return;
  const age = getUpcomingAge(info, now);
  const name = birthday.name === null ? `You turn ${age}` : `${birthday.name} turns ${age}`;
  addDay(planned, getNextBirthday(info, now), name, true, marked, now);
}

/**
 * The dates a person can mark, each with its key and the name the marks list
 * shows, in the list's order: events in list order, the anniversaries,
 * `Our anniversary`, `Wedding`, `Your birthday`, `{partner}'s birthday`. Only a
 * date that is set and readable is listed, an event dated `now`'s day or
 * earlier is not (an event has no on-the-day reminder, so none of its moments
 * is ahead), and an anniversary with no `serverId` is not (it has no key yet). The names are the Home cards' labels;
 * the relationship start is the exception, since its card ("Together for")
 * does not name a date.
 */
export function reminderDateEntries(
  dates: Omit<ReminderDates, 'marks'>,
  now: Date
): { key: string; name: string }[] {
  const entries: { key: string; name: string }[] = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const event of dates.events) {
    if (Number.isNaN(event.date.getTime()) || event.date.getTime() <= startOfToday.getTime()) continue;
    entries.push({ key: MARK_KEYS.event(event.id), name: event.label });
  }

  for (const anniversary of dates.anniversaries) {
    if (!anniversary.serverId || !parseEventDate(anniversary.date)) continue;
    entries.push({ key: MARK_KEYS.anniversary(anniversary.serverId), name: anniversary.label });
  }

  if (dates.relationshipStart && !Number.isNaN(new Date(dates.relationshipStart).getTime())) {
    entries.push({ key: MARK_KEYS.relationshipStart, name: 'Our anniversary' });
  }

  if (dates.weddingDate && parseEventDate(dates.weddingDate)) {
    entries.push({ key: MARK_KEYS.wedding, name: 'Wedding' });
  }

  if (toBirthdayInfo(dates.ownBirthday?.birthday ?? null)) {
    entries.push({ key: MARK_KEYS.ownBirthday, name: 'Your birthday' });
  }
  if (dates.partnerBirthday && toBirthdayInfo(dates.partnerBirthday.birthday)) {
    entries.push({
      key: MARK_KEYS.partnerBirthday,
      name: `${dates.partnerBirthday.name ?? 'Your partner'}'s birthday`,
    });
  }

  return entries;
}

/**
 * The reminders that should be pending at `now`, soonest first, at most
 * `MAX_SCHEDULED_REMINDERS`. A date that cannot be read is skipped.
 */
export function planDateReminders(dates: ReminderDates, now: Date): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // An event happens once, so it has no on-the-day reminder.
  for (const event of dates.events) {
    if (Number.isNaN(event.date.getTime())) continue;
    addDay(planned, event.date, event.label, false, dates.marks.has(MARK_KEYS.event(event.id)), now);
  }

  for (const anniversary of dates.anniversaries) {
    if (!parseEventDate(anniversary.date)) continue;
    const marked = !!anniversary.serverId && dates.marks.has(MARK_KEYS.anniversary(anniversary.serverId));
    addDay(planned, getNextAnniversaryDate(anniversary.date, now), anniversary.label, true, marked, now);
  }

  // The start recurs on its calendar date in the device's time zone; the start's
  // own date is not an anniversary.
  if (dates.relationshipStart) {
    const start = new Date(dates.relationshipStart);
    if (!Number.isNaN(start.getTime())) {
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const next = getNextAnniversaryDate(formatDateISO(startDay), now);
      if (next.getTime() > startDay.getTime()) {
        addDay(planned, next, 'Our anniversary', true, dates.marks.has(MARK_KEYS.relationshipStart), now);
      }
    }
  }

  const wedding = dates.weddingDate ? parseEventDate(dates.weddingDate) : null;
  if (dates.weddingDate && wedding) {
    const marked = dates.marks.has(MARK_KEYS.wedding);
    if (wedding.getTime() >= startOfToday.getTime()) {
      addDay(planned, wedding, 'Wedding day', true, marked, now);
    } else {
      addDay(planned, getNextAnniversaryDate(dates.weddingDate, now), 'Wedding anniversary', true, marked, now);
    }
  }

  addBirthday(planned, dates.ownBirthday, dates.marks.has(MARK_KEYS.ownBirthday), now);
  addBirthday(planned, dates.partnerBirthday, dates.marks.has(MARK_KEYS.partnerBirthday), now);

  // Array.prototype.sort is stable, so reminders at one moment keep this order.
  planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return planned.slice(0, MAX_SCHEDULED_REMINDERS);
}

/**
 * Whether this shell carries the local-notifications plugin. False on the
 * website, in the Home Screen web app and in a shell installed before the
 * plugin existed.
 */
export function hasNativeReminders(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
}

/** Tail of the serial chain; every native reminder call runs behind it. */
let chain: Promise<void> = Promise.resolve();

/** Runs `task` after every task queued before it has settled. `task` must not throw. */
function runSerial(task: () => Promise<void>): Promise<void> {
  const run = chain.then(task);
  chain = run;
  return run;
}

/**
 * Replaces the shell's pending local notifications with `reminders`: cancels
 * every pending one, then schedules the list if permission is already granted.
 * Never asks for permission (`schedule` would prompt when it is undetermined,
 * hence the check). `isCurrent` is asked before each plugin call so an account
 * switch stops the run. Runs in the serial chain. Failures are logged, never
 * thrown.
 */
export function scheduleDateReminders(
  reminders: PlannedReminder[],
  isCurrent: () => boolean
): Promise<void> {
  return runSerial(async () => {
    try {
      if (!isCurrent()) return;
      const { notifications: pending } = await LocalNotifications.getPending();

      if (pending.length > 0) {
        if (!isCurrent()) return;
        // `cancel` rejects an empty list.
        await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });
      }

      if (!isCurrent()) return;
      const { display } = await LocalNotifications.checkPermissions();
      if (display !== 'granted' || reminders.length === 0) return;

      if (!isCurrent()) return;
      await LocalNotifications.schedule({
        notifications: reminders.map((reminder, index) => ({
          id: index + 1,
          title: reminder.text,
          body: '',
          threadIdentifier: REMINDER_THREAD_ID,
          schedule: { on: reminder.on },
        })),
      });
    } catch (error) {
      console.error('[DateReminders] Could not schedule the date reminders:', error);
    }
  });
}

/**
 * Cancels every date reminder: ids `1..MAX_SCHEDULED_REMINDERS` (ids are
 * positional) plus every id `getPending` reports, because `schedule` resolves
 * before iOS's add completes and the pending list can lag a fresh schedule.
 * Called on sign-out, an account switch and a no-session boot
 * (`deleteAccountData`). Does nothing on the web or in a shell without the
 * plugin. Runs in the serial chain, after any schedule in flight. Never
 * throws.
 */
export function cancelDateReminders(): Promise<void> {
  if (!hasNativeReminders()) return Promise.resolve();
  return runSerial(async () => {
    const ids = new Set<number>();
    for (let id = 1; id <= MAX_SCHEDULED_REMINDERS; id++) ids.add(id);
    try {
      const { notifications: pending } = await LocalNotifications.getPending();
      for (const { id } of pending) ids.add(id);
    } catch (error) {
      console.error('[DateReminders] Could not list the pending date reminders:', error);
    }
    try {
      await LocalNotifications.cancel({ notifications: [...ids].map((id) => ({ id })) });
    } catch (error) {
      console.error('[DateReminders] Could not cancel the date reminders:', error);
    }
  });
}

let tapListening: Promise<void> | null = null;

/**
 * Opens Home when a date reminder is tapped, through the push taps' fan-out
 * (`routeNotificationTap`): a handler subscribed with `onPushTap` hears it,
 * and a tap that arrives before any subscribes (a cold start) is held. The
 * plugin keeps the event until a listener exists. Only `actionId` `'tap'`
 * counts; a dismiss or a custom action does nothing.
 *
 * Adds the listener once per page load; a failed add is tried again by the next
 * call. Does nothing on the web or in a shell without the plugin. Never throws.
 */
export function listenForReminderTaps(): Promise<void> {
  if (!hasNativeReminders()) return Promise.resolve();
  tapListening ??= LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    try {
      if (action.actionId !== 'tap') return;
      routeNotificationTap('home');
    } catch (error) {
      console.error('[DateReminders] Could not route a reminder tap:', error);
    }
  }).then(
    () => {},
    (error: unknown) => {
      // A failed add must not stay cached: the next call tries again.
      tapListening = null;
      console.error('[DateReminders] Could not listen for reminder taps:', error);
    }
  );
  return tapListening;
}
