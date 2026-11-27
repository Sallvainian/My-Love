-- ============================================
-- pgTAP: the sender's schema for the five daily pushes (20261125000000; daily_nudges
-- as story 11.1's 20261127000000 reshaped it: source, held, released_at)
--
-- Story 8.3 of epic-daily-pushes-and-nudge (architecture-daily-question:
-- AD-3, AD-9, AD-10, AD-15, AD-17). Pinned here:
--   * daily_nudges and daily_reminders: their columns, the source check, the
--     reminder slot as a stored generated column (an insert cannot set it), the
--     kind check, the two unique keys, day_id not null, RLS on with no policy,
--     no privilege for anon or authenticated, and service_role able to insert.
--   * push_requests: the three new source columns with their (id, token) unique
--     keys, the source check over all eleven sources (none and two refused), and
--     the cascades from couple_days (nudge, reminder and their requests) and
--     from a pick.
--   * push_preferences: the five daily switches, each on by default.
--   * user_local_date: the stored zone's date at fixed instants across midnight,
--     UTC with no row, null for a null argument, security definer, stable, an
--     empty search_path, and executable by service_role only.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(76);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Daily ' || left(test_email, 6))
    on conflict (id) do nothing;
  return user_id;
end; $$;

create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', test_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- Two accounts, a < b, and a third that has no pair.
create temporary table t_users (label text primary key, id uuid not null);
grant select on t_users to authenticated, anon, service_role;

-- The pair is built explicitly, so the ordering never depends on gen_random_uuid.
do $$
declare
  v_x uuid := tests.create_test_user('daily-push-x@example.com');
  v_y uuid := tests.create_test_user('daily-push-y@example.com');
  v_z uuid := tests.create_test_user('daily-push-z@example.com');
begin
  insert into t_users values ('a', least(v_x, v_y)), ('b', greatest(v_x, v_y)), ('z', v_z);
end $$;

create or replace function pg_temp.u(p text) returns uuid language sql stable as $$ select id from t_users where label = p $$;

-- One coach question, and the pair's days.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values ('Tea', 'Coffee'), ('Cats', 'Dogs'), ('Sun', 'Rain');

create temporary table t_days (label text primary key, id uuid not null);
grant select on t_days to authenticated, anon, service_role;
insert into t_days values
  ('d1', (public.assign_couple_day(pg_temp.u('a'), pg_temp.u('b'), date '2030-07-01')).id),
  ('d2', (public.assign_couple_day(pg_temp.u('a'), pg_temp.u('b'), date '2030-07-02')).id),
  ('d3', (public.assign_couple_day(pg_temp.u('a'), pg_temp.u('b'), date '2030-07-03')).id);
create or replace function pg_temp.d(p text) returns uuid language sql stable as $$ select id from t_days where label = p $$;

-- ============================================
-- Tables and columns
-- ============================================
select has_table('public', 'daily_nudges', 'DAILY-PUSH-001: daily_nudges exists');
select has_table('public', 'daily_reminders', 'DAILY-PUSH-002: daily_reminders exists');

select columns_are('public', 'daily_nudges',
  array['id', 'from_user', 'to_user', 'day_id', 'source', 'held', 'released_at', 'created_at'],
  'DAILY-PUSH-003: daily_nudges has exactly its eight columns');
select columns_are('public', 'daily_reminders',
  array['id', 'user_id', 'kind', 'slot', 'local_date', 'day_id', 'created_at'],
  'DAILY-PUSH-004: daily_reminders has exactly its seven columns');

select col_not_null('public', 'daily_nudges', 'day_id', 'DAILY-PUSH-005: daily_nudges.day_id is not null');
select col_not_null('public', 'daily_reminders', 'day_id', 'DAILY-PUSH-006: daily_reminders.day_id is not null');
select col_not_null('public', 'daily_reminders', 'slot', 'DAILY-PUSH-071: daily_reminders.slot is not null');
select col_not_null('public', 'daily_reminders', 'local_date', 'DAILY-PUSH-072: daily_reminders.local_date is not null');
select col_not_null('public', 'daily_nudges', 'source', 'DAILY-PUSH-073: daily_nudges.source is not null');
select col_not_null('public', 'daily_nudges', 'held', 'DAILY-PUSH-074: daily_nudges.held is not null');
select ok(
  (select a.attgenerated = 's' from pg_attribute a
    where a.attrelid = 'public.daily_reminders'::regclass and a.attname = 'slot'),
  'DAILY-PUSH-007: daily_reminders.slot is a stored generated column'
);

