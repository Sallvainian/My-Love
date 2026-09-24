/**
 * TimeTogether Component
 *
 * Real-time count-up timer showing how long you've been together, from the
 * couple's shared start (`coupleSettings.relationshipStart`, a date and time
 * either partner sets in Settings). Updates every second for a live feel.
 *
 * Rendered as the shared CountdownCard: "Together for", the years/days as the
 * value, and the padded h/m/s remainder as the trailing figure.
 *
 * - Linked, start set: the live counter.
 * - Linked, not set yet: the same card with a "Set your start date in
 *   Settings" placeholder.
 * - Unlinked, or nothing known yet (no saved copy, no server answer): hidden —
 *   a placeholder there could be wrong.
 */

import { Heart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { CountdownCard } from './CountdownCard';

const TEST_ID = 'time-together';

interface TimeDifference {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
}

/**
 * Calculate time difference between two dates
 */
function calculateTimeDifference(from: Date, to: Date): TimeDifference {
  const diff = to.getTime() - from.getTime();
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000) % 60;
  const minutes = Math.floor(absDiff / (1000 * 60)) % 60;
  const hours = Math.floor(absDiff / (1000 * 60 * 60)) % 24;
  const totalDays = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const days = totalDays % 365;

  return {
    years,
    days,
    hours,
    minutes,
    seconds,
    totalMilliseconds: absDiff,
  };
}

export function TimeTogether() {
  const coupleSettings = useAppStore((s) => s.coupleSettings);

  if (!coupleSettings || coupleSettings.status !== 'linked') return null;

  if (!coupleSettings.relationshipStart) {
    return (
      <CountdownCard
        icon={Heart}
        iconFilled
        label="Together for"
        value="Not set yet"
        valueMuted
        description="Set your start date in Settings"
        testId={TEST_ID}
      />
    );
  }

  return <TimeTogetherCounter start={coupleSettings.relationshipStart} />;
}

function TimeTogetherCounter({ start }: { start: string }) {
  const startDate = useMemo(() => new Date(start), [start]);
  const [now, setNow] = useState(() => new Date());

  // Update every second for real-time feel
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeDiff = calculateTimeDifference(startDate, now);

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
      testId={TEST_ID}
    />
  );
}
