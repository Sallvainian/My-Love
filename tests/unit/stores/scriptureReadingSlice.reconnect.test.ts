/**
 * scriptureReadingSlice Reconnection & End Session Tests (ATDD — RED PHASE)
 *
 * Story 4.3: Reconnection & Graceful Degradation
 * Unit tests for disconnection state, endSession action, and broadcast handling.
 *
 * Tests:
 * - setPartnerDisconnected(true) sets state correctly
 * - setPartnerDisconnected(false) clears state
 * - endSession() calls scripture_end_session RPC
 * - endSession() on error calls handleScriptureError
 * - endSession() is a no-op when session is null
 * - onBroadcastReceived with triggeredBy='end_session' calls exitSession()
 * - onBroadcastReceived with currentPhase='complete' calls exitSession()
 * - partnerDisconnected and partnerDisconnectedAt in initial state
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

// Use vi.hoisted() for values referenced inside vi.mock() factories
const { mockRpc, mockGetSession } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
}));

// Mock supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock the scriptureReadingService
vi.mock('../../../src/services/scriptureReadingService', () => ({
  scriptureReadingService: {
    createSession: vi.fn(),
    getSession: mockGetSession,
    getUserSessions: vi.fn(),
    updateSession: vi.fn(),
    addReflection: vi.fn(),
    getCoupleStats: vi.fn(),
    recoverSessionCache: vi.fn(),
  },
  ScriptureErrorCode: {
    VERSION_MISMATCH: 'VERSION_MISMATCH',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SYNC_FAILED: 'SYNC_FAILED',
    OFFLINE: 'OFFLINE',
    CACHE_CORRUPTED: 'CACHE_CORRUPTED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
  },
  handleScriptureError: vi.fn(),
}));

function createTestStore() {
  return create<ScriptureSlice>()((...args) => ({
    ...createScriptureReadingSlice(...args),
  }));
}

// Helper to set up a store with an active together session in reading phase
async function createStoreWithReadingSession() {
  const { scriptureReadingService } = await import('../../../src/services/scriptureReadingService');
  vi.mocked(scriptureReadingService.createSession).mockResolvedValueOnce({
    id: 'session-reconnect-001',
    mode: 'together',
    currentPhase: 'reading',
    currentStepIndex: 3,
    version: 5,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'in_progress',
    startedAt: new Date(),
  });
  const store = createTestStore();
  await store.getState().createSession('together', 'user-2');
  return store;
}

describe('scriptureReadingSlice — reconnection & end session (Story 4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: {
        sessionId: 'session-reconnect-001',
        currentPhase: 'reading',
        currentStepIndex: 3,
        version: 6,
      },
      error: null,
    });
  });

  // ===========================================================================
  // Initial state
  // ===========================================================================

  test('[P1] initial state has partnerDisconnected=false and partnerDisconnectedAt=null', () => {
    const store = createTestStore();

    expect(store.getState().partnerDisconnected).toBe(false);
    expect(store.getState().partnerDisconnectedAt).toBeNull();
  });

  // ===========================================================================
  // setPartnerDisconnected
  // ===========================================================================

  test('[P0] setPartnerDisconnected(true) sets partnerDisconnected=true and records timestamp', async () => {
    const store = await createStoreWithReadingSession();

    const beforeTimestamp = Date.now();
    store.getState().setPartnerDisconnected(true);
    const afterTimestamp = Date.now();

    expect(store.getState().partnerDisconnected).toBe(true);
    expect(store.getState().partnerDisconnectedAt).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(store.getState().partnerDisconnectedAt).toBeLessThanOrEqual(afterTimestamp);
  });

  test('[P0] setPartnerDisconnected(false) clears partnerDisconnected and partnerDisconnectedAt', async () => {
    const store = await createStoreWithReadingSession();

    // Set disconnected first
    store.getState().setPartnerDisconnected(true);
    expect(store.getState().partnerDisconnected).toBe(true);

    // Clear disconnected
    store.getState().setPartnerDisconnected(false);

    expect(store.getState().partnerDisconnected).toBe(false);
    expect(store.getState().partnerDisconnectedAt).toBeNull();
  });

  // ===========================================================================
  // endSession
  // ===========================================================================

  test('[P0] endSession() calls scripture_end_session RPC with session ID', async () => {
    const store = await createStoreWithReadingSession();

    await store.getState().endSession();

    expect(mockRpc).toHaveBeenCalledWith('scripture_end_session', {
      p_session_id: 'session-reconnect-001',
    });
  });

  test('[P0] endSession() resets all session state on success (via exitSession)', async () => {
    const store = await createStoreWithReadingSession();

    await store.getState().endSession();

    // Session should be cleared (exitSession resets to initialScriptureState)
    expect(store.getState().session).toBeNull();
    expect(store.getState().myRole).toBeNull();
    expect(store.getState().partnerJoined).toBe(false);
    expect(store.getState().partnerDisconnected).toBe(false);
    expect(store.getState().partnerDisconnectedAt).toBeNull();
  });

  test('[P1] endSession() on RPC error calls handleScriptureError with SYNC_FAILED', async () => {
    const store = await createStoreWithReadingSession();

    // Mock RPC to return error
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    await store.getState().endSession();

    const { handleScriptureError } = await import('../../../src/services/scriptureReadingService');
    expect(handleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SYNC_FAILED' })
    );
  });

  test('[P2] endSession() is a no-op when session is null', async () => {
    const store = createTestStore();

    await store.getState().endSession();

    expect(mockRpc).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // onBroadcastReceived — end session triggers
  // ===========================================================================

  test('[P0] onBroadcastReceived with triggeredBy=end_session calls exitSession()', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    store.getState().onBroadcastReceived({
      sessionId: 'session-reconnect-001',
      currentPhase: 'complete',
      version: 10,
      triggeredBy: 'end_session',
    });

    // Session should be cleared
    expect(store.getState().session).toBeNull();
  });

  test('[P0] onBroadcastReceived with currentPhase=complete calls exitSession()', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    store.getState().onBroadcastReceived({
      sessionId: 'session-reconnect-001',
      currentPhase: 'complete',
      version: 10,
    });

    // Session should be cleared
    expect(store.getState().session).toBeNull();
  });

  // ===========================================================================
  // exitSession clears disconnection state
  // ===========================================================================

  test('[P1] exitSession() resets partnerDisconnected fields', async () => {
    const store = await createStoreWithReadingSession();
    store.getState().setPartnerDisconnected(true);

    expect(store.getState().partnerDisconnected).toBe(true);
    expect(store.getState().partnerDisconnectedAt).not.toBeNull();

    store.getState().exitSession();

    expect(store.getState().partnerDisconnected).toBe(false);
    expect(store.getState().partnerDisconnectedAt).toBeNull();
  });

  // ===========================================================================
  // Expansion tests: edge cases (TEA Automate — Story 4.3)
  // ===========================================================================

  test('[P1] onBroadcastReceived with triggered_by (snake_case) = end_session calls exitSession()', async () => {
    // The code supports both camelCase (triggeredBy) and snake_case (triggered_by)
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    store.getState().onBroadcastReceived({
      sessionId: 'session-reconnect-001',
      currentPhase: 'reading',
      version: 10,
      triggered_by: 'end_session',
    });

    // Session should be cleared
    expect(store.getState().session).toBeNull();
  });

  test('[P2] setPartnerDisconnected(true) called twice is idempotent', async () => {
    const store = await createStoreWithReadingSession();

    store.getState().setPartnerDisconnected(true);
    const firstTimestamp = store.getState().partnerDisconnectedAt;
    expect(store.getState().partnerDisconnected).toBe(true);

    // Call again — state should still be true, timestamp may update
    store.getState().setPartnerDisconnected(true);
    expect(store.getState().partnerDisconnected).toBe(true);
    expect(store.getState().partnerDisconnectedAt).not.toBeNull();
    // Timestamp can differ (Date.now() is called each time) — just verify it's still a number
    expect(typeof store.getState().partnerDisconnectedAt).toBe('number');
    expect(firstTimestamp).not.toBeNull();
  });

  test('[P2] endSession() sets scriptureError on RPC failure (does not throw)', async () => {
    const store = await createStoreWithReadingSession();

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC timeout' },
    });

    // Should not throw
    await store.getState().endSession();

    // Session should NOT be cleared on error (only on success)
    expect(store.getState().session).not.toBeNull();
    expect(store.getState().scriptureError).not.toBeNull();
    expect(store.getState().scriptureError?.code).toBe('SYNC_FAILED');
  });
});
