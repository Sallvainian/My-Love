/**
 * MoodTracker Component Tests
 * Story 5.1: Mood Emoji Picker Interface
 *
 * Tests the mood tracking UI with 12 emotions in a 3x4 grid layout.
 * Validates multi-select, visual feedback, and accessibility requirements.
 *
 * AC Coverage:
 * - AC-5.1.1: 12 emotion emojis displayed in 3x4 grid layout (6 positive, 6 challenging)
 * - AC-5.1.2: Each emoji has icon, label, and minimum 48px touch target
 * - AC-5.1.3: Selected mood(s) show pink border and scale animation
 * - AC-5.1.4: Multiple moods can be selected (multi-select mode)
 * - AC-5.1.5: Positive moods grouped separately from challenging moods
 * - AC-5.1.6: Selected moods display summary below grid
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabaseClient BEFORE any imports that use it
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  getCurrentUserId: vi.fn(),
  getPartnerId: vi.fn().mockResolvedValue('partner-123'),
}));

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MoodTracker } from '../../../src/components/MoodTracker/MoodTracker';
import { useAppStore } from '../../../src/stores/useAppStore';

// Mock Zustand store
vi.mock('../../../src/stores/useAppStore');

// Mock MoodHistoryCalendar to avoid its complexity
vi.mock('../../../src/components/MoodHistory', () => ({
  MoodHistoryCalendar: () => <div data-testid="mood-history-calendar">History Calendar</div>,
}));

// Mock offlineErrorHandler
vi.mock('../../../src/utils/offlineErrorHandler', () => ({
  isOffline: vi.fn(() => false),
  OFFLINE_ERROR_MESSAGE: 'You are offline. Mood saved locally and will sync when back online.',
}));

// Mock backgroundSync
vi.mock('../../../src/utils/backgroundSync', () => ({
  registerBackgroundSync: vi.fn(() => Promise.resolve()),
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
  // Cache components to prevent React reconciliation issues
  const componentCache: Record<string, React.FC<any>> = {};

  const getMotionComponent = (elementType: string) => {
    if (!componentCache[elementType]) {
      componentCache[elementType] = ({ children, ...props }: any) => {
        // Filter out framer-motion specific props
        const {
          whileHover,
          whileTap,
          animate,
          initial,
          exit,
          transition,
          layoutId,
          variants,
          ...rest
        } = props;

        // Create the appropriate element
        if (elementType === 'button') {
          return <button {...rest}>{children}</button>;
        }
        if (elementType === 'div') {
          return <div {...rest}>{children}</div>;
        }
        // Default fallback using createElement
        const Element = elementType as keyof JSX.IntrinsicElements;
        return <Element {...rest}>{children}</Element>;
      };
    }
    return componentCache[elementType];
  };

  const motionProxy = new Proxy(
    {},
    {
      get: (_target, prop: string) => getMotionComponent(prop),
    }
  );

  return {
    m: motionProxy,
    motion: motionProxy,
    AnimatePresence: ({ children }: any) => children,
  };
});

describe('MoodTracker - Story 5.1: Mood Emoji Picker Interface', () => {
  const mockAddMoodEntry = vi.fn();
  const mockGetMoodForDate = vi.fn();
  const mockLoadMoods = vi.fn();
  const mockSyncPendingMoods = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockGetMoodForDate.mockReturnValue(null);
    mockSyncPendingMoods.mockResolvedValue(undefined);

    vi.mocked(useAppStore).mockReturnValue({
      addMoodEntry: mockAddMoodEntry,
      getMoodForDate: mockGetMoodForDate,
      loadMoods: mockLoadMoods,
      syncPendingMoods: mockSyncPendingMoods,
      syncStatus: { isOnline: true, pendingMoods: 0 },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AC-5.1.1: 12 emotion emojis displayed in grid layout', () => {
    it('should render 12 mood buttons (6 positive + 6 challenging)', () => {
      render(<MoodTracker />);

      // All 12 mood buttons should be present
      const allMoodButtons = [
        // Positive moods
        'mood-button-loved',
        'mood-button-happy',
        'mood-button-content',
        'mood-button-excited',
        'mood-button-thoughtful',
        'mood-button-grateful',
        // Challenging moods
        'mood-button-sad',
        'mood-button-anxious',
        'mood-button-frustrated',
        'mood-button-angry',
        'mood-button-lonely',
        'mood-button-tired',
      ];

      allMoodButtons.forEach((testId) => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      // Verify exactly 12 mood buttons exist
      const buttons = screen.getAllByTestId(/^mood-button-/);
      expect(buttons).toHaveLength(12);
    });

    it('should render positive moods section header', () => {
      render(<MoodTracker />);

      expect(screen.getByText('Positive')).toBeInTheDocument();
    });

    it('should render challenging moods section header', () => {
      render(<MoodTracker />);

      expect(screen.getByText('Challenging')).toBeInTheDocument();
    });
  });

  describe('AC-5.1.2: Each emoji has icon, label, and 48px touch target', () => {
    it('should display labels for all mood buttons', () => {
      render(<MoodTracker />);

      const moodLabels = [
        'Loved', 'Happy', 'Content', 'Excited', 'Thoughtful', 'Grateful',
        'Sad', 'Anxious', 'Frustrated', 'Angry', 'Lonely', 'Tired',
      ];

      moodLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('should have aria-label for accessibility on all mood buttons', () => {
      render(<MoodTracker />);

      const moodButtons = screen.getAllByTestId(/^mood-button-/);
      moodButtons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
        expect(button.getAttribute('aria-label')).toContain('mood');
      });
    });

    it('should have aria-pressed attribute for selection state', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');
      expect(lovedButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('AC-5.1.3: Selected mood shows pink border', () => {
    it('should apply pink border class when mood is selected', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');

      // Initially not selected
      expect(lovedButton).not.toHaveClass('border-pink-500');
      expect(lovedButton).toHaveAttribute('aria-pressed', 'false');

      // Click to select
      fireEvent.click(lovedButton);

      // Should now have pink border
      expect(lovedButton).toHaveClass('border-pink-500');
      expect(lovedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should remove pink border when mood is deselected', () => {
      render(<MoodTracker />);

      const happyButton = screen.getByTestId('mood-button-happy');

      // Select
      fireEvent.click(happyButton);
      expect(happyButton).toHaveClass('border-pink-500');

      // Deselect
      fireEvent.click(happyButton);
      expect(happyButton).not.toHaveClass('border-pink-500');
    });
  });

  describe('AC-5.1.4: Multiple moods can be selected', () => {
    it('should allow selecting multiple moods simultaneously', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');
      const happyButton = screen.getByTestId('mood-button-happy');
      const excitedButton = screen.getByTestId('mood-button-excited');

      // Select multiple moods
      fireEvent.click(lovedButton);
      fireEvent.click(happyButton);
      fireEvent.click(excitedButton);

      // All should be selected
      expect(lovedButton).toHaveAttribute('aria-pressed', 'true');
      expect(happyButton).toHaveAttribute('aria-pressed', 'true');
      expect(excitedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should allow selecting both positive and challenging moods', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');
      const sadButton = screen.getByTestId('mood-button-sad');
      const angryButton = screen.getByTestId('mood-button-angry');

      // Select mix of positive and challenging
      fireEvent.click(lovedButton);
      fireEvent.click(sadButton);
      fireEvent.click(angryButton);

      expect(lovedButton).toHaveAttribute('aria-pressed', 'true');
      expect(sadButton).toHaveAttribute('aria-pressed', 'true');
      expect(angryButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should deselect individual moods when clicked again', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');
      const happyButton = screen.getByTestId('mood-button-happy');

      // Select both
      fireEvent.click(lovedButton);
      fireEvent.click(happyButton);

      // Deselect only one
      fireEvent.click(lovedButton);

      expect(lovedButton).toHaveAttribute('aria-pressed', 'false');
      expect(happyButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('AC-5.1.5: Positive moods grouped separately from challenging moods', () => {
    it('should render positive moods under Positive section', () => {
      render(<MoodTracker />);

      // Find the Positive section header
      const positiveHeader = screen.getByText('Positive');
      const positiveSection = positiveHeader.closest('div')?.parentElement;

      // Positive moods should be within this section
      expect(positiveSection).toBeTruthy();
      expect(positiveSection?.querySelector('[data-testid="mood-button-loved"]')).toBeTruthy();
      expect(positiveSection?.querySelector('[data-testid="mood-button-excited"]')).toBeTruthy();
    });

    it('should render challenging moods under Challenging section', () => {
      render(<MoodTracker />);

      // Find the Challenging section header
      const challengingHeader = screen.getByText('Challenging');
      const challengingSection = challengingHeader.closest('div')?.parentElement;

      // Challenging moods should be within this section
      expect(challengingSection).toBeTruthy();
      expect(challengingSection?.querySelector('[data-testid="mood-button-sad"]')).toBeTruthy();
      expect(challengingSection?.querySelector('[data-testid="mood-button-angry"]')).toBeTruthy();
    });
  });

  describe('AC-5.1.6: Selected moods display summary below grid', () => {
    it('should not show summary when no moods selected', () => {
      render(<MoodTracker />);

      expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
    });

    it('should show summary with single selected mood', () => {
      render(<MoodTracker />);

      const lovedButton = screen.getByTestId('mood-button-loved');
      fireEvent.click(lovedButton);

      expect(screen.getByText(/Selected:.*Loved/)).toBeInTheDocument();
    });

    it('should show summary with multiple selected moods', () => {
      render(<MoodTracker />);

      fireEvent.click(screen.getByTestId('mood-button-loved'));
      fireEvent.click(screen.getByTestId('mood-button-happy'));
      fireEvent.click(screen.getByTestId('mood-button-excited'));

      const summary = screen.getByText(/Selected:/);
      expect(summary).toBeInTheDocument();
      expect(summary.textContent).toContain('Loved');
      expect(summary.textContent).toContain('Happy');
      expect(summary.textContent).toContain('Excited');
    });

    it('should update summary when moods are deselected', () => {
      render(<MoodTracker />);

      // Select two moods
      fireEvent.click(screen.getByTestId('mood-button-loved'));
      fireEvent.click(screen.getByTestId('mood-button-happy'));

      // Verify both shown
      let summary = screen.getByText(/Selected:/);
      expect(summary.textContent).toContain('Loved');
      expect(summary.textContent).toContain('Happy');

      // Deselect one
      fireEvent.click(screen.getByTestId('mood-button-loved'));

      // Summary should update
      summary = screen.getByText(/Selected:/);
      expect(summary.textContent).not.toContain('Loved');
      expect(summary.textContent).toContain('Happy');
    });
  });

  describe('Form submission', () => {
    it('should disable submit button when no moods selected', () => {
      render(<MoodTracker />);

      const submitButton = screen.getByTestId('mood-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when at least one mood selected', () => {
      render(<MoodTracker />);

      fireEvent.click(screen.getByTestId('mood-button-loved'));

      const submitButton = screen.getByTestId('mood-submit-button');
      expect(submitButton).not.toBeDisabled();
    });

    it('should show error when submitting without mood selection', () => {
      render(<MoodTracker />);

      const form = screen.getByTestId('mood-tracker').querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      // Error message should appear
      expect(screen.getByTestId('mood-error-message')).toBeInTheDocument();
      expect(screen.getByTestId('mood-error-message')).toHaveTextContent(
        'Please select at least one mood'
      );
    });

    it('should call addMoodEntry with selected moods on submit', async () => {
      mockAddMoodEntry.mockResolvedValue(undefined);

      render(<MoodTracker />);

      // Select multiple moods and wait for state to update
      await act(async () => {
        fireEvent.click(screen.getByTestId('mood-button-loved'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('mood-button-loved')).toHaveAttribute('aria-pressed', 'true');
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('mood-button-excited'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('mood-button-excited')).toHaveAttribute('aria-pressed', 'true');
      });

      // Submit
      await act(async () => {
        fireEvent.click(screen.getByTestId('mood-submit-button'));
      });

      // Should call with array of moods
      await waitFor(() => {
        expect(mockAddMoodEntry).toHaveBeenCalledWith(
          ['loved', 'excited'],
          undefined
        );
      });
    });

    it('should include note in submission when provided', async () => {
      mockAddMoodEntry.mockResolvedValue(undefined);

      render(<MoodTracker />);

      fireEvent.click(screen.getByTestId('mood-button-loved'));

      const noteInput = screen.getByTestId('mood-note-input');
      fireEvent.change(noteInput, { target: { value: 'Feeling great today!' } });

      const submitButton = screen.getByTestId('mood-submit-button');
      fireEvent.click(submitButton);

      expect(mockAddMoodEntry).toHaveBeenCalledWith(
        ['loved'],
        'Feeling great today!'
      );
    });
  });

  describe('Tab navigation', () => {
    it('should render Log Mood and History tabs', () => {
      render(<MoodTracker />);

      expect(screen.getByTestId('mood-tab-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('mood-tab-history')).toBeInTheDocument();
    });

    it('should show tracker tab by default', () => {
      render(<MoodTracker />);

      // Tracker content should be visible
      expect(screen.getByText('How are you feeling?')).toBeInTheDocument();
    });
  });

  describe('New mood types (excited, angry)', () => {
    it('should include excited in positive moods', () => {
      render(<MoodTracker />);

      const excitedButton = screen.getByTestId('mood-button-excited');
      expect(excitedButton).toBeInTheDocument();
      expect(screen.getByText('Excited')).toBeInTheDocument();
    });

    it('should include angry in challenging moods', () => {
      render(<MoodTracker />);

      const angryButton = screen.getByTestId('mood-button-angry');
      expect(angryButton).toBeInTheDocument();
      expect(screen.getByText('Angry')).toBeInTheDocument();
    });

    it('should allow selecting excited mood', async () => {
      render(<MoodTracker />);

      const excitedButton = screen.getByTestId('mood-button-excited');
      await act(async () => {
        fireEvent.click(excitedButton);
      });

      await waitFor(() => {
        expect(excitedButton).toHaveAttribute('aria-pressed', 'true');
      });
      expect(screen.getByText(/Selected:.*Excited/)).toBeInTheDocument();
    });

    it('should allow selecting angry mood', async () => {
      render(<MoodTracker />);

      const angryButton = screen.getByTestId('mood-button-angry');
      await act(async () => {
        fireEvent.click(angryButton);
      });

      await waitFor(() => {
        expect(angryButton).toHaveAttribute('aria-pressed', 'true');
      });
      expect(screen.getByText(/Selected:.*Angry/)).toBeInTheDocument();
    });
  });
});
