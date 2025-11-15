import { memo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Smile, Meh, MessageCircle, Sparkles } from 'lucide-react';
import type { MoodEntry, MoodType } from '../../types';

/**
 * Mood icon configuration
 * Story 6.3: Task 9 - Performance optimization with React.memo
 */
const MOOD_CONFIG = {
  loved: { icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-100' },
  happy: { icon: Smile, color: 'text-yellow-500', bgColor: 'bg-yellow-100' },
  content: { icon: Meh, color: 'text-blue-500', bgColor: 'bg-blue-100' },
  thoughtful: { icon: MessageCircle, color: 'text-purple-500', bgColor: 'bg-purple-100' },
  grateful: { icon: Sparkles, color: 'text-green-500', bgColor: 'bg-green-100' },
} as const;

interface CalendarDayProps {
  dateKey: string;
  dayNumber: number;
  isToday: boolean;
  mood: MoodEntry | undefined;
  monthName: string;
  year: number;
  onClick: (mood: MoodEntry | undefined) => void;
}

/**
 * CalendarDay Component (Memoized)
 * Story 6.3: Task 9 - React.memo to prevent unnecessary re-renders
 *
 * Performance optimization:
 * - Only re-renders when props change
 * - Prevents calendar re-rendering all 35-42 cells on every state change
 * - Improves render performance for large calendars
 */
export const CalendarDay = memo<CalendarDayProps>(function CalendarDay({
  dateKey,
  dayNumber,
  isToday,
  mood,
  monthName,
  year,
  onClick,
}) {
  const hasMood = !!mood;

  // Visual hierarchy: current day > mood days > empty days
  // Task 10: Added focus indicators for accessibility
  const dayClasses = [
    'aspect-square',
    'rounded-lg',
    'flex',
    'flex-col',
    'items-center',
    'justify-center',
    'relative',
    'transition-all',
    'duration-200',
    'border-none',
    // Task 10: Focus indicators for keyboard navigation
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-pink-500',
    'focus:ring-offset-2',
    hasMood ? 'cursor-pointer' : '',
    isToday
      ? 'bg-pink-100 border-2 border-pink-500'
      : hasMood
        ? MOOD_CONFIG[mood.mood as MoodType].bgColor
        : 'bg-gray-50 hover:bg-gray-100',
  ].join(' ');

  return (
    <motion.button
      className={dayClasses}
      role="gridcell"
      data-testid={`calendar-day-${dateKey}`}
      data-has-mood={hasMood ? 'true' : 'false'}
      aria-label={
        hasMood
          ? `${monthName} ${dayNumber}, ${year} - ${mood.mood} mood. Press enter to view details.`
          : `${monthName} ${dayNumber}, ${year}`
      }
      aria-disabled={!hasMood}
      tabIndex={hasMood ? 0 : -1}
      onClick={() => onClick(mood)}
      disabled={!hasMood}
      whileHover={hasMood ? { scale: 1.05 } : undefined}
      whileTap={hasMood ? { scale: 0.95 } : undefined}
    >
      {/* Day number */}
      <span className={`text-sm font-medium ${isToday ? 'text-pink-700' : 'text-gray-700'}`}>
        {dayNumber}
      </span>

      {/* Mood indicator */}
      {hasMood && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className={`mt-1 ${MOOD_CONFIG[mood.mood as MoodType].color}`}
        >
          {(() => {
            const Icon = MOOD_CONFIG[mood.mood as MoodType].icon;
            return <Icon className="w-4 h-4" />;
          })()}
        </motion.div>
      )}
    </motion.button>
  );
});
