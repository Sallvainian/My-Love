-- ============================================
-- pgTAP: the profile owns its name, auth owns the email mirror (F9, CAP-9)
--
-- Regression cover for 20260912030000_profile_name_email_ownership.sql. Two
-- guarantees, each of which regresses silently without an assertion here:
--
--   * The trigger half. `sync_user_profile()` fires on EVERY auth.users UPDATE,
--     so its conflict branch runs on every sign-in and token refresh. Restoring
--     `display_name = EXCLUDED.display_name` there would break nothing that any
--     other test observes -- the row would simply be reset to the metadata name
--     or the email the next time the user signed in. The behavioural assertions
--     below change the metadata and the email through the definer path and read
--     the profile name back.
--   * The privilege half. `authenticated` lost table-level UPDATE on
--     `public.users` and holds a column grant on (display_name, updated_at)
--     alone. That is what stops a client PATCHing its own `email` mirror, and it
--     is easy to lose: 20260725170000_grant_api_roles_on_public.sql:35 grants
--     ALL on every public table and its ALTER DEFAULT PRIVILEGES (:40-43) keeps
--     doing so, so one blanket re-grant undoes this while every policy
--     assertion in the suite still passes.
--
-- The behavioural half switches role with `tests.authenticate_as`, so it runs as
-- the `authenticated` role with a real `sub` claim -- the shape the browser
-- client presents. Every refused write is followed by a read-back: a zero-row
-- update is not proof that a column is protected, and a 42501 raised before the
-- statement reached the row is not proof either (remediation.md, F5).
--
-- No policy is added, renamed or dropped on public.users by that migration, and
-- no file in this directory pins the users policy set
-- (`grep -rn policies_are supabase/tests | grep -i users` returns nothing), so
-- there is no array anywhere that has to move with it.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(34);

-- ============================================
-- Helpers (re-created per file: each test file runs in its own transaction)
-- ============================================
create or replace function tests.create_test_user(test_email text, meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token, raw_user_meta_data)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '', meta);
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
-- Function shape: SECURITY DEFINER, its search_path, and no EXECUTE grant
-- ============================================
-- The redefinition had to keep all three. A SECURITY INVOKER rewrite would run
-- as the GoTrue role and silently stop maintaining the mirror; a lost
-- search_path is the 0011 advisor lint.
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_user_profile'),
  true,
  'PROF-DB-001: sync_user_profile is still SECURITY DEFINER'
);

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_user_profile'),
  array['search_path=public, auth'],
  'PROF-DB-002: sync_user_profile still pins its search_path'
);

-- FN-GRANT-009 in 18_function_execute_grants.sql covers `authenticated` alone.
-- CREATE OR REPLACE preserves an ACL, but a future DROP + CREATE re-derives it
-- from the default privileges in 20260725170000:40-43 and hands every role
-- EXECUTE back.
select ok(not has_function_privilege('authenticated', 'public.sync_user_profile()', 'EXECUTE'),
  'PROF-DB-003: authenticated holds no EXECUTE on sync_user_profile');

select ok(not has_function_privilege('service_role', 'public.sync_user_profile()', 'EXECUTE'),
  'PROF-DB-004: service_role holds no EXECUTE on sync_user_profile');

select ok(not has_function_privilege('anon', 'public.sync_user_profile()', 'EXECUTE'),
  'PROF-DB-005: anon holds no EXECUTE on sync_user_profile');

-- The trigger is the only caller and it is still attached. Postgres resolves
-- EXECUTE at CREATE TRIGGER time, which is why the revocations above cost it
-- nothing.
select is(
  (select count(*)::int from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
      and t.tgname = 'on_auth_user_created' and not t.tgisinternal),
  1,
  'PROF-DB-006: on_auth_user_created is still attached to auth.users'
);

-- ============================================
-- Privileges -- where the email protection actually lives
-- ============================================
select ok(not has_table_privilege('authenticated', 'public.users', 'UPDATE'),
  'PROF-DB-007: authenticated holds no table-level UPDATE on users');

select ok(has_column_privilege('authenticated', 'public.users', 'display_name', 'UPDATE'),
  'PROF-DB-008: authenticated may UPDATE display_name');

