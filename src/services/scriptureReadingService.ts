import { openDB } from 'idb';
import { z } from 'zod/v4';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import {
  type MyLoveDBSchema,
  type ScriptureSession,
  type ScriptureReflection,
  type ScriptureBookmark,
  type ScriptureMessage,
  DB_NAME,
  DB_VERSION,
  upgradeDb,
} from './dbSchema';
import { supabase } from '../api/supabaseClient';
import {
  SupabaseSessionSchema,
  SupabaseReflectionSchema,
  SupabaseBookmarkSchema,
  SupabaseMessageSchema,
  type SupabaseSession,
  type SupabaseReflection,
  type SupabaseBookmark,
  type SupabaseMessage,
} from '../validation/schemas';

// ============================================
// Scripture Error Handling (AC: #3, Subtask 2.10)
// ============================================

export enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
  CACHE_CORRUPTED = 'CACHE_CORRUPTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}

export interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}

export function handleScriptureError(error: ScriptureError): void {
  switch (error.code) {
    case ScriptureErrorCode.VERSION_MISMATCH:
      console.warn('[Scripture] Version mismatch — refetch session state');
      break;
    case ScriptureErrorCode.SYNC_FAILED:
      console.warn('[Scripture] Sync failed — queue for retry');
      break;
    case ScriptureErrorCode.CACHE_CORRUPTED:
      console.error('[Scripture] Cache corrupted — clearing and refetching');
      break;
    case ScriptureErrorCode.SESSION_NOT_FOUND:
      console.error('[Scripture] Session not found');
      break;
    case ScriptureErrorCode.UNAUTHORIZED:
      console.error('[Scripture] Unauthorized access');
      break;
    case ScriptureErrorCode.OFFLINE:
      console.warn('[Scripture] Device is offline');
      break;
    case ScriptureErrorCode.VALIDATION_FAILED:
      console.error('[Scripture] Validation failed:', error.details);
      break;
  }
}

function createScriptureError(
  code: ScriptureErrorCode,
  message: string,
  details?: unknown
): ScriptureError {
  return { code, message, details };
}

// ============================================
// Transform helpers: Supabase → IndexedDB
// ============================================

function toLocalSession(row: SupabaseSession, userId: string): ScriptureSession {
  return {
    id: row.id,
    mode: row.mode,
    userId,
    partnerId: row.user2_id ?? undefined,
    currentPhase: row.current_phase,
    currentStepIndex: row.current_step_index,
    status: row.status,
    version: row.version,
    snapshotJson: row.snapshot_json ?? undefined,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function toLocalReflection(row: SupabaseReflection): ScriptureReflection {
  return {
    id: row.id,
    sessionId: row.session_id,
    stepIndex: row.step_index,
    userId: row.user_id,
    rating: row.rating ?? undefined,
    notes: row.notes ?? undefined,
    isShared: row.is_shared,
    createdAt: new Date(row.created_at),
  };
}

function toLocalBookmark(row: SupabaseBookmark): ScriptureBookmark {
  return {
    id: row.id,
    sessionId: row.session_id,
    stepIndex: row.step_index,
    userId: row.user_id,
    shareWithPartner: row.share_with_partner,
    createdAt: new Date(row.created_at),
  };
}

function toLocalMessage(row: SupabaseMessage): ScriptureMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderId: row.sender_id,
    message: row.message,
    createdAt: new Date(row.created_at),
  };
}

// ============================================
// Scripture Reading Service (AC: #3, Subtasks 2.1-2.8)
// ============================================

/**
 * Scripture Reading Service — IndexedDB CRUD with cache-first pattern
 *
 * Cache pattern (Solo Mode — Server is Source of Truth):
 *   READ:  IndexedDB cache → return cached → fetch fresh from Supabase → update cache
 *   WRITE: POST to Supabase RPC → on success → update IndexedDB cache → on failure → throw
 *   CORRUPTION: On IndexedDB error → clear cache → refetch from server
 *
 * Extends BaseIndexedDBService for the scripture-sessions store.
 * Additional stores (reflections, bookmarks, messages) are accessed directly via db handle.
 */
