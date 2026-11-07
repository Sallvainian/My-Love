-- ============================================
-- pgTAP: tomorrow's question is written in turns (20261106000000)
--
-- Story 6.3 of architecture-daily-question (AD-4, AD-8, AD-15, AD-16). Pinned here:
--   * record_written_question is security invoker with an empty search_path,
--     denied to anon and authenticated and granted to service_role;
--     submit_written_question is security definer with an empty search_path,
--     granted to authenticated and not to anon; a written row without a
--     target_day is refused by the table.
--   * record_written_question with fixed instants (dates in 2030): the
--     writer's trimmed texts become a row for the pair, targeted at the first
--     later date without a couple_days row, and the source day's snapshot
--     comes back with write { mine, done } true; a retry returns the stored
--     question whatever its texts or `at`.
--   * assign_couple_day: the next day asks the written question (the same
--     question for both partners); an unused turn leaves the next-but-one day
--     to the pool and the writer alternating by date; a partner who is ahead
--     pushes the target past the dates that already have a row; two pending
--     rows on one target are asked one after the other, the earlier source
--     first; a date before the target never takes it, a later date with a
--     skipped target still does.
--   * the snapshot's write.target_day (20261107000000) is the date the day's
--     question is asked, or would be if written now: with nothing else
--     waiting, the day + 1 while that date has no row and the next free date
--     once a partner who is ahead opened it, the same after the write, and the
--     day that asks it once asked; with two questions waiting on one target,
--     the second source day's names the date after the target, before and
--     after its write and once asked. The other write checks strip it.
--   * the pool: a written row already asked joins the next cycle's draws; no
--     draw takes another couple's written row.
--   * every refusal writes nothing: P0002 for an outsider, an unlinked caller,
--     a null viewer and an unknown day; DQ005 before the caller's own pick;
--     DQ004 for the partner who is not the writer; DQ006 once `at` is another
--     date in the zone of the pick (checked before the texts); DQ003 for a
--     blank, null, 41-character or case-equal text. A 40-character,
--     tab-padded text is accepted trimmed.
--   * the client RPC: submit_written_question through get_daily_day and
--     submit_daily_pick for today; the non-writer is refused with DQ004 and an
--     empty auth.uid() with 'Authentication required'.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(72);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Write ' || left(test_email, 6))
    on conflict (id) do nothing;
  return user_id;
end; $$;

create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', test_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
end; $$;

create or replace function tests.clear_jwt()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- a_id < b_id, so A is couple_days.user_a. a_id/b_id, o_id/d_id and p_id/q_id
-- are three linked couples; u_id has no partner.
create temporary table t_ids as
with u as (
  select
    tests.create_test_user('write-1@example.com') as x,
    tests.create_test_user('write-2@example.com') as y,
    tests.create_test_user('write-3@example.com') as o_id,
    tests.create_test_user('write-4@example.com') as d_id,
    tests.create_test_user('write-5@example.com') as p_id,
    tests.create_test_user('write-6@example.com') as q_id,
    tests.create_test_user('write-7@example.com') as u_id
)
select least(x, y) as a_id, greatest(x, y) as b_id, o_id, d_id, p_id, q_id, u_id from u;

grant select on t_ids to authenticated, anon, service_role;

update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);
update public.users set partner_id = (select d_id from t_ids) where id = (select o_id from t_ids);
update public.users set partner_id = (select o_id from t_ids) where id = (select d_id from t_ids);
update public.users set partner_id = (select q_id from t_ids) where id = (select p_id from t_ids);
update public.users set partner_id = (select p_id from t_ids) where id = (select q_id from t_ids);

-- Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

