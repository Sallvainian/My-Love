-- ============================================
-- pgTAP Reflection Upsert Tests
-- Core idempotency: ON CONFLICT (session_id, step_index, user_id)
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(5);

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
  v_user_a uuid;
  v_result jsonb;
begin
  v_user_a := tests.create_test_user('upsert_user@test.com');
  perform set_config('tests.user_a', v_user_a::text, true);

  perform tests.authenticate_as(v_user_a);
  v_result := scripture_create_session('solo');
  perform set_config('tests.session_id', (v_result->>'id')::text, true);
end;
$$;

-- Authenticate for the test queries
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

-- ============================================
-- Test: First submission creates a row
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
begin
  perform scripture_submit_reflection(v_session, 3, 3, 'first note', false);
end;
$$;

select results_eq(
  format('select count(*)::int from public.scripture_reflections where session_id = %L and step_index = 3', current_setting('tests.session_id')::uuid),
  array[1],
  'First submission creates exactly 1 row'
);

-- ============================================
-- Test: Second submission (same key) upserts — does not duplicate
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
begin
  perform scripture_submit_reflection(v_session, 3, 5, 'updated note', true);
end;
$$;

select results_eq(
  format('select count(*)::int from public.scripture_reflections where session_id = %L and step_index = 3', current_setting('tests.session_id')::uuid),
  array[1],
  'Upsert produces single row (no duplicate)'
);

-- ============================================
-- Test: Second write wins — rating updated
-- ============================================
select results_eq(
  format('select rating from public.scripture_reflections where session_id = %L and step_index = 3', current_setting('tests.session_id')::uuid),
  array[5],
  'Upsert updates rating to 5 (second write wins)'
);

-- ============================================
-- Test: Second write wins — notes updated
-- ============================================
select results_eq(
  format('select notes from public.scripture_reflections where session_id = %L and step_index = 3', current_setting('tests.session_id')::uuid),
  array['updated note'],
  'Upsert updates notes (second write wins)'
);

-- ============================================
-- Test: Second write wins — is_shared updated
-- ============================================
select results_eq(
  format('select is_shared from public.scripture_reflections where session_id = %L and step_index = 3', current_setting('tests.session_id')::uuid),
  array[true],
  'Upsert updates is_shared to true'
);

select * from finish();
rollback;
