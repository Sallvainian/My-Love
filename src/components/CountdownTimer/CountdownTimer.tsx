/**
 * CountdownTimer Component
 *
 * Displays countdown to next upcoming anniversary with celebration animations.
 * Features:
 * - 1-minute update intervals for battery optimization
 * - Celebration animations using Framer Motion when countdown reaches zero
 * - Support for multiple anniversaries (displays next 3)
 * - Responsive mobile-first design
 */

import { m as motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import type { Anniversary } from '../../types';
import {
  calculateTimeRemaining,
  getUpcomingAnniversaries,
  getNextAnniversaryDate,
  shouldTriggerCelebration,
  formatCountdownDisplay,
  type TimeRemaining,
} from '../../utils/countdownService';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import { generateDeterministicNumbers } from '../../utils/deterministicRandom';

export interface CountdownTimerProps {
  anniversaries: Anniversary[];
  className?: string;
  maxDisplay?: number;
}

interface AnniversaryWithCountdown {
  anniversary: Anniversary;
  timeRemaining: TimeRemaining;
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

  const buildCountdowns = useCallback((_tick: number): AnniversaryWithCountdown[] => {
    return upcomingAnniversaries.map((anniversary) => {
      const nextDate = getNextAnniversaryDate(anniversary.date);
      const timeRemaining = calculateTimeRemaining(nextDate);
      const shouldCelebrate = shouldTriggerCelebration(nextDate);

      return {
        anniversary,
        timeRemaining,
        nextDate,
        shouldCelebrate,
      };
    });
  }, [upcomingAnniversaries]);

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

  // Update countdowns every 1 minute (60000ms) - Story requirement
  useEffect(() => {
    const kickoff = setTimeout(() => {
      updateCelebration();
    }, 0);

    const interval = setInterval(() => {
      updateCelebration();
      setTick((current) => current + 1);
    }, 60000); // 1 minute interval for battery optimization

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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
            }}
          >
            <CountdownCard
              countdown={countdown}
              isCelebrating={celebratingId === countdown.anniversary.id}
              isPrimary={index === 0}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CountdownCardProps {
  countdown: AnniversaryWithCountdown;
  isCelebrating: boolean;
  isPrimary: boolean;
}

function CountdownCard({ countdown, isCelebrating, isPrimary }: CountdownCardProps) {
  const { anniversary, timeRemaining, shouldCelebrate } = countdown;
  const displayText = formatCountdownDisplay(timeRemaining, anniversary.label);

  return (
    <motion.div
      className={`
        relative overflow-hidden
        rounded-2xl
        bg-white/80 dark:bg-gray-800/80
        backdrop-blur-sm
        shadow-lg
        p-4 sm:p-6
        border-2 border-transparent
        transition-all duration-300
        ${isPrimary ? 'border-pink-200 dark:border-pink-800' : ''}
        ${isCelebrating ? 'border-pink-400 dark:border-pink-600' : ''}
      `}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Celebration Animation */}
      <AnimatePresence>{isCelebrating && <CelebrationAnimation />}</AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`
          p-2 rounded-lg
          ${shouldCelebrate ? 'bg-pink-100 dark:bg-pink-900' : 'bg-purple-100 dark:bg-purple-900'}
        `}
        >
          {shouldCelebrate ? (
            <Sparkles className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          ) : (
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {anniversary.label}
          </h3>
          {anniversary.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{anniversary.description}</p>
          )}
        </div>
      </div>

      {/* Countdown Display */}
      <div
        className={`
        text-center py-4
        ${shouldCelebrate ? 'animate-pulse' : ''}
      `}
      >
        <p
          className={`
          text-2xl sm:text-3xl font-bold
          ${
            shouldCelebrate
              ? 'text-pink-600 dark:text-pink-400'
              : 'text-purple-600 dark:text-purple-400'
          }
        `}
        >
          {displayText}
        </p>

        {!shouldCelebrate && (
          <div className="flex justify-center gap-4 mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {timeRemaining.days}
              </span>
              <span>days</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {timeRemaining.hours}
              </span>
              <span>hours</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {timeRemaining.minutes}
              </span>
              <span>min</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
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
    <div className="absolute inset-0 pointer-events-none z-10" data-testid="celebration-animation">
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
          <Sparkles className="w-6 h-6 text-pink-500" />
        </motion.div>
      ))}
    </div>
  );
}
