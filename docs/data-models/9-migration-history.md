# 9. Migration History

All migrations in `supabase/migrations/`, applied in filename-sorted order via `supabase db reset`.

## Migration Index (24 files)

| #   | Timestamp      | Name                                        | Summary                                                                                                                                                                                                         |
| --- | -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 20251203000001 | create_base_schema                          | users, moods, love_notes, interactions, partner_requests tables + RLS + accept_partner_request RPC                                                                                                              |
| 2   | 20251203190800 | create_photos_table                         | photos table + photos storage bucket + storage RLS policies                                                                                                                                                     |
| 3   | 20251205000001 | add_love_notes_images                       | image_url column on love_notes + love-notes-images storage bucket + storage RLS                                                                                                                                 |
| 4   | 20251205000002 | add_mime_validation                         | Recreate upload policy with file extension validation (jpg/jpeg/png/webp)                                                                                                                                       |
| 5   | 20251206024345 | remote_schema                               | Major refactor: drop enums (mood_type, interaction_type, partner_request_status) to TEXT with CHECK constraints; new indexes; decline_partner_request RPC; sync_user_profile trigger; recreate all RLS policies |
| 6   | 20251206124803 | fix_users_rls_policy                        | Replace overly permissive "read all users" policy with scoped self+partner policy                                                                                                                               |
| 7   | 20251206200000 | fix_users_update_privilege_escalation       | P0 security: prevent partner_id manipulation in UPDATE policy                                                                                                                                                   |
| 8   | 20260128000001 | scripture_reading                           | Scripture tables (sessions, step_states, reflections, bookmarks, messages) + enums + RLS + is_scripture_session_member helper + seed RPC                                                                        |
| 9   | 20260130000001 | scripture_rpcs                              | Fix seed RPC variable bug + scripture_create_session + scripture_submit_reflection RPCs                                                                                                                         |
| 10  | 20260204000001 | unlinked_preset                             | Add 'unlinked' preset to seed function for solo E2E tests                                                                                                                                                       |
| 11  | 20260205000001 | fix_users_rls_recursion                     | get_my_partner_id() SECURITY DEFINER helper; rewrite SELECT/UPDATE policies to break recursion                                                                                                                  |
| 12  | 20260206000001 | enable_pgtap                                | Enable pgTAP extension for database-level testing                                                                                                                                                               |
| 13  | 20260217150353 | scripture_couple_stats                      | scripture_get_couple_stats RPC + idx_scripture_sessions_status index                                                                                                                                            |
| 14  | 20260217184551 | optimize_couple_stats_rpc                   | CTE-based single-query optimization (4 queries -> 1)                                                                                                                                                            |
| 15  | 20260220000001 | scripture_lobby_and_roles                   | scripture_session_role enum; user1/2_role, user1/2_ready, countdown_started_at columns; realtime.messages RLS; scripture_select_role, scripture_toggle_ready, scripture_convert_to_solo RPCs                    |
| 16  | 20260221000001 | fix_function_search_paths                   | Add `SET search_path = ''` to SECURITY DEFINER functions (security fix from Supabase advisor)                                                                                                                   |
| 17  | 20260221211137 | scripture_lobby_phase_guards                | Add lobby-phase guards to select_role, toggle_ready, convert_to_solo RPCs                                                                                                                                       |
| 18  | 20260222000001 | scripture_lock_in                           | scripture_lock_in + scripture_undo_lock_in RPCs; presence channel RLS policies                                                                                                                                  |
| 19  | 20260228000001 | scripture_end_session                       | 'ended_early' status enum value + scripture_end_session RPC                                                                                                                                                     |
| 20  | 20260301000100 | fix_scripture_create_session_together_lobby | Together sessions start in lobby (not reading); reuse existing in-progress lobby sessions                                                                                                                       |
| 21  | 20260301000200 | remove_server_side_broadcasts               | Remove all `realtime.send()` from RPCs; client broadcasts instead                                                                                                                                               |
| 22  | 20260309000001 | at_reflection_preset                        | Add 'at_reflection' preset + p_bookmark_steps parameter to seed function                                                                                                                                        |
| 23  | 20260313000001 | fix_lock_in_last_step                       | Last step (16) transitions to reflection but keeps status='in_progress' (was incorrectly setting 'complete')                                                                                                    |
| 24  | 20260315044923 | fix_avg_rating_precision                    | Change `round(v_avg_rating, 2)` to `round(v_avg_rating, 1)` in scripture_get_couple_stats                                                                                                                       |

## Key Patterns

### Enum Evolution

Migrations 1 created PostgreSQL enums. Migration 5 dropped them in favor of TEXT + CHECK constraints for easier evolution. Scripture enums (migrations 8, 15, 19) remain as native PG enums.

### Security Fixes

- Migration 6: Fixed overly permissive "read all users" SELECT policy
- Migration 7: Fixed partner_id privilege escalation (P0 security)
- Migration 11: Fixed infinite RLS recursion with SECURITY DEFINER helper
- Migration 16: Added `SET search_path = ''` to all SECURITY DEFINER functions

### Realtime Architecture

- Migration 15: Added server-side `realtime.send()` broadcasts in RPCs
- Migration 21: Removed all server-side broadcasts (Docker Realtime has no replication slot); client-side `channel.send()` used instead

### Scripture Session Lifecycle

- Migration 20: Together sessions start in lobby (not reading); reuses existing sessions
- Migration 23: Last step keeps status='in_progress' through reflection/report; completion is client-driven
