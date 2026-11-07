-- ============================================
-- pgTAP: reset_bot_daily_days (20261106020000)
--
-- Story 6.11: the post-deploy live check clears the bot pair's days with it.
-- Pinned here:
--   * Only an account whose auth.users email equals (case-insensitively) the
--     test_email or partner_email value of claude_bot_config may call it: a
--     linked non-bot gets 42501 and keeps every day and pick; no session gets
--     'Authentication required'; anon cannot execute it.
--   * A bot deletes its current couple's days and their picks and gets the
--     count; another couple's days and picks stay; a repeat returns 0.
--   * A bot with no partner deletes nothing and gets 0; a bot whose partner is
--     not a bot is refused with 42501 and that couple keeps its days, and so is
--     the non-bot linked to that bot (the caller check alone refuses it).
--   * A profile row carrying a bot email passes neither check: an unlinked
--     non-bot with one is refused with 42501, not answered 0.
--
-- The two claude_bot_config rows are pointed at this file's own @example.com
-- emails inside the transaction (22_claude_bot_config_no_secret.sql runs
-- against the rows the migrations seed); the rollback restores them.
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(24);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Reset ' || left(test_email, 6))
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

-- The bot pair (a bot's auth email is lowercase, its config value is not),
-- a linked non-bot couple, a third account kept unlinked, and an unlinked
-- non-bot.
create temporary table t_ids as
select
  tests.create_test_user('reset-bot-a@example.com') as bot_a,
  tests.create_test_user('reset-bot-b@example.com') as bot_b,
  tests.create_test_user('reset-other-1@example.com') as n_1,
  tests.create_test_user('reset-other-2@example.com') as n_2,
  tests.create_test_user('reset-bot-lone@example.com') as lone,
  tests.create_test_user('reset-spoof@example.com') as spoof;

grant select on t_ids to authenticated, anon, service_role;

update public.claude_bot_config set value = 'Reset-Bot-A@Example.com' where key = 'test_email';
update public.claude_bot_config set value = 'reset-bot-b@example.com' where key = 'partner_email';

update public.users set partner_id = (select bot_b from t_ids) where id = (select bot_a from t_ids);
update public.users set partner_id = (select bot_a from t_ids) where id = (select bot_b from t_ids);
update public.users set partner_id = (select n_2 from t_ids) where id = (select n_1 from t_ids);
update public.users set partner_id = (select n_1 from t_ids) where id = (select n_2 from t_ids);

-- Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

-- Two days with both partners' picks for a couple. Fixed future dates, as 42
-- does: assign_couple_day stamps created_at = now() and record_daily_pick
-- refuses a pick dated more than five minutes before that, so a pick at noon
-- of today's date would abort the file whenever it ran after 12:05 UTC. Each
-- pick is dated at noon UTC on its own day.
create or replace function pg_temp.seed_days(p_x uuid, p_y uuid)
returns void language plpgsql as $$
declare
  v_day uuid;
  v_date date;
  v_at timestamptz;
begin
  foreach v_date in array array[date '2030-03-01', date '2030-03-02'] loop
    v_day := (public.assign_couple_day(least(p_x, p_y), greatest(p_x, p_y), v_date)).id;
    v_at := v_date::timestamp at time zone 'UTC' + interval '12 hours';
    perform public.record_daily_pick(p_x, v_day, 'this', v_at, 'UTC', 0, v_at);
    perform public.record_daily_pick(p_y, v_day, 'that', v_at, 'UTC', 0, v_at);
  end loop;
end; $$;

select pg_temp.seed_days((select bot_a from t_ids), (select bot_b from t_ids));
select pg_temp.seed_days((select n_1 from t_ids), (select n_2 from t_ids));

create or replace function pg_temp.days_of(p_x uuid, p_y uuid)
returns integer language sql stable as $$
  select count(*)::int from public.couple_days
  where user_a = least(p_x, p_y) and user_b = greatest(p_x, p_y)
$$;

create or replace function pg_temp.picks_of(p_x uuid, p_y uuid)
returns integer language sql stable as $$
  select count(*)::int from public.daily_picks dp
  join public.couple_days cd on cd.id = dp.day_id
  where cd.user_a = least(p_x, p_y) and cd.user_b = greatest(p_x, p_y)
$$;

-- ============================================
-- Shape
-- ============================================
select is(
  (select p.prosecdef::text || '/' || (p.proconfig @> array['search_path=""'])::text || '/' || p.pronargs
   from pg_proc p where p.oid = 'public.reset_bot_daily_days()'::regprocedure),
  'true/true/0',
  'RESET-001: security definer, empty search_path, no arguments'
);
select ok(
  has_function_privilege('authenticated', 'public.reset_bot_daily_days()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reset_bot_daily_days()', 'EXECUTE'),
  'RESET-002: executable by authenticated, not by anon'
);

select is(
  pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)) || '/'
    || pg_temp.picks_of((select bot_a from t_ids), (select bot_b from t_ids)) || '/'
    || pg_temp.days_of((select n_1 from t_ids), (select n_2 from t_ids)) || '/'
    || pg_temp.picks_of((select n_1 from t_ids), (select n_2 from t_ids)),
  '2/4/2/4',
  'RESET-003: both couples start with two days and four picks'
);

