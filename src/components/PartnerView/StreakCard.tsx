/**
 * StreakCard -- the couple's streak on the Partner page.
 *
 * Shows what `get_couple_streak` answered and computes nothing: the days held,
 * the run since the last missed day, the last seven dates, and how far the next
 * milestone (every 25 days) is. The card is orange when the viewer's date is
 * done (`today_state` orange), blue when a date was missed since (blue) and
 * grey otherwise. Plain `Flame` for grey and orange, `Snowflake` for blue. The
 * week strip is the shared `StreakWeek`, also used by Daily.
 *
 * @component
 */

import { Flame, Snowflake } from 'lucide-react';
import type { CoupleStreak } from '../../api/dailyQuestionApi';
import { StreakWeek } from '../shared/StreakWeek';

/** Days between milestones (`milestones` is `floor(held / 25)`). */
const MILESTONE_DAYS = 25;

type TodayState = CoupleStreak['today_state'];

/**
 * The classes of each state: card surface, icon tile, big number, secondary
 * text. The glyph on fire and cold is black, not white: white clears neither
 * 3:1 on `fire` (2.80:1) nor the 4.5:1 `whiteOnColorContrast` floor, black
 * clears both in either theme.
 */
const TONE: Record<TodayState, { card: string; tile: string; ink: string; soft: string }> = {
  orange: {
    card: 'bg-fire-tint',
    tile: 'bg-fire text-black',
    ink: 'text-fire-ink',
    soft: 'text-fire-soft',
  },
  blue: {
    card: 'bg-cold-tint',
    tile: 'bg-cold text-black',
    ink: 'text-cold-ink',
    soft: 'text-cold-ink',
  },
  grey: {
    card: 'bg-ash-tint',
    tile: 'bg-card text-ash-ink',
    ink: 'text-ash-ink',
    soft: 'text-ash-ink',
  },
};

export function StreakCard({ streak }: { streak: CoupleStreak }) {
  const tone = TONE[streak.today_state];
  const Icon = streak.today_state === 'blue' ? Snowflake : Flame;
  const nextMilestone = (streak.milestones + 1) * MILESTONE_DAYS;

  return (
    <section
      className={`flex flex-col gap-3.5 rounded-[22px] p-4 ${tone.card}`}
      data-testid="partner-streak-card"
      data-state={streak.today_state}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tone.tile}`}
          data-testid="partner-streak-icon"
        >
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p
            className={`font-serif text-[40px] leading-none font-bold ${tone.ink}`}
            data-testid="partner-streak-held"
          >
            {streak.held}
          </p>
          <p className={`text-sm font-medium ${tone.soft}`}>
            {streak.held === 1 ? 'day' : 'days'} answered together
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p
            className={`text-[22px] leading-none font-bold ${tone.ink}`}
            data-testid="partner-streak-run"
          >
            {streak.run}
          </p>
          <p className={`text-sm font-medium ${tone.soft}`}>in a row</p>
        </div>
      </div>

      <StreakWeek week={streak.week} testIdPrefix="partner-streak" labelClass={tone.soft} />

      <p className={`text-xs font-semibold ${tone.soft}`} data-testid="partner-streak-next">
        Next milestone: {nextMilestone} days · {nextMilestone - streak.held} to go
      </p>
    </section>
  );
}
