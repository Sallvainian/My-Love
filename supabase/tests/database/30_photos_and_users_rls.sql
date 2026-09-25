-- ============================================
-- pgTAP: photos and users RLS after 20260925000000_rls_initplan_photos_users.sql
--
-- That migration rewrites the photos policies and the users SELECT policy so
-- auth.uid() and get_my_partner_id() run once per query, and merges the two
-- photos SELECT policies into one. It must not change who sees or changes what,
-- so this file pins both the policy shape (metadata) and the visibility
-- (behaviour), run as the `authenticated` role with a real `sub` claim.
--
-- Identities: A and B are linked partners, C is an outsider, and D names A as
-- partner without A naming D (the third arm of the users policy).
--
-- If you add, rename or drop a policy on public.photos, the array in
-- PHO-DB-001 must be edited in the same change or this file fails.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(25);

-- ============================================
-- Helpers (re-created per file: each test file runs in its own transaction)
-- ============================================
create or replace function tests.create_test_user(test_email text)
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

grant execute on all functions in schema tests to authenticated, anon;

-- ============================================
-- Policy metadata
-- ============================================
select policies_are(
  'public',
  'photos',
  array[
    'Users can view own and partner photos',
    'Users can insert own photos',
    'Users can delete own photos'
  ],
  'PHO-DB-001: photos carries exactly the three expected policies (one SELECT, no UPDATE)'
);

select policy_cmd_is('public'::name, 'photos'::name, 'Users can view own and partner photos'::name, 'SELECT',
  'PHO-DB-002: the view policy is SELECT');
select policy_cmd_is('public'::name, 'photos'::name, 'Users can insert own photos'::name, 'INSERT',
  'PHO-DB-003: the insert policy is INSERT');
select policy_cmd_is('public'::name, 'photos'::name, 'Users can delete own photos'::name, 'DELETE',
  'PHO-DB-004: the delete policy is DELETE');

select policy_roles_are('public'::name, 'photos'::name, 'Users can view own and partner photos'::name,
  array['authenticated'], 'PHO-DB-005: the view policy is restricted to authenticated');
select policy_roles_are('public'::name, 'photos'::name, 'Users can insert own photos'::name,
  array['authenticated'], 'PHO-DB-006: the insert policy is restricted to authenticated');
select policy_roles_are('public'::name, 'photos'::name, 'Users can delete own photos'::name,
  array['authenticated'], 'PHO-DB-007: the delete policy is restricted to authenticated');
select policy_roles_are('public'::name, 'users'::name, 'Users can view self and partner profiles'::name,
  array['authenticated'], 'USR-DB-010: the users view policy is restricted to authenticated');

-- The advisor's auth_rls_initplan: every auth.uid() and get_my_partner_id() call
-- in these policies sits inside a scalar subquery, so it is planned once per
-- query. The deparsed form is `( SELECT auth.uid() AS uid)`.
select is(
  (select count(*)::int from pg_policies,
     lateral (select coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr) e
   where schemaname = 'public'
     and (tablename = 'photos' or (tablename = 'users' and policyname = 'Users can view self and partner profiles'))
     and (regexp_count(e.expr, 'auth\.uid\(\)') <> regexp_count(e.expr, 'SELECT auth\.uid\(\)')
       or regexp_count(e.expr, 'get_my_partner_id\(\)') <> regexp_count(e.expr, 'SELECT get_my_partner_id\(\)'))),
  0,
  'PHO-DB-008: no photos or users-view policy calls auth.uid() or get_my_partner_id() per row'
);

-- ============================================
-- Behaviour: A and B linked, C outside, D names A one-way
-- ============================================
do $$
declare
  v_a uuid;
  v_b uuid;
  v_c uuid;
  v_d uuid;
begin
  v_a := tests.create_test_user('pho_a@test.com');
  v_b := tests.create_test_user('pho_b@test.com');
  v_c := tests.create_test_user('pho_c@test.com');
  v_d := tests.create_test_user('pho_d@test.com');

  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;
  update public.users set partner_id = v_a where id = v_d;

  insert into public.photos (user_id, storage_path, filename, file_size, width, height) values
    (v_a, 'pho-test/a-1.jpg', 'a-1.jpg', 100, 10, 10),
    (v_b, 'pho-test/b-1.jpg', 'b-1.jpg', 100, 10, 10),
    (v_c, 'pho-test/c-1.jpg', 'c-1.jpg', 100, 10, 10);

  perform set_config('tests.user_a', v_a::text, true);
  perform set_config('tests.user_b', v_b::text, true);
  perform set_config('tests.user_c', v_c::text, true);
  perform set_config('tests.user_d', v_d::text, true);
