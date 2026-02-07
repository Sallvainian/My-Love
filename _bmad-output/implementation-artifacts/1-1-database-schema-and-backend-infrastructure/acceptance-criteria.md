# Acceptance Criteria

1. **Supabase Tables & Policies Exist**
   - `scripture_sessions` (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, snapshot_json, started_at, completed_at) — **DONE (Sprint 0)**
   - `scripture_step_states` (id, session_id, step_index, user1_locked_at, user2_locked_at, advanced_at) — **DONE (Sprint 0)**
   - `scripture_reflections` (id, session_id, step_index, user_id, rating, notes, is_shared, created_at) — **DONE (Sprint 0)**
   - `scripture_bookmarks` (id, session_id, step_index, user_id, share_with_partner, created_at) — **DONE (Sprint 0)**
   - `scripture_messages` (id, session_id, sender_id, message, created_at) — **DONE (Sprint 0)**
   - RLS policies enforce session-based access (only session participants can read/write) — **DONE (Sprint 0)**
   - RPCs exist: `scripture_create_session`, `scripture_submit_reflection` — **DONE (Phase 1B, Tasks 12-13)**; `scripture_lock_in`, `scripture_advance_phase` — **STUB only (Sprint 0, not yet functional)**
   - Unique constraint on scripture_reflections (session_id, step_index, user_id) for idempotent writes — **DONE (Sprint 0)**

2. **Centralized IndexedDB Schema Exists**
   - `src/services/dbSchema.ts` centralizes DB_NAME, DB_VERSION (5), and all store definitions — **DONE (Sprint 0)**
   - Existing services (moodService, customMessageService, photoStorageService) import from dbSchema.ts — **VERIFY & FIX if needed**
   - New IndexedDB stores: scripture-sessions, scripture-reflections, scripture-bookmarks, scripture-messages — **DONE (Sprint 0)**
   - Scripture stores use cache-only pattern (no 'synced' index) — **DONE (Sprint 0)**

3. **Scripture Reading Service Created**
   - `src/services/scriptureReadingService.ts` extends BaseIndexedDBService
   - Provides IndexedDB CRUD for scripture data (read-heavy, write-through to server)
   - Read pattern: check IndexedDB first → return cached → fetch fresh from server → update cache
   - Write pattern: POST to server → on success update IndexedDB → on failure show retry UI
   - Corruption recovery: on IndexedDB error, clear cache and refetch from server

4. **Scripture Reading Slice Created**
   - `src/stores/slices/scriptureReadingSlice.ts` exports types: SessionPhase, SessionMode, ScriptureSession, ScriptureReadingState
   - Provides actions for session lifecycle (create, load, exit)
   - Follows existing Zustand slice composition pattern
   - Composed into useAppStore via `src/stores/useAppStore.ts`
   - AppState interface in `src/stores/types.ts` updated with ScriptureSlice

5. **Static Scripture Data Added**
   - All 17 steps with verse text, response text, section themes, and verse references available as static TypeScript module
   - Location: `src/data/scriptureSteps.ts`

6. **Database Types Synced**
   - `src/types/database.types.ts` includes scripture table types (run `supabase gen types typescript`)
