/**
 * Vibration API Hook
 *
 * Provides a React hook for haptic feedback using the Vibration API.
 * Implements Story 2.2 AC-2.2.2 and AC-2.2.4 haptic feedback requirements.
 *
 * Features:
 * - Feature detection for Vibration API support
 * - Graceful degradation on unsupported browsers
 * - Type-safe vibration patterns (number or number[])
 * - Error handling for vibration failures
 *
 * Standard patterns:
 * - Success: vibrate(50) - single short pulse
 * - Error: vibrate([100, 50, 100]) - double pulse pattern
 *
 * @module hooks/useVibration
 */

import { useCallback, useMemo } from 'react';

/**
 * Vibration pattern type - single duration or array of durations
 */
export type VibrationPattern = number | number[];

/**
 * Hook return type
 */
export interface UseVibrationReturn {
  /**
   * Triggers device vibration with the given pattern
   * @param pattern - Duration in ms (number) or pattern array [vibrate, pause, vibrate, ...]
   */
  vibrate: (pattern: VibrationPattern) => void;

  /**
   * Whether the Vibration API is supported in this browser
   */
  isSupported: boolean;
}

/**
 * React hook for haptic feedback via Vibration API
 *
 * @returns Object with vibrate function and isSupported flag
 *
 * @example
 * ```tsx
 * const { vibrate, isSupported } = useVibration();
 *
 * // Success feedback
 * vibrate(50);
 *
 * // Error feedback
 * vibrate([100, 50, 100]);
 *
 * // Check support
 * if (!isSupported) {
 *   console.log('Vibration not supported');
 * }
 * ```
 */
export function useVibration(): UseVibrationReturn {
  /**
   * Check if Vibration API is supported
   * Memoized to avoid rechecking on every render
   */
  const isSupported = useMemo(() => {
    return (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    );
  }, []);

  /**
   * Trigger vibration with error handling
   */
  const vibrate = useCallback(
    (pattern: VibrationPattern) => {
      // Skip if not supported
      if (!isSupported) {
        return;
      }

      try {
        // Call the Vibration API
        navigator.vibrate(pattern);
      } catch (error) {
        // Silently fail - vibration is non-critical UX enhancement
        console.warn('Vibration failed:', error);
      }
    },
    [isSupported]
  );

  return {
    vibrate,
    isSupported,
  };
}
