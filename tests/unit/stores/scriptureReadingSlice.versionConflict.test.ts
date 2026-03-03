/**
 * scriptureReadingSlice Version Conflict & Concurrent Call Tests
 *
 * T1: Lock-in version conflict (409) structured error handling
 * T2: Concurrent lockIn guard (isPendingLockIn)
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

const { mockRpc, mockGetSession, mockHandleScriptureError } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockHandleScriptureError: vi.fn(),
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
  handleScriptureError: mockHandleScriptureError,
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
    id: 'session-vc-001',
    mode: 'together',
    currentPhase: 'reading',
    currentStepIndex: 0,
    version: 1,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'in_progress',
    startedAt: new Date(),
    completedAt: null,
    reflections: [],
  });

  const store = createTestStore();
  await store.getState().createSession('together', 'user-2');
  return store;
}

describe('lockIn() version conflict (T1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('lockIn() with 409 error sets VERSION_MISMATCH scriptureError', async () => {
    const store = await createStoreWithReadingSession();

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: '409: version mismatch' },
    });

    await store.getState().lockIn();

    const state = store.getState();
    expect(state.scriptureError).not.toBeNull();
    expect(state.scriptureError?.code).toBe('VERSION_MISMATCH');
    expect(state.isPendingLockIn).toBe(false);
  });

  test('lockIn() with 409 error triggers session refetch', async () => {
    const store = await createStoreWithReadingSession();

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: '409: version mismatch' },
    });

    const refreshedSession = {
      id: 'session-vc-001',
      mode: 'together',
      currentPhase: 'reading',
      currentStepIndex: 1,
      version: 2,
      userId: 'user-1',
      partnerId: 'user-2',
      status: 'in_progress',
      startedAt: new Date(),
      completedAt: null,
      reflections: [],
    };
    mockGetSession.mockResolvedValueOnce(refreshedSession);

    await store.getState().lockIn();

    expect(mockGetSession).toHaveBeenCalledWith('session-vc-001', expect.any(Function));
    expect(store.getState().session?.version).toBe(2);
  });

  test('lockIn() with 409 error followed by refetch failure calls handleScriptureError with SYNC_FAILED', async () => {
    const store = await createStoreWithReadingSession();

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: '409: version mismatch' },
    });

    mockGetSession.mockRejectedValueOnce(new Error('Network error'));

    await store.getState().lockIn();

    expect(mockHandleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SYNC_FAILED',
        message: 'Failed to refresh session after version mismatch',
      })
    );
    // scriptureError should still be VERSION_MISMATCH (the primary error)
    expect(store.getState().scriptureError?.code).toBe('VERSION_MISMATCH');
  });

  test('lockIn() with non-409 error sets SYNC_FAILED scriptureError', async () => {
    const store = await createStoreWithReadingSession();

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'server error' },
    });

    await store.getState().lockIn();

    const state = store.getState();
    expect(state.scriptureError).not.toBeNull();
    expect(state.scriptureError?.code).toBe('SYNC_FAILED');
    expect(state.isPendingLockIn).toBe(false);
  });
});

describe('concurrent lockIn guard (T2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('concurrent lockIn() call returns early if isPendingLockIn is true', async () => {
    const store = await createStoreWithReadingSession();

    // Manually set isPendingLockIn to true (simulating an in-flight lock-in)
    store.setState({ isPendingLockIn: true });

    await store.getState().lockIn();

    // RPC should NOT have been called since the guard returns early
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
