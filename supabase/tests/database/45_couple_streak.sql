-- ============================================
-- pgTAP: the couple's streak (20261107010000)
--
-- Story 7.1 of architecture-daily-question (AD-3, AD-5, AD-7, AD-8, AD-15).
-- Pinned here:
--   * couple_streak is internal (denied to PUBLIC, anon and authenticated,
--     granted to service_role), get_couple_streak is a client RPC (granted to
--     authenticated, denied to PUBLIC and anon); both are security definer with
--     an empty search_path and stable, so neither can store anything.
--   * couple_streak over fixed 2030 instants: the I/O matrix of the story (a
--     sequence of done, missed and open dates; an open day never breaks the
--     run; blue until both pick; partners an hour apart; a late pick correcting
--     the count by itself (R8); the milestone at 25; a pair with no days), the
--     exact keys of the answer and of each week entry, Same through the gate,
--     and 22023 for a viewer outside the pair, an unordered pair or a null argument.
--   * get_couple_streak at now(): {status: 'unlinked'} with no partner, and the
--     same pair relinked counting the unlinked dates, which have no row, as
--     missed (AD-1).
-- The gate cases (a partner who has not picked) live in
-- 40_daily_question_gate.sql.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(49);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Streak ' || left(test_email, 6))
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

-- One linked pair per scenario, a < b, so A is couple_days.user_a.
create temporary table t_pairs (label text primary key, a_id uuid not null, b_id uuid not null);
grant select on t_pairs to authenticated, anon, service_role;

create or replace function pg_temp.mk_pair(p_label text)
returns void language plpgsql as $$
declare
  v_x uuid := tests.create_test_user(p_label || '-a@example.com');
  v_y uuid := tests.create_test_user(p_label || '-b@example.com');
begin
  insert into t_pairs values (p_label, least(v_x, v_y), greatest(v_x, v_y));
  update public.users set partner_id = v_y where id = v_x;
  update public.users set partner_id = v_x where id = v_y;
end; $$;

select pg_temp.mk_pair(l) from unnest(array['seq', 'apart', 'late', 'cold', 'big', 'relink', 'empty']) as l;

create temporary table t_outsider as select tests.create_test_user('streak-outsider@example.com') as o_id;
grant select on t_outsider to authenticated, anon, service_role;

-- Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

create or replace function pg_temp.pa(p text) returns uuid language sql stable as $$ select a_id from t_pairs where label = p $$;
create or replace function pg_temp.pb(p text) returns uuid language sql stable as $$ select b_id from t_pairs where label = p $$;

-- Opens the pair's day if needed and stores one pick on it at noon in the zone,
-- stored with that zone as its effective_zone (what record_daily_pick stores).
create or replace function pg_temp.put(p_pair text, p_who text, p_day date, p_choice text, p_zone text)
returns void language plpgsql as $$
declare
  v_a uuid := pg_temp.pa(p_pair);
  v_b uuid := pg_temp.pb(p_pair);
  v_day uuid := (public.assign_couple_day(v_a, v_b, p_day)).id;
  v_user uuid := case when p_who = 'a' then v_a else v_b end;
  v_other uuid := case when p_who = 'a' then v_b else v_a end;
begin
  insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
  values (v_day, v_user, p_choice, (p_day::timestamp + interval '12 hours') at time zone p_zone, p_zone, 0, p_zone,
          exists (select 1 from public.daily_picks p where p.day_id = v_day and p.user_id = v_other));
end; $$;

create or replace function pg_temp.streak(p_pair text, p_viewer text, p_at timestamptz)
returns jsonb language sql stable as $$
  select public.couple_streak(pg_temp.pa(p_pair), pg_temp.pb(p_pair),
                              case when p_viewer = 'a' then pg_temp.pa(p_pair) else pg_temp.pb(p_pair) end, p_at)
$$;

-- held/run/missed/today_state/same
create or replace function pg_temp.line(j jsonb)
returns text language sql immutable as $$
  select (j ->> 'held') || '/' || (j ->> 'run') || '/' || (j ->> 'missed') || '/' || (j ->> 'today_state') || '/' || (j ->> 'same')
$$;

create or replace function pg_temp.week(j jsonb)
returns text language sql immutable as $$
  select string_agg(e ->> 'state', ',' order by ord) from jsonb_array_elements(j -> 'week') with ordinality as t(e, ord)
$$;

-- ============================================
-- Structure and grants
-- ============================================
select has_function('public', 'couple_streak', array['uuid', 'uuid', 'uuid', 'timestamp with time zone'],
  'STREAK-001: couple_streak(user_a, user_b, viewer, at) exists');
