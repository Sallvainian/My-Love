/**
 * CountdownTimer Component
 *
 * Displays countdown to next upcoming anniversary with celebration animations.
 * Features:
 * - A live h/m/s clock, ticking every second like the other Home countdowns
 * - Celebration animations using Framer Motion when countdown reaches zero
 * - Support for multiple anniversaries (displays next 3)
 * - Responsive mobile-first design
 * - Each anniversary renders the shared CountdownCard (CAP-3)
 */

import { AnimatePresence, m as motion } from 'framer-motion';
import { Calendar, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import type { Anniversary } from '../../types';
import { CountdownCard } from '../RelationshipTimers/CountdownCard';
import {
  formatCountdownClock,
  formatDayCount,
  getCountdownToDay,
  type CountdownParts,
} from '../RelationshipTimers/eventCountdownHelpers';
import {
  getNextAnniversaryDate,
  getUpcomingAnniversaries,
} from '../../utils/countdownService';
import { generateDeterministicNumbers } from '../../utils/deterministicRandom';

interface CountdownTimerProps {
  anniversaries: Anniversary[];
  className?: string;
  maxDisplay?: number;
}

interface AnniversaryWithCountdown {
  anniversary: Anniversary;
  /** Time left until the anniversary's day starts; `null` on the day itself. */
  remaining: CountdownParts | null;
  nextDate: Date;
  shouldCelebrate: boolean;
}

export function CountdownTimer({
  anniversaries,
  className = '',
  maxDisplay = 3,
}: CountdownTimerProps) {
  const [tick, setTick] = useState(0);
  const [celebratingId, setCelebratingId] = useState<number | null>(null);
  const activeCelebrationRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get upcoming anniversaries with their countdowns
  const upcomingAnniversaries = useMemo(
    () => getUpcomingAnniversaries(anniversaries, maxDisplay),
    [anniversaries, maxDisplay]
  );

  const buildCountdowns = useCallback(
    (_tick: number): AnniversaryWithCountdown[] => {
      return upcomingAnniversaries.map((anniversary) => {
        const nextDate = getNextAnniversaryDate(anniversary.date);
        const remaining = getCountdownToDay(nextDate);
        // The day has come exactly when the clock has nothing left to count,
        // so the card flips and the animation starts at midnight, not in the
        // last minute before it.
        const shouldCelebrate = remaining === null;

        return {
          anniversary,
          remaining,
          nextDate,
          shouldCelebrate,
        };
      });
    },
    [upcomingAnniversaries]
  );

  const countdowns = useMemo(() => buildCountdowns(tick), [buildCountdowns, tick]);

  const updateCelebration = useCallback(() => {
    const celebrating = buildCountdowns(Date.now()).find((countdown) => countdown.shouldCelebrate);

    if (celebrating) {
      if (activeCelebrationRef.current !== celebrating.anniversary.id) {
        activeCelebrationRef.current = celebrating.anniversary.id;
        setCelebratingId(celebrating.anniversary.id);

        if (celebrationTimeoutRef.current) {
          clearTimeout(celebrationTimeoutRef.current);
        }

        celebrationTimeoutRef.current = setTimeout(() => {
          setCelebratingId(null);
        }, 3000);
      }
      return;
    }

    activeCelebrationRef.current = null;
  }, [buildCountdowns]);

  // Tick every second so the clock counts down live, as on the other cards
  useEffect(() => {
    const kickoff = setTimeout(() => {
      updateCelebration();
    }, 0);

    const interval = setInterval(() => {
      updateCelebration();
      setTick((current) => current + 1);
    }, 1000);

    return () => {
      clearTimeout(kickoff);
      clearInterval(interval); // Cleanup on unmount
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, [updateCelebration]);

  // No anniversaries to display
  if (countdowns.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="countdown-timer">
      <AnimatePresence mode="wait">
        {countdowns.map((countdown, index) => (
          <motion.div
            key={countdown.anniversary.id}
            data-testid={`countdown-card-${index}`}
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
            }}
          >
            <AnniversaryCard
              countdown={countdown}
              isCelebrating={celebratingId === countdown.anniversary.id}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface AnniversaryCardProps {
  countdown: AnniversaryWithCountdown;
  isCelebrating: boolean;
}

function AnniversaryCard({ countdown, isCelebrating }: AnniversaryCardProps) {
  const { anniversary, remaining } = countdown;
  const celebrating = !remaining;

  return (
    <>
      <CountdownCard
        icon={celebrating ? Sparkles : Calendar}
        highlight={celebrating}
        label={anniversary.label}
        value={celebrating ? 'Today!' : formatDayCount(remaining.days)}
        trailing={celebrating ? undefined : formatCountdownClock(remaining)}
        description={anniversary.description}
      />

      {/* Celebration Animation, over the card and clipped to its corners */}
      <AnimatePresence>{isCelebrating && <CelebrationAnimation />}</AnimatePresence>
    </>
  );
}

/**
 * Celebration animation component
 * Displays floating hearts/confetti when countdown reaches zero
 */
function CelebrationAnimation() {
  const heartCount = ANIMATION_VALUES.FLOATING_HEARTS_COUNT;
  const hearts = Array.from({ length: heartCount }, (_, i) => i);

  // Memoize random X positions for render purity. Regenerates when heartCount
  // changes but stays stable within a session for consistent animation.
  const randomXPositions = useMemo(
    () => generateDeterministicNumbers(`countdown-celebration-${heartCount}`, heartCount, 0, 100),
    [heartCount]
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[20px]"
      data-testid="celebration-animation"
    >
      {hearts.map((i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{
            x: `${randomXPositions[i]}%`,
            y: '100%',
            scale: 0,
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            y: `${ANIMATION_VALUES.FLOATING_HEARTS_TARGET_Y}%`,
            scale: [0, 1, 0.8, 0],
            rotate: [0, 360],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: ANIMATION_VALUES.HEART_ANIMATION_DURATION_SECONDS,
            delay: i * ANIMATION_TIMING.HEART_ANIMATION_DELAY_STEP,
            ease: 'easeOut',
          }}
        >
          <Sparkles className="h-6 w-6 text-accent" />
        </motion.div>
      ))}
    </div>
  );
}
