/**
 * Countdown Component
 *
 * Story 4.1: AC #4 — 3-second synchronized countdown before reading begins
 *
 * Props:
 *   startedAt: number  — server UTC ms timestamp (from countdown_started_at RPC)
 *   onComplete: () => void — called when countdown reaches 0
 *
 * Derives current digit from (Date.now() - startedAt), auto-corrects clock skew.
 * Respects reduced-motion: no scale/fade animation, just instant number swap.
 * Focus is moved to the container on mount for keyboard/screen reader accessibility.
 * aria-live="assertive" announces "Session starting in 3 seconds" on mount
 * and "Session started" when done.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMotionConfig } from '../../../hooks/useMotionConfig';

interface CountdownProps {
  startedAt: number;
  onComplete: () => void;
}

/** Derives countdown digit (3→2→1→0) from elapsed time. */
function getDigit(startedAt: number): number {
  const elapsed = Date.now() - startedAt;
  return Math.max(0, Math.ceil(3 - elapsed / 1000));
}

export function Countdown({ startedAt, onComplete }: CountdownProps): ReactElement {
  const { shouldReduceMotion, crossfade } = useMotionConfig();
  const containerRef = useRef<HTMLDivElement>(null);

  const [digit, setDigit] = useState<number>(() => getDigit(startedAt));
  const [announced, setAnnounced] = useState('Session starting in 3 seconds');

  // Focus container on mount for keyboard accessibility (AC #4)
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Drive the countdown from server timestamp; handles clock skew on mount
  useEffect(() => {
    // If we mounted late (client received broadcast after 3s), complete immediately
    if (getDigit(startedAt) === 0) {
      setAnnounced('Session started');
      onComplete();
      return;
    }

    const interval = setInterval(() => {
      const current = getDigit(startedAt);
      setDigit(current);

      if (current === 0) {
        clearInterval(interval);
        setAnnounced('Session started');
        onComplete();
      }
    }, 100); // Poll at 100ms for smooth digit updates

    return () => clearInterval(interval);
  }, [startedAt, onComplete]);

  const transitionConfig = shouldReduceMotion ? { duration: 0 } : crossfade;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-testid="countdown-container"
      className="flex min-h-[300px] flex-col items-center justify-center outline-none"
      aria-label="Countdown"
    >
      {/* Screen reader announcement — assertive so VoiceOver announces immediately */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {announced}
      </div>

      <AnimatePresence mode="wait">
        {digit > 0 && (
          <motion.div
            key={digit}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 1.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.5 }}
            transition={transitionConfig}
            className="text-8xl font-bold text-purple-700 select-none"
            data-testid="countdown-digit"
            aria-hidden="true"
          >
            {digit}
          </motion.div>
        )}
      </AnimatePresence>

      {digit === 0 && (
        <p className="text-2xl font-semibold text-purple-700" data-testid="countdown-digit">
          Go!
        </p>
      )}
    </div>
  );
}
