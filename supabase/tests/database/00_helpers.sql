-- ============================================
-- pgTAP Test Helpers
-- Shared test user creation and auth context helpers
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(1);

-- ============================================
-- Helper: Create test user directly in auth.users
-- ============================================
create or replace function tests.create_test_user(
  test_email text default 'test@example.com'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    aud, role, email_confirmed_at, created_at, updated_at, confirmation_token
  ) values (
    user_id, '00000000-0000-0000-0000-000000000000',
    test_email, extensions.crypt('password123', extensions.gen_salt('bf')),
    'authenticated', 'authenticated', now(), now(), now(), ''
  );
  return user_id;
end;
$$;

-- ============================================
-- Helper: Simulate authenticated user (sets role + JWT claims)
-- ============================================
create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', test_user_id::text,
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text, true);
end;
$$;

-- ============================================
-- Helper: Reset to anon role
-- ============================================
create or replace function tests.reset_role()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Verify helpers are created
select pass('Test helpers created');

select * from finish();
rollback;
