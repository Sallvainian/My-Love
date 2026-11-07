/**
 * StreakUp -- the design's "Streak goes up by one" screen, full screen above
 * the dock and header (z-100, as the update toast).
 *
 * Plays once, about 1.5 s, no loop: the ring and the flame go from grey to
 * orange with a bounce, the held total rolls from `held - 1` to `held` with a
 * `+1` badge, and the week strip fills in the newest done date. Under Reduce
 * Motion it renders the end state with plain elements (no `m.*` component):
 * the new held, `+1`, today filled, the message. It shows what the server
 * counted (`streak.held`, `streak.run`); nothing is computed here. The caller
 * has already stored the held total as celebrated, so closing the screen is
 * all `onContinue` does.
 *
 * The panel and the button keep clear of all four safe-area insets, as
 * `DIALOG_SCRIM`: the iPhone Duo's side column holds the dock.
 *
 * @component
 */

import { m as motion, useReducedMotion } from 'motion/react';
import { Flame } from 'lucide-react';
import type { CoupleStreak } from '../../api/dailyQuestionApi';
import { PRIMARY_BUTTON } from '../shared/kitClasses';
import { StreakWeek } from '../shared/StreakWeek';

const PREFIX = 'daily-streak-up';

/** The newest done date of the week strip (oldest first), or undefined. */
function newestDoneDay(week: CoupleStreak['week']): string | undefined {
  for (let index = week.length - 1; index >= 0; index -= 1) {
    if (week[index].state === 'done') return week[index].day;
  }
  return undefined;
}

const FLAME = 'h-14 w-14';
const RING = 'absolute inset-0 flex items-center justify-center rounded-full';

export function StreakUp({
  streak,
  partnerName,
  showReveal,
  onContinue,
}: {
  streak: CoupleStreak;
  /** Used within a sentence: the caller gives "your partner" for a nameless partner. */
  partnerName: string;
  /** Today's snapshot on screen is `both`: the button opens the reveal. */
  showReveal: boolean;
  onContinue: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { held, run } = streak;
  const fillDay = newestDoneDay(streak.week);

  const ring = reduceMotion ? (
    <div className="relative h-28 w-28" data-testid={`${PREFIX}-ring`}>
      <span className={`${RING} bg-fire-tint`}>
        <Flame className={`${FLAME} fill-current text-fire`} aria-hidden="true" />
      </span>
    </div>
  ) : (
    <motion.div
      className="relative h-28 w-28"
      initial={{ scale: 0.85 }}
      animate={{ scale: [0.85, 1.18, 1] }}
      transition={{ duration: 0.6, delay: 0.3, times: [0, 0.55, 1] }}
      data-testid={`${PREFIX}-ring`}
    >
      <span className={`${RING} bg-ash-tint`}>
        <Flame className={`${FLAME} text-ash-ink`} aria-hidden="true" />
      </span>
      <motion.span
        className={`${RING} bg-fire-tint`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Flame className={`${FLAME} fill-current text-fire`} aria-hidden="true" />
      </motion.span>
    </motion.div>
  );

  const number = reduceMotion ? (
    <span className="text-6xl font-bold text-ink tabular-nums" data-testid={`${PREFIX}-held`}>
      {held}
    </span>
  ) : (
    <span className="inline-grid h-[1.2em] overflow-hidden text-6xl leading-[1.2] font-bold text-ink tabular-nums">
      {/* The old number keeps the width and leaves upward; the new one comes up from below. */}
      <motion.span
        className="col-start-1 row-start-1 text-center"
        aria-hidden="true"
        initial={{ y: '0%', opacity: 1 }}
        animate={{ y: '-100%', opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        {held - 1}
      </motion.span>
      <motion.span
        className="col-start-1 row-start-1 text-center"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        data-testid={`${PREFIX}-held`}
      >
        {held}
      </motion.span>
    </span>
  );

  const plusClass =
    'rounded-full bg-fire-tint px-3 py-1 text-base font-bold text-fire-ink tabular-nums';
  const plus = reduceMotion ? (
    <span className={plusClass} data-testid={`${PREFIX}-plus`}>
      +1
    </span>
  ) : (
    <motion.span
      className={plusClass}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.9 }}
      data-testid={`${PREFIX}-plus`}
    >
      +1
    </motion.span>
  );

  const messageBody = (
    <>
      <p className="text-[15px] font-semibold text-ink">You and {partnerName} both answered.</p>
      <p className="text-[15px] text-muted">{run === 1 ? '1 day' : `${run} days`} in a row!</p>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-100 overflow-y-auto bg-page pt-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))]"
      role="dialog"
      aria-modal="true"
      aria-label="Your streak went up by one"
      data-testid={PREFIX}
    >
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-6 text-center">
        {ring}

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            {number}
            {plus}
          </div>
          <p className="text-sm font-semibold text-muted">day streak</p>
        </div>

        <div className="w-full rounded-[20px] bg-card p-4">
          <StreakWeek
            week={streak.week}
            testIdPrefix={PREFIX}
            labelClass="text-muted"
            fillDay={fillDay}
            reduceMotion={reduceMotion ?? false}
          />
        </div>

        {reduceMotion ? (
          <div className="flex flex-col gap-1" data-testid={`${PREFIX}-message`}>
            {messageBody}
          </div>
        ) : (
          <motion.div
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            data-testid={`${PREFIX}-message`}
          >
            {messageBody}
          </motion.div>
        )}

        <button
          type="button"
          className={`${PRIMARY_BUTTON} w-full`}
          onClick={onContinue}
          data-testid={`${PREFIX}-continue`}
        >
          {showReveal ? `See ${partnerName}'s pick` : 'Continue'}
        </button>
      </div>
    </div>
  );
}
