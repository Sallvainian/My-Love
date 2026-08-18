-- ============================================
-- pgTAP: anon must not reach SECURITY DEFINER functions, and the partner
-- request guards must deny a NULL auth.uid()
--
-- Regression cover for 20260818000000. Both halves matter independently:
--
--   * The grant half is what the Supabase advisor lints 0028/0029 measure. It
--     regresses silently -- DROP FUNCTION + CREATE FUNCTION re-derives the ACL
--     and hands anon EXECUTE back, and nothing else in the suite would fail.
--     20260818000000 cannot prevent that (see its header: the schema-scoped
--     ALTER DEFAULT PRIVILEGES form is a no-op and the global form breaks these
--     very test helpers), so FN-GRANT-002 below IS the regression net. It
--     enumerates rather than naming functions, so a function added later is
--     covered without editing this file.
--   * The guard half is the actual vulnerability. `IF auth.uid() != v_to_user_id`
--     does not fire when auth.uid() is NULL, because NULL != x is NULL and
--     plpgsql treats a NULL condition as false. With that shape restored, an
--     unauthenticated caller could accept a partner request on the victim's
--     behalf and inherit read access to their moods, photos and storage objects.
--     These tests call the functions with the role left at postgres and only the
--     JWT claims cleared, so the guard is exercised even if the grant is loose.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(21);

create or replace function tests.create_test_user(test_email text default 'test@example.com')
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  return user_id;
end; $$;

create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', test_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
end; $$;

-- Clears the JWT only, leaving the database role alone, so auth.uid() is NULL
-- while the caller still holds EXECUTE. That isolates the in-function guard from
-- the grant; tests.reset_role() in the other files would conflate the two.
create or replace function tests.clear_jwt()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
end; $$;

-- ============================================
-- Part 1: EXECUTE privileges (lints 0028 / 0029)
-- ============================================

-- anon must not hold EXECUTE on any SECURITY DEFINER function in public.
select is(
  (
    select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.proname), '')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  '',
  'FN-GRANT-001: no SECURITY DEFINER function in public is executable by anon'
);

-- Same for every other function in public, SECURITY INVOKER included: they are
-- all reachable at /rest/v1/rpc/<name> and none is a public endpoint.
select is(
  (
    select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.proname), '')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  '',
  'FN-GRANT-002: no function in public is executable by anon'
);

-- The test seeder writes rows for arbitrary user ids and validates only that
-- they exist, so it must stay off the end-user API surface entirely (lint 0029).
select ok(
  not has_function_privilege('authenticated', 'public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)', 'EXECUTE'),
  'FN-GRANT-003: scripture_seed_test_data is not executable by authenticated'
);

select ok(
  has_function_privilege('service_role', 'public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)', 'EXECUTE'),
  'FN-GRANT-004: scripture_seed_test_data is still executable by service_role'
);

