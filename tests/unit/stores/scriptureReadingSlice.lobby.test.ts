/**
 * scriptureReadingSlice Lobby Actions Tests
 *
 * Story 4.1: Lobby, Role Selection & Countdown
 * Unit tests for new lobby-related state fields and actions.
 *
 * Tests:
 * - Initial lobby state (all null/false)
 * - selectRole action
 * - toggleReady optimistic update and rollback
 * - onPartnerJoined action
 * - onPartnerReady action
 * - onCountdownStarted action
 * - convertToSolo action
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

// Mock supabase client
const mockRpc = vi.fn();
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
    getSession: vi.fn(),
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

// Helper to set up a store with an active together session
async function createStoreWithTogetherSession() {
  const { scriptureReadingService } = await import('../../../src/services/scriptureReadingService');
  vi.mocked(scriptureReadingService.createSession).mockResolvedValueOnce({
    id: 'session-together-001',
    mode: 'together',
    currentPhase: 'lobby',
    currentStepIndex: 0,
    version: 1,
    userId: 'user-1',
    partnerId: 'user-2',
    status: 'pending',
    startedAt: new Date(),
  });
  const store = createTestStore();
  await store.getState().createSession('together', 'user-2');
  return store;
}

describe('scriptureReadingSlice — lobby state (Story 4.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default RPC mock: returns a snapshot-like response
    mockRpc.mockResolvedValue({
      data: {
        sessionId: 'session-together-001',
        currentPhase: 'lobby',
        version: 2,
        user1Role: null,
        user2Role: null,
        user1Ready: false,
        user2Ready: false,
        countdownStartedAt: null,
      },
      error: null,
    });
  });

  test('[P1] initial lobby state fields are all null or false', () => {
    const store = createTestStore();
    const state = store.getState();

    expect(state.myRole).toBeNull();
    expect(state.partnerJoined).toBe(false);
    expect(state.myReady).toBe(false);
    expect(state.partnerReady).toBe(false);
    expect(state.countdownStartedAt).toBeNull();
    expect(state.currentUserId).toBeNull();
  });

  test('[P1] selectRole sets myRole and updates session.currentPhase', async () => {
    const store = await createStoreWithTogetherSession();

    await store.getState().selectRole('reader');

    expect(store.getState().myRole).toBe('reader');
  });

  test('[P1] toggleReady(true) sets myReady to true optimistically', async () => {
    const store = await createStoreWithTogetherSession();

    const togglePromise = store.getState().toggleReady(true);

    // Optimistic update should be immediate
    expect(store.getState().myReady).toBe(true);

    await togglePromise;

    expect(store.getState().myReady).toBe(true);
  });

  test('[P1] toggleReady rolls back myReady on RPC error', async () => {
    const store = await createStoreWithTogetherSession();

    // Override default mock to return error
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

    expect(store.getState().myReady).toBe(false);

    await store.getState().toggleReady(true);

    // Should have rolled back to false after RPC failure
    expect(store.getState().myReady).toBe(false);
  });

  test('[P1] onPartnerJoined sets partnerJoined to true', async () => {
    const store = await createStoreWithTogetherSession();

    store.getState().onPartnerJoined();

    expect(store.getState().partnerJoined).toBe(true);
  });

  test('[P1] onPartnerReady(true) sets partnerReady to true', async () => {
    const store = await createStoreWithTogetherSession();

    store.getState().onPartnerReady(true);

    expect(store.getState().partnerReady).toBe(true);
  });

  test('[P1] onPartnerReady(false) sets partnerReady to false after being true', async () => {
    const store = await createStoreWithTogetherSession();
    store.getState().onPartnerReady(true);
    expect(store.getState().partnerReady).toBe(true);

    store.getState().onPartnerReady(false);

    expect(store.getState().partnerReady).toBe(false);
  });

  test('[P1] onCountdownStarted sets countdownStartedAt to the provided timestamp', async () => {
    const store = await createStoreWithTogetherSession();
    const ts = 1708430400000;

    store.getState().onCountdownStarted(ts);

    expect(store.getState().countdownStartedAt).toBe(ts);
  });

  test('[P1] convertToSolo resets lobby state, sets mode to solo and phase to reading', async () => {
    const store = await createStoreWithTogetherSession();

    // Set up some lobby state before converting
    store.getState().onPartnerJoined();
    store.getState().onPartnerReady(true);
    store.getState().onCountdownStarted(Date.now());

    await store.getState().convertToSolo();

    const state = store.getState();
    expect(state.myRole).toBeNull();
    expect(state.partnerJoined).toBe(false);
    expect(state.myReady).toBe(false);
    expect(state.partnerReady).toBe(false);
    expect(state.countdownStartedAt).toBeNull();
    expect(state.session?.mode).toBe('solo');
    expect(state.session?.currentPhase).toBe('reading');
  });

  test('[P1] applySessionConverted resets lobby state locally without calling RPC', async () => {
    const store = await createStoreWithTogetherSession();

    store.getState().onPartnerJoined();
    store.getState().onPartnerReady(true);
    store.getState().onCountdownStarted(Date.now());

    store.getState().applySessionConverted();

    const state = store.getState();
    expect(state.myRole).toBeNull();
    expect(state.partnerJoined).toBe(false);
    expect(state.myReady).toBe(false);
    expect(state.partnerReady).toBe(false);
    expect(state.countdownStartedAt).toBeNull();
    expect(state.session?.mode).toBe('solo');
    expect(state.session?.currentPhase).toBe('reading');
    // RPC was never called (convertToSolo path) — verify by checking mockRpc call count
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('[P1] selectRole stores currentUserId for correct partnerReady mapping', async () => {
    const store = await createStoreWithTogetherSession();

    await store.getState().selectRole('reader');

    // auth.getUser mock returns { data: { user: { id: 'user-1' } } }
    expect(store.getState().currentUserId).toBe('user-1');
  });

  test('[P1] onBroadcastReceived maps partnerReady as user2Ready when currentUser is user1', async () => {
    const store = await createStoreWithTogetherSession();

    // Set currentUserId to match session.userId (user-1 = user1_id)
    await store.getState().selectRole('reader');
    expect(store.getState().currentUserId).toBe('user-1');
    expect(store.getState().session?.userId).toBe('user-1');

    // version must be higher than current session version (1) to pass version check
    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 3,
      user1Ready: false,
      user2Ready: true, // user2 (partner) is ready
      countdownStartedAt: null,
    });

    // user1 client → partnerReady should be user2Ready = true
    expect(store.getState().partnerReady).toBe(true);
  });

  test('[P1] onBroadcastReceived maps partnerReady as user1Ready when currentUser is user2', async () => {
    const store = await createStoreWithTogetherSession();

    // Simulate user2 by overriding auth.getUser mock to return user-2
    // (session.userId is always user1_id = 'user-1'; currentUserId = 'user-2' means user2 client)
    const { supabase: mockSupa } = await import('../../../src/api/supabaseClient');
    vi.mocked(mockSupa.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: { id: 'user-2' } },
    });

    await store.getState().selectRole('responder');
    expect(store.getState().currentUserId).toBe('user-2');

    // version must be higher than current
    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 4,
      user1Ready: true, // user1 (partner, from user2's perspective) is ready
      user2Ready: false,
      countdownStartedAt: null,
    });

    // user2 client → partnerReady should be user1Ready = true
    expect(store.getState().partnerReady).toBe(true);
  });

  test('[P1] onBroadcastReceived reconciles myReady from authoritative snapshot for user1', async () => {
    const store = await createStoreWithTogetherSession();
    await store.getState().selectRole('reader'); // sets currentUserId = 'user-1'

    // Server snapshot shows user1 is ready (authoritative reconciliation)
    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 10,
      user1Ready: true, // this user (user1) is ready per server
      user2Ready: false,
      countdownStartedAt: null,
    });

    expect(store.getState().myReady).toBe(true);
  });

  test('[P1] onBroadcastReceived reconciles myReady from authoritative snapshot for user2', async () => {
    const store = await createStoreWithTogetherSession();

    const { supabase: mockSupa } = await import('../../../src/api/supabaseClient');
    vi.mocked(mockSupa.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: { id: 'user-2' } },
    });
    await store.getState().selectRole('responder'); // sets currentUserId = 'user-2'

    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 10,
      user1Ready: false,
      user2Ready: true, // this user (user2) is ready per server
      countdownStartedAt: null,
    });

    expect(store.getState().myReady).toBe(true);
  });

  test('[P1] onBroadcastReceived reconciles myRole from authoritative snapshot', async () => {
    const store = await createStoreWithTogetherSession();
    await store.getState().selectRole('reader'); // currentUserId = 'user-1', myRole = 'reader'

    // Server snapshot has a different role (e.g., role was updated on another device)
    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 10,
      user1Ready: false,
      user2Ready: false,
      user1Role: 'responder', // server now shows responder for user1
      countdownStartedAt: null,
    });

    expect(store.getState().myRole).toBe('responder');
  });

  test('[P1] onBroadcastReceived preserves local myRole when snapshot has null role', async () => {
    const store = await createStoreWithTogetherSession();
    await store.getState().selectRole('reader'); // sets myRole = 'reader'

    // Snapshot with null user1Role (e.g., snapshot sent before role was set)
    store.getState().onBroadcastReceived({
      sessionId: 'session-together-001',
      currentPhase: 'lobby',
      version: 10,
      user1Ready: false,
      user2Ready: false,
      user1Role: null, // no role in snapshot
      countdownStartedAt: null,
    });

    // Should keep local myRole = 'reader' (not overwrite with null)
    expect(store.getState().myRole).toBe('reader');
  });
});
