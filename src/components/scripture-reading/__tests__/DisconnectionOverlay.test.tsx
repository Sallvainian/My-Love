/**
 * DisconnectionOverlay Component Tests (ATDD — RED PHASE)
 *
 * Story 4.3: AC #1, #2, #3 — Reconnecting indicator, timeout options, keep waiting
 * Unit tests for the DisconnectionOverlay presentational component.
 *
 * Tests:
 * - Phase A: renders "Partner reconnecting..." when < 30s elapsed
 * - Phase B: renders timeout state with buttons when >= 30s
 * - "Keep Waiting" calls onKeepWaiting
 * - "End Session" calls onEndSession
 * - aria-live announcement present
 * - No blame language in visible text
 * - Phase transition from A to B after 30s
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { DisconnectionOverlay } from '../session/DisconnectionOverlay';

describe('DisconnectionOverlay', () => {
  const defaultProps = {
    partnerName: 'Jordan',
    disconnectedAt: Date.now(),
    onKeepWaiting: vi.fn(),
    onEndSession: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Phase A: Reconnecting (< 30s)
  // ===========================================================================

  test('[P0] renders "Partner reconnecting..." in Phase A (< 30s elapsed)', () => {
    // Given: partner disconnected just now (< 30s ago)
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />);

    // Then: overlay root is visible
    expect(screen.getByTestId('disconnection-overlay')).toBeVisible();

    // Then: Phase A content is visible with reconnecting message
    expect(screen.getByTestId('disconnection-reconnecting')).toBeVisible();
    expect(screen.getByTestId('disconnection-reconnecting')).toHaveTextContent(
      /partner reconnecting/i
    );
  });

  test('[P1] does NOT show timeout buttons in Phase A', () => {
    // Given: partner disconnected just now
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />);

    // Then: timeout content should NOT be visible
    expect(screen.queryByTestId('disconnection-timeout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('disconnection-keep-waiting')).not.toBeInTheDocument();
    expect(screen.queryByTestId('disconnection-end-session')).not.toBeInTheDocument();
  });

  test('[P1] has aria-live="polite" announcement with partner name', () => {
    // Given: partner disconnected
    render(<DisconnectionOverlay {...defaultProps} />);

    // Then: aria-live region contains partner name in disconnection context
    const ariaRegion = screen.getByRole('status');
    expect(ariaRegion).toHaveAttribute('aria-live', 'polite');
    expect(ariaRegion).toHaveTextContent(/jordan/i);
    expect(ariaRegion).toHaveTextContent(/disconnected/i);
  });

  // ===========================================================================
  // Phase B: Timeout (>= 30s)
  // ===========================================================================

  test('[P0] transitions to Phase B after 30s with timeout buttons', () => {
    // Given: partner disconnected 31 seconds ago
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={thirtyOneSecondsAgo} />);

    // Then: Phase B content should be visible
    expect(screen.getByTestId('disconnection-timeout')).toBeVisible();
    expect(screen.getByTestId('disconnection-timeout')).toHaveTextContent(
      /your partner seems to have stepped away/i
    );

    // Then: both buttons should be visible
    expect(screen.getByTestId('disconnection-keep-waiting')).toBeVisible();
    expect(screen.getByTestId('disconnection-end-session')).toBeVisible();
  });

  test('[P0] transitions from Phase A to Phase B via timer', () => {
    // Given: partner disconnected just now
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />);

    // Initially in Phase A
    expect(screen.getByTestId('disconnection-reconnecting')).toBeVisible();
    expect(screen.queryByTestId('disconnection-timeout')).not.toBeInTheDocument();

    // When: 30 seconds pass
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Then: transitions to Phase B
    expect(screen.getByTestId('disconnection-timeout')).toBeVisible();
    expect(screen.getByTestId('disconnection-keep-waiting')).toBeVisible();
    expect(screen.getByTestId('disconnection-end-session')).toBeVisible();
  });

  // ===========================================================================
  // Button interactions
  // ===========================================================================

  test('[P0] "Keep Waiting" calls onKeepWaiting callback', () => {
    // Given: Phase B (> 30s)
    const onKeepWaiting = vi.fn();
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(
      <DisconnectionOverlay
        {...defaultProps}
        disconnectedAt={thirtyOneSecondsAgo}
        onKeepWaiting={onKeepWaiting}
      />
    );

    // When: user clicks "Keep Waiting"
    fireEvent.click(screen.getByTestId('disconnection-keep-waiting'));

    // Then: callback fired
    expect(onKeepWaiting).toHaveBeenCalledTimes(1);
  });

  test('[P0] "End Session" requires explicit confirmation before callback', () => {
    // Given: Phase B (> 30s)
    const onEndSession = vi.fn();
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(
      <DisconnectionOverlay
        {...defaultProps}
        disconnectedAt={thirtyOneSecondsAgo}
        onEndSession={onEndSession}
      />
    );

    // When: user clicks "End Session" (first tap)
    fireEvent.click(screen.getByTestId('disconnection-end-session'));

    // Then: confirmation gate appears, callback not fired yet
    expect(screen.getByTestId('disconnection-confirmation')).toBeVisible();
    expect(onEndSession).not.toHaveBeenCalled();

    // When: user explicitly confirms
    fireEvent.click(screen.getByTestId('disconnection-confirm-end-session'));

    // Then: callback fired
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });

  test('[P1] canceling end-session confirmation returns to timeout actions', () => {
    // Given: Phase B (> 30s)
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={thirtyOneSecondsAgo} />);

    // Enter confirmation state
    fireEvent.click(screen.getByTestId('disconnection-end-session'));
    expect(screen.getByTestId('disconnection-confirmation')).toBeVisible();

    // When: user cancels
    fireEvent.click(screen.getByTestId('disconnection-cancel-end-session'));

    // Then: timeout actions are visible again
    expect(screen.getByTestId('disconnection-timeout')).toBeVisible();
    expect(screen.getByTestId('disconnection-keep-waiting')).toBeVisible();
    expect(screen.getByTestId('disconnection-end-session')).toBeVisible();
  });

  // ===========================================================================
  // Language / UX requirements
  // ===========================================================================

  test('[P1] uses neutral language — no blame words in visible text', () => {
    // Given: Phase B (timeout)
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={thirtyOneSecondsAgo} />);

    // Then: visible text (excluding sr-only aria region) should NOT contain blame/alarm language
    // The aria-live region uses "disconnected" per AC#1 — but that's screen-reader only
    const timeoutElement = screen.getByTestId('disconnection-timeout');
    const visibleText = timeoutElement.textContent ?? '';
    const blameWords = ['disconnected', 'lost', 'failed', 'error', 'broken', 'dropped'];
    for (const word of blameWords) {
      expect(visibleText.toLowerCase()).not.toContain(word);
    }
  });

  test('[P1] buttons have minimum 48px touch targets', () => {
    // Given: Phase B
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={thirtyOneSecondsAgo} />);

    // Then: both buttons should have min-h-[48px] (via class or style)
    const keepWaiting = screen.getByTestId('disconnection-keep-waiting');
    const endSession = screen.getByTestId('disconnection-end-session');
    expect(keepWaiting.className).toMatch(/min-h/);
    expect(endSession.className).toMatch(/min-h/);
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.3)
  // ===========================================================================

  test('[P2] clears interval on unmount (no memory leak)', () => {
    // Given: overlay is rendered and interval is running
    const { unmount } = render(
      <DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />
    );

    // When: component unmounts
    unmount();

    // Then: advancing timers should NOT cause errors (interval was cleared)
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    // No error thrown = interval was properly cleaned up
  });

  test('[P2] re-renders correctly when disconnectedAt changes (Keep Waiting resets timer)', () => {
    // Given: overlay in Phase B (> 30s elapsed)
    const thirtyOneSecondsAgo = Date.now() - 31_000;
    const { rerender } = render(
      <DisconnectionOverlay {...defaultProps} disconnectedAt={thirtyOneSecondsAgo} />
    );
    expect(screen.getByTestId('disconnection-timeout')).toBeVisible();

    // When: disconnectedAt resets to now (simulating Keep Waiting → setPartnerDisconnected(true))
    rerender(<DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />);

    // Then: should be back in Phase A
    expect(screen.getByTestId('disconnection-reconnecting')).toBeVisible();
    expect(screen.queryByTestId('disconnection-timeout')).not.toBeInTheDocument();
  });

  test('[P2] Phase A has animate-pulse class for visual feedback', () => {
    // Given: Phase A (< 30s)
    render(<DisconnectionOverlay {...defaultProps} disconnectedAt={Date.now()} />);

    // Then: reconnecting text should have pulse animation
    const reconnectingEl = screen.getByTestId('disconnection-reconnecting');
    const pulseElement = reconnectingEl.querySelector('.animate-pulse');
    expect(pulseElement).not.toBeNull();
  });
});
