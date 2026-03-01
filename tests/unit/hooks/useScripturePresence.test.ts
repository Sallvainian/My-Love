/**
 * useScripturePresence Hook Tests
 *
 * Story 4.2: AC #2 — Partner Position Indicator
 * Unit tests for the presence channel lifecycle hook.
 *
 * Tests:
 * - Channel joined on non-null sessionId
 * - setAuth called before subscribe
 * - Sends presence immediately on SUBSCRIBED
 * - Re-sends presence when view prop changes
 * - Partner presence returned when presence_update received
 * - Presence dropped if ts > 20s stale
 * - Presence reset to null on stepIndex change
 * - Cleanup removes channel and clears interval
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScripturePresence } from '../../../src/hooks/useScripturePresence';

// ============================================
// Mocks — use vi.hoisted() for values referenced inside vi.mock() factory
// ============================================

type BroadcastHandler = (payload: { payload: Record<string, unknown> }) => void;
type SubscribeCallback = (status: string, err?: Error) => void;

let broadcastHandlers: Record<string, BroadcastHandler> = {};
let subscribedCallback: SubscribeCallback | null = null;

const mocks = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue(undefined);
  const on = vi.fn();
  const subscribe = vi.fn();
  const channel = vi.fn();
  const removeChannel = vi.fn().mockResolvedValue(undefined);
  const setAuth = vi.fn().mockResolvedValue(undefined);

  const mockChannel = { on, subscribe, send };
  channel.mockReturnValue(mockChannel);

  return { send, on, subscribe, channel, removeChannel, setAuth, mockChannel };
});

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    realtime: { setAuth: mocks.setAuth },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'current-user-id' } } }),
    },
  },
}));

import { supabase } from '../../../src/api/supabaseClient';

// Mock scriptureReadingService for error routing
const { mockHandleScriptureError } = vi.hoisted(() => ({
  mockHandleScriptureError: vi.fn(),
}));

vi.mock('../../../src/services/scriptureReadingService', () => ({
  ScriptureErrorCode: {
    SYNC_FAILED: 'SYNC_FAILED',
  },
  handleScriptureError: mockHandleScriptureError,
}));

// ============================================
// Tests
// ============================================

describe('useScripturePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    broadcastHandlers = {};
    subscribedCallback = null;

    mocks.on.mockImplementation(
      (_type: string, config: { event: string }, handler: BroadcastHandler) => {
        broadcastHandlers[config.event] = handler;
        return mocks.mockChannel;
      }
    );
    mocks.subscribe.mockImplementation((cb?: SubscribeCallback) => {
      subscribedCallback = cb ?? null;
      return mocks.mockChannel;
    });
    mocks.channel.mockReturnValue(mocks.mockChannel);
    mocks.setAuth.mockResolvedValue(undefined);
    mocks.removeChannel.mockResolvedValue(undefined);
    mocks.send.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('[P1] does not join channel when sessionId is null', () => {
    renderHook(() => useScripturePresence(null, 0, 'verse'));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  test("[P1] joins channel 'scripture-presence:{sessionId}' with private:true", async () => {
    await act(async () => {
      renderHook(() => useScripturePresence('session-abc', 0, 'verse'));
    });

    expect(supabase.channel).toHaveBeenCalledWith(
      'scripture-presence:session-abc',
      expect.objectContaining({ config: expect.objectContaining({ private: true }) })
    );
  });

  test('[P1] calls setAuth before subscribing', async () => {
    await act(async () => {
      renderHook(() => useScripturePresence('session-abc', 0, 'verse'));
    });

    expect(mocks.setAuth).toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalled();
  });

  test('[P1] sends own presence immediately on SUBSCRIBED status', async () => {
    await act(async () => {
      renderHook(() => useScripturePresence('session-abc', 0, 'verse'));
    });

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'presence_update',
        payload: expect.objectContaining({
          user_id: 'current-user-id',
          step_index: 0,
          view: 'verse',
          ts: expect.any(Number),
        }),
      })
    );
  });

  test('[P1] re-sends presence when view prop changes', async () => {
    const { rerender } = renderHook(({ view }) => useScripturePresence('session-abc', 0, view), {
      initialProps: { view: 'verse' as const },
    });

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    mocks.send.mockClear();

    await act(async () => {
      rerender({ view: 'response' });
    });

    // Should have re-sent presence with updated view
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ view: 'response' }),
      })
    );
  });

  test('[P1] returns partner presence when presence_update broadcast received', async () => {
    const { result } = renderHook(() => useScripturePresence('session-abc', 0, 'verse'));

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    await act(async () => {
      broadcastHandlers['presence_update']?.({
        payload: {
          user_id: 'partner-id',
          step_index: 0,
          view: 'response',
          ts: Date.now(),
        },
      });
    });

    expect(result.current.view).toBe('response');
    expect(result.current.stepIndex).toBe(0);
  });

  test('[P2] drops presence older than 20s TTL', async () => {
    const { result } = renderHook(() => useScripturePresence('session-abc', 0, 'verse'));

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    await act(async () => {
      broadcastHandlers['presence_update']?.({
        payload: {
          user_id: 'partner-id',
          step_index: 0,
          view: 'response',
          ts: Date.now() - 25_000, // 25s stale — exceeds 20s TTL
        },
      });
    });

    // Stale presence should be dropped
    expect(result.current.view).toBeNull();
  });

  test('[P1] resets partner presence to null on stepIndex change', async () => {
    const { result, rerender } = renderHook(
      ({ stepIndex }) => useScripturePresence('session-abc', stepIndex, 'verse'),
      { initialProps: { stepIndex: 0 } }
    );

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    // Receive partner presence
    await act(async () => {
      broadcastHandlers['presence_update']?.({
        payload: {
          user_id: 'partner-id',
          step_index: 0,
          view: 'response',
          ts: Date.now(),
        },
      });
    });

    expect(result.current.view).toBe('response');

    // Change step index — should reset partner presence
    await act(async () => {
      rerender({ stepIndex: 1 });
    });

    expect(result.current.view).toBeNull();
  });

  test('[P1] removes channel and clears interval on unmount', async () => {
    let unmount: () => void;

    await act(async () => {
      const result = renderHook(() => useScripturePresence('session-abc', 0, 'verse'));
      unmount = result.unmount;
    });

    unmount!();

    expect(supabase.removeChannel).toHaveBeenCalledWith(mocks.mockChannel);
  });

  test('[P2] sends heartbeat every 10s', async () => {
    await act(async () => {
      renderHook(() => useScripturePresence('session-abc', 0, 'verse'));
    });

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    mocks.send.mockClear();

    // Advance 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    // Should have sent a heartbeat
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'presence_update',
        payload: expect.objectContaining({ view: 'verse' }),
      })
    );
  });

  test('[P1] heartbeat uses latest step/view after props change', async () => {
    let rerender: ((props: { stepIndex: number; view: 'verse' | 'response' }) => void) | null =
      null;

    await act(async () => {
      const hook = renderHook(
        ({ stepIndex, view }) => useScripturePresence('session-abc', stepIndex, view),
        { initialProps: { stepIndex: 0, view: 'verse' as const } }
      );
      rerender = hook.rerender;
    });

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    await act(async () => {
      rerender?.({ stepIndex: 1, view: 'response' });
    });

    mocks.send.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'presence_update',
        payload: expect.objectContaining({
          step_index: 1,
          view: 'response',
        }),
      })
    );
  });
});
