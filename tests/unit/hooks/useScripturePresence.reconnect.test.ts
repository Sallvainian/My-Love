/**
 * useScripturePresence Reconnection Tests (ATDD — RED PHASE)
 *
 * Story 4.3: AC #1, #5 — Partner connection state tracking
 * Unit tests for isPartnerConnected field in PartnerPresenceInfo.
 *
 * Tests:
 * - isPartnerConnected = true initially
 * - After 20s with no presence_update: isPartnerConnected = false
 * - New presence_update after disconnect: isPartnerConnected = true
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted() for mock values
const { mockChannel, mockSubscribe, mockRemoveChannel } = vi.hoisted(() => {
  const mockSend = vi.fn();
  // Auto-call the subscribe callback with 'SUBSCRIBED' status
  const mockSubscribe = vi.fn((cb: (status: string) => void) => {
    cb('SUBSCRIBED');
  });
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: mockSubscribe,
    send: mockSend,
  };
  return {
    mockChannel,
    mockSubscribe,
    mockSend,
    mockRemoveChannel: vi.fn(),
  };
});

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
    realtime: {
      setAuth: vi.fn().mockResolvedValue(undefined),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('../../../src/services/scriptureReadingService', () => ({
  ScriptureErrorCode: { SYNC_FAILED: 'SYNC_FAILED' },
  handleScriptureError: vi.fn(),
}));

describe('useScripturePresence — isPartnerConnected (Story 4.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('[P0] returns isPartnerConnected=true initially when session is active', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    const { result } = renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    // Initially connected (no disconnect detected yet)
    expect(result.current.isPartnerConnected).toBe(true);
  });

  test('[P0] sets isPartnerConnected=false after 20s with no presence_update', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    const { result } = renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    // Flush the promise chain (setAuth → getUser → subscribe → SUBSCRIBED → stale timer starts)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Now advance past the stale TTL
    act(() => {
      vi.advanceTimersByTime(20_001); // Past stale TTL
    });

    expect(result.current.isPartnerConnected).toBe(false);
  });

  test('[P0] sets isPartnerConnected=true when new presence_update arrives after disconnect', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    const { result } = renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    // Flush the promise chain (setAuth → getUser → subscribe → SUBSCRIBED → stale timer starts)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Simulate disconnect
    act(() => {
      vi.advanceTimersByTime(20_001);
    });
    expect(result.current.isPartnerConnected).toBe(false);

    // Simulate reconnect — new presence_update arrives
    // Find the presence_update handler registered via channel.on()
    const presenceHandler = mockChannel.on.mock.calls.find(
      (call: unknown[]) => (call[1] as { event?: string })?.event === 'presence_update'
    )?.[2];

    if (presenceHandler) {
      act(() => {
        presenceHandler({
          payload: {
            user_id: 'user-2',
            step_index: 0,
            view: 'verse',
            ts: Date.now(),
          },
        });
      });
    }

    expect(result.current.isPartnerConnected).toBe(true);
  });

  test('[P0] re-subscribes after realtime channel error', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');
    const { supabase } = await import('../../../src/api/supabaseClient');

    renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const firstSubscribeCallback = mockSubscribe.mock.calls[0]?.[0] as
      | ((status: string, err?: unknown) => void)
      | undefined;

    expect(firstSubscribeCallback).toBeTypeOf('function');

    act(() => {
      firstSubscribeCallback?.('CHANNEL_ERROR', new Error('network failure'));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockRemoveChannel).toHaveBeenCalled();
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.3)
  // ===========================================================================

  test('[P1] drops stale presence_update with ts older than 20s', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    const { result } = renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Find the presence_update handler
    const presenceHandler = mockChannel.on.mock.calls.find(
      (call: unknown[]) => (call[1] as { event?: string })?.event === 'presence_update'
    )?.[2];

    // Send a stale presence_update (ts is 25s in the past)
    if (presenceHandler) {
      act(() => {
        presenceHandler({
          payload: {
            user_id: 'user-2',
            step_index: 3,
            view: 'response',
            ts: Date.now() - 25_000, // stale
          },
        });
      });
    }

    // Stale payload should be dropped — view should still be null (initial state)
    expect(result.current.view).toBeNull();
    expect(result.current.stepIndex).toBeNull();
  });

  test('[P2] cleanup on unmount clears stale timer and channel', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    const { unmount } = renderHook(() => useScripturePresence('session-001', 0, 'verse'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // When: unmount the hook
    unmount();

    // Then: channel should be removed
    expect(mockRemoveChannel).toHaveBeenCalled();

    // Then: advancing timers should not cause errors (stale timer cleared)
    act(() => {
      vi.advanceTimersByTime(25_000);
    });
  });

  test('[P2] no channel created when sessionId is null', async () => {
    const { useScripturePresence } = await import('../../../src/hooks/useScripturePresence');

    renderHook(() => useScripturePresence(null, 0, 'verse'));

    const { supabase } = await import('../../../src/api/supabaseClient');
    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