-- ============================================
-- Refused callers
-- ============================================
select tests.authenticate_as((select n_1 from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-004: a linked non-bot is refused with 42501'
);
reset role;

select is(
  pg_temp.days_of((select n_1 from t_ids), (select n_2 from t_ids)) || '/'
    || pg_temp.picks_of((select n_1 from t_ids), (select n_2 from t_ids)),
  '2/4',
  'RESET-005: and the non-bot couple keeps its days and picks'
);

select tests.authenticate_as((select n_2 from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-006: the non-bot''s partner is refused too'
);
reset role;

select tests.authenticate_as((select bot_a from t_ids));
select tests.clear_jwt();
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  'Authentication required',
  'RESET-007: a NULL auth.uid() is refused'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-008: anon cannot execute it'
);
reset role;

select is(
  pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)),
  2,
  'RESET-009: no refused call deleted a bot day'
);

-- ============================================
-- A bot resets its own pair (test_email is stored in another case)
-- ============================================
select tests.authenticate_as((select bot_a from t_ids));
select set_config('tests.first', public.reset_bot_daily_days()::text, false);
reset role;

select is(
  current_setting('tests.first'),
  '2',
  'RESET-010: bot A deletes the two days and gets the count; the config value differs only in case'
);
select is(
  pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)) || '/'
    || pg_temp.picks_of((select bot_a from t_ids), (select bot_b from t_ids)),
  '0/0',
  'RESET-011: the pair''s days and picks are gone'
);
select is(
  (select count(*)::int from public.daily_picks dp
   where dp.user_id in ((select bot_a from t_ids), (select bot_b from t_ids))),
  0,
  'RESET-012: no pick of either bot is left (the cascade reached daily_picks)'
);
select is(
  pg_temp.days_of((select n_1 from t_ids), (select n_2 from t_ids)) || '/'
    || pg_temp.picks_of((select n_1 from t_ids), (select n_2 from t_ids)),
  '2/4',
  'RESET-013: the other couple''s days and picks are untouched'
);

select tests.authenticate_as((select bot_a from t_ids));
select is(
  public.reset_bot_daily_days(),
  0,
  'RESET-014: a repeat finds nothing and returns 0'
);
reset role;

-- ============================================
-- The partner bot, matched by the exact lowercase value
-- ============================================
select pg_temp.seed_days((select bot_a from t_ids), (select bot_b from t_ids));

select tests.authenticate_as((select bot_b from t_ids));
select set_config('tests.second', public.reset_bot_daily_days()::text, false);
reset role;

select is(
  current_setting('tests.second') || '/'
    || pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)),
  '2/0',
  'RESET-015: bot B resets the same pair'
);

-- ============================================
-- A bot with no partner
-- ============================================
update public.claude_bot_config set value = 'reset-bot-lone@example.com' where key = 'partner_email';

select tests.authenticate_as((select lone from t_ids));
select is(
  public.reset_bot_daily_days(),
  0,
  'RESET-016: a bot with no partner gets 0'
);
reset role;

select is(
  pg_temp.days_of((select n_1 from t_ids), (select n_2 from t_ids)),
  2,
  'RESET-017: and deletes nothing of anyone''s'
);

-- ============================================
-- A bot linked to a non-bot: bot A's partner (B) stops being a claude_bot_config
-- account, so A may not delete the real user's days
-- ============================================
select pg_temp.seed_days((select bot_a from t_ids), (select bot_b from t_ids));

select tests.authenticate_as((select bot_a from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-018: a bot whose partner is not a bot is refused with 42501'
);
reset role;

select is(
  pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)) || '/'
    || pg_temp.picks_of((select bot_a from t_ids), (select bot_b from t_ids)),
  '2/4',
  'RESET-019: and that couple keeps its days and picks'
);

-- B is now the non-bot linked to a bot: only the caller check can refuse it.
select tests.authenticate_as((select bot_b from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-020: a non-bot linked to a bot is refused with 42501'
);
reset role;

select is(
  pg_temp.days_of((select bot_a from t_ids), (select bot_b from t_ids)) || '/'
    || pg_temp.picks_of((select bot_a from t_ids), (select bot_b from t_ids)),
  '2/4',
  'RESET-021: and the couple keeps its days and picks'
);

-- ============================================
-- The check reads auth.users, not the profile row
-- ============================================
-- Unlinked, so the caller check alone decides: reading the profile row would
-- let it through to the no-partner answer, 0.
update public.users set email = 'reset-bot-lone@example.com' where id = (select spoof from t_ids);

select tests.authenticate_as((select spoof from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-022: an unlinked non-bot whose profile row carries a bot email is refused with 42501'
);
reset role;

update public.users set email = 'reset-bot-lone@example.com' where id = (select n_1 from t_ids);

select tests.authenticate_as((select n_1 from t_ids));
select throws_ok(
  $$select public.reset_bot_daily_days()$$,
  '42501', null,
  'RESET-023: a profile row carrying a bot email does not make a non-bot a bot'
);
reset role;

select is(
  pg_temp.days_of((select n_1 from t_ids), (select n_2 from t_ids)),
  2,
  'RESET-024: and that couple keeps its days'
);

select * from finish();
rollback;
