/**
 * PokeKissInterface Component Tests
 *
 * Component tests for the poke/kiss interaction interface.
 * Tests button clicks, animations, notifications, and real-time subscriptions.
 *
 * AC Coverage:
 * - AC#1: Poke/Kiss buttons trigger send actions
 * - AC#2: Send interactions to Supabase
 * - AC#3: Notification badge displays unviewed count
 * - AC#4: Animations play for received interactions
 * - AC#5: Interactions marked as viewed after animation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PokeKissInterface } from '../../../src/components/PokeKissInterface/PokeKissInterface';
import { useAppStore } from '../../../src/stores/useAppStore';
import * as supabaseClient from '../../../src/api/supabaseClient';

// Mock Zustand store
vi.mock('../../../src/stores/useAppStore');

// Mock Supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  getPartnerId: vi.fn(),
  getCurrentUserId: vi.fn(),
  initializeAuth: vi.fn(),
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('PokeKissInterface', () => {
  const mockSendPoke = vi.fn();
  const mockSendKiss = vi.fn();
  const mockMarkInteractionViewed = vi.fn();
  const mockGetUnviewedInteractions = vi.fn();
  const mockGetInteractionHistory = vi.fn();
  const mockSubscribeToInteractions = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockSubscribeToInteractions.mockResolvedValue(mockUnsubscribe);
    mockGetUnviewedInteractions.mockReturnValue([]);
    mockGetInteractionHistory.mockReturnValue([]);
    vi.mocked(supabaseClient.getPartnerId).mockReturnValue('partner-uuid-123');

    // Mock useAppStore hook
    vi.mocked(useAppStore).mockReturnValue({
      sendPoke: mockSendPoke,
      sendKiss: mockSendKiss,
      unviewedCount: 0,
      getUnviewedInteractions: mockGetUnviewedInteractions,
      getInteractionHistory: mockGetInteractionHistory,
      markInteractionViewed: mockMarkInteractionViewed,
      subscribeToInteractions: mockSubscribeToInteractions,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AC#1: Interaction buttons in interface', () => {
    it('should render poke button', () => {
      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');
      expect(pokeButton).toBeInTheDocument();
      expect(pokeButton).toHaveAttribute('aria-label', 'Send Poke');
    });

    it('should render kiss button', () => {
      render(<PokeKissInterface />);

      const kissButton = screen.getByTestId('kiss-button');
      expect(kissButton).toBeInTheDocument();
      expect(kissButton).toHaveAttribute('aria-label', 'Send Kiss');
    });

    it('should render history button', () => {
      render(<PokeKissInterface />);

      const historyButton = screen.getByTestId('history-button');
      expect(historyButton).toBeInTheDocument();
      expect(historyButton).toHaveAttribute('aria-label', 'View Interaction History');
    });
  });

  describe('AC#2: Tapping sends interaction', () => {
    it('should call sendPoke when poke button is clicked', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        expect(mockSendPoke).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should call sendKiss when kiss button is clicked', async () => {
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);

      const kissButton = screen.getByTestId('kiss-button');
      fireEvent.click(kissButton);

      await waitFor(() => {
        expect(mockSendKiss).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should show success toast after sending poke', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent('Poke sent! 👆');
      });
    });

    it('should show success toast after sending kiss', async () => {
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);

      const kissButton = screen.getByTestId('kiss-button');
      fireEvent.click(kissButton);

      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent('Kiss sent! 💋');
      });
    });

    it('should show error toast when partner is not configured', async () => {
      vi.mocked(supabaseClient.getPartnerId).mockReturnValue(null);

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent('Error: Partner not configured');
      });
    });

    it('should show error toast when sendPoke fails', async () => {
      mockSendPoke.mockRejectedValue(new Error('Network error'));

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent('Failed to send poke. Try again.');
      });
    });

    it('should disable poke button while sending', async () => {
      // Create a promise that won't resolve immediately
      let resolvePoke: any;
      const pokePromise = new Promise((resolve) => {
        resolvePoke = resolve;
      });
      mockSendPoke.mockReturnValue(pokePromise);

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');

      // Click button
      fireEvent.click(pokeButton);

      // Button should be disabled while pending
      expect(pokeButton).toBeDisabled();

      // Resolve the promise
      resolvePoke({ id: 'poke-1', type: 'poke' });

      // Wait for button to be enabled again
      await waitFor(() => {
        expect(pokeButton).not.toBeDisabled();
      });
    });
  });

  describe('AC#3: Notification badge shows unviewed count', () => {
    it('should not show badge when unviewedCount is 0', () => {
      vi.mocked(useAppStore).mockReturnValue({
        sendPoke: mockSendPoke,
        sendKiss: mockSendKiss,
        unviewedCount: 0,
        getUnviewedInteractions: mockGetUnviewedInteractions,
        getInteractionHistory: mockGetInteractionHistory,
        markInteractionViewed: mockMarkInteractionViewed,
        subscribeToInteractions: mockSubscribeToInteractions,
      } as any);

      render(<PokeKissInterface />);

      const badge = screen.queryByTestId('notification-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('should show badge when unviewedCount > 0', () => {
      vi.mocked(useAppStore).mockReturnValue({
        sendPoke: mockSendPoke,
        sendKiss: mockSendKiss,
        unviewedCount: 3,
        getUnviewedInteractions: mockGetUnviewedInteractions,
        getInteractionHistory: mockGetInteractionHistory,
        markInteractionViewed: mockMarkInteractionViewed,
        subscribeToInteractions: mockSubscribeToInteractions,
      } as any);

      render(<PokeKissInterface />);

      const badge = screen.getByTestId('notification-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('3');
    });

    it('should show correct aria-label for badge', () => {
      vi.mocked(useAppStore).mockReturnValue({
        sendPoke: mockSendPoke,
        sendKiss: mockSendKiss,
        unviewedCount: 1,
        getUnviewedInteractions: mockGetUnviewedInteractions,
        getInteractionHistory: mockGetInteractionHistory,
        markInteractionViewed: mockMarkInteractionViewed,
        subscribeToInteractions: mockSubscribeToInteractions,
      } as any);

      render(<PokeKissInterface />);

      const badge = screen.getByTestId('notification-badge');
      expect(badge).toHaveAttribute('aria-label', '1 unviewed interaction');
    });

    it('should show plural form for multiple unviewed interactions', () => {
      vi.mocked(useAppStore).mockReturnValue({
        sendPoke: mockSendPoke,
        sendKiss: mockSendKiss,
        unviewedCount: 5,
        getUnviewedInteractions: mockGetUnviewedInteractions,
        getInteractionHistory: mockGetInteractionHistory,
        markInteractionViewed: mockMarkInteractionViewed,
        subscribeToInteractions: mockSubscribeToInteractions,
      } as any);

      render(<PokeKissInterface />);

      const badge = screen.getByTestId('notification-badge');
      expect(badge).toHaveAttribute('aria-label', '5 unviewed interactions');
    });
  });

  describe('AC#4: Badge click shows animation', () => {
    it('should trigger animation when badge is clicked', async () => {
      const mockInteraction = {
        id: 'int-1',
        type: 'poke' as const,
        fromUserId: 'partner-uuid',
        toUserId: 'user-uuid',
        viewed: false,
        createdAt: new Date(),
      };

      mockGetUnviewedInteractions.mockReturnValue([mockInteraction]);

      vi.mocked(useAppStore).mockReturnValue({
        sendPoke: mockSendPoke,
        sendKiss: mockSendKiss,
        unviewedCount: 1,
        getUnviewedInteractions: mockGetUnviewedInteractions,
        getInteractionHistory: mockGetInteractionHistory,
        markInteractionViewed: mockMarkInteractionViewed,
        subscribeToInteractions: mockSubscribeToInteractions,
      } as any);

      render(<PokeKissInterface />);

      const badge = screen.getByTestId('notification-badge');
      fireEvent.click(badge);

      await waitFor(() => {
        const animation = screen.getByTestId('poke-animation');
        expect(animation).toBeInTheDocument();
      });
    });
  });

  describe('Real-time subscription', () => {
    it('should subscribe to interactions on mount', async () => {
      render(<PokeKissInterface />);

      await waitFor(() => {
        expect(mockSubscribeToInteractions).toHaveBeenCalled();
      });
    });

    it('should unsubscribe on unmount', async () => {
      const { unmount } = render(<PokeKissInterface />);

      await waitFor(() => {
        expect(mockSubscribeToInteractions).toHaveBeenCalled();
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle subscription errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSubscribeToInteractions.mockRejectedValue(new Error('Subscription failed'));

      render(<PokeKissInterface />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[PokeKissInterface] Failed to subscribe:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('History modal', () => {
    it('should open history modal when history button is clicked', async () => {
      render(<PokeKissInterface />);

      const historyButton = screen.getByTestId('history-button');
      fireEvent.click(historyButton);

      await waitFor(() => {
        // InteractionHistory component should be rendered
        expect(screen.getByTestId('interaction-history-modal')).toBeInTheDocument();
      });
    });
  });

  describe('AC#7: Unlimited interactions', () => {
    it('should allow multiple poke sends without limit', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);

      const pokeButton = screen.getByTestId('poke-button');

      // Send 10 pokes in sequence
      for (let i = 0; i < 10; i++) {
        fireEvent.click(pokeButton);
        await waitFor(() => {
          expect(mockSendPoke).toHaveBeenCalledTimes(i + 1);
        });
      }
    });

    it('should allow multiple kiss sends without limit', async () => {
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);

      const kissButton = screen.getByTestId('kiss-button');

      // Send 10 kisses in sequence
      for (let i = 0; i < 10; i++) {
        fireEvent.click(kissButton);
        await waitFor(() => {
          expect(mockSendKiss).toHaveBeenCalledTimes(i + 1);
        });
      }
    });
  });
});
