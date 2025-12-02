/**
 * Haptic Feedback Utility
 * Story 5.2: AC-5.2.2 - Device vibrates on successful mood save
 *
 * Uses the Vibration API to provide tactile feedback on supported devices.
 * Gracefully degrades on unsupported browsers/devices.
 */

/**
 * Check if the Vibration API is supported in the current browser/device.
 * @returns true if navigator.vibrate is available and callable
 */
export function isVibrationSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function'
  );
}

/**
 * Trigger haptic feedback for successful mood save.
 * Uses a 50ms pulse to indicate success.
 *
 * @example
 * ```typescript
 * await addMoodEntry(moods, note);
 * triggerMoodSaveHaptic(); // Vibrate on success
 * setShowSuccess(true);
 * ```
 */
export function triggerMoodSaveHaptic(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(50); // 50ms pulse for success confirmation
  }
}

/**
 * Trigger haptic feedback for error state.
 * Uses a pattern of [100ms vibrate, 50ms pause, 100ms vibrate]
 * to indicate something went wrong.
 *
 * @example
 * ```typescript
 * try {
 *   await saveMood();
 * } catch (error) {
 *   triggerErrorHaptic();
 *   showError(error);
 * }
 * ```
 */
export function triggerErrorHaptic(): void {
  if (isVibrationSupported()) {
    navigator.vibrate([100, 50, 100]); // Error pattern
  }
}

/**
 * Trigger haptic feedback for mood selection.
 * Uses a quick 15ms pulse for subtle selection feedback.
 */
export function triggerSelectionHaptic(): void {
  if (isVibrationSupported()) {
    navigator.vibrate(15); // Quick tap for selection
  }
}