-- ============================================
-- RLS and grants
-- ============================================
select is(
  (select count(*)::int from pg_class c
    where c.oid in ('public.daily_nudges'::regclass, 'public.daily_reminders'::regclass) and c.relrowsecurity),
  2,
  'DAILY-PUSH-008: both tables have row level security on'
);
select is(
  (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename in ('daily_nudges', 'daily_reminders')),
  0,
  'DAILY-PUSH-009: neither table has a policy'
);
select is(
  (select count(*)::int
     from unnest(array['daily_nudges', 'daily_reminders']) as t(tbl),
          unnest(array['anon', 'authenticated']) as r(rolename),
          unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(priv)
    where has_table_privilege(r.rolename, format('public.%I', t.tbl), p.priv)),
  0,
  'DAILY-PUSH-010: anon and authenticated hold no privilege on either table'
);
select is(
  (select count(*)::int
     from unnest(array['daily_nudges', 'daily_reminders']) as t(tbl),
          unnest(array['anon', 'authenticated']) as r(rolename)
    where has_any_column_privilege(r.rolename, format('public.%I', t.tbl), 'SELECT')
       or has_any_column_privilege(r.rolename, format('public.%I', t.tbl), 'INSERT')
       or has_any_column_privilege(r.rolename, format('public.%I', t.tbl), 'UPDATE')),
  0,
  'DAILY-PUSH-011: and no column privilege either'
);
select ok(
  has_table_privilege('service_role', 'public.daily_nudges', 'SELECT, INSERT, UPDATE, DELETE')
  and has_table_privilege('service_role', 'public.daily_reminders', 'SELECT, INSERT, UPDATE, DELETE'),
  'DAILY-PUSH-012: service_role keeps its default privileges on both tables'
);

select tests.authenticate_as(pg_temp.u('a'));
select throws_ok(
  'select count(*) from public.daily_nudges', '42501', null,
  'DAILY-PUSH-013: a signed-in user cannot read daily_nudges'
);
select throws_ok(
  'select count(*) from public.daily_reminders', '42501', null,
  'DAILY-PUSH-014: a signed-in user cannot read daily_reminders'
);
reset role;

-- ============================================
-- daily_nudges as service_role
-- ============================================
set local role service_role;

select lives_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'prompt')$$, pg_temp.u('a'), pg_temp.u('b'), pg_temp.d('d1')),
  'DAILY-PUSH-015: service_role inserts a nudge'
);
select throws_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'prompt')$$, pg_temp.u('a'), pg_temp.u('b'), pg_temp.d('d1')),
  '23505', null,
  'DAILY-PUSH-016: a second nudge by the same sender, day and source is refused'
);
select lives_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'button')$$, pg_temp.u('a'), pg_temp.u('b'), pg_temp.d('d1')),
  'DAILY-PUSH-017: the same sender and day from the other source is allowed'
);
select lives_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'prompt')$$, pg_temp.u('a'), pg_temp.u('b'), pg_temp.d('d2')),
  'DAILY-PUSH-018: the key is the sender, the day and the source: the same source on another day is allowed'
);
select lives_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'prompt')$$, pg_temp.u('b'), pg_temp.u('a'), pg_temp.d('d1')),
  'DAILY-PUSH-019: the other partner has their own sources'
);
select throws_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'midday')$$, pg_temp.u('a'), pg_temp.u('b'), pg_temp.d('d3')),
  '23514', null,
  'DAILY-PUSH-020: a source other than prompt or button is refused'
);
select throws_ok(
  format($$insert into public.daily_nudges (from_user, to_user, day_id, source)
           values (%L, %L, %L, 'prompt')$$, pg_temp.u('a'), pg_temp.u('b'), gen_random_uuid()),
  '23503', null,
  'DAILY-PUSH-021: a nudge needs an existing day'
);
select is(
  (select held::text || ',' || coalesce(released_at::text, 'null') from public.daily_nudges
    where from_user = pg_temp.u('a') and day_id = pg_temp.d('d1') and source = 'prompt'),
  'false,null',
  'DAILY-PUSH-075: a nudge is not held and not released unless it says so'
);
select is(
  (select array_agg(a.attname order by k.ord)
     from pg_constraint c
     cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
     join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.conrelid = 'public.daily_nudges'::regclass and c.conname = 'daily_nudges_sender_day_source_key'),
  array['from_user', 'day_id', 'source']::name[],
  'DAILY-PUSH-076: the limit is the unique key (from_user, day_id, source)'
);