-- --------------------------------------------
-- Helpers, keyed by a viewer and a date (the pair is the viewer's)
-- --------------------------------------------

-- The viewer's pair's day for a date, assigned if need be, created the noon
-- before its date so that picks on the date fall inside the DQ002 window.
create or replace function pg_temp.mk(p_viewer uuid, p_day date)
returns uuid language plpgsql as $$
declare
  v_partner uuid := (select u.partner_id from public.users u where u.id = p_viewer);
  v_id uuid;
begin
  v_id := (public.assign_couple_day(least(p_viewer, v_partner), greatest(p_viewer, v_partner), p_day)).id;
  update public.couple_days
  set created_at = (p_day - 1)::timestamp at time zone 'UTC' + interval '12 hours'
  where id = v_id;
  return v_id;
end $$;

create or replace function pg_temp.day_id(p_viewer uuid, p_day date)
returns uuid language sql stable as $$
  select cd.id
  from public.couple_days cd
  join public.users u on u.id = p_viewer
  where cd.day = p_day
    and cd.user_a = least(p_viewer, u.partner_id) and cd.user_b = greatest(p_viewer, u.partner_id)
$$;

-- The day's writer, and the other partner.
create or replace function pg_temp.writer(p_viewer uuid, p_day date)
returns uuid language sql stable as $$
  select cd.writer from public.couple_days cd where cd.id = pg_temp.day_id(p_viewer, p_day)
$$;

create or replace function pg_temp.other(p_viewer uuid, p_day date)
returns uuid language sql stable as $$
  select case when cd.writer = cd.user_a then cd.user_b else cd.user_a end
  from public.couple_days cd where cd.id = pg_temp.day_id(p_viewer, p_day)
$$;

-- The viewer's pick for the date: 12:00 UTC on it, sent as UTC.
create or replace function pg_temp.pk(p_viewer uuid, p_day date)
returns jsonb language sql as $$
  select public.record_daily_pick(
    p_viewer, pg_temp.day_id(p_viewer, p_day), 'this',
    p_day::timestamp at time zone 'UTC' + interval '12 hours', 'UTC', 0,
    p_day::timestamp at time zone 'UTC' + interval '12 hours')
$$;

-- record_written_question for the date's day, by default at 13:00 UTC on it.
create or replace function pg_temp.wq(p_viewer uuid, p_day date, p_this text, p_that text, p_at timestamptz default null)
returns jsonb language sql as $$
  select public.record_written_question(
    p_viewer, pg_temp.day_id(p_viewer, p_day), p_this, p_that,
    coalesce(p_at, p_day::timestamp at time zone 'UTC' + interval '13 hours'))
$$;

-- The snapshot's question for the date, as seen by the viewer.
create or replace function pg_temp.question(p_viewer uuid, p_day date)
returns jsonb language sql stable as $$
  select public.daily_day_snapshot(pg_temp.day_id(p_viewer, p_day), p_viewer, now()) -> 'question'
$$;

-- Whether the date's question came from the pool: a coach row, or a written
-- row that an earlier date had already asked (never one asked for the first
-- time, which only a pending row can be).
create or replace function pg_temp.from_pool(p_viewer uuid, p_day date)
returns boolean language sql stable as $$
  select q.user_a is null
      or exists (select 1 from public.couple_days e where e.question_id = cd.question_id and e.day < cd.day)
  from public.couple_days cd
  join public.daily_questions q on q.id = cd.question_id
  where cd.id = pg_temp.day_id(p_viewer, p_day)
$$;

-- ============================================
-- Structure and grants
-- ============================================
select is(
  (select count(*)::int
   from unnest(array['anon', 'authenticated']) as r(rolename)
   where has_function_privilege(r.rolename, 'public.record_written_question(uuid, uuid, text, text, timestamptz)', 'EXECUTE')),
  0,
  'WRITE-001: record_written_question is executable by neither anon nor authenticated'
);
select ok(
  has_function_privilege('service_role', 'public.record_written_question(uuid, uuid, text, text, timestamptz)', 'EXECUTE'),
  'WRITE-002: service_role keeps EXECUTE on it'
);
select is(
  (select count(*)::int
   from pg_proc p
   where p.oid = 'public.record_written_question(uuid, uuid, text, text, timestamptz)'::regprocedure
     and not p.prosecdef
     and p.proconfig @> array['search_path=""']),
  1,
  'WRITE-003: record_written_question is security invoker with an empty search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_written_question(uuid, text, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_written_question(uuid, text, text)', 'EXECUTE'),
  'WRITE-004: submit_written_question is executable by authenticated and not by anon'
);
select is(
  (select count(*)::int
   from pg_proc p
   where p.oid = 'public.submit_written_question(uuid, text, text)'::regprocedure
     and p.prosecdef
     and p.proconfig @> array['search_path=""']),
  1,
  'WRITE-005: submit_written_question is security definer with an empty search_path'
);

