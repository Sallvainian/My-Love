/**
 * ScriptureOverview Component Tests
 *
 * Story 1.1: Navigation Entry Point
 * Unit tests for the Scripture Reading overview/entry point.
 *
 * Tests:
 * - Partner linked state (AC #2)
 * - Partner unlinked state with link message (AC #3)
 * - Loading skeleton state (AC #5)
 * - Error/offline state (AC #6)
 * - Navigation to partner setup (AC #4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScriptureOverview } from '../containers/ScriptureOverview';

// Mock the Zustand store
const mockLoadPartner = vi.fn();
const mockSetView = vi.fn();

const mockStoreState = {
  partner: null as { id: string; displayName: string } | null,
  isLoadingPartner: false,
  loadPartner: mockLoadPartner,
  setView: mockSetView,
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

    it('should always render Solo mode card', () => {
      render(<ScriptureOverview />);

      expect(screen.getByText('Solo')).toBeInTheDocument();
      expect(screen.getByText('Read and reflect on your own time')).toBeInTheDocument();
    });

    it('should always render Together mode card', () => {
      render(<ScriptureOverview />);

      expect(screen.getByText('Together')).toBeInTheDocument();
    });

    it('should call loadPartner on mount', () => {
      render(<ScriptureOverview />);

      expect(mockLoadPartner).toHaveBeenCalledTimes(1);
    });
  });

  describe('Partner Linked State (AC #2)', () => {
    it('should show Together mode as enabled when partner is linked', () => {
      mockStoreState.partner = { id: 'partner-123', displayName: 'Partner' };

      render(<ScriptureOverview />);

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

  describe('Partner Unlinked State (AC #3)', () => {
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

      const togetherButton = screen.getByText('Together').closest('button');
      expect(togetherButton).toBeDisabled();
      expect(screen.getByText('Link your partner to unlock')).toBeInTheDocument();
    });

    it('should keep Solo mode accessible when partner is not linked', () => {
      mockStoreState.partner = null;

      render(<ScriptureOverview />);

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton).not.toBeDisabled();
    });
  });

  describe('Navigation to Partner Setup (AC #4)', () => {
    it('should navigate to partner view when link message is tapped', () => {
      mockStoreState.partner = null;
      mockStoreState.isLoadingPartner = false;

      render(<ScriptureOverview />);

      const linkButton = screen.getByTestId('link-partner-message');
      fireEvent.click(linkButton);

      expect(mockSetView).toHaveBeenCalledWith('partner');
    });
  });

  describe('Loading State (AC #5)', () => {
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

    it('should keep Solo mode accessible during loading', () => {
      mockStoreState.isLoadingPartner = true;

      render(<ScriptureOverview />);

      const soloButton = screen.getByText('Solo').closest('button');
      expect(soloButton).not.toBeDisabled();
    });
  });

  describe('Error/Offline State (AC #6)', () => {
    // Note: Error state would require slice-level tracking in a real implementation.
    // For now, unlinked state covers the main scenario.
    // This test verifies Solo mode is always accessible.

    it('should keep Solo mode accessible regardless of partner status', () => {
      // Test with all status variations
      const testCases = [
        { partner: null, isLoadingPartner: true },
        { partner: null, isLoadingPartner: false },
        { partner: { id: '123', displayName: 'Partner' }, isLoadingPartner: false },
      ];

      testCases.forEach((testState, index) => {
        Object.assign(mockStoreState, testState);

        const { unmount } = render(<ScriptureOverview />);

        const soloButton = screen.getByText('Solo').closest('button');
        expect(soloButton).not.toBeDisabled();

        unmount();
      });
    });
  });

  describe('Lavender Dreams Styling', () => {
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
  });

  describe('Accessibility', () => {
    it('should have accessible section labels', () => {
      render(<ScriptureOverview />);

      expect(screen.getByLabelText('Partner status')).toBeInTheDocument();
      expect(screen.getByLabelText('Choose reading mode')).toBeInTheDocument();
    });

    it('should have accessible button labels', () => {
      // Set partner as linked so the "link partner" message doesn't appear
      mockStoreState.partner = { id: 'partner-123', displayName: 'Partner' };

      render(<ScriptureOverview />);

      // Mode cards should be buttons
      expect(screen.getByRole('button', { name: /solo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /together/i })).toBeInTheDocument();
    });
  });
});
