/**
 * StreakWeek -- the seven dates of the couple's streak row as `get_couple_streak`
 * answered them: the calendar week on the Partner page's streak card and
 * Daily's week strip (through `StreakRow`), the last seven dates on the +1
 * screen.
 *
 * Computes nothing: each entry's `state` is the server's. A done date is a
 * check on fire and a missed one a snowflake on cold. With `today` (the
 * calendar week) every other state, open or upcoming, is the same plain grey
 * circle, each slot reads its narrow weekday letter and only the slot of
 * `today` carries the ring (and `data-today`); nothing reads "Today". Without
 * `today` (the +1 screen) an open date is a dashed ring and the last entry is
 * today, ringed and reading "Today". The caller picks the test-id prefix
 * (`<prefix>-week` for the grid, `<prefix>-day` for each date) and the label's
 * colour class.
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

type WeekState = 'done' | 'missed' | 'open' | 'upcoming';
type WeekEntry = { day: string; state: WeekState };

/** The narrow weekday letter of a `YYYY-MM-DD` date, read as local (never UTC). */
function weekdayLetter(day: string): string {
  const date = parseEventDate(day);
  return date ? date.toLocaleDateString('en-US', { weekday: 'narrow' }) : '';
}

function WeekDot({ state, plain }: { state: WeekState; plain: boolean }) {
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
  if (plain) {
    return (
      <span className="flex h-[26px] w-[26px] rounded-full bg-ash-ink/30" />
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
  today,
  fillDay,
  reduceMotion = false,
}: {
  week: ReadonlyArray<WeekEntry>;
  /** `partner-streak` or `daily-streak`. */
  testIdPrefix: string;
  /** Text colour class of the weekday labels. */
  labelClass: string;
  /**
   * The viewer's date, which turns on the calendar-week look: weekday letters
   * only, the ring on this date's slot alone and a plain grey circle for every
   * state but done and missed. Omitted, the row draws as the +1 screen does.
   */
  today?: string;
  /** A date whose dot fills in with a scale and fade; none by default. */
  fillDay?: string;
  /** Show `fillDay` filled at once, with no movement. */
  reduceMotion?: boolean;
}) {
  const lastIndex = week.length - 1;

  return (
    <div className="grid grid-cols-7 gap-1" data-testid={`${testIdPrefix}-week`}>
      {week.map((entry, index) => {
        const isToday = today === undefined ? index === lastIndex : entry.day === today;
        const plain = today !== undefined;
        return (
          <div
            key={entry.day}
            className="flex flex-col items-center gap-1"
            data-testid={`${testIdPrefix}-day`}
            data-state={entry.state}
            data-today={plain && isToday ? 'true' : undefined}
          >
            <span
              className={`${plain ? 'flex ' : ''}${isToday ? 'rounded-full outline-2 outline-offset-2 outline-ink' : ''}`}
            >
              {entry.day === fillDay && !reduceMotion ? (
                <motion.span
                  className="inline-flex"
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.95 }}
                  data-testid={`${testIdPrefix}-day-fill`}
                >
                  <WeekDot state={entry.state} plain={plain} />
                </motion.span>
              ) : (
                <WeekDot state={entry.state} plain={plain} />
              )}
            </span>
            <span className={`text-[11px] font-semibold ${labelClass}`}>
              {isToday && !plain ? 'Today' : weekdayLetter(entry.day)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The streak's row on Daily and the Partner card: the server's `calendar_week`
 * when the streak has it, else a copy saved before story 11.3's `week` (oldest
 * first, today last). Today is `week`'s last date, the viewer's date the server
 * worked out, never the device clock.
 */
export function StreakRow({
  streak,
  testIdPrefix,
  labelClass,
}: {
  streak: CoupleStreak;
  testIdPrefix: string;
  labelClass: string;
}) {
  return (
    <StreakWeek
      week={streak.calendar_week ?? streak.week}
      today={streak.week[streak.week.length - 1].day}
      testIdPrefix={testIdPrefix}
      labelClass={labelClass}
    />
  );
}
