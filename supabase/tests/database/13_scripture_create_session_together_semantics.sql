-- ============================================
-- pgTAP Tests: scripture_create_session together-mode semantics
-- Hotfix validation for session reuse + lobby start phase
-- Tests: 4.3-DB-005 through 4.3-DB-008
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(4);

-- ============================================
-- Helpers
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
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', test_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true
  );
end; $$;

-- ============================================
-- Setup
-- ============================================
do $$
declare
  v_user1 uuid;
  v_user2 uuid;
begin
  v_user1 := tests.create_test_user('create_session_pair_user1@test.com');
  v_user2 := tests.create_test_user('create_session_pair_user2@test.com');

  perform set_config('test.user1_id', v_user1::text, true);
  perform set_config('test.user2_id', v_user2::text, true);
end; $$;

-- ============================================
-- 4.3-DB-005: First together create starts in lobby
-- ============================================
select tests.authenticate_as(current_setting('test.user1_id')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := public.scripture_create_session(
    'together',
    current_setting('test.user2_id')::uuid
  );

  perform set_config('test.session_from_user1', v_result->>'id', true);
  perform set_config('test.phase_from_user1', v_result->>'current_phase', true);
end;
$$;

select is(
  current_setting('test.phase_from_user1'),
  'lobby',
  '4.3-DB-005: together session starts in lobby phase'
);

-- ============================================
-- 4.3-DB-006: Partner call reuses same in-progress session
-- ============================================
select tests.authenticate_as(current_setting('test.user2_id')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := public.scripture_create_session(
    'together',
    current_setting('test.user1_id')::uuid
  );

  perform set_config('test.session_from_user2', v_result->>'id', true);
end;
$$;

select is(
  current_setting('test.session_from_user2'),
  current_setting('test.session_from_user1'),
  '4.3-DB-006: second partner receives same session id (no duplicate together session)'
);

-- ============================================
-- 4.3-DB-007: Repeat caller reuses same session id
-- ============================================
select tests.authenticate_as(current_setting('test.user1_id')::uuid);

select is(
  (
    public.scripture_create_session(
      'together',
      current_setting('test.user2_id')::uuid
    )->>'id'
  ),
  current_setting('test.session_from_user1'),
  '4.3-DB-007: repeated create_session call reuses existing in-progress together session'
);

-- ============================================
-- 4.3-DB-008: Exactly one in-progress together session exists for the pair
-- ============================================
select is(
  (
    select count(*)
    from public.scripture_sessions s
    where s.mode = 'together'
      and s.status = 'in_progress'
      and (
        (
          s.user1_id = current_setting('test.user1_id')::uuid
          and s.user2_id = current_setting('test.user2_id')::uuid
        )
        or
        (
          s.user1_id = current_setting('test.user2_id')::uuid
          and s.user2_id = current_setting('test.user1_id')::uuid
        )
      )
  ),
  1::bigint,
  '4.3-DB-008: only one in-progress together session row exists per user pair'
);

select * from finish();
rollback;
