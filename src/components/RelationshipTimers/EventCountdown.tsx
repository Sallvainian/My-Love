/**
 * EventCountdown Component
 *
 * Generic countdown for the wedding date and the couple's stored events.
 * Shows XX:XX:XX placeholder when date is not yet set.
 * Updates every second for real-time countdown display.
 */

import { m as motion } from 'framer-motion';
import { Calendar, Gem, Plane } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { calculateTimeDifference, type TimeDifference } from '../../config/relationshipDates';

type IconType = 'ring' | 'plane' | 'calendar';

interface EventCountdownProps {
  label: string;
  icon: IconType;
  date: Date | null;
  description?: string;
  placeholderText?: string;
  /**
   * Called when this card retires itself because its date has passed (see the
   * `isRetired` block below). A parent whose own upcoming-event filter only
   * recomputes during its render needs this to avoid sitting on a stale count
   * after local midnight; it rides the 1s interval this component already runs,
   * so no dedicated midnight timer is introduced.
   */
  onRetire?: () => void;
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

/**
 * Local-midnight calendar-day difference between today and `date`.
 *
 * Extracted so the Home render's auto-hide filter (CAP-3) reuses this exact
 * comparison instead of re-deriving it — see `integration-points.md` §4.
 *
 * `now` is a parameter so a caller that has already sampled the clock passes
 * that same instant in rather than taking a second reading: two independent
 * `new Date()` calls can straddle a midnight tick, and
 * `computeEventCountdownState` would then derive `isToday` and `calendarDays`
 * from different days.
 */
export function getCalendarDaysDiff(date: Date, now: Date = new Date()): number {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

export type EventsSlotView = 'hidden' | 'empty' | 'list';

/**
 * What Home's events slot should show: nothing until the account's first
 * `loadEvents()` call has settled (avoids an empty-state flash on first
 * paint), the empty-state placeholder once settled with zero upcoming
 * events, or the event list otherwise — including mid-reload, so cards
 * already on screen never blank out during a background refetch.
 *
 * `firstLoadSettled` is deliberately NOT `eventsIsLoading`. That flag
 * initializes `false` (`eventsSlice.ts`) and is only raised once the effect
 * that calls `loadEvents()` runs, which happens after Home's first paint —
 * so keying on it renders the placeholder, then a gap, then the cards on
 * every cold load. The caller tracks "this account's first load has
 * returned" instead, which is the state this decision actually needs.
 */
export function getEventsSlotView(
  rawEventCount: number,
  upcomingEventCount: number,
  firstLoadSettled: boolean
): EventsSlotView {
  if (!firstLoadSettled && rawEventCount === 0) return 'hidden';
  return upcomingEventCount === 0 ? 'empty' : 'list';
}

function computeEventCountdownState(date: Date | null): {
  timeDiff: TimeDifference | null;
  calendarDays: number;
  isEventToday: boolean;
} {
  if (!date) {
    return {
      timeDiff: null,
      calendarDays: 0,
      isEventToday: false,
    };
  }

  const now = new Date();
  const diff = calculateTimeDifference(now, date);
  const daysDiff = getCalendarDaysDiff(date, now);

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  return {
    timeDiff: diff,
    calendarDays: daysDiff,
    isEventToday: isToday,
  };
}

export function EventCountdown({
  label,
  icon,
  date,
  description,
  placeholderText = 'Date TBD',
  onRetire,
}: EventCountdownProps) {
  // One state object from one clock sample. Three separate useState
  // initializers each ran computeEventCountdownState independently, so a mount
  // straddling local midnight could take `isEventToday` from 23:59:59.9 and
  // `calendarDays` from 00:00:00.0 — `true` and `-1` together, which slips past
  // the past-date guard below and prints "Today! 🎉" a day late until the next
  // tick. Sampling once makes that combination unrepresentable.
  const [countdownState, setCountdownState] = useState<{
    timeDiff: TimeDifference | null;
    calendarDays: number;
    isEventToday: boolean;
  }>(() => computeEventCountdownState(date));

  const { timeDiff, calendarDays, isEventToday } = countdownState;

  const updateCountdown = useCallback(() => {
    setCountdownState(computeEventCountdownState(date));
  }, [date]);

  // Update every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  // A date that has already passed renders nothing at all (CAP-3: a past event
  // stops occupying the dashboard). Home's filter cannot enforce this on its
  // own: it runs during App's render, which does not tick, while this
  // component re-renders every second on its own interval. Without this, a card
  // whose day rolls over while Home sits open keeps its shell — icon, label,
  // description — above an empty countdown region until the next reload, since
  // neither the "Today!" nor the `calendarDays >= 0` countdown branch matches.
  const isRetired = date !== null && !isEventToday && calendarDays < 0;

  // Tell the parent, so a slot that filters upcoming events during its own
  // render does not keep counting a card that has already removed itself. This
  // is what lets the events slot fall back to its empty-state placeholder at
  // local midnight instead of showing neither a card nor the placeholder.
  useEffect(() => {
    if (isRetired) onRetire?.();
  }, [isRetired, onRetire]);

  const IconComponent = iconComponents[icon];
  const colors = iconColors[icon];

  // Returning null lets that same interval retire the card at local midnight
  // without a dedicated midnight timer.
  if (isRetired) {
    return null;
  }

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl border-2 p-4 shadow-lg transition-all duration-300 ${
        isEventToday
          ? 'border-green-400 bg-green-50 dark:border-green-500 dark:bg-gray-900'
          : `bg-white dark:bg-gray-900 ${colors.border}`
      }`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      data-testid={`event-countdown-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-2 ${colors.bg}`}>
          <IconComponent className={`h-5 w-5 ${colors.text}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 dark:text-white">{label}</h3>
          {description && <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>}
        </div>
      </div>

      {/* Countdown Display */}
      <div className="py-2 text-center">
        {!date ? (
          // No date set - show placeholder
          <div className="space-y-1">
            <p className="font-mono text-2xl font-bold text-gray-400 dark:text-gray-500">
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
            <p className="text-2xl font-bold text-green-500 dark:text-green-300">Today! 🎉</p>
          </motion.div>
        ) : timeDiff && calendarDays >= 0 ? (
          // Show countdown using calendar days for intuitive display
          <>
            <p className={`text-xl font-bold ${colors.text}`}>
              {calendarDays} {calendarDays === 1 ? 'day' : 'days'}
            </p>
            <div className="mt-2 flex justify-center gap-2 text-sm text-gray-600 dark:text-gray-300">
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
