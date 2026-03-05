/**
 * scriptureReadingSlice Lock-In Actions Tests
 *
 * Story 4.2: Synchronized Reading with Lock-In
 * Unit tests for lock-in-related state fields and actions.
 *
 * Tests:
 * - lockIn() sets isPendingLockIn optimistically
 * - lockIn() 409 error → rollback + scriptureError with 'Session updated'
 * - lockIn() other error → rollback + SYNC_FAILED error
 * - undoLockIn() sets isPendingLockIn to false optimistically
 * - undoLockIn() error → rollback to true
 * - onPartnerLockInChanged(true) sets partnerLocked
 * - onBroadcastReceived with higher currentStepIndex clears lock flags and updates step
 * - onBroadcastReceived with same step does NOT clear isPendingLockIn
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTestStore() {
  return create<ScriptureSlice>()(createScriptureReadingSlice as any);
}

// Helper to set up a store with an active together session in reading phase
async function createStoreWithReadingSession() {
  const { scriptureReadingService } = await import('../../../src/services/scriptureReadingService');
  vi.mocked(scriptureReadingService.createSession).mockResolvedValueOnce({
    id: 'session-reading-001',
    mode: 'together',
    currentPhase: 'reading',
    currentStepIndex: 0,
    version: 1,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'in_progress',
    startedAt: new Date(),
  });
  const store = createTestStore();
  await store.getState().createSession('together', 'user-2');
  return store;
}

describe('scriptureReadingSlice — lock-in state (Story 4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default RPC mock: returns a snapshot-like response
    mockRpc.mockResolvedValue({
      data: {
        sessionId: 'session-reading-001',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 2,
      },
      error: null,
    });
  });

  test('[P1] lockIn() sets isPendingLockIn to true optimistically', async () => {
    const store = await createStoreWithReadingSession();

    expect(store.getState().isPendingLockIn).toBe(false);

    const lockInPromise = store.getState().lockIn();

    // Optimistic update should be immediate
    expect(store.getState().isPendingLockIn).toBe(true);

    await lockInPromise;
  });

  test('[P1] undoLockIn() sets isPendingLockIn to false optimistically', async () => {
    const store = await createStoreWithReadingSession();

    // Set isPendingLockIn to true first
    store.setState({ isPendingLockIn: true });
    expect(store.getState().isPendingLockIn).toBe(true);

    const undoPromise = store.getState().undoLockIn();

    // Optimistic update should be immediate
    expect(store.getState().isPendingLockIn).toBe(false);

    await undoPromise;
  });

  test('[P1] onPartnerLockInChanged(true) sets partnerLocked to true', async () => {
    const store = await createStoreWithReadingSession();

    expect(store.getState().partnerLocked).toBe(false);

    store.getState().onPartnerLockInChanged(true);

    expect(store.getState().partnerLocked).toBe(true);
  });

  test('[P1] onPartnerLockInChanged(false) sets partnerLocked to false', async () => {
    const store = await createStoreWithReadingSession();

    store.getState().onPartnerLockInChanged(true);
    expect(store.getState().partnerLocked).toBe(true);

    store.getState().onPartnerLockInChanged(false);

    expect(store.getState().partnerLocked).toBe(false);
  });

  test('[P0] onBroadcastReceived with higher currentStepIndex clears lock flags and updates step', async () => {
    const store = await createStoreWithReadingSession();
    // Set currentUserId to enable isUser1 logic
    store.setState({ currentUserId: 'user-1' });

    // Simulate locked-in state
    store.setState({ isPendingLockIn: true, partnerLocked: true });

    // Server broadcasts step advance (both locked in → next step)
    store.getState().onBroadcastReceived({
      sessionId: 'session-reading-001',
      currentPhase: 'reading',
      version: 3,
      currentStepIndex: 1, // Advance from 0 to 1
      triggered_by: 'lock_in',
      user1Ready: false,
      user2Ready: false,
    });

    // Both lock flags should be cleared
    expect(store.getState().isPendingLockIn).toBe(false);
    expect(store.getState().partnerLocked).toBe(false);
    // Step should be advanced
    expect(store.getState().session?.currentStepIndex).toBe(1);
  });

  test('[P1] onBroadcastReceived with same step does NOT clear isPendingLockIn', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    // Simulate locked-in state
    store.setState({ isPendingLockIn: true });

    // Broadcast with same step index (e.g., version-only update)
    store.getState().onBroadcastReceived({
      sessionId: 'session-reading-001',
      currentPhase: 'reading',
      version: 3,
      currentStepIndex: 0, // Same step — should NOT clear
      user1Ready: false,
      user2Ready: false,
    });

    // isPendingLockIn should remain true
    expect(store.getState().isPendingLockIn).toBe(true);
  });

  test("[P0] lockIn() error with '409' in message → rollback + scriptureError with 'Session updated'", async () => {
    const store = await createStoreWithReadingSession();

    // Mock RPC to return 409-like error
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: '409: version mismatch' },
    });

    // Mock refetch
    mockGetSession.mockResolvedValue({
      id: 'session-reading-001',
      mode: 'together',
      currentPhase: 'reading',
      currentStepIndex: 1,
      version: 3,
      userId: 'user-1',
      partnerId: 'user-2',
      status: 'in_progress',
      startedAt: new Date(),
    });

    await store.getState().lockIn();

    // isPendingLockIn should be rolled back
    expect(store.getState().isPendingLockIn).toBe(false);
    // scriptureError should contain 'Session updated' message
    expect(store.getState().scriptureError).toBeTruthy();
    expect(store.getState().scriptureError?.message).toContain('Session updated');
  });

  test('[P1] lockIn() other error → rollback + SYNC_FAILED error', async () => {
    const store = await createStoreWithReadingSession();

    // Mock RPC to return generic error
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Network timeout' },
    });

    await store.getState().lockIn();

    // isPendingLockIn should be rolled back
    expect(store.getState().isPendingLockIn).toBe(false);
    // handleScriptureError should have been called
    const { handleScriptureError } = await import('../../../src/services/scriptureReadingService');
    expect(handleScriptureError).toHaveBeenCalled();
  });

  test('[P1] undoLockIn() error → rollback isPendingLockIn to true', async () => {
    const store = await createStoreWithReadingSession();

    // Start with isPendingLockIn true
    store.setState({ isPendingLockIn: true });

    // Mock RPC to return error
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC error' },
    });

    await store.getState().undoLockIn();

    // Should have rolled back to true
    expect(store.getState().isPendingLockIn).toBe(true);
  });

  test('[P0] onBroadcastReceived discards stale events (version <= local)', async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1' });

    const initialVersion = store.getState().session?.version ?? 1;

    // Send stale broadcast (version <= current)
    store.getState().onBroadcastReceived({
      sessionId: 'session-reading-001',
      currentPhase: 'reading',
      version: initialVersion, // Same or older version
      currentStepIndex: 5, // Should NOT apply
      user1Ready: false,
      user2Ready: false,
    });

    // Step should remain unchanged
    expect(store.getState().session?.currentStepIndex).toBe(0);
  });

  test("[P1] onBroadcastReceived with phase 'reflection' transitions to reflection", async () => {
    const store = await createStoreWithReadingSession();
    store.setState({ currentUserId: 'user-1', isPendingLockIn: true, partnerLocked: true });

    // Simulate last step lock-in → reflection transition
    store.getState().onBroadcastReceived({
      sessionId: 'session-reading-001',
      currentPhase: 'reflection',
      version: 10,
      triggered_by: 'lock_in',
      user1Ready: false,
      user2Ready: false,
    });

    expect(store.getState().session?.currentPhase).toBe('reflection');
  });

  // ===========================================================================
  // Expansion tests: guard conditions (TEA Automate — Story 4.2)
  // ===========================================================================

  test('[P2] lockIn() is a no-op when session is null', async () => {
    const store = createTestStore();
    // No session created — session is null

    await store.getState().lockIn();

    // isPendingLockIn should remain false (guard returned early)
    expect(store.getState().isPendingLockIn).toBe(false);
    // RPC should NOT have been called
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('[P2] lockIn() is a no-op when currentPhase is not reading', async () => {
    const store = await createStoreWithReadingSession();
    // Change phase to lobby — lockIn guard should reject
    store.setState({
      session: { ...store.getState().session!, currentPhase: 'lobby' },
    });

    await store.getState().lockIn();

    expect(store.getState().isPendingLockIn).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('[P2] undoLockIn() is a no-op when session is null', async () => {
    const store = createTestStore();
    // No session — undoLockIn guard should return early

    await store.getState().undoLockIn();

    // isPendingLockIn should remain false
    expect(store.getState().isPendingLockIn).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
