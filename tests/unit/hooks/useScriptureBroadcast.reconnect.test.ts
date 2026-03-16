/**
 * useScriptureBroadcast Reconnection Tests (ATDD — RED PHASE)
 *
 * Story 4.3: AC #5, #6 — Broadcast channel reconnection and resync
 * Unit tests for channel error handling and re-subscribe behavior.
 *
 * Tests:
 * - Channel CHANNEL_ERROR triggers re-subscribe attempt
 * - On successful re-subscribe, loadSession is called for state resync
 * - No re-subscribe when sessionId is null (session ended)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted() for mock values
const { mockChannel, mockRemoveChannel, mockStoreState } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    send: vi.fn(),
    state: 'idle',
  };
  const mockStoreState = {
    onPartnerJoined: vi.fn(),
    onPartnerReady: vi.fn(),
    onBroadcastReceived: vi.fn(),
    applySessionConverted: vi.fn(),
    onPartnerLockInChanged: vi.fn(),
    setPartnerDisconnected: vi.fn(),
    loadSession: vi.fn(),
    currentUserId: 'user-1',
    sessionUserId: 'user-1',
    sessionIdFromStore: 'session-001',
    session: {
      id: 'session-001',
      userId: 'user-1',
    },
  };
  return { mockChannel, mockRemoveChannel: vi.fn().mockResolvedValue(undefined), mockStoreState };
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

vi.mock('../../../src/stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState)
  ),
}));

vi.mock('../../../src/services/scriptureReadingService', () => ({
  ScriptureErrorCode: { SYNC_FAILED: 'SYNC_FAILED' },
  handleScriptureError: vi.fn(),
}));

/** Flush the setAuth → getUser → subscribe promise chain */
async function flushPromises(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('useScriptureBroadcast — channel reconnection (Story 4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('[P0] CHANNEL_ERROR triggers handleScriptureError and re-subscribe attempt', async () => {
    const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

    renderHook(() => useScriptureBroadcast('session-001'));

    // Flush promise chain so subscribe callback is registered
    await flushPromises();

    // Simulate channel subscribe callback with CHANNEL_ERROR status
    const subscribeCallback = mockChannel.subscribe.mock.calls[0]?.[0];
    expect(subscribeCallback).toBeDefined();
    subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'));

    const { handleScriptureError } = await import('../../../src/services/scriptureReadingService');
    expect(handleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SYNC_FAILED' })
    );
  });

  test('[P1] on successful re-subscribe, loadSession is called for state resync', async () => {
    const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

    renderHook(() => useScriptureBroadcast('session-001'));

    // Flush promise chain so subscribe callback is registered
    await flushPromises();

    const subscribeCallback = mockChannel.subscribe.mock.calls[0]?.[0];
    expect(subscribeCallback).toBeDefined();

    // First: error occurs (sets hasErroredRef = true)
    subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'));
    // Then: re-subscribe succeeds (hasErroredRef is true → loadSession called)
    subscribeCallback('SUBSCRIBED');

    // loadSession should be called to resync state
    expect(mockStoreState.loadSession).toHaveBeenCalledWith('session-001');
  });

  test('[P1] does NOT re-subscribe when sessionId is null (session ended)', async () => {
    const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

    // Render with null sessionId
    renderHook(() => useScriptureBroadcast(null));

    // Channel should NOT be created
    const { supabase } = await import('../../../src/api/supabaseClient');
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.3)
  // ===========================================================================

  test('[P1] CLOSED status with active session sets hasErrored flag for resync on re-subscribe', async () => {
    const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

    renderHook(() => useScriptureBroadcast('session-001'));
    await flushPromises();

    const subscribeCallback = mockChannel.subscribe.mock.calls[0]?.[0];
    expect(subscribeCallback).toBeDefined();

    // Simulate CLOSED status (session still active via mockStoreState.session)
    subscribeCallback('CLOSED');

    // Then: on next SUBSCRIBED, loadSession should be called (hasErrored was set)
    subscribeCallback('SUBSCRIBED');

    expect(mockStoreState.loadSession).toHaveBeenCalledWith('session-001');
  });

  test('[P2] cleanup on unmount removes channel', async () => {
    const { useScriptureBroadcast } = await import('../../../src/hooks/useScriptureBroadcast');

    const { unmount } = renderHook(() => useScriptureBroadcast('session-001'));
    await flushPromises();

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
