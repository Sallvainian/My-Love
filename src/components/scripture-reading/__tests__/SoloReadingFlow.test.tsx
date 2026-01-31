/**
 * SoloReadingFlow Component Tests
 *
 * Story 1.3: Solo Reading Flow
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
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SoloReadingFlow } from '../containers/SoloReadingFlow';
import { SCRIPTURE_STEPS, MAX_STEPS } from '../../../data/scriptureSteps';

// Mock framer-motion (project pattern)
vi.mock('framer-motion', () => ({
  motion: {
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
  useReducedMotion: () => false,
}));

// Mock Zustand store
const mockAdvanceStep = vi.fn().mockResolvedValue(undefined);
const mockSaveAndExit = vi.fn().mockResolvedValue(undefined);
const mockExitSession = vi.fn();

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

const mockStoreState: {
  session: MockSession | null;
  isSyncing: boolean;
  scriptureError: { code: string; message: string } | null;
  advanceStep: typeof mockAdvanceStep;
  saveAndExit: typeof mockSaveAndExit;
  exitSession: typeof mockExitSession;
} = {
  session: null,
  isSyncing: false,
  scriptureError: null,
  advanceStep: mockAdvanceStep,
  saveAndExit: mockSaveAndExit,
  exitSession: mockExitSession,
};

// Create a function to get state for the useAppStore mock
const getStoreState = () => mockStoreState;

vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
      selector(getStoreState())
    ),
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
    mockStoreState.session = createMockSession();
    mockStoreState.isSyncing = false;
    mockStoreState.scriptureError = null;
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
      expect(screen.getByTestId('scripture-view-response-button')).toHaveTextContent('View Response');
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
      expect(screen.getByTestId('scripture-back-to-verse-button')).toHaveTextContent('Back to Verse');
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
      expect(screen.getByTestId('scripture-progress-indicator')).toHaveTextContent('Verse 17 of 17');
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
    it('calls advanceStep when Next Verse is tapped on verse screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      expect(mockAdvanceStep).toHaveBeenCalledTimes(1);
    });

    it('calls advanceStep when Next Verse is tapped on response screen', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('scripture-view-response-button'));
      fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
      expect(mockAdvanceStep).toHaveBeenCalledTimes(1);
    });

    it('shows "Complete Reading" on last step instead of "Next Verse"', () => {
      mockStoreState.session = createMockSession({ currentStepIndex: 16 });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-next-verse-button')).toHaveTextContent('Complete Reading');
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
    it('shows completion screen when session is complete', () => {
      mockStoreState.session = createMockSession({
        status: 'complete',
        currentPhase: 'reflection',
        currentStepIndex: 16,
        completedAt: new Date(),
      });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-completion-screen')).toBeDefined();
    });

    it('shows "Reading Complete" heading on completion', () => {
      mockStoreState.session = createMockSession({
        status: 'complete',
        currentPhase: 'reflection',
      });
      render(<SoloReadingFlow />);
      expect(screen.getByText('Reading Complete')).toBeDefined();
    });

    it('shows completion message with step count', () => {
      mockStoreState.session = createMockSession({
        status: 'complete',
        currentPhase: 'reflection',
      });
      render(<SoloReadingFlow />);
      expect(
        screen.getByText(/completed all 17 scripture readings/i)
      ).toBeDefined();
    });

    it('shows Return to Overview button on completion', () => {
      mockStoreState.session = createMockSession({
        status: 'complete',
        currentPhase: 'reflection',
      });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('return-to-overview')).toHaveTextContent(
        'Return to Overview'
      );
    });

    it('calls exitSession when Return to Overview is tapped', () => {
      mockStoreState.session = createMockSession({
        status: 'complete',
        currentPhase: 'reflection',
      });
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('return-to-overview'));
      expect(mockExitSession).toHaveBeenCalledTimes(1);
    });

    it('shows completion for reflection phase even if status is not complete', () => {
      mockStoreState.session = createMockSession({
        currentPhase: 'reflection',
        status: 'in_progress',
      });
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('scripture-completion-screen')).toBeDefined();
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
      expect(screen.getByTestId('exit-button').getAttribute('aria-label')).toBe(
        'Exit reading'
      );
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

    it('dialog shows "You can continue later" description', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(
        screen.getByText('You can continue later from where you left off.')
      ).toBeDefined();
    });

    it('dialog has Save & Exit button', () => {
      render(<SoloReadingFlow />);
      fireEvent.click(screen.getByTestId('exit-button'));
      expect(screen.getByTestId('save-and-exit-button')).toHaveTextContent(
        'Save & Exit'
      );
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

    it('shows error message when scriptureError is set', () => {
      mockStoreState.scriptureError = {
        code: 'SYNC_FAILED',
        message: 'Failed to save step progress',
      };
      render(<SoloReadingFlow />);
      expect(screen.getByTestId('reading-error')).toHaveTextContent(
        'Failed to save step progress'
      );
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
});
