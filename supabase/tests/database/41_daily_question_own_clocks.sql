-- ============================================
-- pgTAP: each partner's day runs on their own clock (20261105210000)
--
-- Story 6.2 of architecture-daily-question (AD-2, AD-3, AD-6, AD-8). Pinned here:
--   * user_time_zones: RLS on, no policy, nothing for anon or authenticated;
--     record_user_time_zone and record_daily_pick are security invoker, denied
--     to anon and authenticated and granted to service_role.
--   * record_daily_pick with fixed instants (dates in 2030): a late pick lands
--     on its own day, partners an hour apart both land, a pick dated after
--     midnight is refused with DQ001, a pick ahead of `at` or before the day
--     with DQ002, the edges of the window are inclusive of four minutes, and a
--     repeat of a stored pick is returned unchanged whatever its new picked_at.
--   * record_user_time_zone: inserts, keeps a newer row, updates on a newer
--     report, clamps a report from the future, writes nothing for a null
--     viewer or report. A pick never writes the table. Inside a pgTAP
--     transaction now() is constant, so the clamp is also checked through
--     get_daily_day, which also records an unlinked caller's zone.
--   * the client RPCs: submit_daily_pick answers DQ002 for now() + 6 minutes
--     and DQ001 for a day fetched in Pacific/Kiritimati and picked in
--     Pacific/Pago_Pago (25 hours apart, so always another date).
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(48);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Clock ' || left(test_email, 6))
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

-- a_id < b_id, so A is couple_days.user_a. o_id and d_id are a second linked
-- couple, used for the client RPCs; u_id and z_id have no partner (u_id's zone
-- is written directly with 2030 instants, z_id's through get_daily_day at now()).
create temporary table t_ids as
with u as (
  select
    tests.create_test_user('clock-1@example.com') as x,
    tests.create_test_user('clock-2@example.com') as y,
    tests.create_test_user('clock-3@example.com') as o_id,
    tests.create_test_user('clock-4@example.com') as d_id,
    tests.create_test_user('clock-5@example.com') as u_id,
    tests.create_test_user('clock-6@example.com') as z_id
)
select least(x, y) as a_id, greatest(x, y) as b_id, o_id, d_id, u_id, z_id from u;

grant select on t_ids to authenticated, anon, service_role;

update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);
update public.users set partner_id = (select d_id from t_ids) where id = (select o_id from t_ids);
update public.users set partner_id = (select o_id from t_ids) where id = (select d_id from t_ids);

-- Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

-- A and B's days, each created the noon before its date. The day of 2030-06-25
-- is created at its UTC midnight instead, for the "before the day" cases.
create temporary table t_days as
select d.label, (public.assign_couple_day(t.a_id, t.b_id, d.day)).id as id
from t_ids t,
     (values ('late', date '2030-06-20'),
             ('apart', date '2030-06-22'),
             ('ahead', date '2030-06-24'),
             ('before', date '2030-06-25'),
             ('extra', date '2030-06-26')) as d(label, day);

update public.couple_days
set created_at = (day - 1)::timestamp at time zone 'UTC' + interval '12 hours'
where id in (select id from t_days where label <> 'before');
update public.couple_days
set created_at = timestamptz '2030-06-25 00:00:00+00'
where id = (select id from t_days where label = 'before');

create or replace function pg_temp.day_of(p_label text)
returns uuid language sql stable as $$ select id from t_days where label = p_label $$;

