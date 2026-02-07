-- ============================================
-- pgTAP Bookmark Tests
-- Insert/delete toggle and unique constraint
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
  v_session_id uuid;
begin
  v_user_a := tests.create_test_user('bookmark_user@test.com');
  v_session_id := tests.create_session_as_admin(v_user_a);
  perform set_config('tests.user_a', v_user_a::text, true);
  perform set_config('tests.session_id', v_session_id::text, true);
end;
$$;

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

-- ============================================
-- Test: Insert bookmark
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
  v_user uuid := current_setting('tests.user_a')::uuid;
  v_bookmark_id uuid;
begin
  insert into public.scripture_bookmarks (session_id, step_index, user_id, share_with_partner)
  values (v_session, 5, v_user, false)
  returning id into v_bookmark_id;
  perform set_config('tests.bookmark_id', v_bookmark_id::text, true);
end;
$$;

select results_eq(
  format('select count(*)::int from public.scripture_bookmarks where session_id = %L and step_index = 5', current_setting('tests.session_id')::uuid),
  array[1],
  'Bookmark insert creates 1 row'
);

-- ============================================
-- Test: Duplicate bookmark violates unique constraint
-- ============================================
select throws_ok(
  format(
    'insert into public.scripture_bookmarks (session_id, step_index, user_id, share_with_partner) values (%L, 5, %L, false)',
    current_setting('tests.session_id')::uuid,
    current_setting('tests.user_a')::uuid
  ),
  '23505',
  null,
  'Duplicate bookmark raises unique violation (23505)'
);

-- ============================================
-- Test: Bookmark is visible via select
-- ============================================
select results_eq(
  format('select share_with_partner from public.scripture_bookmarks where id = %L', current_setting('tests.bookmark_id')::uuid),
  array[false],
  'Bookmark share_with_partner is false'
);

-- ============================================
-- Test: Delete bookmark
-- ============================================
do $$
begin
  delete from public.scripture_bookmarks where id = current_setting('tests.bookmark_id')::uuid;
end;
$$;

select is_empty(
  format('select id from public.scripture_bookmarks where id = %L', current_setting('tests.bookmark_id')::uuid),
  'Bookmark is deleted after delete'
);

-- ============================================
-- Test: Re-insert after delete works (toggle pattern)
-- ============================================
do $$
declare
  v_session uuid := current_setting('tests.session_id')::uuid;
  v_user uuid := current_setting('tests.user_a')::uuid;
begin
  insert into public.scripture_bookmarks (session_id, step_index, user_id, share_with_partner)
  values (v_session, 5, v_user, true);
end;
$$;

select results_eq(
  format('select share_with_partner from public.scripture_bookmarks where session_id = %L and step_index = 5', current_setting('tests.session_id')::uuid),
  array[true],
  'Re-inserted bookmark has share_with_partner=true (toggle works)'
);

select * from finish();
rollback;
