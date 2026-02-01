/**
 * ScriptureOverview Component Tests
 *
 * Story 1.1 + 1.2 + 1.4: Navigation Entry Point, Overview Page, Save/Resume & Optimistic UI
 * Unit tests for the Scripture Reading overview/entry point.
 *
 * Tests:
 * - Start button entry point (AC #2, #3)
 * - Mode selection show/hide (AC #3)
 * - Resume prompt for incomplete sessions (AC #6)
 * - Session creation via mode cards (AC #3, #4, #5)
 * - Partner linked/unlinked states (AC #4, #5)
 * - Loading and error states
 * - Lavender Dreams styling (AC #2)
 * - Accessibility
 * - Story 1.4: "Start fresh" calls abandonSession
 * - Story 1.4: Start button disabled when offline
 * - Story 1.4: Offline indicator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScriptureOverview } from '../containers/ScriptureOverview';
import type { ScriptureError } from '../../../services/scriptureReadingService';

// Mock framer-motion (project pattern)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: Record<string, unknown>) => (
      <section {...props}>{children}</section>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useMotionConfig (centralized motion hook — Story 1.5)
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: () => ({
    shouldReduceMotion: false,
    crossfade: { duration: 0.2 },
    slide: { duration: 0.3, ease: 'easeInOut' },
    spring: { type: 'spring', stiffness: 100, damping: 15 },
    fadeIn: { duration: 0.2 },
    modeReveal: { duration: 0.2 },
  }),
}));

// Mock useNetworkStatus
let mockIsOnline = true;
vi.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline, isConnecting: false }),
}));

// Mock the Zustand store
const mockLoadPartner = vi.fn();
const mockSetView = vi.fn();
const mockCreateSession = vi.fn().mockResolvedValue(undefined);
const mockLoadSession = vi.fn().mockResolvedValue(undefined);
const mockAbandonSession = vi.fn().mockResolvedValue(undefined);
const mockClearScriptureError = vi.fn();
const mockCheckForActiveSession = vi.fn().mockResolvedValue(undefined);
const mockClearActiveSession = vi.fn();

const mockStoreState = {
  partner: null as { id: string; displayName: string } | null,
  isLoadingPartner: false,
  loadPartner: mockLoadPartner,
  setView: mockSetView,
  session: null,
  scriptureLoading: false,
  scriptureError: null as ScriptureError | string | null,
  activeSession: null as {
    id: string;
    mode: string;
    currentPhase: string;
    currentStepIndex: number;
    version: number;
    userId: string;
    status: string;
    startedAt: Date;
  } | null,
  isCheckingSession: false,
  createSession: mockCreateSession,
  loadSession: mockLoadSession,
  abandonSession: mockAbandonSession,
  clearScriptureError: mockClearScriptureError,
  checkForActiveSession: mockCheckForActiveSession,
  clearActiveSession: mockClearActiveSession,
};

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

describe('ScriptureOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default state
    mockStoreState.partner = null;
    mockStoreState.isLoadingPartner = false;
    mockStoreState.session = null;
    mockStoreState.scriptureLoading = false;
    mockStoreState.scriptureError = null;
    mockStoreState.activeSession = null;
    mockStoreState.isCheckingSession = false;
    mockIsOnline = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the scripture overview container', () => {
      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-overview')).toBeInTheDocument();
      expect(screen.getByText('Scripture Reading')).toBeInTheDocument();
      expect(screen.getByText('Read and reflect together')).toBeInTheDocument();
    });

    it('should call loadPartner on mount', () => {
      render(<ScriptureOverview />);

      expect(mockLoadPartner).toHaveBeenCalledTimes(1);
    });

    it('should call checkForActiveSession on mount', () => {
      render(<ScriptureOverview />);

      expect(mockCheckForActiveSession).toHaveBeenCalledTimes(1);
    });

    it('should render Start button by default', () => {
      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-start-button')).toBeInTheDocument();
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    it('should NOT render mode cards before Start is tapped', () => {
      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-start-button')).toBeInTheDocument();
      expect(screen.queryByTestId('mode-selection')).not.toBeInTheDocument();
      expect(screen.queryByText('Solo')).not.toBeInTheDocument();
      expect(screen.queryByText('Together')).not.toBeInTheDocument();
    });
  });

  describe('Start Button → Mode Selection Flow (AC #2, #3)', () => {
    it('should show mode selection after Start is tapped', () => {
      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.getByTestId('mode-selection')).toBeInTheDocument();
      expect(screen.getByText('Solo')).toBeInTheDocument();
      expect(screen.getByText('Together')).toBeInTheDocument();
    });

    it('should hide Start button after tapping it', () => {
      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.queryByTestId('scripture-start-button')).not.toBeInTheDocument();
    });

    it('should clear scripture error when Start is tapped', () => {
      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(mockClearScriptureError).toHaveBeenCalled();
    });
  });

  describe('Resume Prompt (AC #6)', () => {
    const incompleteSession = {
      id: 'session-456',
      mode: 'solo' as const,
      currentPhase: 'reading' as const,
      currentStepIndex: 4,
      version: 1,
      userId: 'user-123',
      status: 'in_progress' as const,
      startedAt: new Date(),
    };

    it('should show resume prompt when incomplete solo session exists', () => {
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('resume-prompt')).toBeInTheDocument();
      expect(screen.getByText(/Continue where you left off/)).toBeInTheDocument();
      expect(screen.getByText(/Step 5 of 17/)).toBeInTheDocument();
    });

    it('should hide Start button when resume prompt is shown', () => {
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('resume-prompt')).toBeInTheDocument();
      expect(screen.queryByTestId('scripture-start-button')).not.toBeInTheDocument();
    });

    it('should NOT show resume prompt when no incomplete session', () => {
      mockStoreState.activeSession = null;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-start-button')).toBeInTheDocument();
      expect(screen.queryByTestId('resume-prompt')).not.toBeInTheDocument();
    });

    it('should NOT show resume prompt while session check is in progress', () => {
      mockStoreState.isCheckingSession = true;
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      expect(screen.queryByTestId('resume-prompt')).not.toBeInTheDocument();
    });

    it('should call loadSession with session ID when Continue is tapped', () => {
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('resume-continue'));

      expect(mockLoadSession).toHaveBeenCalledWith('session-456');
    });

    // Story 1.4: "Start fresh" calls abandonSession
    it('should call abandonSession when Start fresh is tapped', async () => {
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('resume-start-fresh'));

      await waitFor(() => {
        expect(mockAbandonSession).toHaveBeenCalledWith('session-456');
      });
    });
  });

  describe('Session Creation via Mode Cards (AC #3, #4, #5)', () => {
    it('should call createSession with solo when Solo card is clicked', () => {
      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const soloButton = screen.getByText('Solo').closest('button');
      fireEvent.click(soloButton!);

      expect(mockCreateSession).toHaveBeenCalledWith('solo');
    });

    it('should call createSession with together and partnerId when Together card is clicked', () => {
      mockStoreState.partner = { id: 'partner-789', displayName: 'Partner' };

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const togetherButton = screen.getByText('Together').closest('button');
      fireEvent.click(togetherButton!);

      expect(mockCreateSession).toHaveBeenCalledWith('together', 'partner-789');
    });
  });

  describe('Loading State During Session Creation', () => {
    it('should show loading indicator during session creation', () => {
      mockStoreState.scriptureLoading = true;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.getByTestId('session-loading')).toBeInTheDocument();
      expect(screen.getByText('Creating session...')).toBeInTheDocument();
    });

    it('should disable mode cards during session creation', () => {
      mockStoreState.scriptureLoading = true;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton).toBeDisabled();
    });

    it('should show Loading text on Continue button during session loading', () => {
      mockStoreState.scriptureLoading = true;
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 4,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Error State Display', () => {
    it('should display error message on session creation failure', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Failed to create session',
      } as ScriptureError;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('session-error')).toBeInTheDocument();
      expect(screen.getByText('Failed to create session')).toBeInTheDocument();
    });

    it('should display string error messages', () => {
      mockStoreState.scriptureError = 'Something went wrong' as unknown as ScriptureError;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('session-error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should have alert role on error display', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Network error',
      } as ScriptureError;

      render(<ScriptureOverview />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Partner Linked State (AC #4)', () => {
    it('should show Together mode as enabled when partner is linked', () => {
      mockStoreState.partner = { id: 'partner-123', displayName: 'Partner' };

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const togetherButton = screen.getByText('Together').closest('button');
      expect(togetherButton).not.toBeDisabled();
      expect(screen.getByText('Read and reflect with your partner in real-time')).toBeInTheDocument();
    });

    it('should NOT show partner link message when partner is linked', () => {
      mockStoreState.partner = { id: 'partner-123', displayName: 'Partner' };

      render(<ScriptureOverview />);

      expect(screen.queryByTestId('link-partner-message')).not.toBeInTheDocument();
    });
  });

  describe('Partner Unlinked State (AC #5)', () => {
    it('should show link partner message when no partner', () => {
      mockStoreState.partner = null;
      mockStoreState.isLoadingPartner = false;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('link-partner-message')).toBeInTheDocument();
      expect(
        screen.getByText('🔗 Link your partner to do this together')
      ).toBeInTheDocument();
    });

    it('should disable Together mode when partner is not linked', () => {
      mockStoreState.partner = null;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const togetherButton = screen.getByText('Together').closest('button');
      expect(togetherButton).toBeDisabled();
      expect(screen.getByText('Link your partner to do this together')).toBeInTheDocument();
    });

    it('should show "Set up partner" link in mode selection for unlinked users', () => {
      mockStoreState.partner = null;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.getByTestId('setup-partner-link')).toBeInTheDocument();
      expect(screen.getByText('Set up partner')).toBeInTheDocument();
    });

    it('should navigate to partner view when "Set up partner" is tapped', () => {
      mockStoreState.partner = null;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));
      fireEvent.click(screen.getByTestId('setup-partner-link'));

      expect(mockSetView).toHaveBeenCalledWith('partner');
    });
  });

  describe('Navigation to Partner Setup', () => {
    it('should navigate to partner view when link message is tapped', () => {
      mockStoreState.partner = null;
      mockStoreState.isLoadingPartner = false;

      render(<ScriptureOverview />);

      const linkButton = screen.getByTestId('link-partner-message');
      fireEvent.click(linkButton);

      expect(mockSetView).toHaveBeenCalledWith('partner');
    });
  });

  describe('Loading State (Partner)', () => {
    it('should show skeleton loader while partner status is loading', () => {
      mockStoreState.isLoadingPartner = true;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('partner-status-skeleton')).toBeInTheDocument();
    });

    it('should NOT show link partner message while loading', () => {
      mockStoreState.isLoadingPartner = true;

      render(<ScriptureOverview />);

      expect(screen.queryByTestId('link-partner-message')).not.toBeInTheDocument();
    });
  });

  describe('Lavender Dreams Styling (AC #2)', () => {
    it('should apply lavender background color', () => {
      render(<ScriptureOverview />);

      const container = screen.getByTestId('scripture-overview');
      expect(container).toHaveStyle({ backgroundColor: '#F3E5F5' });
    });

    it('should use purple color theme for header', () => {
      render(<ScriptureOverview />);

      const header = screen.getByText('Scripture Reading');
      expect(header).toHaveClass('text-purple-900');
    });

    it('should use Playfair Display for heading', () => {
      render(<ScriptureOverview />);

      const header = screen.getByText('Scripture Reading');
      expect(header).toHaveClass('font-serif');
    });

    it('should apply glass morphism to mode cards', () => {
      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton).toHaveClass('backdrop-blur-sm');
    });

    it('should apply glass morphism to resume prompt', () => {
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);

      const resumePrompt = screen.getByTestId('resume-prompt');
      expect(resumePrompt).toHaveClass('backdrop-blur-sm');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible section labels', () => {
      render(<ScriptureOverview />);

      expect(screen.getByLabelText('Partner status')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.getByLabelText('Choose reading mode')).toBeInTheDocument();
    });

    it('should have accessible button labels in mode selection', () => {
      mockStoreState.partner = { id: 'partner-123', displayName: 'Partner' };

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('scripture-start-button'));

      expect(screen.getByRole('button', { name: /solo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /together/i })).toBeInTheDocument();
    });

    it('should have accessible resume section label', () => {
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);

      expect(screen.getByLabelText('Resume session')).toBeInTheDocument();
    });

    it('should have alert role on error messages', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Test error',
      } as ScriptureError;

      render(<ScriptureOverview />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Session Check Edge Cases (M3)', () => {
    it('should show loading skeleton when session check is in progress', () => {
      mockStoreState.isCheckingSession = true;
      mockStoreState.activeSession = null;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('session-check-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('scripture-start-button')).not.toBeInTheDocument();
    });

    it('should gracefully handle checkForActiveSession being called (no crash)', () => {
      mockCheckForActiveSession.mockResolvedValue(undefined);

      render(<ScriptureOverview />);

      expect(mockCheckForActiveSession).toHaveBeenCalled();
      expect(screen.getByTestId('scripture-overview')).toBeInTheDocument();
    });

    it('should show Start button when activeSession is null after check completes', () => {
      mockStoreState.isCheckingSession = false;
      mockStoreState.activeSession = null;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-start-button')).toBeInTheDocument();
      expect(screen.queryByTestId('resume-prompt')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Story 1.4: Offline Behavior (AC #4)
  // ============================================

  describe('Offline Behavior', () => {
    it('should disable Start button when offline', () => {
      mockIsOnline = false;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('scripture-start-button')).toBeDisabled();
    });

    it('should show offline indicator when offline', () => {
      mockIsOnline = false;

      render(<ScriptureOverview />);

      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
    });

    it('should hide offline indicator when online', () => {
      mockIsOnline = true;

      render(<ScriptureOverview />);

      expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
    });


    it('should disable mode cards when offline', () => {
      // Start online, click Start to show modes, then go offline
      mockIsOnline = true;
      const { rerender } = render(<ScriptureOverview />);
      fireEvent.click(screen.getByTestId('scripture-start-button'));

      // Now go offline and rerender
      mockIsOnline = false;
      rerender(<ScriptureOverview />);

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton).toBeDisabled();
    });

    it('should still allow Continue when offline (cache-only load)', () => {
      mockIsOnline = false;
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 4,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);

      const continueButton = screen.getByTestId('resume-continue');
      expect(continueButton).not.toBeDisabled();
    });
  });

  // ============================================
  // Story 1.5: Accessibility Enhancements
  // ============================================

  describe('Story 1.5: Accessibility Enhancements', () => {
    it('uses main element instead of div as outer container', () => {
      render(<ScriptureOverview />);
      const overview = screen.getByTestId('scripture-overview');
      expect(overview.tagName).toBe('MAIN');
    });

    it('sr-announcer region exists with aria-live="polite"', () => {
      render(<ScriptureOverview />);
      const announcer = screen.getByTestId('sr-announcer');
      expect(announcer).toBeInTheDocument();
      expect(announcer.getAttribute('aria-live')).toBe('polite');
      expect(announcer.getAttribute('aria-atomic')).toBe('true');
    });

    it('start button has focus-visible ring classes', () => {
      render(<ScriptureOverview />);
      const btn = screen.getByTestId('scripture-start-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('continue button has focus-visible ring classes', () => {
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 4,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);
      const btn = screen.getByTestId('resume-continue');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('start fresh button has focus-visible ring classes', () => {
      mockStoreState.activeSession = {
        id: 'session-456',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 4,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      };

      render(<ScriptureOverview />);
      const btn = screen.getByTestId('resume-start-fresh');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('error indicator includes warning icon', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Failed to create session',
      } as unknown as typeof mockStoreState.scriptureError;

      render(<ScriptureOverview />);
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('setup partner link has min-h-[44px] for touch target', () => {
      mockStoreState.partner = null;

      render(<ScriptureOverview />);
      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const link = screen.getByTestId('setup-partner-link');
      expect(link.className.includes('min-h-[44px]')).toBe(true);
    });

    it('mode card buttons have focus-visible ring classes', () => {
      render(<ScriptureOverview />);
      fireEvent.click(screen.getByTestId('scripture-start-button'));

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton!.className.includes('focus-visible:ring-2')).toBe(true);
      expect(soloButton!.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(soloButton!.className.includes('focus-visible:ring-offset-2')).toBe(true);

      const togetherButton = screen.getByText('Together').closest('button');
      expect(togetherButton!.className.includes('focus-visible:ring-2')).toBe(true);
      expect(togetherButton!.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(togetherButton!.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });
  });
});
