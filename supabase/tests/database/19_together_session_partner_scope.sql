-- ============================================
-- pgTAP: a `together` session can only name the caller's real partner, and the
-- test seeder refuses an end-user role even if its EXECUTE grant comes back
--
-- Regression cover for 20260818000001. Three separate things are pinned here,
-- because each failed independently before that migration:
--
--   * scripture_create_session accepted ANY auth.users id as p_partner_id, so a
--     stranger could open a together session with a victim. Both rows then pass
--     is_scripture_session_member, which is what scripture_messages_select keys
--     on -- a two-way message channel the victim never agreed to.
--   * Guarding only the RPC was not enough. `authenticated` holds a direct
--     INSERT grant on scripture_sessions and the insert policy checked only
--     user1_id, so a client could skip the RPC and insert the same row by hand.
--   * scripture_seed_test_data's in-body guard read a GUC that is set nowhere,
--     so it never fired. The grant is what protects it today; this proves the
--     body now refuses on its own, which is what makes a future ACL regression
--     survivable.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(15);

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

-- A linked couple (A <-> B) and an unrelated third party (C).
create temporary table t as
select
  tests.create_test_user('together_scope_a@test.com') as a,
  tests.create_test_user('together_scope_b@test.com') as b,
  tests.create_test_user('together_scope_c@test.com') as c;

grant select on t to authenticated, anon;

update public.users set partner_id = (select b from t) where id = (select a from t);
update public.users set partner_id = (select a from t) where id = (select b from t);

-- ============================================
-- Part 1: the RPC
-- ============================================

select tests.authenticate_as((select a from t));

-- The legitimate case still works, so the guard is not just denying everything.
select lives_ok(
  $$select public.scripture_create_session('together', (select b from t))$$,
  'TS-001: a user can start a together session with their linked partner'
);

select tests.authenticate_as((select a from t));
select throws_ok(
  $$select public.scripture_create_session('together', (select c from t))$$,
  '42501',
  'Together mode requires your linked partner.',
  'TS-002: a user cannot start a together session with a stranger'
);

-- An unpartnered caller reads NULL from get_my_partner_id and must be denied,
-- not fall through a NULL comparison.
select tests.authenticate_as((select c from t));
select throws_ok(
  $$select public.scripture_create_session('together', (select a from t))$$,
  '42501',
  'Together mode requires your linked partner.',
  'TS-003: an unpartnered user cannot start a together session at all'
);

-- Solo is unaffected -- it never reads partner_id.
select tests.authenticate_as((select c from t));
select lives_ok(
  $$select public.scripture_create_session('solo')$$,
  'TS-004: solo sessions still work for an unpartnered user'
);

-- ============================================
-- Part 2: the direct-INSERT path around the RPC
-- ============================================

select tests.authenticate_as((select c from t));
select throws_ok(
  format(
    $$insert into public.scripture_sessions
        (mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at)
      values ('together', %L, %L, 'lobby', 0, 'in_progress', 1, now())$$,
    (select c from t), (select a from t)
  ),
  '42501',
  'new row violates row-level security policy for table "scripture_sessions"',
  'TS-005: a stranger cannot hand-insert a together session naming a victim'
);

select tests.authenticate_as((select a from t));
select lives_ok(
  format(
    $$insert into public.scripture_sessions
        (mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at)
      values ('together', %L, %L, 'lobby', 0, 'in_progress', 1, now())$$,
    (select a from t), (select b from t)
  ),
  'TS-006: a real couple can still insert a together session directly'
);

-- ============================================
-- Part 2b: the UPDATE path around both the RPC and the insert policy
-- ============================================
-- Create a solo session (needs no partner), then try to repoint it at a victim.
-- The insert policy cannot stop this and the update policy has no WITH CHECK,
-- so the BEFORE UPDATE trigger is what has to hold.
select tests.authenticate_as((select c from t));
select lives_ok(
  $$select public.scripture_create_session('solo')$$,
  'TS-009: an unpartnered user can still create a solo session'
);

select tests.authenticate_as((select c from t));
select throws_ok(
  format(
    $$update public.scripture_sessions
         set mode = 'together', user2_id = %L
       where user1_id = %L and mode = 'solo'$$,
    (select a from t), (select c from t)
  ),
  '42501',
  'scripture_sessions.user2_id cannot be reassigned',
  'TS-010: a solo session cannot be repointed at a stranger as user2_id'
);

-- user1_id must not move either -- that would hand the row to someone else.
select tests.authenticate_as((select c from t));
select throws_ok(
  format(
    $$update public.scripture_sessions set user1_id = %L where user1_id = %L$$,
    (select a from t), (select c from t)
  ),
  '42501',
  'scripture_sessions.user1_id is immutable',
  'TS-011: user1_id cannot be reassigned'
);

