-- Couple-shared events (EV-DB-001 .. 036)
--
-- The property under test: creator-only writes, both partners read. The
-- privilege layer cannot back this up -- UPDATE and DELETE must be granted for
-- the creator to use them, and a grant cannot distinguish creator from partner
-- -- so the four policy predicates pinned here are the entire security model
-- (20260818000002_create_events_table.sql).
--
-- The partner-write cases assert ROW COUNTS, not throws_ok: measured against
-- this project's stack, a partner's UPDATE or DELETE of the creator's row is
-- silently filtered to zero rows rather than raising, while a forged INSERT
-- and a row-donating UPDATE raise 42501.
--
-- Helpers are declared inline rather than pulled from 00_helpers.sql: that file
-- creates its schema inside a transaction that rolls back, so the objects do
-- not exist by the time this file runs (matches 17_love_note_removals.sql).

begin;

select plan(36);

create schema if not exists tests;

-- The helpers are called again after the role has switched to `authenticated`,
-- which cannot reach the schema without these (matches 17_love_note_removals.sql).
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

-- ---------------------------------------------------------------------------
-- Fixture: A and B are a linked couple; C is an unrelated third party.
-- B and C each own one event, inserted as postgres; A's event is inserted
-- through RLS below, as the creator-insert case itself.
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid; v_b uuid; v_c uuid;
begin
  v_a := tests.create_test_user('ev-a@test.local');
  v_b := tests.create_test_user('ev-b@test.local');
  v_c := tests.create_test_user('ev-c@test.local');

  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;

  insert into public.events (id, user_id, label, event_date)
  values ('e0000000-0000-0000-0000-0000000000bb', v_b, 'b''s own event', date '2026-10-01'),
         ('e0000000-0000-0000-0000-0000000000cc', v_c, 'c''s own event', date '2026-10-02');

  perform set_config('tests.a', v_a::text, false);
  perform set_config('tests.b', v_b::text, false);
  perform set_config('tests.c', v_c::text, false);
end
$$;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'events',
  'EV-DB-001: events table exists');

-- The blanket GRANT ALL in 20260725170000_grant_api_roles_on_public.sql leaves a
-- new public table open to every authenticated user unless RLS is turned on.
select is(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  true,
  'EV-DB-002: row level security is enabled on events');

select col_is_pk('public', 'events', 'id',
  'EV-DB-003: id is the primary key');

-- Exact set: the grants cannot express creator-only, so a fifth policy or a
-- rename here is the only early warning that the security model moved.
select policies_are('public', 'events',
  array['events_select', 'events_insert', 'events_update', 'events_delete'],
  'EV-DB-004: events carries exactly the select, insert, update and delete policies');

-- The migration's loudest design decision: a `date`, not a `timestamptz`, so
-- the calendar day is not viewer-dependent. A switch back to timestamptz would
-- pass every behavioural case below; this is what fails it.
select col_type_is('public', 'events', 'event_date', 'date',
  'EV-DB-005: event_date is a date, not a timestamptz');

select col_not_null('public', 'events', 'user_id',
  'EV-DB-006: user_id is NOT NULL');

select col_not_null('public', 'events', 'label',
  'EV-DB-007: label is NOT NULL');

select col_not_null('public', 'events', 'event_date',
  'EV-DB-008: event_date is NOT NULL');

select col_not_null('public', 'events', 'icon',
  'EV-DB-009: icon is NOT NULL');

-- All four policies apply to `authenticated` only, never implicit PUBLIC: the
-- SELECT arm calls get_my_partner_id(), on which anon holds no EXECUTE, so a
-- PUBLIC policy would turn anon's clean RLS denial into a function error.
select policy_roles_are('public', 'events', 'events_select', array['authenticated'],
  'EV-DB-010: events_select applies to authenticated only');

select policy_roles_are('public', 'events', 'events_insert', array['authenticated'],
  'EV-DB-011: events_insert applies to authenticated only');

select policy_roles_are('public', 'events', 'events_update', array['authenticated'],
  'EV-DB-012: events_update applies to authenticated only');

select policy_roles_are('public', 'events', 'events_delete', array['authenticated'],
  'EV-DB-013: events_delete applies to authenticated only');

