# 13. Scripture Reading Service

**Source:** `src/services/scriptureReadingService.ts`

## Overview

The `ScriptureReadingService` extends `BaseIndexedDBService<ScriptureSession>` to provide cache-first CRUD operations for scripture reading sessions, reflections, bookmarks, and messages. It manages four IndexedDB stores (scripture-sessions, scripture-reflections, scripture-bookmarks, scripture-messages) while using Supabase as the source of truth.

## Architecture: Cache-First Pattern

```
READ:   IndexedDB cache -> return cached -> fire-and-forget background refresh from Supabase -> update cache
WRITE:  POST to Supabase RPC -> on success -> update IndexedDB cache -> on failure -> throw
CORRUPTION: On IndexedDB error -> clear cache -> refetch from server
```

The service extends `BaseIndexedDBService` for the `scripture-sessions` store only. Additional stores (reflections, bookmarks, messages) are accessed directly via the shared `db` handle.

## Error Handling

### ScriptureErrorCode Enum

```typescript
enum ScriptureErrorCode {
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',
  CACHE_CORRUPTED = 'CACHE_CORRUPTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
}
```

### ScriptureError Interface

```typescript
interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}
```

### `handleScriptureError(error: ScriptureError): void`

Logs errors to console with severity based on error code:
- `VERSION_MISMATCH`, `SYNC_FAILED`, `OFFLINE`: `console.warn`
- `CACHE_CORRUPTED`, `SESSION_NOT_FOUND`, `UNAUTHORIZED`, `VALIDATION_FAILED`: `console.error`

## Transform Helpers

Four private functions convert Supabase snake_case rows to camelCase IndexedDB records:

| Helper              | Input                | Output                |
| ------------------- | -------------------- | --------------------- |
| `toLocalSession`    | `SupabaseSession`    | `ScriptureSession`    |
| `toLocalReflection` | `SupabaseReflection` | `ScriptureReflection` |
| `toLocalBookmark`   | `SupabaseBookmark`   | `ScriptureBookmark`   |
| `toLocalMessage`    | `SupabaseMessage`    | `ScriptureMessage`    |

All transform helpers convert ISO string timestamps to `Date` objects and map `null` to `undefined` for optional fields.

## Session CRUD

### `createSession(mode, partnerId?): Promise<ScriptureSession>`

Creates a new scripture session via the `scripture_create_session` RPC.

| Parameter   | Type                   | Required          | Description     |
| ----------- | ---------------------- | ----------------- | --------------- |
| `mode`      | `'solo' \| 'together'` | Yes               | Session mode    |
| `partnerId` | `string`               | For together mode | Partner's UUID  |

**Flow:**
1. Call `supabase.rpc('scripture_create_session', { p_mode, p_partner_id })`
2. Validate response with `SupabaseSessionSchema.parse()`
3. Transform to local format via `toLocalSession()`
4. Cache in IndexedDB
5. Return the local session

**Throws:** `ScriptureError` with `SYNC_FAILED` code on RPC failure.

### `getSession(sessionId, onRefresh?): Promise<ScriptureSession | null>`

Cache-first read with optional background refresh callback.

| Parameter   | Type                                  | Description                                |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `sessionId` | `string`                              | Session UUID                               |
| `onRefresh` | `(session: ScriptureSession) => void` | Called when background refresh completes    |

**Flow:**
1. Check IndexedDB cache via `this.get(sessionId)`
2. If cached: return immediately, fire-and-forget `refreshSessionFromServer()` which calls `onRefresh` with fresh data
3. If cache miss: fetch from Supabase, cache, return

### `getUserSessions(userId): Promise<ScriptureSession[]>`

Cache-first read for all sessions where the user is `user1_id` or `user2_id`.

**Flow:**
1. Query IndexedDB `by-user` index
2. If cached entries found: return immediately, fire-and-forget background refresh
3. If cache miss or cache error: fetch from Supabase via `.or()` filter, cache all, return
4. On cache corruption: call `recoverSessionCache()` then fetch from server

### `updateSession(sessionId, updates): Promise<void>`

Write-through pattern: server first, then update cache.

**Updatable fields:** `currentPhase`, `currentStepIndex`, `status`, `version`, `completedAt`, `mode`

**Flow:**
1. Build snake_case payload from camelCase updates
2. Call `supabase.from('scripture_sessions').update().eq('id', sessionId)`
3. On success: update IndexedDB cache
4. On failure: throw `ScriptureError` with `SYNC_FAILED`

## Reflection CRUD

### `addReflection(sessionId, stepIndex, rating, notes, isShared): Promise<ScriptureReflection>`

