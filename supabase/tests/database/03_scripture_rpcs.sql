-- ============================================
-- pgTAP RPC Tests
-- Test scripture_create_session and scripture_submit_reflection
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(10);

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
-- Setup: Create test users
-- ============================================
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
begin
  v_user_a := tests.create_test_user('rpc_user_a@test.com');
  v_user_b := tests.create_test_user('rpc_user_b@test.com');
  perform set_config('tests.user_a', v_user_a::text, true);
  perform set_config('tests.user_b', v_user_b::text, true);
end;
$$;

-- ============================================
-- Test: scripture_create_session (solo)
-- ============================================
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_create_session('solo');
  perform set_config('tests.solo_session', (v_result->>'id')::text, true);
end;
$$;

select isnt(
  current_setting('tests.solo_session', true),
  null,
  'create_session solo returns session id'
);

select results_eq(
  format('select mode::text from public.scripture_sessions where id = %L', current_setting('tests.solo_session')::uuid),
  array['solo'],
  'Solo session has mode=solo'
);

select results_eq(
  format('select status::text from public.scripture_sessions where id = %L', current_setting('tests.solo_session')::uuid),
  array['in_progress'],
  'Solo session starts as in_progress'
);

select results_eq(
  format('select user2_id::text from public.scripture_sessions where id = %L', current_setting('tests.solo_session')::uuid),
  array[null::text],
  'Solo session has no user2_id'
);

-- ============================================
-- Test: scripture_create_session (together)
-- ============================================
do $$
declare
  v_result jsonb;
  v_partner uuid := current_setting('tests.user_b')::uuid;
begin
  v_result := scripture_create_session('together', v_partner);
  perform set_config('tests.together_session', (v_result->>'id')::text, true);
end;
$$;

select results_eq(
  format('select mode::text from public.scripture_sessions where id = %L', current_setting('tests.together_session')::uuid),
  array['together'],
  'Together session has mode=together'
);

select results_eq(
  format('select user2_id::text from public.scripture_sessions where id = %L', current_setting('tests.together_session')::uuid),
  array[current_setting('tests.user_b')],
  'Together session has correct partner'
);

-- ============================================
-- Test: scripture_create_session rejects invalid mode
-- ============================================
select throws_ok(
  format('select scripture_create_session(%L)', 'invalid_mode'),
  null,
  'Invalid mode: invalid_mode. Must be solo or together.',
  'create_session rejects invalid mode'
);

-- ============================================
-- Test: scripture_submit_reflection
-- ============================================
do $$
declare
  v_result jsonb;
  v_session uuid := current_setting('tests.solo_session')::uuid;
begin
  v_result := scripture_submit_reflection(v_session, 0, 4, 'Great passage', true);
  perform set_config('tests.reflection_id', (v_result->>'id')::text, true);
end;
$$;

select isnt(
  current_setting('tests.reflection_id', true),
  null,
  'submit_reflection returns reflection id'
);

select results_eq(
  format('select rating from public.scripture_reflections where id = %L', current_setting('tests.reflection_id')::uuid),
  array[4],
  'Reflection has correct rating'
);

select results_eq(
  format('select notes from public.scripture_reflections where id = %L', current_setting('tests.reflection_id')::uuid),
  array['Great passage'],
  'Reflection has correct notes'
);

select * from finish();
rollback;
