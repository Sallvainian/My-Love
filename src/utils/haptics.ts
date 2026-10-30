/**
 * Haptic Feedback Utility
 * Story 5.2: AC-5.2.2 - Device vibrates on successful mood save
 *
 * The one place the app makes the device buzz. In the native iOS shell it
 * plays Apple's own haptics through @capacitor/haptics, because Safari on
 * iPhone has no Vibration API (DW-325); everywhere else it uses
 * navigator.vibrate and gracefully degrades where that is missing.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** Duration in ms, or [vibrate, pause, vibrate, ...]. */
export type VibrationPattern = number | number[];

/** What the buzz means, which picks the iPhone haptic that plays it. */
export type HapticFeel = 'success' | 'error' | 'selection' | 'arrival';

const NATIVE_HAPTICS: Record<HapticFeel, () => Promise<void>> = {
  success: () => Haptics.notification({ type: NotificationType.Success }),
  error: () => Haptics.notification({ type: NotificationType.Error }),
  selection: () => Haptics.impact({ style: ImpactStyle.Light }),
  arrival: () => Haptics.impact({ style: ImpactStyle.Medium }),
};

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
 * Whether Apple's haptics can play. `isNativePlatform` comes first because on
 * the web the plugin's navigator.vibrate fallback counts as available; the
 * plugin check catches a shell installed before the plugin was added.
 */
function hasNativeHaptics(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Haptics');
}

/**
 * Play `feel` as an iPhone haptic in the native shell, or `pattern` through
 * the Vibration API elsewhere. Never throws: haptics are a non-critical extra.
 */
export function playHaptic(pattern: VibrationPattern, feel: HapticFeel): void {
  if (hasNativeHaptics()) {
    NATIVE_HAPTICS[feel]().catch((error: unknown) => console.warn('Haptic failed:', error));
    return;
  }
  if (!isVibrationSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('Vibration failed:', error);
  }
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
  playHaptic(50, 'success'); // 50ms pulse for success confirmation
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
  playHaptic([100, 50, 100], 'error'); // Error pattern
}

/**
 * Trigger haptic feedback for mood selection.
 * Uses a quick 15ms pulse for subtle selection feedback.
 */
export function triggerSelectionHaptic(): void {
  playHaptic(15, 'selection'); // Quick tap for selection
}