select pg_temp.mk((select a_id from t_ids), date '2030-02-01');
select throws_ok(
  format($$insert into public.daily_questions (this_text, that_text, user_a, user_b, source_day_id)
           values ('Sea', 'Sky', least(%L::uuid, %L::uuid), greatest(%L::uuid, %L::uuid), %L)$$,
         (select a_id from t_ids), (select b_id from t_ids), (select a_id from t_ids), (select b_id from t_ids),
         pg_temp.day_id((select a_id from t_ids), date '2030-02-01')),
  '23514', null,
  'WRITE-006: a written row without a target_day is refused'
);

-- ============================================
-- Consecutive dates name alternating writers
-- ============================================
select pg_temp.mk((select a_id from t_ids), d::date)
from generate_series(date '2030-03-01', date '2030-03-04', interval '1 day') d
order by d;

select is(
  (select array_agg(cd.writer = (select a_id from t_ids) order by cd.day)
   from public.couple_days cd
   where cd.day between date '2030-03-01' and date '2030-03-04'),
  array[false, true, false, true],
  'WRITE-007: the dates 2030-03-01 to 04 name alternating writers'
);

-- ============================================
-- A turn: refusals before the write, then the write (d = 2030-04-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-04-10');
select set_config('tests.w', pg_temp.writer((select a_id from t_ids), date '2030-04-10')::text, false);
select set_config('tests.n', pg_temp.other((select a_id from t_ids), date '2030-04-10')::text, false);

select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-04-10', 'Beach', 'Mountains')$$, current_setting('tests.n')),
  'DQ005', null,
  'WRITE-008: the partner who is not the writer, before their own pick, gets DQ005 (the pick is checked first)'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-04-10', 'Beach', 'Mountains')$$, current_setting('tests.w')),
  'DQ005', null,
  'WRITE-009: the writer before their own pick gets DQ005'
);