-- The set of functions `authenticated` may call, pinned exactly. A per-function
-- ok() cannot catch a function that GAINS a grant it should not have, and that
-- is the failure mode that actually happened: applying only the anon/PUBLIC
-- revokes left scripture_seed_test_data callable by authenticated on the hosted
-- project, because hosted's default ACL grants authenticated explicitly while
-- local's does not. This assertion goes red on a missing or an extra grant.
--
-- The list is the LOCAL set. The hosted project also has get_random_daily_message,
-- which no migration in this repo creates -- it is drift, nothing calls it, and it
-- is left executable by authenticated because that is its pre-existing behaviour.
-- This file only ever runs against a stack built from these migrations, so the
-- extra function cannot appear here; if it ever does, that means the drift got
-- committed and this list should grow with it.
select is(
  (
    select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'accept_partner_request, decline_partner_request, get_my_partner_id, '
  || 'is_scripture_session_member, scripture_convert_to_solo, scripture_create_session, '
  || 'scripture_end_session, scripture_get_couple_stats, scripture_lock_in, '
  || 'scripture_select_role, scripture_submit_reflection, scripture_toggle_ready, '
  || 'scripture_undo_lock_in',
  'FN-GRANT-008: authenticated holds EXECUTE on exactly the app RPCs'
);

select ok(
  not has_function_privilege('authenticated', 'public.sync_user_profile()', 'EXECUTE'),
  'FN-GRANT-009: sync_user_profile is not executable by authenticated'
);

-- Revoking PUBLIC strips the implicit grant these rode on, so the explicit
-- authenticated grants are load-bearing. Without them the partner buttons and
-- every scripture read return 42501.
select ok(
  has_function_privilege('authenticated', 'public.accept_partner_request(uuid)', 'EXECUTE'),
  'FN-GRANT-005: accept_partner_request is executable by authenticated'
);

select ok(
  has_function_privilege('authenticated', 'public.decline_partner_request(uuid)', 'EXECUTE'),
  'FN-GRANT-006: decline_partner_request is executable by authenticated'
);

-- Called from nine RLS policies that are declared TO public, so it executes as
-- the invoking role. Losing this grant breaks every authenticated read of
-- scripture_step_states, scripture_reflections, scripture_bookmarks and
-- scripture_messages.
select ok(
  has_function_privilege('authenticated', 'public.is_scripture_session_member(uuid)', 'EXECUTE'),
  'FN-GRANT-007: is_scripture_session_member is executable by authenticated'
);

-- ============================================
-- Part 2: the guards themselves
-- ============================================

create temporary table t_ids as
select
  tests.create_test_user('fn-grants-sender@example.com') as sender_id,
  tests.create_test_user('fn-grants-sender2@example.com') as sender2_id,
  tests.create_test_user('fn-grants-recipient@example.com') as recipient_id,
  tests.create_test_user('fn-grants-outsider@example.com') as outsider_id;

-- The later assertions read t_ids after tests.authenticate_as has switched the
-- role away from postgres, so the temp table needs its own grant.
grant select on t_ids to authenticated, anon;

insert into public.users (id, email, display_name)
select sender_id, 'fn-grants-sender@example.com', 'Sender' from t_ids
on conflict (id) do nothing;
insert into public.users (id, email, display_name)
select sender2_id, 'fn-grants-sender2@example.com', 'Sender Two' from t_ids
on conflict (id) do nothing;
insert into public.users (id, email, display_name)
select recipient_id, 'fn-grants-recipient@example.com', 'Recipient' from t_ids
on conflict (id) do nothing;
insert into public.users (id, email, display_name)
select outsider_id, 'fn-grants-outsider@example.com', 'Outsider' from t_ids
on conflict (id) do nothing;

-- Two senders, because idx_partner_requests_unique forbids a second pending
-- request between the same pair.
insert into public.partner_requests (id, from_user_id, to_user_id, status)
select '77777777-0000-0000-0000-000000000001', sender_id, recipient_id, 'pending' from t_ids;
insert into public.partner_requests (id, from_user_id, to_user_id, status)
select '77777777-0000-0000-0000-000000000002', sender2_id, recipient_id, 'pending' from t_ids;

-- accept: a NULL auth.uid() must be denied, not fall through the != guard.
select tests.clear_jwt();
select throws_ok(
  $$select public.accept_partner_request('77777777-0000-0000-0000-000000000001')$$,
  'Authentication required',
  'FN-GUARD-001: accept_partner_request rejects a NULL auth.uid()'
);

-- and the link must not have been created.
select is(
  (select partner_id from public.users where id = (select recipient_id from t_ids)),
  null,
  'FN-GUARD-002: no partner link was created by the unauthenticated accept'
);

select is(
  (select status from public.partner_requests where id = '77777777-0000-0000-0000-000000000001'),
  'pending',
  'FN-GUARD-003: the request is still pending after the unauthenticated accept'
);

-- decline: same.
select throws_ok(
  $$select public.decline_partner_request('77777777-0000-0000-0000-000000000002')$$,
  'Authentication required',
  'FN-GUARD-004: decline_partner_request rejects a NULL auth.uid()'
);

select is(
  (select status from public.partner_requests where id = '77777777-0000-0000-0000-000000000002'),
  'pending',
  'FN-GUARD-005: the request is still pending after the unauthenticated decline'
);

-- A signed-in non-recipient must still be rejected -- the guard has to deny the
-- wrong user as well as the missing one.
select tests.authenticate_as((select outsider_id from t_ids));
select throws_ok(
  $$select public.accept_partner_request('77777777-0000-0000-0000-000000000001')$$,
  'Only the recipient can accept a partner request',
  'FN-GUARD-006: accept_partner_request rejects a signed-in non-recipient'
);

-- ============================================
-- Part 3: the signed-in path to the same forged link
-- ============================================
-- Repairing the NULL guard only stops an anonymous caller. The recipient of a
-- request used to be able to rewrite its from_user_id to an arbitrary victim and
-- then accept it legitimately, because the UPDATE policy had no WITH CHECK and
-- Postgres reuses USING, which constrains to_user_id only. 20260818000000 drops
-- that policy and revokes UPDATE; these pin both halves.

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'partner_requests' and cmd = 'UPDATE'
  ),
  'FN-REQ-001: partner_requests has no UPDATE policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.partner_requests', 'UPDATE'),
  'FN-REQ-002: authenticated cannot UPDATE partner_requests'
);

select ok(
  not has_table_privilege('anon', 'public.partner_requests', 'UPDATE'),
  'FN-REQ-003: anon cannot UPDATE partner_requests'
);

-- The attack itself: the recipient tries to repoint the request at a stranger.
select tests.authenticate_as((select recipient_id from t_ids));
select throws_ok(
  $$update public.partner_requests
      set from_user_id = (select outsider_id from t_ids)
    where id = '77777777-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table partner_requests',
  'FN-REQ-004: the recipient cannot rewrite from_user_id to a third party'
);

-- The real recipient still works, so the fix did not just deny everything.
select tests.authenticate_as((select recipient_id from t_ids));
select lives_ok(
  $$select public.accept_partner_request('77777777-0000-0000-0000-000000000001')$$,
  'FN-GUARD-007: accept_partner_request still succeeds for the recipient'
);

-- ...and it wrote through the SECURITY DEFINER path despite the table-level
-- revoke, which is the property that makes dropping the write path safe.
select is(
  (select partner_id from public.users where id = (select recipient_id from t_ids)),
  (select sender_id from t_ids),
  'FN-GUARD-008: the accepted link points at the original sender'
);

select * from finish();
rollback;
