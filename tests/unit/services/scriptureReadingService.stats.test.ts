/**
 * scriptureReadingService — getCoupleStats Unit Tests
 *
 * Story 3.1: Couple-Aggregate Stats Dashboard
 * Tests for the getCoupleStats() service method.
 *
 * Tests:
 * - 3.1-UNIT-005 (P1): getCoupleStats() calls supabase.rpc and returns typed object
 * - 3.1-UNIT-006 (P1): getCoupleStats() returns null on RPC failure
 * - 3.1-UNIT-013 (P3): Zod schema validates RPC response shape (CoupleStatsSchema)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock Supabase client (same pattern as scriptureReadingService.service.test.ts)
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-123' } },
        })
      ),
    },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        or: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

describe('scriptureReadingService — getCoupleStats', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ============================================
  // 3.1-UNIT-005 (P1): getCoupleStats() calls RPC and returns typed object
  // ============================================
  describe('getCoupleStats success', () => {
    it('should call supabase.rpc with scripture_get_couple_stats and return typed CoupleStats', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      const rpcResponse = {
        totalSessions: 12,
        totalSteps: 204,
        lastCompleted: '2026-02-14T15:30:00Z',
        avgRating: 3.8,
        bookmarkCount: 47,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: rpcResponse,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const stats = await scriptureReadingService.getCoupleStats();

      expect(supabase.rpc).toHaveBeenCalledWith('scripture_get_couple_stats');
      expect(stats).not.toBeNull();
      expect(stats).toEqual({
        totalSessions: 12,
        totalSteps: 204,
        lastCompleted: '2026-02-14T15:30:00Z',
        avgRating: 3.8,
        bookmarkCount: 47,
      });
    });

    it('should validate RPC response against Zod schema and return null on invalid shape', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Malformed response (missing required fields)
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { totalSessions: 'not-a-number' },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const stats = await scriptureReadingService.getCoupleStats();
      expect(stats).toBeNull();
    });
  });

  // ============================================
  // 3.1-UNIT-006 (P1): getCoupleStats() returns null on RPC failure
  // ============================================
  describe('getCoupleStats error handling', () => {
    it('should return null on Supabase RPC error', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'RPC failed', details: '', hint: '', code: '500' },
        count: null,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const stats = await scriptureReadingService.getCoupleStats();

      expect(stats).toBeNull();
    });

    it('should return null on network exception', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Network timeout'));

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const stats = await scriptureReadingService.getCoupleStats();

      expect(stats).toBeNull();
    });
  });
});

// ============================================================================
// 3.1-UNIT-013 (P3): Zod schema validates RPC response shape
// ============================================================================
describe('CoupleStatsSchema — Zod validation', () => {
  it('should accept a valid CoupleStats response', async () => {
    const { CoupleStatsSchema } = await import(
      '../../../src/api/validation/supabaseSchemas'
    );
    const result = CoupleStatsSchema.safeParse({
      totalSessions: 12,
      totalSteps: 204,
      lastCompleted: '2026-02-14T15:30:00Z',
      avgRating: 3.8,
      bookmarkCount: 47,
    });
    expect(result.success).toBe(true);
  });

  it('should accept lastCompleted as null (zero-state)', async () => {
    const { CoupleStatsSchema } = await import(
      '../../../src/api/validation/supabaseSchemas'
    );
    const result = CoupleStatsSchema.safeParse({
      totalSessions: 0,
      totalSteps: 0,
      lastCompleted: null,
      avgRating: 0,
      bookmarkCount: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid types (string for totalSessions)', async () => {
    const { CoupleStatsSchema } = await import(
      '../../../src/api/validation/supabaseSchemas'
    );
    const result = CoupleStatsSchema.safeParse({
      totalSessions: 'twelve',
      totalSteps: 204,
      lastCompleted: '2026-02-14T15:30:00Z',
      avgRating: 3.8,
      bookmarkCount: 47,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', async () => {
    const { CoupleStatsSchema } = await import(
      '../../../src/api/validation/supabaseSchemas'
    );
    const result = CoupleStatsSchema.safeParse({ totalSessions: 12 });
    expect(result.success).toBe(false);
  });

  it('should reject negative numbers for count fields', async () => {
    const { CoupleStatsSchema } = await import(
      '../../../src/api/validation/supabaseSchemas'
    );
    const result = CoupleStatsSchema.safeParse({
      totalSessions: -1,
      totalSteps: 204,
      lastCompleted: '2026-02-14T15:30:00Z',
      avgRating: 3.8,
      bookmarkCount: 47,
    });
    expect(result.success).toBe(false);
  });
});
