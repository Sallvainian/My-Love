-- ============================================
-- pgTAP: the coach's pool of at least 500 questions (20261106000500)
--
-- Story 6.4 of architecture-daily-question (epic R5). Pinned here, over the
-- rows whose id starts with `da11e000-` (the seed; the three coach rows E2E
-- inserted before story 6.10 and any other stack data are not counted):
--   * the pool holds at least 500 questions, all coach rows (user_a null);
--   * the option rules: trimmed, 1-40 characters, differ ignoring case, printable
--     ASCII only, no trailing `?`;
--   * no question repeats as an unordered pair ignoring case;
--   * with only the seed (and no test rows) a linked pair's get_daily_day answers
--     {status: ok} with a seeded question, never P0002;
--   * a draw over exactly the seeded pool uses every question once in cycle 1
--     before cycle 2 opens with a seeded question.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(11);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Pool ' || left(test_email, 6))
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

-- a_id < b_id, so A is couple_days.user_a. They are one linked pair.
create temporary table t_ids as
with u as (
  select
    tests.create_test_user('pool-1@example.com') as x,
    tests.create_test_user('pool-2@example.com') as y
)
select least(x, y) as a_id, greatest(x, y) as b_id from u;

grant select on t_ids to authenticated, anon, service_role;

update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);

-- A coach row outside the seed prefix, standing in for the rows E2E inserted on
-- local stacks before story 6.10: the seed tests must not count it.
insert into public.daily_questions (id, this_text, that_text) values
  ('00000000-0000-4000-8000-00000000d0f0', 'Stand-in one', 'Stand-in two');

-- ============================================
-- The seed: count, coach rows, option rules
-- ============================================
select cmp_ok(
  (select count(*)::int from public.daily_questions where id::text like 'da11e000-%'),
  '>=',
  500,
  'POOL-001: the seed holds at least 500 questions'
);

select is(
  (select count(*)::int from public.daily_questions
   where id::text like 'da11e000-%'
     and (user_a is not null or user_b is not null or target_day is not null or source_day_id is not null)),
  0,
  'POOL-002: every seeded question is a coach row'
);

select is(
  (select count(*)::int from public.daily_questions
   where id::text like 'da11e000-%'
     and (this_text <> btrim(this_text) or that_text <> btrim(that_text)
          or char_length(this_text) not between 1 and 40
          or char_length(that_text) not between 1 and 40
          or lower(this_text) = lower(that_text))),
  0,
  'POOL-003: every seeded option is trimmed, 1-40 characters and differs from its pair ignoring case'
);

select is(
  (select count(*)::int from public.daily_questions
   where id::text like 'da11e000-%'
     and (this_text !~ '^[\x20-\x7e]+$' or that_text !~ '^[\x20-\x7e]+$'
          or this_text ~ '\?$' or that_text ~ '\?$')),
  0,
  'POOL-004: every seeded option is printable ASCII and does not end in a question mark'
);

select is(
  (select count(*)::int from (
     select distinct least(lower(this_text), lower(that_text)), greatest(lower(this_text), lower(that_text))
     from public.daily_questions where id::text like 'da11e000-%'
   ) p),
  (select count(*)::int from public.daily_questions where id::text like 'da11e000-%'),
  'POOL-005: no seeded question repeats as an unordered pair ignoring case'
);

select is(
  (select count(*)::int from public.daily_questions
   where id::text like 'da11e000-%'
     and id::text !~ '^da11e000-0000-4000-8000-[0-9]{12}$'),
  0,
  'POOL-006: every seeded id follows the fixed scheme'
);

-- ============================================
-- get_daily_day over the seed alone
-- ============================================
delete from public.couple_days;
delete from public.daily_questions where user_a is null and id::text not like 'da11e000-%';

select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.res', public.get_daily_day('UTC', 0, now())::text, false);
reset role;

select is(
  current_setting('tests.res')::jsonb ->> 'status',
  'ok',
  'POOL-007: a linked pair with no test rows gets {status: ok}, not P0002'
);

select ok(
  (select cd.question_id::text like 'da11e000-%'
   from public.couple_days cd
   where cd.user_a = (select a_id from t_ids) and cd.user_b = (select b_id from t_ids)),
  'POOL-008: the day asks a seeded question'
);

-- ============================================
-- A full cycle over exactly the seeded pool
-- ============================================
delete from public.couple_days;

select set_config('tests.n', (select count(*)::text from public.daily_questions where user_a is null), false);

do $$
declare
  v_a uuid := (select a_id from t_ids);
  v_b uuid := (select b_id from t_ids);
  v_n integer := current_setting('tests.n')::integer;
  i integer;
begin
  for i in 0..v_n - 1 loop
    perform public.assign_couple_day(v_a, v_b, date '2031-01-01' + i);
  end loop;
end $$;

select is(
  (select count(distinct question_id)::text || '/' || max(cycle)::text || '/' || count(*)::text
   from public.couple_days
   where user_a = (select a_id from t_ids) and user_b = (select b_id from t_ids)),
  current_setting('tests.n') || '/1/' || current_setting('tests.n'),
  'POOL-009: N consecutive days draw N distinct questions, all in cycle 1'
);

select is(
  (select count(*)::int from public.daily_questions q
   where q.id::text like 'da11e000-%'
     and not exists (
       select 1 from public.couple_days cd
       where cd.user_a = (select a_id from t_ids) and cd.user_b = (select b_id from t_ids)
         and cd.question_id = q.id
     )),
  0,
  'POOL-010: every seeded question was used once the cycle is done'
);

select public.assign_couple_day(
  (select a_id from t_ids), (select b_id from t_ids),
  date '2031-01-01' + current_setting('tests.n')::integer
);

select is(
  (select cd.cycle::text || '/' || (cd.question_id::text like 'da11e000-%')::text
   from public.couple_days cd
   where cd.user_a = (select a_id from t_ids) and cd.user_b = (select b_id from t_ids)
     and cd.day = date '2031-01-01' + current_setting('tests.n')::integer),
  '2/true',
  'POOL-011: day N + 1 opens cycle 2 with a seeded question'
);

select * from finish();
rollback;
