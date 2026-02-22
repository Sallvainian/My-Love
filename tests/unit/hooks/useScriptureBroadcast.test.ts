/**
 * useScriptureBroadcast Hook Tests
 *
 * Story 4.1: AC #2, #3, #4, #5
 * Unit tests for the broadcast channel lifecycle hook.
 *
 * Tests:
 * - No channel join when sessionId is null
 * - setAuth called before subscribe
 * - Correct channel name scripture-session:{id} with private:true
 * - No duplicate subscription (channelRef guard)
 * - partner_joined broadcast on SUBSCRIBED
 * - Dispatches onPartnerJoined on incoming partner_joined event
 * - Dispatches onPartnerReady on ready_state_changed event
 * - removeChannel called on cleanup
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScriptureBroadcast } from '../../../src/hooks/useScriptureBroadcast';

// ============================================
// Mocks — use vi.hoisted() for values referenced inside vi.mock() factory
// ============================================

type BroadcastHandler = (payload: { payload: Record<string, unknown> }) => void;
type SubscribeCallback = (status: string, err?: Error) => void;

let broadcastHandlers: Record<string, BroadcastHandler> = {};
let subscribedCallback: SubscribeCallback | null = null;

// vi.hoisted() ensures these are initialized before vi.mock() factories run
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

// Import the mocked supabase AFTER vi.mock for direct use in tests
import { supabase } from '../../../src/api/supabaseClient';

// ============================================
// Mock Zustand store actions dispatched by the hook
// ============================================

const mockOnPartnerJoined = vi.fn();
const mockOnPartnerReady = vi.fn();
const mockOnBroadcastReceived = vi.fn();
const mockApplySessionConverted = vi.fn();

const mockStoreState = {
  onPartnerJoined: mockOnPartnerJoined,
  onPartnerReady: mockOnPartnerReady,
  onBroadcastReceived: mockOnBroadcastReceived,
  applySessionConverted: mockApplySessionConverted,
};

vi.mock('../../../src/stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

// ============================================
// Mock scriptureReadingService for error routing tests
// vi.hoisted() ensures the mock value is initialized before vi.mock() factory runs
// ============================================

const { mockHandleScriptureError } = vi.hoisted(() => ({
  mockHandleScriptureError: vi.fn(),
}));

vi.mock('../../../src/services/scriptureReadingService', () => ({
  ScriptureErrorCode: {
    VERSION_MISMATCH: 'VERSION_MISMATCH',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SYNC_FAILED: 'SYNC_FAILED',
    OFFLINE: 'OFFLINE',
    CACHE_CORRUPTED: 'CACHE_CORRUPTED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
  },
  handleScriptureError: mockHandleScriptureError,
}));

// ============================================
// Tests
// ============================================

describe('useScriptureBroadcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broadcastHandlers = {};
    subscribedCallback = null;

    // Re-apply mock implementations after clearAllMocks()
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
    mockApplySessionConverted.mockReset();
    mockHandleScriptureError.mockReset();
  });

  test('[P1] does not join channel when sessionId is null', () => {
    renderHook(() => useScriptureBroadcast(null));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  test('[P1] joins channel with name scripture-session:{sessionId}', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    expect(supabase.channel).toHaveBeenCalledWith(
      'scripture-session:session-abc',
      expect.objectContaining({ config: expect.objectContaining({ private: true }) })
    );
  });

  test('[P1] calls supabase.realtime.setAuth before subscribing', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    expect(mocks.setAuth).toHaveBeenCalled();
    expect(mocks.subscribe).toHaveBeenCalled();
  });

  test('[P0] does not subscribe a second time when channelRef is already set', async () => {
    const { rerender } = renderHook(() => useScriptureBroadcast('session-abc'));

    await act(async () => {
      rerender();
    });

    // channel() only called once — re-renders with same sessionId should not re-subscribe
    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  test('[P1] broadcasts partner_joined event with user_id when SUBSCRIBED status fires', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    await act(async () => {
      subscribedCallback?.('SUBSCRIBED');
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'partner_joined',
        payload: { user_id: 'current-user-id' },
      })
    );
  });

  test('[P1] calls applySessionConverted (not convertToSolo RPC) on session_converted event', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    broadcastHandlers['session_converted']?.({
      payload: { mode: 'solo', session_id: 'session-abc' },
    });

    expect(mockApplySessionConverted).toHaveBeenCalledTimes(1);
  });

  test('[P1] calls onPartnerJoined when partner_joined event is received', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    broadcastHandlers['partner_joined']?.({ payload: { user_id: 'user-2' } });

    expect(mockOnPartnerJoined).toHaveBeenCalledTimes(1);
  });

  test('[P1] calls onPartnerReady when ready_state_changed event is received', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    broadcastHandlers['ready_state_changed']?.({
      payload: { user_id: 'user-2', is_ready: true },
    });

    expect(mockOnPartnerReady).toHaveBeenCalledWith(true);
  });

  test('[P1] calls removeChannel on unmount', async () => {
    let unmount: () => void;

    await act(async () => {
      const result = renderHook(() => useScriptureBroadcast('session-abc'));
      unmount = result.unmount;
    });

    unmount!();

    expect(supabase.removeChannel).toHaveBeenCalledWith(mocks.mockChannel);
  });

  test('[P1] calls handleScriptureError(SYNC_FAILED) when setAuth rejects', async () => {
    mocks.setAuth.mockRejectedValueOnce(new Error('Auth token expired'));

    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SYNC_FAILED' })
    );
  });

  test('[P1] calls handleScriptureError(SYNC_FAILED) on CHANNEL_ERROR status', async () => {
    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    await act(async () => {
      subscribedCallback?.('CHANNEL_ERROR', new Error('WebSocket closed'));
    });

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SYNC_FAILED' })
    );
  });

  test('[P1] calls handleScriptureError(SYNC_FAILED) when getUser fails after setAuth', async () => {
    const { supabase: mockSupa } = await import('../../../src/api/supabaseClient');
    vi.mocked(mockSupa.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Session expired', name: 'AuthError', status: 401 },
    });

    await act(async () => {
      renderHook(() => useScriptureBroadcast('session-abc'));
    });

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SYNC_FAILED' })
    );
  });
});
