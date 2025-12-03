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

// Mock Supabase client - MUST include supabase export for authService dependency
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
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
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  getPartnerId: vi.fn(),
  getCurrentUserId: vi.fn().mockResolvedValue('test-user-id'),
  initializeAuth: vi.fn(),
}));

// Mock authService - required for components that use authentication
vi.mock('../../../src/api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn(() => Promise.resolve('test-user-id')),
    getCurrentUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
    getUser: vi.fn(() => Promise.resolve({ id: 'test-user-id' })),
  },
}));

// Mock Framer Motion to avoid animation issues in tests
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

    // Clear localStorage to reset rate limiting between tests
    localStorage.clear();

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

  // Helper to expand FAB menu before accessing action buttons
  const expandFAB = () => {
    const fabButton = screen.getByTestId('fab-main-button');
    fireEvent.click(fabButton);
  };

  describe('AC#1: Interaction buttons in interface', () => {
    it('should render poke button', () => {
      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');
      expect(pokeButton).toBeInTheDocument();
      expect(pokeButton).toHaveAttribute('aria-label', 'Poke');
    });

    it('should render kiss button', () => {
      render(<PokeKissInterface />);
      expandFAB();

      const kissButton = screen.getByTestId('kiss-button');
      expect(kissButton).toBeInTheDocument();
      expect(kissButton).toHaveAttribute('aria-label', 'Kiss');
    });

    it('should render history button', () => {
      render(<PokeKissInterface />);
      expandFAB();

      const historyButton = screen.getByTestId('history-button');
      expect(historyButton).toBeInTheDocument();
      expect(historyButton).toHaveAttribute('aria-label', 'History');
    });
  });

  describe('AC#2: Tapping sends interaction', () => {
    it('should call sendPoke when poke button is clicked', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        expect(mockSendPoke).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should call sendKiss when kiss button is clicked', async () => {
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);
      expandFAB();

      const kissButton = screen.getByTestId('kiss-button');
      fireEvent.click(kissButton);

      await waitFor(() => {
        expect(mockSendKiss).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should show success toast after sending poke', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

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
      expandFAB();

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
      expandFAB();

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
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        const toast = screen.getByTestId('toast-notification');
        expect(toast).toHaveTextContent('Failed to send poke. Try again.');
      });
    });

    it('should set rate limit timestamp in localStorage after successful send', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');

      // Button should be enabled initially (no cooldown)
      expect(pokeButton).not.toBeDisabled();

      // Click button to send poke
      fireEvent.click(pokeButton);

      // Wait for send to complete
      await waitFor(() => {
        expect(mockSendPoke).toHaveBeenCalledWith('partner-uuid-123');
      });

      // Verify localStorage was updated with rate limit timestamp
      await waitFor(() => {
        const lastPokeTime = localStorage.getItem('lastPokeTime');
        expect(lastPokeTime).toBeTruthy();
        // Timestamp should be recent (within last 5 seconds)
        const timeDiff = Date.now() - parseInt(lastPokeTime!, 10);
        expect(timeDiff).toBeLessThan(5000);
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
      expandFAB();

      const historyButton = screen.getByTestId('history-button');
      fireEvent.click(historyButton);

      await waitFor(() => {
        // InteractionHistory component should be rendered
        expect(screen.getByTestId('interaction-history-modal')).toBeInTheDocument();
      });
    });
  });

  describe('AC#7: Rate limiting', () => {
    it('should allow first poke when no cooldown active', async () => {
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        expect(mockSendPoke).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should allow first kiss when no cooldown active', async () => {
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);
      expandFAB();

      const kissButton = screen.getByTestId('kiss-button');
      fireEvent.click(kissButton);

      await waitFor(() => {
        expect(mockSendKiss).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should disable poke button when cooldown is active', async () => {
      // Set recent poke time in localStorage (within 30 min)
      localStorage.setItem('lastPokeTime', String(Date.now()));
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');

      // Button should be disabled when cooldown is active
      await waitFor(() => {
        expect(pokeButton).toBeDisabled();
      });

      // Clicking disabled button should not call sendPoke
      fireEvent.click(pokeButton);
      expect(mockSendPoke).not.toHaveBeenCalled();
    });

    it('should disable kiss button when cooldown is active', async () => {
      // Set recent kiss time in localStorage (within 30 min)
      localStorage.setItem('lastKissTime', String(Date.now()));
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);
      expandFAB();

      const kissButton = screen.getByTestId('kiss-button');

      // Button should be disabled when cooldown is active
      await waitFor(() => {
        expect(kissButton).toBeDisabled();
      });

      // Clicking disabled button should not call sendKiss
      fireEvent.click(kissButton);
      expect(mockSendKiss).not.toHaveBeenCalled();
    });

    it('should allow poke after cooldown expires', async () => {
      // Set poke time to 31 minutes ago (cooldown expired)
      const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
      localStorage.setItem('lastPokeTime', String(thirtyOneMinutesAgo));
      mockSendPoke.mockResolvedValue({ id: 'poke-1', type: 'poke' });

      render(<PokeKissInterface />);
      expandFAB();

      const pokeButton = screen.getByTestId('poke-button');
      fireEvent.click(pokeButton);

      await waitFor(() => {
        expect(mockSendPoke).toHaveBeenCalledWith('partner-uuid-123');
      });
    });

    it('should allow independent cooldowns for poke and kiss', async () => {
      // Set poke on cooldown but kiss available
      localStorage.setItem('lastPokeTime', String(Date.now()));
      // Don't set lastKissTime - kiss should be available
      mockSendKiss.mockResolvedValue({ id: 'kiss-1', type: 'kiss' });

      render(<PokeKissInterface />);
      expandFAB();

      const kissButton = screen.getByTestId('kiss-button');
      fireEvent.click(kissButton);

      // Kiss should work even though poke is on cooldown
      await waitFor(() => {
        expect(mockSendKiss).toHaveBeenCalledWith('partner-uuid-123');
      });
    });
  });
});
