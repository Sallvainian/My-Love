-- Couple settings (CS-DB-001 .. 029)
--
-- The property under test: a public.couple_settings row is readable and
-- writable by the linked pair it names, and by nobody else -- not an outsider,
-- and not an unlinked account naming someone as its pair
-- (20260923020000_couple_settings.sql).
--
-- Cross-user UPDATE is asserted as a ROW COUNT: RLS filters it to zero rows
-- rather than raising, while a forged INSERT and a re-pointing UPDATE raise
-- 42501 (same measured behaviour as 20_events.sql and 27_local_data_tables.sql).
--
-- Helpers are declared inline: 00_helpers.sql rolls back before this file runs.

begin;

select plan(29);

create schema if not exists tests;

grant usage on schema tests to authenticated, anon;
alter default privileges in schema tests grant execute on functions to authenticated, anon;

create or replace function tests.create_test_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', p_email, '', now(), now(), now());
  insert into public.users (id, email) values (v_id, p_email)
    on conflict (id) do nothing;
  return v_id;
end;
$$;

create or replace function tests.authenticate_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated',
                      'aud', 'authenticated')::text, true);
end;
$$;

create or replace function tests.be_postgres()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Run one statement as `p_user` and report how many rows it touched. Called as
-- postgres; returns as postgres.
create or replace function tests.rows_as(p_user uuid, p_sql text)
returns int language plpgsql as $$
declare v_rows int;
begin
  perform tests.authenticate_as(p_user);
  execute p_sql;
  get diagnostics v_rows = row_count;
  perform tests.be_postgres();
  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixture: A and B are a linked couple; C is an unrelated outsider; D is
-- unlinked. `tests.lo` / `tests.hi` are A and B in key order, as the client
-- writes them. No couple row exists yet: B creates it below, as the app does.
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid; v_b uuid; v_c uuid; v_d uuid;
begin
  v_a := tests.create_test_user('cs-a@test.local');
  v_b := tests.create_test_user('cs-b@test.local');
  v_c := tests.create_test_user('cs-c@test.local');
  v_d := tests.create_test_user('cs-d@test.local');

  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;

  perform set_config('tests.a', v_a::text, false);
  perform set_config('tests.b', v_b::text, false);
  perform set_config('tests.c', v_c::text, false);
  perform set_config('tests.d', v_d::text, false);
  perform set_config('tests.lo', least(v_a, v_b)::text, false);
  perform set_config('tests.hi', greatest(v_a, v_b)::text, false);
  -- An ordered pair naming D with C, for the unlinked-caller checks.
  perform set_config('tests.dc_lo', least(v_c, v_d)::text, false);
  perform set_config('tests.dc_hi', greatest(v_c, v_d)::text, false);
end
$$;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'couple_settings', 'CS-DB-001: couple_settings exists');
select col_type_is('public', 'couple_settings', 'relationship_start', 'timestamp with time zone',
  'CS-DB-002: relationship_start is a timestamptz (date and time)');
select col_is_null('public', 'couple_settings', 'relationship_start',
  'CS-DB-003: relationship_start is nullable (not set yet)');
select col_is_pk('public', 'couple_settings', array['user_a', 'user_b'],
  'CS-DB-004: the primary key is the pair (user_a, user_b)');

select is((select relrowsecurity from pg_class where oid = 'public.couple_settings'::regclass),
  true, 'CS-DB-005: RLS is enabled on couple_settings');

select policies_are('public', 'couple_settings',
  array['couple_settings_select', 'couple_settings_insert', 'couple_settings_update'],
  'CS-DB-006: couple_settings carries select, insert and update only (no delete)');

select policy_roles_are('public', 'couple_settings', 'couple_settings_select', array['authenticated'],
  'CS-DB-007: couple_settings_select applies to authenticated only');
select policy_roles_are('public', 'couple_settings', 'couple_settings_insert', array['authenticated'],
  'CS-DB-008: couple_settings_insert applies to authenticated only');
select policy_roles_are('public', 'couple_settings', 'couple_settings_update', array['authenticated'],
  'CS-DB-009: couple_settings_update applies to authenticated only');

select ok(
  (select with_check is not null from pg_policies
    where schemaname = 'public' and tablename = 'couple_settings'
      and policyname = 'couple_settings_update'),
  'CS-DB-010: couple_settings_update states WITH CHECK explicitly');

-- anon's zero privileges undo the ALTER DEFAULT PRIVILEGES in 20260725170000.
select ok(not (has_table_privilege('anon', 'public.couple_settings', 'SELECT')
            or has_table_privilege('anon', 'public.couple_settings', 'INSERT')
            or has_table_privilege('anon', 'public.couple_settings', 'UPDATE')
            or has_table_privilege('anon', 'public.couple_settings', 'DELETE')),
  'CS-DB-011: anon holds no privilege on couple_settings');
select ok(not has_table_privilege('authenticated', 'public.couple_settings', 'DELETE'),
  'CS-DB-012: authenticated cannot DELETE couple_settings');

