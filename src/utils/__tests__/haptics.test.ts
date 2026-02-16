/**
 * Unit tests for haptic feedback utility
 * Story 5.2: AC-5.2.2 - Device vibrates on successful mood save
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isVibrationSupported,
  triggerMoodSaveHaptic,
  triggerErrorHaptic,
  triggerSelectionHaptic,
} from '../haptics';

describe('haptics utility', () => {
  let vibrateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateMock = vi.fn().mockReturnValue(true);

    // Mock navigator.vibrate since happy-dom doesn't provide it
    if (!navigator.vibrate) {
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateMock,
        writable: true,
        configurable: true,
      });
    } else {
      vi.spyOn(navigator, 'vibrate').mockImplementation(vibrateMock);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    it('calls navigator.vibrate with 50ms when supported', () => {
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
    it('calls navigator.vibrate with error pattern [100, 50, 100]', () => {
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
    it('calls navigator.vibrate with 15ms for quick selection feedback', () => {
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
      const saveDuration = 50;
      const selectionDuration = 15;

      triggerMoodSaveHaptic();
      expect(vibrateMock).toHaveBeenCalledWith(saveDuration);

      vibrateMock.mockClear();

      triggerSelectionHaptic();
      expect(vibrateMock).toHaveBeenCalledWith(selectionDuration);

      expect(saveDuration).toBeGreaterThan(selectionDuration);
    });

    it('error haptic has distinctive pattern different from success', () => {
      triggerMoodSaveHaptic();
      const saveCall = vibrateMock.mock.calls[0][0];

      vibrateMock.mockClear();

      triggerErrorHaptic();
      const errorCall = vibrateMock.mock.calls[0][0];

      // Save is a single number, error is an array pattern
      expect(typeof saveCall).toBe('number');
      expect(Array.isArray(errorCall)).toBe(true);
    });
  });
});
