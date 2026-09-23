-- Account data moved off the device (LD-DB-001 .. 070)
--
-- The property under test: anniversaries, custom_messages and message_favorites
-- are private to their author. Unlike public.events the partner reads NOTHING
-- here -- no policy calls get_my_partner_id() -- so the partner and an
-- unrelated stranger must behave identically
-- (20260922000000_local_data_tables.sql).
--
-- Cross-user UPDATE and DELETE are asserted as ROW COUNTS: RLS filters them to
-- zero rows rather than raising, while a forged INSERT and a row-donating
-- UPDATE raise 42501 (same measured behaviour as 20_events.sql).
--
-- Helpers are declared inline: 00_helpers.sql rolls back before this file runs.
--
-- Gaps in the numbering are retired assertions; the remaining ids keep their
-- numbers.

begin;

select plan(57);

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
-- Fixture: A and B are a linked couple; C is an unrelated third party.
-- A owns one row in every table, inserted as postgres.
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid; v_b uuid; v_c uuid;
begin
  v_a := tests.create_test_user('ld-a@test.local');
  v_b := tests.create_test_user('ld-b@test.local');
  v_c := tests.create_test_user('ld-c@test.local');

  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;

  insert into public.anniversaries (id, user_id, event_date, label, client_key)
  values ('a0000000-0000-0000-0000-0000000000aa', v_a, date '2024-02-14',
          'first date', 'a:2024-02-14:k');
  insert into public.custom_messages (id, user_id, text, category, client_key)
  values ('c0000000-0000-0000-0000-0000000000aa', v_a, 'a private note',
          'custom', 'c:1:k');
  insert into public.message_favorites (user_id, message_key)
  values (v_a, 'b:abc');

  perform set_config('tests.a', v_a::text, false);
  perform set_config('tests.b', v_b::text, false);
  perform set_config('tests.c', v_c::text, false);
end
$$;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'anniversaries', 'LD-DB-001: anniversaries exists');
select has_table('public', 'custom_messages', 'LD-DB-002: custom_messages exists');
select has_table('public', 'message_favorites', 'LD-DB-003: message_favorites exists');

select is((select relrowsecurity from pg_class where oid = 'public.anniversaries'::regclass),
  true, 'LD-DB-005: RLS is enabled on anniversaries');
select is((select relrowsecurity from pg_class where oid = 'public.custom_messages'::regclass),
  true, 'LD-DB-006: RLS is enabled on custom_messages');
select is((select relrowsecurity from pg_class where oid = 'public.message_favorites'::regclass),
  true, 'LD-DB-007: RLS is enabled on message_favorites');

select policies_are('public', 'anniversaries',
  array['anniversaries_select', 'anniversaries_insert', 'anniversaries_update',
        'anniversaries_delete'],
  'LD-DB-009: anniversaries carries exactly the four owner policies');
select policies_are('public', 'custom_messages',
  array['custom_messages_select', 'custom_messages_insert', 'custom_messages_update',
        'custom_messages_delete'],
  'LD-DB-010: custom_messages carries exactly the four owner policies');
select policies_are('public', 'message_favorites',
  array['message_favorites_select', 'message_favorites_insert', 'message_favorites_delete'],
  'LD-DB-011: message_favorites carries select, insert and delete only');

select policy_roles_are('public', 'anniversaries', 'anniversaries_select', array['authenticated'],
  'LD-DB-013: anniversaries_select applies to authenticated only');
select policy_roles_are('public', 'anniversaries', 'anniversaries_insert', array['authenticated'],
  'LD-DB-014: anniversaries_insert applies to authenticated only');
select policy_roles_are('public', 'anniversaries', 'anniversaries_update', array['authenticated'],
  'LD-DB-015: anniversaries_update applies to authenticated only');
select policy_roles_are('public', 'anniversaries', 'anniversaries_delete', array['authenticated'],
  'LD-DB-016: anniversaries_delete applies to authenticated only');
select policy_roles_are('public', 'custom_messages', 'custom_messages_select', array['authenticated'],
  'LD-DB-017: custom_messages_select applies to authenticated only');
select policy_roles_are('public', 'custom_messages', 'custom_messages_insert', array['authenticated'],
  'LD-DB-018: custom_messages_insert applies to authenticated only');
select policy_roles_are('public', 'custom_messages', 'custom_messages_update', array['authenticated'],
  'LD-DB-019: custom_messages_update applies to authenticated only');
select policy_roles_are('public', 'custom_messages', 'custom_messages_delete', array['authenticated'],
  'LD-DB-020: custom_messages_delete applies to authenticated only');
select policy_roles_are('public', 'message_favorites', 'message_favorites_select', array['authenticated'],
  'LD-DB-021: message_favorites_select applies to authenticated only');
select policy_roles_are('public', 'message_favorites', 'message_favorites_insert', array['authenticated'],
  'LD-DB-022: message_favorites_insert applies to authenticated only');
