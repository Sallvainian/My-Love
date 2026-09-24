/**
 * BirthdayCountdown Component
 *
 * Countdown to one person's birthday with their upcoming age displayed. The
 * birthday is server-held (`public.users.birthday`, a `YYYY-MM-DD` date each
 * person sets for themselves in Settings) and reaches this card through the
 * `profile` or `partner` local copy, so it also shows offline.
 *
 * An upcoming birthday shows the whole days left and a live h/m/s clock to the
 * local midnight that starts it; the 1s interval drives that clock and flips
 * the "today" state when local midnight passes.
 *
 * Rendered as the shared CountdownCard:
 * - set: "{name} turns {age}" over the day count ("You turn {age}" with no
 *   name), or a highlighted tile and "Happy Birthday!" on the day itself;
 * - not set: "{name}'s birthday" ("Your birthday") over a muted "Not set yet",
 *   plus `unsetDescription` when the caller gives one.
 *
 * A 29 February birthday counts down to 1 March in non-leap years, because
 * `Date` rolls that date over.
 */

import { Cake } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseEventDate } from '../../services/eventsService';
import { CountdownCard, type CountdownTone } from './CountdownCard';
import {
  formatCountdownClock,
  formatDayCount,
  getCalendarDaysDiff,
  getCountdownToDay,
  type CountdownParts,
} from './eventCountdownHelpers';

/** A birthday's parts, read from its `YYYY-MM-DD` string. */
interface BirthdayInfo {
  month: number; // 1-12
  day: number;
  birthYear: number;
}

interface BirthdayCountdownProps {
  /** The person's display name; `null` reads as "You" (your own card, no name chosen). */
  name: string | null;
  /** `YYYY-MM-DD`, or `null` when not set. */
  birthday: string | null;
  tone?: CountdownTone;
  /** Shown under "Not set yet" when the birthday is not set. */
  unsetDescription?: string;
  testId: string;
}

/** The parts of a `YYYY-MM-DD` birthday, or `null` for an unreadable one. */
function toBirthdayInfo(birthday: string | null): BirthdayInfo | null {
  if (!birthday) return null;
  const date = parseEventDate(birthday);
  if (!date) return null;
  return { month: date.getMonth() + 1, day: date.getDate(), birthYear: date.getFullYear() };
}

/**
 * Calculate the next occurrence of a birthday
 */
function getNextBirthday(birthday: BirthdayInfo, now: Date = new Date()): Date {
  const thisYear = now.getFullYear();
  const startOfToday = new Date(thisYear, now.getMonth(), now.getDate());

  // Create date for this year's birthday
  const birthdayThisYear = new Date(thisYear, birthday.month - 1, birthday.day);

  // If birthday has already passed this year, use next year
  if (birthdayThisYear < startOfToday) {
    return new Date(thisYear + 1, birthday.month - 1, birthday.day);
  }

  return birthdayThisYear;
}

/**
 * Calculate the age someone will turn on their next birthday
 */
function getUpcomingAge(birthday: BirthdayInfo, now: Date = new Date()): number {
  return getNextBirthday(birthday, now).getFullYear() - birthday.birthYear;
}

function computeBirthdayCountdownState(birthday: BirthdayInfo): {
  upcomingAge: number;
  isBirthdayToday: boolean;
  /** Time left until the birthday starts; `null` on the day itself. */
  remaining: CountdownParts | null;
} {
  // One clock sample for every figure, so a tick straddling midnight cannot
  // mix "today" from one side with the day count from the other.
  const now = new Date();
  const nextBirthday = getNextBirthday(birthday, now);
  // The same wall-clock countdown EventCountdown shows, so a birthday and an
  // event on one date never read apart (whole 24h periods would drift by an
  // hour across a DST day).
  const calendarDays = getCalendarDaysDiff(nextBirthday, now);

  return {
    upcomingAge: getUpcomingAge(birthday, now),
    // The next occurrence is never before today, so 0 days is today itself.
    isBirthdayToday: calendarDays === 0,
    remaining: getCountdownToDay(nextBirthday, now),
  };
}

export function BirthdayCountdown({
  name,
  birthday,
  tone = 'you',
  unsetDescription,
  testId,
}: BirthdayCountdownProps) {
  const info = useMemo(() => toBirthdayInfo(birthday), [birthday]);

  if (!info) {
    return (
      <CountdownCard
        icon={Cake}
        tone={tone}
        label={name === null ? 'Your birthday' : `${name}'s birthday`}
        value="Not set yet"
        valueMuted
        description={unsetDescription}
        testId={testId}
      />
    );
  }

  // Keyed on the date, so a changed birthday remounts with fresh state.
  return (
    <BirthdayCountdownCounter key={birthday} name={name} info={info} tone={tone} testId={testId} />
  );
}

function BirthdayCountdownCounter({
  name,
  info,
  tone,
  testId,
}: {
  name: string | null;
  info: BirthdayInfo;
  tone: CountdownTone;
  testId: string;
}) {
  const [state, setState] = useState(() => computeBirthdayCountdownState(info));

  const updateCountdown = useCallback(() => {
    setState(computeBirthdayCountdownState(info));
  }, [info]);

  // Tick every second: the clock, and the "today" flip at local midnight
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const { upcomingAge, isBirthdayToday, remaining } = state;
  const value = isBirthdayToday || !remaining ? 'Happy Birthday!' : formatDayCount(remaining.days);

  return (
    <CountdownCard
      icon={Cake}
      tone={tone}
      highlight={isBirthdayToday}
      label={name === null ? `You turn ${upcomingAge}` : `${name} turns ${upcomingAge}`}
      value={value}
      trailing={remaining && !isBirthdayToday ? formatCountdownClock(remaining) : undefined}
      testId={testId}
    />
  );
}
