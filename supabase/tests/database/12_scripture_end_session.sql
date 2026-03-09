-- ============================================
-- pgTAP Tests: Scripture End Session RPC
-- Story 4.3: Reconnection & Graceful Degradation
-- Tests: 4.3-DB-001 through 4.3-DB-004
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(4);

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
  p_status text default 'in_progress',
  p_phase text default 'reading'
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
    3,
    p_status::public.scripture_session_status,
    5,
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
  v_session_u1     uuid; -- For DB-001: user1 ends session
  v_session_u2     uuid; -- For DB-002: user2 ends session
  v_session_nonmem uuid; -- For DB-003: non-member attempt
  v_session_done   uuid; -- For DB-004: already-completed session
begin
  v_user1 := tests.create_test_user('endsession_user1@test.com');
  v_user2 := tests.create_test_user('endsession_user2@test.com');
  v_user3 := tests.create_test_user('endsession_nonmember@test.com');

  -- CRITICAL: Set partner_id for couple FK relationship (Epic 3 retro rule)
  update public.users set partner_id = v_user2 where id = v_user1;
  update public.users set partner_id = v_user1 where id = v_user2;

  -- Sessions
  v_session_u1     := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_u2     := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_nonmem := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_done   := tests.create_session_as_admin(v_user1, v_user2, 'together', 'complete', 'reading');

  -- Store IDs for tests
  perform set_config('test.user1_id', v_user1::text, true);
  perform set_config('test.user2_id', v_user2::text, true);
  perform set_config('test.user3_id', v_user3::text, true);
  perform set_config('test.session_u1', v_session_u1::text, true);
  perform set_config('test.session_u2', v_session_u2::text, true);
  perform set_config('test.session_nonmem', v_session_nonmem::text, true);
  perform set_config('test.session_done', v_session_done::text, true);
end; $$;

-- ============================================
-- 4.3-DB-001: End session — caller is user1
-- ============================================
select tests.authenticate_as(current_setting('test.user1_id')::uuid);

do $$
begin
  perform public.scripture_end_session(
    current_setting('test.session_u1')::uuid
  );
end;
$$;

select ok(
  (
    select
      status = 'ended_early'::public.scripture_session_status
      and completed_at is not null
      and snapshot_json->>'triggeredBy' = 'end_session'
    from public.scripture_sessions
    where id = current_setting('test.session_u1')::uuid
  ),
  '4.3-DB-001: user1 can end session — status=ended_early and completion metadata persisted'
);

-- ============================================
-- 4.3-DB-002: End session — caller is user2
-- ============================================
select tests.authenticate_as(current_setting('test.user2_id')::uuid);

do $$
begin
  perform public.scripture_end_session(
    current_setting('test.session_u2')::uuid
  );
end;
$$;

select ok(
  (
    select
      status = 'ended_early'::public.scripture_session_status
      and completed_at is not null
      and snapshot_json->>'currentPhase' = 'complete'
    from public.scripture_sessions
    where id = current_setting('test.session_u2')::uuid
  ),
  '4.3-DB-002: user2 can end session — status=ended_early and phase set to complete'
);

-- ============================================
-- 4.3-DB-003: RLS security — non-member cannot end session
-- ============================================
select tests.authenticate_as(current_setting('test.user3_id')::uuid);

select throws_ok(
  format(
    'select public.scripture_end_session(%L::uuid)',
    current_setting('test.session_nonmem')
  ),
  null,
  null,
  '4.3-DB-003: non-member cannot call scripture_end_session'
);

-- ============================================
-- 4.3-DB-004: Cannot end already-completed session
-- ============================================
select tests.authenticate_as(current_setting('test.user1_id')::uuid);

select throws_ok(
  format(
    'select public.scripture_end_session(%L::uuid)',
    current_setting('test.session_done')
  ),
  null,
  null,
  '4.3-DB-004: cannot end already-completed session (status != in_progress)'
);

select * from finish();
rollback;
