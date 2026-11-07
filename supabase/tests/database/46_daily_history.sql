-- ============================================
-- pgTAP: the couple's past questions (20261107020000)
--
-- Story 7.7 of architecture-daily-question (AD-5, AD-15, AD-16). Pinned here:
--   * get_daily_history(before date default null) is a client RPC (granted to
--     authenticated, denied to PUBLIC and anon), security definer with an empty
--     search_path and stable, so it cannot store anything.
--   * The I/O matrix of the story: the first page is the 30 newest done days,
--     newest first; the next page (`before` = the oldest day in hand) holds the
--     rest and never the `before` day itself; a half day (one pick) is absent,
--     past or newest; a reader who has not picked today gets nothing for it
--     and no choice anywhere; another pair's days are never listed, even after
--     a relink; an unlinked caller gets []; a NULL auth.uid() is refused;
--     Same/Different comes from the snapshot's own `same`.
--   * Each element is exactly daily_day_snapshot(day, caller, now()).
-- The gate cases (a partner who has not picked) also live in
-- 40_daily_question_gate.sql.
--
-- Fixed 2030 dates work with the client RPC at now(): visible_daily_picks
-- ignores `at`.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(33);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'History ' || left(test_email, 6))
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

select pg_temp.mk_pair(l) from unnest(array['big', 'other', 'wait', 'sd', 'relink', 'next']) as l;

create temporary table t_extra as
  select tests.create_test_user('history-lone@example.com') as lone_id,
         tests.create_test_user('history-new-a@example.com') as new_a_id,
         tests.create_test_user('history-new-b@example.com') as new_b_id;
grant select on t_extra to authenticated, anon, service_role;
update public.users set partner_id = (select new_b_id from t_extra) where id = (select new_a_id from t_extra);
update public.users set partner_id = (select new_a_id from t_extra) where id = (select new_b_id from t_extra);

-- Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

create or replace function pg_temp.pa(p text) returns uuid language sql stable as $$ select a_id from t_pairs where label = p $$;
create or replace function pg_temp.pb(p text) returns uuid language sql stable as $$ select b_id from t_pairs where label = p $$;

-- Opens the pair's day if needed and stores one pick on it at noon UTC.
create or replace function pg_temp.put(p_pair text, p_who text, p_day date, p_choice text)
returns void language plpgsql as $$
declare
  v_a uuid := pg_temp.pa(p_pair);
  v_b uuid := pg_temp.pb(p_pair);
  v_day uuid := (public.assign_couple_day(v_a, v_b, p_day)).id;
  v_user uuid := case when p_who = 'a' then v_a else v_b end;
  v_other uuid := case when p_who = 'a' then v_b else v_a end;
begin
  insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
  values (v_day, v_user, p_choice, (p_day::timestamp + interval '12 hours') at time zone 'UTC', 'UTC', 0, 'UTC',
          exists (select 1 from public.daily_picks p where p.day_id = v_day and p.user_id = v_other));
end; $$;

-- get_daily_history as the given user, role restored afterwards.
create or replace function pg_temp.hist(p_user uuid, p_before date default null)
returns jsonb language plpgsql as $$
declare v_res jsonb;
begin
  perform tests.authenticate_as(p_user);
  v_res := public.get_daily_history(p_before);
  execute 'reset role';
  return v_res;
end; $$;

create or replace function pg_temp.days(j jsonb)
returns text language sql immutable as $$
  select coalesce(string_agg(e ->> 'day', ',' order by ord), '') from jsonb_array_elements(j) with ordinality as t(e, ord)
$$;

-- ============================================
-- Structure and grants
-- ============================================
select has_function('public', 'get_daily_history', array['date'],
  'HISTORY-001: get_daily_history(before date) exists');
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.get_daily_history(date)'::regprocedure),
  'HISTORY-002: it is security definer with an empty search_path'
);
select is(
  (select p.provolatile::text from pg_proc p where p.oid = 'public.get_daily_history(date)'::regprocedure),
  's',
  'HISTORY-003: it is stable, so it cannot store anything'
);
select ok(
  (select pg_get_function_arguments(p.oid) like '%DEFAULT NULL%' and p.pronargdefaults = 1
   from pg_proc p where p.oid = 'public.get_daily_history(date)'::regprocedure),
  'HISTORY-004: before defaults to null'
);
select ok(
  has_function_privilege('authenticated', 'public.get_daily_history(date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_daily_history(date)', 'EXECUTE'),
  'HISTORY-005: it is executable by authenticated and not by anon'
);
select is(
  (select count(*)::int
   from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
   where p.oid = 'public.get_daily_history(date)'::regprocedure and acl.grantee = 0),
  0,
  'HISTORY-006: it is not granted to PUBLIC'
);

