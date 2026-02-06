-- ============================================
-- pgTAP Message Tests
-- Message insert with all fields (Story 2.3)
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
-- Setup
-- ============================================
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_session_id uuid;
begin
  v_user_a := tests.create_test_user('msg_user_a@test.com');
  v_user_b := tests.create_test_user('msg_user_b@test.com');
  v_session_id := tests.create_session_as_admin(v_user_a, v_user_b, 'together');
  perform set_config('tests.user_a', v_user_a::text, true);
  perform set_config('tests.user_b', v_user_b::text, true);
  perform set_config('tests.session_id', v_session_id::text, true);
end;
$$;

-- ============================================
-- Test: User A inserts a message
-- ============================================
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
  v_user uuid := current_setting('tests.user_a')::uuid;
  v_msg_id uuid;
begin
  insert into public.scripture_messages (session_id, sender_id, message)
  values (v_session, v_user, 'Lord, bless our reading today')
  returning id into v_msg_id;
  perform set_config('tests.msg_id', v_msg_id::text, true);
end;
$$;

select results_eq(
  format('select count(*)::int from public.scripture_messages where session_id = %L', current_setting('tests.session_id')::uuid),
  array[1],
  'Message insert creates 1 row'
);

select results_eq(
  format('select message from public.scripture_messages where id = %L', current_setting('tests.msg_id')::uuid),
  array['Lord, bless our reading today'],
  'Message text is stored correctly'
);

select results_eq(
  format('select sender_id::text from public.scripture_messages where id = %L', current_setting('tests.msg_id')::uuid),
  array[current_setting('tests.user_a')],
  'Message sender_id matches authenticated user'
);

-- ============================================
-- Test: Partner can see messages in shared session
-- ============================================
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select results_eq(
  format('select count(*)::int from public.scripture_messages where session_id = %L', current_setting('tests.session_id')::uuid),
  array[1],
  'Partner (User B) can see messages in shared session'
);

-- ============================================
-- Test: created_at is populated
-- ============================================
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select isnt(
  (select created_at::text from public.scripture_messages where id = current_setting('tests.msg_id')::uuid),
  null,
  'Message created_at is populated'
);

select * from finish();
rollback;
