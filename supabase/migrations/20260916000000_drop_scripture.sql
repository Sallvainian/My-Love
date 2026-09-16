-- Forward drop of the scripture reading schema (CAP-2).
--
-- Creating migrations stay on disk: 20260818000000:271-294 issues GRANT EXECUTE
-- on these functions, so a reset that skipped the creators would fail 42883
-- before this file ran. Replay creates the objects, then this drops them.
--
-- DROP TABLE does not remove the four realtime.messages policies; those are
-- dropped first. is_scripture_session_member is referenced by RLS policies on
-- the scripture tables, so CASCADE on that one DROP FUNCTION removes those
-- policies only -- they would die with the tables below. It does not touch
-- public.users, public.partner_requests, get_my_partner_id(),
-- accept_partner_request, or decline_partner_request.
--
-- Table drops are child-to-parent with no CASCADE, so they cannot reach
-- public.users. Signatures match the GRANT block at 20260818000000:271-294.

begin;

-- 1. realtime.messages policies (not owned by the scripture tables)
drop policy if exists "scripture_session_members_can_receive_broadcasts"
  on realtime.messages;
drop policy if exists "scripture_session_members_can_send_broadcasts"
  on realtime.messages;
drop policy if exists "scripture_presence_members_can_receive_broadcasts"
  on realtime.messages;
drop policy if exists "scripture_presence_members_can_send_broadcasts"
  on realtime.messages;

-- 2. Trigger, then its function (not in the GRANT block)
drop trigger if exists scripture_sessions_freeze_membership
  on public.scripture_sessions;
drop function if exists public.scripture_sessions_freeze_membership();

-- 3. Functions, GRANT signatures
drop function if exists public.is_scripture_session_member(uuid) cascade;
drop function if exists public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid);
drop function if exists public.scripture_create_session(text, uuid);
drop function if exists public.scripture_get_couple_stats();
drop function if exists public.scripture_submit_reflection(uuid, int, int, text, boolean);
drop function if exists public.scripture_select_role(uuid, text);
drop function if exists public.scripture_toggle_ready(uuid, boolean);
drop function if exists public.scripture_convert_to_solo(uuid);
drop function if exists public.scripture_lock_in(uuid, int, int);
drop function if exists public.scripture_undo_lock_in(uuid, int);
drop function if exists public.scripture_end_session(uuid);

-- 4. Tables, child → parent
drop table if exists public.scripture_messages;
drop table if exists public.scripture_reflections;
drop table if exists public.scripture_bookmarks;
drop table if exists public.scripture_step_states;
drop table if exists public.scripture_sessions;

-- 5. Enums
drop type if exists public.scripture_session_mode;
drop type if exists public.scripture_session_phase;
drop type if exists public.scripture_session_status;
drop type if exists public.scripture_session_role;

commit;