select pg_temp.pk(current_setting('tests.n')::uuid, date '2030-04-10');
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-04-10', 'Beach', 'Mountains')$$, current_setting('tests.n')),
  'DQ004', null,
  'WRITE-010: the partner who picked but is not the writer gets DQ004'
);
select is(
  (select count(*)::int from public.daily_questions where source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-04-10')),
  0,
  'WRITE-011: neither refusal wrote a question'
);

select pg_temp.pk(current_setting('tests.w')::uuid, date '2030-04-10');
select set_config('tests.w1',
  pg_temp.wq(current_setting('tests.w')::uuid, date '2030-04-10', '  Beach ', 'Mountains')::text, false);

select is(
  (select q.this_text || '/' || q.that_text || '/' || q.target_day
   from public.daily_questions q
   where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-04-10')),
  'Beach/Mountains/2030-04-11',
  'WRITE-012: the writer''s texts are stored trimmed, targeted at the next date'
);
select ok(
  (select q.user_a = least((select a_id from t_ids), (select b_id from t_ids))
      and q.user_b = greatest((select a_id from t_ids), (select b_id from t_ids))
   from public.daily_questions q
   where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-04-10')),
  'WRITE-013: and the row belongs to the ordered pair'
);
select is(
  current_setting('tests.w1')::jsonb ->> 'day' || '/' || ((current_setting('tests.w1')::jsonb -> 'write') - 'target_day')::text,
  '2030-04-10/{"done": true, "mine": true}',
  'WRITE-014: the snapshot is the source day''s, with write { mine, done } true'
);
select is(
  (public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-04-10'), current_setting('tests.n')::uuid, now()) -> 'write') - 'target_day',
  '{"done": true, "mine": false}'::jsonb,
  'WRITE-015: the other partner sees done true and mine false'
);

-- The next day asks it, the same question for both partners.
select pg_temp.mk((select a_id from t_ids), date '2030-04-11');
select is(
  pg_temp.question((select a_id from t_ids), date '2030-04-11'),
  '{"this": "Beach", "that": "Mountains"}'::jsonb,
  'WRITE-016: the next day asks the written question, for A'
);
select is(
  pg_temp.question((select b_id from t_ids), date '2030-04-11'),
  '{"this": "Beach", "that": "Mountains"}'::jsonb,
  'WRITE-017: and for B'
);

-- A retry returns the stored question's day, whatever the texts or `at`.
select is(
  pg_temp.wq(current_setting('tests.w')::uuid, date '2030-04-10', 'Other', 'Words', timestamptz '2030-04-12 05:00:00+00'),
  current_setting('tests.w1')::jsonb,
  'WRITE-018: a retry with other texts and `at` past the date returns the stored snapshot'
);
select is(
  (select count(*)::int || '/' || min(q.this_text) from public.daily_questions q
   where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-04-10')),
  '1/Beach',
  'WRITE-019: and the stored row is unchanged'
);

-- An unused turn: the day after next is the pool's, and the writer keeps alternating.
select pg_temp.mk((select a_id from t_ids), date '2030-04-12');
select ok(
  pg_temp.from_pool((select a_id from t_ids), date '2030-04-12'),
  'WRITE-020: the next writer writes nothing, and the day after is drawn from the pool'
);
select is(
  pg_temp.writer((select a_id from t_ids), date '2030-04-12'),
  current_setting('tests.w')::uuid,
  'WRITE-021: and its writer is the first day''s'
);

-- ============================================
-- A partner who is ahead (e = 2030-05-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-05-10');
select is(
  (select count(*)::int from public.daily_questions q
   where q.user_a = (select a_id from t_ids)
     and not exists (select 1 from public.couple_days asked where asked.question_id = q.id)),
  0,
  'WRITE-068: no written question of the pair waits to be asked'
);
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-05-10'),
    pg_temp.writer((select a_id from t_ids), date '2030-05-10'), now()) #>> '{write,target_day}',
  '2030-05-11',
  'WRITE-064: with the next date not open, the snapshot''s write.target_day is the day + 1'
);
select pg_temp.mk((select a_id from t_ids), date '2030-05-11');
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-05-10'),
    pg_temp.writer((select a_id from t_ids), date '2030-05-10'), now()) #>> '{write,target_day}',
  '2030-05-12',
  'WRITE-065: once a partner who is ahead opened it, write.target_day is the next free date'
);
select pg_temp.pk(pg_temp.writer((select a_id from t_ids), date '2030-05-10'), date '2030-05-10');
select set_config('tests.e1',
  pg_temp.wq(pg_temp.writer((select a_id from t_ids), date '2030-05-10'), date '2030-05-10', 'Hills', 'Plains')::text,
  false);
select is(
  (current_setting('tests.e1')::jsonb #>> '{write,target_day}')::date,
  (select q.target_day from public.daily_questions q
   where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-05-10')),
  'WRITE-066: with nothing else waiting, the write''s snapshot names its stored target'
);

select is(
  (select q.target_day from public.daily_questions q
   where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-05-10')),
  date '2030-05-12',
  'WRITE-022: with the next date already open, the target is the date after it'
);
select pg_temp.mk((select a_id from t_ids), date '2030-05-12');
select is(
  pg_temp.question((select a_id from t_ids), date '2030-05-12'),
  '{"this": "Hills", "that": "Plains"}'::jsonb,
  'WRITE-023: and that date asks it'
);
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-05-10'),
    pg_temp.writer((select a_id from t_ids), date '2030-05-10'), now()) #>> '{write,target_day}',
  '2030-05-12',
  'WRITE-067: once the target date asks it, write.target_day is that date'
);
select ok(
  pg_temp.from_pool((select a_id from t_ids), date '2030-05-11'),
  'WRITE-024: while the date already open kept its pool question'
);

-- ============================================
-- Two pending rows on one target (f = 2030-06-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-06-10');
select pg_temp.mk((select a_id from t_ids), date '2030-06-11');
select pg_temp.pk(pg_temp.writer((select a_id from t_ids), date '2030-06-10'), date '2030-06-10');
select pg_temp.wq(pg_temp.writer((select a_id from t_ids), date '2030-06-10'), date '2030-06-10', 'Pizza', 'Pasta');
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-06-11'),
    pg_temp.writer((select a_id from t_ids), date '2030-06-11'), now()) #>> '{write,target_day}',
  '2030-06-13',
  'WRITE-069: with the 10th''s question waiting on the 12th, the 11th''s sheet names the 13th'
);
select pg_temp.pk(pg_temp.writer((select a_id from t_ids), date '2030-06-11'), date '2030-06-11');
select is(
  pg_temp.wq(pg_temp.writer((select a_id from t_ids), date '2030-06-11'), date '2030-06-11', 'Hike', 'Nap')
    #>> '{write,target_day}',
  '2030-06-13',
  'WRITE-070: and its write''s snapshot names the 13th too'
);
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-06-10'),
    pg_temp.writer((select a_id from t_ids), date '2030-06-10'), now()) #>> '{write,target_day}',
  '2030-06-12',
  'WRITE-071: while the 10th''s names the 12th'
);

