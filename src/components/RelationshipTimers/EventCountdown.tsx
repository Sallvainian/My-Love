/**
 * EventCountdown Component
 *
 * Generic countdown for the wedding date and the couple's stored events.
 * Shows the muted placeholder text as its value when the date is not yet set.
 * The card shows only a day count; its 1s interval exists to flip the
 * today/retire state when local midnight passes.
 *
 * Rendered as the shared CountdownCard in the `you` tone: colour lives only in
 * the tile, which switches to the highlight fill on the day itself.
 */

import { Calendar, Gem, Plane } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CountdownCard } from './CountdownCard';
import { getCalendarDaysDiff } from './eventCountdownHelpers';

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

function computeEventCountdownState(date: Date | null): {
  calendarDays: number;
  isEventToday: boolean;
} {
  if (!date) {
    return {
      calendarDays: 0,
      isEventToday: false,
    };
  }

  const now = new Date();
  const daysDiff = getCalendarDaysDiff(date, now);

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  return {
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
  // the past-date guard below and prints "Today!" a day late until the next
  // tick. Sampling once makes that combination unrepresentable.
  const [countdownState, setCountdownState] = useState<{
    calendarDays: number;
    isEventToday: boolean;
  }>(() => computeEventCountdownState(date));

  const { calendarDays, isEventToday } = countdownState;

  const updateCountdown = useCallback(() => {
    setCountdownState(computeEventCountdownState(date));
  }, [date]);

  // Tick every second so the today/retire state flips at local midnight
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

  // Returning null lets that same interval retire the card at local midnight
  // without a dedicated midnight timer.
  if (isRetired) {
    return null;
  }

  // Not retired, so a dated card is today or ahead: `calendarDays >= 0`.
  const value = !date
    ? placeholderText
    : isEventToday
      ? 'Today!'
      : `${calendarDays} ${calendarDays === 1 ? 'day' : 'days'}`;

  return (
    <CountdownCard
      icon={IconComponent}
      tone="you"
      highlight={isEventToday}
      label={label}
      value={value}
      valueMuted={!date}
      description={description}
      testId={`event-countdown-${label.toLowerCase().replace(/\s+/g, '-')}`}
    />
  );
}
