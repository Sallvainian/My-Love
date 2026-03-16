# 13. Scripture Reading Service

**Source:** `src/services/scriptureReadingService.ts`

## Purpose

Cache-first IndexedDB CRUD with Supabase write-through for scripture reading sessions, reflections, bookmarks, and messages.

## Cache Pattern

- **READ**: IndexedDB cache first, return cached, fire-and-forget background refresh from server
- **WRITE**: POST to Supabase RPC/table first, on success update IndexedDB cache, on failure throw
- **CORRUPTION**: On IndexedDB error, clear cache, refetch from server
- **Timeout**: All cache operations have 5-second timeout

## Class: `ScriptureReadingService`

Extends `BaseIndexedDBService<ScriptureSession, MyLoveDBSchema, 'scripture-sessions'>`. Singleton: `scriptureReadingService`.

### Session CRUD

**`createSession(mode, partnerId?): Promise<ScriptureSession>`** -- Calls `scripture_create_session` RPC. Validates response with `SupabaseSessionSchema`. Caches locally.

**`getSession(sessionId, onRefresh?): Promise<ScriptureSession | null>`** -- Cache-first. Fires background refresh with optional `onRefresh` callback for Zustand state sync.

**`getUserSessions(userId): Promise<ScriptureSession[]>`** -- Cache-first using `by-user` index.

**`updateSession(sessionId, updates): Promise<void>`** -- Write-through. Converts camelCase to snake_case for Supabase.

### Reflection CRUD

**`addReflection(sessionId, stepIndex, rating, notes, isShared): Promise<ScriptureReflection>`** -- Calls `scripture_submit_reflection` RPC (upsert). Validates with `SupabaseReflectionSchema`.

**`getReflectionsBySession(sessionId): Promise<ScriptureReflection[]>`** -- Cache-first on `by-session` index.

### Bookmark CRUD

**`addBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<ScriptureBookmark>`** -- Direct table insert. Validates with `SupabaseBookmarkSchema`.

**`toggleBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<{ added, bookmark }>`** -- Delete if exists, create if not.

**`getBookmarksBySession(sessionId): Promise<ScriptureBookmark[]>`** -- Cache-first.

**`updateSessionBookmarkSharing(sessionId, userId, shareWithPartner): Promise<void>`** -- Bulk update sharing flag.

### Message CRUD

**`addMessage(sessionId, senderId, message): Promise<ScriptureMessage>`** -- Direct table insert. Validates with `SupabaseMessageSchema`.

**`getMessagesBySession(sessionId): Promise<ScriptureMessage[]>`** -- Cache-first.

### Stats

**`getCoupleStats(): Promise<CoupleStats | null>`** -- Calls `scripture_get_couple_stats` RPC. Validates with `CoupleStatsSchema`. Returns null on failure.

### Report Data

**`getSessionReportData(sessionId): Promise<{ reflections, bookmarks, messages }>`** -- Fetches all data directly from server (bypasses cache for freshness).

### Cache Recovery

**`recoverSessionCache()`**, **`recoverReflectionCache(sessionId?)`**, **`recoverBookmarkCache(sessionId?)`**, **`recoverMessageCache(sessionId?)`**, **`recoverAllCaches()`** -- Clear corrupted caches, optionally scoped to a session.

## Error Handling

```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH,
  SESSION_NOT_FOUND,
  UNAUTHORIZED,
  SYNC_FAILED,
  OFFLINE,
  CACHE_CORRUPTED,
  VALIDATION_FAILED,
}
```