-- ============================================
-- Paging: 35 done days (2030-01-01 .. 2030-02-04), a past half day and a newer one
-- ============================================
select pg_temp.put('big', w.who, date '2030-01-01' + g.i, 'this')
from generate_series(0, 34) as g(i), (values ('a'), ('b')) as w(who);
-- Half days: one before the first done day, one after the newest.
select pg_temp.put('big', 'a', date '2029-12-31', 'this');
select pg_temp.put('big', 'b', date '2030-02-05', 'that');

select set_config('tests.big_a', pg_temp.hist(pg_temp.pa('big'))::text, false);
select set_config('tests.big_b', pg_temp.hist(pg_temp.pb('big'))::text, false);

select is(
  jsonb_array_length(current_setting('tests.big_a')::jsonb),
  30,
  'HISTORY-007: 35 done days: the first page holds 30'
);
select is(
  (current_setting('tests.big_a')::jsonb #>> '{0,day}') || '/' || (current_setting('tests.big_a')::jsonb #>> '{29,day}'),
  '2030-02-04/2030-01-06',
  'HISTORY-008: the 30 newest, newest first (the newest half day is absent)'
);
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('tests.big_a')::jsonb) e where e ->> 'state' <> 'both'),
  0,
  'HISTORY-009: every listed day is done (state both)'
);
select is(
  pg_temp.days(current_setting('tests.big_a')::jsonb),
  (select string_agg(d::date::text, ',' order by d desc) from generate_series(date '2030-01-06', date '2030-02-04', interval '1 day') d),
  'HISTORY-010: and the order is strictly newest first with no gap'
);
select is(
  pg_temp.days(current_setting('tests.big_b')::jsonb),
  pg_temp.days(current_setting('tests.big_a')::jsonb),
  'HISTORY-011: the partner reads the same days'
);

select set_config('tests.big_next', pg_temp.hist(pg_temp.pa('big'), date '2030-01-06')::text, false);
select is(
  pg_temp.days(current_setting('tests.big_next')::jsonb),
  '2030-01-05,2030-01-04,2030-01-03,2030-01-02,2030-01-01',
  'HISTORY-012: the next page holds the other 5, newest first, without the before day or the past half day'
);
select is(
  pg_temp.hist(pg_temp.pa('big'), date '2030-01-01'),
  '[]'::jsonb,
  'HISTORY-013: before the oldest done day nothing is left'
);
select is(
  jsonb_array_length(pg_temp.hist(pg_temp.pa('big'), date '2030-02-05')),
  30,
  'HISTORY-014: a before past the newest day still caps the page at 30'
);

-- ============================================
-- Each element is the day's snapshot
-- ============================================
select is(
  (current_setting('tests.big_a')::jsonb -> 0),
  public.daily_day_snapshot(
    (select cd.id from public.couple_days cd where cd.user_a = pg_temp.pa('big') and cd.user_b = pg_temp.pb('big') and cd.day = date '2030-02-04'),
    pg_temp.pa('big'), now()),
  'HISTORY-015: an element equals daily_day_snapshot for that day and the caller'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(current_setting('tests.big_a')::jsonb -> 0) k),
  (select array_agg(k order by k) from jsonb_object_keys(
     public.daily_day_snapshot(
       (select cd.id from public.couple_days cd where cd.user_a = pg_temp.pa('big') and cd.user_b = pg_temp.pb('big') and cd.day = date '2030-02-04'),
       pg_temp.pa('big'), now())) k),
  'HISTORY-016: its keys are the snapshot''s keys'
);
select is(
  (current_setting('tests.big_b')::jsonb -> 0),
  public.daily_day_snapshot(
    (select cd.id from public.couple_days cd where cd.user_a = pg_temp.pa('big') and cd.user_b = pg_temp.pb('big') and cd.day = date '2030-02-04'),
    pg_temp.pb('big'), now()),
  'HISTORY-017: and for the other partner it is their own snapshot'
);

-- ============================================
-- A reader who has not picked a day sees nothing of it
-- ============================================
select pg_temp.put('wait', 'a', date '2030-03-01', 'this');
select set_config('tests.wait_b', pg_temp.hist(pg_temp.pb('wait'))::text, false);
select set_config('tests.wait_a', pg_temp.hist(pg_temp.pa('wait'))::text, false);

