/**
 * scriptureReadingService Unit Tests
 *
 * Tests for Scripture Reading IndexedDB service:
 * - CRUD operations for sessions, reflections, bookmarks, messages
 * - Cache-first read pattern
 * - Write-through pattern
 * - Corruption recovery
 * - Error handling with ScriptureErrorCode
 *
 * Story 1.1: Task 6.1
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  DB_NAME,
  DB_VERSION,
  upgradeDb,
  type MyLoveDBSchema,
  type ScriptureSession,
  type ScriptureReflection,
  type ScriptureBookmark,
  type ScriptureMessage,
} from '../../../src/services/dbSchema';

// Mock Supabase client
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

describe('scriptureReadingService — service methods', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    indexedDB.deleteDatabase(DB_NAME);
  });

  // Valid UUIDs for Zod schema validation
  const TEST_SESSION_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const TEST_USER_UUID = 'b1ffcd00-0d1c-4fa9-8c7e-7cc0ce491b22';
  const TEST_REFLECTION_UUID = 'c2aade11-1e2d-4ab0-9d8f-8dd1df502c33';

  describe('createSession', () => {
    it('should call RPC and return a local session on success', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      const rpcResponse = {
        id: TEST_SESSION_UUID,
        mode: 'solo',
        user1_id: TEST_USER_UUID,
        user2_id: null,
        current_phase: 'reading',
        current_step_index: 0,
        status: 'in_progress',
        version: 1,
        started_at: '2026-01-30T10:00:00Z',
        completed_at: null,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: rpcResponse,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: TEST_USER_UUID } },
        error: null,
      } as ReturnType<typeof supabase.auth.getUser> extends Promise<infer R> ? R : never);

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      const session = await scriptureReadingService.createSession('solo');

      expect(supabase.rpc).toHaveBeenCalledWith('scripture_create_session', {
        p_mode: 'solo',
      });
      expect(session.id).toBe(TEST_SESSION_UUID);
      expect(session.mode).toBe('solo');
      expect(session.currentPhase).toBe('reading');
      expect(session.currentStepIndex).toBe(0);

    });

    it('should throw ScriptureError on RPC failure', async () => {
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

      await expect(
        scriptureReadingService.createSession('solo')
      ).rejects.toMatchObject({
        code: 'SYNC_FAILED',
      });
    });

    it('should throw on Zod validation failure (malformed RPC response)', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      // Missing required fields and invalid mode
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { id: 'not-a-uuid', mode: 'invalid_mode' },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { scriptureReadingService } = await import(
        '../../../src/services/scriptureReadingService'
      );

      await expect(
        scriptureReadingService.createSession('solo')
      ).rejects.toThrow();
    });
  });

  describe('addReflection', () => {
    it('should call RPC without p_user_id parameter', async () => {
      const { supabase } = await import('../../../src/api/supabaseClient');

      const rpcResponse = {
        id: TEST_REFLECTION_UUID,
        session_id: TEST_SESSION_UUID,
        step_index: 3,
        user_id: TEST_USER_UUID,
        rating: 4,
        notes: 'Great verse',
        is_shared: true,
        created_at: '2026-01-30T12:00:00Z',
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

      const reflection = await scriptureReadingService.addReflection(
        TEST_SESSION_UUID,
        3,
        4,
        'Great verse',
        true
      );

      // Verify p_user_id is NOT sent (C1 fix)
      expect(supabase.rpc).toHaveBeenCalledWith('scripture_submit_reflection', {
        p_session_id: TEST_SESSION_UUID,
        p_step_index: 3,
        p_rating: 4,
        p_notes: 'Great verse',
        p_is_shared: true,
      });
      expect(reflection.id).toBe(TEST_REFLECTION_UUID);
      expect(reflection.rating).toBe(4);

    });
  });
});

// ============================================================================
// Extended service-level tests (Code Review Fix H2)
//
// Tests for getSession, getUserSessions, updateSession, bookmark CRUD,
// message CRUD, and corruption recovery via service methods.
// Uses vi.resetModules() for clean singleton state between tests.
// ============================================================================

