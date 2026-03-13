# Data Models -- Table of Contents

## 1. Database Schema Overview

- Supabase PostgreSQL with RLS on all tables
- 10 tables across two feature areas: core couples app + scripture reading
- 4 custom enum types
- 13 RPC functions
- 2 private Storage buckets
- IndexedDB with 8 object stores (v5)

## 2. Supabase Tables

- `users` -- User profiles with partner linking
- `moods` -- Mood tracking entries (enum type + note)
- `love_notes` -- Chat messages between partners
- `interactions` -- Poke/kiss interactions
- `partner_requests` -- Partner connection requests
- `photos` -- Photo metadata (storage refs)
- `scripture_sessions` -- Reading session state
- `scripture_step_states` -- Per-step lock-in tracking
- `scripture_reflections` -- Post-reading reflections
- `scripture_bookmarks` -- Step bookmarks
- `scripture_messages` -- Daily prayer report messages

## 3. IndexedDB Stores

- `messages` (v1) -- Custom love messages, indexes: by-category, by-date
- `photos` (v2) -- Photo blobs with compression metadata, index: by-date
- `moods` (v3) -- Offline-first mood entries, index: by-date (unique)
- `sw-auth` (v4) -- Background Sync auth token
- `scripture-sessions` (v5) -- Session cache, index: by-user
- `scripture-reflections` (v5) -- Reflection cache, index: by-session
- `scripture-bookmarks` (v5) -- Bookmark cache, index: by-session
- `scripture-messages` (v5) -- Message cache, index: by-session

## 4. TypeScript Type Definitions

- Core types: `ThemeName`, `MessageCategory`, `MoodType`, `Message`, `Photo`, `MoodEntry`
- Compression types: `CompressionOptions`, `CompressionResult`
- IndexedDB types: `StoredAuthToken`, `ScriptureSession`, `ScriptureReflection`, `ScriptureBookmark`, `ScriptureMessage`
- Auto-generated: `Database` type from `database.types.ts` (10 tables, 13 RPCs, 4 enums)

## 5. Zod Validation Schemas

- Client-side: `MessageSchema`, `PhotoSchema`, `MoodEntrySchema`, `SettingsSchema`, `CustomMessagesExportSchema`
- API response: `SupabaseMoodSchema`, `SupabaseInteractionSchema`, `SupabaseUserSchema`, `CoupleStatsSchema`
- Scripture: `SupabaseSessionSchema`, `SupabaseReflectionSchema`, `SupabaseBookmarkSchema`, `SupabaseMessageSchema`

## 6. Supabase RPC Functions

- `accept_partner_request(p_request_id)` -- Accept partner request
- `decline_partner_request(p_request_id)` -- Decline partner request
- `get_my_partner_id()` -- Get current user's partner ID
- `scripture_create_session(p_mode, p_partner_id?)` -- Create reading session
- `scripture_lock_in(p_session_id, p_step_index, p_expected_version)` -- Lock in for step
- `scripture_submit_reflection(...)` -- Submit post-reading reflection
- `scripture_get_couple_stats()` -- Aggregate couple reading statistics
- `scripture_end_session(p_session_id)` -- Mark session complete/abandoned
- `scripture_convert_to_solo(p_session_id)` -- Convert together to solo
- `scripture_seed_test_data(...)` -- Test data seeding (development)
- `is_scripture_session_member(p_session_id)` -- RLS helper

## 7. Storage Buckets

- `photos` -- Private bucket for user photo uploads
- `love-notes-images` -- Private bucket for chat image attachments

## 8. RLS Policies

- All tables have RLS enabled with `authenticated` role
- Users can CRUD their own data
- Partners can view each other's data (moods, photos, interactions)
- Partner lookup uses `get_partner_id()` SECURITY DEFINER function to avoid recursion
- Scripture session access uses `is_scripture_session_member()` helper

## 9. Migration History

- 23 migration files from 2025-12-03 to 2026-03-13
- Base schema, photos, love notes, scripture reading, lobby/roles, lock-in, end session
- Security fixes: RLS recursion, privilege escalation, function search paths
