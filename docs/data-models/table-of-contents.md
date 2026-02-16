# Data Models -- Table of Contents

## 1. Database Schema Overview
- Supabase table inventory (11 tables across core and scripture features)
- Custom enum types: `scripture_session_mode`, `scripture_session_phase`, `scripture_session_status`
- Storage buckets: `photos` (10 MB max, private), `love-notes-images` (5 MB max, private)
- TEXT + CHECK constraint pattern (replaces original enum types after migration 20251206024345)

## 2. Supabase Tables
- 2.1 `users` -- User profiles (id, partner_name, device_id, email, display_name, partner_id, timestamps)
- 2.2 `moods` -- Mood tracking (12 mood types, 500-char note limit, `mood_types` array column)
- 2.3 `love_notes` -- Partner messages (content 1-1000 chars, optional image_url, `different_users` check)
- 2.4 `interactions` -- Poke/kiss interactions (type check, viewed boolean, from/to user FKs)
- 2.5 `partner_requests` -- Invitation workflow (pending/accepted/declined status, `no_self_requests` check, unique partial index)
- 2.6 `photos` -- Photo metadata (storage_path unique, mime_type check, file_size, width, height)
- 2.7 `scripture_sessions` -- Reading sessions (solo/together mode, phase enum, step index, version for OCC, snapshot JSONB)
- 2.8 `scripture_step_states` -- Step synchronization (user1/user2 lock timestamps, advanced_at, unique session+step)
- 2.9 `scripture_reflections` -- Per-step reflections (1-5 rating, notes, is_shared, unique session+step+user)
- 2.10 `scripture_bookmarks` -- Bookmarked steps (share_with_partner toggle, unique session+step+user)
- 2.11 `scripture_messages` -- Prayer report messages (session_id, sender_id, message text)

## 3. IndexedDB Stores
- Database: `my-love-db`, version 5
- 3.1 `messages` -- Custom love messages (keyPath: id, indexes: by-category, by-date)
- 3.2 `photos` -- Compressed photo blobs (keyPath: id, index: by-date)
- 3.3 `moods` -- Mood entries with sync tracking (keyPath: id, indexes: by-date unique, by-sync)
- 3.4 `sw-auth` -- Service Worker auth token (keyPath: id, single record keyed `'current'`)
- 3.5 `scripture-sessions` -- Cached sessions (keyPath: id, index: by-user)
- 3.6 `scripture-reflections` -- Cached reflections (keyPath: id, index: by-session)
- 3.7 `scripture-bookmarks` -- Cached bookmarks (keyPath: id, index: by-session)
- 3.8 `scripture-messages` -- Cached prayer messages (keyPath: id, index: by-session)
- Version history: v1 (messages) -> v2 (photos) -> v3 (moods) -> v4 (sw-auth) -> v5 (scripture stores)

## 4. TypeScript Type Definitions
- 4.1 Generated Supabase Types (`database.types.ts`) -- `Tables<T>`, `TablesInsert<T>`, `TablesUpdate<T>`, `Enums<T>` utility types
- 4.2 Application Types (`types/index.ts`) -- ThemeName, MessageCategory, MoodType, Message, Photo, MoodEntry, Settings, AppState
- 4.3 Supabase Model Types (`types/models.ts`) -- LoveNote (with client-side fields), LoveNotesState, Scripture re-exports

## 5. Zod Validation Schemas
- 5.1 Local Validation (`validation/schemas.ts`) -- MessageSchema, PhotoSchema, MoodEntrySchema, SettingsSchema, CustomMessagesExportSchema, Scripture schemas
- 5.2 Supabase API Validation (`api/validation/supabaseSchemas.ts`) -- User, Mood, Interaction Row/Insert/Update schemas, array schemas, UUID/Timestamp/MoodType common schemas

## 6. Supabase RPC Functions
- 6.1 `get_partner_id(user_id UUID)` -> `UUID` -- SECURITY DEFINER, STABLE; deprecated in migration 20251206024345
- 6.2 `accept_partner_request(p_request_id UUID)` -> `void` -- Atomic partner linking with partner-exists guard
- 6.3 `decline_partner_request(p_request_id UUID)` -> `void` -- Validate pending + recipient before declining
- 6.4 `sync_user_profile()` -> `trigger` -- AFTER INSERT OR UPDATE ON auth.users, syncs email + display_name
- 6.5 `is_scripture_session_member(p_session_id UUID)` -> `BOOLEAN` -- RLS helper checking user1_id/user2_id
- 6.6 `scripture_create_session(p_mode, p_partner_id)` -> `JSONB` -- Create solo/together session
- 6.7 `scripture_submit_reflection(...)` -> `JSONB` -- Idempotent upsert via ON CONFLICT
- 6.8 `scripture_seed_test_data(...)` -> `JSONB` -- Test seeding with presets (default, mid_session, completed, with_help_flags, unlinked)
- `get_my_partner_id()` -> `UUID` -- SECURITY DEFINER helper to break RLS recursion (added in migration 20260205000001)

## 7. Storage Buckets
- `photos` bucket -- 10 MB max, private, path-based folder isolation (`auth.uid()` = first folder segment)
- `love-notes-images` bucket -- 5 MB max, private, extension validation (jpg, jpeg, png, webp) + folder isolation

## 8. RLS Policies
- 8.1 `users` -- Self + partner SELECT (via `get_my_partner_id()` helper), safe UPDATE preventing `partner_id` manipulation
- 8.2 `moods` -- Own + partner SELECT, own-only INSERT/UPDATE/DELETE
- 8.3 `love_notes` -- Sender/recipient SELECT, sender-only INSERT
- 8.4 `interactions` -- Participant SELECT, sender INSERT, recipient UPDATE (mark viewed)
- 8.5 `partner_requests` -- Participant SELECT, sender INSERT, recipient UPDATE
- 8.6 `photos` -- Own + partner SELECT, own-only INSERT/DELETE
- 8.7 `photos` Storage Bucket -- Path-based folder isolation
- 8.8 `love-notes-images` Storage Bucket -- Extension validation + folder isolation
- 8.9 `scripture_sessions` -- Member SELECT/UPDATE, creator INSERT
- 8.10 `scripture_step_states` -- `is_scripture_session_member()` for SELECT/INSERT/UPDATE
- 8.11 `scripture_reflections` -- Own + shared SELECT, own INSERT/UPDATE
- 8.12 `scripture_bookmarks` -- Own + shared SELECT, own INSERT/UPDATE/DELETE
- 8.13 `scripture_messages` -- Session member SELECT, sender INSERT

## 9. Migration History
- 12 migrations from 2025-12-03 through 2026-02-06
- Core schema, photos, love note images, MIME validation, remote schema sync, RLS fixes, security patches, scripture reading, RPCs, unlinked preset, RLS recursion fix, pgTAP extension

---