select is(
  (select array_agg(q.target_day order by q.this_text) from public.daily_questions q
   where q.this_text in ('Pizza', 'Hike')),
  array[date '2030-06-12', date '2030-06-12'],
  'WRITE-025: both rows target 2030-06-12'
);
select pg_temp.mk((select a_id from t_ids), date '2030-06-12');
select pg_temp.mk((select a_id from t_ids), date '2030-06-13');
select is(
  pg_temp.question((select a_id from t_ids), date '2030-06-12'),
  '{"this": "Pizza", "that": "Pasta"}'::jsonb,
  'WRITE-026: the target date takes the earlier source day''s question'
);
select is(
  pg_temp.question((select a_id from t_ids), date '2030-06-13'),
  '{"this": "Hike", "that": "Nap"}'::jsonb,
  'WRITE-027: and the next date takes the other'
);
select is(
  public.daily_day_snapshot(pg_temp.day_id((select a_id from t_ids), date '2030-06-11'),
    pg_temp.writer((select a_id from t_ids), date '2030-06-11'), now()) #>> '{write,target_day}',
  '2030-06-13',
  'WRITE-072: once asked, the 11th''s write.target_day is the 13th, the day that asks it'
);

-- ============================================
-- An earlier date never takes it; a later one does (g = 2030-07-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-07-10');
select pg_temp.pk(pg_temp.writer((select a_id from t_ids), date '2030-07-10'), date '2030-07-10');
select pg_temp.wq(pg_temp.writer((select a_id from t_ids), date '2030-07-10'), date '2030-07-10', 'Books', 'Films');
select pg_temp.mk((select a_id from t_ids), date '2030-07-09');

select ok(
  pg_temp.from_pool((select a_id from t_ids), date '2030-07-09'),
  'WRITE-028: a date before the target draws from the pool'
);
select is(
  (select count(*)::int from public.couple_days cd
   join public.daily_questions q on q.id = cd.question_id
   where q.this_text = 'Books'),
  0,
  'WRITE-029: and the pending row stays unasked'
);
select pg_temp.mk((select a_id from t_ids), date '2030-07-15');
select is(
  pg_temp.question((select a_id from t_ids), date '2030-07-15'),
  '{"this": "Books", "that": "Films"}'::jsonb,
  'WRITE-030: a later date, the target having got no row, still asks it'
);

-- ============================================
-- Texts (h = 2030-08-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-08-10');
select set_config('tests.hw', pg_temp.writer((select a_id from t_ids), date '2030-08-10')::text, false);
select pg_temp.pk(current_setting('tests.hw')::uuid, date '2030-08-10');

select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', %L, 'Tea')$$, current_setting('tests.hw'), '   '),
  'DQ003', 'The first option must be 1 to 40 characters',
  'WRITE-031: a blank first text is refused with DQ003'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', 'Tea', %L)$$, current_setting('tests.hw'), E' \t\n'),
  'DQ003', 'The second option must be 1 to 40 characters',
  'WRITE-032: a whitespace-only second text is refused with DQ003'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', %L, 'Tea')$$, current_setting('tests.hw'), null::text),
  'DQ003', 'The first option must be 1 to 40 characters',
  'WRITE-033: a null first text is refused with DQ003'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', 'Tea', %L)$$, current_setting('tests.hw'), null::text),
  'DQ003', 'The second option must be 1 to 40 characters',
  'WRITE-034: a null second text is refused with DQ003'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', %L, 'Tea')$$, current_setting('tests.hw'), repeat('x', 41)),
  'DQ003', 'The first option must be 1 to 40 characters',
  'WRITE-035: a 41-character first text is refused with DQ003'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', 'Tea', %L)$$, current_setting('tests.hw'), repeat('x', 41)),
  'DQ003', 'The second option must be 1 to 40 characters',
  'WRITE-036: and so is a 41-character second text'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', 'Tea', 'tEA ')$$, current_setting('tests.hw')),
  'DQ003', 'The two options must differ',
  'WRITE-037: two texts equal ignoring case and padding are refused with DQ003'
);
select is(
  (select count(*)::int from public.daily_questions where source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-08-10')),
  0,
  'WRITE-038: none of those wrote a question'
);

select lives_ok(
  format($$select pg_temp.wq(%L, date '2030-08-10', %L, %L)$$, current_setting('tests.hw'), repeat('x', 40), E'\tSea'),
  'WRITE-039: a 40-character text and a tab-padded one are accepted'
);
select is(
  (select q.this_text = repeat('x', 40) and q.that_text = 'Sea'
   from public.daily_questions q where q.source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-08-10')),
  true,
  'WRITE-040: and stored trimmed'
);

-- ============================================
-- The turn ends with its date, in the zone of the pick (i = 2030-09-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-09-10');
select set_config('tests.iw', pg_temp.writer((select a_id from t_ids), date '2030-09-10')::text, false);
select public.record_daily_pick(
  current_setting('tests.iw')::uuid, pg_temp.day_id((select a_id from t_ids), date '2030-09-10'), 'this',
  timestamp '2030-09-10 10:00' at time zone 'Asia/Tokyo', 'Asia/Tokyo', 540,
  timestamp '2030-09-10 10:00' at time zone 'Asia/Tokyo');

-- 16:00 UTC is still the 10th in UTC and already 01:00 on the 11th in Tokyo.
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-09-10', 'Rock', 'Roll', timestamptz '2030-09-10 16:00:00+00')$$, current_setting('tests.iw')),
  'DQ006', null,
  'WRITE-041: `at` on the next date in the zone of the pick is refused with DQ006'
);
select throws_ok(
  format($$select pg_temp.wq(%L, date '2030-09-10', '   ', '   ', timestamptz '2030-09-10 16:00:00+00')$$, current_setting('tests.iw')),
  'DQ006', null,
  'WRITE-042: and the date is checked before the texts'
);
select is(
  (select count(*)::int from public.daily_questions where source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-09-10')),
  0,
  'WRITE-043: neither wrote a question'
);
select is(
  (pg_temp.wq(current_setting('tests.iw')::uuid, date '2030-09-10', 'Rock', 'Roll', timestamptz '2030-09-10 14:59:00+00')
    -> 'write') - 'target_day',
  '{"done": true, "mine": true}'::jsonb,
  'WRITE-044: 14:59 UTC is still the 10th in Tokyo and is accepted'
);

-- ============================================
-- An outsider, an unlinked caller, a null viewer, an unknown day (k = 2030-10-10)
-- ============================================
select pg_temp.mk((select a_id from t_ids), date '2030-10-10');
select pg_temp.pk(pg_temp.writer((select a_id from t_ids), date '2030-10-10'), date '2030-10-10');

select throws_ok(
  format($$select public.record_written_question(%L, %L, 'Up', 'Down', timestamptz '2030-10-10 13:00:00+00')$$,
         (select o_id from t_ids), pg_temp.day_id((select a_id from t_ids), date '2030-10-10')),
  'P0002', 'Day not found',
  'WRITE-045: a member of another couple gets P0002'
);
select throws_ok(
  format($$select public.record_written_question(%L, %L, 'Up', 'Down', timestamptz '2030-10-10 13:00:00+00')$$,
         (select u_id from t_ids), pg_temp.day_id((select a_id from t_ids), date '2030-10-10')),
  'P0002', 'Day not found',
  'WRITE-046: an unlinked caller gets P0002'
);
select throws_ok(
  format($$select public.record_written_question(null, %L, 'Up', 'Down', timestamptz '2030-10-10 13:00:00+00')$$,
         pg_temp.day_id((select a_id from t_ids), date '2030-10-10')),
  'P0002', 'Day not found',
  'WRITE-047: a null viewer gets P0002'
);
select throws_ok(
  format($$select public.record_written_question(%L, gen_random_uuid(), 'Up', 'Down', timestamptz '2030-10-10 13:00:00+00')$$,
         pg_temp.writer((select a_id from t_ids), date '2030-10-10')),
  'P0002', 'Day not found',
  'WRITE-048: an unknown day gets P0002'
);
select is(
  (select count(*)::int from public.daily_questions where source_day_id = pg_temp.day_id((select a_id from t_ids), date '2030-10-10')),
  0,
  'WRITE-049: none of those wrote a question'
);

-- ============================================
-- The pool takes a written row once it has been asked (x = 2030-11-10)
-- ============================================
select pg_temp.mk((select p_id from t_ids), date '2030-11-10');
select pg_temp.pk(pg_temp.writer((select p_id from t_ids), date '2030-11-10'), date '2030-11-10');
select pg_temp.wq(pg_temp.writer((select p_id from t_ids), date '2030-11-10'), date '2030-11-10', 'Rivers', 'Lakes');

select pg_temp.mk((select p_id from t_ids), d::date)
from generate_series(date '2030-11-11', date '2030-11-17', interval '1 day') d
order by d;

select is(
  pg_temp.question((select q_id from t_ids), date '2030-11-11'),
  '{"this": "Rivers", "that": "Lakes"}'::jsonb,
  'WRITE-050: the third couple''s next day asks its written question'
);
select is(
  (select count(distinct cd.question_id)::int || '/' || min(cd.cycle) || '/' || max(cd.cycle)
   from public.couple_days cd
   where cd.user_a = least((select p_id from t_ids), (select q_id from t_ids))
     and cd.user_b = greatest((select p_id from t_ids), (select q_id from t_ids))
     and cd.day between date '2030-11-10' and date '2030-11-13'),
  '4/1/1',
  'WRITE-051: cycle 1 holds the three coach questions and the written one, once each'
);
select is(
  (select count(distinct cd.question_id)::int || '/' || min(cd.cycle) || '/' || max(cd.cycle)
   from public.couple_days cd
   where cd.user_a = least((select p_id from t_ids), (select q_id from t_ids))
     and cd.user_b = greatest((select p_id from t_ids), (select q_id from t_ids))
     and cd.day between date '2030-11-14' and date '2030-11-17'),
  '4/2/2',
  'WRITE-052: cycle 2 draws all four, so the asked written question joined the pool'
);
select is(
  (select count(*)::int from public.couple_days cd
   join public.daily_questions q on q.id = cd.question_id
   where q.this_text = 'Rivers'),
  2,
  'WRITE-053: and it was asked once in each cycle'
);

-- ============================================
-- No draw takes another couple's written row
-- ============================================
select pg_temp.mk((select o_id from t_ids), d::date)
from generate_series(date '2031-01-01', date '2031-01-08', interval '1 day') d
order by d;

select is(
  (select count(distinct cd.question_id)::int || '/' || max(cd.cycle)
   from public.couple_days cd
   where cd.user_a = least((select o_id from t_ids), (select d_id from t_ids))
     and cd.user_b = greatest((select o_id from t_ids), (select d_id from t_ids))
     and cd.day between date '2031-01-01' and date '2031-01-08'),
  '3/3',
  'WRITE-054: another couple''s eight days span three cycles over its three coach questions'
);
select is(
  (select count(*)::int from public.couple_days cd
   join public.daily_questions q on q.id = cd.question_id
   where q.user_a is not null
     and (q.user_a, q.user_b) is distinct from (cd.user_a, cd.user_b)),
  0,
  'WRITE-055: no couple_days row of any pair asks another pair''s written question'
);

-- ============================================
-- The client RPC, today (o and d)
-- ============================================
select tests.authenticate_as((select o_id from t_ids));
select set_config('tests.c_res', public.get_daily_day('UTC', 0, now())::text, false);
reset role;

select set_config('tests.c_day', current_setting('tests.c_res')::jsonb #>> '{snapshot,day_id}', false);
select set_config('tests.c_w',
  (select cd.writer::text from public.couple_days cd where cd.id = current_setting('tests.c_day')::uuid), false);
select set_config('tests.c_n',
  (select case when cd.writer = cd.user_a then cd.user_b else cd.user_a end::text
   from public.couple_days cd where cd.id = current_setting('tests.c_day')::uuid), false);

select tests.authenticate_as(current_setting('tests.c_n')::uuid);
select public.submit_daily_pick(current_setting('tests.c_day')::uuid, 'that', now(), 'UTC', 0);
select throws_ok(
  format($$select public.submit_written_question(%L, 'Hot', 'Cold')$$, current_setting('tests.c_day')),
  'DQ004', null,
  'WRITE-056: through the client RPC, the partner who is not the writer gets DQ004'
);
reset role;

select tests.authenticate_as(current_setting('tests.c_w')::uuid);
select throws_ok(
  format($$select public.submit_written_question(%L, 'Hot', 'Cold')$$, current_setting('tests.c_day')),
  'DQ005', null,
  'WRITE-057: and the writer before their own pick gets DQ005'
);
select public.submit_daily_pick(current_setting('tests.c_day')::uuid, 'this', now(), 'UTC', 0);
select set_config('tests.c_sub',
  public.submit_written_question(current_setting('tests.c_day')::uuid, ' Hot', 'Cold ')::text, false);
reset role;

select is(
  (current_setting('tests.c_sub')::jsonb -> 'write') - 'target_day',
  '{"done": true, "mine": true}'::jsonb,
  'WRITE-058: the writer''s submit answers with write.done true'
);
select is(
  (select q.this_text || '/' || q.that_text || '/' || (q.target_day = (now() at time zone 'UTC')::date + 1)
   from public.daily_questions q where q.source_day_id = current_setting('tests.c_day')::uuid),
  'Hot/Cold/true',
  'WRITE-059: and the row is targeted at tomorrow'
);

select tests.authenticate_as(current_setting('tests.c_w')::uuid);
select is(
  public.submit_written_question(current_setting('tests.c_day')::uuid, 'Other', 'Words'),
  current_setting('tests.c_sub')::jsonb,
  'WRITE-060: a repeat through the client RPC returns the stored snapshot'
);
reset role;

select tests.clear_jwt();
select throws_ok(
  $$select public.submit_written_question(gen_random_uuid(), 'Hot', 'Cold')$$,
  'Authentication required',
  'WRITE-061: submit_written_question rejects a NULL auth.uid()'
);

select tests.authenticate_as((select u_id from t_ids));
select throws_ok(
  format($$select public.submit_written_question(%L, 'Hot', 'Cold')$$, current_setting('tests.c_day')),
  'P0002', 'Day not found',
  'WRITE-062: an unlinked caller gets P0002 through the client RPC'
);
reset role;

select tests.authenticate_as(current_setting('tests.c_w')::uuid);
select throws_ok(
  $$select * from public.record_written_question(gen_random_uuid(), gen_random_uuid(), 'Hot', 'Cold', now())$$,
  '42501', null,
  'WRITE-063: and the internal function is denied to authenticated'
);
reset role;

select * from finish();
rollback;
