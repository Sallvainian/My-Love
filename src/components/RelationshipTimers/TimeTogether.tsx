/**
 * TimeTogether Component
 *
 * Real-time count-up timer showing how long you've been together.
 * Updates every second for a live feel.
 *
 * Format: "X year(s) Y day(s) Z hour(s) M minute(s) and S second(s) together"
 */

import { useState, useEffect, useCallback } from 'react';
import { m as motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import {
  RELATIONSHIP_DATES,
  calculateTimeDifference,
  type TimeDifference,
} from '../../config/relationshipDates';

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

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border-2 border-pink-300 bg-white p-4 shadow-lg dark:border-pink-600 dark:bg-gray-900"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      data-testid="time-together"
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-pink-100 p-2 dark:bg-pink-900">
          <Heart className="h-5 w-5 fill-current text-pink-500 dark:text-pink-300" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Time Together</h3>
      </div>

      {/* Time Display */}
      <div className="space-y-2 text-center">
        {/* Years and Days */}
        <div className="text-xl font-bold text-pink-500 dark:text-pink-300">
          {timeDiff.years > 0 && <span>{plural(timeDiff.years, 'year')} </span>}
          <span>{plural(timeDiff.days, 'day')}</span>
        </div>

        {/* Hours, Minutes, Seconds */}
        <div className="flex justify-center gap-3 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800 tabular-nums dark:text-white">
              {String(timeDiff.hours).padStart(2, '0')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-300">hours</span>
          </div>
          <span className="self-start text-2xl font-bold text-gray-400 dark:text-gray-500">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800 tabular-nums dark:text-white">
              {String(timeDiff.minutes).padStart(2, '0')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-300">mins</span>
          </div>
          <span className="self-start text-2xl font-bold text-gray-400 dark:text-gray-500">:</span>
          <div className="flex flex-col items-center">
            <span className="animate-pulse text-2xl font-bold text-gray-800 tabular-nums dark:text-white">
              {String(timeDiff.seconds).padStart(2, '0')}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-300">secs</span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-sm font-medium text-pink-500 dark:text-pink-300">...and counting!</p>
      </div>
    </motion.div>
  );
}
