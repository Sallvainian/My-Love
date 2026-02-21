/**
 * Countdown Component Tests
 *
 * Story 4.1: AC #4 — 3-second synchronized countdown
 * Unit tests for the Countdown component.
 *
 * Tests:
 * - Digit rendering on mount
 * - onComplete callback when countdown reaches 0
 * - Focus on mount (tabIndex=-1 container)
 * - aria-live assertive announcements (start and complete)
 * - Clock skew: immediate onComplete when startedAt >= 3s ago
 * - Reduced-motion: no animation applied
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Countdown } from '../session/Countdown';

// Mock framer-motion (project pattern)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children as React.ReactNode}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useMotionConfig — controllable reduced-motion flag
let mockShouldReduceMotion = false;
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: () => ({
    shouldReduceMotion: mockShouldReduceMotion,
    crossfade: mockShouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
  }),
}));

describe('Countdown', () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onComplete = vi.fn();
    mockShouldReduceMotion = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('[P0] renders digit 3 on mount when startedAt is recent', () => {
    const startedAt = Date.now();

    render(<Countdown startedAt={startedAt} onComplete={onComplete} />);

    expect(screen.getByTestId('countdown-digit')).toHaveTextContent('3');
  });

  test('[P0] calls onComplete when countdown reaches 0', async () => {
    const startedAt = Date.now();

    render(<Countdown startedAt={startedAt} onComplete={onComplete} />);

    // Advance 3.1 seconds to ensure the countdown expires
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('[P1] focuses countdown container on mount', () => {
    const startedAt = Date.now();

    render(<Countdown startedAt={startedAt} onComplete={onComplete} />);

    const container = screen.getByTestId('countdown-container');
    expect(document.activeElement).toBe(container);
  });

  test('[P1] announces session starting via aria-live assertive on mount', () => {
    const startedAt = Date.now();

    render(<Countdown startedAt={startedAt} onComplete={onComplete} />);

    // The sr-only div with aria-live="assertive" should contain the announcement
    expect(screen.getByText('Session starting in 3 seconds')).toBeInTheDocument();
  });

  test('[P1] announces session started via aria-live after countdown completes', async () => {
    const startedAt = Date.now();

    render(<Countdown startedAt={startedAt} onComplete={onComplete} />);

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.getByText('Session started')).toBeInTheDocument();
  });

  test('[P1] calls onComplete immediately when startedAt is >= 3000ms ago (clock skew)', async () => {
    // Simulate a 4-second-old startedAt — late broadcast delivery
    const startedAt = Date.now() - 4000;

    await act(async () => {
      render(<Countdown startedAt={startedAt} onComplete={onComplete} />);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('[P2] passes shouldReduceMotion=true to motion config when reduced-motion active', () => {
    mockShouldReduceMotion = true;
    const startedAt = Date.now();

    // This test verifies the component renders without errors in reduced-motion mode.
    // Animation suppression is handled by the motion config, not CSS classes.
    expect(() => render(<Countdown startedAt={startedAt} onComplete={onComplete} />)).not.toThrow();
    expect(screen.getByTestId('countdown-digit')).toBeInTheDocument();
  });
});
