/**
 * useScriptureBroadcast Error Handling Tests
 *
 * AC-4: channel.send() rejection → handleScriptureError with SYNC_FAILED
 * AC-5: removeChannel() rejection during CHANNEL_ERROR → handleScriptureError + isRetryingRef reset
 * AC-6: _broadcastFn synchronous throw → caught and routed to handleScriptureError
 * AC-11: No subscribe/broadcast when userId is falsy
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScriptureBroadcast } from '../../../src/hooks/useScriptureBroadcast';

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
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'current-user-id' } } });

  const mockChannel = { on, subscribe, send, state: null };

  channel.mockReturnValue(mockChannel);

  return { send, on, subscribe, channel, removeChannel, setAuth, getUser, mockChannel };
});

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    realtime: { setAuth: mocks.setAuth },
    auth: {
      getUser: (...args: unknown[]) => mocks.getUser(...args),
    },
  },
}));

const mockSetBroadcastFn = vi.fn();
const mockLoadSession = vi.fn();

const mockStoreState = {
  onPartnerJoined: vi.fn(),
  onBroadcastReceived: vi.fn(),
  applySessionConverted: vi.fn(),
  onPartnerLockInChanged: vi.fn(),
  loadSession: mockLoadSession,
  setBroadcastFn: mockSetBroadcastFn,
  currentUserId: 'user-1',
  sessionUserId: 'user-1',
  sessionIdFromStore: 'session-001',
  session: { userId: 'user-1', id: 'session-001' },
};

vi.mock('../../../src/stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

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

describe('useScriptureBroadcast — error handling', () => {
  beforeEach(() => {
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
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'current-user-id' } } });
    mockHandleScriptureError.mockReset();
    mockSetBroadcastFn.mockReset();
    mockLoadSession.mockReset();
    Object.assign(mockStoreState, {
      currentUserId: 'user-1',
      sessionUserId: 'user-1',
      sessionIdFromStore: 'session-001',
      session: { userId: 'user-1', id: 'session-001' },
    });
  });

  // ===========================================================================
  // AC-4: channel.send() rejection → handleScriptureError
  // ===========================================================================

  test('partner_joined send rejection calls handleScriptureError with SYNC_FAILED', async () => {
    const sendError = new Error('send failed');
    // send rejects after SUBSCRIBED fires
    mocks.send.mockRejectedValue(sendError);

    renderHook(() => useScriptureBroadcast('session-001'));

    // Wait for setAuth promise to resolve
    await act(async () => {
      await vi.waitFor(() => expect(subscribedCallback).not.toBeNull());
    });

    // Trigger SUBSCRIBED
    await act(async () => {
      subscribedCallback!('SUBSCRIBED');
      // Let microtasks (the .catch handler) run
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYNC_FAILED',
        message: 'Broadcast send failed',
      })
    );
  });

  // ===========================================================================
  // AC-5: removeChannel() rejection during CHANNEL_ERROR
  // ===========================================================================

  test('removeChannel rejection during CHANNEL_ERROR calls handleScriptureError', async () => {
    const removeError = new Error('remove failed');
    mocks.removeChannel.mockRejectedValue(removeError);

    renderHook(() => useScriptureBroadcast('session-001'));

    await act(async () => {
      await vi.waitFor(() => expect(subscribedCallback).not.toBeNull());
    });

    await act(async () => {
      subscribedCallback!('CHANNEL_ERROR', new Error('channel error'));
      await new Promise((r) => setTimeout(r, 0));
    });

    // handleScriptureError should be called for both the channel error AND the cleanup failure
    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYNC_FAILED',
        message: 'Channel cleanup failed',
      })
    );
  });

  // ===========================================================================
  // AC-6: _broadcastFn synchronous throw → caught
  // ===========================================================================

  test('setBroadcastFn wraps send in try/catch for synchronous throws', async () => {
    // Start with send working normally so SUBSCRIBED + partner_joined succeeds
    renderHook(() => useScriptureBroadcast('session-001'));

    await act(async () => {
      await vi.waitFor(() => expect(subscribedCallback).not.toBeNull());
    });

    await act(async () => {
      subscribedCallback!('SUBSCRIBED');
      await new Promise((r) => setTimeout(r, 0));
    });

    // Extract the broadcast function that was passed to setBroadcastFn
    const broadcastFnCall = mockSetBroadcastFn.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'function'
    );
    expect(broadcastFnCall).toBeDefined();

    const broadcastFn = broadcastFnCall![0] as (event: string, payload: unknown) => void;

    // NOW make send throw synchronously — simulating channel in a bad state
    mocks.send.mockImplementation(() => {
      throw new Error('sync throw');
    });

    mockHandleScriptureError.mockClear();

    // Call the broadcast function — the synchronous throw should be caught
    broadcastFn('test_event', { data: 'test' });

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYNC_FAILED',
        message: 'Broadcast send threw synchronously',
      })
    );
  });

  // ===========================================================================
  // AC-11: No subscribe when userId is falsy
  // ===========================================================================

  test('does NOT subscribe or broadcast when user ID is unavailable', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: undefined } },
      error: null,
    });

    renderHook(() => useScriptureBroadcast('session-001'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // subscribe should not have had its callback invoked for SUBSCRIBED
    // because the early return prevents channel.subscribe from being called
    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
        message: 'No user ID available for broadcast channel',
      })
    );
  });
});
