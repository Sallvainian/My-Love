/**
 * TimeTogether Component
 *
 * Real-time count-up timer showing how long you've been together.
 * Updates every second for a live feel.
 *
 * Rendered as the shared CountdownCard: "Together for", the years/days as the
 * value, and the padded h/m/s remainder as the trailing figure.
 */

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  RELATIONSHIP_DATES,
  calculateTimeDifference,
  type TimeDifference,
} from '../../config/relationshipDates';
import { CountdownCard } from './CountdownCard';

function computeTimeTogetherState(): TimeDifference {
  const now = new Date();
  return calculateTimeDifference(RELATIONSHIP_DATES.datingStart, now);
}

export function TimeTogether() {
  const [timeDiff, setTimeDiff] = useState<TimeDifference>(() => computeTimeTogetherState());

  const updateTime = useCallback(() => {
    setTimeDiff(computeTimeTogetherState());
  }, []);

  // Update every second for real-time feel
  useEffect(() => {
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  // Pluralize helper
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const pad = (n: number) => String(n).padStart(2, '0');
  const yearsPrefix = timeDiff.years > 0 ? `${plural(timeDiff.years, 'year')} ` : '';
  const value = `${yearsPrefix}${plural(timeDiff.days, 'day')}`;

  return (
    <CountdownCard
      icon={Heart}
      iconFilled
      label="Together for"
      value={value}
      trailing={`${pad(timeDiff.hours)}h ${pad(timeDiff.minutes)}m ${pad(timeDiff.seconds)}s`}
      testId="time-together"
    />
  );
}
