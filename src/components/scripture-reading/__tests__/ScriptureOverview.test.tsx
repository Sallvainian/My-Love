/**
 * ScriptureOverview Component Tests
 *
 * Story 1.1 + 1.2: Navigation Entry Point & Overview Page
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
 *
 * Note: Story 1.1 had 45 tests. Story 1.2 rewrote tests to match new Start→mode
 * flow and added session resume coverage (40 tests). Code review follow-ups added
 * session check failure tests (M3). Previous test count difference (45→40) was due
 * to consolidating redundant partner-state tests and removing offline-indicator tests
 * for dead code that was later removed (M2).
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
  useReducedMotion: () => false,
}));

// Mock the Zustand store
const mockLoadPartner = vi.fn();
const mockSetView = vi.fn();
const mockCreateSession = vi.fn().mockResolvedValue(undefined);
const mockLoadSession = vi.fn().mockResolvedValue(undefined);
const mockExitSession = vi.fn();
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
  exitSession: mockExitSession,
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

    it('should call exitSession when Start fresh is tapped', () => {
      mockStoreState.activeSession = incompleteSession;

      render(<ScriptureOverview />);

      fireEvent.click(screen.getByTestId('resume-start-fresh'));

      expect(mockExitSession).toHaveBeenCalled();
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
      // Simulate the checkForActiveSession being a no-op (already resolved)
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
});