-- ============================================
-- daily_reminders as service_role
-- ============================================
select lives_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'morning', date '2030-07-01', %L)$$, pg_temp.u('a'), pg_temp.d('d1')),
  'DAILY-PUSH-022: service_role inserts a morning reminder'
);
select lives_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'evening_self', date '2030-07-01', %L)$$, pg_temp.u('a'), pg_temp.d('d1')),
  'DAILY-PUSH-023: and an evening one for the same date'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'evening_partner', date '2030-07-01', %L)$$, pg_temp.u('a'), pg_temp.d('d1')),
  '23505', null,
  'DAILY-PUSH-024: the two evening kinds share one slot, so a second evening reminder is refused'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'morning', date '2030-07-01', %L)$$, pg_temp.u('a'), pg_temp.d('d1')),
  '23505', null,
  'DAILY-PUSH-025: a second morning reminder on the same date is refused'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, slot, local_date, day_id)
           values (%L, 'morning', 'evening', date '2030-07-02', %L)$$, pg_temp.u('a'), pg_temp.d('d2')),
  '428C9', null,
  'DAILY-PUSH-026: an insert cannot set the generated slot'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'noon', date '2030-07-02', %L)$$, pg_temp.u('a'), pg_temp.d('d2')),
  '23514', null,
  'DAILY-PUSH-027: a kind other than morning, evening_self or evening_partner is refused'
);
select lives_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'evening_partner', date '2030-07-02', %L)$$, pg_temp.u('a'), pg_temp.d('d2')),
  'DAILY-PUSH-028: evening_partner on another date is allowed'
);
select is(
  (select string_agg(r.kind || '=' || r.slot, ',' order by r.local_date, r.kind)
     from public.daily_reminders r where r.user_id = pg_temp.u('a')),
  'evening_self=evening,morning=morning,evening_partner=evening',
  'DAILY-PUSH-029: the slot follows the kind: morning for morning, evening for both evening kinds'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'morning', date '2030-07-03', null)$$, pg_temp.u('a')),
  '23502', null,
  'DAILY-PUSH-030: a reminder needs a day'
);

reset role;

-- ============================================
-- push_requests: three more sources
-- ============================================
select has_column('public', 'push_requests', 'daily_pick_id', 'DAILY-PUSH-031: push_requests.daily_pick_id exists');
select has_column('public', 'push_requests', 'daily_nudge_id', 'DAILY-PUSH-032: push_requests.daily_nudge_id exists');
select has_column('public', 'push_requests', 'daily_reminder_id', 'DAILY-PUSH-033: push_requests.daily_reminder_id exists');
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.push_requests'::regclass
      and conname in ('push_requests_daily_pick_token_key', 'push_requests_daily_nudge_token_key',
                      'push_requests_daily_reminder_token_key')
      and contype = 'u'),
  3,
  'DAILY-PUSH-034: each new source has its (id, token) unique key'
);
select is(
  (select count(*)::int
     from regexp_matches(
       (select pg_get_constraintdef(oid) from pg_constraint
         where conrelid = 'public.push_requests'::regclass and conname = 'push_requests_source_check'),
       '(note_id|mood_id|photo_id|interaction_id|partner_request_id|partner_accept_id|event_id|anniversary_id|daily_pick_id|daily_nudge_id|daily_reminder_id)', 'g')),
  11,
  'DAILY-PUSH-035: the source check names all eleven sources'
);
select is(
  (select count(*)::int from pg_constraint c
    where c.conrelid = 'public.push_requests'::regclass
      and c.contype = 'f'
      and c.confdeltype = 'c'
      and c.conkey && array[
        (select attnum from pg_attribute where attrelid = 'public.push_requests'::regclass and attname = 'daily_pick_id'),
        (select attnum from pg_attribute where attrelid = 'public.push_requests'::regclass and attname = 'daily_nudge_id'),
        (select attnum from pg_attribute where attrelid = 'public.push_requests'::regclass and attname = 'daily_reminder_id')
      ]),
  3,
  'DAILY-PUSH-036: each new source cascades with its row'
);

-- Picks for the cascade checks (a pick of each partner on d3).
insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
values (pg_temp.d('d3'), pg_temp.u('a'), 'this', timestamptz '2030-07-03 12:00:00+00', 'UTC', 0, 'UTC', false),
       (pg_temp.d('d3'), pg_temp.u('b'), 'that', timestamptz '2030-07-03 13:00:00+00', 'UTC', 0, 'UTC', true);

set local role service_role;

