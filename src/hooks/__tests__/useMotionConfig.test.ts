/**
 * Unit tests for useMotionConfig hook
 *
 * Story 1.5: Task 1 - Centralized Motion Configuration Hook (AC #4)
 *
 * Tests:
 * - Returns non-zero durations when reduced motion is false
 * - Returns zero durations for all presets when reduced motion is true
 * - shouldReduceMotion boolean reflects underlying hook value
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Control the mock return value per-test
let mockReducedMotion: boolean | null = false;

vi.mock('framer-motion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

// Import after mock setup
import { useMotionConfig } from '../useMotionConfig';

describe('useMotionConfig hook', () => {
  beforeEach(() => {
    mockReducedMotion = false;
  });

  it('returns non-zero durations when reduced motion is false', () => {
    mockReducedMotion = false;
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.crossfade.duration).toBe(0.2);
    expect(result.current.slide.duration).toBe(0.3);
    expect(result.current.fadeIn.duration).toBe(0.2);
    expect(result.current.modeReveal.duration).toBe(0.2);
    expect(result.current.spring).toEqual({
      type: 'spring',
      stiffness: 100,
      damping: 15,
    });
  });

  it('returns zero durations for all presets when reduced motion is true', () => {
    mockReducedMotion = true;
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.crossfade).toEqual({ duration: 0 });
    expect(result.current.slide).toEqual({ duration: 0 });
    expect(result.current.spring).toEqual({ duration: 0 });
    expect(result.current.fadeIn).toEqual({ duration: 0 });
    expect(result.current.modeReveal).toEqual({ duration: 0 });
  });

  it('shouldReduceMotion is false when reduced motion preference is off', () => {
    mockReducedMotion = false;
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.shouldReduceMotion).toBe(false);
  });

  it('shouldReduceMotion is true when reduced motion preference is on', () => {
    mockReducedMotion = true;
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.shouldReduceMotion).toBe(true);
  });

  it('shouldReduceMotion normalizes null to false', () => {
    mockReducedMotion = null;
    const { result } = renderHook(() => useMotionConfig());

    expect(result.current.shouldReduceMotion).toBe(false);
  });
});