select is(
  current_setting('tests.wait_b')::jsonb,
  '[]'::jsonb,
  'HISTORY-018: B, before B''s own pick, gets [] for the day A picked'
);
select ok(
  not jsonb_path_exists(current_setting('tests.wait_b')::jsonb, '$.** ? (@ == "this" || @ == "that")'),
  'HISTORY-019: and no "this" or "that" value appears in it'
);
select is(
  current_setting('tests.wait_a')::jsonb,
  '[]'::jsonb,
  'HISTORY-020: A''s own half day is absent too'
);

select pg_temp.put('wait', 'b', date '2030-03-01', 'that');
select is(
  pg_temp.days(pg_temp.hist(pg_temp.pb('wait'))),
  '2030-03-01',
  'HISTORY-021: once B has picked, the day is listed'
);

-- ============================================
-- Another pairing
-- ============================================
select pg_temp.put('other', w.who, date '2030-01-10' + g.i, 'this')
from generate_series(0, 2) as g(i), (values ('a'), ('b')) as w(who);

select is(
  pg_temp.days(pg_temp.hist(pg_temp.pa('other'))),
  '2030-01-12,2030-01-11,2030-01-10',
  'HISTORY-022: the outsider pair reads its own three days'
);
select is(
  (select count(*)::int
   from jsonb_array_elements(pg_temp.hist(pg_temp.pa('big'))) e
   join public.couple_days cd on cd.id = (e ->> 'day_id')::uuid
   where cd.user_a = pg_temp.pa('other')),
  0,
  'HISTORY-023: and none of the other pair''s days is in the big pair''s answer'
);

-- A relinked reader: the old pair's days go, the new pair's come.
select pg_temp.put('relink', w.who, date '2030-04-01' + g.i, 'this')
from generate_series(0, 1) as g(i), (values ('a'), ('b')) as w(who);
select is(
  jsonb_array_length(pg_temp.hist(pg_temp.pa('relink'))),
  2,
  'HISTORY-024: before the relink the pair''s two days are listed'
);

update public.users set partner_id = null where id in (pg_temp.pa('relink'), pg_temp.pb('relink'));
select is(
  pg_temp.hist(pg_temp.pa('relink')),
  '[]'::jsonb,
  'HISTORY-025: an unlinked caller gets []'
);

update public.users set partner_id = (select new_b_id from t_extra) where id = pg_temp.pa('relink');
update public.users set partner_id = pg_temp.pa('relink') where id = (select new_b_id from t_extra);
select is(
  pg_temp.hist(pg_temp.pa('relink')),
  '[]'::jsonb,
  'HISTORY-026: relinked to someone else, the caller reads none of the old pair''s days'
);

-- A user who never had a partner.
select is(
  pg_temp.hist((select lone_id from t_extra)),
  '[]'::jsonb,
  'HISTORY-027: a user who was never linked gets []'
);

-- ============================================
-- Signed out
-- ============================================
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.get_daily_history()$$,
  'Authentication required',
  'HISTORY-028: a NULL auth.uid() is refused'
);
select throws_ok(
  $$select public.get_daily_history(date '2030-01-01')$$,
  'Authentication required',
  'HISTORY-029: and so is a NULL auth.uid() with a before date'
);

-- ============================================
-- Same and Different
-- ============================================
select pg_temp.put('sd', 'a', date '2030-05-01', 'this');
select pg_temp.put('sd', 'b', date '2030-05-01', 'this');
select pg_temp.put('sd', 'a', date '2030-05-02', 'this');
select pg_temp.put('sd', 'b', date '2030-05-02', 'that');
select set_config('tests.sd_a', pg_temp.hist(pg_temp.pa('sd'))::text, false);

select is(
  (select string_agg((e ->> 'day') || '=' || (e ->> 'same'), ',' order by e ->> 'day' desc)
   from jsonb_array_elements(current_setting('tests.sd_a')::jsonb) e),
  '2030-05-02=false,2030-05-01=true',
  'HISTORY-030: this/this is Same and this/that is Different'
);
select is(
  (current_setting('tests.sd_a')::jsonb #>> '{0,my_choice}') || '/' || (current_setting('tests.sd_a')::jsonb #>> '{0,partner_choice}'),
  'this/that',
  'HISTORY-031: both choices are in the answer, the caller''s first'
);
select is(
  (select count(*)::int from jsonb_array_elements(pg_temp.hist(pg_temp.pb('sd'))) e where e ->> 'same' = 'false'),
  1,
  'HISTORY-032: the partner reads the same mark'
);

-- ============================================
-- The before day itself is absent
-- ============================================
select pg_temp.put('next', w.who, date '2030-01-05', 'this') from (values ('a'), ('b')) as w(who);
select is(
  pg_temp.days(pg_temp.hist(pg_temp.pa('next'), date '2030-01-05')),
  '',
  'HISTORY-033: the before day itself is absent'
);

select * from finish();
rollback;
