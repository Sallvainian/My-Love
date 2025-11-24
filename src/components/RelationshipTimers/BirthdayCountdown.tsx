/**
 * BirthdayCountdown Component
 *
 * Countdown to a person's birthday with their upcoming age displayed.
 * Updates every second for real-time countdown display.
 */

import { useState, useEffect, useCallback } from 'react';
import { m as motion } from 'framer-motion';
import { Cake } from 'lucide-react';
import {
  type BirthdayInfo,
  getNextBirthday,
  getUpcomingAge,
  calculateTimeDifference,
  type TimeDifference,
} from '../../config/relationshipDates';

export interface BirthdayCountdownProps {
  birthday: BirthdayInfo;
}

export function BirthdayCountdown({ birthday }: BirthdayCountdownProps) {
  const [timeDiff, setTimeDiff] = useState<TimeDifference | null>(null);
  const [upcomingAge, setUpcomingAge] = useState<number>(0);
  const [isBirthdayToday, setIsBirthdayToday] = useState(false);

  const updateCountdown = useCallback(() => {
    const nextBirthday = getNextBirthday(birthday);
    const now = new Date();
    const diff = calculateTimeDifference(now, nextBirthday);

    setTimeDiff(diff);
    setUpcomingAge(getUpcomingAge(birthday));

    // Check if birthday is today (within 24 hours and it's the actual day)
    const today = new Date();
    const isToday =
      today.getMonth() === birthday.month - 1 && today.getDate() === birthday.day;
    setIsBirthdayToday(isToday);
  }, [birthday]);

  // Initial calculation on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateCountdown();
  }, []);

  // Update every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  if (!timeDiff) {
    return null;
  }

  const totalDays = timeDiff.years * 365 + timeDiff.days;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl shadow-lg p-4 border-2 transition-all duration-300 ${
        isBirthdayToday
          ? 'bg-yellow-50 dark:bg-gray-900 border-yellow-400 dark:border-yellow-500'
          : 'bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-500'
      }`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      data-testid={`birthday-countdown-${birthday.name.toLowerCase()}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`p-2 rounded-lg ${
            isBirthdayToday
              ? 'bg-yellow-100 dark:bg-yellow-900'
              : 'bg-purple-100 dark:bg-purple-900'
          }`}
        >
          <Cake
            className={`w-5 h-5 ${
              isBirthdayToday
                ? 'text-yellow-500 dark:text-yellow-300'
                : 'text-purple-500 dark:text-purple-300'
            }`}
          />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 dark:text-white">
            {birthday.name}'s Birthday
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Turning <span className="font-bold">{upcomingAge}</span>
          </p>
        </div>
      </div>

      {/* Countdown Display */}
      <div className="text-center py-2">
        {isBirthdayToday ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.1, 1] }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-2xl font-bold text-yellow-500 dark:text-yellow-300">
              Happy Birthday! 🎉
            </p>
          </motion.div>
        ) : (
          <>
            <p className="text-xl font-bold text-purple-500 dark:text-purple-300">
              {totalDays} {totalDays === 1 ? 'day' : 'days'}
            </p>
            <div className="flex justify-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-mono">
                {String(timeDiff.hours).padStart(2, '0')}:
                {String(timeDiff.minutes).padStart(2, '0')}:
                {String(timeDiff.seconds).padStart(2, '0')}
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
