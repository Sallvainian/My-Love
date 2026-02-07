-- ============================================
-- pgTAP Session Completion Tests
-- Status=complete + completed_at (Story 2.3)
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

create or replace function tests.create_session_as_admin(p_user1_id uuid, p_user2_id uuid default null, p_mode text default 'solo', p_status text default 'in_progress', p_phase text default 'reading')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  insert into public.scripture_sessions (mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at)
  values (p_mode::public.scripture_session_mode, p_user1_id, p_user2_id, p_phase::public.scripture_session_phase, 0, p_status::public.scripture_session_status, 1, now())
  returning id into v_session_id;
  return v_session_id;
end; $$;

-- ============================================
-- Setup: Create session in in_progress state
-- ============================================
do $$
declare
  v_user uuid;
  v_session_id uuid;
begin
  v_user := tests.create_test_user('complete_user@test.com');
  v_session_id := tests.create_session_as_admin(v_user);
  perform set_config('tests.user_a', v_user::text, true);
  perform set_config('tests.session_id', v_session_id::text, true);
end;
$$;

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

-- ============================================
-- Test: Session starts as in_progress with null completed_at
-- ============================================
select results_eq(
  format('select status::text from public.scripture_sessions where id = %L', current_setting('tests.session_id')::uuid),
  array['in_progress'],
  'Session starts as in_progress'
);

select is(
  (select completed_at from public.scripture_sessions where id = current_setting('tests.session_id')::uuid),
  null,
  'Session starts with completed_at=null'
);

-- ============================================
-- Test: Update to complete sets status + completed_at
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
begin
  update public.scripture_sessions
  set status = 'complete',
      current_phase = 'complete',
      completed_at = now()
  where id = v_session;
end;
$$;

select results_eq(
  format('select status::text from public.scripture_sessions where id = %L', current_setting('tests.session_id')::uuid),
  array['complete'],
  'Session status updated to complete'
);

select isnt(
  (select completed_at::text from public.scripture_sessions where id = current_setting('tests.session_id')::uuid),
  null,
  'completed_at is populated after completion'
);

select * from finish();
rollback;
