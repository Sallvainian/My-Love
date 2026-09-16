-- ============================================
-- pgTAP: exact policy sets for love_notes and users
--
-- Replaces the scripture-only policies_are coverage that lived in
-- 02_rls_policies.sql. Names are the local set after `supabase db reset`
-- with 20260916000000 applied:
--
--   select policyname from pg_policies
--    where tablename in ('love_notes','users')
--    order by tablename, policyname;
--
-- Compared to production on 2026-09-16: same five names, no drift. Do not copy
-- names from migrations: 20251206024345 drops the earlier love_notes policies
-- ("Users can delete/insert/view own notes") at :7-11 before creating the
-- messages generation, so a mid-history CREATE POLICY is not the live set.
-- ============================================

begin;

select plan(23);

select policies_are(
  'public',
  'love_notes',
  array[
    'Users can insert their own messages',
    'Users can view their own messages'
  ],
  'LN-DB-POL: love_notes carries exactly the two expected policies'
);

select policies_are(
  'public',
  'users',
  array[
    'Users can insert own profile',
    'Users can view self and partner profiles',
    'users_update_self_safe'
  ],
  'USR-DB-POL: users carries exactly the three expected policies'
);

-- CAP-2: the drop migration removed these objects. hasnt_* is the
-- inspection the reset itself does not perform.
select hasnt_table('public', 'scripture_messages', 'scripture_messages is gone');
select hasnt_table('public', 'scripture_reflections', 'scripture_reflections is gone');
select hasnt_table('public', 'scripture_bookmarks', 'scripture_bookmarks is gone');
select hasnt_table('public', 'scripture_step_states', 'scripture_step_states is gone');
select hasnt_table('public', 'scripture_sessions', 'scripture_sessions is gone');

select hasnt_function('public', 'is_scripture_session_member', 'is_scripture_session_member is gone');
select hasnt_function('public', 'scripture_seed_test_data', 'scripture_seed_test_data is gone');
select hasnt_function('public', 'scripture_create_session', 'scripture_create_session is gone');
select hasnt_function('public', 'scripture_get_couple_stats', 'scripture_get_couple_stats is gone');
select hasnt_function('public', 'scripture_submit_reflection', 'scripture_submit_reflection is gone');
select hasnt_function('public', 'scripture_select_role', 'scripture_select_role is gone');
select hasnt_function('public', 'scripture_toggle_ready', 'scripture_toggle_ready is gone');
select hasnt_function('public', 'scripture_convert_to_solo', 'scripture_convert_to_solo is gone');
select hasnt_function('public', 'scripture_lock_in', 'scripture_lock_in is gone');
select hasnt_function('public', 'scripture_undo_lock_in', 'scripture_undo_lock_in is gone');
select hasnt_function('public', 'scripture_end_session', 'scripture_end_session is gone');
select hasnt_function('public', 'scripture_sessions_freeze_membership', 'scripture_sessions_freeze_membership is gone');

select hasnt_type('public', 'scripture_session_mode', 'scripture_session_mode is gone');
select hasnt_type('public', 'scripture_session_phase', 'scripture_session_phase is gone');
select hasnt_type('public', 'scripture_session_status', 'scripture_session_status is gone');
select hasnt_type('public', 'scripture_session_role', 'scripture_session_role is gone');

select * from finish();

rollback;