select ok(has_column_privilege('authenticated', 'public.users', 'updated_at', 'UPDATE'),
  'PROF-DB-009: authenticated may UPDATE updated_at');

select ok(not has_column_privilege('authenticated', 'public.users', 'email', 'UPDATE'),
  'PROF-DB-010: authenticated may not UPDATE email');

-- partner_id was already pinned by users_update_self_safe WITH CHECK. The column
-- grant now denies it one layer earlier, and both are wanted: the policy states
-- the intent, the privilege refuses the statement.
select ok(not has_column_privilege('authenticated', 'public.users', 'partner_id', 'UPDATE'),
  'PROF-DB-011: authenticated may not UPDATE partner_id');

select ok(not has_column_privilege('authenticated', 'public.users', 'id', 'UPDATE'),
  'PROF-DB-012: authenticated may not UPDATE id');

select ok(not has_column_privilege('authenticated', 'public.users', 'created_at', 'UPDATE'),
  'PROF-DB-013: authenticated may not UPDATE created_at');

-- The remaining two columns the migration header names as deliberately outside
-- the grant. Nothing in src/ has ever written either, and without these a grant
-- widened to include them passes every other assertion in this file.
select ok(not has_column_privilege('authenticated', 'public.users', 'partner_name', 'UPDATE'),
  'PROF-DB-033: authenticated may not UPDATE partner_name');

select ok(not has_column_privilege('authenticated', 'public.users', 'device_id', 'UPDATE'),
  'PROF-DB-034: authenticated may not UPDATE device_id');

-- Reads are untouched: partnerService and getPartnerDisplayName select
-- display_name and email, and the app's own-name read needs display_name back.
select ok(has_table_privilege('authenticated', 'public.users', 'SELECT'),
  'PROF-DB-014: authenticated can still SELECT users');

-- The INSERT policy "Users can insert own profile" is deliberately untouched, so
-- the privilege it rides on must be too.
select ok(has_table_privilege('authenticated', 'public.users', 'INSERT'),
  'PROF-DB-015: authenticated can still INSERT its own profile row');

select ok(not has_table_privilege('anon', 'public.users', 'UPDATE'),
  'PROF-DB-016: anon holds no UPDATE on users');

select ok(not has_column_privilege('anon', 'public.users', 'display_name', 'UPDATE'),
  'PROF-DB-017: anon holds no column UPDATE on users either');

-- service_role is deliberately left whole: global-setup.ts:99-109 links partner
-- pairs with the service key and the API specs clean up with it.
select ok(has_table_privilege('service_role', 'public.users', 'UPDATE'),
  'PROF-DB-018: service_role still holds table-level UPDATE for fixtures');

-- ============================================
-- Seeding: what a brand-new auth user lands with
-- ============================================
do $$
declare
  v_a uuid;
  v_b uuid;
  v_named uuid;
begin
  -- A and B: no metadata name, the Google-bootstrap shape. Linked as
  -- accept_partner_request would leave them.
  v_a := tests.create_test_user('prof_a@test.com');
  v_b := tests.create_test_user('prof_b@test.com');
  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;

  -- The password-signup shape: a display_name supplied in user metadata.
  v_named := tests.create_test_user('prof_named@test.com', jsonb_build_object('display_name', 'Seeded Name'));

  perform set_config('tests.user_a', v_a::text, true);
  perform set_config('tests.user_b', v_b::text, true);
  perform set_config('tests.user_named', v_named::text, true);
end;
$$;

select results_eq(
  format('select display_name from public.users where id = %L', current_setting('tests.user_named')),
  array['Seeded Name'::text],
  'PROF-DB-019: a signup carrying a metadata name is seeded with that name'
);

select results_eq(
  format('select display_name from public.users where id = %L', current_setting('tests.user_a')),
  array['prof_a@test.com'::text],
  'PROF-DB-020: a signup with no metadata name falls back to the email seed'
);

-- ============================================
-- The client may set its own name and nothing else
-- ============================================
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select lives_ok(
  format('update public.users set display_name = %L, updated_at = now() where id = %L',
    'Chosen A', current_setting('tests.user_a')),
  'PROF-DB-021: the owner can set its own display_name'
);

