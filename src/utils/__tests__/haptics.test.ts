/**
 * Unit tests for haptic feedback utility
 * Story 5.2: AC-5.2.2 - Device vibrates on successful mood save
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isVibrationSupported,
  playHaptic,
  triggerErrorHaptic,
  triggerMoodSaveHaptic,
  triggerSelectionHaptic,
} from '../haptics';

// The web by default; the native-shell tests flip these.
const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  isPluginAvailable: vi.fn(() => true),
}));

const haptics = vi.hoisted(() => ({
  impact: vi.fn(() => Promise.resolve()),
  notification: vi.fn(() => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: capacitor }));

vi.mock('@capacitor/haptics', () => ({
  Haptics: haptics,
  ImpactStyle: { Heavy: 'HEAVY', Medium: 'MEDIUM', Light: 'LIGHT' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));

describe('haptics utility', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capacitor.isNativePlatform.mockReturnValue(false);
    capacitor.isPluginAvailable.mockReturnValue(true);
    haptics.impact.mockClear();
    haptics.notification.mockClear();
    vibrateMock = vi.fn().mockReturnValue(true);

    // Mock navigator.vibrate since happy-dom doesn't provide it
    if (!navigator.vibrate) {
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator, 'vibrate').mockImplementation(
        vibrateMock as (pattern: Iterable<number>) => boolean
      );
    }
  });

  describe('isVibrationSupported', () => {
    it('returns true when navigator.vibrate exists', () => {
      expect(isVibrationSupported()).toBe(true);
    });

    it('returns false when navigator.vibrate does not exist', () => {
      // Temporarily remove vibrate
      const originalVibrate = navigator.vibrate;
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isVibrationSupported()).toBe(false);

      // Restore
      Object.defineProperty(navigator, 'vibrate', {
        value: originalVibrate,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('triggerMoodSaveHaptic', () => {
    it('vibrates once for 50ms on a mood save', () => {
      triggerMoodSaveHaptic();

      expect(vibrateMock).toHaveBeenCalledTimes(1);
      expect(vibrateMock).toHaveBeenCalledWith(50);
    });

    it('does not throw when vibrate is not supported', () => {
      // Temporarily remove vibrate
      const originalVibrate = navigator.vibrate;
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => triggerMoodSaveHaptic()).not.toThrow();

      // Restore
      Object.defineProperty(navigator, 'vibrate', {
        value: originalVibrate,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('triggerErrorHaptic', () => {
    it('vibrates twice for 100ms, 50ms apart, on an error', () => {
      triggerErrorHaptic();

      expect(vibrateMock).toHaveBeenCalledTimes(1);
      expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
    });

    it('does not throw when vibrate is not supported', () => {
      const originalVibrate = navigator.vibrate;
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => triggerErrorHaptic()).not.toThrow();

      Object.defineProperty(navigator, 'vibrate', {
        value: originalVibrate,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('triggerSelectionHaptic', () => {
    it('vibrates once for 15ms on a selection', () => {
      triggerSelectionHaptic();

      expect(vibrateMock).toHaveBeenCalledTimes(1);
      expect(vibrateMock).toHaveBeenCalledWith(15);
    });

    it('does not throw when vibrate is not supported', () => {
      const originalVibrate = navigator.vibrate;
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => triggerSelectionHaptic()).not.toThrow();

      Object.defineProperty(navigator, 'vibrate', {
        value: originalVibrate,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('haptic feedback patterns', () => {
    it('save haptic (50ms) is longer than selection haptic (15ms)', () => {
      triggerMoodSaveHaptic();
      expect(vibrateMock).toHaveBeenCalledTimes(1);
      const saveDuration = vibrateMock.mock.calls[0][0];

      vibrateMock.mockClear();

      triggerSelectionHaptic();
      expect(vibrateMock).toHaveBeenCalledTimes(1);
      const selectionDuration = vibrateMock.mock.calls[0][0];

      // Compare what each trigger actually sent, not test-local literals
      expect(saveDuration).toBe(50);
      expect(selectionDuration).toBe(15);
      expect(saveDuration).toBeGreaterThan(selectionDuration);
    });

    it('error haptic has distinctive pattern different from success', () => {
      triggerMoodSaveHaptic();
      const saveCall = vibrateMock.mock.calls[0][0];

      vibrateMock.mockClear();

      triggerErrorHaptic();
      const errorCall = vibrateMock.mock.calls[0][0];

      // Save is a single 50ms pulse, error is a buzz-pause-buzz pattern
      expect(saveCall).toBe(50);
      expect(errorCall).toEqual([100, 50, 100]);
      expect(errorCall).not.toEqual(saveCall);
    });
  });

  // DW-325: Safari on iPhone has no Vibration API, so the shell plays Apple's.
  describe('in the native iOS shell', () => {
    beforeEach(() => {
      capacitor.isNativePlatform.mockReturnValue(true);
    });

    it('plays each feel as its iPhone haptic and never calls the Vibration API', () => {
      triggerMoodSaveHaptic();
      expect(haptics.notification).toHaveBeenLastCalledWith({ type: 'SUCCESS' });

      triggerErrorHaptic();
      expect(haptics.notification).toHaveBeenLastCalledWith({ type: 'ERROR' });

      triggerSelectionHaptic();
      expect(haptics.impact).toHaveBeenLastCalledWith({ style: 'LIGHT' });

      playHaptic([30], 'arrival');
      expect(haptics.impact).toHaveBeenLastCalledWith({ style: 'MEDIUM' });

      expect(haptics.notification).toHaveBeenCalledTimes(2);
      expect(haptics.impact).toHaveBeenCalledTimes(2);
      expect(vibrateMock).not.toHaveBeenCalled();
    });

    it('falls back to the Vibration API in a shell installed before the plugin', () => {
      capacitor.isPluginAvailable.mockReturnValue(false);

      triggerMoodSaveHaptic();

      expect(capacitor.isPluginAvailable).toHaveBeenCalledWith('Haptics');
      expect(haptics.notification).not.toHaveBeenCalled();
      expect(vibrateMock).toHaveBeenCalledWith(50);
    });

    it('swallows a failed haptic with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const failure = new Error('no engine');
      haptics.notification.mockReturnValueOnce(Promise.reject(failure));

      expect(() => triggerErrorHaptic()).not.toThrow();

      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('Haptic failed:', failure));
      warn.mockRestore();
    });
  });

  // On the web the plugin's own navigator.vibrate fallback counts as an
  // available plugin, so availability alone must not pick the native path.
  it('uses the Vibration API on the web even though the plugin reports available', () => {
    triggerErrorHaptic();

    expect(haptics.notification).not.toHaveBeenCalled();
    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
  });
});