-- ============================================
-- Structure, RLS and grants
-- ============================================
select has_table('public', 'user_time_zones', 'CLOCK-001: user_time_zones exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_time_zones'::regclass),
  'CLOCK-002: RLS is enabled on user_time_zones'
);
select policies_are('public', 'user_time_zones', array[]::text[], 'CLOCK-003: user_time_zones has no policy');
select is(
  (select count(*)::int
   from unnest(array['anon', 'authenticated']) as r(rolename)
   where has_any_column_privilege(r.rolename, 'public.user_time_zones', 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege(r.rolename, 'public.user_time_zones', 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')),
  0,
  'CLOCK-004: anon and authenticated hold no privilege on user_time_zones, SELECT included'
);
select is(
  (select array_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull order by a.attnum)
   from pg_attribute a
   where a.attrelid = 'public.user_time_zones'::regclass and a.attnum > 0 and not a.attisdropped),
  array['user_id:uuid:true', 'time_zone:text:true', 'utc_offset_minutes:integer:true',
        'effective_zone:text:true', 'reported_at:timestamp with time zone:true'],
  'CLOCK-005: user_time_zones holds the five not-null columns'
);
select is(
  (select count(*)::int
   from unnest(array['record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)',
                     'record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)']) as f(sig),
        unnest(array['anon', 'authenticated']) as r(rolename)
   where has_function_privilege(r.rolename, 'public.' || f.sig, 'EXECUTE')),
  0,
  'CLOCK-006: the two new internal functions are executable by neither anon nor authenticated'
);
select is(
  (select count(*)::int
   from unnest(array['record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)',
                     'record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)']) as f(sig)
   where has_function_privilege('service_role', 'public.' || f.sig, 'EXECUTE')),
  2,
  'CLOCK-007: service_role keeps EXECUTE on both'
);
select is(
  (select count(*)::int
   from pg_proc p
   where p.oid in ('public.record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)'::regprocedure,
                   'public.record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)'::regprocedure)
     and not p.prosecdef
     and p.proconfig @> array['search_path=""']),
  2,
  'CLOCK-008: both are security invoker with an empty search_path');

-- ============================================
-- Late pick: 23:50 in New York, recorded at 00:10 the next day
-- ============================================
select set_config('tests.late',
  public.record_daily_pick(
    (select a_id from t_ids), pg_temp.day_of('late'), 'this',
    timestamp '2030-06-20 23:50' at time zone 'America/New_York', 'America/New_York', -240,
    timestamp '2030-06-21 00:10' at time zone 'America/New_York'
  )::text, false);

select is(
  current_setting('tests.late')::jsonb ->> 'day',
  '2030-06-20',
  'CLOCK-009: a late pick is stored on its own day'
);
select is(
  current_setting('tests.late')::jsonb ->> 'state' || '/' || (current_setting('tests.late')::jsonb ->> 'my_choice'),
  'me/this',
  'CLOCK-010: and the snapshot shows it as A''s pick'
);
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone || '/' || is_second
   from public.daily_picks where day_id = pg_temp.day_of('late') and user_id = (select a_id from t_ids)),
  'America/New_York/-240/America/New_York/false',
  'CLOCK-011: with the zone sent, its effective_zone and is_second false'
);

-- ============================================
-- Picked after midnight: B in New York picks 00:10 on the 21st for the 20th
-- ============================================
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'that', %L, 'America/New_York', -240, %L)$$,
         (select b_id from t_ids), pg_temp.day_of('late'),
         timestamp '2030-06-21 00:10' at time zone 'America/New_York',
         timestamp '2030-06-21 00:10' at time zone 'America/New_York'),
  'DQ001', null,
  'CLOCK-012: a pick dated after midnight for yesterday''s day is refused with DQ001'
);
select is(
  (select count(*)::int from public.daily_picks where day_id = pg_temp.day_of('late')),
  1,
  'CLOCK-013: and nothing is written for it'
);

-- ============================================
-- An hour apart: A in New York, B in Chicago, each 23:30 local on the 22nd
-- ============================================
select public.record_daily_pick(
  (select a_id from t_ids), pg_temp.day_of('apart'), 'this',
  timestamp '2030-06-22 23:30' at time zone 'America/New_York', 'America/New_York', -240,
  timestamp '2030-06-22 23:31' at time zone 'America/New_York');
select set_config('tests.apart_b',
  public.record_daily_pick(
    (select b_id from t_ids), pg_temp.day_of('apart'), 'that',
    timestamp '2030-06-22 23:30' at time zone 'America/Chicago', 'America/Chicago', -300,
    timestamp '2030-06-22 23:31' at time zone 'America/Chicago'
  )::text, false);

select is(
  (select count(*)::int from public.daily_picks where day_id = pg_temp.day_of('apart')),
  2,
  'CLOCK-014: both partners'' picks land on the one day_id'
);
select is(
  (select is_second from public.daily_picks
   where day_id = pg_temp.day_of('apart') and user_id = (select b_id from t_ids)),
  true,
  'CLOCK-015: and B''s, an hour later by the clock, is the second pick'
);
select is(
  current_setting('tests.apart_b')::jsonb ->> 'day' || '/' || (current_setting('tests.apart_b')::jsonb ->> 'state'),
  '2030-06-22/both',
  'CLOCK-016: B''s snapshot is for the 22nd and shows both'
);

