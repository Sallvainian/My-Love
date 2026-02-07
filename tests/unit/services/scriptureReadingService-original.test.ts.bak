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

describe('scriptureReadingService', () => {
  let db: Awaited<ReturnType<typeof openDB<MyLoveDBSchema>>>;

  beforeEach(async () => {
    indexedDB.deleteDatabase(DB_NAME);
    db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
      upgrade: upgradeDb,
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('IndexedDB CRUD - Sessions', () => {
    it('should store and retrieve a scripture session', async () => {
      const session: ScriptureSession = {
        id: 'session-1',
        mode: 'solo',
        userId: 'user-123',
        currentPhase: 'reading',
        currentStepIndex: 3,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-01-30T10:00:00Z'),

      };

      await db.put('scripture-sessions', session);
      const retrieved = await db.get('scripture-sessions', 'session-1');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('session-1');
      expect(retrieved!.mode).toBe('solo');
      expect(retrieved!.userId).toBe('user-123');
      expect(retrieved!.currentPhase).toBe('reading');
      expect(retrieved!.currentStepIndex).toBe(3);
    });

    it('should retrieve sessions by user index', async () => {
      const session1: ScriptureSession = {
        id: 'session-1',
        mode: 'solo',
        userId: 'user-123',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date(),

      };

      const session2: ScriptureSession = {
        id: 'session-2',
        mode: 'solo',
        userId: 'user-123',
        currentPhase: 'complete',
        currentStepIndex: 16,
        status: 'complete',
        version: 1,
        startedAt: new Date(),
        completedAt: new Date(),

      };

      const session3: ScriptureSession = {
        id: 'session-3',
        mode: 'solo',
        userId: 'user-456',
        currentPhase: 'reading',
        currentStepIndex: 5,
        status: 'in_progress',
        version: 1,
        startedAt: new Date(),

      };

      await db.put('scripture-sessions', session1);
      await db.put('scripture-sessions', session2);
      await db.put('scripture-sessions', session3);

      const userSessions = await db.getAllFromIndex(
        'scripture-sessions',
        'by-user',
        'user-123'
      );

      expect(userSessions).toHaveLength(2);
      expect(userSessions.every((s) => s.userId === 'user-123')).toBe(true);
    });

    it('should update an existing session', async () => {
      const session: ScriptureSession = {
        id: 'session-1',
        mode: 'solo',
        userId: 'user-123',
        currentPhase: 'reading',
        currentStepIndex: 3,
        status: 'in_progress',
        version: 1,
        startedAt: new Date(),

      };

      await db.put('scripture-sessions', session);

      // Update
      await db.put('scripture-sessions', {
        ...session,
        currentStepIndex: 4,
        version: 2,
      });

      const updated = await db.get('scripture-sessions', 'session-1');
      expect(updated!.currentStepIndex).toBe(4);
      expect(updated!.version).toBe(2);
    });
  });

  describe('IndexedDB CRUD - Reflections', () => {
    it('should store and retrieve reflections by session', async () => {
      const reflection: ScriptureReflection = {
        id: 'refl-1',
        sessionId: 'session-1',
        stepIndex: 0,
        userId: 'user-123',
        rating: 4,
        notes: 'This verse spoke to me deeply.',
        isShared: false,
        createdAt: new Date(),

      };

      await db.put('scripture-reflections', reflection);

      const reflections = await db.getAllFromIndex(
        'scripture-reflections',
        'by-session',
        'session-1'
      );

      expect(reflections).toHaveLength(1);
      expect(reflections[0].rating).toBe(4);
      expect(reflections[0].notes).toBe('This verse spoke to me deeply.');
    });

    it('should store multiple reflections per session', async () => {
      for (let i = 0; i < 5; i++) {
        await db.put('scripture-reflections', {
          id: `refl-${i}`,
          sessionId: 'session-1',
          stepIndex: i,
          userId: 'user-123',
          rating: (i % 5) + 1,
          isShared: i % 2 === 0,
          createdAt: new Date(),
  
        });
      }

      const reflections = await db.getAllFromIndex(
        'scripture-reflections',
        'by-session',
        'session-1'
      );

      expect(reflections).toHaveLength(5);
    });
  });

  describe('IndexedDB CRUD - Bookmarks', () => {
    it('should store and retrieve bookmarks by session', async () => {
      const bookmark: ScriptureBookmark = {
        id: 'bm-1',
        sessionId: 'session-1',
        stepIndex: 5,
        userId: 'user-123',
        shareWithPartner: true,
        createdAt: new Date(),

      };

      await db.put('scripture-bookmarks', bookmark);

      const bookmarks = await db.getAllFromIndex(
        'scripture-bookmarks',
        'by-session',
        'session-1'
      );

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].stepIndex).toBe(5);
      expect(bookmarks[0].shareWithPartner).toBe(true);
    });

    it('should delete a bookmark', async () => {
      await db.put('scripture-bookmarks', {
        id: 'bm-1',
        sessionId: 'session-1',
        stepIndex: 5,
        userId: 'user-123',
        shareWithPartner: false,
        createdAt: new Date(),

      });

      await db.delete('scripture-bookmarks', 'bm-1');

      const result = await db.get('scripture-bookmarks', 'bm-1');
      expect(result).toBeUndefined();
    });
  });

  describe('IndexedDB CRUD - Messages', () => {
    it('should store and retrieve messages by session', async () => {
      const message: ScriptureMessage = {
        id: 'msg-1',
        sessionId: 'session-1',
        senderId: 'user-123',
        message: 'Thank you Lord for this time together.',
        createdAt: new Date(),

      };

      await db.put('scripture-messages', message);

      const messages = await db.getAllFromIndex(
        'scripture-messages',
        'by-session',
        'session-1'
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Thank you Lord for this time together.');
    });
  });

  describe('Cache corruption recovery', () => {
    it('should clear all sessions from cache', async () => {
      // Populate cache
      await db.put('scripture-sessions', {
        id: 'session-1',
        mode: 'solo',
        userId: 'user-123',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date(),

      });

      expect(await db.count('scripture-sessions')).toBe(1);

      // Clear cache
      await db.clear('scripture-sessions');

      expect(await db.count('scripture-sessions')).toBe(0);
    });

    it('should clear reflections for a specific session', async () => {
      // Add reflections for two sessions
      await db.put('scripture-reflections', {
        id: 'refl-1',
        sessionId: 'session-1',
        stepIndex: 0,
        userId: 'user-123',
        isShared: false,
        createdAt: new Date(),

      });

      await db.put('scripture-reflections', {
        id: 'refl-2',
        sessionId: 'session-2',
        stepIndex: 0,
        userId: 'user-123',
        isShared: false,
        createdAt: new Date(),

      });

      expect(await db.count('scripture-reflections')).toBe(2);

      // Clear only session-1 reflections
      const session1Reflections = await db.getAllFromIndex(
        'scripture-reflections',
        'by-session',
        'session-1'
      );
      const tx = db.transaction('scripture-reflections', 'readwrite');
      for (const r of session1Reflections) {
        await tx.store.delete(r.id);
      }
      await tx.done;

      // session-1 cleared, session-2 preserved
      expect(await db.count('scripture-reflections')).toBe(1);
      const remaining = await db.getAllFromIndex(
        'scripture-reflections',
        'by-session',
        'session-2'
      );
      expect(remaining).toHaveLength(1);
    });

    it('should clear all scripture stores for full recovery', async () => {
      // Populate all stores
      await db.put('scripture-sessions', {
        id: 's1',
        mode: 'solo',
        userId: 'u1',
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date(),

      });
      await db.put('scripture-reflections', {
        id: 'r1',
        sessionId: 's1',
        stepIndex: 0,
        userId: 'u1',
        isShared: false,
        createdAt: new Date(),

      });
      await db.put('scripture-bookmarks', {
        id: 'b1',
        sessionId: 's1',
        stepIndex: 0,
        userId: 'u1',
        shareWithPartner: false,
        createdAt: new Date(),

      });
      await db.put('scripture-messages', {
        id: 'm1',
        sessionId: 's1',
        senderId: 'u1',
        message: 'test',
        createdAt: new Date(),

      });

      // Clear all
      await db.clear('scripture-sessions');
      await db.clear('scripture-reflections');
      await db.clear('scripture-bookmarks');
      await db.clear('scripture-messages');

      expect(await db.count('scripture-sessions')).toBe(0);
      expect(await db.count('scripture-reflections')).toBe(0);
      expect(await db.count('scripture-bookmarks')).toBe(0);
      expect(await db.count('scripture-messages')).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should export ScriptureErrorCode enum', async () => {
      const { ScriptureErrorCode } = await import(
        '../../../src/services/scriptureReadingService'
      );

      expect(ScriptureErrorCode.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
      expect(ScriptureErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND');
      expect(ScriptureErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ScriptureErrorCode.SYNC_FAILED).toBe('SYNC_FAILED');
      expect(ScriptureErrorCode.OFFLINE).toBe('OFFLINE');
      expect(ScriptureErrorCode.CACHE_CORRUPTED).toBe('CACHE_CORRUPTED');
      expect(ScriptureErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    });

    it('should call handleScriptureError without throwing', async () => {
      const { handleScriptureError, ScriptureErrorCode } = await import(
        '../../../src/services/scriptureReadingService'
      );

      // Should not throw
      expect(() =>
        handleScriptureError({
          code: ScriptureErrorCode.SYNC_FAILED,
          message: 'Test error',
        })
      ).not.toThrow();
    });
  });
});

// ============================================================================
// Service-level tests (Code Review Fix H4)
//
// These tests exercise the actual scriptureReadingService singleton methods
// with mocked Supabase, verifying write-through, cache-first, and error paths.
// ============================================================================

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

describe('scriptureReadingService — cache-first & write-through', () => {
  // Valid UUIDs for Zod schema validation
  const SESSION_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const SESSION_UUID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const USER_UUID = 'b1ffcd00-0d1c-4fa9-8c7e-7cc0ce491b22';
  const BOOKMARK_UUID = 'd3bbef22-2f3e-4bc1-ae90-9ee2ea613d44';
  const MESSAGE_UUID = 'e4ccfa33-3a4f-4cd2-bf01-0ff3fa724e55';

  // Import service once — singleton persists across tests.
  // Each test pre-populates IndexedDB and configures mocks as needed.
  let scriptureReadingService: Awaited<
    typeof import('../../../src/services/scriptureReadingService')
  >['scriptureReadingService'];
  let supabase: Awaited<
    typeof import('../../../src/api/supabaseClient')
  >['supabase'];

  function makeSupabaseSession(overrides: Record<string, unknown> = {}) {
    return {
      id: SESSION_UUID,
      mode: 'solo',
      user1_id: USER_UUID,
      user2_id: null,
      current_phase: 'reading',
      current_step_index: 0,
      status: 'in_progress',
      version: 1,
      started_at: '2026-01-30T10:00:00Z',
      completed_at: null,
      ...overrides,
    };
  }

  function makeSupabaseBookmark(overrides: Record<string, unknown> = {}) {
    return {
      id: BOOKMARK_UUID,
      session_id: SESSION_UUID,
      step_index: 5,
      user_id: USER_UUID,
      share_with_partner: false,
      created_at: '2026-01-30T12:00:00Z',
      ...overrides,
    };
  }

  function makeSupabaseMessage(overrides: Record<string, unknown> = {}) {
    return {
      id: MESSAGE_UUID,
      session_id: SESSION_UUID,
      sender_id: USER_UUID,
      message: 'Lord, thank you.',
      created_at: '2026-01-30T12:00:00Z',
      ...overrides,
    };
  }

  /**
   * Configure supabase.from() mock with chainable behavior.
   */
  function mockSupabaseFrom() {
    const singleFn = vi.fn();
    const orderFn = vi.fn();
    const eqFn = vi.fn().mockReturnValue({
      single: singleFn,
      order: orderFn,
    });
    const orFn = vi.fn().mockReturnValue({
      order: orderFn,
    });
    const selectFn = vi.fn().mockReturnValue({
      eq: eqFn,
      or: orFn,
    });
    const updateEqFn = vi.fn();
    const updateFn = vi.fn().mockReturnValue({
      eq: updateEqFn,
    });
    const insertSingleFn = vi.fn();
    const insertSelectFn = vi.fn().mockReturnValue({
      single: insertSingleFn,
    });
    const insertFn = vi.fn().mockReturnValue({
      select: insertSelectFn,
    });
    const deleteEqFn = vi.fn();
    const deleteFn = vi.fn().mockReturnValue({
      eq: deleteEqFn,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: selectFn,
      update: updateFn,
      insert: insertFn,
      delete: deleteFn,
    } as unknown as ReturnType<typeof supabase.from>);

    return {
      selectFn, eqFn, singleFn, orderFn, orFn,
      updateFn, updateEqFn,
      insertFn, insertSelectFn, insertSingleFn,
      deleteFn, deleteEqFn,
    };
  }

  beforeAll(async () => {
    const svcModule = await import('../../../src/services/scriptureReadingService');
    scriptureReadingService = svcModule.scriptureReadingService;
    const sbModule = await import('../../../src/api/supabaseClient');
    supabase = sbModule.supabase;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Close existing db connection before deleting, then reset singleton state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = scriptureReadingService as any;
    if (svc.db) {
      svc.db.close();
    }
    svc.db = null;
    svc.initPromise = null;
    indexedDB.deleteDatabase(DB_NAME);
  });

  // ------------------------------------------------------------------
  // getSession — cache-first read pattern
  // ------------------------------------------------------------------
  describe('getSession', () => {
    it('should return cached session on cache hit and fire background refresh', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID,
        mode: 'solo',
        userId: USER_UUID,
        currentPhase: 'reading',
        currentStepIndex: 3,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-01-30T10:00:00Z'),
      });
      db.close();

      const chain = mockSupabaseFrom();
      chain.singleFn.mockResolvedValue({
        data: makeSupabaseSession({ current_step_index: 5, version: 2 }),
        error: null,
      });

      const result = await scriptureReadingService.getSession(SESSION_UUID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(SESSION_UUID);
      expect(result!.currentStepIndex).toBe(3); // cached value, not server
    });

    it('should invoke onRefresh callback when background refresh completes', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID,
        mode: 'solo',
        userId: USER_UUID,
        currentPhase: 'reading',
        currentStepIndex: 0,
        status: 'in_progress',
        version: 1,
        startedAt: new Date('2026-01-30T10:00:00Z'),
      });
      db.close();

      const chain = mockSupabaseFrom();
      chain.singleFn.mockResolvedValue({
        data: makeSupabaseSession({ current_step_index: 7, version: 3 }),
        error: null,
      });

      const onRefresh = vi.fn();
      const result = await scriptureReadingService.getSession(SESSION_UUID, onRefresh);

      expect(result).not.toBeNull();
      expect(result!.currentStepIndex).toBe(0); // cached value

      // Wait for fire-and-forget background refresh to settle
      await vi.waitFor(() => {
        expect(onRefresh).toHaveBeenCalledTimes(1);
      });

      const refreshedSession = onRefresh.mock.calls[0][0];
      expect(refreshedSession.currentStepIndex).toBe(7);
      expect(refreshedSession.version).toBe(3);
    });

    it('should fetch from server on cache miss', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.singleFn.mockResolvedValue({
        data: makeSupabaseSession(),
        error: null,
      });

      const result = await scriptureReadingService.getSession(SESSION_UUID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(SESSION_UUID);
      expect(result!.mode).toBe('solo');
      expect(supabase.from).toHaveBeenCalledWith('scripture_sessions');
    });

    it('should return null when session not found on server (cache miss)', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.singleFn.mockResolvedValue({
        data: null,
        error: { message: 'Not found', code: 'PGRST116', details: '', hint: '' },
      });

      const result = await scriptureReadingService.getSession(SESSION_UUID);
      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // getUserSessions — cache-first read pattern
  // ------------------------------------------------------------------
  describe('getUserSessions', () => {
    it('should return cached sessions on cache hit', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID, mode: 'solo', userId: USER_UUID,
        currentPhase: 'reading', currentStepIndex: 0,
        status: 'in_progress', version: 1, startedAt: new Date(),
      });
      await db.put('scripture-sessions', {
        id: SESSION_UUID_2, mode: 'together', userId: USER_UUID,
        currentPhase: 'complete', currentStepIndex: 16,
        status: 'complete', version: 1, startedAt: new Date(), completedAt: new Date(),
      });
      db.close();

      mockSupabaseFrom(); // for background refresh

      const sessions = await scriptureReadingService.getUserSessions(USER_UUID);

      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.userId === USER_UUID)).toBe(true);
    });

    it('should fetch from server on cache miss', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.orderFn.mockResolvedValue({
        data: [makeSupabaseSession(), makeSupabaseSession({ id: SESSION_UUID_2, mode: 'together' })],
        error: null,
      });

      const sessions = await scriptureReadingService.getUserSessions(USER_UUID);

      expect(sessions).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('scripture_sessions');
    });
  });

  // ------------------------------------------------------------------
  // updateSession — write-through pattern
  // ------------------------------------------------------------------
  describe('updateSession', () => {
    it('should write to Supabase first then update cache', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID, mode: 'solo', userId: USER_UUID,
        currentPhase: 'reading', currentStepIndex: 3,
        status: 'in_progress', version: 1, startedAt: new Date('2026-01-30T10:00:00Z'),
      });
      db.close();

      const chain = mockSupabaseFrom();
      chain.updateEqFn.mockResolvedValue({ data: null, error: null });

      await scriptureReadingService.updateSession(SESSION_UUID, {
        currentPhase: 'reflection',
        currentStepIndex: 4,
        version: 2,
      });

      expect(supabase.from).toHaveBeenCalledWith('scripture_sessions');
      expect(chain.updateFn).toHaveBeenCalledWith({
        current_phase: 'reflection',
        current_step_index: 4,
        version: 2,
      });
      expect(chain.updateEqFn).toHaveBeenCalledWith('id', SESSION_UUID);

      // Verify cache was updated
      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const cached = await dbAfter.get('scripture-sessions', SESSION_UUID);
      dbAfter.close();
      expect(cached).toBeDefined();
      expect(cached!.currentPhase).toBe('reflection');
      expect(cached!.currentStepIndex).toBe(4);
      expect(cached!.version).toBe(2);
    });

    it('should throw ScriptureError on server failure without updating cache', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID, mode: 'solo', userId: USER_UUID,
        currentPhase: 'reading', currentStepIndex: 3,
        status: 'in_progress', version: 1, startedAt: new Date('2026-01-30T10:00:00Z'),
      });
      db.close();

      const chain = mockSupabaseFrom();
      chain.updateEqFn.mockResolvedValue({
        data: null,
        error: { message: 'Update failed', code: '500', details: '', hint: '' },
      });

      await expect(
        scriptureReadingService.updateSession(SESSION_UUID, { currentPhase: 'reflection' })
      ).rejects.toMatchObject({ code: 'SYNC_FAILED' });

      // Cache should NOT be updated
      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const cached = await dbAfter.get('scripture-sessions', SESSION_UUID);
      dbAfter.close();
      expect(cached!.currentPhase).toBe('reading');
    });
  });

  // ------------------------------------------------------------------
  // addBookmark — write-through
  // ------------------------------------------------------------------
  describe('addBookmark', () => {
    it('should insert to Supabase and cache locally', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.insertSingleFn.mockResolvedValue({
        data: makeSupabaseBookmark(),
        error: null,
      });

      const bookmark = await scriptureReadingService.addBookmark(SESSION_UUID, 5, USER_UUID, false);

      expect(bookmark.id).toBe(BOOKMARK_UUID);
      expect(bookmark.stepIndex).toBe(5);
      expect(bookmark.sessionId).toBe(SESSION_UUID);

      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const cached = await dbAfter.get('scripture-bookmarks', BOOKMARK_UUID);
      dbAfter.close();
      expect(cached).toBeDefined();
      expect(cached!.stepIndex).toBe(5);
    });

    it('should throw ScriptureError on server failure', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.insertSingleFn.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: '500', details: '', hint: '' },
      });

      await expect(
        scriptureReadingService.addBookmark(SESSION_UUID, 5, USER_UUID, false)
      ).rejects.toMatchObject({ code: 'SYNC_FAILED' });
    });
  });

  // ------------------------------------------------------------------
  // getBookmarksBySession — cache-first
  // ------------------------------------------------------------------
  describe('getBookmarksBySession', () => {
    it('should return cached bookmarks on cache hit', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-bookmarks', {
        id: BOOKMARK_UUID, sessionId: SESSION_UUID, stepIndex: 5,
        userId: USER_UUID, shareWithPartner: false, createdAt: new Date(),
      });
      db.close();

      mockSupabaseFrom(); // for background refresh

      const bookmarks = await scriptureReadingService.getBookmarksBySession(SESSION_UUID);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].stepIndex).toBe(5);
    });

    it('should fetch from server on cache miss', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.orderFn.mockResolvedValue({
        data: [makeSupabaseBookmark()],
        error: null,
      });

      const bookmarks = await scriptureReadingService.getBookmarksBySession(SESSION_UUID);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe(BOOKMARK_UUID);
      expect(supabase.from).toHaveBeenCalledWith('scripture_bookmarks');
    });
  });

  // ------------------------------------------------------------------
  // toggleBookmark — toggle behavior
  // ------------------------------------------------------------------
  describe('toggleBookmark', () => {
    it('should create bookmark when none exists', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      // getBookmarksBySession cache miss → fetch returns empty
      chain.orderFn.mockResolvedValue({ data: [], error: null });
      // addBookmark insert
      chain.insertSingleFn.mockResolvedValue({
        data: makeSupabaseBookmark({ step_index: 3 }),
        error: null,
      });

      const result = await scriptureReadingService.toggleBookmark(SESSION_UUID, 3, USER_UUID, true);

      expect(result.added).toBe(true);
      expect(result.bookmark).not.toBeNull();
      expect(result.bookmark!.stepIndex).toBe(3);
    });

    it('should delete bookmark when one already exists', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-bookmarks', {
        id: BOOKMARK_UUID, sessionId: SESSION_UUID, stepIndex: 5,
        userId: USER_UUID, shareWithPartner: false, createdAt: new Date(),
      });
      db.close();

      const chain = mockSupabaseFrom();
      chain.deleteEqFn.mockResolvedValue({ data: null, error: null });

      const result = await scriptureReadingService.toggleBookmark(SESSION_UUID, 5, USER_UUID, false);

      expect(result.added).toBe(false);
      expect(result.bookmark).toBeNull();

      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const cached = await dbAfter.get('scripture-bookmarks', BOOKMARK_UUID);
      dbAfter.close();
      expect(cached).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // addMessage — write-through
  // ------------------------------------------------------------------
  describe('addMessage', () => {
    it('should insert to Supabase and cache locally', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.insertSingleFn.mockResolvedValue({
        data: makeSupabaseMessage(),
        error: null,
      });

      const message = await scriptureReadingService.addMessage(SESSION_UUID, USER_UUID, 'Lord, thank you.');

      expect(message.id).toBe(MESSAGE_UUID);
      expect(message.message).toBe('Lord, thank you.');
      expect(message.sessionId).toBe(SESSION_UUID);

      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      const cached = await dbAfter.get('scripture-messages', MESSAGE_UUID);
      dbAfter.close();
      expect(cached).toBeDefined();
      expect(cached!.message).toBe('Lord, thank you.');
    });

    it('should throw ScriptureError on server failure', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.insertSingleFn.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: '500', details: '', hint: '' },
      });

      await expect(
        scriptureReadingService.addMessage(SESSION_UUID, USER_UUID, 'Test')
      ).rejects.toMatchObject({ code: 'SYNC_FAILED' });
    });
  });

  // ------------------------------------------------------------------
  // getMessagesBySession — cache-first
  // ------------------------------------------------------------------
  describe('getMessagesBySession', () => {
    it('should return cached messages on cache hit', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-messages', {
        id: MESSAGE_UUID, sessionId: SESSION_UUID, senderId: USER_UUID,
        message: 'Cached message', createdAt: new Date(),
      });
      db.close();

      mockSupabaseFrom(); // for background refresh

      const messages = await scriptureReadingService.getMessagesBySession(SESSION_UUID);

      expect(messages).toHaveLength(1);
      expect(messages[0].message).toBe('Cached message');
    });

    it('should fetch from server on cache miss', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      db.close();

      const chain = mockSupabaseFrom();
      chain.orderFn.mockResolvedValue({
        data: [makeSupabaseMessage()],
        error: null,
      });

      const messages = await scriptureReadingService.getMessagesBySession(SESSION_UUID);

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(MESSAGE_UUID);
      expect(supabase.from).toHaveBeenCalledWith('scripture_messages');
    });
  });

  // ------------------------------------------------------------------
  // Corruption recovery via service methods
  // ------------------------------------------------------------------
  describe('recoverSessionCache', () => {
    it('should clear all sessions from IndexedDB cache', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID, mode: 'solo', userId: USER_UUID,
        currentPhase: 'reading', currentStepIndex: 0,
        status: 'in_progress', version: 1, startedAt: new Date(),
      });
      expect(await db.count('scripture-sessions')).toBe(1);
      db.close();

      await scriptureReadingService.recoverSessionCache();

      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      expect(await dbAfter.count('scripture-sessions')).toBe(0);
      dbAfter.close();
    });
  });

  describe('recoverAllCaches', () => {
    it('should clear all scripture stores', async () => {
      const db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      await db.put('scripture-sessions', {
        id: SESSION_UUID, mode: 'solo', userId: USER_UUID,
        currentPhase: 'reading', currentStepIndex: 0,
        status: 'in_progress', version: 1, startedAt: new Date(),
      });
      await db.put('scripture-reflections', {
        id: 'r1', sessionId: SESSION_UUID, stepIndex: 0,
        userId: USER_UUID, isShared: false, createdAt: new Date(),
      });
      await db.put('scripture-bookmarks', {
        id: BOOKMARK_UUID, sessionId: SESSION_UUID, stepIndex: 0,
        userId: USER_UUID, shareWithPartner: false, createdAt: new Date(),
      });
      await db.put('scripture-messages', {
        id: MESSAGE_UUID, sessionId: SESSION_UUID, senderId: USER_UUID,
        message: 'test', createdAt: new Date(),
      });
      db.close();

      await scriptureReadingService.recoverAllCaches();

      const dbAfter = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
      expect(await dbAfter.count('scripture-sessions')).toBe(0);
      expect(await dbAfter.count('scripture-reflections')).toBe(0);
      expect(await dbAfter.count('scripture-bookmarks')).toBe(0);
      expect(await dbAfter.count('scripture-messages')).toBe(0);
      dbAfter.close();
    });
  });
});
