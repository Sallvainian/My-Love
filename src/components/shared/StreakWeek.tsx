/**
 * StreakWeek -- the couple's last seven dates as `get_couple_streak` answered
 * them, shared by the Partner page's streak card and Daily's week strip.
 *
 * Computes nothing: each entry's `state` is the server's. A done date is a
 * check on fire, a missed one a snowflake on cold and an open one a dashed
 * ring; the last entry is today and reads "Today", the others their narrow
 * weekday letter. The caller picks the test-id prefix (`<prefix>-week` for the
 * grid, `<prefix>-day` for each date) and the label's colour class.
 *
 * `fillDay` names a date whose dot scales and fades in (the +1 screen's newest
 * done date); `reduceMotion` shows it filled with no movement. Without
 * `fillDay` nothing moves, so the Partner card and Daily's strip are unchanged.
 *
 * @component
 */

import { m as motion } from 'motion/react';
import { Check, Snowflake } from 'lucide-react';
import type { CoupleStreak } from '../../api/dailyQuestionApi';
import { parseEventDate } from '../../services/eventsService';

type WeekEntry = CoupleStreak['week'][number];

/** The narrow weekday letter of a `YYYY-MM-DD` date, read as local (never UTC). */
function weekdayLetter(day: string): string {
  const date = parseEventDate(day);
  return date ? date.toLocaleDateString('en-US', { weekday: 'narrow' }) : '';
}

function WeekDot({ state }: { state: WeekEntry['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-fire text-black">
        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === 'missed') {
    return (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-cold text-black">
        <Snowflake className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="h-[26px] w-[26px] rounded-full border-2 border-dashed border-line-strong" />
  );
}

export function StreakWeek({
  week,
  testIdPrefix,
  labelClass,
  fillDay,
  reduceMotion = false,
}: {
  week: CoupleStreak['week'];
  /** `partner-streak` or `daily-streak`. */
  testIdPrefix: string;
  /** Text colour class of the weekday labels. */
  labelClass: string;
  /** A date whose dot fills in with a scale and fade; none by default. */
  fillDay?: string;
  /** Show `fillDay` filled at once, with no movement. */
  reduceMotion?: boolean;
}) {
  const lastIndex = week.length - 1;

  return (
    <div className="grid grid-cols-7 gap-1" data-testid={`${testIdPrefix}-week`}>
      {week.map((entry, index) => {
        const isToday = index === lastIndex;
        return (
          <div
            key={entry.day}
            className="flex flex-col items-center gap-1"
            data-testid={`${testIdPrefix}-day`}
            data-state={entry.state}
          >
            <span className={isToday ? 'rounded-full outline-2 outline-offset-2 outline-ink' : ''}>
              {entry.day === fillDay && !reduceMotion ? (
                <motion.span
                  className="inline-flex"
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.95 }}
                  data-testid={`${testIdPrefix}-day-fill`}
                >
                  <WeekDot state={entry.state} />
                </motion.span>
              ) : (
                <WeekDot state={entry.state} />
              )}
            </span>
            <span className={`text-[11px] font-semibold ${labelClass}`}>
              {isToday ? 'Today' : weekdayLetter(entry.day)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
