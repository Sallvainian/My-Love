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
import {
  type BirthdayInfo,
  calculateTimeDifference,
  getNextBirthday,
  getUpcomingAge,
  type TimeDifference,
} from '../../config/relationshipDates';
import { CountdownCard, type CountdownTone } from './CountdownCard';

interface BirthdayCountdownProps {
  birthday: BirthdayInfo;
  tone?: CountdownTone;
}

function computeBirthdayCountdownState(birthday: BirthdayInfo): {
  timeDiff: TimeDifference;
  upcomingAge: number;
  isBirthdayToday: boolean;
} {
  const nextBirthday = getNextBirthday(birthday);
  const now = new Date();
  const diff = calculateTimeDifference(now, nextBirthday);
  const today = new Date();
  const isToday = today.getMonth() === birthday.month - 1 && today.getDate() === birthday.day;

  return {
    timeDiff: diff,
    upcomingAge: getUpcomingAge(birthday),
    isBirthdayToday: isToday,
  };
}

export function BirthdayCountdown({ birthday, tone = 'you' }: BirthdayCountdownProps) {
  const [timeDiff, setTimeDiff] = useState<TimeDifference>(
    () => computeBirthdayCountdownState(birthday).timeDiff
  );
  const [upcomingAge, setUpcomingAge] = useState<number>(
    () => computeBirthdayCountdownState(birthday).upcomingAge
  );
  const [isBirthdayToday, setIsBirthdayToday] = useState<boolean>(
    () => computeBirthdayCountdownState(birthday).isBirthdayToday
  );

  const updateCountdown = useCallback(() => {
    const nextState = computeBirthdayCountdownState(birthday);
    setTimeDiff(nextState.timeDiff);
    setUpcomingAge(nextState.upcomingAge);
    setIsBirthdayToday(nextState.isBirthdayToday);
  }, [birthday]);

  // Tick every second so the "today" state and day count flip at local midnight
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const totalDays = timeDiff.years * 365 + timeDiff.days;
  const value = isBirthdayToday
    ? 'Happy Birthday!'
    : `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`;

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
