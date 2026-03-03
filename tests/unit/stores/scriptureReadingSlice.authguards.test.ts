/**
 * scriptureReadingSlice Auth Guard Tests
 *
 * AC-9: loadSession sets UNAUTHORIZED error when auth fails
 * AC-10: selectRole resets myRole and sets UNAUTHORIZED when auth fails
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

const { mockRpc, mockGetSession, mockGetUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
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

async function createStoreWithSession() {
  // Set up auth to succeed for createSession
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

  const { scriptureReadingService } = await import(
    '../../../src/services/scriptureReadingService'
  );
  vi.mocked(scriptureReadingService.createSession).mockResolvedValueOnce({
    id: 'session-auth-001',
    mode: 'together',
    currentPhase: 'lobby',
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

describe('scriptureReadingSlice — auth guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // loadSession — AC-9
  // ===========================================================================

  test('loadSession sets UNAUTHORIZED error when auth.getUser() returns error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    });

    const store = createTestStore();
    await store.getState().loadSession('some-session-id');

    const { handleScriptureError } = await import(
      '../../../src/services/scriptureReadingService'
    );
    expect(handleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(store.getState().scriptureError).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(store.getState().scriptureLoading).toBe(false);
  });

  test('loadSession sets UNAUTHORIZED error when user.id is undefined', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const store = createTestStore();
    await store.getState().loadSession('some-session-id');

    const { handleScriptureError } = await import(
      '../../../src/services/scriptureReadingService'
    );
    expect(handleScriptureError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(store.getState().scriptureError).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
  });

  test('loadSession does not fetch session when auth fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    });

    const store = createTestStore();
    await store.getState().loadSession('some-session-id');

    // getSession should NOT have been called — auth fails first
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  // ===========================================================================
  // selectRole — AC-10
  // ===========================================================================

  test('selectRole resets myRole and sets UNAUTHORIZED error when auth fails', async () => {
    const store = await createStoreWithSession();

    // Now make auth fail for selectRole
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    });

    await store.getState().selectRole('reader');

    expect(store.getState().myRole).toBeNull();
    expect(store.getState().scriptureError).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(store.getState().scriptureLoading).toBe(false);
  });

  test('selectRole does not set myRole when user.id is undefined', async () => {
    const store = await createStoreWithSession();

    // Make auth return no user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await store.getState().selectRole('responder');

    // myRole should remain null — auth check now precedes optimistic update
    expect(store.getState().myRole).toBeNull();
    expect(store.getState().scriptureError).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    // RPC should NOT have been called
    expect(mockRpc).not.toHaveBeenCalledWith(
      'scripture_select_role',
      expect.anything()
    );
  });

  test('loadSession sets UNAUTHORIZED when authError exists but user.id is also present', async () => {
    // Edge case: authError is non-null AND user.id is present — the || condition should still bail
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'some-user' } },
      error: new Error('partial auth error'),
    });

    const store = createTestStore();
    await store.getState().loadSession('some-session-id');

    expect(store.getState().scriptureError).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
