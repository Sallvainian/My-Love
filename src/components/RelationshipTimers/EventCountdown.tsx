/**
 * EventCountdown Component
 *
 * Generic countdown for events like wedding or visits.
 * Shows XX:XX:XX placeholder when date is not yet set.
 * Updates every second for real-time countdown display.
 */

import { useState, useEffect, useCallback } from 'react';
import { m as motion } from 'framer-motion';
import { Gem, Plane, Calendar } from 'lucide-react';
import { calculateTimeDifference, type TimeDifference } from '../../config/relationshipDates';

type IconType = 'ring' | 'plane' | 'calendar';

export interface EventCountdownProps {
  label: string;
  icon: IconType;
  date: Date | null;
  description?: string;
  placeholderText?: string;
}

const iconComponents: Record<IconType, typeof Gem> = {
  ring: Gem,
  plane: Plane,
  calendar: Calendar,
};

const iconColors: Record<IconType, { bg: string; text: string; border: string }> = {
  ring: {
    bg: 'bg-amber-100 dark:bg-amber-900',
    text: 'text-amber-500 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-500',
  },
  plane: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-500 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-500',
  },
  calendar: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-500 dark:text-green-300',
    border: 'border-green-300 dark:border-green-500',
  },
};

export function EventCountdown({
  label,
  icon,
  date,
  description,
  placeholderText = 'Date TBD',
}: EventCountdownProps) {
  const [timeDiff, setTimeDiff] = useState<TimeDifference | null>(null);
  const [isEventToday, setIsEventToday] = useState(false);

  // Calculate calendar days (not 24-hour periods) for more intuitive display
  const [calendarDays, setCalendarDays] = useState<number>(0);

  const updateCountdown = useCallback(() => {
    if (!date) {
      setTimeDiff(null);
      setCalendarDays(0);
      return;
    }

    const now = new Date();
    const diff = calculateTimeDifference(now, date);
    setTimeDiff(diff);

    // Calculate calendar days: difference between date portions only
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysDiff = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    setCalendarDays(daysDiff);

    // Check if event is today
    const isToday =
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate();
    setIsEventToday(isToday);
  }, [date]);

  // Initial calculation on mount and when date changes
  useEffect(() => {
    updateCountdown();
  }, [updateCountdown]);

  // Update every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const IconComponent = iconComponents[icon];
  const colors = iconColors[icon];

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl shadow-lg p-4 border-2 transition-all duration-300 ${
        isEventToday
          ? 'bg-green-50 dark:bg-gray-900 border-green-400 dark:border-green-500'
          : `bg-white dark:bg-gray-900 ${colors.border}`
      }`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      data-testid={`event-countdown-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <IconComponent className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 dark:text-white">{label}</h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
          )}
        </div>
      </div>

      {/* Countdown Display */}
      <div className="text-center py-2">
        {!date ? (
          // No date set - show placeholder
          <div className="space-y-1">
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500 font-mono">
              XX:XX:XX
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{placeholderText}</p>
          </div>
        ) : isEventToday ? (
          // Event is today!
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.1, 1] }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-2xl font-bold text-green-500 dark:text-green-300">
              Today! 🎉
            </p>
          </motion.div>
        ) : timeDiff && timeDiff.isPast ? (
          // Event has passed
          <p className="text-lg text-gray-500 dark:text-gray-400">Event passed</p>
        ) : timeDiff ? (
          // Show countdown using calendar days for intuitive display
          <>
            <p className={`text-xl font-bold ${colors.text}`}>
              {calendarDays} {calendarDays === 1 ? 'day' : 'days'}
            </p>
            <div className="flex justify-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-mono">
                {String(timeDiff.hours).padStart(2, '0')}:
                {String(timeDiff.minutes).padStart(2, '0')}:
                {String(timeDiff.seconds).padStart(2, '0')}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