class ScriptureReadingService extends BaseIndexedDBService<
  ScriptureSession,
  MyLoveDBSchema,
  'scripture-sessions'
> {
  protected getStoreName(): 'scripture-sessions' {
    return 'scripture-sessions';
  }

  protected async _doInit(): Promise<void> {
    try {
      if (import.meta.env.DEV) {
        console.log(`[ScriptureService] Initializing IndexedDB (version ${DB_VERSION})...`);
      }

      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          upgradeDb(db, oldVersion, newVersion);
        },
      });

      if (import.meta.env.DEV) {
        console.log(`[ScriptureService] IndexedDB initialized successfully (v${DB_VERSION})`);
      }
    } catch (error) {
      this.handleError('initialize', error as Error);
    }
  }

  // ============================================
  // Session CRUD (Subtask 2.2)
  // ============================================

  /**
   * Create a new scripture session via Supabase RPC, then cache locally.
   * Write pattern: server first → update cache.
   */
  async createSession(mode: 'solo' | 'together', partnerId?: string): Promise<ScriptureSession> {
    const { data, error } = await supabase.rpc('scripture_create_session', {
      p_mode: mode,
      ...(partnerId ? { p_partner_id: partnerId } : {}),
    });

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to create session: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    const validated = SupabaseSessionSchema.parse(data);
    const local = toLocalSession(validated, validated.user1_id);

    await this.cacheSession(local);
    return local;
  }

  /**
   * Get a session — cache-first read pattern (Subtask 2.6).
   * 1. Check IndexedDB → return if found
   * 2. Fetch from Supabase → cache → return
   *
   * @param onRefresh - Optional callback invoked when background refresh completes
   *   with fresh data, allowing Zustand state to stay in sync.
   */
  async getSession(
    sessionId: string,
    onRefresh?: (session: ScriptureSession) => void
  ): Promise<ScriptureSession | null> {
    // Try cache first
    const cached = await this.get(sessionId);
    if (cached) {
      // Fire-and-forget background refresh with state propagation
      void this.refreshSessionFromServer(sessionId, onRefresh);
      return cached;
    }

    // Cache miss — fetch from server
    return this.fetchAndCacheSession(sessionId);
  }

  /**
   * Get all sessions for the current user — cache-first read pattern.
   */
  async getUserSessions(userId: string): Promise<ScriptureSession[]> {
    // Try cache first
    try {
      await this.init();
      const db = this.getTypedDB();
      const cached = await db.getAllFromIndex('scripture-sessions', 'by-user', userId);
      if (cached.length > 0) {
        // Fire-and-forget background refresh
        void this.refreshUserSessionsFromServer(userId);
        return cached;
      }
    } catch (cacheError) {
      // Cache corrupted — recovery (Subtask 2.8)
      console.error('[ScriptureService] Cache read error, recovering:', cacheError);
      await this.recoverSessionCache();
    }

    // Cache miss — fetch from server
    return this.fetchAndCacheUserSessions(userId);
  }

  /**
   * Update a session — write-through pattern: server first → update cache.
   * Converts camelCase fields to snake_case for Supabase.
   */
  async updateSession(
    sessionId: string,
    updates: Partial<
      Pick<
        ScriptureSession,
        'currentPhase' | 'currentStepIndex' | 'status' | 'version' | 'completedAt'
      >
    >
  ): Promise<void> {
    // Build snake_case update payload for Supabase
    const supabaseUpdates: Record<string, unknown> = {};
    if (updates.currentPhase !== undefined) supabaseUpdates.current_phase = updates.currentPhase;
    if (updates.currentStepIndex !== undefined)
      supabaseUpdates.current_step_index = updates.currentStepIndex;
    if (updates.status !== undefined) supabaseUpdates.status = updates.status;
    if (updates.version !== undefined) supabaseUpdates.version = updates.version;
    if (updates.completedAt !== undefined)
      supabaseUpdates.completed_at = updates.completedAt?.toISOString() ?? null;

    // Server first
    const { error } = await supabase
      .from('scripture_sessions')
      .update(supabaseUpdates)
      .eq('id', sessionId);

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to update session: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    // On success → update cache
    await this.init();
    const existing = await this.get(sessionId);
    if (existing) {
      await this.update(sessionId, updates);
    }
  }

  // ============================================
  // Reflection CRUD (Subtask 2.3)
  // ============================================

  /**
   * Submit a reflection via Supabase RPC, then cache locally.
   */
  async addReflection(
    sessionId: string,
    stepIndex: number,
    rating: number,
    notes: string,
    isShared: boolean
  ): Promise<ScriptureReflection> {
    const { data, error } = await supabase.rpc('scripture_submit_reflection', {
      p_session_id: sessionId,
      p_step_index: stepIndex,
      p_rating: rating,
      p_notes: notes,
      p_is_shared: isShared,
    });

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to submit reflection: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    const validated = SupabaseReflectionSchema.parse(data);
    const local = toLocalReflection(validated);

    await this.cacheReflection(local);
    return local;
  }

  /**
   * Get all reflections for a session — cache-first read pattern.
   */
  async getReflectionsBySession(sessionId: string): Promise<ScriptureReflection[]> {
    try {
      await this.init();
      const db = this.getTypedDB();
      const cached = await db.getAllFromIndex('scripture-reflections', 'by-session', sessionId);
      if (cached.length > 0) {
        void this.refreshReflectionsFromServer(sessionId);
        return cached;
      }
    } catch (cacheError) {
      console.error('[ScriptureService] Reflection cache error, recovering:', cacheError);
      await this.recoverReflectionCache(sessionId);
    }

    return this.fetchAndCacheReflections(sessionId);
  }

  // ============================================
  // Bookmark CRUD (Subtask 2.4)
  // ============================================

  /**
   * Add a bookmark — write-through to server.
   */
  async addBookmark(
    sessionId: string,
    stepIndex: number,
    userId: string,
    shareWithPartner: boolean
  ): Promise<ScriptureBookmark> {
    const { data, error } = await supabase
      .from('scripture_bookmarks')
      .insert({
        session_id: sessionId,
        step_index: stepIndex,
        user_id: userId,
        share_with_partner: shareWithPartner,
      })
      .select()
      .single();

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to add bookmark: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    const validated = SupabaseBookmarkSchema.parse(data);
    const local = toLocalBookmark(validated);

    await this.cacheBookmark(local);
    return local;
  }

  /**
   * Toggle a bookmark — delete if exists, create if not.
   */
  async toggleBookmark(
    sessionId: string,
    stepIndex: number,
    userId: string,
    shareWithPartner: boolean
  ): Promise<{ added: boolean; bookmark: ScriptureBookmark | null }> {
    // Check if bookmark exists
    const existing = await this.getBookmarkByStep(sessionId, stepIndex, userId);

    if (existing) {
      // Delete from server
      const { error } = await supabase.from('scripture_bookmarks').delete().eq('id', existing.id);

      if (error) {
        const scriptureErr = createScriptureError(
          ScriptureErrorCode.SYNC_FAILED,
          `Failed to remove bookmark: ${error.message}`,
          error
        );
        handleScriptureError(scriptureErr);
        throw scriptureErr;
      }

      // Remove from cache
      await this.removeBookmarkFromCache(existing.id);
      return { added: false, bookmark: null };
    }

    // Create new bookmark
    const bookmark = await this.addBookmark(sessionId, stepIndex, userId, shareWithPartner);
    return { added: true, bookmark };
  }

  /**
   * Get bookmarks for a session — cache-first.
   */
  async getBookmarksBySession(sessionId: string): Promise<ScriptureBookmark[]> {
    try {
      await this.init();
      const db = this.getTypedDB();
      const cached = await db.getAllFromIndex('scripture-bookmarks', 'by-session', sessionId);
      if (cached.length > 0) {
        void this.refreshBookmarksFromServer(sessionId);
        return cached;
      }
    } catch (cacheError) {
      console.error('[ScriptureService] Bookmark cache error, recovering:', cacheError);
      await this.recoverBookmarkCache(sessionId);
    }

    return this.fetchAndCacheBookmarks(sessionId);
  }

  /**
   * Update share_with_partner flag for all current user's bookmarks in a session.
   */
  async updateSessionBookmarkSharing(
    sessionId: string,
    userId: string,
    shareWithPartner: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('scripture_bookmarks')
      .update({ share_with_partner: shareWithPartner })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to update bookmark sharing: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    try {
      await this.init();
      const db = this.getTypedDB();
      const bookmarks = await db.getAllFromIndex('scripture-bookmarks', 'by-session', sessionId);
      const tx = db.transaction('scripture-bookmarks', 'readwrite');
      for (const bookmark of bookmarks) {
        if (bookmark.userId === userId) {
          await tx.store.put({
            ...bookmark,
            shareWithPartner,
          });
        }
      }
      await tx.done;
    } catch (cacheError) {
      console.error('[ScriptureService] Failed to update bookmark sharing cache:', cacheError);
    }
  }

  // ============================================
  // Message CRUD (Subtask 2.5)
  // ============================================

  /**
   * Add a message — write-through to server.
   */
  async addMessage(
    sessionId: string,
    senderId: string,
    message: string
  ): Promise<ScriptureMessage> {
    const { data, error } = await supabase
      .from('scripture_messages')
      .insert({
        session_id: sessionId,
        sender_id: senderId,
        message,
      })
      .select()
      .single();

    if (error) {
      const scriptureErr = createScriptureError(
        ScriptureErrorCode.SYNC_FAILED,
        `Failed to add message: ${error.message}`,
        error
      );
      handleScriptureError(scriptureErr);
      throw scriptureErr;
    }

    const validated = SupabaseMessageSchema.parse(data);
    const local = toLocalMessage(validated);

    await this.cacheMessage(local);
    return local;
  }

  /**
   * Get messages for a session — cache-first.
   */
  async getMessagesBySession(sessionId: string): Promise<ScriptureMessage[]> {
    try {
      await this.init();
      const db = this.getTypedDB();
      const cached = await db.getAllFromIndex('scripture-messages', 'by-session', sessionId);
      if (cached.length > 0) {
        void this.refreshMessagesFromServer(sessionId);
        return cached;
      }
    } catch (cacheError) {
      console.error('[ScriptureService] Message cache error, recovering:', cacheError);
      await this.recoverMessageCache(sessionId);
    }

    return this.fetchAndCacheMessages(sessionId);
  }

  // ============================================
  // Cache helpers (Subtask 2.6 — cache-first read)
  // ============================================

  private async cacheSession(session: ScriptureSession): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.put('scripture-sessions', session);
    } catch (error) {
      console.error('[ScriptureService] Failed to cache session:', error);
    }
  }

  private async cacheReflection(reflection: ScriptureReflection): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.put('scripture-reflections', reflection);
    } catch (error) {
      console.error('[ScriptureService] Failed to cache reflection:', error);
    }
  }

  private async cacheBookmark(bookmark: ScriptureBookmark): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.put('scripture-bookmarks', bookmark);
    } catch (error) {
      console.error('[ScriptureService] Failed to cache bookmark:', error);
    }
  }

  private async removeBookmarkFromCache(bookmarkId: string): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.delete('scripture-bookmarks', bookmarkId);
    } catch (error) {
      console.error('[ScriptureService] Failed to remove bookmark from cache:', error);
    }
  }

  private async cacheMessage(message: ScriptureMessage): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.put('scripture-messages', message);
    } catch (error) {
      console.error('[ScriptureService] Failed to cache message:', error);
    }
  }

  // ============================================
  // Server fetch + cache (Subtask 2.7 — write-through)
  // ============================================

  private async fetchAndCacheSession(sessionId: string): Promise<ScriptureSession | null> {
    try {
      const { data, error } = await supabase
        .from('scripture_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      const validated = SupabaseSessionSchema.parse(data);
      const local = toLocalSession(validated, validated.user1_id);

      await this.cacheSession(local);
      return local;
    } catch (error) {
      console.error('[ScriptureService] Failed to fetch session from server:', error);
      return null;
    }
  }

  private async fetchAndCacheUserSessions(userId: string): Promise<ScriptureSession[]> {
    try {
      const { data, error } = await supabase
        .from('scripture_sessions')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('started_at', { ascending: false });

      if (error) throw error;

      const validated = z.array(SupabaseSessionSchema).parse(data ?? []);
      const locals = validated.map((row) => toLocalSession(row, userId));

      for (const session of locals) {
        await this.cacheSession(session);
      }
      return locals;
    } catch (error) {
      console.error('[ScriptureService] Failed to fetch user sessions from server:', error);
      return [];
    }
  }

  private async fetchAndCacheReflections(sessionId: string): Promise<ScriptureReflection[]> {
    try {
      const { data, error } = await supabase
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', sessionId)
        .order('step_index', { ascending: true });

      if (error) throw error;

      const validated = z.array(SupabaseReflectionSchema).parse(data ?? []);
      const locals = validated.map(toLocalReflection);

      for (const reflection of locals) {
        await this.cacheReflection(reflection);
      }
      return locals;
    } catch (error) {
      console.error('[ScriptureService] Failed to fetch reflections from server:', error);
      return [];
    }
  }

  private async fetchAndCacheBookmarks(sessionId: string): Promise<ScriptureBookmark[]> {
    try {
      const { data, error } = await supabase
        .from('scripture_bookmarks')
        .select('*')
        .eq('session_id', sessionId)
        .order('step_index', { ascending: true });

      if (error) throw error;

      const validated = z.array(SupabaseBookmarkSchema).parse(data ?? []);
      const locals = validated.map(toLocalBookmark);

      for (const bookmark of locals) {
        await this.cacheBookmark(bookmark);
      }
      return locals;
    } catch (error) {
      console.error('[ScriptureService] Failed to fetch bookmarks from server:', error);
      return [];
    }
  }

  private async fetchAndCacheMessages(sessionId: string): Promise<ScriptureMessage[]> {
    try {
      const { data, error } = await supabase
        .from('scripture_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const validated = z.array(SupabaseMessageSchema).parse(data ?? []);
      const locals = validated.map(toLocalMessage);

      for (const msg of locals) {
        await this.cacheMessage(msg);
      }
      return locals;
    } catch (error) {
      console.error('[ScriptureService] Failed to fetch messages from server:', error);
      return [];
    }
  }

  // Background refresh helpers — update cache silently
  private async refreshSessionFromServer(
    sessionId: string,
    onRefresh?: (session: ScriptureSession) => void
  ): Promise<void> {
    try {
      const fresh = await this.fetchAndCacheSession(sessionId);
      if (fresh && onRefresh) {
        onRefresh(fresh);
      }
    } catch {
      // Silent failure — cache serves stale data
    }
  }

  private async refreshUserSessionsFromServer(userId: string): Promise<void> {
    try {
      await this.fetchAndCacheUserSessions(userId);
    } catch {
      // Silent failure
    }
  }

  private async refreshReflectionsFromServer(sessionId: string): Promise<void> {
    try {
      await this.fetchAndCacheReflections(sessionId);
    } catch {
      // Silent failure
    }
  }

  private async refreshBookmarksFromServer(sessionId: string): Promise<void> {
    try {
      await this.fetchAndCacheBookmarks(sessionId);
    } catch {
      // Silent failure
    }
  }

  private async refreshMessagesFromServer(sessionId: string): Promise<void> {
    try {
      await this.fetchAndCacheMessages(sessionId);
    } catch {
      // Silent failure
    }
  }

  // ============================================
  // Corruption recovery (Subtask 2.8)
  // ============================================

  async recoverSessionCache(): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      await db.clear('scripture-sessions');
      if (import.meta.env.DEV) {
        console.log('[ScriptureService] Cleared corrupted session cache');
      }
    } catch (error) {
      console.error('[ScriptureService] Failed to clear session cache:', error);
    }
  }

  async recoverReflectionCache(sessionId?: string): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      if (sessionId) {
        // Clear only reflections for this session
        const reflections = await db.getAllFromIndex(
          'scripture-reflections',
          'by-session',
          sessionId
        );
        const tx = db.transaction('scripture-reflections', 'readwrite');
        for (const r of reflections) {
          await tx.store.delete(r.id);
        }
        await tx.done;
      } else {
        await db.clear('scripture-reflections');
      }
    } catch (error) {
      console.error('[ScriptureService] Failed to clear reflection cache:', error);
    }
  }

  async recoverBookmarkCache(sessionId?: string): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      if (sessionId) {
        const bookmarks = await db.getAllFromIndex('scripture-bookmarks', 'by-session', sessionId);
        const tx = db.transaction('scripture-bookmarks', 'readwrite');
        for (const b of bookmarks) {
          await tx.store.delete(b.id);
        }
        await tx.done;
      } else {
        await db.clear('scripture-bookmarks');
      }
    } catch (error) {
      console.error('[ScriptureService] Failed to clear bookmark cache:', error);
    }
  }

  async recoverMessageCache(sessionId?: string): Promise<void> {
    try {
      await this.init();
      const db = this.getTypedDB();
      if (sessionId) {
        const messages = await db.getAllFromIndex('scripture-messages', 'by-session', sessionId);
        const tx = db.transaction('scripture-messages', 'readwrite');
        for (const m of messages) {
          await tx.store.delete(m.id);
        }
        await tx.done;
      } else {
        await db.clear('scripture-messages');
      }
    } catch (error) {
      console.error('[ScriptureService] Failed to clear message cache:', error);
    }
  }

  /**
   * Full cache recovery — clear all scripture caches and refetch.
   */
  async recoverAllCaches(): Promise<void> {
    await this.recoverSessionCache();
    await this.recoverReflectionCache();
    await this.recoverBookmarkCache();
    await this.recoverMessageCache();
    if (import.meta.env.DEV) {
      console.log('[ScriptureService] All scripture caches cleared');
    }
  }

  // ============================================
  // Report data (server-fresh, bypasses cache)
  // ============================================

  /**
   * Fetch all session data directly from server for the Daily Prayer Report.
   * Bypasses IndexedDB cache to ensure partner data is included.
   */
  async getSessionReportData(sessionId: string): Promise<{
    reflections: ScriptureReflection[];
    bookmarks: ScriptureBookmark[];
    messages: ScriptureMessage[];
  }> {
    const [reflections, bookmarks, messages] = await Promise.all([
      this.fetchAndCacheReflections(sessionId),
      this.fetchAndCacheBookmarks(sessionId),
      this.fetchAndCacheMessages(sessionId),
    ]);
    return { reflections, bookmarks, messages };
  }

  // ============================================
  // Helpers
  // ============================================

  private async getBookmarkByStep(
    sessionId: string,
    stepIndex: number,
    userId: string
  ): Promise<ScriptureBookmark | null> {
    const bookmarks = await this.getBookmarksBySession(sessionId);
    return bookmarks.find((b) => b.stepIndex === stepIndex && b.userId === userId) ?? null;
  }
}

// Singleton instance
export const scriptureReadingService = new ScriptureReadingService();