-- ============================================
-- The window: ahead of `at`, before the day, and the edges
-- ============================================
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'this', %L, 'UTC', 0, %L)$$,
         (select a_id from t_ids), pg_temp.day_of('ahead'),
         timestamptz '2030-06-24 12:06:00+00', timestamptz '2030-06-24 12:00:00+00'),
  'DQ002', null,
  'CLOCK-017: a picked_at six minutes ahead of `at` is refused with DQ002'
);
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'this', %L, 'UTC', 0, %L)$$,
         (select a_id from t_ids), pg_temp.day_of('before'),
         timestamptz '2030-06-24 23:54:00+00', timestamptz '2030-06-25 12:00:00+00'),
  'DQ002', null,
  'CLOCK-018: a picked_at six minutes before the day was created is refused with DQ002'
);
select is(
  (select count(*)::int from public.daily_picks
   where day_id in (pg_temp.day_of('ahead'), pg_temp.day_of('before'))),
  0,
  'CLOCK-019: neither wrote a pick'
);

select is(
  public.record_daily_pick(
    (select a_id from t_ids), pg_temp.day_of('ahead'), 'this',
    timestamptz '2030-06-24 12:04:00+00', 'UTC', 0, timestamptz '2030-06-24 12:00:00+00'
  ) ->> 'state',
  'me',
  'CLOCK-020: a picked_at four minutes ahead of `at`, on the day''s date, is stored'
);
select is(
  public.record_daily_pick(
    (select a_id from t_ids), pg_temp.day_of('before'), 'that',
    timestamptz '2030-06-24 23:56:00+00', 'Asia/Tokyo', 540, timestamptz '2030-06-25 12:00:00+00'
  ) ->> 'state',
  'me',
  'CLOCK-021: a picked_at four minutes before the day was created, on its date in the zone sent, is stored'
);
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'this', %L, 'UTC', 0, %L)$$,
         (select b_id from t_ids), pg_temp.day_of('ahead'),
         timestamptz '2030-06-25 00:01:00+00', timestamptz '2030-06-25 00:01:00+00'),
  'DQ001', null,
  'CLOCK-022: a pick inside the window but dated the next day in its zone is refused with DQ001'
);

-- ============================================
-- Order of the checks
-- ============================================
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'maybe', %L, 'UTC', 0, %L)$$,
         (select b_id from t_ids), pg_temp.day_of('ahead'), now(), now()),
  '22023', 'Invalid choice',
  'CLOCK-023: a bad choice is still 22023'
);
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'this', null, 'UTC', 0, now())$$,
         (select b_id from t_ids), pg_temp.day_of('ahead')),
  '22023', 'Invalid pick time',
  'CLOCK-024: a null picked_at is still 22023'
);
select throws_ok(
  format($$select public.record_daily_pick(%L, %L, 'this', now(), 'UTC', 0, now())$$,
         (select u_id from t_ids), pg_temp.day_of('ahead')),
  'P0002', 'Day not found',
  'CLOCK-025: a viewer outside the pair still gets P0002'
);
select throws_ok(
  format($$select public.record_daily_pick(%L, gen_random_uuid(), 'this', now(), 'UTC', 0, now())$$,
         (select a_id from t_ids)),
  'P0002', 'Day not found',
  'CLOCK-026: an unknown day still gets P0002'
);

-- ============================================
-- A repeat of a stored pick is returned unchanged, whatever its picked_at
-- ============================================
select set_config('tests.repeat',
  public.record_daily_pick(
    (select a_id from t_ids), pg_temp.day_of('late'), 'that',
    timestamptz '2031-01-01 00:00:00+00', 'Asia/Tokyo', 540, timestamptz '2030-06-21 00:11:00-04'
  )::text, false);

select is(
  current_setting('tests.repeat')::jsonb ->> 'my_choice',
  'this',
  'CLOCK-027: a repeat far out of the window returns the stored choice'
);
select is(
  current_setting('tests.repeat')::jsonb ->> 'my_picked_at',
  current_setting('tests.late')::jsonb ->> 'my_picked_at',
  'CLOCK-028: and the stored picked_at'
);
select is(
  (select time_zone || '/' || choice || '/' || count(*) over ()
   from public.daily_picks where day_id = pg_temp.day_of('late') and user_id = (select a_id from t_ids)),
  'America/New_York/this/1',
  'CLOCK-029: and nothing is rewritten or added'
);

