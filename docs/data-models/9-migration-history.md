# 9. Migration History

All migrations are stored in `supabase/migrations/` and applied in filename-sorted order via `supabase db reset` or `supabase migration up`.

## Migration Timeline

| #  | Migration | Date | Description |
|----|-----------|------|-------------|
| 1 | `20251203000001_create_base_schema.sql` | 2025-12-03 | Core tables: `users`, `moods`, `love_notes`, `interactions`, `partner_requests`. Enum types (`mood_type`, `interaction_type`, `partner_request_status`). `accept_partner_request` RPC. `get_partner_id` helper. Initial RLS policies. |
| 2 | `20251203190800_create_photos_table.sql` | 2025-12-03 | `photos` metadata table with MIME CHECK constraint (`image/jpeg`, `image/png`, `image/webp`). `photos` storage bucket (10 MB limit, private). RLS policies for table and storage (path-based folder isolation). |
| 3 | `20251205000001_add_love_notes_images.sql` | 2025-12-05 | Added `image_url` column to `love_notes`. Created `love-notes-images` storage bucket (private). Storage RLS for image uploads and partner reads. |
| 4 | `20251205000002_add_mime_validation.sql` | 2025-12-05 | Replaced love note image upload storage policy to add file extension validation (`jpg`, `jpeg`, `png`, `webp`) via `storage.extension(name)`. |
| 5 | `20251206024345_remote_schema.sql` | 2025-12-06 | Large schema sync from remote. **Breaking change:** dropped enum types (`mood_type`, `interaction_type`, `partner_request_status`), replaced with TEXT columns + CHECK constraints. Added `sync_user_profile` trigger (`AFTER INSERT OR UPDATE ON auth.users`). Added `decline_partner_request` RPC. Rewrote `accept_partner_request` with partner-exists guard. Replaced all RLS policies. Added extensive indexes (`idx_interactions_from_user`, `idx_interactions_to_user_viewed`, `idx_love_notes_from_user_created`, `idx_love_notes_to_user_created`, `idx_partner_requests_to_user_pending`, `idx_partner_requests_unique`, `idx_users_display_name_search`, `idx_users_email_search`, `idx_users_partner`). Added `different_users` check on `love_notes`, `no_self_requests` check on `partner_requests`. Changed `moods.note` limit from 200 to 500. Changed `moods.user_id` FK target from `auth.users` to `users`. Set `device_id` default to `gen_random_uuid()`. |
| 6 | `20251206124803_fix_users_rls_policy.sql` | 2025-12-06 | Replaced overly permissive "Authenticated users can read all users" SELECT policy with scoped "Users can view self and partner profiles". |
| 7 | `20251206200000_fix_users_update_privilege_escalation.sql` | 2025-12-06 | **P0 security fix.** Replaced `users_update_self` with `users_update_self_safe`. The WITH CHECK clause prevents `partner_id` manipulation -- users cannot set `partner_id` to arbitrary values for profile snooping. |
| 8 | `20260128000001_scripture_reading.sql` | 2026-01-28 | Scripture reading feature: 3 new enum types (`scripture_session_mode`, `scripture_session_phase`, `scripture_session_status`). 5 new tables (`scripture_sessions`, `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages`). RLS policies using `is_scripture_session_member()` SECURITY DEFINER helper. `scripture_seed_test_data` RPC with environment guard. |
| 9 | `20260130000001_scripture_rpcs.sql` | 2026-01-30 | Fixed `scripture_seed_test_data` variable reuse bug (`v_session_id` overwrite in sub-inserts). Added `scripture_create_session(p_mode, p_partner_id)` and `scripture_submit_reflection(...)` RPCs (both SECURITY DEFINER). |
| 10 | `20260204000001_unlinked_preset.sql` | 2026-02-04 | Added `'unlinked'` preset to `scripture_seed_test_data` RPC. Creates solo sessions with `user2_id = NULL` for testing unlinked user flows. Also adds `v_temp_id` variable to fix `v_session_id` overwrite in reflection/message sub-inserts. |
| 11 | `20260205000001_fix_users_rls_recursion.sql` | 2026-02-05 | **P1 bug fix.** Fixed infinite RLS recursion on `users` table (PostgreSQL error 42P17). Created `get_my_partner_id()` SECURITY DEFINER helper that reads `partner_id` bypassing RLS. Replaced both SELECT and UPDATE policies on `users` to call `get_my_partner_id()` instead of querying `public.users` directly. |
| 12 | `20260206000001_enable_pgtap.sql` | 2026-02-06 | Enabled `pgtap` extension in the `extensions` schema for database-level testing via `supabase test db`. |
| 13 | `20260217150353_scripture_couple_stats.sql` | 2026-02-17 | Added `scripture_get_couple_stats(p_partner_id UUID)` RPC (SECURITY DEFINER). Returns 5 metrics: `total_sessions`, `completed_sessions`, `total_reflections`, `shared_reflections`, `total_messages`. Uses subqueries to combine stats from both users. |
| 14 | `20260217184551_optimize_couple_stats_rpc.sql` | 2026-02-17 | Rewrote `scripture_get_couple_stats` using CTEs (Common Table Expressions) for better query plan optimization. Replaced nested subqueries with a CTE that finds all session IDs for the pair, then aggregates from that set. |
| 15 | `20260220000001_scripture_lobby_and_roles.sql` | 2026-02-20 | **Together-mode lobby feature (Story 4-1).** Created `scripture_session_role` enum (`reader`, `responder`). Added 5 columns to `scripture_sessions`: `user1_role`, `user2_role`, `user1_ready`, `user2_ready`, `countdown_started_at`. Added `idx_scripture_sessions_user2_status` index. Added RLS policies on `realtime.messages` for private broadcast channel (`scripture-session:{session_id}`). Created 3 RPCs: `scripture_select_role(session_id, role)`, `scripture_toggle_ready(session_id, is_ready)`, `scripture_convert_to_solo(session_id)`. All SECURITY INVOKER with `SET search_path = ''`. Each RPC bumps `version`, builds a JSONB snapshot, and broadcasts via `realtime.send()`. |
| 16 | `20260221000001_fix_function_search_paths.sql` | 2026-02-21 | Security hardening: added `SET search_path = ''` to all SECURITY DEFINER functions to prevent schema-injection attacks via mutable search_path. Fully qualified all bare table references with `public.` prefix. Affected: `is_scripture_session_member`, `scripture_seed_test_data`, `scripture_create_session`, `scripture_submit_reflection`. |
| 17 | `20260221211137_scripture_lobby_phase_guards.sql` | 2026-02-21 | Added lobby-phase guards to `scripture_select_role`, `scripture_toggle_ready`, and `scripture_convert_to_solo` RPCs. Raises exception if `current_phase != 'lobby'`, preventing out-of-phase mutations. |
| 18 | `20260222000001_scripture_lock_in.sql` | 2026-01-22 | **Synchronized reading feature (Story 4-2).** Created `scripture_lock_in(session_id, step_index, expected_version)` and `scripture_undo_lock_in(session_id, step_index)` RPCs. `scripture_lock_in` implements optimistic concurrency control via `expected_version`, idempotent UPSERT on `scripture_step_states`, automatic step advancement when both users lock, and transition to `reflection` phase at step 16. Phase guard accepts both `reading` and `countdown` (auto-transitions countdown to reading on first lock-in). Added RLS policies on `realtime.messages` for presence channel (`scripture-presence:{session_id}`). |
| 19 | `20260228000001_scripture_end_session.sql` | 2026-02-28 | **Graceful degradation (Story 4-3).** Added `'ended_early'` value to `scripture_session_status` enum via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`. Created `scripture_end_session(session_id)` RPC: validates caller is session member, validates `status = 'in_progress'`, sets `status = 'ended_early'` and `completed_at = now()`, bumps version, updates `snapshot_json`. |
| 20 | `20260301000100_fix_scripture_create_session_together_lobby.sql` | 2026-03-01 | **Together session creation fix.** Two changes: (1) Together-mode sessions now start in `lobby` phase instead of `reading`. (2) Reuses existing in-progress together session for the same user pair (any user order) if still in `lobby` phase, preventing duplicate sessions. Solo sessions still start in `reading` phase. |
| 21 | `20260301000200_remove_server_side_broadcasts.sql` | 2026-03-01 | **Architecture change: client-side broadcasts.** Removed all `PERFORM realtime.send()` calls from 6 RPCs: `scripture_select_role`, `scripture_toggle_ready`, `scripture_convert_to_solo`, `scripture_lock_in`, `scripture_undo_lock_in`, `scripture_end_session`. Server-side `realtime.send()` inserts into `realtime.messages`, but the local Supabase Docker Realtime service has no replication slot to deliver those messages to WebSocket clients. After this migration, Zustand slice actions broadcast state updates via `channel.send()` (client-side WebSocket) after each RPC succeeds. |
| 22 | `20260302000100_fix_end_session_current_phase.sql` | 2026-03-02 | **Bug fix: `scripture_end_session` now sets `current_phase = 'complete'`.** Previously the function set `status = 'ended_early'` but left `current_phase` at its previous value (e.g., `reading`), causing UI to not render the completion screen. Now explicitly sets `current_phase = 'complete'` alongside `status = 'ended_early'`. |
| 23 | `20260302000200_add_step_boundary_comment.sql` | 2026-03-02 | **Documentation: step boundary comment.** Added `COMMENT ON FUNCTION public.scripture_lock_in` documenting the hardcoded step boundary (`v_max_step_index = 16`, coupled to `MAX_STEPS = 17` in frontend `constants.ts`). No functional changes. |
| 24 | `20260303000100_hardening_chunks_1_4.sql` | 2026-03-03 | **Epic 4 hardening (chunks 1-4).** Four changes in one transaction: **(A1)** `scripture_end_session` reverted to `SECURITY INVOKER` and merged with the `current_phase = 'complete'` fix from migration 22. **(A2)** `scripture_lock_in` adds `v_max_step_index CONSTANT INT := 16` replacing the magic number, with a comment tying it to `MAX_STEPS = 17` in frontend constants. **(A3)** All 4 `realtime.messages` RLS policies (session + presence channels) recreated with UUID regex guard (`~ '^[0-9a-f]{8}-...'`) before the `::uuid` cast to prevent SQL injection via crafted topic strings. **(A4)** `scripture_convert_to_solo` now clears `user1_role = NULL, user2_role = NULL` in addition to existing cleanup, preventing stale role data after conversion. |

## Migration Categories

### Schema Foundations (Migrations 1-7)
Core tables, storage buckets, RLS policies, partner management RPCs. Includes a major schema refactor (migration 5) that dropped enum types in favor of TEXT + CHECK constraints, and two security fixes (migrations 6-7).

### Scripture Reading Feature (Migrations 8-12)
Tables, enums, RPCs, RLS policies, and test seeding for the scripture reading feature. Includes an RLS recursion fix and pgTAP enablement.

### Scripture Statistics (Migrations 13-14)
Couple stats RPC with CTE optimization.

### Together-Mode Lobby (Migrations 15-17)
Role selection, ready state, countdown, private broadcast channel RLS, lobby RPCs with phase guards.

### Synchronized Reading (Migration 18)
Lock-in/undo RPCs with optimistic concurrency, step advancement logic, and presence channel RLS.

### Graceful Degradation (Migration 19)
End session RPC with `ended_early` status.

### Session Fixes and Architecture (Migrations 20-21)
Together session creation semantics (lobby start, pair reuse) and removal of server-side broadcasts in favor of client-side channel.send().

### Hardening (Migrations 22-24)
Bug fixes (`current_phase = 'complete'` on end session), documentation comments (step boundary constant), and security hardening (SECURITY INVOKER revert for end_session, UUID regex guard on all `realtime.messages` RLS policies, role column cleanup in convert-to-solo, `v_max_step_index` CONSTANT replacing magic number in lock-in).

## Key Patterns Across Migrations

- **Optimistic concurrency control:** `version` field on `scripture_sessions`, checked in `scripture_lock_in` via `p_expected_version`.
- **`FOR UPDATE` row locking:** All scripture RPCs use `SELECT ... FOR UPDATE` to prevent race conditions.
- **SECURITY INVOKER with `SET search_path = ''`:** Scripture RPCs run as the calling user (RLS applies) with a locked search path.
- **SECURITY DEFINER helpers:** `get_my_partner_id()`, `is_scripture_session_member()`, `scripture_get_couple_stats()` bypass RLS for specific lookups.
- **Phase guards:** RPCs validate `current_phase` before allowing mutations to prevent out-of-order state transitions.
- **Idempotent UPSERT:** `scripture_lock_in` uses `ON CONFLICT ... DO UPDATE` and `scripture_submit_reflection` uses the same pattern to safely handle duplicate calls.