select lives_ok(
  format($$insert into public.push_requests (daily_pick_id, token, environment, payload, delivery)
           values (%L, 'tok-1', 'sandbox', '{}'::jsonb, 'recorded')$$,
         (select p.id from public.daily_picks p where p.day_id = pg_temp.d('d3') and p.user_id = pg_temp.u('a'))),
  'DAILY-PUSH-037: a request with only a pick source is accepted'
);
select throws_ok(
  format($$insert into public.push_requests (daily_pick_id, token, environment, payload, delivery)
           values (%L, 'tok-1', 'sandbox', '{}'::jsonb, 'recorded')$$,
         (select p.id from public.daily_picks p where p.day_id = pg_temp.d('d3') and p.user_id = pg_temp.u('a'))),
  '23505', null,
  'DAILY-PUSH-038: a second request for the same pick and token is refused'
);
select lives_ok(
  format($$insert into public.push_requests (daily_pick_id, token, environment, payload, delivery)
           values (%L, 'tok-2', 'sandbox', '{}'::jsonb, 'recorded')$$,
         (select p.id from public.daily_picks p where p.day_id = pg_temp.d('d3') and p.user_id = pg_temp.u('a'))),
  'DAILY-PUSH-039: the same pick for another token is accepted'
);
select lives_ok(
  format($$insert into public.push_requests (daily_nudge_id, token, environment, payload, delivery)
           select n.id, 'tok-1', 'production', '{}'::jsonb, 'sent' from public.daily_nudges n
            where n.from_user = %L and n.day_id = %L and n.source = 'prompt'$$, pg_temp.u('a'), pg_temp.d('d1')),
  'DAILY-PUSH-040: a request with only a nudge source is accepted'
);
select lives_ok(
  format($$insert into public.push_requests (daily_reminder_id, token, environment, payload, delivery)
           select r.id, 'tok-1', 'sandbox', '{}'::jsonb, 'recorded' from public.daily_reminders r
            where r.user_id = %L and r.kind = 'morning'$$, pg_temp.u('a')),
  'DAILY-PUSH-041: a request with only a reminder source is accepted'
);
select throws_ok(
  format($$insert into public.push_requests (daily_pick_id, daily_nudge_id, token, environment, payload, delivery)
           select (select p.id from public.daily_picks p where p.day_id = %L and p.user_id = %L),
                  n.id, 'tok-3', 'sandbox', '{}'::jsonb, 'recorded'
             from public.daily_nudges n where n.from_user = %L and n.day_id = %L and n.source = 'prompt'$$,
         pg_temp.d('d3'), pg_temp.u('a'), pg_temp.u('a'), pg_temp.d('d1')),
  '23514', null,
  'DAILY-PUSH-042: a request with two sources is refused'
);
select throws_ok(
  $$insert into public.push_requests (token, environment, payload, delivery)
    values ('tok-4', 'sandbox', '{}'::jsonb, 'recorded')$$,
  '23514', null,
  'DAILY-PUSH-043: a request with no source is refused'
);

reset role;

-- ============================================
-- Cascades
-- ============================================
select is(
  (select count(*)::int from public.push_requests
    where daily_pick_id is not null or daily_nudge_id is not null or daily_reminder_id is not null),
  4,
  'DAILY-PUSH-044: four daily requests are recorded before the deletes'
);

delete from public.daily_picks where day_id = pg_temp.d('d3') and user_id = pg_temp.u('a');
select is(
  (select count(*)::int from public.push_requests where daily_pick_id is not null),
  0,
  'DAILY-PUSH-045: deleting a pick deletes its requests'
);
select is(
  (select count(*)::int from public.push_requests where daily_nudge_id is not null or daily_reminder_id is not null),
  2,
  'DAILY-PUSH-046: and no other request'
);

delete from public.couple_days where id = pg_temp.d('d1');
select is(
  (select count(*)::int from public.daily_nudges where day_id = pg_temp.d('d1')),
  0,
  'DAILY-PUSH-047: deleting a couple day deletes its nudges'
);
select is(
  (select count(*)::int from public.daily_reminders where day_id = pg_temp.d('d1')),
  0,
  'DAILY-PUSH-048: and its reminders'
);
select is(
  (select count(*)::int from public.push_requests where daily_nudge_id is not null or daily_reminder_id is not null),
  0,
  'DAILY-PUSH-049: and the requests recorded for them'
);
select is(
  (select count(*)::int from public.daily_reminders where day_id = pg_temp.d('d2')),
  1,
  'DAILY-PUSH-050: a reminder of another day stays'
);

-- ============================================
-- push_preferences: the five daily switches
-- ============================================
select has_column('public', 'push_preferences', 'daily_question', 'DAILY-PUSH-051: push_preferences.daily_question exists');
select has_column('public', 'push_preferences', 'daily_partner_picked', 'DAILY-PUSH-052: push_preferences.daily_partner_picked exists');
select has_column('public', 'push_preferences', 'daily_nudge', 'DAILY-PUSH-053: push_preferences.daily_nudge exists');
select has_column('public', 'push_preferences', 'daily_reminder', 'DAILY-PUSH-054: push_preferences.daily_reminder exists');
select has_column('public', 'push_preferences', 'daily_both_answered', 'DAILY-PUSH-055: push_preferences.daily_both_answered exists');

