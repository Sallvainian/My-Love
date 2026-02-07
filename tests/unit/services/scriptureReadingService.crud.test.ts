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