select policy_roles_are('public', 'message_favorites', 'message_favorites_delete', array['authenticated'],
  'LD-DB-023: message_favorites_delete applies to authenticated only');

-- anon's zero privileges undo the ALTER DEFAULT PRIVILEGES in 20260725170000.
select ok(not (has_table_privilege('anon', 'public.anniversaries', 'SELECT')
            or has_table_privilege('anon', 'public.anniversaries', 'INSERT')
            or has_table_privilege('anon', 'public.anniversaries', 'UPDATE')
            or has_table_privilege('anon', 'public.anniversaries', 'DELETE')),
  'LD-DB-026: anon holds no privilege on anniversaries');
select ok(not (has_table_privilege('anon', 'public.custom_messages', 'SELECT')
            or has_table_privilege('anon', 'public.custom_messages', 'INSERT')
            or has_table_privilege('anon', 'public.custom_messages', 'UPDATE')
            or has_table_privilege('anon', 'public.custom_messages', 'DELETE')),
  'LD-DB-027: anon holds no privilege on custom_messages');
select ok(not (has_table_privilege('anon', 'public.message_favorites', 'SELECT')
            or has_table_privilege('anon', 'public.message_favorites', 'INSERT')
            or has_table_privilege('anon', 'public.message_favorites', 'UPDATE')
            or has_table_privilege('anon', 'public.message_favorites', 'DELETE')),
  'LD-DB-028: anon holds no privilege on message_favorites');

select ok(not has_table_privilege('authenticated', 'public.message_favorites', 'UPDATE'),
  'LD-DB-030: authenticated cannot UPDATE message_favorites');

-- ---------------------------------------------------------------------------
-- Reads: the owner sees their row; the partner and a stranger see nothing
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

select is((select count(*)::int from public.anniversaries), 1,
  'LD-DB-033: the owner reads their anniversary');
select is((select count(*)::int from public.custom_messages), 1,
  'LD-DB-034: the owner reads their custom message');
select is((select count(*)::int from public.message_favorites), 1,
  'LD-DB-035: the owner reads their favorite');

select tests.authenticate_as(current_setting('tests.b')::uuid);

select is((select count(*)::int from public.anniversaries), 0,
  'LD-DB-037: the partner reads no anniversaries');
select is((select count(*)::int from public.custom_messages), 0,
  'LD-DB-038: the partner reads no custom messages');
select is((select count(*)::int from public.message_favorites), 0,
  'LD-DB-039: the partner reads no favorites');

select tests.authenticate_as(current_setting('tests.c')::uuid);

select is((select count(*)::int from public.anniversaries), 0,
  'LD-DB-041: a stranger reads no anniversaries');
select is((select count(*)::int from public.custom_messages), 0,
  'LD-DB-042: a stranger reads no custom messages');
select is((select count(*)::int from public.message_favorites), 0,
  'LD-DB-043: a stranger reads no favorites');

-- ---------------------------------------------------------------------------
-- Forged inserts raise
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.b')::uuid);

select throws_ok(
  format($$insert into public.anniversaries (user_id, event_date, label)
           values (%L, date '2025-01-01', 'forged')$$, current_setting('tests.a')),
  '42501', null, 'LD-DB-045: the partner cannot insert an anniversary as the owner');
select throws_ok(
  format($$insert into public.custom_messages (user_id, text, category)
           values (%L, 'forged', 'custom')$$, current_setting('tests.a')),
  '42501', null, 'LD-DB-046: the partner cannot insert a custom message as the owner');
select throws_ok(
  format($$insert into public.message_favorites (user_id, message_key)
           values (%L, 'b:forged')$$, current_setting('tests.a')),
  '42501', null, 'LD-DB-047: the partner cannot insert a favorite as the owner');

select tests.be_postgres();

-- ---------------------------------------------------------------------------
-- Cross-user UPDATE and DELETE are filtered to zero rows
-- ---------------------------------------------------------------------------

select is(tests.rows_as(current_setting('tests.b')::uuid,
  $$update public.anniversaries set label = 'hijacked'
     where id = 'a0000000-0000-0000-0000-0000000000aa'$$), 0,
  'LD-DB-049: the partner''s UPDATE of an anniversary affects zero rows');
select is(tests.rows_as(current_setting('tests.b')::uuid,
  $$update public.custom_messages set text = 'hijacked'
     where id = 'c0000000-0000-0000-0000-0000000000aa'$$), 0,
  'LD-DB-050: the partner''s UPDATE of a custom message affects zero rows');
select is(tests.rows_as(current_setting('tests.b')::uuid,
  $$delete from public.anniversaries where id = 'a0000000-0000-0000-0000-0000000000aa'$$), 0,
  'LD-DB-051: the partner''s DELETE of an anniversary affects zero rows');
select is(tests.rows_as(current_setting('tests.b')::uuid,
  $$delete from public.custom_messages where id = 'c0000000-0000-0000-0000-0000000000aa'$$), 0,
  'LD-DB-052: the partner''s DELETE of a custom message affects zero rows');
