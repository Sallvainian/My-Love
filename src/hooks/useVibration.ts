/**
 * Vibration API Hook
 *
 * Provides a React hook for haptic feedback: Apple's haptics in the native iOS
 * shell, the Vibration API elsewhere (`playHaptic` in utils/haptics).
 * Implements Story 2.2 AC-2.2.2 and AC-2.2.4 haptic feedback requirements.
 *
 * Features:
 * - Feature detection for Vibration API support
 * - Graceful degradation on unsupported browsers
 * - Type-safe vibration patterns (number or number[])
 * - Error handling for vibration failures
 *
 * Standard patterns:
 * - Success: vibrate(50, 'success') - single short pulse
 * - Error: vibrate([100, 50, 100], 'error') - double pulse pattern
 *
 * @module hooks/useVibration
 */

import { useCallback, useMemo } from 'react';
import { type HapticFeel, playHaptic, type VibrationPattern } from '../utils/haptics';

/**
 * Hook return type
 */
interface UseVibrationReturn {
  /**
   * Triggers device vibration with the given pattern
   * @param pattern - Duration in ms (number) or pattern array [vibrate, pause, vibrate, ...]
   * @param feel - What the buzz means, which picks the iPhone haptic that plays it
   */
  vibrate: (pattern: VibrationPattern, feel: HapticFeel) => void;

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
 * vibrate(50, 'success');
 *
 * // Error feedback
 * vibrate([100, 50, 100], 'error');
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
   * Trigger vibration; never throws (see playHaptic)
   */
  const vibrate = useCallback(
    (pattern: VibrationPattern, feel: HapticFeel) => playHaptic(pattern, feel),
    []
  );

  return {
    vibrate,
    isSupported,
  };
}
