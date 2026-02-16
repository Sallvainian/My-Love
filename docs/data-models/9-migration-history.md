# 9. Migration History

Migrations are stored in `supabase/migrations/` and applied in filename-sorted order.

| Migration | Date | Description |
|---|---|---|
| `20251203000001_create_base_schema.sql` | 2025-12-03 | Core tables: `users`, `moods`, `love_notes`, `interactions`, `partner_requests`. Enum types. `accept_partner_request` RPC. `get_partner_id` helper. Initial RLS policies. |
| `20251203190800_create_photos_table.sql` | 2025-12-03 | `photos` metadata table. `photos` storage bucket (10 MB limit, private). Photo RLS policies for table and storage. |
| `20251205000001_add_love_notes_images.sql` | 2025-12-05 | Added `image_url` column to `love_notes`. `love-notes-images` storage bucket. Storage RLS for image uploads and partner reads. |
| `20251205000002_add_mime_validation.sql` | 2025-12-05 | Replaced love note image upload policy to add file extension validation (`jpg`, `jpeg`, `png`, `webp`). |
| `20251206024345_remote_schema.sql` | 2025-12-06 | Large schema sync from remote. Dropped enum types, replaced with TEXT + CHECK constraints. Added `sync_user_profile` trigger. Added `decline_partner_request` RPC. Rewrote `accept_partner_request` with partner-exists guard. Replaced all RLS policies. Added new indexes (`idx_interactions_from_user`, `idx_interactions_to_user_viewed`, `idx_love_notes_from_user_created`, `idx_love_notes_to_user_created`, `idx_partner_requests_to_user_pending`, `idx_partner_requests_unique`, `idx_users_display_name_search`, `idx_users_email_search`, `idx_users_partner`). Added `different_users` check on `love_notes`, `no_self_requests` check on `partner_requests`. Changed `moods.note` limit from 200 to 500. Changed `moods.user_id` FK target from `auth.users` to `users`. Set `device_id` default to `gen_random_uuid()`. |
| `20251206124803_fix_users_rls_policy.sql` | 2025-12-06 | Replaced overly permissive "Authenticated users can read all users" policy with scoped "Users can view self and partner profiles". |
| `20251206200000_fix_users_update_privilege_escalation.sql` | 2025-12-06 | P0 security fix. Replaced `users_update_self` with `users_update_self_safe` to prevent `partner_id` manipulation for profile snooping. |
| `20260128000001_scripture_reading.sql` | 2026-01-28 | Scripture reading feature tables: `scripture_sessions`, `scripture_step_states`, `scripture_reflections`, `scripture_bookmarks`, `scripture_messages`. Three new enum types. `is_scripture_session_member` helper. Full RLS policies. `scripture_seed_test_data` RPC. |
| `20260130000001_scripture_rpcs.sql` | 2026-01-30 | Fixed `scripture_seed_test_data` variable reuse bug (`v_session_id` overwrite). Added `scripture_create_session` and `scripture_submit_reflection` RPCs. |
| `20260204000001_unlinked_preset.sql` | 2026-02-04 | Added `'unlinked'` preset to `scripture_seed_test_data` RPC. Creates solo sessions with `user2_id = NULL` for testing unlinked user flows in Story 2.3 (Daily Prayer Report). Also adds `v_temp_id` variable to fix `v_session_id` overwrite in reflection/message sub-inserts. |
| `20260205000001_fix_users_rls_recursion.sql` | 2026-02-05 | Fixed infinite RLS recursion on `users` table (PostgreSQL error 42P17). Created `get_my_partner_id()` SECURITY DEFINER helper function that reads `partner_id` bypassing RLS. Replaced both SELECT and UPDATE policies on `users` to call `get_my_partner_id()` instead of querying `public.users` directly. |
| `20260206000001_enable_pgtap.sql` | 2026-02-06 | Enabled `pgtap` extension in the `extensions` schema for database-level testing via `supabase test db`. |
