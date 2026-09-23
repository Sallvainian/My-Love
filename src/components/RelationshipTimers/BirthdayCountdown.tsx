/**
 * BirthdayCountdown Component
 *
 * Countdown to a person's birthday with their upcoming age displayed.
 * The card shows only a day count; its 1s interval exists to flip the
 * "today" state (and the day count) when local midnight passes.
 *
 * Rendered as the shared CountdownCard: "{name} turns {age}" over the day
 * count, or a highlighted tile and "Happy Birthday!" on the day itself.
 * `tone` picks the tile colour pair; birthdays come from static config, so the
 * caller decides which person reads as `partner`.
 */

import { Cake } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type BirthdayInfo, getNextBirthday, getUpcomingAge } from '../../config/relationshipDates';
import { CountdownCard, type CountdownTone } from './CountdownCard';
import { getCalendarDaysDiff } from './eventCountdownHelpers';

interface BirthdayCountdownProps {
  birthday: BirthdayInfo;
  tone?: CountdownTone;
}

function computeBirthdayCountdownState(birthday: BirthdayInfo): {
  calendarDays: number;
  upcomingAge: number;
  isBirthdayToday: boolean;
} {
  // Sample now first: getNextBirthday reads its own clock, and if midnight
  // falls between the two reads at the end of the birthday, isToday still
  // holds instead of the count reading -1 days for one tick.
  const now = new Date();
  const nextBirthday = getNextBirthday(birthday);
  // Calendar days, the same count EventCountdown shows, so a birthday and an
  // event on one date never read a day apart (whole 24h periods drop a day
  // after midnight and across a 23-hour DST day).
  const calendarDays = getCalendarDaysDiff(nextBirthday, now);
  const isToday = now.getMonth() === birthday.month - 1 && now.getDate() === birthday.day;

  return {
    calendarDays,
    upcomingAge: getUpcomingAge(birthday),
    isBirthdayToday: isToday,
  };
}

export function BirthdayCountdown({ birthday, tone = 'you' }: BirthdayCountdownProps) {
  const [calendarDays, setCalendarDays] = useState<number>(
    () => computeBirthdayCountdownState(birthday).calendarDays
  );
  const [upcomingAge, setUpcomingAge] = useState<number>(
    () => computeBirthdayCountdownState(birthday).upcomingAge
  );
  const [isBirthdayToday, setIsBirthdayToday] = useState<boolean>(
    () => computeBirthdayCountdownState(birthday).isBirthdayToday
  );

  const updateCountdown = useCallback(() => {
    const nextState = computeBirthdayCountdownState(birthday);
    setCalendarDays(nextState.calendarDays);
    setUpcomingAge(nextState.upcomingAge);
    setIsBirthdayToday(nextState.isBirthdayToday);
  }, [birthday]);

  // Tick every second so the "today" state and day count flip at local midnight
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const value = isBirthdayToday
    ? 'Happy Birthday!'
    : `${calendarDays} ${calendarDays === 1 ? 'day' : 'days'}`;

  return (
    <CountdownCard
      icon={Cake}
      tone={tone}
      highlight={isBirthdayToday}
      label={`${birthday.name} turns ${upcomingAge}`}
      value={value}
      testId={`birthday-countdown-${birthday.name.toLowerCase()}`}
    />
  );
}
