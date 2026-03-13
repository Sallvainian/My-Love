# 13. Scripture Reading Service

**Source:** `src/services/scriptureReadingService.ts`

## Overview

Manages scripture reading sessions with a cache-first pattern backed by Supabase. Extends `BaseIndexedDBService` for the `scripture-sessions` store and directly accesses additional stores (`scripture-reflections`, `scripture-bookmarks`, `scripture-messages`) via the shared database handle.

**Singleton:** `export const scriptureReadingService = new ScriptureReadingService()`

**Extends:** `BaseIndexedDBService<ScriptureSession, MyLoveDBSchema, 'scripture-sessions'>`

## Cache Pattern

- **READ:** Check IndexedDB cache first. If found, return cached data and fire-and-forget a background refresh from Supabase. If miss, fetch from Supabase, cache, then return.
- **WRITE:** POST to Supabase RPC/table first. On success, update IndexedDB cache. On failure, throw.
- **CORRUPTION:** On IndexedDB error, clear the corrupted cache and re-fetch from server.
- **Timeout:** All cache operations wrapped with 5-second timeout (`CACHE_TIMEOUT_MS`).

## Error Handling

### `ScriptureErrorCode` Enum

| Code                | Meaning                         |
| ------------------- | ------------------------------- |
| `VERSION_MISMATCH`  | Optimistic concurrency conflict |
| `SESSION_NOT_FOUND` | Session does not exist          |
| `UNAUTHORIZED`      | User lacks access               |
| `SYNC_FAILED`       | Server write failed             |
| `OFFLINE`           | Device is offline               |
| `CACHE_CORRUPTED`   | IndexedDB data invalid          |
| `VALIDATION_FAILED` | Zod validation failed           |

### `ScriptureError` Interface

```typescript
interface ScriptureError {
  code: ScriptureErrorCode;
  message: string;
  details?: unknown;
}
```

All write failures throw `ScriptureError` objects. Read failures return `null` or `[]` (graceful degradation).

## Session Methods

### `createSession(mode, partnerId?): Promise<ScriptureSession>`

Creates a session via the `scripture_create_session` RPC.

**RPC:** `supabase.rpc('scripture_create_session', { p_mode, p_partner_id? })`

**Validation:** Response validated via `SupabaseSessionSchema.parse()`

**Cache:** Writes to IndexedDB after successful creation (fire-and-forget).

---

### `getSession(sessionId, onRefresh?): Promise<ScriptureSession | null>`

Cache-first read with optional background refresh callback.

**Parameters:**

- `sessionId: string` -- Session UUID
- `onRefresh?: (session: ScriptureSession) => void` -- Called when background refresh completes with fresh data (allows Zustand state sync)

**Flow:**

1. Check IndexedDB cache via `this.get(sessionId)`
2. If cached: return cached, fire-and-forget `refreshSessionFromServer()`
3. If miss: call `fetchAndCacheSession()` from Supabase

---

### `getUserSessions(userId): Promise<ScriptureSession[]>`

Gets all sessions for a user. Uses `by-user` index on `scripture-sessions` store.

**Cache corruption recovery:** On IndexedDB error, calls `recoverSessionCache()` then fetches from server.

---

### `updateSession(sessionId, updates): Promise<void>`

Write-through update to Supabase then cache.

**Accepted fields:** `currentPhase`, `currentStepIndex`, `status`, `version`, `completedAt`, `mode`

**Field mapping:** camelCase to snake_case for Supabase (e.g., `currentPhase` to `current_phase`)

**Query:** `supabase.from('scripture_sessions').update(supabaseUpdates).eq('id', sessionId)`

## Reflection Methods

### `addReflection(sessionId, stepIndex, rating, notes, isShared): Promise<ScriptureReflection>`

Submits a reflection via the `scripture_submit_reflection` RPC.

**RPC:** `supabase.rpc('scripture_submit_reflection', { p_session_id, p_step_index, p_rating, p_notes, p_is_shared })`

**Validation:** `SupabaseReflectionSchema.parse(data)`

---

### `getReflectionsBySession(sessionId): Promise<ScriptureReflection[]>`

Cache-first read using `by-session` index on `scripture-reflections` store.

## Bookmark Methods

### `addBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<ScriptureBookmark>`

Direct table insert (not RPC).

**Query:** `supabase.from('scripture_bookmarks').insert({ session_id, step_index, user_id, share_with_partner }).select().single()`

**Validation:** `SupabaseBookmarkSchema.parse(data)`

---

### `toggleBookmark(sessionId, stepIndex, userId, shareWithPartner): Promise<{ added: boolean, bookmark: ScriptureBookmark | null }>`

Checks if bookmark exists for the step. If yes, deletes it from server and cache. If no, creates it. Returns `{ added: true/false, bookmark }`.

---

### `getBookmarksBySession(sessionId): Promise<ScriptureBookmark[]>`

Cache-first read using `by-session` index on `scripture-bookmarks` store.

---

### `updateSessionBookmarkSharing(sessionId, userId, shareWithPartner): Promise<void>`

Batch updates `share_with_partner` flag for all of a user's bookmarks in a session.

**Server:** `supabase.from('scripture_bookmarks').update({ share_with_partner }).eq('session_id', sessionId).eq('user_id', userId)`

**Cache:** Updates matching bookmarks in a single IndexedDB transaction.

## Message Methods

### `addMessage(sessionId, senderId, message): Promise<ScriptureMessage>`

Direct table insert.

**Query:** `supabase.from('scripture_messages').insert({ session_id, sender_id, message }).select().single()`

**Validation:** `SupabaseMessageSchema.parse(data)`

---

### `getMessagesBySession(sessionId): Promise<ScriptureMessage[]>`

Cache-first read using `by-session` index on `scripture-messages` store.

## Stats

### `getCoupleStats(): Promise<CoupleStats | null>`

Fetches aggregate statistics via RPC.

**RPC:** `supabase.rpc('scripture_get_couple_stats')`

**Validation:** `CoupleStatsSchema.parse(data)`

**Returns:**

```typescript
interface CoupleStats {
  totalSessions: number;
  totalSteps: number;
  lastCompleted: string | null; // ISO timestamp
  avgRating: number; // 0-5
  bookmarkCount: number;
}
```

**Error handling:** Returns `null` on any failure (read operation convention).

## Cache Recovery

### `recoverSessionCache(): Promise<void>`

Clears the `scripture-sessions` store on corruption detection.

### `recoverAllCaches(): Promise<void>`

Clears all four scripture stores: sessions, reflections, bookmarks, messages.

## Session Report

### `getSessionReportData(sessionId): Promise<{ session, reflections, bookmarks, messages }>`

Aggregates all data for a session report view by fetching sessions, reflections, bookmarks, and messages.

## Transform Helpers (Private)

| Function                      | Direction             | Description                                                                         |
| ----------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `toLocalSession(row, userId)` | Supabase to IndexedDB | Maps `user1_id` to `userId`, `user2_id` to `partnerId`, converts timestamps to Date |
| `toLocalReflection(row)`      | Supabase to IndexedDB | Maps `session_id` to `sessionId`, snake_case to camelCase                           |
| `toLocalBookmark(row)`        | Supabase to IndexedDB | Maps `share_with_partner` to `shareWithPartner`                                     |
| `toLocalMessage(row)`         | Supabase to IndexedDB | Maps `sender_id` to `senderId`                                                      |
