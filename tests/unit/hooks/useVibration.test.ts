import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVibration } from '../../../src/hooks/useVibration';

describe('useVibration', () => {
  beforeEach(() => {
    // Reset navigator.vibrate mock before each test
    vi.clearAllMocks();
  });

  it('should return vibrate function and isSupported flag', () => {
    const { result } = renderHook(() => useVibration());

    expect(result.current).toHaveProperty('vibrate');
    expect(result.current).toHaveProperty('isSupported');
    expect(typeof result.current.vibrate).toBe('function');
    expect(typeof result.current.isSupported).toBe('boolean');
  });

  it('should detect Vibration API support when available', () => {
    // Mock Vibration API support
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    expect(result.current.isSupported).toBe(true);
  });

  it('should detect lack of Vibration API support', () => {
    // Remove vibrate from navigator
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    expect(result.current.isSupported).toBe(false);
  });

  it('should call navigator.vibrate with single number pattern', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    result.current.vibrate(50);

    expect(vibrateMock).toHaveBeenCalledWith(50);
    expect(vibrateMock).toHaveBeenCalledTimes(1);
  });

  it('should call navigator.vibrate with array pattern', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    result.current.vibrate([100, 50, 100]);

    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
    expect(vibrateMock).toHaveBeenCalledTimes(1);
  });

  it('should not throw when vibrate is called without support', () => {
    // Remove vibrate from navigator
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    // Should not throw
    expect(() => result.current.vibrate(50)).not.toThrow();
    expect(() => result.current.vibrate([100, 50, 100])).not.toThrow();
  });

  it('should gracefully handle vibrate errors', () => {
    const vibrateMock = vi.fn(() => {
      throw new Error('Vibration failed');
    });
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    // Should not throw even if navigator.vibrate throws
    expect(() => result.current.vibrate(50)).not.toThrow();
  });

  it('should support standard vibration patterns', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    // Success vibration (single short pulse)
    result.current.vibrate(50);
    expect(vibrateMock).toHaveBeenCalledWith(50);

    // Error vibration (double pulse pattern)
    result.current.vibrate([100, 50, 100]);
    expect(vibrateMock).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('should handle zero vibration (stop vibration)', () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useVibration());

    result.current.vibrate(0);

    expect(vibrateMock).toHaveBeenCalledWith(0);
  });
});