-- ============================================
-- record_user_time_zone
-- ============================================
select public.record_user_time_zone(
  (select u_id from t_ids), 'Asia/Tokyo', 540, timestamptz '2030-07-01 12:00:00+00', timestamptz '2030-07-01 12:00:00+00');
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone || '/' || reported_at
   from public.user_time_zones where user_id = (select u_id from t_ids)),
  'Asia/Tokyo/540/Asia/Tokyo/' || (timestamptz '2030-07-01 12:00:00+00')::text,
  'CLOCK-030: the first report inserts the zone and its effective_zone'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'Europe/Paris', 60, timestamptz '2030-07-01 11:00:00+00', timestamptz '2030-07-01 12:00:00+00');
select is(
  (select time_zone from public.user_time_zones where user_id = (select u_id from t_ids)),
  'Asia/Tokyo',
  'CLOCK-031: an older report leaves the stored row unchanged'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'Europe/Paris', 60, timestamptz '2030-07-01 12:00:00+00', timestamptz '2030-07-01 12:00:00+00');
select is(
  (select time_zone from public.user_time_zones where user_id = (select u_id from t_ids)),
  'Asia/Tokyo',
  'CLOCK-032: a report with the same reported_at leaves it unchanged'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'Nowhere/Land', 330, timestamptz '2030-07-01 12:30:00+00', timestamptz '2030-07-01 12:30:00+00');
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone || '/' || reported_at
   from public.user_time_zones where user_id = (select u_id from t_ids)),
  'Nowhere/Land/330/<+0530>-05:30/' || (timestamptz '2030-07-01 12:30:00+00')::text,
  'CLOCK-033: a newer report updates every column, resolving the unknown name to the offset'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'America/Denver', -360, timestamptz '2030-07-01 13:06:00+00', timestamptz '2030-07-01 13:00:00+00');
select is(
  (select time_zone || '/' || reported_at
   from public.user_time_zones where user_id = (select u_id from t_ids)),
  'America/Denver/' || (timestamptz '2030-07-01 13:00:00+00')::text,
  'CLOCK-034: a reported_at more than five minutes ahead is stored as `at`'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'Europe/Rome', 60, timestamptz '2030-07-01 13:04:00+00', timestamptz '2030-07-01 13:00:00+00');
select is(
  (select time_zone || '/' || reported_at
   from public.user_time_zones where user_id = (select u_id from t_ids)),
  'Europe/Rome/' || (timestamptz '2030-07-01 13:04:00+00')::text,
  'CLOCK-035: a reported_at four minutes ahead is kept as sent'
);

select public.record_user_time_zone(
  (select u_id from t_ids), 'Asia/Seoul', 540, timestamptz '2030-07-01 13:30:00+00', timestamptz '2030-07-01 13:30:00+00');
select public.record_user_time_zone(null, 'Asia/Seoul', 540, timestamptz '2030-07-01 14:00:00+00', timestamptz '2030-07-01 14:00:00+00');
select public.record_user_time_zone(
  (select u_id from t_ids), 'Asia/Dubai', 240, null, timestamptz '2030-07-01 14:00:00+00');
select is(
  (select time_zone from public.user_time_zones where user_id = (select u_id from t_ids))
    || '/' || (select count(*)::int from public.user_time_zones
               where user_id in (select unnest(array[a_id, b_id, o_id, d_id, u_id, z_id]) from t_ids)),
  'Asia/Seoul/1',
  'CLOCK-036: a null viewer or a null reported_at writes nothing'
);

select public.record_user_time_zone(
  (select b_id from t_ids), null, null, timestamptz '2030-07-01 12:00:00+00', timestamptz '2030-07-01 12:00:00+00');
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone
   from public.user_time_zones where user_id = (select b_id from t_ids)),
  '/0/UTC',
  'CLOCK-037: a null zone and offset are stored as an empty name, 0 and UTC'
);

-- ============================================
-- A pick never writes the table
-- ============================================
select public.record_user_time_zone(
  (select a_id from t_ids), 'America/New_York', -240, timestamptz '2030-06-20 12:00:00+00', timestamptz '2030-06-20 12:00:00+00');
create temporary table t_zone_before as
select * from public.user_time_zones where user_id = (select a_id from t_ids);

select public.record_daily_pick(
  (select a_id from t_ids), pg_temp.day_of('extra'), 'this',
  timestamptz '2030-06-26 12:00:00+00', 'Asia/Kolkata', 330, timestamptz '2030-06-26 12:00:00+00');
