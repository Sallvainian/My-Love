// src/hooks/__tests__/useRealtimeMessages.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

// Mock auth service
vi.mock('../../api/authService', () => ({
  authService: {
    getCurrentUserId: vi.fn().mockResolvedValue('user-123'),
  },
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
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

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
});