select results_eq(
  format('select display_name from public.users where id = %L', current_setting('tests.user_a')),
  array['Chosen A'::text],
  'PROF-DB-022: the chosen name actually persisted'
);

select throws_ok(
  format('update public.users set email = %L where id = %L',
    'hijacked@evil.example', current_setting('tests.user_a')),
  '42501',
  null,
  'PROF-DB-023: the owner cannot rewrite its own email mirror'
);

-- A combined patch must be refused as a whole. Postgres checks column
-- privileges before it touches a row, so this cannot land the name half and drop
-- the email half -- but only a read-back says so.
select throws_ok(
  format('update public.users set display_name = %L, email = %L where id = %L',
    'Smuggled A', 'hijacked@evil.example', current_setting('tests.user_a')),
  '42501',
  null,
  'PROF-DB-024: a combined name-plus-email patch is refused'
);

select results_eq(
  format('select email, display_name from public.users where id = %L', current_setting('tests.user_a')),
  $q$values ('prof_a@test.com'::text, 'Chosen A'::text)$q$,
  'PROF-DB-025: neither refused patch changed anything, not even the name half'
);

select throws_ok(
  format('update public.users set partner_id = null where id = %L', current_setting('tests.user_a')),
  '42501',
  null,
  'PROF-DB-026: the owner cannot unlink itself outside accept_partner_request'
);

-- The partner row is refused by the SELECT/UPDATE policy rather than by the
-- grant, so this is a zero-row update and not an error -- which is exactly why
-- the read-back matters.
select results_eq(
  format($q$with updated as (
      update public.users set display_name = %L where id = %L returning 1
    ) select count(*)::int from updated$q$,
    'Hacked B', current_setting('tests.user_b')),
  array[0],
  'PROF-DB-027: the owner''s write against the partner row matches no row'
);

select results_eq(
  format('select display_name from public.users where id = %L', current_setting('tests.user_b')),
  array['prof_b@test.com'::text],
  'PROF-DB-028: the partner''s name is untouched'
);

-- ============================================
-- The definer path still keeps the mirror true, and still keeps its hands off
-- the name
-- ============================================
reset role;

-- Backdate `updated_at` first, so the bump below is observable. `now()` is
-- fixed at transaction start and this whole file is one transaction, so the
-- trigger's `NOW()` is the same instant as the seed's -- without this, "bumped"
-- could not be told from "untouched".
update public.users set updated_at = now() - interval '1 day'
  where id = current_setting('tests.user_a')::uuid;

-- An email change through GoTrue. Before this migration the same statement also
-- rewrote display_name back to the new email.
update auth.users set email = 'moved_a@test.com' where id = current_setting('tests.user_a')::uuid;

select results_eq(
  format('select email, display_name from public.users where id = %L', current_setting('tests.user_a')),
  $q$values ('moved_a@test.com'::text, 'Chosen A'::text)$q$,
  'PROF-DB-029: an auth email change syncs the mirror and keeps the chosen name'
);

-- The third column of the same conflict branch. A branch rewritten to touch
-- only `email` would pass PROF-DB-029 and leave the row's timestamp lying.
select results_eq(
  format('select updated_at = now() from public.users where id = %L', current_setting('tests.user_a')),
  array[true],
  'PROF-DB-032: the same sync bumps updated_at off its backdated value'
);

-- A metadata write is the other half of the same bug: the app used to store the
-- name there, so anything writing user_metadata reset the profile.
update auth.users
  set raw_user_meta_data = jsonb_build_object('display_name', 'Metadata Override')
  where id = current_setting('tests.user_a')::uuid;

select results_eq(
  format('select display_name from public.users where id = %L', current_setting('tests.user_a')),
  array['Chosen A'::text],
  'PROF-DB-030: an auth metadata name does not overwrite the chosen name'
);

-- ============================================
-- anon reaches the column grant not at all
-- ============================================
-- The claims are cleared as well as the role: `set local role anon` alone leaves
-- the previous user's `sub` installed, so auth.uid() would still answer and a
-- re-grant would be judged against an identity no real anon client has.
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok(
  'update public.users set display_name = ''anon wrote this''',
  '42501',
  null,
  'PROF-DB-031: anon cannot update a profile at all'
);

reset role;

select * from finish();

rollback;
