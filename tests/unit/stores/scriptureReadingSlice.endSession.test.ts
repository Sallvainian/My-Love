/**
 * scriptureReadingSlice endSession Phase Ordering Tests
 *
 * AC-7 (regression guard): Verifies that endSession() broadcasts state_updated
 * BEFORE clearing local state, and that the payload contains triggered_by and
 * currentPhase fields.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

const { mockRpc, mockGetSession } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

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

async function createStoreWithReadingSession() {
  const { scriptureReadingService } = await import(
    '../../../src/services/scriptureReadingService'
  );
  vi.mocked(scriptureReadingService.createSession).mockResolvedValueOnce({
    id: 'session-end-001',
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

describe('scriptureReadingSlice — endSession ordering (AC-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('onBroadcastReceived with triggeredBy=end_session resets session state', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    store.getState().onBroadcastReceived({
      sessionId: 'session-end-001',
      currentPhase: 'complete',
      version: 10,
      triggeredBy: 'end_session',
    });

    expect(store.getState().session).toBeNull();
    expect(store.getState().myRole).toBeNull();
    expect(store.getState().partnerJoined).toBe(false);
  });

  test('onBroadcastReceived with currentPhase=complete resets session state', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    store.getState().onBroadcastReceived({
      sessionId: 'session-end-001',
      currentPhase: 'complete',
      version: 10,
    });

    expect(store.getState().session).toBeNull();
  });

  test('endSession() calls scripture_end_session RPC before clearing state', async () => {
    const endPayload = {
      sessionId: 'session-end-001',
      currentPhase: 'complete',
      currentStepIndex: 3,
      version: 6,
      triggered_by: 'end_session',
    };
    mockRpc.mockResolvedValue({ data: endPayload, error: null });

    const store = await createStoreWithReadingSession();
    await store.getState().endSession();

    // RPC was called
    expect(mockRpc).toHaveBeenCalledWith('scripture_end_session', {
      p_session_id: 'session-end-001',
    });

    // State was cleared after RPC (session reset)
    expect(store.getState().session).toBeNull();
  });

  test('endSession() broadcasts state_updated with correct payload before clearing state', async () => {
    const endPayload = {
      sessionId: 'session-end-001',
      currentPhase: 'complete',
      currentStepIndex: 3,
      version: 6,
      triggered_by: 'end_session',
    };
    mockRpc.mockResolvedValue({ data: endPayload, error: null });

    const store = await createStoreWithReadingSession();

    // Track call ordering: broadcastFn should fire before state is cleared
    const callOrder: string[] = [];

    const mockBroadcastFn = vi.fn((_event: string, _payload: unknown) => {
      callOrder.push('broadcast');
      // At this point, session should still exist
      expect(store.getState().session).not.toBeNull();
    });

    // Wire the broadcast function
    store.getState().setBroadcastFn(mockBroadcastFn);

    // Subscribe to state changes to track when session is cleared
    store.subscribe((state) => {
      if (state.session === null && callOrder[callOrder.length - 1] !== 'state_cleared') {
        callOrder.push('state_cleared');
      }
    });

    await store.getState().endSession();

    // Verify broadcast was called with state_updated and correct payload
    expect(mockBroadcastFn).toHaveBeenCalledWith('state_updated', endPayload);

    // Verify ordering: broadcast before state clear.
    // This works because Zustand's subscribe fires synchronously after each set() call,
    // so the callOrder array faithfully records the temporal sequence of side effects.
    expect(callOrder[0]).toBe('broadcast');
    expect(callOrder).toContain('state_cleared');

    // Verify payload contains required fields
    const broadcastPayload = mockBroadcastFn.mock.calls[0][1] as Record<string, unknown>;
    expect(broadcastPayload.triggered_by).toBe('end_session');
    expect(broadcastPayload.currentPhase).toBe('complete');
  });
});