select has_function('public', 'get_couple_streak', array[]::text[],
  'STREAK-002: get_couple_streak() exists and takes no argument');
select is(
  (select count(*)::int from pg_proc p
   where p.oid in ('public.couple_streak(uuid, uuid, uuid, timestamptz)'::regprocedure,
                   'public.get_couple_streak()'::regprocedure)
     and p.prosecdef and p.proconfig @> array['search_path=""']),
  2,
  'STREAK-003: both are security definer with an empty search_path'
);
select is(
  (select count(*)::int from pg_proc p
   where p.oid in ('public.couple_streak(uuid, uuid, uuid, timestamptz)'::regprocedure,
                   'public.get_couple_streak()'::regprocedure)
     and p.provolatile = 's'),
  2,
  'STREAK-004: both are stable, so neither can store a streak'
);
select is(
  (select count(*)::int
   from unnest(array['anon', 'authenticated']) as r(rolename)
   where has_function_privilege(r.rolename, 'public.couple_streak(uuid, uuid, uuid, timestamptz)', 'EXECUTE')),
  0,
  'STREAK-005: couple_streak is executable by neither anon nor authenticated'
);
select ok(
  has_function_privilege('service_role', 'public.couple_streak(uuid, uuid, uuid, timestamptz)', 'EXECUTE'),
  'STREAK-006: service_role keeps EXECUTE on couple_streak'
);
select ok(
  has_function_privilege('authenticated', 'public.get_couple_streak()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_couple_streak()', 'EXECUTE'),
  'STREAK-007: get_couple_streak is executable by authenticated and not by anon'
);
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
   where p.oid in ('public.couple_streak(uuid, uuid, uuid, timestamptz)'::regprocedure,
                   'public.get_couple_streak()'::regprocedure)
     and acl.grantee = 0),
  0,
  'STREAK-008: neither function is granted to PUBLIC'
);

select tests.authenticate_as(pg_temp.pa('seq'));
select throws_ok(
  format($$select public.couple_streak(%L, %L, %L, now())$$, pg_temp.pa('seq'), pg_temp.pb('seq'), pg_temp.pa('seq')),
  '42501', null,
  'STREAK-009: a signed-in caller cannot call couple_streak directly'
);
reset role;

-- ============================================
-- Sequence (UTC pair): 07-01 done same, 07-02 done different, 07-03 no row,
-- 07-04 one pick
-- ============================================
select pg_temp.put('seq', 'a', date '2030-07-01', 'this', 'UTC');
select pg_temp.put('seq', 'b', date '2030-07-01', 'this', 'UTC');
select pg_temp.put('seq', 'a', date '2030-07-02', 'this', 'UTC');
select pg_temp.put('seq', 'b', date '2030-07-02', 'that', 'UTC');
select pg_temp.put('seq', 'a', date '2030-07-04', 'this', 'UTC');

