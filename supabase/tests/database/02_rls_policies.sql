-- ============================================
-- pgTAP RLS Policy Tests
-- Verify policies exist and enforce correct access
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;
alter default privileges in schema tests grant execute on functions to authenticated, anon;

select plan(14);

-- ============================================
-- Create test helpers (re-created per test file since each runs in own tx)
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

create or replace function tests.reset_role()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
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

create or replace function tests.insert_reflection_as_admin(p_session_id uuid, p_step_index int, p_user_id uuid, p_rating int, p_notes text, p_is_shared boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.scripture_reflections (session_id, step_index, user_id, rating, notes, is_shared)
  values (p_session_id, p_step_index, p_user_id, p_rating, p_notes, p_is_shared);
end; $$;

create or replace function tests.insert_bookmark_as_admin(p_session_id uuid, p_step_index int, p_user_id uuid, p_share boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.scripture_bookmarks (session_id, step_index, user_id, share_with_partner)
  values (p_session_id, p_step_index, p_user_id, p_share);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- ============================================
-- Policy existence checks
-- ============================================
select policies_are('public', 'scripture_sessions',
  array['scripture_sessions_select', 'scripture_sessions_insert', 'scripture_sessions_update'],
  'scripture_sessions has expected policies'
);

select policies_are('public', 'scripture_step_states',
  array['scripture_step_states_select', 'scripture_step_states_insert', 'scripture_step_states_update'],
  'scripture_step_states has expected policies'
);

select policies_are('public', 'scripture_reflections',
  array['scripture_reflections_select', 'scripture_reflections_insert', 'scripture_reflections_update'],
  'scripture_reflections has expected policies'
);

select policies_are('public', 'scripture_bookmarks',
  array['scripture_bookmarks_select', 'scripture_bookmarks_insert', 'scripture_bookmarks_update', 'scripture_bookmarks_delete'],
  'scripture_bookmarks has expected policies'
);

select policies_are('public', 'scripture_messages',
  array['scripture_messages_select', 'scripture_messages_insert'],
  'scripture_messages has expected policies'
);

-- ============================================
-- Policy command type checks
-- ============================================
select policy_cmd_is('public'::name, 'scripture_sessions'::name, 'scripture_sessions_select'::name, 'SELECT', 'sessions select policy is SELECT');
select policy_cmd_is('public'::name, 'scripture_sessions'::name, 'scripture_sessions_insert'::name, 'INSERT', 'sessions insert policy is INSERT');
select policy_cmd_is('public'::name, 'scripture_bookmarks'::name, 'scripture_bookmarks_delete'::name, 'DELETE', 'bookmarks delete policy is DELETE');

-- ============================================
-- RLS enforcement: User B cannot see User A's session
-- ============================================
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_session_id uuid;
begin
  v_user_a := tests.create_test_user('rls_user_a@test.com');
  v_user_b := tests.create_test_user('rls_user_b@test.com');
  v_session_id := tests.create_session_as_admin(v_user_a);

  -- Store IDs for subsequent tests
  perform set_config('tests.user_a', v_user_a::text, true);
  perform set_config('tests.user_b', v_user_b::text, true);
  perform set_config('tests.session_id', v_session_id::text, true);
end;
$$;

-- User B sees nothing
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is_empty(
  'select id from public.scripture_sessions',
  'User B cannot see User A session (RLS blocks)'
);

-- User A sees own session
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select results_eq(
  'select count(*)::int from public.scripture_sessions',
  array[1],
  'User A sees own session'
);

-- ============================================
-- RLS enforcement: Anon sees nothing
-- ============================================
select tests.reset_role();

select is_empty(
  'select id from public.scripture_sessions',
  'Anon role sees no sessions'
);

-- ============================================
-- RLS enforcement: Reflections isolation
-- ============================================
select tests.insert_reflection_as_admin(
  current_setting('tests.session_id')::uuid, 0,
  current_setting('tests.user_a')::uuid, 4, 'Private note', false
);
select tests.insert_reflection_as_admin(
  current_setting('tests.session_id')::uuid, 1,
  current_setting('tests.user_a')::uuid, 5, 'Shared note', true
);

-- User B cannot see unshared reflections
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is_empty(
  'select id from public.scripture_reflections where is_shared = false',
  'User B cannot see unshared reflections'
);

-- User A sees own reflections
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select results_eq(
  'select count(*)::int from public.scripture_reflections',
  array[2],
  'User A sees both own reflections'
);

-- ============================================
-- RLS enforcement: Bookmarks isolation
-- ============================================
select tests.insert_bookmark_as_admin(
  current_setting('tests.session_id')::uuid, 0,
  current_setting('tests.user_a')::uuid, false
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is_empty(
  'select id from public.scripture_bookmarks',
  'User B cannot see User A private bookmarks'
);

select * from finish();
rollback;
