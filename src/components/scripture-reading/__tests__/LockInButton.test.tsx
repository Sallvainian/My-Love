/**
 * LockInButton Component Tests
 *
 * Story 4.2: AC #3, #4 — Lock-In and Undo
 * Unit tests for the LockInButton presentational component.
 *
 * Tests:
 * - Unlocked renders "Ready for next verse"
 * - Locked renders waiting state + "Tap to undo" visible
 * - onLockIn called on button click (unlocked state)
 * - onUndoLockIn called on "Tap to undo" click
 * - partnerLocked=true shows partner indicator
 * - isPending=true disables button
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { LockInButton } from '../session/LockInButton';

describe('LockInButton', () => {
  const defaultProps = {
    isLocked: false,
    isPending: false,
    partnerLocked: false,
    partnerName: 'Jordan',
    onLockIn: vi.fn(),
    onUndoLockIn: vi.fn(),
  };

  test('[P1] renders "Ready for next verse" when unlocked', () => {
    render(<LockInButton {...defaultProps} />);

    expect(screen.getByTestId('lock-in-button')).toBeVisible();
    expect(screen.getByTestId('lock-in-button')).toHaveTextContent(/ready for next verse/i);
  });

  test('[P1] renders waiting state with partner name when locked', () => {
    render(<LockInButton {...defaultProps} isLocked={true} />);

    expect(screen.getByTestId('lock-in-button')).toHaveTextContent(/waiting for jordan/i);
    expect(screen.getByTestId('lock-in-undo')).toBeVisible();
    expect(screen.getByTestId('lock-in-undo')).toHaveTextContent(/tap to undo/i);
  });

  test('[P1] calls onLockIn when button clicked in unlocked state', async () => {
    const onLockIn = vi.fn();
    render(<LockInButton {...defaultProps} onLockIn={onLockIn} />);

    await userEvent.click(screen.getByTestId('lock-in-button'));

    expect(onLockIn).toHaveBeenCalledTimes(1);
  });

  test('[P1] calls onUndoLockIn when "Tap to undo" clicked', async () => {
    const onUndoLockIn = vi.fn();
    render(<LockInButton {...defaultProps} isLocked={true} onUndoLockIn={onUndoLockIn} />);

    await userEvent.click(screen.getByTestId('lock-in-undo'));

    expect(onUndoLockIn).toHaveBeenCalledTimes(1);
  });

  test('[P1] shows partner locked indicator when partnerLocked=true and user not locked', () => {
    render(<LockInButton {...defaultProps} partnerLocked={true} />);

    expect(screen.getByTestId('partner-locked-indicator')).toBeVisible();
    expect(screen.getByTestId('partner-locked-indicator')).toHaveTextContent(/jordan is ready/i);
  });

  test('[P1] disables button when isPending=true', () => {
    render(<LockInButton {...defaultProps} isPending={true} />);

    const button = screen.getByTestId('lock-in-button');
    // isPending should make button non-interactive (disabled attribute)
    expect(button).toBeDisabled();
  });

  test('[P1] has accessible aria-label on main button', () => {
    render(<LockInButton {...defaultProps} />);

    const button = screen.getByTestId('lock-in-button');
    expect(button).toHaveAttribute('aria-label');
  });

  // ===========================================================================
  // Expansion tests: combined state edge cases (TEA Automate — Story 4.2)
  // ===========================================================================

  test('[P2] does NOT show partner indicator when both isLocked and partnerLocked are true', () => {
    render(<LockInButton {...defaultProps} isLocked={true} partnerLocked={true} />);

    // Partner indicator should be hidden when user is already locked
    // (component guards with `partnerLocked && !isLocked`)
    expect(screen.queryByTestId('partner-locked-indicator')).not.toBeInTheDocument();
  });

  test('[P2] undo button is disabled when isPending is true in locked state', () => {
    render(<LockInButton {...defaultProps} isLocked={true} isPending={true} />);

    const undoButton = screen.getByTestId('lock-in-undo');
    expect(undoButton).toBeDisabled();
  });

  // ===========================================================================
  // Story 4.3: Disconnected state tests
  // ===========================================================================

  test('[P1] isPartnerDisconnected=true renders "Holding your place" + "Reconnecting..."', () => {
    render(<LockInButton {...defaultProps} isPartnerDisconnected={true} />);

    const button = screen.getByTestId('lock-in-disconnected');
    expect(button).toBeVisible();
    expect(button).toHaveTextContent(/holding your place/i);
    expect(screen.getByText(/reconnecting/i)).toBeVisible();
  });

  test('[P1] button is disabled when isPartnerDisconnected=true', () => {
    render(<LockInButton {...defaultProps} isPartnerDisconnected={true} />);

    const button = screen.getByTestId('lock-in-disconnected');
    expect(button).toBeDisabled();
  });

  test('[P1] isPartnerDisconnected=true && isLocked=true shows undo still available', () => {
    render(<LockInButton {...defaultProps} isPartnerDisconnected={true} isLocked={true} />);

    // Should show waiting state with reconnecting note
    expect(screen.getByTestId('lock-in-button')).toHaveTextContent(/waiting for jordan/i);
    expect(screen.getByText(/reconnecting/i)).toBeVisible();
    // Undo should still be available
    expect(screen.getByTestId('lock-in-undo')).toBeVisible();
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.3)
  // ===========================================================================

  test('[P2] disconnected+unlocked state has accessible aria-label', () => {
    render(<LockInButton {...defaultProps} isPartnerDisconnected={true} />);

    const button = screen.getByTestId('lock-in-disconnected');
    expect(button).toHaveAttribute('aria-label');
    expect(button.getAttribute('aria-label')).toMatch(/holding|reconnect/i);
  });

  test('[P2] disconnected+locked state undo button calls onUndoLockIn', async () => {
    const onUndoLockIn = vi.fn();
    render(
      <LockInButton
        {...defaultProps}
        isPartnerDisconnected={true}
        isLocked={true}
        onUndoLockIn={onUndoLockIn}
      />
    );

    await userEvent.click(screen.getByTestId('lock-in-undo'));
    expect(onUndoLockIn).toHaveBeenCalledTimes(1);
  });

  test('[P2] disconnected+locked+isPending disables undo button', () => {
    render(
      <LockInButton
        {...defaultProps}
        isPartnerDisconnected={true}
        isLocked={true}
        isPending={true}
      />
    );

    expect(screen.getByTestId('lock-in-undo')).toBeDisabled();
  });
});
