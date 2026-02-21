-- ============================================
-- pgTAP Tests: Scripture Lobby RPCs
-- Story 4.1: Lobby, Role Selection & Countdown
-- Tests: 4.1-DB-001, 4.1-DB-002, 4.1-DB-003, 4.1-DB-004
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(6);

-- ============================================
-- Helpers (re-create in each file — each runs in its own transaction)
-- ============================================

create or replace function tests.create_test_user(test_email text default 'test@example.com')
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (
    id, instance_id, email, encrypted_password, aud, role,
    email_confirmed_at, created_at, updated_at, confirmation_token
  ) values (
    user_id, '00000000-0000-0000-0000-000000000000', test_email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    'authenticated', 'authenticated', now(), now(), now(), ''
  );
  return user_id;
end; $$;

create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
end; $$;

-- Admin helper: insert session bypassing RLS
create or replace function tests.create_session_as_admin(
  p_user1_id uuid,
  p_user2_id uuid default null,
  p_mode text default 'together',
  p_status text default 'pending',
  p_phase text default 'lobby'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  insert into public.scripture_sessions (
    mode, user1_id, user2_id, current_phase,
    current_step_index, status, version, started_at
  ) values (
    p_mode::public.scripture_session_mode,
    p_user1_id,
    p_user2_id,
    p_phase::public.scripture_session_phase,
    0,
    p_status::public.scripture_session_status,
    1,
    now()
  ) returning id into v_session_id;
  return v_session_id;
end; $$;

-- ============================================
-- Setup: Create test users and sessions
-- ============================================
do $$
declare
  v_user1 uuid;
  v_user2 uuid;
  v_user3 uuid;
  v_session_role  uuid; -- Used for DB-001 and DB-004
  v_session_ready uuid; -- Fresh session for DB-002 (both ready)
  v_session_partial uuid; -- Fresh session for DB-003 (partial ready)
begin
  v_user1 := tests.create_test_user('lobby_user1@test.com');
  v_user2 := tests.create_test_user('lobby_user2@test.com');
  v_user3 := tests.create_test_user('lobby_user3_nonmember@test.com');

  -- pgTAP epicrule: couple FK must be set for multi-user security tests to be meaningful
  update public.users set partner_id = v_user2 where id = v_user1;
  update public.users set partner_id = v_user1 where id = v_user2;

  -- Session for DB-001 role assignment test
  v_session_role := tests.create_session_as_admin(v_user1, v_user2);
  -- Session for DB-002 both-ready countdown test
  v_session_ready := tests.create_session_as_admin(v_user1, v_user2);
  -- Session for DB-003 partial-ready (no countdown) test
  v_session_partial := tests.create_session_as_admin(v_user1, v_user2);

  perform set_config('tests.user1', v_user1::text, true);
  perform set_config('tests.user2', v_user2::text, true);
  perform set_config('tests.user3', v_user3::text, true);
  perform set_config('tests.session_role', v_session_role::text, true);
  perform set_config('tests.session_ready', v_session_ready::text, true);
  perform set_config('tests.session_partial', v_session_partial::text, true);
end;
$$;

-- ============================================
-- 4.1-DB-001: Role assignment
-- user1 selects 'reader' → user1_role=reader persisted, user2_role remains null
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);

do $$
begin
  perform public.scripture_select_role(
    current_setting('tests.session_role')::uuid,
    'reader'
  );
end;
$$;

select is(
  (select user1_role::text from public.scripture_sessions
   where id = current_setting('tests.session_role')::uuid),
  'reader',
  '4.1-DB-001: user1_role is reader after scripture_select_role'
);

select is(
  (select user2_role from public.scripture_sessions
   where id = current_setting('tests.session_role')::uuid),
  null::public.scripture_session_role,
  '4.1-DB-001: user2_role remains null when only user1 has selected a role'
);

-- ============================================
-- 4.1-DB-002: Both users ready → countdown_started_at set, phase=countdown
-- ============================================

-- user1 marks ready
select tests.authenticate_as(current_setting('tests.user1')::uuid);
do $$
begin
  perform public.scripture_toggle_ready(
    current_setting('tests.session_ready')::uuid,
    true
  );
end;
$$;

-- user2 marks ready → should trigger countdown
select tests.authenticate_as(current_setting('tests.user2')::uuid);
do $$
begin
  perform public.scripture_toggle_ready(
    current_setting('tests.session_ready')::uuid,
    true
  );
end;
$$;

select isnt(
  (select countdown_started_at from public.scripture_sessions
   where id = current_setting('tests.session_ready')::uuid),
  null::timestamptz,
  '4.1-DB-002: countdown_started_at is set when both users are ready'
);

select is(
  (select current_phase::text from public.scripture_sessions
   where id = current_setting('tests.session_ready')::uuid),
  'countdown',
  '4.1-DB-002: current_phase transitions to countdown when both users ready'
);

-- ============================================
-- 4.1-DB-003: Only user1 ready → countdown NOT triggered
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);
do $$
begin
  perform public.scripture_toggle_ready(
    current_setting('tests.session_partial')::uuid,
    true
  );
end;
$$;

select is(
  (select countdown_started_at from public.scripture_sessions
   where id = current_setting('tests.session_partial')::uuid),
  null::timestamptz,
  '4.1-DB-003: countdown_started_at remains null when only user1 is ready'
);

-- ============================================
-- 4.1-DB-004: RLS security — non-member cannot call scripture_select_role
-- user3 is not in the session → RPC should raise an exception
-- ============================================

select tests.authenticate_as(current_setting('tests.user3')::uuid);

select throws_ok(
  format(
    'select public.scripture_select_role(%L::uuid, %L)',
    current_setting('tests.session_role'),
    'responder'
  ),
  null,
  null,
  '4.1-DB-004: non-member user3 cannot call scripture_select_role on another user session'
);

select * from finish();
rollback;
