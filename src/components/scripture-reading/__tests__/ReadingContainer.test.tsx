/**
 * ReadingContainer Component Tests
 *
 * Story 4.2: AC #1-#7 — Together Mode Reading Container
 * Unit tests for the ReadingContainer orchestrator component.
 *
 * Tests:
 * - Renders role indicator with correct role
 * - lockIn called when lock-in button clicked
 * - undoLockIn called when undo clicked
 * - effectiveRole = 'reader' on even step, 'responder' on odd step (when myRole='reader')
 * - PartnerPosition receives presence data
 * - Shows "Session updated" toast when SYNC_FAILED error present
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingContainer } from '../containers/ReadingContainer';

// ============================================
// Mock Zustand store
// ============================================
const mockLockIn = vi.fn();
const mockUndoLockIn = vi.fn();
const mockSetPartnerDisconnected = vi.fn();
const mockEndSession = vi.fn();
const mockLoadSession = vi.fn();

const mockStoreState = {
  session: {
    id: 'session-reading-001',
    mode: 'together',
    currentPhase: 'reading',
    currentStepIndex: 0,
    version: 1,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'in_progress',
    startedAt: new Date(),
  } as {
    id: string;
    mode: string;
    currentPhase: string;
    currentStepIndex: number;
    version: number;
    userId: string;
    partnerId: string;
    status: string;
    startedAt: Date;
  } | null,
  myRole: 'reader' as const,
  isPendingLockIn: false,
  partnerLocked: false,
  scriptureError: null as { code: string; message: string } | null,
  lockIn: mockLockIn,
  undoLockIn: mockUndoLockIn,
  partner: { displayName: 'Jordan', id: 'user-2' },
  partnerDisconnected: false,
  partnerDisconnectedAt: null as number | null,
  setPartnerDisconnected: mockSetPartnerDisconnected,
  endSession: mockEndSession,
  loadSession: mockLoadSession,
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

// Mock useScripturePresence hook
vi.mock('../../../hooks/useScripturePresence', () => ({
  useScripturePresence: vi
    .fn()
    .mockReturnValue({ view: null, stepIndex: null, ts: null, isPartnerConnected: true }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _i, animate: _a, exit: _e, transition: _t, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useMotionConfig
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: vi.fn().mockReturnValue({
    slide: { duration: 0.3, ease: 'easeInOut' },
    shouldReduceMotion: false,
  }),
}));

describe('ReadingContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state to defaults
    Object.assign(mockStoreState, {
      session: {
        id: 'session-reading-001',
        mode: 'together',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-1',
        partnerId: 'user-2',
        status: 'in_progress',
        startedAt: new Date(),
      },
      myRole: 'reader',
      isPendingLockIn: false,
      partnerLocked: false,
      scriptureError: null,
      partnerDisconnected: false,
      partnerDisconnectedAt: null,
    });
  });

  test('[P1] renders role indicator with correct role', () => {
    render(<ReadingContainer />);

    const roleIndicator = screen.getByTestId('role-indicator');
    expect(roleIndicator).toBeVisible();
    // On step 0 (even), myRole='reader' → effectiveRole='reader' → "You read this"
    expect(roleIndicator).toHaveTextContent('You read this');
  });

  test('[P1] renders step progress indicator', () => {
    render(<ReadingContainer />);

    const progress = screen.getByTestId('reading-step-progress');
    expect(progress).toBeVisible();
    expect(progress).toHaveTextContent(/verse 1 of 17/i);
  });

  test('[P1] calls lockIn when lock-in button clicked', async () => {
    render(<ReadingContainer />);

    await userEvent.click(screen.getByTestId('lock-in-button'));

    expect(mockLockIn).toHaveBeenCalledTimes(1);
  });

  test('[P1] calls undoLockIn when undo clicked in locked state', async () => {
    mockStoreState.isPendingLockIn = true;
    render(<ReadingContainer />);

    await userEvent.click(screen.getByTestId('lock-in-undo'));

    expect(mockUndoLockIn).toHaveBeenCalledTimes(1);
  });

  test('[P1] shows responder role indicator on odd step (effectiveRole alternation)', () => {
    mockStoreState.session!.currentStepIndex = 1; // Odd step
    render(<ReadingContainer />);

    const roleIndicator = screen.getByTestId('role-indicator');
    // On step 1 (odd), myRole='reader' → effectiveRole='responder'
    expect(roleIndicator).toHaveTextContent('Partner reads this');
  });

  test('[P1] shows reader role indicator on even step', () => {
    mockStoreState.session!.currentStepIndex = 2; // Even step
    render(<ReadingContainer />);

    const roleIndicator = screen.getByTestId('role-indicator');
    // On step 2 (even), myRole='reader' → effectiveRole='reader'
    expect(roleIndicator).toHaveTextContent('You read this');
  });

  test('[P1] shows "Session updated" toast when SYNC_FAILED error with Session updated message', () => {
    mockStoreState.scriptureError = {
      code: 'SYNC_FAILED',
      message: 'Session updated',
    };
    render(<ReadingContainer />);

    const toast = screen.getByTestId('session-update-toast');
    expect(toast).toBeVisible();
    expect(toast).toHaveTextContent(/session updated/i);
  });

  test('[P1] shows generic error toast for non-409 reading sync failures', () => {
    mockStoreState.scriptureError = {
      code: 'SYNC_FAILED',
      message: 'RPC timeout',
    };

    render(<ReadingContainer />);

    const toast = screen.getByTestId('session-error-toast');
    expect(toast).toBeVisible();
    expect(toast).toHaveTextContent(/rpc timeout/i);
  });

  test('[P1] renders reading-container root element', () => {
    render(<ReadingContainer />);

    expect(screen.getByTestId('reading-container')).toBeVisible();
  });

  test('[P1] renders verse/response navigation tabs', () => {
    render(<ReadingContainer />);

    expect(screen.getByTestId('reading-tab-verse')).toBeVisible();
    expect(screen.getByTestId('reading-tab-response')).toBeVisible();
  });

  test('[P1] renders BookmarkFlag on verse view', () => {
    render(<ReadingContainer />);

    expect(screen.getByTestId('scripture-bookmark-button')).toBeVisible();
  });

  test('[P1] prevents duplicate lock-in clicks while request is pending', async () => {
    let resolveLockIn: (() => void) | null = null;
    mockLockIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLockIn = resolve;
        })
    );

    render(<ReadingContainer />);
    const lockInButton = screen.getByTestId('lock-in-button');

    await userEvent.click(lockInButton);
    await userEvent.click(lockInButton);

    expect(mockLockIn).toHaveBeenCalledTimes(1);

    resolveLockIn?.();
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.2)
  // ===========================================================================

  test('[P2] clicking Response tab shows response text', async () => {
    render(<ReadingContainer />);

    // Initially on verse tab — verse text visible
    expect(screen.getByTestId('reading-verse-text')).toBeVisible();

    // Click Response tab
    await userEvent.click(screen.getByTestId('reading-tab-response'));

    // Response text should now be visible
    expect(screen.getByTestId('reading-response-text')).toBeVisible();
  });

  test('[P2] clicking Verse tab after Response returns to verse text', async () => {
    render(<ReadingContainer />);

    // Switch to response
    await userEvent.click(screen.getByTestId('reading-tab-response'));
    expect(screen.getByTestId('reading-response-text')).toBeVisible();

    // Switch back to verse
    await userEvent.click(screen.getByTestId('reading-tab-verse'));
    expect(screen.getByTestId('reading-verse-text')).toBeVisible();
  });

  test('[P2] returns null when session is null', () => {
    mockStoreState.session = null;
    const { container } = render(<ReadingContainer />);

    expect(container.innerHTML).toBe('');
  });

  test('[P2] returns null when step data is undefined (out-of-bounds step)', () => {
    mockStoreState.session!.currentStepIndex = 999; // Beyond MAX_STEPS
    const { container } = render(<ReadingContainer />);

    expect(container.innerHTML).toBe('');
  });
});
