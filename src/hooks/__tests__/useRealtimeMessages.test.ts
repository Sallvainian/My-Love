// src/hooks/__tests__/useRealtimeMessages.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRealtimeMessages } from '../useRealtimeMessages';

// Mock Supabase
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock auth session service
vi.mock('../../api/auth/sessionService', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-123'),
}));

// Mock app store
vi.mock('../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      addNote: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('useRealtimeMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to broadcast channel on mount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('love-notes:user-123');
    });
  });

  it('should listen for broadcast new_message events', async () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    };

    const { supabase } = await import('../../api/supabaseClient');
    vi.mocked(supabase.channel).mockReturnValue(
      mockChannel as ReturnType<typeof supabase.channel>
    );

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'new_message' },
        expect.any(Function)
      );
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    const { unmount } = renderHook(() => useRealtimeMessages());

    // Wait for subscription to be established
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('should not subscribe when enabled is false', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages({ enabled: false }));

    // Wait a bit for any async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('should not subscribe when user is not authenticated', async () => {
    const sessionService = await import('../../api/auth/sessionService');
    const { supabase } = await import('../../api/supabaseClient');

    // Mock user not authenticated
    vi.mocked(sessionService.getCurrentUserId).mockResolvedValueOnce(null);

    renderHook(() => useRealtimeMessages());

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not attempt to create a channel
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on CHANNEL_ERROR with exponential backoff', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        // Only update callback if one is provided (retry calls subscribe without callback)
        if (callback) subscribeCallback = callback;
        return mockChannel; // Return the channel for chaining
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      // Simulate CHANNEL_ERROR
      await act(async () => {
        subscribeCallback?.('CHANNEL_ERROR', new Error('Connection failed'));
      });

      // Should schedule retry after 1000ms (base delay)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it('should retry on TIMED_OUT', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate TIMED_OUT
      await act(async () => {
        subscribeCallback?.('TIMED_OUT');
      });

      // Should schedule retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max retries (5)', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate 6 consecutive failures (initial + 5 retries)
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          subscribeCallback?.('CHANNEL_ERROR', new Error('Connection failed'));
        });

        // Advance time for exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(delay + 100);
        });
      }

      // Should have made 6 attempts total (1 initial + 5 retries)
      // After max retries, no more attempts should be made
      expect(mockSubscribe).toHaveBeenCalledTimes(6);
    });

    it('should reset retry count on successful subscription', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate error then success
      await act(async () => {
        subscribeCallback?.('CHANNEL_ERROR');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // Now simulate successful subscription (2 subscribe calls now)
      await act(async () => {
        subscribeCallback?.('SUBSCRIBED');
      });

      // Simulate another error - retry count should be reset
      await act(async () => {
        subscribeCallback?.('CHANNEL_ERROR');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000); // Should be 1s since retry count reset
      });

      // Should retry with base delay again (1s not 2s, proving counter was reset)
      // Count: initial(1) + retry after first error(2) + retry after second error(3)
      expect(mockSubscribe).toHaveBeenCalledTimes(3);
    });

    it('should clear retry timeout on unmount', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      let unmountFn: () => void;
      await act(async () => {
        const { unmount } = renderHook(() => useRealtimeMessages());
        unmountFn = unmount;
        await vi.runOnlyPendingTimersAsync();
      });

      // Trigger error to schedule retry
      await act(async () => {
        subscribeCallback?.('CHANNEL_ERROR');
      });

      // Unmount before retry timer fires
      unmountFn!();

      // Advance past the retry timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Should only have initial subscription, no retry after unmount
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Handling', () => {
    it('should call onNewMessage callback when message received', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const onNewMessage = vi.fn();

      let broadcastCallback: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn((type, options, callback) => {
          if (type === 'broadcast' && options.event === 'new_message') {
            broadcastCallback = callback;
          }
          return mockChannel;
        }),
        subscribe: vi.fn((callback) => {
          callback('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      };

      vi.mocked(supabase.channel).mockReturnValue(
        mockChannel as ReturnType<typeof supabase.channel>
      );

      renderHook(() => useRealtimeMessages({ onNewMessage }));

      // Wait for async setup to complete
      await waitFor(() => {
        expect(broadcastCallback).not.toBeNull();
      });

      // Simulate receiving a message
      const mockMessage = {
        id: 'msg-1',
        from_user_id: 'partner-123',
        to_user_id: 'user-123',
        content: 'Hello!',
        created_at: '2024-01-01T10:00:00Z',
      };

      act(() => {
        broadcastCallback?.({
          type: 'broadcast',
          event: 'new_message',
          payload: { message: mockMessage },
        });
      });

      expect(onNewMessage).toHaveBeenCalledWith(mockMessage);
    });
  });
});
