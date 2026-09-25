import { m as motion } from 'motion/react';
import { memo } from 'react';
import { MOOD_DISPLAY } from '../../constants/moodDisplay';
import type { MoodEntry } from '../../types';
import { normalizeMoodEntry } from '../../types/moods';

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
  const normalized = mood ? normalizeMoodEntry(mood) : null;
  const hasMood = !!normalized;
  const allMoods = normalized?.moods ?? [];
  const primaryMood = normalized?.mood;

  // Visual hierarchy: current day (accent ring) > mood days (tint) > empty days.
  // Colour is by owner (always `you` here), never per mood.
  // Task 10: Added focus indicators for accessibility
  const dayClasses = [
    'aspect-square',
    'rounded-xl',
    'flex',
    'flex-col',
    'items-center',
    'justify-center',
    'relative',
    'transition-colors',
    'duration-200',
    'border-none',
    // Task 10: Focus indicators for keyboard navigation. An outline, not a
    // ring, so focus stays visible on today, which already wears the ring.
    'focus-visible:outline-2',
    'focus-visible:outline-offset-2',
    'focus-visible:outline-accent',
    hasMood ? 'cursor-pointer bg-tint' : '',
    isToday ? 'ring-2 ring-accent ring-inset' : '',
  ].join(' ');

  const PrimaryIcon = primaryMood ? MOOD_DISPLAY[primaryMood].icon : null;

  return (
    <motion.button
      className={dayClasses}
      role="gridcell"
      data-testid={`calendar-day-${dateKey}`}
      data-has-mood={hasMood ? 'true' : 'false'}
      aria-label={
        hasMood
          ? `${monthName} ${dayNumber}, ${year} - ${allMoods.join(', ')} mood. Press enter to view details.`
          : `${monthName} ${dayNumber}, ${year}`
      }
      aria-disabled={!hasMood}
      tabIndex={hasMood ? 0 : -1}
      onClick={() => onClick(normalized ?? undefined)}
      disabled={!hasMood}
      whileHover={hasMood ? { scale: 1.05 } : undefined}
      whileTap={hasMood ? { scale: 0.95 } : undefined}
    >
      {/* Day number */}
      <span className={`text-sm font-medium ${hasMood ? 'text-ink' : 'text-muted'}`}>
        {dayNumber}
      </span>

      {/* Mood indicator - use first mood for icon */}
      {hasMood && PrimaryIcon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring' }}
          className="mt-0.5 text-accent"
        >
          <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
        </motion.div>
      )}
    </motion.button>
  );
});
