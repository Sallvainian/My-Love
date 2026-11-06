/**
 * AnniversaryCountdown -- one anniversary's card in Home's Upcoming list,
 * beside the events and sorted with them by date (owner decision 2026-11-05:
 * an anniversary and an event are the same thing on Home).
 *
 * Counts down to the anniversary's next occurrence with a live h/m/s clock,
 * ticking every second like the other Home countdowns. On the day it reads
 * `Today!` with the highlight and plays the celebration once per mount. The
 * card is the shared CountdownCard (CAP-3), a button that opens the
 * anniversary's page from Home (`dates/anniversary/<key>`).
 */

import { AnimatePresence, m as motion } from 'motion/react';
import { Calendar, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ANIMATION_TIMING, ANIMATION_VALUES } from '../../constants/animations';
import type { Anniversary } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { CountdownCard } from '../RelationshipTimers/CountdownCard';
import {
  formatCountdownClock,
  formatDayCount,
  getCountdownToDay,
  type CountdownParts,
} from '../RelationshipTimers/eventCountdownHelpers';
import { getNextAnniversaryDate } from '../../utils/countdownService';
import { generateDeterministicNumbers } from '../../utils/deterministicRandom';

interface AnniversaryCountdownProps {
  anniversary: Anniversary;
}

export function AnniversaryCountdown({ anniversary }: AnniversaryCountdownProps) {
  const [now, setNow] = useState(() => new Date());
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebratedRef = useRef(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openSettingsPage = useAppStore((s) => s.openSettingsPage);

  // Tick every second so the clock counts down live, as on the other cards
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(interval);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  const remaining: CountdownParts | null = getCountdownToDay(
    getNextAnniversaryDate(anniversary.date, now),
    now
  );
  // The day has come exactly when the clock has nothing left to count, so the
  // card flips and the animation starts at midnight, not in the last minute before it.
  const celebrating = remaining === null;

  useEffect(() => {
    if (!celebrating || celebratedRef.current) return;
    celebratedRef.current = true;
    const kickoff = setTimeout(() => {
      setIsCelebrating(true);
      celebrationTimeoutRef.current = setTimeout(() => setIsCelebrating(false), 3000);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [celebrating]);

  // The key DatesPage and the anniversary page use: the server id, or the local id until it has one.
  const key = anniversary.serverId ?? String(anniversary.id);

  return (
    <div className="relative">
      <CountdownCard
        icon={celebrating ? Sparkles : Calendar}
        highlight={celebrating}
        label={anniversary.label}
        value={celebrating ? 'Today!' : formatDayCount(remaining.days)}
        trailing={celebrating ? undefined : formatCountdownClock(remaining)}
        description={anniversary.description}
        onOpen={() => openSettingsPage(`dates/anniversary/${key}`, { fromHome: true })}
        testId={`anniversary-countdown-${anniversary.id}`}
      />

      {/* Celebration Animation, over the card and clipped to its corners */}
      <AnimatePresence>{isCelebrating && <CelebrationAnimation />}</AnimatePresence>
    </div>
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
