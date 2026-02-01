/**
 * Centralized motion configuration hook.
 *
 * Story 1.5: Wraps Framer Motion's useReducedMotion to provide named animation presets.
 * All Scripture Reading components use this hook instead of raw useReducedMotion.
 */

import { useReducedMotion } from 'framer-motion';

export function useMotionConfig() {
  const shouldReduceMotion = useReducedMotion();

  return {
    shouldReduceMotion: !!shouldReduceMotion,
    crossfade: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    slide: shouldReduceMotion
      ? { duration: 0 }
      : { duration: 0.3, ease: 'easeInOut' as const },
    spring: shouldReduceMotion
      ? { duration: 0 }
      : { type: 'spring' as const, stiffness: 100, damping: 15 },
    fadeIn: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    modeReveal: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
  };
}
