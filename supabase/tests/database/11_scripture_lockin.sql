-- ============================================
-- pgTAP Tests: Scripture Lock-In RPCs
-- Story 4.2: Synchronized Reading with Lock-In
-- Tests: 4.2-DB-001 through 4.2-DB-006
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(10);

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
  v_session_single   uuid; -- For DB-001: single lock-in
  v_session_both     uuid; -- For DB-002: both lock-in → advance
  v_session_version  uuid; -- For DB-003: version mismatch
  v_session_security uuid; -- For DB-004: RLS security
  v_session_last     uuid; -- For DB-005: last step (step 16)
  v_session_undo     uuid; -- For DB-006: undo lock-in
begin
  v_user1 := tests.create_test_user('lockin_user1@test.com');
  v_user2 := tests.create_test_user('lockin_user2@test.com');
  v_user3 := tests.create_test_user('lockin_user3_nonmember@test.com');

  -- CRITICAL: Set partner_id for couple FK relationship (Epic 3 retro rule)
  update public.users set partner_id = v_user2 where id = v_user1;
  update public.users set partner_id = v_user1 where id = v_user2;

  -- Sessions: all in 'reading' phase, together mode, in_progress
  v_session_single   := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_both     := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_version  := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_security := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_last     := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');
  v_session_undo     := tests.create_session_as_admin(v_user1, v_user2, 'together', 'in_progress', 'reading');

  -- Set last-step session to step 16
  update public.scripture_sessions set current_step_index = 16 where id = v_session_last;

  perform set_config('tests.user1', v_user1::text, true);
  perform set_config('tests.user2', v_user2::text, true);
  perform set_config('tests.user3', v_user3::text, true);
  perform set_config('tests.session_single', v_session_single::text, true);
  perform set_config('tests.session_both', v_session_both::text, true);
  perform set_config('tests.session_version', v_session_version::text, true);
  perform set_config('tests.session_security', v_session_security::text, true);
  perform set_config('tests.session_last', v_session_last::text, true);
  perform set_config('tests.session_undo', v_session_undo::text, true);
end;
$$;

-- ============================================
-- 4.2-DB-001: Single lock-in — user1 locks, step does NOT advance
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);

do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_single')::uuid,
    0,
    1
  );
end;
$$;

select isnt(
  (select user1_locked_at from public.scripture_step_states
   where session_id = current_setting('tests.session_single')::uuid and step_index = 0),
  null::timestamptz,
  '4.2-DB-001: user1_locked_at IS NOT NULL after single lock-in'
);

select is(
  (select user2_locked_at from public.scripture_step_states
   where session_id = current_setting('tests.session_single')::uuid and step_index = 0),
  null::timestamptz,
  '4.2-DB-001: user2_locked_at IS NULL (only user1 locked)'
);

select is(
  (select current_step_index from public.scripture_sessions
   where id = current_setting('tests.session_single')::uuid),
  0,
  '4.2-DB-001: current_step_index remains 0 (no advance with single lock)'
);

-- ============================================
-- 4.2-DB-002: Both lock-in → step advances
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);
do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_both')::uuid,
    0,
    1
  );
end;
$$;

-- Version was bumped to 2 after user1's lock (partial lock doesn't bump version in session)
-- Actually, partial lock doesn't change session version. Let user2 lock with same version.
select tests.authenticate_as(current_setting('tests.user2')::uuid);
do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_both')::uuid,
    0,
    1
  );
end;
$$;

select isnt(
  (select advanced_at from public.scripture_step_states
   where session_id = current_setting('tests.session_both')::uuid and step_index = 0),
  null::timestamptz,
  '4.2-DB-002: advanced_at IS NOT NULL after both lock-in'
);

select is(
  (select current_step_index from public.scripture_sessions
   where id = current_setting('tests.session_both')::uuid),
  1,
  '4.2-DB-002: current_step_index advanced to 1 after both lock-in'
);

-- ============================================
-- 4.2-DB-003: Version mismatch raises exception
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);

select throws_ok(
  format(
    'select public.scripture_lock_in(%L::uuid, 0, 999)',
    current_setting('tests.session_version')
  ),
  null,
  null,
  '4.2-DB-003: version mismatch raises exception'
);

-- ============================================
-- 4.2-DB-004: RLS security — non-member cannot call scripture_lock_in
-- ============================================

select tests.authenticate_as(current_setting('tests.user3')::uuid);

select throws_ok(
  format(
    'select public.scripture_lock_in(%L::uuid, 0, 1)',
    current_setting('tests.session_security')
  ),
  null,
  null,
  '4.2-DB-004: non-member cannot call scripture_lock_in'
);

-- ============================================
-- 4.2-DB-005: Last step (step 16) → reflection phase + complete status
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);
do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_last')::uuid,
    16,
    1
  );
end;
$$;

select tests.authenticate_as(current_setting('tests.user2')::uuid);
do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_last')::uuid,
    16,
    1
  );
end;
$$;

select is(
  (select current_phase::text from public.scripture_sessions
   where id = current_setting('tests.session_last')::uuid),
  'reflection',
  '4.2-DB-005: current_phase transitions to reflection after last step lock-in'
);

select is(
  (select status::text from public.scripture_sessions
   where id = current_setting('tests.session_last')::uuid),
  'complete',
  '4.2-DB-005: status transitions to complete after last step lock-in'
);

-- ============================================
-- 4.2-DB-006: Undo lock-in — user1 locks then undoes → user1_locked_at is NULL
-- ============================================

select tests.authenticate_as(current_setting('tests.user1')::uuid);
do $$
begin
  perform public.scripture_lock_in(
    current_setting('tests.session_undo')::uuid,
    0,
    1
  );
end;
$$;

-- Undo the lock-in
do $$
begin
  perform public.scripture_undo_lock_in(
    current_setting('tests.session_undo')::uuid,
    0
  );
end;
$$;

select is(
  (select user1_locked_at from public.scripture_step_states
   where session_id = current_setting('tests.session_undo')::uuid and step_index = 0),
  null::timestamptz,
  '4.2-DB-006: user1_locked_at IS NULL after undo lock-in'
);

select * from finish();
rollback;
