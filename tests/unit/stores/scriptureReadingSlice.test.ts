/**
 * scriptureReadingSlice Unit Tests
 *
 * Tests for Scripture Reading Zustand slice:
 * - Initial state
 * - State transitions (createSession, loadSession, exitSession, updatePhase)
 * - Error handling
 * - Type exports
 *
 * Story 1.1: Task 6.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

// Mock the scriptureReadingService
vi.mock('../../../src/services/scriptureReadingService', () => ({
  scriptureReadingService: {
    createSession: vi.fn(),
    getSession: vi.fn(),
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

// Create a test store with just the scripture slice
function createTestStore() {
  return create<ScriptureSlice>()((...args) => ({
    ...createScriptureReadingSlice(...args),
  }));
}

describe('scriptureReadingSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = createTestStore();
      const state = store.getState();

      expect(state.session).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.isPendingLockIn).toBe(false);
      expect(state.isPendingReflection).toBe(false);
      expect(state.isSyncing).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('createSession', () => {
    it('should set isLoading while creating session', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      // Make createSession hang so we can check loading state
      let resolveCreate: (value: unknown) => void;
      vi.mocked(scriptureReadingService.createSession).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      const store = createTestStore();

      // Start creating
      const createPromise = store.getState().createSession('solo');

      // Should be loading
      expect(store.getState().isLoading).toBe(true);
      expect(store.getState().error).toBeNull();

      // Resolve with a session
      resolveCreate!({
        id: 'session-1',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-123',
        status: 'pending',
        startedAt: new Date(),
      });

      await createPromise;

      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().session).not.toBeNull();
      expect(store.getState().session!.id).toBe('session-1');
      expect(store.getState().isInitialized).toBe(true);
    });

    it('should set error on createSession failure', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.createSession).mockRejectedValue(
        new Error('Network error')
      );

      const store = createTestStore();
      await store.getState().createSession('solo');

      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().session).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(store.getState().error!.code).toBe('SYNC_FAILED');
    });
  });

  describe('loadSession', () => {
    it('should load an existing session', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.getSession).mockResolvedValue({
        id: 'session-1',
        mode: 'solo',
        currentPhase: 'reflection',
        currentStepIndex: 10,
        version: 3,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
        synced: true,
      });

      const store = createTestStore();
      await store.getState().loadSession('session-1');

      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().session).not.toBeNull();
      expect(store.getState().session!.currentPhase).toBe('reflection');
      expect(store.getState().session!.currentStepIndex).toBe(10);
      expect(store.getState().isInitialized).toBe(true);
    });

    it('should set error when session not found', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.getSession).mockResolvedValue(null);

      const store = createTestStore();
      await store.getState().loadSession('nonexistent');

      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().session).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(store.getState().error!.code).toBe('SESSION_NOT_FOUND');
    });

    it('should set error on loadSession failure', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.getSession).mockRejectedValue(
        new Error('DB error')
      );

      const store = createTestStore();
      await store.getState().loadSession('session-1');

      expect(store.getState().error).not.toBeNull();
      expect(store.getState().error!.code).toBe('SYNC_FAILED');
    });
  });

  describe('exitSession', () => {
    it('should reset all state to initial values', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.createSession).mockResolvedValue({
        id: 'session-1',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 5,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      });

      const store = createTestStore();

      // Create session first
      await store.getState().createSession('solo');
      expect(store.getState().session).not.toBeNull();

      // Exit
      store.getState().exitSession();

      expect(store.getState().session).toBeNull();
      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().isInitialized).toBe(false);
      expect(store.getState().isPendingLockIn).toBe(false);
      expect(store.getState().isPendingReflection).toBe(false);
      expect(store.getState().isSyncing).toBe(false);
      expect(store.getState().error).toBeNull();
    });
  });

  describe('updatePhase', () => {
    it('should update session phase', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.createSession).mockResolvedValue({
        id: 'session-1',
        mode: 'solo',
        currentPhase: 'reading',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(),
      });

      const store = createTestStore();
      await store.getState().createSession('solo');

      store.getState().updatePhase('reflection');

      expect(store.getState().session!.currentPhase).toBe('reflection');
    });

    it('should not throw when no session exists', () => {
      const store = createTestStore();

      // Should not throw
      expect(() => store.getState().updatePhase('reading')).not.toThrow();
      expect(store.getState().session).toBeNull();
    });
  });

  describe('clearScriptureError', () => {
    it('should clear error state', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.createSession).mockRejectedValue(
        new Error('fail')
      );

      const store = createTestStore();
      await store.getState().createSession('solo');

      expect(store.getState().error).not.toBeNull();

      store.getState().clearScriptureError();

      expect(store.getState().error).toBeNull();
    });
  });

  describe('type exports', () => {
    it('should export SessionPhase type values', async () => {
      // Verify the types work at runtime through the slice
      const store = createTestStore();

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.createSession).mockResolvedValue({
        id: 's1',
        mode: 'together',
        currentPhase: 'lobby',
        currentStepIndex: 0,
        version: 1,
        userId: 'user-123',
        partnerId: 'user-456',
        status: 'pending',
        startedAt: new Date(),
      });

      await store.getState().createSession('together', 'user-456');

      const session = store.getState().session!;
      expect(session.mode).toBe('together');
      expect(session.partnerId).toBe('user-456');

      // Test all valid phases
      const phases = ['lobby', 'countdown', 'reading', 'reflection', 'report', 'complete'];
      for (const phase of phases) {
        store.getState().updatePhase(phase as 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete');
        expect(store.getState().session!.currentPhase).toBe(phase);
      }
    });
  });
});