insert into public.push_preferences (user_id) values (pg_temp.u('z'));
select is(
  (select (daily_question and daily_partner_picked and daily_nudge and daily_reminder and daily_both_answered)
     from public.push_preferences where user_id = pg_temp.u('z')),
  true,
  'DAILY-PUSH-056: a new row has every daily switch on'
);
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'push_preferences'
      and column_name in ('daily_question', 'daily_partner_picked', 'daily_nudge', 'daily_reminder', 'daily_both_answered')
      and data_type = 'boolean' and is_nullable = 'NO'),
  5,
  'DAILY-PUSH-057: the five switches are boolean not null'
);

-- ============================================
-- user_local_date
-- ============================================
select has_function('public', 'user_local_date', array['uuid', 'timestamp with time zone'],
  'DAILY-PUSH-058: user_local_date(user_id, at) exists');
select is(
  (select count(*)::int from pg_proc p
    where p.oid = 'public.user_local_date(uuid, timestamptz)'::regprocedure
      and p.prosecdef and p.provolatile = 's' and p.proconfig @> array['search_path=""']),
  1,
  'DAILY-PUSH-059: it is security definer, stable and has an empty search_path'
);
select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated']) as r(rolename)
    where has_function_privilege(r.rolename, 'public.user_local_date(uuid, timestamptz)', 'EXECUTE')),
  0,
  'DAILY-PUSH-060: it is executable by neither anon nor authenticated'
);
select ok(
  has_function_privilege('service_role', 'public.user_local_date(uuid, timestamptz)', 'EXECUTE'),
  'DAILY-PUSH-061: service_role keeps EXECUTE'
);
select is(
  (select count(*)::int
     from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.user_local_date(uuid, timestamptz)'::regprocedure and acl.grantee = 0),
  0,
  'DAILY-PUSH-062: it is not granted to PUBLIC'
);

select tests.authenticate_as(pg_temp.u('a'));
select throws_ok(
  format($$select public.user_local_date(%L, now())$$, pg_temp.u('a')),
  '42501', null,
  'DAILY-PUSH-063: a signed-in caller cannot call it directly'
);
reset role;

select is(
  public.user_local_date(pg_temp.u('z'), timestamptz '2030-07-02 00:30:00+00')::text,
  '2030-07-02',
  'DAILY-PUSH-064: with no user_time_zones row the date is UTC''s'
);

insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)
-- a's reported time_zone differs from its effective_zone, so 065 to 068 fail if the function read time_zone.
values (pg_temp.u('a'), 'Europe/London', -240, 'America/New_York', timestamptz '2030-06-01 00:00:00+00'),
       (pg_temp.u('b'), 'Pacific/Auckland', 720, 'Pacific/Auckland', timestamptz '2030-06-01 00:00:00+00');

select is(
  public.user_local_date(pg_temp.u('a'), timestamptz '2030-07-02 00:30:00+00')::text,
  '2030-07-01',
  'DAILY-PUSH-065: New York is still on 07-01 half an hour after UTC midnight'
);
select is(
  public.user_local_date(pg_temp.u('b'), timestamptz '2030-07-01 23:30:00+00')::text,
  '2030-07-02',
  'DAILY-PUSH-066: Auckland is already on 07-02 half an hour before UTC midnight'
);
select is(
  public.user_local_date(pg_temp.u('a'), timestamptz '2030-07-02 04:00:00+00')::text,
  '2030-07-02',
  'DAILY-PUSH-067: New York reaches 07-02 at 04:00 UTC in July (DST-safe)'
);
select is(
  public.user_local_date(pg_temp.u('a'), timestamptz '2030-01-02 04:59:00+00')::text,
  '2030-01-01',
  'DAILY-PUSH-068: and not before 05:00 UTC in January'
);
select is(
  public.user_local_date(null, now()) is null and public.user_local_date(pg_temp.u('a'), null) is null,
  true,
  'DAILY-PUSH-069: a null user or instant answers null'
);
select is(
  (select count(*)::int from pg_proc p where p.oid = 'public.user_local_date(uuid, timestamptz)'::regprocedure
    and obj_description(p.oid, 'pg_proc') is not null),
  1,
  'DAILY-PUSH-070: the function carries a comment'
);

select * from finish();
rollback;
