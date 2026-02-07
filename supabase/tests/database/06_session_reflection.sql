-- ============================================
-- pgTAP Session-Level Reflection Tests
-- stepIndex=17 sentinel for session-level reflection (Story 2.2)
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

-- ============================================
-- Setup
-- ============================================
do $$
declare
  v_user uuid;
  v_result jsonb;
begin
  v_user := tests.create_test_user('session_refl@test.com');
  perform set_config('tests.user_a', v_user::text, true);

  perform tests.authenticate_as(v_user);
  v_result := scripture_create_session('solo');
  perform set_config('tests.session_id', (v_result->>'id')::text, true);
end;
$$;

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

-- ============================================
-- Test: Submit session-level reflection (step_index=17)
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
begin
  perform scripture_submit_reflection(v_session, 17, 5, 'Session was amazing', true);
end;
$$;

select results_eq(
  format('select step_index from public.scripture_reflections where session_id = %L and step_index = 17', current_setting('tests.session_id')::uuid),
  array[17],
  'Session-level reflection stored at step_index=17'
);

select results_eq(
  format('select rating from public.scripture_reflections where session_id = %L and step_index = 17', current_setting('tests.session_id')::uuid),
  array[5],
  'Session-level reflection has rating=5'
);

select results_eq(
  format('select notes from public.scripture_reflections where session_id = %L and step_index = 17', current_setting('tests.session_id')::uuid),
  array['Session was amazing'],
  'Session-level reflection has correct notes'
);

select results_eq(
  format('select is_shared from public.scripture_reflections where session_id = %L and step_index = 17', current_setting('tests.session_id')::uuid),
  array[true],
  'Session-level reflection is shared'
);

select * from finish();
rollback;