-- anon's zero privileges are load-bearing and easy to lose: the ALTER DEFAULT
-- PRIVILEGES in 20260725170000:40-43 grants ALL on every future public table to
-- anon, and only the revoke at the end of 20260818000002 undoes that. A later
-- blanket re-grant, or a DROP/CREATE re-deriving the ACL, would pass every
-- other assertion in this file.
select ok(
  not has_table_privilege('anon', 'public.events', 'SELECT'),
  'EV-DB-014: anon cannot SELECT events');

select ok(
  not has_table_privilege('anon', 'public.events', 'INSERT'),
  'EV-DB-015: anon cannot INSERT events');

select ok(
  not has_table_privilege('anon', 'public.events', 'UPDATE'),
  'EV-DB-016: anon cannot UPDATE events');

select ok(
  not has_table_privilege('anon', 'public.events', 'DELETE'),
  'EV-DB-017: anon cannot DELETE events');

-- ---------------------------------------------------------------------------
-- Creator insert
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

select lives_ok(
  format($$insert into public.events (id, user_id, label, event_date, description, icon)
           values ('e0000000-0000-0000-0000-0000000000aa', %L,
                   'visit to new york', date '2026-09-12', 'first visit', 'plane')$$,
         current_setting('tests.a')),
  'EV-DB-018: a user can insert an event under their own user_id');

-- ---------------------------------------------------------------------------
-- Partner read, both directions
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.b')::uuid);

select is(
  (select count(*)::int from public.events
    where user_id = current_setting('tests.a')::uuid),
  1,
  'EV-DB-019: the linked partner reads the creator''s event');

select is(
  (select count(*)::int from public.events),
  2,
  'EV-DB-020: the partner reads exactly their own rows plus the creator''s');

-- The reverse direction is a separate policy evaluation -- A's SELECT resolves
-- get_my_partner_id() from A's own users row, not B's.
select tests.authenticate_as(current_setting('tests.a')::uuid);

select is(
  (select count(*)::int from public.events
    where user_id = current_setting('tests.b')::uuid),
  1,
  'EV-DB-021: the creator reads the partner''s event too');

-- ---------------------------------------------------------------------------
-- Third-party read: C sees none of A's or B's rows, own only
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.c')::uuid);

select is(
  (select count(*)::int from public.events
    where user_id in (current_setting('tests.a')::uuid,
                      current_setting('tests.b')::uuid)),
  0,
  'EV-DB-022: an unlinked user reads none of the couple''s events');

select is(
  (select count(*)::int from public.events),
  1,
  'EV-DB-023: an unlinked user reads their own rows only');

-- ---------------------------------------------------------------------------
-- Partner write: silently filtered to zero rows, no error
-- ---------------------------------------------------------------------------

select tests.be_postgres();

do $$
declare v_rows int;
begin
  perform tests.authenticate_as(current_setting('tests.b')::uuid);
  update public.events set label = 'hijacked'
   where id = 'e0000000-0000-0000-0000-0000000000aa';
  get diagnostics v_rows = row_count;
  perform tests.be_postgres();
  perform set_config('tests.ev_rows_partner_update', v_rows::text, false);
end
$$;

select is(
  current_setting('tests.ev_rows_partner_update')::int,
  0,
  'EV-DB-024: a partner''s UPDATE of the creator''s row affects zero rows');

select is(
  (select label from public.events
    where id = 'e0000000-0000-0000-0000-0000000000aa'),
  'visit to new york',
  'EV-DB-025: the creator''s row is unchanged after the partner''s UPDATE attempt');

do $$
declare v_rows int;
begin
  perform tests.authenticate_as(current_setting('tests.b')::uuid);
  delete from public.events
   where id = 'e0000000-0000-0000-0000-0000000000aa';
  get diagnostics v_rows = row_count;
  perform tests.be_postgres();
  perform set_config('tests.ev_rows_partner_delete', v_rows::text, false);
end
$$;

select is(
  current_setting('tests.ev_rows_partner_delete')::int,
  0,
  'EV-DB-026: a partner''s DELETE of the creator''s row affects zero rows');

select is(
  (select count(*)::int from public.events
    where id = 'e0000000-0000-0000-0000-0000000000aa'),
  1,
  'EV-DB-027: the creator''s row survives the partner''s DELETE attempt');