select is(
  pg_temp.line(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')),
  '2/0/2/blue/1',
  'STREAK-010: held 2, run 0, missed 2, blue, same 1 (07-03 has no row, 07-04 one pick)'
);
select is(
  (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'done')
    || '/' || (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'milestones'),
  '2/0',
  'STREAK-011: done equals held and there is no milestone yet'
);
select is(
  pg_temp.week(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')),
  'open,open,done,done,missed,missed,open',
  'STREAK-012: the week runs oldest first; dates before the first day are open, today is open'
);
select is(
  (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') #>> '{week,0,day}')
    || '/' || (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') #>> '{week,6,day}'),
  '2030-06-29/2030-07-05',
  'STREAK-013: and ends on the viewer''s date'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')) k),
  array['done', 'held', 'milestones', 'missed', 'run', 'same', 'today_state', 'week'],
  'STREAK-014: the streak carries exactly held, run, today_state, milestones, same, done, missed and week'
);
select is(
  (select count(*)::int
   from jsonb_array_elements(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') -> 'week') e
   where (select array_agg(k order by k) from jsonb_object_keys(e) k) = array['day', 'state']),
  7,
  'STREAK-015: and the week is seven {day, state} objects'
);
select is(
  pg_temp.line(pg_temp.streak('seq', 'b', timestamptz '2030-07-05 12:00:00+00')),
  '2/0/2/blue/1',
  'STREAK-016: the other partner sees the same streak'
);
select is(
  pg_temp.line(pg_temp.streak('seq', 'a', timestamptz '2030-07-03 00:30:00+00')),
  '2/2/0/grey/1',
  'STREAK-017: at 07-03 00:30Z the open day breaks nothing: run 2, missed 0, grey'
);

-- Blue until both pick: A picks on 07-05, then B.
select pg_temp.put('seq', 'a', date '2030-07-05', 'this', 'UTC');
select is(
  pg_temp.line(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')),
  '2/0/2/blue/1',
  'STREAK-018: with one pick on 07-05 the day is still blue and not counted'
);
select pg_temp.put('seq', 'b', date '2030-07-05', 'this', 'UTC');
select is(
  pg_temp.line(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')),
  '3/1/0/orange/2',
  'STREAK-019: once the second picks: orange, held 3, run 1, missed 0, same 2'
);
select is(
  pg_temp.week(pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00')),
  'open,open,done,done,missed,missed,done',
  'STREAK-020: and today is done in the week'
);

select is(
  (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'same')::int,
  (select count(*)::int from public.couple_days cd
   where cd.user_a = pg_temp.pa('seq') and cd.user_b = pg_temp.pb('seq')
     and public.daily_day_snapshot(cd.id, pg_temp.pa('seq'), timestamptz '2030-07-05 12:00:00+00') ->> 'same' = 'true'),
  'STREAK-021: same equals the count of days the snapshot marks Same (AD-7)'
);

-- Same is read through the gate: with the link cleared A sees only A's own picks.
update public.users set partner_id = null where id in (pg_temp.pa('seq'), pg_temp.pb('seq'));
select is(
  (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'held')
    || '/' || (pg_temp.streak('seq', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'same'),
  '3/0',
  'STREAK-022: with no link the gate releases no partner choice, so same is 0 while held stays 3'
);
update public.users set partner_id = pg_temp.pb('seq') where id = pg_temp.pa('seq');
update public.users set partner_id = pg_temp.pa('seq') where id = pg_temp.pb('seq');

select is(
  pg_temp.line(pg_temp.streak('seq', 'a', timestamptz '2030-07-06 12:00:00+00')),
  '3/1/0/grey/2',
  'STREAK-023: a missed date followed by a closed done date is no longer blue'
);

-- ============================================
-- A pair with no days
-- ============================================
select is(
  pg_temp.line(pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00')),
  '0/0/0/grey/0',
  'STREAK-024: a pair with no day has nothing held, missed or run, and is grey'
);
select is(
  pg_temp.week(pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00')),
  'open,open,open,open,open,open,open',
  'STREAK-025: and a week of open dates'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00')) k),
  array['done', 'held', 'milestones', 'missed', 'run', 'same', 'today_state', 'week'],
  'STREAK-044: the no-day answer carries exactly the same keys'
);
select is(
  (pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'done')
    || '/' || (pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00') ->> 'milestones'),
  '0/0',
  'STREAK-045: with done and milestones 0'
);
select is(
  (select count(*)::int
   from jsonb_array_elements(pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00') -> 'week') e
   where (select array_agg(k order by k) from jsonb_object_keys(e) k) = array['day', 'state'])
    || '/' || (pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00') #>> '{week,0,day}')
    || '/' || (pg_temp.streak('empty', 'a', timestamptz '2030-07-05 12:00:00+00') #>> '{week,6,day}'),
  '7/2030-06-29/2030-07-05',
  'STREAK-046: and a week of seven {day, state} objects ending on the viewer''s date'
);

-- ============================================
-- An hour apart: A in New York, B in Chicago (stored), day 08-10 has A's pick only
-- ============================================
select pg_temp.put('apart', 'a', date '2030-08-10', 'this', 'America/New_York');
select public.record_user_time_zone(
  pg_temp.pb('apart'), 'America/Chicago', -300,
  timestamptz '2030-08-10 12:00:00+00', timestamptz '2030-08-10 12:00:00+00');

select is(
  pg_temp.line(pg_temp.streak('apart', 'a', timestamptz '2030-08-11 04:30:00+00')),
  '0/0/0/grey/0',
  'STREAK-026: at 04:30Z it is past midnight in New York but not in Chicago: the day is open, grey'
);
select is(
  pg_temp.line(pg_temp.streak('apart', 'a', timestamptz '2030-08-11 05:00:00+00')),
  '0/0/1/blue/0',
  'STREAK-027: at 05:00Z Chicago has passed midnight too: the day is missed, blue'
);

-- A pick's own zone wins over the stored zone for closure; each week ends on its viewer's date.
select public.record_user_time_zone(
  pg_temp.pa('apart'), 'America/Los_Angeles', -420,
  timestamptz '2030-08-11 01:00:00+00', timestamptz '2030-08-11 01:00:00+00');
select is(
  pg_temp.line(pg_temp.streak('apart', 'a', timestamptz '2030-08-11 06:00:00+00'))
    || '/' || (pg_temp.streak('apart', 'a', timestamptz '2030-08-11 06:00:00+00') #>> '{week,6,day}'),
  '0/0/1/blue/0/2030-08-10',
  'STREAK-028: A''s pick zone (New York) closes 08-10 though A''s stored zone (Los Angeles) is still on it; A''s week ends 08-10'
);
select is(
  pg_temp.streak('apart', 'b', timestamptz '2030-08-11 06:00:00+00') #>> '{week,6,day}',
  '2030-08-11',
  'STREAK-029: and B''s week ends on B''s own date, 08-11'
);

-- ============================================
-- Late pick (R8): New York, B's pick made at 23:50 local, recorded at 00:10
-- ============================================
select pg_temp.put('late', 'a', date '2030-09-01', 'this', 'America/New_York');
select pg_temp.put('late', 'b', date '2030-09-01', 'this', 'America/New_York');
select pg_temp.put('late', 'a', date '2030-09-02', 'this', 'America/New_York');
select public.record_user_time_zone(
  pg_temp.pa('late'), 'America/New_York', -240,
  timestamptz '2030-09-01 12:00:00+00', timestamptz '2030-09-01 12:00:00+00');
select public.record_user_time_zone(
  pg_temp.pb('late'), 'America/New_York', -240,
  timestamptz '2030-09-01 12:00:00+00', timestamptz '2030-09-01 12:00:00+00');

select is(
  (pg_temp.streak('late', 'a', timestamp '2030-09-01 21:00' at time zone 'America/New_York') ->> 'today_state')
    || '/' || (pg_temp.streak('late', 'a', timestamp '2030-09-01 21:00' at time zone 'America/New_York') #>> '{week,6,day}'),
  'orange/2030-09-01',
  'STREAK-030: at 01:00Z on 09-02 it is still 09-01 in New York, A''s stored zone: today is 09-01 and done'
);

select is(
  pg_temp.line(pg_temp.streak('late', 'a', timestamp '2030-09-03 00:05' at time zone 'America/New_York')),
  '1/0/1/blue/1',
  'STREAK-031: before the late pick lands, 09-02 is missed and held is 1'
);

select public.record_daily_pick(
  pg_temp.pb('late'), (select id from public.couple_days where user_a = pg_temp.pa('late') and day = date '2030-09-02'),
  'that', timestamp '2030-09-02 23:50' at time zone 'America/New_York', 'America/New_York', -240,
  timestamp '2030-09-03 00:10' at time zone 'America/New_York');

select is(
  pg_temp.line(pg_temp.streak('late', 'a', timestamp '2030-09-03 00:15' at time zone 'America/New_York')),
  '2/2/0/grey/1',
  'STREAK-032: after it lands, with nothing stored in between, 09-02 is done: held 2, run 2, missed 0'
);
select is(
  (select p.effective_zone || '/' || (p.picked_at at time zone 'America/New_York')
   from public.daily_picks p
   join public.couple_days cd on cd.id = p.day_id
   where p.user_id = pg_temp.pb('late') and cd.day = date '2030-09-02'),
  'America/New_York/2030-09-02 23:50:00',
  'STREAK-033: the late pick is stored on 09-02 with the zone it was made in'
);

-- ============================================
-- Blue until both pick again: 08-20 missed, 08-21 done by both but not yet closed in Chicago
-- ============================================
select pg_temp.put('cold', 'a', date '2030-08-20', 'this', 'America/New_York');
select pg_temp.put('cold', 'a', date '2030-08-21', 'this', 'America/New_York');
select pg_temp.put('cold', 'b', date '2030-08-21', 'this', 'America/Chicago');
select public.record_user_time_zone(
  pg_temp.pa('cold'), 'America/New_York', -240,
  timestamptz '2030-08-20 12:00:00+00', timestamptz '2030-08-20 12:00:00+00');
select public.record_user_time_zone(
  pg_temp.pb('cold'), 'America/Chicago', -300,
  timestamptz '2030-08-20 12:00:00+00', timestamptz '2030-08-20 12:00:00+00');
select is(
  pg_temp.line(pg_temp.streak('cold', 'a', timestamptz '2030-08-22 04:30:00+00')),
  '1/1/0/grey/1',
  'STREAK-034: a missed date older than a done date that is not yet closed in Chicago leaves no missed date: grey, not blue'
);

-- ============================================
-- Milestones: floor(held / 25)
-- ============================================
select pg_temp.put('big', w.who, date '2030-01-01' + g.i, 'this', 'UTC')
from generate_series(0, 23) as g(i), (values ('a'), ('b')) as w(who);

select is(
  (pg_temp.streak('big', 'a', timestamptz '2030-01-25 12:00:00+00') ->> 'held')
    || '/' || (pg_temp.streak('big', 'a', timestamptz '2030-01-25 12:00:00+00') ->> 'milestones'),
  '24/0',
  'STREAK-035: 24 done dates hold 24 and no milestone'
);
select pg_temp.put('big', 'a', date '2030-01-25', 'this', 'UTC');
select pg_temp.put('big', 'b', date '2030-01-25', 'that', 'UTC');
select is(
  (pg_temp.streak('big', 'a', timestamptz '2030-01-25 12:00:00+00') ->> 'held')
    || '/' || (pg_temp.streak('big', 'a', timestamptz '2030-01-25 12:00:00+00') ->> 'milestones')
    || '/' || (pg_temp.streak('big', 'a', timestamptz '2030-01-25 12:00:00+00') ->> 'today_state'),
  '25/1/orange',
  'STREAK-036: the 25th done date makes one milestone'
);

-- ============================================
-- get_couple_streak at now(): unlinked, then relinked over a gap with no rows
-- ============================================
select pg_temp.put('relink', w.who, ((now() at time zone 'UTC')::date - d), 'this', 'UTC')
from generate_series(4, 5) d, (values ('a'), ('b')) as w(who);

update public.users set partner_id = null where id in (pg_temp.pa('relink'), pg_temp.pb('relink'));
select tests.authenticate_as(pg_temp.pa('relink'));
select set_config('tests.unlinked', public.get_couple_streak()::text, false);
reset role;

select is(
  current_setting('tests.unlinked')::jsonb,
  '{"status": "unlinked"}'::jsonb,
  'STREAK-037: a caller with no partner gets {status: unlinked}'
);

update public.users set partner_id = pg_temp.pb('relink') where id = pg_temp.pa('relink');
update public.users set partner_id = pg_temp.pa('relink') where id = pg_temp.pb('relink');
select tests.authenticate_as(pg_temp.pa('relink'));
select set_config('tests.relinked', public.get_couple_streak()::text, false);
reset role;

select is(
  (select array_agg(k order by k) from jsonb_object_keys(current_setting('tests.relinked')::jsonb) k),
  array['status', 'streak'],
  'STREAK-038: a linked caller gets exactly status and streak'
);
select is(
  (current_setting('tests.relinked')::jsonb ->> 'status')
    || '/' || pg_temp.line(current_setting('tests.relinked')::jsonb -> 'streak'),
  'ok/2/0/3/blue/2',
  'STREAK-039: relinked, the three dates with no row are missed: held 2, run 0, missed 3, blue'
);
select is(
  pg_temp.week(current_setting('tests.relinked')::jsonb -> 'streak'),
  'open,done,done,missed,missed,missed,open',
  'STREAK-040: and the week shows the gap'
);

-- ============================================
-- Bad arguments
-- ============================================
select throws_ok(
  format($$select public.couple_streak(%L, %L, %L, now())$$, pg_temp.pa('seq'), pg_temp.pb('seq'), (select o_id from t_outsider)),
  '22023', null,
  'STREAK-041: a viewer outside the pair is refused with 22023'
);
select throws_ok(
  format($$select public.couple_streak(%L, %L, %L, now())$$, pg_temp.pb('seq'), pg_temp.pa('seq'), pg_temp.pa('seq')),
  '22023', null,
  'STREAK-042: an unordered pair is refused with 22023'
);
select throws_ok(
  format($$select public.couple_streak(%L, %L, null, now())$$, pg_temp.pa('seq'), pg_temp.pb('seq')),
  '22023', null,
  'STREAK-043: a null viewer is refused with 22023'
);
select throws_ok(
  format($$select public.couple_streak(%L, %L, %L, null)$$, pg_temp.pa('seq'), pg_temp.pb('seq'), pg_temp.pa('seq')),
  '22023', null,
  'STREAK-047: a null instant is refused with 22023'
);
select throws_ok(
  format($$select public.couple_streak(null, %L, %L, now())$$, pg_temp.pb('seq'), pg_temp.pb('seq')),
  '22023', null,
  'STREAK-048: a null user_a is refused with 22023'
);
select throws_ok(
  format($$select public.couple_streak(%L, null, %L, now())$$, pg_temp.pa('seq'), pg_temp.pa('seq')),
  '22023', null,
  'STREAK-049: a null user_b is refused with 22023'
);

select * from finish();
rollback;