select is(tests.rows_as(current_setting('tests.c')::uuid,
  $$delete from public.message_favorites where message_key = 'b:abc'$$), 0,
  'LD-DB-053: a stranger''s DELETE of a favorite affects zero rows');

-- ---------------------------------------------------------------------------
-- Row donation raises: UPDATE states WITH CHECK
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

select throws_ok(
  format($$update public.anniversaries set user_id = %L
            where id = 'a0000000-0000-0000-0000-0000000000aa'$$, current_setting('tests.b')),
  '42501', null, 'LD-DB-054: an owner cannot donate an anniversary to the partner');
select throws_ok(
  format($$update public.custom_messages set user_id = %L
            where id = 'c0000000-0000-0000-0000-0000000000aa'$$, current_setting('tests.b')),
  '42501', null, 'LD-DB-055: an owner cannot donate a custom message to the partner');

-- ---------------------------------------------------------------------------
-- Idempotency: UNIQUE (user_id, client_key), and ON CONFLICT DO NOTHING
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.anniversaries (user_id, event_date, label, client_key)
           values (%L, date '2024-02-14', 'first date', 'a:2024-02-14:k')$$,
         current_setting('tests.a')),
  '23505', null, 'LD-DB-056: a second anniversary with the same client_key is refused');
select throws_ok(
  format($$insert into public.custom_messages (user_id, text, category, client_key)
           values (%L, 'a private note', 'custom', 'c:1:k')$$, current_setting('tests.a')),
  '23505', null, 'LD-DB-057: a second custom message with the same client_key is refused');

select lives_ok(
  format($$insert into public.custom_messages (user_id, text, category, client_key)
           values (%L, 'a private note', 'custom', 'c:1:k')
           on conflict (user_id, client_key) do nothing$$, current_setting('tests.a')),
  'LD-DB-058: a retried create''s ON CONFLICT DO NOTHING insert succeeds without UPDATE');
select is((select count(*)::int from public.custom_messages), 1,
  'LD-DB-059: the ignored duplicate left exactly one row');

-- ---------------------------------------------------------------------------
-- CHECK constraints mirror the Zod schemas
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.custom_messages (user_id, text, category)
           values (%L, 'x', 'poem')$$, current_setting('tests.a')),
  '23514', null, 'LD-DB-060: a category outside MessageCategory is rejected');
select throws_ok(
  format($$insert into public.custom_messages (user_id, text, category)
           values (%L, repeat('x', 1001), 'custom')$$, current_setting('tests.a')),
  '23514', null, 'LD-DB-061: custom message text over 1000 characters is rejected');
select throws_ok(
  format($$insert into public.custom_messages (user_id, text, category)
           values (%L, '   ', 'custom')$$, current_setting('tests.a')),
  '23514', null, 'LD-DB-062: blank custom message text is rejected');
select throws_ok(
  format($$insert into public.anniversaries (user_id, event_date, label)
           values (%L, date '2025-01-01', '')$$, current_setting('tests.a')),
  '23514', null, 'LD-DB-063: an empty anniversary label is rejected');

-- ---------------------------------------------------------------------------
-- The owner's own writes work, so the policies are not deny-all
-- ---------------------------------------------------------------------------

select tests.be_postgres();

select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$update public.anniversaries set label = 'first date!', updated_at = now()
     where id = 'a0000000-0000-0000-0000-0000000000aa'$$), 1,
  'LD-DB-064: the owner''s UPDATE of their anniversary affects their row');
select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$update public.custom_messages set is_favorite = true, updated_at = now()
     where id = 'c0000000-0000-0000-0000-0000000000aa'$$), 1,
  'LD-DB-065: the owner''s UPDATE of their custom message affects their row');
select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$delete from public.message_favorites where message_key = 'b:abc'$$), 1,
  'LD-DB-066: the owner''s DELETE of their favorite affects their row');

-- The favorite insert is every bundled favorite; it runs as the owner through
-- RLS here, not as postgres.
select tests.authenticate_as(current_setting('tests.a')::uuid);

select lives_ok(
  format($$insert into public.message_favorites (user_id, message_key)
           values (%L, 'b:owner-insert')
           on conflict (user_id, message_key) do nothing$$, current_setting('tests.a')),
  'LD-DB-068: the owner can insert their own favorite (as addFavorite does)');

select tests.be_postgres();

select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$delete from public.anniversaries where id = 'a0000000-0000-0000-0000-0000000000aa'$$), 1,
  'LD-DB-069: the owner''s DELETE of their anniversary affects their row');
select is(tests.rows_as(current_setting('tests.a')::uuid,
  $$delete from public.custom_messages where id = 'c0000000-0000-0000-0000-0000000000aa'$$), 1,
  'LD-DB-070: the owner''s DELETE of their custom message affects their row');

select * from finish();

rollback;
