/**
 * SoloReadingFlow Component Tests
 *
 * Story 1.3: Solo Reading Flow
 * Story 1.4: Save, Resume & Optimistic UI
 *
 * Unit tests for the step-by-step scripture reading experience.
 *
 * Tests:
 * - Verse screen rendering (reference, text, buttons)
 * - Response screen rendering (prayer text, buttons)
 * - Navigation between verse and response (crossfade)
 * - Step advancement (next verse)
 * - Progress indicator updates
 * - Session completion at step 17
 * - Exit confirmation dialog
 * - Save & Exit functionality
 * - Error and syncing states
 * - Accessibility (aria labels, dialog, roles)
 * - Reduced motion support
 * - Story 1.4: Offline indicator (AC #4)
 * - Story 1.4: Next Verse disabled when offline
 * - Story 1.4: Retry UI (AC #6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SoloReadingFlow } from '../containers/SoloReadingFlow';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';

// Mock framer-motion (project pattern)
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      // Filter out framer-motion specific props
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        variants: _variants,
        custom: _custom,
        ...htmlProps
      } = props;
      return <div {...htmlProps}>{children}</div>;
    },
    section: ({ children, ...props }: Record<string, unknown>) => {
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...htmlProps
      } = props;
      return <section {...htmlProps}>{children}</section>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  domAnimation: {},
}));

// Mock useMotionConfig (centralized motion hook — Story 1.5)
let mockShouldReduceMotion = false;
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: () => ({
    shouldReduceMotion: mockShouldReduceMotion,
    crossfade: mockShouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    slide: mockShouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' },
    spring: mockShouldReduceMotion
      ? { duration: 0 }
      : { type: 'spring', stiffness: 100, damping: 15 },
    fadeIn: mockShouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    modeReveal: mockShouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
  }),
}));

// Mock useNetworkStatus
let mockIsOnline = true;
vi.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mockIsOnline, isConnecting: false }),
}));

// Mock useAutoSave
const mockUseAutoSave = vi.fn();
vi.mock('../../../hooks/useAutoSave', () => ({
  useAutoSave: (...args: unknown[]) => mockUseAutoSave(...args),
}));

// Story 2.1 + 2.3: Mock scriptureReadingService
const mockGetBookmarksBySession = vi.fn().mockResolvedValue([]);
const mockToggleBookmark = vi.fn().mockResolvedValue(undefined);
const mockAddReflection = vi.fn().mockResolvedValue(undefined);
const mockUpdateSessionBookmarkSharing = vi.fn().mockResolvedValue(undefined);
const mockUpdateSession = vi.fn().mockResolvedValue(undefined);
const mockAddMessage = vi
  .fn()
  .mockResolvedValue({
    id: 'msg-1',
    sessionId: 'session-123',
    senderId: 'user-456',
    message: 'test',
    createdAt: new Date(),
  });
const mockGetSessionReportData = vi.fn().mockResolvedValue({
  reflections: [],
  bookmarks: [],
  messages: [],
});
vi.mock('../../../services/scriptureReadingService', () => ({
  scriptureReadingService: {
    getBookmarksBySession: (...args: unknown[]) => mockGetBookmarksBySession(...args),
    toggleBookmark: (...args: unknown[]) => mockToggleBookmark(...args),
    addReflection: (...args: unknown[]) => mockAddReflection(...args),
    updateSessionBookmarkSharing: (...args: unknown[]) =>
      mockUpdateSessionBookmarkSharing(...args),
    updateSession: (...args: unknown[]) => mockUpdateSession(...args),
    addMessage: (...args: unknown[]) => mockAddMessage(...args),
    getSessionReportData: (...args: unknown[]) => mockGetSessionReportData(...args),
  },
  handleScriptureError: vi.fn(),
  ScriptureErrorCode: {
    VERSION_MISMATCH: 'VERSION_MISMATCH',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SYNC_FAILED: 'SYNC_FAILED',
    OFFLINE: 'OFFLINE',
    CACHE_CORRUPTED: 'CACHE_CORRUPTED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
  },
}));

// Mock Zustand store
const mockAdvanceStep = vi.fn().mockResolvedValue(undefined);
const mockSaveAndExit = vi.fn().mockResolvedValue(undefined);
const mockSaveSession = vi.fn().mockResolvedValue(undefined);
const mockExitSession = vi.fn();
const mockRetryFailedWrite = vi.fn().mockResolvedValue(undefined);
const mockUpdatePhase = vi.fn();

interface MockSession {
  id: string;
  mode: 'solo' | 'together';
  userId: string;
  currentPhase: string;
  currentStepIndex: number;
  status: string;
  version: number;
  startedAt: Date;
  completedAt?: Date;
}

interface MockPendingRetry {
  type: 'advanceStep' | 'saveSession' | 'reflection';
  attempts: number;
  maxAttempts: number;
}

interface MockPartner {
  id: string;
  displayName: string;
  email: string;
  connectedAt: Date;
}

const mockStoreState: {
  session: MockSession | null;
  isSyncing: boolean;
  scriptureError: { code: string; message: string } | null;
  pendingRetry: MockPendingRetry | null;
  advanceStep: typeof mockAdvanceStep;
  saveAndExit: typeof mockSaveAndExit;
  saveSession: typeof mockSaveSession;
  exitSession: typeof mockExitSession;
  retryFailedWrite: typeof mockRetryFailedWrite;
  updatePhase: typeof mockUpdatePhase;
  partner: MockPartner | null;
  isLoadingPartner: boolean;
} = {
  session: null,
  isSyncing: false,
  scriptureError: null,
  pendingRetry: null,
  advanceStep: mockAdvanceStep,
  saveAndExit: mockSaveAndExit,
  saveSession: mockSaveSession,
  exitSession: mockExitSession,
  retryFailedWrite: mockRetryFailedWrite,
  updatePhase: mockUpdatePhase,
  partner: null,
  isLoadingPartner: false,
};

// Create a function to get state for the useAppStore mock
const getStoreState = () => mockStoreState;

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn((selector: (state: typeof mockStoreState) => unknown) => selector(getStoreState())),
    {
      getState: () => getStoreState(),
    }
  ),
}));

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    id: 'session-123',
    mode: 'solo',
    userId: 'user-456',
    currentPhase: 'reading',
    currentStepIndex: 0,
    status: 'in_progress',
    version: 1,
    startedAt: new Date('2026-01-31'),
    ...overrides,
  };
}

describe('SoloReadingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionReportData.mockResolvedValue({
      reflections: [],
      bookmarks: [],
      messages: [],
    });
    mockStoreState.session = createMockSession();
    mockStoreState.isSyncing = false;
    mockStoreState.scriptureError = null;
    mockStoreState.pendingRetry = null;
    mockStoreState.partner = null;
    mockStoreState.isLoadingPartner = false;
    mockShouldReduceMotion = false;
    mockIsOnline = true;
  });

  // ============================================
  // Rendering - Verse Screen
  // ============================================

  describe('Verse Screen', () => {
    it('renders the verse screen by default', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('verse-screen')).toBeDefined();
      expect(screen.getByTestId('solo-reading-flow')).toBeDefined();
    });

    it('displays the verse reference', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-verse-reference')).toHaveTextContent(
        SCRIPTURE_STEPS[0].verseReference
      );
    });

    it('displays the verse text prominently', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-verse-text')).toHaveTextContent(
        SCRIPTURE_STEPS[0].verseText
      );
    });

    it('shows View Response button', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-view-response-button')).toHaveTextContent(
        'View Response'
      );
    });

    it('shows Next Verse button', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-next-verse-button')).toHaveTextContent('Next Verse');
    });

    it('displays correct verse for non-zero step index', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 5 });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-verse-reference')).toHaveTextContent(
        SCRIPTURE_STEPS[5].verseReference
      );
      expect(screen.getByTestId('scripture-verse-text')).toHaveTextContent(
        SCRIPTURE_STEPS[5].verseText
      );
    });
  });

  // ============================================
  // Rendering - Response Screen
  // ============================================

  describe('Response Screen', () => {
    it('renders response screen after tapping View Response', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('response-screen')).toBeDefined();
    });

    it('displays the response prayer text', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('scripture-response-text')).toHaveTextContent(
        SCRIPTURE_STEPS[0].responseText
      );
    });

    it('shows the verse reference as context on response screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('scripture-response-verse-reference')).toHaveTextContent(
        `Response to ${SCRIPTURE_STEPS[0].verseReference}`
      );
    });

    it('shows Back to Verse button on response screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('scripture-back-to-verse-button')).toHaveTextContent(
        'Back to Verse'
      );
    });

    it('shows Next Verse button on response screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('scripture-next-verse-button')).toHaveTextContent('Next Verse');
    });

    it('returns to verse screen when Back to Verse is tapped', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('response-screen')).toBeDefined();
      fireEvent.click(screen.getByTestId('scripture-back-to-verse-button'));
      expect(screen.getByTestId('verse-screen')).toBeDefined();
    });
  });

  // ============================================
  // Progress Indicator
  // ============================================

  describe('Progress Indicator', () => {
    it('shows progress as "Verse 1 of 17" for first step', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-progress-indicator')).toHaveTextContent('Verse 1 of 17');
    });

    it('shows correct progress for step 5', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 4 });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-progress-indicator')).toHaveTextContent('Verse 5 of 17');
    });

    it('shows progress as "Verse 17 of 17" for last step', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 16 });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-progress-indicator')).toHaveTextContent(
        'Verse 17 of 17'
      );
    });

    it('has accessible label for screen readers', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 4 });
      render(<SoloReadingFlow />);
      const indicator = screen.getByTestId('scripture-progress-indicator');
      expect(indicator.getAttribute('aria-label')).toBe('Currently on verse 5 of 17');
    });

    it('displays the section theme', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('section-theme')).toHaveTextContent(
        SCRIPTURE_STEPS[0].sectionTheme
      );
    });
  });

  // ============================================
  // Step Advancement
  // ============================================

  describe('Step Advancement', () => {
    it('shows reflection screen when Next Verse is tapped on verse screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      expect(screen.getByTestId('reflection-subview')).toBeDefined();
      expect(screen.getByTestId('scripture-reflection-screen')).toBeDefined();
    });

    it('shows reflection screen when Next Verse is tapped on response screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      expect(screen.getByTestId('reflection-subview')).toBeDefined();
    });

    it('calls advanceStep after reflection Continue is submitted', async () => {
      render(<SoloReadingFlow />);
      // Go to reflection
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      // Select a rating
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      // Submit reflection
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      // advanceStep is called after reflection submit
      await vi.waitFor(() => {
        expect(mockAdvanceStep).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Complete Reading" on last step instead of "Next Verse"', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 16 });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-next-verse-button')).toHaveTextContent(
        'Complete Reading'
      );
    });

    it('disables Next Verse button while syncing', () => {
      mockStoreState.isSyncing = true;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-next-verse-button')).toBeDisabled();
    });
  });

  // ============================================
  // Session Completion
  // ============================================

  describe('Session Completion', () => {
    it('shows ReflectionSummary when phase is reflection', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-completion-screen')).toBeDefined();
      expect(screen.getByTestId('scripture-reflection-summary-screen')).toBeDefined();
    });

    it('shows unlinked completion screen when phase is report and no partner', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-unlinked-complete-screen')).toBeDefined();
      expect(screen.getByText('Session complete')).toBeDefined();
    });

    it('shows "Session complete" heading on report phase for unlinked user', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      expect(screen.getByText('Session complete')).toBeDefined();
    });

    it('shows reflections saved message on report phase for unlinked user', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      expect(screen.getByText(/Your reflections have been saved/i)).toBeDefined();
    });

    it('shows Return to Overview button on report phase for unlinked user', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-unlinked-return-btn')).toHaveTextContent(
        'Return to Overview'
      );
    });

    it('calls exitSession when Return to Overview is tapped on report phase for unlinked user', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-unlinked-return-btn'));
      expect(mockExitSession).toHaveBeenCalledTimes(1);
    });

    it('shows ReflectionSummary for reflection phase with in_progress status', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
      });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-completion-screen')).toBeDefined();
      expect(screen.getByTestId('scripture-reflection-summary-screen')).toBeDefined();
    });
  });

  // ============================================
  // Exit Confirmation
  // ============================================

  describe('Exit Confirmation', () => {
    it('shows exit button in header', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('exit-button')).toBeDefined();
    });

    it('exit button has accessible label', () => {
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('exit-button').getAttribute('aria-label')).toBe('Exit reading');
    });

    it('shows exit confirmation dialog when exit button is tapped', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
    });

    it('dialog shows "Save your progress?" title', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByText('Save your progress?')).toBeDefined();
    });

    it('dialog shows AC-spec description text', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByText('Save your progress? You can continue later.')).toBeDefined();
    });

    it('dialog has Save & Exit button', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('save-and-exit-button')).toHaveTextContent('Save & Exit');
    });

    it('dialog has Cancel button', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('cancel-exit-button')).toHaveTextContent('Cancel');
    });

    it('calls saveAndExit when Save & Exit is tapped', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      fireEvent.click(screen.getByTestId('save-and-exit-button'));
      expect(mockSaveAndExit).toHaveBeenCalledTimes(1);
    });

    it('closes dialog when Cancel is tapped', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
      fireEvent.click(screen.getByTestId('cancel-exit-button'));
      expect(screen.queryByTestId('exit-confirm-dialog')).toBeNull();
    });

    it('closes dialog when Escape key is pressed', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('exit-confirm-dialog')).toBeNull();
    });

    it('closes dialog when backdrop overlay is clicked', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
      fireEvent.click(screen.getByTestId('exit-confirm-overlay'));
      expect(screen.queryByTestId('exit-confirm-dialog')).toBeNull();
    });

    it('does not close dialog when dialog body is clicked', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
      fireEvent.click(screen.getByTestId('exit-confirm-dialog'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
    });

    it('dialog has proper ARIA attributes', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      const dialog = screen.getByTestId('exit-confirm-dialog');
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('exit-dialog-title');
      expect(dialog.getAttribute('aria-describedby')).toBe('exit-dialog-desc');
    });

    it('Save & Exit shows "Saving..." when syncing', () => {
      mockStoreState.isSyncing = true;
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('save-and-exit-button')).toHaveTextContent('Saving...');
    });

    it('Save & Exit button is disabled while syncing', () => {
      mockStoreState.isSyncing = true;
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('save-and-exit-button')).toBeDisabled();
    });
  });

  // ============================================
  // Error and Syncing States
  // ============================================

  describe('Error and Syncing States', () => {
    it('shows syncing indicator when isSyncing is true', () => {
      mockStoreState.isSyncing = true;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('sync-indicator')).toHaveTextContent('Saving...');
    });

    it('does not show syncing indicator when not syncing', () => {
      render(<SoloReadingFlow />);
      expect(screen.queryByTestId('sync-indicator')).toBeNull();
    });

    it('shows error message when scriptureError is set and no pendingRetry', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Failed to save step progress',
      };
      mockStoreState.pendingRetry = null;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('reading-error')).toHaveTextContent('Failed to save step progress');
    });

    it('error message has alert role for accessibility', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Network error',
      };
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('reading-error').getAttribute('role')).toBe('alert');
    });

    it('does not show error when no error exists', () => {
      render(<SoloReadingFlow />);
      expect(screen.queryByTestId('reading-error')).toBeNull();
    });

    it('does not show error banner when pendingRetry is active (retry banner shows instead)', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Failed to save',
      };
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 1, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      expect(screen.queryByTestId('reading-error')).toBeNull();
      expect(screen.getByTestId('retry-banner')).toBeDefined();
    });
  });

  // ============================================
  // Null Session Guard
  // ============================================

  describe('Null Session Guard', () => {
    it('renders nothing when session is null', () => {
      mockStoreState.session = null;
      const { container } = render(<SoloReadingFlow />);
      expect(container.innerHTML).toBe('');
    });
  });

  // ============================================
  // Lavender Dreams Styling
  // ============================================

  describe('Lavender Dreams Styling', () => {
    it('uses Lavender Dreams background color', () => {
      render(<SoloReadingFlow />);
      const container = screen.getByTestId('solo-reading-flow');
      // happy-dom may return hex or rgb depending on environment
      const bgColor = container.style.backgroundColor;
      expect(bgColor === '#F3E5F5' || bgColor === 'rgb(243, 229, 245)').toBe(true);
    });

    it('verse text uses serif font for Playfair Display', () => {
      render(<SoloReadingFlow />);
      const verseText = screen.getByTestId('scripture-verse-text').querySelector('p');
      expect(verseText?.className).toContain('font-serif');
    });

    it('verse text container has glass morphism styling', () => {
      render(<SoloReadingFlow />);
      const verseContainer = screen.getByTestId('scripture-verse-text');
      expect(verseContainer.className).toContain('backdrop-blur-sm');
      expect(verseContainer.className).toContain('rounded-2xl');
    });
  });

  // ============================================
  // All 17 Steps Data Integrity
  // ============================================

  describe('Data Integrity', () => {
    it('has exactly 17 scripture steps', () => {
      expect(SCRIPTURE_STEPS.length).toBe(17);
      expect(MAX_STEPS).toBe(17);
    });

    it('renders correctly for each step index', () => {
      // Test a few representative steps across sections
      const testIndices = [0, 3, 6, 9, 12, 15, 16];

      for (const idx of testIndices) {
        mockStoreState.session = createMockSession({ currentStepIndex: idx });
        const { unmount } = render(<SoloReadingFlow />);
        expect(screen.getByTestId('scripture-verse-reference')).toHaveTextContent(
          SCRIPTURE_STEPS[idx].verseReference
        );
        unmount();
      }
    });
  });

  // ============================================
  // M7: Reduced Motion Support
  // ============================================

  describe('Reduced Motion', () => {
    it('uses zero-duration animations when reduced motion preference is on', () => {
      mockShouldReduceMotion = true;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('solo-reading-flow')).toBeDefined();
      expect(screen.getByTestId('verse-screen')).toBeDefined();

      // Navigation should still work with reduced motion
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('response-screen')).toBeDefined();

      // Exit dialog should still work
      fireEvent.click(screen.getByTestId('scripture-back-to-verse-button'));
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('exit-confirm-dialog')).toBeDefined();
    });
  });

  // ============================================
  // Story 1.4: Offline Indicator (AC #4)
  // ============================================

  describe('Offline Indicator', () => {
    it('shows offline indicator when offline', () => {
      mockIsOnline = false;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('offline-indicator')).toBeDefined();
      expect(screen.getByText(/You're offline/)).toBeDefined();
    });

    it('hides offline indicator when online', () => {
      mockIsOnline = true;
      render(<SoloReadingFlow />);
      expect(screen.queryByTestId('offline-indicator')).toBeNull();
    });

    it('offline indicator has role=status and aria-live=polite', () => {
      mockIsOnline = false;
      render(<SoloReadingFlow />);
      const indicator = screen.getByTestId('offline-indicator');
      expect(indicator.getAttribute('role')).toBe('status');
      expect(indicator.getAttribute('aria-live')).toBe('polite');
    });

    it('disables Next Verse button when offline', () => {
      mockIsOnline = false;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-next-verse-button')).toBeDisabled();
    });

    it('View Response button still works when offline', () => {
      mockIsOnline = false;
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      expect(screen.getByTestId('response-screen')).toBeDefined();
    });
  });

  // ============================================
  // Story 1.4: Retry UI (AC #6)
  // ============================================

  describe('Retry UI', () => {
    it('shows retry banner when pendingRetry is present', () => {
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 1, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('retry-banner')).toBeDefined();
      expect(screen.getByText('Save failed. Tap to retry.')).toBeDefined();
    });

    it('shows retry button with attempt count', () => {
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 1, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('retry-button')).toHaveTextContent('Retry (1/3)');
    });

    it('calls retryFailedWrite when retry button is tapped', () => {
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 1, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('retry-button'));
      expect(mockRetryFailedWrite).toHaveBeenCalledTimes(1);
    });

    it('shows max attempts message when retries exhausted', () => {
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 3, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('retry-banner')).toBeDefined();
      expect(screen.getByText('Save failed. Your progress is saved locally.')).toBeDefined();
      expect(screen.queryByTestId('retry-button')).toBeNull();
    });

    it('does not show retry banner when no pendingRetry', () => {
      mockStoreState.pendingRetry = null;
      render(<SoloReadingFlow />);
      expect(screen.queryByTestId('retry-banner')).toBeNull();
    });
  });

  // ============================================
  // Story 1.4: useAutoSave wiring
  // ============================================

  describe('useAutoSave wiring', () => {
    it('calls useAutoSave with session and saveSession', () => {
      render(<SoloReadingFlow />);
      expect(mockUseAutoSave).toHaveBeenCalledWith({
        session: mockStoreState.session,
        saveSession: mockSaveSession,
      });
    });

    it('calls useAutoSave even when session is null', () => {
      mockStoreState.session = null;
      render(<SoloReadingFlow />);
      expect(mockUseAutoSave).toHaveBeenCalledWith({
        session: null,
        saveSession: mockSaveSession,
      });
    });
  });

  // ============================================
  // Story 1.5: Keyboard Focus Styles (AC #1)
  // ============================================

  describe('Story 1.5: Keyboard Focus Styles (AC #1)', () => {
    it('exit button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      const btn = screen.getByTestId('exit-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('view response button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      const btn = screen.getByTestId('scripture-view-response-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('next verse button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      const btn = screen.getByTestId('scripture-next-verse-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('back to verse button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      const btn = screen.getByTestId('scripture-back-to-verse-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('retry button has focus-visible ring classes', () => {
      mockStoreState.pendingRetry = { type: 'advanceStep', attempts: 1, maxAttempts: 3 };
      render(<SoloReadingFlow />);
      const btn = screen.getByTestId('retry-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });
  });

  // ============================================
  // Story 1.5: Screen Reader Announcements (AC #2)
  // ============================================

  describe('Story 1.5: Screen Reader Announcements (AC #2)', () => {
    it('sr-announcer region exists with aria-live="polite"', () => {
      render(<SoloReadingFlow />);
      const announcer = screen.getByTestId('sr-announcer');
      expect(announcer).toBeDefined();
      expect(announcer.getAttribute('aria-live')).toBe('polite');
    });

    it('sr-announcer region has aria-atomic="true"', () => {
      render(<SoloReadingFlow />);
      const announcer = screen.getByTestId('sr-announcer');
      expect(announcer.getAttribute('aria-atomic')).toBe('true');
    });

    it('progress indicator has aria-current="step"', () => {
      render(<SoloReadingFlow />);
      const indicator = screen.getByTestId('scripture-progress-indicator');
      expect(indicator.getAttribute('aria-current')).toBe('step');
    });
  });

  // ============================================
  // Story 1.5: Focus Management (AC #3)
  // ============================================

  describe('Story 1.5: Focus Management (AC #3)', () => {
    // Mock requestAnimationFrame to execute synchronously for focus tests
    let originalRAF: typeof requestAnimationFrame;

    beforeEach(() => {
      originalRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = originalRAF;
    });

    it('verse reference has tabIndex={-1} for programmatic focus', () => {
      render(<SoloReadingFlow />);
      const verseRef = screen.getByTestId('scripture-verse-reference');
      expect(verseRef.getAttribute('tabindex')).toBe('-1');
    });

    it('unlinked completion heading has tabIndex={-1}', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      const heading = screen.getByTestId('scripture-unlinked-complete-heading');
      expect(heading.getAttribute('tabindex')).toBe('-1');
      expect(heading).toHaveTextContent('Session complete');
    });

    it('focuses Back to Verse button after View Response click', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      const backBtn = screen.getByTestId('scripture-back-to-verse-button');
      expect(document.activeElement).toBe(backBtn);
    });

    it('focuses verse heading after Back to Verse click', () => {
      render(<SoloReadingFlow />);
      // Go to response screen first
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      // Go back to verse
      fireEvent.click(screen.getByTestId('scripture-back-to-verse-button'));
      const verseRef = screen.getByTestId('scripture-verse-reference');
      expect(document.activeElement).toBe(verseRef);
    });

    it('focuses verse heading after reflection submit advances step', async () => {
      // Start at step 0, advance to step 1 after reflection
      mockAdvanceStep.mockImplementation(async () => {
        mockStoreState.session = createMockSession({ currentStepIndex: 1 });
      });
      const { rerender } = render(<SoloReadingFlow />);
      // Go to reflection
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      // Select a rating and submit
      fireEvent.click(screen.getByTestId('scripture-rating-3'));
      fireEvent.click(screen.getByTestId('scripture-reflection-continue'));
      // Wait for advanceStep to complete
      await vi.waitFor(() => {
        expect(mockAdvanceStep).toHaveBeenCalledTimes(1);
      });
      // Re-render to trigger effects with new step index
      mockStoreState.session = createMockSession({ currentStepIndex: 1 });
      rerender(<SoloReadingFlow />);
      const verseRef = screen.getByTestId('scripture-verse-reference');
      expect(document.activeElement).toBe(verseRef);
    });
  });

  // ============================================
  // Story 1.5: Color Independence (AC #5)
  // ============================================

  describe('Story 1.5: Color Independence (AC #5)', () => {
    it('error indicator includes icon element', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Something went wrong',
      };
      mockStoreState.pendingRetry = null;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('error-icon')).toBeDefined();
    });

    it('disabled button shows helper text when offline', () => {
      mockIsOnline = false;
      render(<SoloReadingFlow />);
      const reason = screen.getByTestId('disabled-reason');
      expect(reason).toBeDefined();
      expect(reason).toHaveTextContent('Connect to internet to continue');
    });

    it('section theme uses text-purple-600', () => {
      render(<SoloReadingFlow />);
      const theme = screen.getByTestId('section-theme');
      expect(theme.className.includes('text-purple-600')).toBe(true);
      expect(theme.className.includes('text-purple-400')).toBe(false);
    });

    it('verse reference uses text-purple-600', () => {
      render(<SoloReadingFlow />);
      const verseRef = screen.getByTestId('scripture-verse-reference');
      expect(verseRef.className.includes('text-purple-600')).toBe(true);
      expect(verseRef.className.includes('text-purple-500')).toBe(false);
    });

    it('syncing indicator uses text-purple-600', () => {
      mockStoreState.isSyncing = true;
      render(<SoloReadingFlow />);
      const syncIndicator = screen.getByTestId('sync-indicator');
      expect(syncIndicator.className.includes('text-purple-600')).toBe(true);
      expect(syncIndicator.className.includes('text-purple-400')).toBe(false);
    });
  });

  // ============================================
  // Story 1.5: Dialog Accessibility (AC #1, #8)
  // ============================================

  describe('Story 1.5: Dialog Accessibility (AC #1, #8)', () => {
    it('dialog element exists when exit button is clicked', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      const dialog = screen.getByTestId('exit-confirm-dialog');
      expect(dialog).toBeDefined();
      expect(dialog.getAttribute('role')).toBe('dialog');
    });

    it('save-and-exit button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      const btn = screen.getByTestId('save-and-exit-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });

    it('cancel button has focus-visible ring classes', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      const btn = screen.getByTestId('cancel-exit-button');
      expect(btn.className.includes('focus-visible:ring-2')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-purple-400')).toBe(true);
      expect(btn.className.includes('focus-visible:ring-offset-2')).toBe(true);
    });
  });

  // ============================================
  // Story 1.5: Reduced Motion via useMotionConfig (AC #4)
  // ============================================

  describe('Story 1.5: Reduced Motion via useMotionConfig (AC #4)', () => {
    it('renders correctly with reduced motion enabled via useMotionConfig', () => {
      mockShouldReduceMotion = true;
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('solo-reading-flow')).toBeDefined();
      expect(screen.getByTestId('verse-screen')).toBeDefined();
      expect(screen.getByTestId('scripture-verse-reference')).toBeDefined();
      expect(screen.getByTestId('scripture-next-verse-button')).toBeDefined();
    });
  });

  // ============================================
  // Story 2.2: Reflection Summary
  // ============================================

  describe('Story 2.2: Reflection Summary', () => {
    it('shows ReflectionSummary when phase is reflection (2.2-CMP-012)', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Should show ReflectionSummary component instead of old placeholder
      expect(screen.getByTestId('scripture-reflection-summary-screen')).toBeDefined();
      expect(screen.getByTestId('scripture-reflection-summary-heading')).toHaveTextContent(
        'Your Session'
      );
      // Should NOT show the old completion placeholder text
      expect(screen.queryByText('Reflection summary coming in Story 2.2')).toBeNull();
    });

    it('calls updatePhase with report after reflection summary submission (2.2-CMP-018)', async () => {
      // Mock requestAnimationFrame for focus tests
      const origRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };

      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      // Provide bookmarks so verse selection is available
      mockGetBookmarksBySession.mockResolvedValue([{ stepIndex: 0, userId: 'user-456' }]);
      render(<SoloReadingFlow />);
      // Wait for async bookmark loading to complete
      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-standout-verse-0')).toBeDefined();
      });
      // Select a standout verse
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      // Select a session rating
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      // Submit the reflection summary
      fireEvent.click(screen.getByTestId('scripture-reflection-summary-continue'));
      // Verify updatePhase was called with 'report'
      expect(mockUpdatePhase).toHaveBeenCalledWith('report');
      await vi.waitFor(() => {
        expect(mockUpdateSessionBookmarkSharing).toHaveBeenCalledWith(
          'session-123',
          'user-456',
          false
        );
      });

      globalThis.requestAnimationFrame = origRAF;
    });

    it('shows unlinked completion when phase is report and no partner (2.2-CMP-013)', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      mockStoreState.partner = null;
      render(<SoloReadingFlow />);
      // Should show unlinked completion (placeholder replaced by Story 2.3)
      expect(screen.getByTestId('scripture-unlinked-complete-screen')).toBeDefined();
      expect(screen.getByText('Session complete')).toBeDefined();
      // Should have Return to Overview button
      expect(screen.getByTestId('scripture-unlinked-return-btn')).toBeDefined();
      // Should NOT show the ReflectionSummary
      expect(screen.queryByTestId('scripture-reflection-summary-screen')).toBeNull();
    });
  });

  // ============================================
  // Story 2.3: Daily Prayer Report
  // ============================================

  describe('Story 2.3: Daily Prayer Report', () => {
    const linkedPartner: MockPartner = {
      id: 'partner-1',
      displayName: 'Sarah',
      email: 'sarah@example.com',
      connectedAt: new Date('2026-01-15'),
    };

    it('shows MessageCompose when phase is report and partner exists (2.3-INT-002)', () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Should show MessageCompose screen instead of placeholder
      expect(screen.getByTestId('scripture-message-compose-screen')).toBeDefined();
      // Should NOT show unlinked completion
      expect(screen.queryByTestId('scripture-unlinked-complete-screen')).toBeNull();
    });

    it('shows unlinked completion screen when phase is report and no partner (2.3-INT-001)', () => {
      mockStoreState.partner = null;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Should show unlinked completion screen
      expect(screen.getByTestId('scripture-unlinked-complete-screen')).toBeDefined();
      // Should NOT show MessageCompose
      expect(screen.queryByTestId('scripture-message-compose-screen')).toBeNull();
    });

    it('waits for partner loading before treating report flow as unlinked', () => {
      mockStoreState.partner = null;
      mockStoreState.isLoadingPartner = true;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);

      expect(screen.queryByTestId('scripture-unlinked-complete-screen')).toBeNull();
      expect(mockUpdateSession).not.toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ status: 'complete' })
      );
    });

    it('transitions to compose when partner loading resolves with partner data', () => {
      // Start with partner loading in progress
      mockStoreState.partner = null;
      mockStoreState.isLoadingPartner = true;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      const { rerender } = render(<SoloReadingFlow />);

      // During loading: should NOT show unlinked completion and should NOT call markSessionComplete
      expect(screen.queryByTestId('scripture-unlinked-complete-screen')).toBeNull();
      expect(mockUpdateSession).not.toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ status: 'complete' })
      );

      // Simulate partner loading completing with valid partner data
      mockStoreState.partner = linkedPartner;
      mockStoreState.isLoadingPartner = false;
      rerender(<SoloReadingFlow />);

      // After partner resolution: should show compose (not unlinked)
      expect(screen.getByTestId('scripture-message-compose-screen')).toBeDefined();
      expect(screen.queryByTestId('scripture-unlinked-complete-screen')).toBeNull();
    });

    it('sending message calls addMessage service (2.3-INT-003)', async () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Type a message
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'I love you' } });
      // Click send
      fireEvent.click(screen.getByTestId('scripture-message-send-btn'));
      await vi.waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith('session-123', 'user-456', 'I love you');
      });
    });

    it('skipping message still marks session complete (2.3-INT-004)', async () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Click skip
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));
      await vi.waitFor(() => {
        expect(mockUpdateSession).toHaveBeenCalledWith(
          'session-123',
          expect.objectContaining({ status: 'complete' })
        );
      });
    });

    it('calls updatePhase("complete") after successful completion persistence', async () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(mockUpdatePhase).toHaveBeenCalledWith('complete');
      });
    });

    it('stays out of report view and shows retry UI when completion persistence fails', async () => {
      mockUpdateSession
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'));
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-completion-error-screen')).toBeDefined();
        expect(screen.getByTestId('scripture-completion-retry-btn')).toBeDefined();
      });
      expect(screen.queryByTestId('scripture-report-screen')).toBeNull();
      expect(mockUpdateSession).toHaveBeenCalledTimes(2);
      expect(mockUpdatePhase).not.toHaveBeenCalledWith('complete');
    });

    it('retry from completion error transitions to report once completion succeeds', async () => {
      mockUpdateSession
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'))
        .mockResolvedValueOnce(undefined);
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-completion-error-screen')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('scripture-completion-retry-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      expect(mockUpdatePhase).toHaveBeenCalledWith('complete');
    });

    it('DailyPrayerReport appears after send/skip (2.3-INT-005)', async () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Type and send a message
      const textarea = screen.getByTestId('scripture-message-textarea');
      fireEvent.change(textarea, { target: { value: 'Thinking of you' } });
      fireEvent.click(screen.getByTestId('scripture-message-send-btn'));
      // After send, report screen should appear
      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
    });

    it('shows report load error and retry when report fetch fails (2.3-INT-008)', async () => {
      mockGetSessionReportData.mockRejectedValueOnce(new Error('fetch failed'));
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-error')).toBeDefined();
        expect(screen.getByTestId('scripture-report-retry-btn')).toBeDefined();
      });
    });

    it('retry triggers report refetch after failure (2.3-INT-009)', async () => {
      mockGetSessionReportData
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({
          reflections: [],
          bookmarks: [],
          messages: [],
        });
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-error')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('scripture-report-retry-btn'));

      await vi.waitFor(() => {
        expect(mockGetSessionReportData).toHaveBeenCalledTimes(2);
        expect(screen.queryByTestId('scripture-report-error')).toBeNull();
      });
    });

    it('keeps waiting state tied to completion status, not message existence', async () => {
      mockGetSessionReportData.mockResolvedValueOnce({
        reflections: [
          {
            id: 'u-step',
            sessionId: 'session-123',
            stepIndex: 0,
            userId: 'user-456',
            rating: 4,
            notes: 'mine',
            isShared: false,
            createdAt: new Date(),
          },
          {
            id: 'p-step',
            sessionId: 'session-123',
            stepIndex: 0,
            userId: 'partner-1',
            rating: 5,
            notes: 'partial',
            isShared: true,
            createdAt: new Date(),
          },
        ],
        bookmarks: [],
        messages: [
          {
            id: 'p-msg',
            sessionId: 'session-123',
            senderId: 'partner-1',
            message: 'Still working through this',
            createdAt: new Date(),
          },
        ],
      });
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      expect(screen.getByTestId('scripture-report-partner-message')).toBeDefined();
      expect(screen.getByTestId('scripture-report-partner-waiting')).toBeDefined();
    });

    it('treats partner as complete when session-level reflection exists', async () => {
      mockGetSessionReportData.mockResolvedValueOnce({
        reflections: [
          {
            id: 'u-step',
            sessionId: 'session-123',
            stepIndex: 0,
            userId: 'user-456',
            rating: 4,
            notes: 'mine',
            isShared: false,
            createdAt: new Date(),
          },
          {
            id: 'p-summary',
            sessionId: 'session-123',
            stepIndex: MAX_STEPS,
            userId: 'partner-1',
            rating: 5,
            notes: JSON.stringify({ standoutVerses: [1, 2] }),
            isShared: true,
            createdAt: new Date(),
          },
        ],
        bookmarks: [],
        messages: [],
      });
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      expect(screen.queryByTestId('scripture-report-partner-waiting')).toBeNull();
    });

    it('focuses compose/report headings and announces transitions', async () => {
      const origRAF = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      };

      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      const composeHeading = screen.getByTestId('scripture-message-compose-heading');
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(composeHeading);
        expect(screen.getByTestId('sr-announcer')).toHaveTextContent(
          'Write a message for your partner'
        );
      });

      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      const reportHeading = screen.getByTestId('scripture-report-heading');
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(reportHeading);
        expect(screen.getByTestId('sr-announcer')).toHaveTextContent('Your Daily Prayer Report');
      });

      globalThis.requestAnimationFrame = origRAF;
    });

    it('session marked complete after report phase entry for unlinked user (2.3-INT-006)', async () => {
      mockStoreState.partner = null;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Unlinked user skips compose, session should be marked complete on mount
      await vi.waitFor(() => {
        expect(mockUpdateSession).toHaveBeenCalledWith(
          'session-123',
          expect.objectContaining({ status: 'complete' })
        );
      });
    });

    it('Return to Overview calls exitSession (2.3-INT-007)', async () => {
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      render(<SoloReadingFlow />);
      // Skip to get to report
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));
      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      // Click return
      fireEvent.click(screen.getByTestId('scripture-report-return-btn'));
      expect(mockExitSession).toHaveBeenCalledTimes(1);
    });

    it('defaults user standout verses to empty array when session reflection notes contain invalid JSON', async () => {
      mockGetSessionReportData.mockResolvedValueOnce({
        reflections: [
          {
            id: 'u-summary',
            sessionId: 'session-123',
            stepIndex: MAX_STEPS,
            userId: 'user-456',
            rating: 4,
            notes: 'not json{',
            isShared: false,
            createdAt: new Date(),
          },
        ],
        bookmarks: [],
        messages: [],
      });
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      // Report should render without crashing — standout verses section absent or empty
      expect(screen.queryByTestId('scripture-report-user-standout-verses')).toBeNull();
    });

    it('defaults partner standout verses to empty array when partner reflection notes contain invalid JSON', async () => {
      mockGetSessionReportData.mockResolvedValueOnce({
        reflections: [
          {
            id: 'p-summary',
            sessionId: 'session-123',
            stepIndex: MAX_STEPS,
            userId: 'partner-1',
            rating: 5,
            notes: '{broken json!!!',
            isShared: true,
            createdAt: new Date(),
          },
        ],
        bookmarks: [],
        messages: [],
      });
      mockStoreState.partner = linkedPartner;
      mockStoreState.session = createMockSession({
        currentPhase: 'report',
        status: 'in_progress',
        currentStepIndex: 16,
      });

      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-message-skip-btn'));

      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-report-screen')).toBeDefined();
      });
      // Report should render gracefully — partner standout verses absent or empty
      expect(screen.queryByTestId('scripture-report-partner-standout-verses')).toBeNull();
    });
  });

  // ============================================
  // Story 2.2: Double-Submit Guard
  // ============================================

  describe('Story 2.2: Double-Submit Guard', () => {
    it('prevents concurrent reflection summary submissions', async () => {
      // Use a deferred promise to control when addReflection resolves
      let resolveAddReflection!: () => void;
      mockAddReflection.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveAddReflection = resolve;
          })
      );

      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
        currentStepIndex: 16,
      });
      // Provide bookmarks so standout verse selection is available
      mockGetBookmarksBySession.mockResolvedValue([{ stepIndex: 0, userId: 'user-456' }]);
      render(<SoloReadingFlow />);

      // Wait for bookmark loading
      await vi.waitFor(() => {
        expect(screen.getByTestId('scripture-standout-verse-0')).toBeDefined();
      });

      // Select standout verse, rating, and submit
      fireEvent.click(screen.getByTestId('scripture-standout-verse-0'));
      fireEvent.click(screen.getByTestId('scripture-session-rating-4'));
      fireEvent.click(screen.getByTestId('scripture-reflection-summary-continue'));

      // addReflection should be called once (first submission)
      expect(mockAddReflection).toHaveBeenCalledTimes(1);

      // Attempt second submission before first resolves — button should be disabled
      const continueBtn = screen.queryByTestId('scripture-reflection-summary-continue');
      if (continueBtn) {
        fireEvent.click(continueBtn);
      }

      // Still only one call — guard prevented the double submit
      expect(mockAddReflection).toHaveBeenCalledTimes(1);

      // Resolve the first submission
      resolveAddReflection();

      // Wait for submission to complete
      await vi.waitFor(() => {
        expect(mockUpdatePhase).toHaveBeenCalledWith('report');
      });
    });
  });
});
