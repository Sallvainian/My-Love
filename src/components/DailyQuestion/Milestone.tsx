/**
 * Milestone -- the design's 25-day milestone screen, full screen above the dock
 * and header (z-100, as `StreakUp`). Daily shows it after the +1 when the
 * claim said the streak's milestone count is new to this device.
 *
 * It shows what the server counted (`streak.held`, `streak.milestones`); the
 * only thing worked out here is which four badges to draw (`milestoneBadges`):
 * the block of four 25-day marks that holds the newest milestone, each in
 * colour when reached and grey when not. The big flaming heart flickers and
 * beats unless Reduce Motion is on; the badges never animate. Continue and
 * Close both do the same thing, `onClose`; the milestone was stored as shown
 * by the claim that raised it.
 *
 * The panel and the buttons keep clear of all four safe-area insets, as
 * `StreakUp`: the iPhone Duo's side column holds the dock.
 *
 * @component
 */

import { useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import type { CoupleStreak } from '../../api/dailyQuestionApi';
import { PRIMARY_BUTTON } from '../shared/kitClasses';
import { FlamingHeart } from './FlamingHeart';
import { milestoneBadges } from './milestoneBadges';

const PREFIX = 'daily-milestone';

const PAD =
  'pt-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))]';

export function Milestone({
  streak,
  partnerName,
  onClose,
}: {
  streak: Pick<CoupleStreak, 'held' | 'milestones'>;
  partnerName: string;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { held, milestones } = streak;

  return (
    <div
      className="fixed inset-0 z-100 bg-page"
      role="dialog"
      aria-modal="true"
      aria-label="Milestone reached"
      data-testid={PREFIX}
    >
      {/* The dark fire tint is translucent, so the page colour sits under it. */}
      <div className={`absolute inset-0 overflow-y-auto bg-fire-tint ${PAD}`}>
        <button
          type="button"
          className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] flex h-11 w-11 items-center justify-center rounded-full bg-fire-soft/10 text-fire-soft focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onClose}
          aria-label="Close"
          data-testid={`${PREFIX}-close`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-center justify-center gap-4 pt-12 text-center">
          <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full bg-fire-tint ring-14 ring-card/50">
            <FlamingHeart size={124} animated={!reduceMotion} testId={`${PREFIX}-heart`} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span
              className="font-serif text-[64px] leading-none font-bold text-fire-ink tabular-nums"
              data-testid={`${PREFIX}-held`}
            >
              {held}
            </span>
            <span className="font-serif text-[26px] font-semibold text-fire-soft">
              days answered together
            </span>
          </div>

          <p
            className="max-w-[290px] text-[15px] leading-normal text-fire-soft"
            data-testid={`${PREFIX}-message`}
          >
            You and {partnerName} have answered together on {held} days.
          </p>

          <div className="flex w-full flex-col gap-3 rounded-[20px] bg-card px-3 py-4 shadow-card">
            <span className="text-xs font-semibold tracking-[.08em] text-fire-soft uppercase">
              New badge unlocked
            </span>
            <div className="grid grid-cols-4 gap-2">
              {milestoneBadges(milestones).map(({ days, reached }) => (
                <div
                  key={days}
                  className="flex flex-col items-center gap-1"
                  data-testid={`${PREFIX}-badge-${days}`}
                  data-reached={reached ? 'true' : 'false'}
                >
                  <span
                    className={`flex h-[60px] w-[60px] items-center justify-center rounded-full ${
                      reached ? 'bg-fire-tint ring-3 ring-fire/50' : 'bg-ash-tint'
                    }`}
                  >
                    <FlamingHeart
                      size={44}
                      animated={false}
                      highlights={false}
                      className={reached ? undefined : 'opacity-45 grayscale'}
                    />
                  </span>
                  <span
                    className={`text-[15px] font-bold tabular-nums ${
                      reached ? 'text-fire-ink' : 'text-muted'
                    }`}
                  >
                    {days}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={`${PRIMARY_BUTTON} w-full`}
            onClick={onClose}
            data-testid={`${PREFIX}-continue`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