select public.record_daily_pick(
  (select b_id from t_ids), pg_temp.day_of('ahead'), 'that',
  timestamptz '2030-06-24 12:03:00+00', 'Asia/Kolkata', 330, timestamptz '2030-06-24 12:03:00+00');

select is(
  (select count(*)::int from public.user_time_zones z, t_zone_before b
   where z.user_id = b.user_id and z.time_zone = b.time_zone
     and z.utc_offset_minutes = b.utc_offset_minutes and z.effective_zone = b.effective_zone
     and z.reported_at = b.reported_at),
  1,
  'CLOCK-038: a pick sent with another zone leaves A''s user_time_zones row unchanged'
);
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone
   from public.user_time_zones where user_id = (select b_id from t_ids)),
  '/0/UTC',
  'CLOCK-039: and leaves B''s unchanged too'
);
select is(
  (select time_zone || '/' || effective_zone
   from public.daily_picks where day_id = pg_temp.day_of('extra') and user_id = (select a_id from t_ids)),
  'Asia/Kolkata/Asia/Kolkata',
  'CLOCK-040: while the pick itself keeps the zone it was sent with'
);

-- ============================================
-- get_daily_day records the zone, before the unlinked return
-- ============================================
select tests.authenticate_as((select z_id from t_ids));
select set_config('tests.u_res', public.get_daily_day('Pacific/Auckland', 780, now() + interval '1 hour')::text, false);
reset role;

select is(
  current_setting('tests.u_res')::jsonb,
  '{"status": "unlinked"}'::jsonb,
  'CLOCK-041: an unlinked caller still gets {status: unlinked}'
);
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone || '/' || (reported_at = now())
   from public.user_time_zones where user_id = (select z_id from t_ids)),
  'Pacific/Auckland/780/Pacific/Auckland/true',
  'CLOCK-042: and its zone is recorded, with a reported_at an hour ahead stored as now()'
);

-- ============================================
-- The client RPCs: DQ002 and DQ001 through submit_daily_pick
-- ============================================
select tests.authenticate_as((select o_id from t_ids));
select set_config('tests.k_res', public.get_daily_day('Pacific/Kiritimati', 840, now())::text, false);
reset role;
select set_config('tests.k_day', current_setting('tests.k_res')::jsonb #>> '{snapshot,day_id}', false);

select is(
  (select time_zone || '/' || (reported_at = now()) from public.user_time_zones where user_id = (select o_id from t_ids)),
  'Pacific/Kiritimati/true',
  'CLOCK-043: get_daily_day records the linked caller''s zone too'
);

select tests.authenticate_as((select o_id from t_ids));
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'this', now() + interval '6 minutes', 'Pacific/Kiritimati', 840)$$,
         current_setting('tests.k_day')),
  'DQ002', null,
  'CLOCK-044: submit_daily_pick refuses a picked_at six minutes ahead of now() with DQ002'
);
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'this', now(), 'Pacific/Pago_Pago', -660)$$,
         current_setting('tests.k_day')),
  'DQ001', null,
  'CLOCK-045: and a pick in a zone 25 hours behind the zone that fetched the day with DQ001'
);
reset role;

select is(
  (select count(*)::int from public.daily_picks where day_id = current_setting('tests.k_day')::uuid),
  0,
  'CLOCK-046: neither wrote a pick'
);

select tests.authenticate_as((select o_id from t_ids));
select set_config('tests.k_pick',
  public.submit_daily_pick(current_setting('tests.k_day')::uuid, 'that', now(), 'Pacific/Kiritimati', 840)::text, false);
select set_config('tests.k_repeat',
  public.submit_daily_pick(current_setting('tests.k_day')::uuid, 'this', now() + interval '1 hour', 'Pacific/Pago_Pago', -660)::text, false);
reset role;

select is(
  current_setting('tests.k_pick')::jsonb ->> 'state' || '/' || (current_setting('tests.k_pick')::jsonb ->> 'my_choice'),
  'me/that',
  'CLOCK-047: a pick inside the window on the fetched day is stored'
);
select is(
  current_setting('tests.k_repeat')::jsonb ->> 'my_choice' || '/' || (current_setting('tests.k_repeat')::jsonb ->> 'my_picked_at'),
  'that/' || (current_setting('tests.k_pick')::jsonb ->> 'my_picked_at'),
  'CLOCK-048: and a repeat through the client RPC returns it unchanged, out of window and off the day'
);

select * from finish();
rollback;