-- ---------------------------------------------------------------------------
-- The ordered-pair CHECK
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.couple_settings (user_a, user_b) values (%L, %L)$$,
         current_setting('tests.hi'), current_setting('tests.lo')),
  '23514', null, 'CS-DB-013: a pair out of key order is rejected');

-- ---------------------------------------------------------------------------
-- A partner creates the row (the app's upsert), and both partners read it
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.b')::uuid);

select lives_ok(
  format($$insert into public.couple_settings (user_a, user_b, relationship_start, updated_at)
           values (%L, %L, timestamptz '2025-10-18 18:00:00+00', now())
           on conflict (user_a, user_b) do update
             set relationship_start = excluded.relationship_start,
                 updated_at = excluded.updated_at$$,
         current_setting('tests.lo'), current_setting('tests.hi')),
  'CS-DB-014: a partner can create the couple row with an upsert');

select is((select relationship_start from public.couple_settings),
  timestamptz '2025-10-18 18:00:00+00', 'CS-DB-015: the writing partner reads the start date');

select tests.authenticate_as(current_setting('tests.a')::uuid);

select is((select relationship_start from public.couple_settings),
  timestamptz '2025-10-18 18:00:00+00', 'CS-DB-016: the other partner reads the same start date');

-- ---------------------------------------------------------------------------
-- The other partner updates it (last write wins), through the same upsert
-- ---------------------------------------------------------------------------

select lives_ok(
  format($$insert into public.couple_settings (user_a, user_b, relationship_start, updated_at)
           values (%L, %L, timestamptz '2025-10-19 09:30:00+00', now())
           on conflict (user_a, user_b) do update
             set relationship_start = excluded.relationship_start,
                 updated_at = excluded.updated_at$$,
         current_setting('tests.lo'), current_setting('tests.hi')),
  'CS-DB-017: the other partner can update the start date with an upsert');

select tests.authenticate_as(current_setting('tests.b')::uuid);

select is((select relationship_start from public.couple_settings),
  timestamptz '2025-10-19 09:30:00+00', 'CS-DB-018: the first partner reads the newer date');

select is((select count(*)::int from public.couple_settings), 1,
  'CS-DB-019: the upserts left exactly one row for the couple');

select tests.be_postgres();

select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$update public.couple_settings set relationship_start = null, updated_at = now()$$), 1,
  'CS-DB-020: a partner can clear the start date with a plain UPDATE');

-- ---------------------------------------------------------------------------
-- An outsider reads nothing and changes nothing
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.c')::uuid);

select is((select count(*)::int from public.couple_settings), 0,
  'CS-DB-021: an outsider reads no couple row');

select throws_ok(
  format($$insert into public.couple_settings (user_a, user_b) values (%L, %L)$$,
         current_setting('tests.lo'), current_setting('tests.hi')),
  '42501', null, 'CS-DB-022: an outsider cannot create a row for another couple');

select tests.be_postgres();

select is(tests.rows_as(current_setting('tests.c')::uuid,
  $$update public.couple_settings set relationship_start = now()$$), 0,
  'CS-DB-023: an outsider''s UPDATE affects zero rows');

-- ---------------------------------------------------------------------------
-- An unlinked account reads nothing and cannot name anyone as its pair
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.d')::uuid);

select is((select count(*)::int from public.couple_settings), 0,
  'CS-DB-024: an unlinked account reads no couple row');

select throws_ok(
  format($$insert into public.couple_settings (user_a, user_b) values (%L, %L)$$,
         current_setting('tests.dc_lo'), current_setting('tests.dc_hi')),
  '42501', null, 'CS-DB-025: an unlinked account cannot create a row naming itself and another');

select tests.be_postgres();

select is(tests.rows_as(current_setting('tests.d')::uuid,
  $$update public.couple_settings set relationship_start = now()$$), 0,
  'CS-DB-026: an unlinked account''s UPDATE affects zero rows');

-- ---------------------------------------------------------------------------
-- A partner cannot re-point the row at another pair: UPDATE states WITH CHECK
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

select throws_ok(
  format($$update public.couple_settings set user_a = least(%L::uuid, %L::uuid),
                                             user_b = greatest(%L::uuid, %L::uuid)$$,
         current_setting('tests.a'), current_setting('tests.c'),
         current_setting('tests.a'), current_setting('tests.c')),
  '42501', null, 'CS-DB-027: a partner cannot re-point the couple row at an outsider');

select throws_ok(
  format($$delete from public.couple_settings$$),
  '42501', null, 'CS-DB-028: a partner cannot DELETE the couple row');

-- ---------------------------------------------------------------------------
-- A re-linked account never sees the old couple's row
-- ---------------------------------------------------------------------------

select tests.be_postgres();

update public.users set partner_id = current_setting('tests.c')::uuid
  where id = current_setting('tests.a')::uuid;
update public.users set partner_id = current_setting('tests.a')::uuid
  where id = current_setting('tests.c')::uuid;

select tests.authenticate_as(current_setting('tests.a')::uuid);

select is((select count(*)::int from public.couple_settings), 0,
  'CS-DB-029: once re-linked, A no longer reads the old couple''s row');

select tests.be_postgres();

select * from finish();

rollback;