-- scripture_convert_to_solo legitimately clears user2_id, so NULL must pass.
select tests.authenticate_as((select a from t));
select lives_ok(
  format(
    $$update public.scripture_sessions
         set mode = 'solo', user2_id = null
       where user1_id = %L and user2_id = %L$$,
    (select a from t), (select b from t)
  ),
  'TS-012: clearing user2_id still works (scripture_convert_to_solo path)'
);

-- ============================================
-- Part 2c: repointing a child row into someone else's session
-- ============================================
-- The reflections/bookmarks INSERT policies check session membership; their
-- UPDATE policies did not, so an attacker could write a row in their own session
-- and then move it into a victim's. Only the UPDATE side is pinned here -- the
-- INSERT side is already covered by 02_rls_policies.sql.
select set_config('role', 'none', true);

insert into public.scripture_sessions (id, mode, user1_id, current_phase, current_step_index, status, version, started_at)
select '99999999-0000-0000-0000-000000000001', 'solo', c, 'reading', 0, 'in_progress', 1, now() from t;
insert into public.scripture_sessions (id, mode, user1_id, current_phase, current_step_index, status, version, started_at)
select '99999999-0000-0000-0000-000000000002', 'solo', a, 'reading', 0, 'in_progress', 1, now() from t;

insert into public.scripture_reflections (session_id, step_index, user_id, rating, notes, is_shared)
select '99999999-0000-0000-0000-000000000002', 0, a, 5, 'attacker text', true from t;
insert into public.scripture_bookmarks (session_id, step_index, user_id, share_with_partner)
select '99999999-0000-0000-0000-000000000002', 0, a, true from t;

select tests.authenticate_as((select a from t));
select throws_ok(
  $$update public.scripture_reflections
       set session_id = '99999999-0000-0000-0000-000000000001'
     where notes = 'attacker text'$$,
  '42501',
  'new row violates row-level security policy for table "scripture_reflections"',
  'TS-013: a reflection cannot be repointed into a session the author is not in'
);

select tests.authenticate_as((select a from t));
select throws_ok(
  $$update public.scripture_bookmarks
       set session_id = '99999999-0000-0000-0000-000000000001'
     where session_id = '99999999-0000-0000-0000-000000000002'$$,
  '42501',
  'new row violates row-level security policy for table "scripture_bookmarks"',
  'TS-014: a bookmark cannot be repointed into a session the author is not in'
);

-- The ordinary edit-my-own-reflection path must still work.
select tests.authenticate_as((select a from t));
select lives_ok(
  $$update public.scripture_reflections
       set notes = 'edited in place', rating = 4
     where notes = 'attacker text'$$,
  'TS-015: a user can still edit their own reflection inside their own session'
);

-- ============================================
-- Part 3: the seeder guard, independent of its grant
-- ============================================
-- FN-GRANT-003 in 18_function_execute_grants.sql proves the grant is right
-- today. This proves the body refuses on its own, so restoring the grant is not
-- immediately exploitable -- exactly what the old app.environment check failed
-- to do.
savepoint seeder_probe;

-- Back to the owning role first: the assertions above left the session as
-- `authenticated`, and a GRANT issued by a non-owner is a no-op with only a
-- warning, which would make this test pass for the wrong reason (the caller
-- would be blocked by the missing grant, not by the guard being tested).
select set_config('role', 'none', true);

grant execute on function public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)
  to authenticated;

select tests.authenticate_as((select c from t));
select throws_ok(
  format(
    $$select public.scripture_seed_test_data(1, false, false, null, null, %L, %L)$$,
    (select a from t), (select b from t)
  ),
  '42501',
  'scripture_seed_test_data is not callable by role authenticated',
  'TS-007: the seeder refuses an authenticated caller even with EXECUTE granted'
);

rollback to seeder_probe;

-- ...and still works for a trusted caller. 'none' is the role GUC's DEFAULT
-- value, not an absence, so this restores the psql / migration / pgTAP position.
-- The guard trusts 'none' only when session_user is an admin login, which it is
-- here (postgres); a PostgREST request reaching 'none' has session_user
-- 'authenticator' and is refused.
select set_config('role', 'none', true);
select set_config('request.jwt.claims', '', true);
select lives_ok(
  format(
    $$select public.scripture_seed_test_data(1, false, false, null, null, %L, %L)$$,
    (select a from t), (select b from t)
  ),
  'TS-008: the seeder still runs for a trusted caller'
);

select * from finish();
rollback;
