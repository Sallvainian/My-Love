/**
 * scriptureReadingSlice — coupleStats Unit Tests
 *
 * Story 3.1: Couple-Aggregate Stats Dashboard
 * Tests for loadCoupleStats() action and stats state management.
 *
 * Tests:
 * - 3.1-UNIT-007 (P1): loadCoupleStats() sets isStatsLoading, calls service, updates coupleStats
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create } from 'zustand';
import type { ScriptureSlice } from '../../../src/stores/slices/scriptureReadingSlice';
import { createScriptureReadingSlice } from '../../../src/stores/slices/scriptureReadingSlice';

// Mock supabase client
const mockGetUser = vi.fn();
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

// Mock the scriptureReadingService
vi.mock('../../../src/services/scriptureReadingService', () => ({
  scriptureReadingService: {
    createSession: vi.fn(),
    getSession: vi.fn(),
    getUserSessions: vi.fn(),
    updateSession: vi.fn(),
    recoverSessionCache: vi.fn(),
    getCoupleStats: vi.fn(),
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

describe('scriptureReadingSlice — coupleStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Initial state for stats fields
  // ============================================
  describe('initial stats state', () => {
    it('should initialize with coupleStats=null and isStatsLoading=false', () => {
      const store = createTestStore();
      const state = store.getState();

      expect(state.coupleStats).toBeNull();
      expect(state.isStatsLoading).toBe(false);
    });
  });

  // ============================================
  // 3.1-UNIT-007 (P1): loadCoupleStats() full lifecycle
  // ============================================
  describe('loadCoupleStats', () => {
    it('should set isStatsLoading=true while loading', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      // Make getCoupleStats hang so we can check loading state
      let resolveStats!: (value: unknown) => void;
      vi.mocked(scriptureReadingService.getCoupleStats).mockReturnValue(
        new Promise((resolve) => {
          resolveStats = resolve;
        })
      );

      const store = createTestStore();

      // Start loading
      const loadPromise = store.getState().loadCoupleStats();

      // Should be loading
      expect(store.getState().isStatsLoading).toBe(true);

      // Resolve with stats
      resolveStats({
        totalSessions: 5,
        totalSteps: 80,
        lastCompleted: '2026-02-10T10:00:00Z',
        avgRating: 4.2,
        bookmarkCount: 15,
      });

      await loadPromise;

      // Should no longer be loading
      expect(store.getState().isStatsLoading).toBe(false);
    });

    it('should update coupleStats with service response on success', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const expectedStats = {
        totalSessions: 5,
        totalSteps: 80,
        lastCompleted: '2026-02-10T10:00:00Z',
        avgRating: 4.2,
        bookmarkCount: 15,
      };

      vi.mocked(scriptureReadingService.getCoupleStats).mockResolvedValue(expectedStats);

      const store = createTestStore();
      await store.getState().loadCoupleStats();

      expect(store.getState().coupleStats).toEqual(expectedStats);
      expect(store.getState().isStatsLoading).toBe(false);
    });

    it('should keep existing coupleStats when service returns null (silent failure)', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      // First, load some stats
      const initialStats = {
        totalSessions: 3,
        totalSteps: 40,
        lastCompleted: '2026-02-08T12:00:00Z',
        avgRating: 3.5,
        bookmarkCount: 8,
      };
      vi.mocked(scriptureReadingService.getCoupleStats).mockResolvedValue(initialStats);

      const store = createTestStore();
      await store.getState().loadCoupleStats();

      expect(store.getState().coupleStats).toEqual(initialStats);

      // Now simulate service failure (returns null)
      vi.mocked(scriptureReadingService.getCoupleStats).mockResolvedValue(null);
      await store.getState().loadCoupleStats();

      // Cached stats should remain (not replaced with null)
      expect(store.getState().coupleStats).toEqual(initialStats);
      expect(store.getState().isStatsLoading).toBe(false);
    });

    it('should call scriptureReadingService.getCoupleStats exactly once', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.getCoupleStats).mockResolvedValue(null);

      const store = createTestStore();
      await store.getState().loadCoupleStats();

      expect(scriptureReadingService.getCoupleStats).toHaveBeenCalledTimes(1);
    });

    it('should set isStatsLoading=false even when service throws', async () => {
      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      vi.mocked(scriptureReadingService.getCoupleStats).mockRejectedValue(
        new Error('Unexpected error')
      );

      const store = createTestStore();
      await store.getState().loadCoupleStats();

      // isStatsLoading should be reset even on error
      expect(store.getState().isStatsLoading).toBe(false);
    });
  });
});
