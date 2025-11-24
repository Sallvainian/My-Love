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

export function TimeTogether() {
  const [timeDiff, setTimeDiff] = useState<TimeDifference | null>(null);

  const updateTime = useCallback(() => {
    const now = new Date();
    const diff = calculateTimeDifference(RELATIONSHIP_DATES.datingStart, now);
    setTimeDiff(diff);
  }, []);

  // Initial calculation on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateTime();
  }, []);

  // Update every second for real-time feel
  useEffect(() => {
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  if (!timeDiff) {
    return null;
  }

  // Pluralize helper
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-lg p-4 border-2 border-pink-300 dark:border-pink-600"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      data-testid="time-together"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900">
          <Heart className="w-5 h-5 text-pink-500 dark:text-pink-300 fill-current" />
        </div>
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
          Time Together
        </h3>
      </div>

      {/* Time Display */}
      <div className="text-center space-y-2">
        {/* Years and Days */}
        <div className="text-xl font-bold text-pink-500 dark:text-pink-300">
          {timeDiff.years > 0 && (
            <span>{plural(timeDiff.years, 'year')} </span>
          )}
          <span>{plural(timeDiff.days, 'day')}</span>
        </div>

        {/* Hours, Minutes, Seconds */}
        <div className="flex justify-center gap-3 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800 dark:text-white tabular-nums">
              {String(timeDiff.hours).padStart(2, '0')}
            </span>
            <span className="text-gray-500 dark:text-gray-300 text-xs">hours</span>
          </div>
          <span className="text-2xl font-bold text-gray-400 dark:text-gray-500 self-start">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800 dark:text-white tabular-nums">
              {String(timeDiff.minutes).padStart(2, '0')}
            </span>
            <span className="text-gray-500 dark:text-gray-300 text-xs">mins</span>
          </div>
          <span className="text-2xl font-bold text-gray-400 dark:text-gray-500 self-start">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800 dark:text-white tabular-nums animate-pulse">
              {String(timeDiff.seconds).padStart(2, '0')}
            </span>
            <span className="text-gray-500 dark:text-gray-300 text-xs">secs</span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-pink-500 dark:text-pink-300 font-medium">
          ...and counting!
        </p>
      </div>
    </motion.div>
  );
}