-- ---------------------------------------------------------------------------
-- What does raise: forged insert and row donation
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.b')::uuid);

select throws_ok(
  format($$insert into public.events (user_id, label, event_date)
           values (%L, 'forged', date '2026-11-01')$$,
         current_setting('tests.a')),
  '42501',
  'new row violates row-level security policy for table "events"',
  'EV-DB-028: a user cannot insert an event under their partner''s user_id');

-- The UPDATE policy's WITH CHECK is what refuses this; without it Postgres
-- reuses USING as the check and the donation would succeed.
select tests.authenticate_as(current_setting('tests.a')::uuid);

select throws_ok(
  format($$update public.events set user_id = %L
            where id = 'e0000000-0000-0000-0000-0000000000aa'$$,
         current_setting('tests.b')),
  '42501',
  'new row violates row-level security policy for table "events"',
  'EV-DB-029: a creator cannot donate a row by rewriting user_id to their partner''s');

-- ---------------------------------------------------------------------------
-- The CHECK constraints: icon mirrors EventCountdown.tsx's IconType union,
-- and the two length limits each have their own case -- dropping any one of
-- the three CHECKs must fail exactly one assertion here.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$insert into public.events (user_id, label, event_date, icon)
           values (%L, 'bad icon', date '2026-12-01', 'star')$$,
         current_setting('tests.a')),
  '23514',
  null,
  'EV-DB-030: an icon outside ring/plane/calendar is rejected by the CHECK');

select throws_ok(
  format($$insert into public.events (user_id, label, event_date)
           values (%L, repeat('x', 101), date '2026-12-02')$$,
         current_setting('tests.a')),
  '23514',
  null,
  'EV-DB-031: a label over 100 characters is rejected by the CHECK');

select throws_ok(
  format($$insert into public.events (user_id, label, event_date, description)
           values (%L, 'long description', date '2026-12-03', repeat('x', 501))$$,
         current_setting('tests.a')),
  '23514',
  null,
  'EV-DB-032: a description over 500 characters is rejected by the CHECK');

-- ---------------------------------------------------------------------------
-- The creator's own writes still work, so the policies are not just deny-all
-- ---------------------------------------------------------------------------

select tests.be_postgres();

do $$
declare v_rows int;
begin
  perform tests.authenticate_as(current_setting('tests.a')::uuid);
  update public.events set label = 'visit rescheduled', event_date = date '2026-09-19'
   where id = 'e0000000-0000-0000-0000-0000000000aa';
  get diagnostics v_rows = row_count;
  perform tests.be_postgres();
  perform set_config('tests.ev_rows_creator_update', v_rows::text, false);
end
$$;

select is(
  current_setting('tests.ev_rows_creator_update')::int,
  1,
  'EV-DB-033: the creator''s own UPDATE affects exactly their row');

do $$
declare v_rows int;
begin
  perform tests.authenticate_as(current_setting('tests.a')::uuid);
  delete from public.events
   where id = 'e0000000-0000-0000-0000-0000000000aa';
  get diagnostics v_rows = row_count;
  perform tests.be_postgres();
  perform set_config('tests.ev_rows_creator_delete', v_rows::text, false);
end
$$;

select is(
  current_setting('tests.ev_rows_creator_delete')::int,
  1,
  'EV-DB-034: the creator''s own DELETE affects exactly their row');

-- ---------------------------------------------------------------------------
-- Defaults and cascade
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

insert into public.events (id, user_id, label, event_date)
values ('e0000000-0000-0000-0000-0000000000dd',
        current_setting('tests.a')::uuid, 'no icon sent', date '2026-12-04');

select is(
  (select icon from public.events
    where id = 'e0000000-0000-0000-0000-0000000000dd'),
  'calendar',
  'EV-DB-035: an insert omitting icon lands as ''calendar''');

-- Last, because it destroys fixture user C: deleting the auth.users row must
-- take the events rows with it, or a deleted account leaves orphaned events.
select tests.be_postgres();

delete from auth.users where id = current_setting('tests.c')::uuid;

select is(
  (select count(*)::int from public.events
    where user_id = current_setting('tests.c')::uuid),
  0,
  'EV-DB-036: deleting the auth user cascades to their events');

select * from finish();

rollback;