Submits a reflection via the `scripture_submit_reflection` RPC (idempotent upsert).

| Parameter   | Type      | Description          |
| ----------- | --------- | -------------------- |
| `sessionId` | `string`  | Session UUID         |
| `stepIndex` | `number`  | Reading step (0-16)  |
| `rating`    | `number`  | 1-5 rating           |
| `notes`     | `string`  | Reflection text      |
| `isShared`  | `boolean` | Share with partner   |

**Validation:** Response parsed with `SupabaseReflectionSchema`.

### `getReflectionsBySession(sessionId): Promise<ScriptureReflection[]>`

Cache-first read from `scripture-reflections` store's `by-session` index. Fires background refresh on cache hit. Calls `recoverReflectionCache()` on cache errors.

## Bookmark CRUD

### `addBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<ScriptureBookmark>`

Write-through insert to `scripture_bookmarks` table with `SupabaseBookmarkSchema` validation.

### `toggleBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<{ added: boolean; bookmark: ScriptureBookmark | null }>`

Toggles a bookmark for a specific step:
1. Check if bookmark exists via `getBookmarkByStep()` (searches cached bookmarks)
2. If exists: delete from server, remove from cache, return `{ added: false, bookmark: null }`
3. If not exists: create via `addBookmark()`, return `{ added: true, bookmark }`

### `getBookmarksBySession(sessionId): Promise<ScriptureBookmark[]>`

Cache-first read from `scripture-bookmarks` store. Same pattern as reflections.

### `updateSessionBookmarkSharing(sessionId, userId, shareWithPartner): Promise<void>`

Batch updates the `share_with_partner` flag for all bookmarks belonging to the current user in a session.

**Flow:**
1. Server: `supabase.from('scripture_bookmarks').update({ share_with_partner }).eq('session_id').eq('user_id')`
2. Cache: Open transaction on `scripture-bookmarks`, iterate all bookmarks for session, update matching userId entries

## Message CRUD

### `addMessage(sessionId, senderId, message): Promise<ScriptureMessage>`

Write-through insert to `scripture_messages` table with `SupabaseMessageSchema` validation.

### `getMessagesBySession(sessionId): Promise<ScriptureMessage[]>`

Cache-first read from `scripture-messages` store. Same pattern as reflections and bookmarks.

## Statistics

### `getCoupleStats(): Promise<CoupleStats | null>`

Fetches couple-aggregate stats via `scripture_get_couple_stats` RPC. Read operation -- returns `null` on failure (per project convention for read operations).

**Validation:** Response parsed with `CoupleStatsSchema` from `src/api/validation/supabaseSchemas.ts`.

**Return type:**
```typescript
interface CoupleStats {
  totalSessions: number;
  totalSteps: number;
  lastCompleted: string | null; // ISO timestamp
  avgRating: number; // 0-5
  bookmarkCount: number;
}
```

## Report Data

### `getSessionReportData(sessionId): Promise<{ reflections, bookmarks, messages }>`

Fetches all session data **directly from server** (bypasses cache) using `Promise.all` for parallel execution. Used by the Daily Prayer Report to ensure partner data is included.

## Corruption Recovery

All recovery methods clear the relevant IndexedDB store(s) and log errors without throwing.

| Method                     | Scope                                    | Description                                  |
| -------------------------- | ---------------------------------------- | -------------------------------------------- |
| `recoverSessionCache()`    | All sessions                             | Clears `scripture-sessions` store            |
| `recoverReflectionCache()` | Session-scoped or all                    | Deletes by session or clears entire store    |
| `recoverBookmarkCache()`   | Session-scoped or all                    | Deletes by session or clears entire store    |
| `recoverMessageCache()`    | Session-scoped or all                    | Deletes by session or clears entire store    |
| `recoverAllCaches()`       | All 4 scripture stores                   | Calls all 4 recovery methods sequentially    |

Session-scoped recovery uses a transaction to delete only entries matching the given `sessionId` from the `by-session` index.

## Background Refresh Helpers

Five private methods silently refresh cached data from the server. All catch errors without rethrowing (the cache serves stale data as fallback):

- `refreshSessionFromServer(sessionId, onRefresh?)` -- calls `onRefresh` callback with fresh data
- `refreshUserSessionsFromServer(userId)`
- `refreshReflectionsFromServer(sessionId)`
- `refreshBookmarksFromServer(sessionId)`
- `refreshMessagesFromServer(sessionId)`

## Singleton

```typescript
export const scriptureReadingService = new ScriptureReadingService();
```
