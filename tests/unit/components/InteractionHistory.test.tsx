/**
 * InteractionHistory Component Tests
 *
 * Component tests for the interaction history modal.
 * Tests history display, filtering, empty states, and modal behavior.
 *
 * AC Coverage:
 * - AC#6: Interaction history viewable (last 7 days)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InteractionHistory } from '../../../src/components/InteractionHistory/InteractionHistory';
import { useAppStore } from '../../../src/stores/useAppStore';
import * as supabaseClient from '../../../src/api/supabaseClient';
import type { Interaction } from '../../../src/types';

// Mock Zustand store
vi.mock('../../../src/stores/useAppStore');

// Mock Supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  getCurrentUserId: vi.fn(),
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: any) => {
          const { whileHover, whileTap, animate, initial, exit, transition, layoutId, ...rest } =
            props;
          const Component = prop as string;
          return <Component {...rest}>{children}</Component>;
        };
      },
    }
  ),
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...props }: any) => {
          const { whileHover, whileTap, animate, initial, exit, transition, layoutId, ...rest } =
            props;
          const Component = prop as string;
          return <Component {...rest}>{children}</Component>;
        };
      },
    }
  ),
  AnimatePresence: ({ children }: any) => children,
}));

describe('InteractionHistory', () => {
  const mockLoadInteractionHistory = vi.fn();
  const mockGetInteractionHistory = vi.fn();
  const mockOnClose = vi.fn();

  const createMockInteraction = (overrides?: Partial<Interaction>): Interaction => ({
    id: 'int-1',
    type: 'poke',
    fromUserId: 'user-1',
    toUserId: 'user-2',
    viewed: false,
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetInteractionHistory.mockReturnValue([]);
    vi.mocked(supabaseClient.getCurrentUserId).mockReturnValue('user-1');

    vi.mocked(useAppStore).mockReturnValue({
      loadInteractionHistory: mockLoadInteractionHistory,
      getInteractionHistory: mockGetInteractionHistory,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Modal behavior', () => {
    it('should not render when isOpen is false', () => {
      render(<InteractionHistory isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByTestId('interaction-history-modal')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('interaction-history-modal')).toBeInTheDocument();
    });

    it('should call onClose when backdrop is clicked', () => {
      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      const backdrop = screen.getByTestId('interaction-history-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      const closeButton = screen.getByTestId('close-history-button');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('AC#6: Interaction history display', () => {
    it('should show loading state initially', () => {
      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Loading interactions...')).toBeInTheDocument();
    });

    it('should load interaction history when modal opens', async () => {
      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(mockLoadInteractionHistory).toHaveBeenCalledWith(100);
      });
    });

    it('should display interactions from last 7 days', async () => {
      const interactions: Interaction[] = [
        createMockInteraction({
          id: 'poke-1',
          type: 'poke',
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
        }),
        createMockInteraction({
          id: 'kiss-1',
          type: 'kiss',
          createdAt: new Date(Date.now() - 172800000), // 2 days ago
        }),
      ];

      mockGetInteractionHistory.mockReturnValue(interactions);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(mockGetInteractionHistory).toHaveBeenCalledWith(7);
      });

      await waitFor(() => {
        expect(screen.getByTestId('interaction-poke-1')).toBeInTheDocument();
        expect(screen.getByTestId('interaction-kiss-1')).toBeInTheDocument();
      });
    });

    it('should show empty state when no interactions exist', async () => {
      mockGetInteractionHistory.mockReturnValue([]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('No interactions yet')).toBeInTheDocument();
        expect(
          screen.getByText('Send your first poke or kiss to get started!')
        ).toBeInTheDocument();
      });
    });

    it('should display interaction count in footer', async () => {
      const interactions = [
        createMockInteraction({ id: 'int-1' }),
        createMockInteraction({ id: 'int-2' }),
        createMockInteraction({ id: 'int-3' }),
      ];

      mockGetInteractionHistory.mockReturnValue(interactions);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/3 total/)).toBeInTheDocument();
      });
    });
  });

  describe('Interaction display details', () => {
    it('should display poke icon for poke interactions', async () => {
      const pokeInteraction = createMockInteraction({
        id: 'poke-1',
        type: 'poke',
      });

      mockGetInteractionHistory.mockReturnValue([pokeInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const interaction = screen.getByTestId('interaction-poke-1');
        expect(interaction).toBeInTheDocument();
        expect(interaction).toHaveTextContent('Poke');
      });
    });

    it('should display kiss icon for kiss interactions', async () => {
      const kissInteraction = createMockInteraction({
        id: 'kiss-1',
        type: 'kiss',
      });

      mockGetInteractionHistory.mockReturnValue([kissInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const interaction = screen.getByTestId('interaction-kiss-1');
        expect(interaction).toBeInTheDocument();
        expect(interaction).toHaveTextContent('Kiss');
      });
    });

    it('should show "Sent" for interactions sent by current user', async () => {
      const sentInteraction = createMockInteraction({
        id: 'sent-1',
        fromUserId: 'user-1', // Current user
        toUserId: 'partner-1',
      });

      mockGetInteractionHistory.mockReturnValue([sentInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const interaction = screen.getByTestId('interaction-sent-1');
        expect(interaction).toHaveTextContent('Sent');
      });
    });

    it('should show "Received" for interactions received by current user', async () => {
      const receivedInteraction = createMockInteraction({
        id: 'received-1',
        fromUserId: 'partner-1',
        toUserId: 'user-1', // Current user
      });

      mockGetInteractionHistory.mockReturnValue([receivedInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const interaction = screen.getByTestId('interaction-received-1');
        expect(interaction).toHaveTextContent('Received');
      });
    });

    it('should show "New" badge for unviewed received interactions', async () => {
      const newInteraction = createMockInteraction({
        id: 'new-1',
        fromUserId: 'partner-1',
        toUserId: 'user-1', // Current user
        viewed: false,
      });

      mockGetInteractionHistory.mockReturnValue([newInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });

    it('should not show "New" badge for viewed interactions', async () => {
      const viewedInteraction = createMockInteraction({
        id: 'viewed-1',
        fromUserId: 'partner-1',
        toUserId: 'user-1',
        viewed: true,
      });

      mockGetInteractionHistory.mockReturnValue([viewedInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText('New')).not.toBeInTheDocument();
      });
    });

    it('should not show "New" badge for sent interactions', async () => {
      const sentInteraction = createMockInteraction({
        id: 'sent-1',
        fromUserId: 'user-1', // Current user
        toUserId: 'partner-1',
        viewed: false,
      });

      mockGetInteractionHistory.mockReturnValue([sentInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText('New')).not.toBeInTheDocument();
      });
    });
  });

  describe('Timestamp formatting', () => {
    it('should show "Just now" for very recent interactions', async () => {
      const recentInteraction = createMockInteraction({
        id: 'recent-1',
        createdAt: new Date(Date.now() - 30000), // 30 seconds ago
      });

      mockGetInteractionHistory.mockReturnValue([recentInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('should show minutes for interactions < 1 hour old', async () => {
      const minutesAgoInteraction = createMockInteraction({
        id: 'min-1',
        createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
      });

      mockGetInteractionHistory.mockReturnValue([minutesAgoInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/30m ago/)).toBeInTheDocument();
      });
    });

    it('should show hours for interactions < 24 hours old', async () => {
      const hoursAgoInteraction = createMockInteraction({
        id: 'hour-1',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      });

      mockGetInteractionHistory.mockReturnValue([hoursAgoInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/2h ago/)).toBeInTheDocument();
      });
    });

    it('should show days for interactions < 7 days old', async () => {
      const daysAgoInteraction = createMockInteraction({
        id: 'day-1',
        createdAt: new Date(Date.now() - 259200000), // 3 days ago
      });

      mockGetInteractionHistory.mockReturnValue([daysAgoInteraction]);
      mockLoadInteractionHistory.mockResolvedValue(undefined);

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/3d ago/)).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should handle load errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLoadInteractionHistory.mockRejectedValue(new Error('Load failed'));

      render(<InteractionHistory isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[InteractionHistory] Failed to load history:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