end;
$$;

-- --- As A -------------------------------------------------------------------
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select is(
  (select array_agg(storage_path order by storage_path) from public.photos where storage_path like 'pho-test/%'),
  array['pho-test/a-1.jpg', 'pho-test/b-1.jpg'],
  'PHO-DB-009: a partner sees their own photos and their partner''s, not an outsider''s'
);

select lives_ok(
  format(
    'insert into public.photos (user_id, storage_path, filename, file_size, width, height) values (%L, %L, %L, 1, 1, 1)',
    current_setting('tests.user_a'), 'pho-test/a-2.jpg', 'a-2.jpg'
  ),
  'PHO-DB-010: a user can insert their own photo'
);

select throws_ok(
  format(
    'insert into public.photos (user_id, storage_path, filename, file_size, width, height) values (%L, %L, %L, 1, 1, 1)',
    current_setting('tests.user_b'), 'pho-test/b-2.jpg', 'b-2.jpg'
  ),
  '42501',
  null,
  'PHO-DB-011: a user cannot insert a photo as their partner'
);

select lives_ok(
  'delete from public.photos where storage_path = ''pho-test/a-2.jpg''',
  'PHO-DB-012: a user can delete their own photo'
);

select is(
  (select count(*)::int from public.photos where storage_path = 'pho-test/a-2.jpg'),
  0,
  'PHO-DB-013: the deleted photo is gone'
);

-- A zero-row delete is not proof: read back that B's photo survives (A can see it).
select lives_ok(
  'delete from public.photos where storage_path = ''pho-test/b-1.jpg''',
  'PHO-DB-014: deleting the partner''s photo raises no error (RLS filters it out)'
);

select is(
  (select count(*)::int from public.photos where storage_path = 'pho-test/b-1.jpg'),
  1,
  'PHO-DB-015: the partner''s photo survives a delete attempt'
);

select ok(exists(select 1 from public.users where id = current_setting('tests.user_a')::uuid),
  'USR-DB-011: a user sees their own profile');
select ok(exists(select 1 from public.users where id = current_setting('tests.user_b')::uuid),
  'USR-DB-012: a user sees their partner''s profile');
select ok(exists(select 1 from public.users where id = current_setting('tests.user_d')::uuid),
  'USR-DB-013: a user sees a profile that names them as partner');
select ok(not exists(select 1 from public.users where id = current_setting('tests.user_c')::uuid),
  'USR-DB-014: a user does not see an outsider''s profile');

reset role;

-- --- As B (the partner) -----------------------------------------------------
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select is(
  (select array_agg(storage_path order by storage_path) from public.photos where storage_path like 'pho-test/%'),
  array['pho-test/a-1.jpg', 'pho-test/b-1.jpg'],
  'PHO-DB-016: the other partner sees the same pair of photos'
);

reset role;

-- --- As C (outsider) --------------------------------------------------------
select tests.authenticate_as(current_setting('tests.user_c')::uuid);

select is(
  (select array_agg(storage_path order by storage_path) from public.photos where storage_path like 'pho-test/%'),
  array['pho-test/c-1.jpg'],
  'PHO-DB-017: an outsider sees only their own photo'
);

select is(
  (select array_agg(id) from public.users),
  array[current_setting('tests.user_c')::uuid],
  'USR-DB-015: an unlinked user sees only their own profile'
);

reset role;

-- --- As anon ----------------------------------------------------------------
-- The JWT claims are cleared as well as the role, as in 24_interactions_partner_only.sql.
select set_config('request.jwt.claims', '', true);
set local role anon;

select is(
  (select count(*)::int from public.photos),
  0,
  'PHO-DB-018: anon sees no photos'
);

select is(
  (select count(*)::int from public.users),
  0,
  'USR-DB-016: anon sees no profiles'
);

reset role;

select * from finish();

rollback;
