-- ============================================
-- pgTAP: the Daily Question gate (20261105010000)
--
-- The AD-5 file of architecture-daily-question. Pinned here:
--   * RLS on and zero policies on daily_questions, couple_days and
--     daily_picks; no anon or authenticated privilege on any of them (SELECT
--     included); service_role holds column SELECT on every daily_picks column
--     except `choice` and no table privilege.
--   * The six internal functions are denied to anon and authenticated; the two
--     client RPCs are granted to authenticated only.
--   * Every client RPC called as the second partner BEFORE their own pick
--     returns no choice, Same/Different mark or count for that day, and a
--     direct select on daily_picks is denied. Every new client RPC is added
--     here in the same change.
--   * The matrix of story 6.1: both partners fetch one day; an unlinked
--     caller creates nothing; the reveal; a repeat submit changes nothing; a
--     foreign day and a bad choice write nothing.
--   * assign_couple_day: idempotent, the writer alternates by date, the draw
--     covers the pool in each cycle before opening the next, an empty pool
--     raises P0002.
--   * effective_zone: an IANA name passes through; anything else becomes a
--     POSIX spec equal to the interval of the offset.
--   * Story 6.2 (20261105210000) added record_user_time_zone and
--     record_daily_pick, listed with the other internal functions. A pick made
--     now on tomorrow's date is refused by its date check, so the second-day
--     picks go through record_daily_pick with instants on that date. The window,
--     date and zone cases live in 41_daily_question_own_clocks.sql.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(100);

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

create or replace function tests.clear_jwt()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- a_id < b_id, so A is couple_days.user_a. o_id and d_id are another linked
-- couple; u_id has no partner.
create temporary table t_ids as
with u as (
  select
    tests.create_test_user('daily-1@example.com') as x,
    tests.create_test_user('daily-2@example.com') as y,
    tests.create_test_user('daily-3@example.com') as o_id,
    tests.create_test_user('daily-4@example.com') as d_id,
    tests.create_test_user('daily-5@example.com') as u_id
)
select least(x, y) as a_id, greatest(x, y) as b_id, o_id, d_id, u_id from u;

grant select on t_ids to authenticated, anon, service_role;

update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);
update public.users set partner_id = (select d_id from t_ids) where id = (select o_id from t_ids);
update public.users set partner_id = (select o_id from t_ids) where id = (select d_id from t_ids);

-- The migration seeds no pool (a later story does), and a local stack may hold
-- one. Start from exactly three coach questions; the rows go with the rollback.
delete from public.couple_days;
delete from public.daily_questions where user_a is null;
insert into public.daily_questions (this_text, that_text) values
  ('Tea', 'Coffee'),
  ('Cats', 'Dogs'),
  ('Sun', 'Rain');

-- ============================================
-- Structure, RLS and grants
-- ============================================
select has_table('public', 'daily_questions', 'DAILY-001: daily_questions exists');
select has_table('public', 'couple_days', 'DAILY-002: couple_days exists');
select has_table('public', 'daily_picks', 'DAILY-003: daily_picks exists');

select is(
  (select count(*)::int from pg_class
   where oid in ('public.daily_questions'::regclass, 'public.couple_days'::regclass, 'public.daily_picks'::regclass)
     and relrowsecurity),
  3,
  'DAILY-004: RLS is enabled on all three tables'
);

select policies_are('public', 'daily_questions', array[]::text[], 'DAILY-005: daily_questions has no policy');
select policies_are('public', 'couple_days', array[]::text[], 'DAILY-006: couple_days has no policy');
select policies_are('public', 'daily_picks', array[]::text[], 'DAILY-007: daily_picks has no policy');

select is(
  (select count(*)::int
   from unnest(array['public.daily_questions', 'public.couple_days', 'public.daily_picks']) as t(tbl),
        unnest(array['anon', 'authenticated']) as r(rolename)
   where has_any_column_privilege(r.rolename, t.tbl, 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege(r.rolename, t.tbl, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')),
  0,
  'DAILY-008: anon and authenticated hold no privilege on any daily table, SELECT included'
);

select is(
  (select array_agg(a.attname order by a.attname)
   from pg_attribute a
   where a.attrelid = 'public.daily_picks'::regclass and a.attnum > 0 and not a.attisdropped
     and has_column_privilege('service_role', a.attrelid, a.attnum, 'SELECT')),
  (select array_agg(a.attname order by a.attname)
   from pg_attribute a
   where a.attrelid = 'public.daily_picks'::regclass and a.attnum > 0 and not a.attisdropped
     and a.attname <> 'choice'),
  'DAILY-009: service_role may select every daily_picks column except choice'
);

select ok(
  not has_column_privilege('service_role', 'public.daily_picks', 'choice', 'SELECT')
  and not has_table_privilege('service_role', 'public.daily_picks', 'SELECT'),
  'DAILY-010: service_role cannot read choice, and holds no table SELECT on daily_picks'
);

select ok(
  not has_table_privilege('service_role', 'public.daily_picks', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'),
  'DAILY-011: service_role cannot write daily_picks and holds no other table privilege on it'
);

select is(
  (select count(*)::int
   from unnest(array['effective_zone(text, integer)', 'assign_couple_day(uuid, uuid, date)',
                     'visible_daily_picks(uuid, timestamptz)', 'daily_day_snapshot(uuid, uuid, timestamptz)',
                     'record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)',
                     'record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)']) as f(sig),
        unnest(array['anon', 'authenticated']) as r(rolename)
   where has_function_privilege(r.rolename, 'public.' || f.sig, 'EXECUTE')),
  0,
  'DAILY-012: the six internal functions are executable by neither anon nor authenticated'
);

select is(
  (select count(*)::int
   from unnest(array['effective_zone(text, integer)', 'assign_couple_day(uuid, uuid, date)',
                     'visible_daily_picks(uuid, timestamptz)', 'daily_day_snapshot(uuid, uuid, timestamptz)',
                     'record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)',
                     'record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)']) as f(sig)
   where has_function_privilege('service_role', 'public.' || f.sig, 'EXECUTE')),
  6,
  'DAILY-013: service_role keeps EXECUTE on the six internal functions'
);

select ok(
  has_function_privilege('authenticated', 'public.get_daily_day(text, integer, timestamptz)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_daily_pick(uuid, text, timestamptz, text, integer)', 'EXECUTE'),
  'DAILY-014: the two client RPCs are executable by authenticated'
);

select ok(
  not has_function_privilege('anon', 'public.get_daily_day(text, integer, timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_daily_pick(uuid, text, timestamptz, text, integer)', 'EXECUTE'),
  'DAILY-015: the two client RPCs are not executable by anon'
);

-- ============================================
-- Table checks
-- ============================================
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text) values (' Padded', 'Plain')$$,
  '23514', null, 'DAILY-016: a padded text is refused'
);
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text) values (E'\tPadded', 'Plain')$$,
  '23514', null, 'DAILY-017: a tab-padded text is refused'
);
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text) values ('Plain', E'Padded\n')$$,
  '23514', null, 'DAILY-018: a newline-padded text is refused'
);
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text) values (repeat('x', 41), 'Plain')$$,
  '23514', null, 'DAILY-019: a text over 40 characters is refused'
);
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text) values ('Tea', 'tEA')$$,
  '23514', null, 'DAILY-020: texts that differ only in case are refused'
);
select throws_ok(
  $$insert into public.daily_questions (this_text, that_text, target_day) values ('Early', 'Late', date '2030-01-01')$$,
  '23514', null, 'DAILY-021: a coach row with a target day is refused'
);
select throws_ok(
  format($$insert into public.daily_questions (this_text, that_text, user_a, user_b) values ('Early', 'Late', %L, %L)$$,
         (select a_id from t_ids), (select b_id from t_ids)),
  '23514', null, 'DAILY-022: a written row without a source day is refused'
);

-- ============================================
-- effective_zone
-- ============================================
select is(
  public.effective_zone('America/New_York', 330),
  'America/New_York',
  'DAILY-023: effective_zone returns a known IANA name, whatever the offset'
);
select is(
  public.effective_zone('Nowhere/Land', 330),
  '<+0530>-05:30',
  'DAILY-024: effective_zone writes +330 as a POSIX spec with the sign Postgres expects'
);
select ok(
  (timestamptz '2026-11-05 12:00:00+00' at time zone public.effective_zone('Nowhere/Land', 330))
    = (timestamptz '2026-11-05 12:00:00+00' at time zone interval '05:30'),
  'DAILY-025: a positive non-hour offset equals the interval'
);
select ok(
  (timestamptz '2026-11-05 12:00:00+00' at time zone public.effective_zone('Nowhere/Land', -210))
    = (timestamptz '2026-11-05 12:00:00+00' at time zone interval '-03:30'),
  'DAILY-026: a negative non-hour offset equals the interval'
);
select is(
  public.effective_zone(null, null) || '/' || public.effective_zone('', null),
  'UTC/UTC',
  'DAILY-027: no name and no offset gives UTC'
);
select is(
  public.effective_zone('Nowhere/Land', 5000),
  '<+1400>-14:00',
  'DAILY-028: the offset is clamped to 840 minutes'
);
select is(
  public.effective_zone(null, 60),
  '<+0100>-01:00',
  'DAILY-029: a missing name falls back to the offset'
);

-- ============================================
-- Unauthenticated callers
-- ============================================
select tests.clear_jwt();
select throws_ok(
  $$select public.get_daily_day('UTC', 0, now())$$,
  'Authentication required',
  'DAILY-030: get_daily_day rejects a NULL auth.uid()'
);
select throws_ok(
  $$select public.submit_daily_pick(gen_random_uuid(), 'this', now(), 'UTC', 0)$$,
  'Authentication required',
  'DAILY-031: submit_daily_pick rejects a NULL auth.uid()'
);

-- ============================================
-- Unlinked caller
-- ============================================
select tests.authenticate_as((select u_id from t_ids));
select set_config('tests.u_res', public.get_daily_day('UTC', 0, now())::text, false);
reset role;

select is(
  current_setting('tests.u_res')::jsonb,
  '{"status": "unlinked"}'::jsonb,
  'DAILY-032: an unlinked caller gets {status: unlinked}'
);
select is(
  (select count(*)::int from public.couple_days),
  0,
  'DAILY-033: and no couple_days row is created'
);

-- ============================================
-- Both partners fetch the same day
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.a_res', public.get_daily_day('UTC', 0, now())::text, false);
reset role;
select tests.authenticate_as((select b_id from t_ids));
select set_config('tests.b_res', public.get_daily_day('UTC', 0, now())::text, false);
reset role;

select is(
  current_setting('tests.a_res')::jsonb ->> 'status' || '/' || (current_setting('tests.b_res')::jsonb ->> 'status'),
  'ok/ok',
  'DAILY-034: both partners get {status: ok}'
);
select is(
  current_setting('tests.a_res')::jsonb #>> '{snapshot,day_id}',
  current_setting('tests.b_res')::jsonb #>> '{snapshot,day_id}',
  'DAILY-035: both fetch the same day_id'
);
select is(
  current_setting('tests.a_res')::jsonb #> '{snapshot,question}',
  current_setting('tests.b_res')::jsonb #> '{snapshot,question}',
  'DAILY-036: and the same question'
);
select is(
  coalesce((current_setting('tests.a_res')::jsonb #> '{snapshot,question}')::text, 'missing'),
  (select jsonb_build_object('this', q.this_text, 'that', q.that_text)::text
   from public.couple_days cd
   join public.daily_questions q on q.id = cd.question_id
   where cd.id = (current_setting('tests.a_res')::jsonb #>> '{snapshot,day_id}')::uuid),
  'DAILY-097: the question is the drawn row''s this and that text, in that order'
);
select is(
  (select count(*)::int from public.couple_days),
  1,
  'DAILY-037: one couple_days row exists for the pair'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(current_setting('tests.a_res')::jsonb -> 'snapshot') k),
  array['day', 'day_id', 'my_choice', 'my_picked_at', 'partner_choice', 'question', 'same', 'state', 'write'],
  'DAILY-038: the snapshot carries exactly the AD-16 keys this story ships'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(current_setting('tests.a_res')::jsonb #> '{snapshot,write}') k),
  array['done', 'mine'],
  'DAILY-039: write carries exactly mine and done'
);
select is(
  current_setting('tests.a_res')::jsonb #>> '{snapshot,write,done}',
  'false',
  'DAILY-098: write.done is false on a day no question was written from'
);
select is(
  current_setting('tests.a_res')::jsonb #>> '{snapshot,state}',
  'none',
  'DAILY-040: before any pick the state is none'
);

select set_config('tests.day', current_setting('tests.a_res')::jsonb #>> '{snapshot,day_id}', false);

-- ============================================
-- A picks; B, who has not picked, sees no trace of the choice
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.a_pick', public.submit_daily_pick(current_setting('tests.day')::uuid, 'this', now(), 'UTC', 0)::text, false);
reset role;

select is(
  current_setting('tests.a_pick')::jsonb ->> 'state' || '/' || (current_setting('tests.a_pick')::jsonb ->> 'my_choice'),
  'me/this',
  'DAILY-041: A''s own snapshot shows state me and A''s choice'
);

-- Everything B can call before B's own pick.
select tests.authenticate_as((select b_id from t_ids));
select set_config('tests.b_before', public.get_daily_day('UTC', 0, now())::text, false);
select throws_ok(
  $$select * from public.daily_picks$$,
  '42501', null, 'DAILY-042: B cannot select daily_picks directly before picking'
);
select throws_ok(
  $$select * from public.visible_daily_picks(gen_random_uuid(), now())$$,
  '42501', null, 'DAILY-043: B cannot call the gate directly'
);
select throws_ok(
  $$select * from public.daily_questions$$,
  '42501', null, 'DAILY-044: B cannot select daily_questions directly'
);
select throws_ok(
  $$select * from public.couple_days$$,
  '42501', null, 'DAILY-045: B cannot select couple_days directly'
);
reset role;

select is(
  current_setting('tests.b_before')::jsonb #>> '{snapshot,state}',
  'partner',
  'DAILY-046: B sees that the partner picked'
);
select is(
  (current_setting('tests.b_before')::jsonb #> '{snapshot,my_choice}')::text || '/'
    || (current_setting('tests.b_before')::jsonb #> '{snapshot,partner_choice}')::text || '/'
    || (current_setting('tests.b_before')::jsonb #> '{snapshot,same}')::text,
  'null/null/null',
  'DAILY-047: and my_choice, partner_choice and same are all null'
);
select ok(
  not jsonb_path_exists(
    current_setting('tests.b_before')::jsonb,
    '$.** ? (@ == "this" || @ == "that")'
  ),
  'DAILY-048: no "this" or "that" value appears anywhere in B''s answer'
);
select is(
  (select count(*)::int from public.visible_daily_picks((select b_id from t_ids), now())),
  0,
  'DAILY-049: the gate returns B nothing before B''s own pick'
);
select is(
  (select count(*)::int from public.visible_daily_picks((select a_id from t_ids), now())),
  1,
  'DAILY-050: and returns A only A''s own pick'
);
select is(
  public.daily_day_snapshot(current_setting('tests.day')::uuid, (select o_id from t_ids), now()),
  null,
  'DAILY-051: the snapshot is null for a viewer outside the pair'
);

-- ============================================
-- Foreign day, bad input: nothing is written
-- ============================================
select tests.authenticate_as((select o_id from t_ids));
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'this', now(), 'UTC', 0)$$, current_setting('tests.day')),
  'P0002', 'Day not found',
  'DAILY-052: a partnered outsider cannot pick on another couple''s day'
);
reset role;
select tests.authenticate_as((select u_id from t_ids));
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'this', now(), 'UTC', 0)$$, current_setting('tests.day')),
  'P0002', 'Day not found',
  'DAILY-053: an unlinked outsider cannot pick on another couple''s day'
);
reset role;

select tests.authenticate_as((select b_id from t_ids));
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'maybe', now(), 'UTC', 0)$$, current_setting('tests.day')),
  '22023', 'Invalid choice',
  'DAILY-054: a choice other than this or that is refused'
);
select throws_ok(
  format($$select public.submit_daily_pick(%L, null, now(), 'UTC', 0)$$, current_setting('tests.day')),
  '22023', 'Invalid choice',
  'DAILY-055: a null choice is refused'
);
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'that', null, 'UTC', 0)$$, current_setting('tests.day')),
  '22023', 'Invalid pick time',
  'DAILY-056: a null picked_at is refused'
);
reset role;

select is(
  (select count(*)::int from public.daily_picks),
  1,
  'DAILY-057: none of those wrote a pick'
);

-- ============================================
-- Reveal: B picks
-- ============================================
select tests.authenticate_as((select b_id from t_ids));
select set_config('tests.b_pick', public.submit_daily_pick(current_setting('tests.day')::uuid, 'that', now(), 'UTC', 0)::text, false);
reset role;

select is(
  current_setting('tests.b_pick')::jsonb ->> 'state' || '/' || (current_setting('tests.b_pick')::jsonb ->> 'my_choice')
    || '/' || (current_setting('tests.b_pick')::jsonb ->> 'partner_choice')
    || '/' || (current_setting('tests.b_pick')::jsonb ->> 'same'),
  'both/that/this/false',
  'DAILY-058: B''s pick reveals A''s choice and marks Different'
);
select is(
  (select is_second from public.daily_picks
   where day_id = current_setting('tests.day')::uuid and user_id = (select b_id from t_ids)),
  true,
  'DAILY-059: B''s row is the second pick'
);
select is(
  (select is_second from public.daily_picks
   where day_id = current_setting('tests.day')::uuid and user_id = (select a_id from t_ids)),
  false,
  'DAILY-060: A''s row is the first pick'
);

select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.a_after', public.get_daily_day('UTC', 0, now())::text, false);
reset role;

select is(
  current_setting('tests.a_after')::jsonb #>> '{snapshot,state}' || '/'
    || (current_setting('tests.a_after')::jsonb #>> '{snapshot,partner_choice}') || '/'
    || (current_setting('tests.a_after')::jsonb #>> '{snapshot,same}'),
  'both/that/false',
  'DAILY-061: A then sees B''s choice'
);
select is(
  (select array_agg(vp.user_id order by vp.user_id) from public.visible_daily_picks((select a_id from t_ids), now()) vp),
  array[(select a_id from t_ids), (select b_id from t_ids)],
  'DAILY-062: the gate returns both picks to each partner once both have picked'
);

-- ============================================
-- Repeat submit changes nothing
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.a_repeat', public.submit_daily_pick(current_setting('tests.day')::uuid, 'that', now() + interval '1 minute', 'Asia/Tokyo', 540)::text, false);
reset role;

select is(
  current_setting('tests.a_repeat')::jsonb ->> 'my_choice',
  'this',
  'DAILY-063: a repeat submit returns the stored choice'
);
select is(
  current_setting('tests.a_repeat')::jsonb ->> 'my_picked_at',
  current_setting('tests.a_pick')::jsonb ->> 'my_picked_at',
  'DAILY-064: and the stored picked_at'
);
select is(
  (select count(*)::int from public.daily_picks
   where day_id = current_setting('tests.day')::uuid and user_id = (select a_id from t_ids)),
  1,
  'DAILY-065: and there is still one row'
);
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone || '/' || is_second || '/' || choice
   from public.daily_picks
   where day_id = current_setting('tests.day')::uuid and user_id = (select a_id from t_ids)),
  'UTC/0/UTC/false/this',
  'DAILY-066: and the stored zone, is_second and choice are untouched'
);

-- ============================================
-- The gate follows the viewer's current pair
-- ============================================
update public.users set partner_id = null where id = (select a_id from t_ids);
update public.users set partner_id = (select u_id from t_ids) where id = (select b_id from t_ids);

select is(
  (select count(*)::int from public.visible_daily_picks((select b_id from t_ids), now()) vp
   where vp.day_id = current_setting('tests.day')::uuid and vp.user_id = (select a_id from t_ids)),
  0,
  'DAILY-067: after B relinks, the gate no longer releases A''s pick on the old day'
);

select tests.authenticate_as((select b_id from t_ids));
select throws_ok(
  format($$select public.submit_daily_pick(%L, 'this', now(), 'UTC', 0)$$, current_setting('tests.day')),
  'P0002', 'Day not found',
  'DAILY-068: and B cannot submit on the old pair''s day'
);
reset role;

update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);

select is(
  (select vp.choice from public.visible_daily_picks((select b_id from t_ids), now()) vp
   where vp.day_id = current_setting('tests.day')::uuid and vp.user_id = (select a_id from t_ids)),
  'this',
  'DAILY-100: relinking the same partner releases A''s pick on the old day again (AD-1)'
);

-- ============================================
-- Same: both choose alike on a second day
-- ============================================
select set_config('tests.day2',
  (public.assign_couple_day((select a_id from t_ids), (select b_id from t_ids), (now() at time zone 'UTC')::date + 1)).id::text, false);

-- The day is tomorrow's UTC date, which submit_daily_pick's date check refuses
-- for a pick made now, so the picks go through record_daily_pick with instants
-- on that date in each partner's zone (A: +05:30, B: no zone, so UTC).
select public.record_daily_pick(
  (select a_id from t_ids), current_setting('tests.day2')::uuid, 'this',
  ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC' + interval '12 hours',
  'Nowhere/Land', 330,
  ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC' + interval '12 hours');

-- B has picked day 1, which must not release A's pick on day 2.
select is(
  (select count(*)::int from public.visible_daily_picks((select b_id from t_ids), now()) vp
   where vp.day_id = current_setting('tests.day2')::uuid and vp.user_id = (select a_id from t_ids)),
  0,
  'DAILY-069: B having picked day 1 does not release A''s pick on day 2'
);
select is(
  public.daily_day_snapshot(current_setting('tests.day2')::uuid, (select b_id from t_ids), now()) #>> '{partner_choice}',
  null,
  'DAILY-070: and B''s day 2 snapshot has a null partner_choice'
);

select set_config('tests.b_same', public.record_daily_pick(
  (select b_id from t_ids), current_setting('tests.day2')::uuid, 'this',
  ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC' + interval '13 hours',
  null, null,
  ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC' + interval '13 hours')::text, false);

select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone from public.daily_picks
   where day_id = current_setting('tests.day2')::uuid and user_id = (select a_id from t_ids)),
  'Nowhere/Land/330/<+0530>-05:30',
  'DAILY-071: A''s row stores the zone sent and its resolved effective_zone'
);
select is(
  (select time_zone || '/' || utc_offset_minutes || '/' || effective_zone from public.daily_picks
   where day_id = current_setting('tests.day2')::uuid and user_id = (select b_id from t_ids)),
  '/0/UTC',
  'DAILY-072: B''s null zone and offset are stored as an empty name, 0 and UTC'
);

select is(
  current_setting('tests.b_same')::jsonb ->> 'same',
  'true',
  'DAILY-073: matching choices mark Same'
);

-- ============================================
-- Direct writes and reads are denied
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select throws_ok(
  format($$insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
           values (%L, %L, 'this', now(), 'UTC', 0, 'UTC', false)$$, current_setting('tests.day2'), (select a_id from t_ids)),
  '42501', null, 'DAILY-074: A cannot insert a pick directly'
);
select throws_ok(
  $$select * from public.daily_picks$$,
  '42501', null, 'DAILY-075: A cannot select daily_picks directly after the reveal either'
);
select throws_ok(
  $$select choice from public.daily_picks$$,
  '42501', null, 'DAILY-076: nor select the choice column'
);
reset role;

-- ============================================
-- assign_couple_day: idempotent, alternating writer
-- ============================================
select is(
  (public.assign_couple_day((select a_id from t_ids), (select b_id from t_ids), (now() at time zone 'UTC')::date + 1)).id::text,
  current_setting('tests.day2'),
  'DAILY-077: a repeat assign returns the same row'
);

select public.assign_couple_day((select a_id from t_ids), (select b_id from t_ids), d::date)
from generate_series(date '2030-01-01', date '2030-01-04', interval '1 day') d
order by d;

select is(
  (select array_agg(cd.writer = (select a_id from t_ids) order by cd.day)
   from public.couple_days cd
   where cd.day between date '2030-01-01' and date '2030-01-04'),
  array[true, false, true, false],
  'DAILY-078: the writer alternates by date, user_a first on an even day count'
);
select is(
  (select array_agg((public.daily_day_snapshot(cd.id, (select a_id from t_ids), now()) #>> '{write,mine}')
                    || '/' || (public.daily_day_snapshot(cd.id, (select b_id from t_ids), now()) #>> '{write,mine}')
                    order by cd.day)
   from public.couple_days cd
   where cd.day between date '2030-01-01' and date '2030-01-04'),
  array['true/false', 'false/true', 'true/false', 'false/true'],
  'DAILY-079: write.mine follows the writer for each partner'
);

-- ============================================
-- Cascades
-- ============================================
insert into public.daily_questions (this_text, that_text, user_a, user_b, target_day, source_day_id)
select 'Early', 'Late', (select a_id from t_ids), (select b_id from t_ids), date '2030-02-01',
       current_setting('tests.day2')::uuid;

select is(
  public.daily_day_snapshot(current_setting('tests.day2')::uuid, (select a_id from t_ids), now()) #>> '{write,done}',
  'true',
  'DAILY-080: write.done is true once a question has this day as its source'
);

select set_config('role', 'service_role', true);
delete from public.couple_days where id = current_setting('tests.day2')::uuid;
reset role;

select is(
  (select count(*)::int from public.daily_picks where day_id = current_setting('tests.day2')::uuid),
  0,
  'DAILY-081: a service_role delete of a day cascades its picks'
);
select is(
  (select count(*)::int from public.daily_questions where source_day_id = current_setting('tests.day2')::uuid),
  0,
  'DAILY-082: and the question written from it'
);

-- ============================================
-- get_daily_day dates the fetch by the zone it sends
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select set_config('tests.z1', public.get_daily_day('Pacific/Kiritimati', 840, now())::text, false);
select set_config('tests.z2', public.get_daily_day('Nowhere/Land', -720, now())::text, false);
reset role;

select is(
  current_setting('tests.z1')::jsonb #>> '{snapshot,day}',
  ((now() at time zone 'Pacific/Kiritimati')::date)::text,
  'DAILY-083: a named zone dates the fetch'
);
select is(
  current_setting('tests.z2')::jsonb #>> '{snapshot,day}',
  ((now() at time zone interval '-12:00')::date)::text,
  'DAILY-084: an unknown name dates the fetch by the offset'
);

-- ============================================
-- The draw: every question once per cycle, then the next cycle
-- ============================================
-- Another pair holds a day, with a question its couple wrote, while the pool
-- has its three coach rows. That written row must stay out of a/b's draws.
select is(
  (public.assign_couple_day(least((select o_id from t_ids), (select d_id from t_ids)),
                            greatest((select o_id from t_ids), (select d_id from t_ids)),
                            date '2031-01-01')).cycle,
  1,
  'DAILY-085: another pair starts in cycle 1'
);
insert into public.daily_questions (this_text, that_text, user_a, user_b, target_day, source_day_id)
select 'Hers', 'His', least(o_id, d_id), greatest(o_id, d_id), date '2031-02-01', cd.id
from t_ids, public.couple_days cd
where cd.user_a = least(o_id, d_id) and cd.user_b = greatest(o_id, d_id) and cd.day = date '2031-01-01';

-- Only a/b's own day may count as written: o/d's written row is not theirs.
select is(
  public.daily_day_snapshot(current_setting('tests.day')::uuid, (select a_id from t_ids), now()) #>> '{write,done}',
  'false',
  'DAILY-099: another couple''s written question does not mark a/b''s day done'
);

delete from public.couple_days
where user_a = (select a_id from t_ids) and user_b = (select b_id from t_ids);

do $$
declare
  v_a uuid := (select a_id from t_ids);
  v_b uuid := (select b_id from t_ids);
  d date;
begin
  for d in select g::date from generate_series(date '2031-01-01', date '2031-01-06', interval '1 day') g order by 1 loop
    perform public.assign_couple_day(v_a, v_b, d);
  end loop;
end $$;

select is(
  (select count(distinct question_id)::int || '/' || max(cycle) || '/' || min(cycle)
   from public.couple_days
   where user_a = (select a_id from t_ids) and user_b = (select b_id from t_ids)
     and day between date '2031-01-01' and date '2031-01-03'),
  '3/1/1',
  'DAILY-086: three days draw the three questions in cycle 1'
);
select is(
  (select count(distinct question_id)::int || '/' || max(cycle) || '/' || min(cycle)
   from public.couple_days
   where user_a = (select a_id from t_ids) and user_b = (select b_id from t_ids)
     and day between date '2031-01-04' and date '2031-01-06'),
  '3/2/2',
  'DAILY-087: the next three draw all three again in cycle 2'
);

select is(
  (select cycle from public.couple_days
   where user_a = (select a_id from t_ids) and user_b = (select b_id from t_ids) and day = date '2031-01-04'),
  2,
  'DAILY-088: the fourth draw opens cycle 2, with another couple''s written question present'
);
select is(
  (select count(*)::int from public.couple_days cd
   join public.daily_questions q on q.id = cd.question_id
   where cd.user_a = (select a_id from t_ids) and cd.user_b = (select b_id from t_ids)
     and q.user_a is not null),
  0,
  'DAILY-089: none of a/b''s draws is a written question'
);

-- ============================================
-- couple_days.question_id is NO ACTION
-- ============================================
insert into public.couple_days (id, user_a, user_b, day, question_id, cycle, writer)
select gen_random_uuid(), a_id, b_id, date '2033-01-01', (select id from public.daily_questions where user_a is null limit 1), 1, a_id
from t_ids;
select set_config('tests.s', (select id::text from public.couple_days where day = date '2033-01-01'), false);
insert into public.daily_questions (this_text, that_text, user_a, user_b, target_day, source_day_id)
select 'Sea', 'Sky', a_id, b_id, date '2033-01-02', current_setting('tests.s')::uuid from t_ids;
select set_config('tests.q', (select id::text from public.daily_questions where this_text = 'Sea'), false);
insert into public.couple_days (user_a, user_b, day, question_id, cycle, writer)
select a_id, b_id, date '2033-01-02', current_setting('tests.q')::uuid, 1, b_id from t_ids;

select set_config('role', 'service_role', true);
select throws_ok(
  format($$delete from public.couple_days where id = %L$$, current_setting('tests.s')),
  '23503', null,
  'DAILY-090: deleting a source day alone fails while a later day asks its question'
);
select lives_ok(
  format($$delete from public.couple_days where user_a = %L and user_b = %L and day in (date '2033-01-01', date '2033-01-02')$$,
         (select a_id from t_ids), (select b_id from t_ids)),
  'DAILY-091: deleting both of the pair''s days in one statement succeeds'
);
reset role;
select is(
  (select count(*)::int from public.daily_questions where id = current_setting('tests.q')::uuid),
  0,
  'DAILY-092: and the written question goes with them'
);

-- ============================================
-- Empty pool
-- ============================================
delete from public.couple_days;
delete from public.daily_questions where user_a is null;

select throws_ok(
  format($$select public.assign_couple_day(%L, %L, date '2032-01-01')$$, (select a_id from t_ids), (select b_id from t_ids)),
  'P0002', 'No daily question available',
  'DAILY-093: an empty pool raises P0002'
);
select is(
  (select count(*)::int from public.couple_days),
  0,
  'DAILY-094: and creates no day'
);

select tests.authenticate_as((select a_id from t_ids));
select throws_ok(
  $$select public.get_daily_day('UTC', 0, now())$$,
  'P0002', 'No daily question available',
  'DAILY-095: get_daily_day surfaces the empty pool as P0002'
);
reset role;

select throws_ok(
  format($$select public.assign_couple_day(%L, %L, date '2032-01-01')$$, (select b_id from t_ids), (select a_id from t_ids)),
  '22023', 'Invalid couple day',
  'DAILY-096: assign_couple_day refuses an unordered pair'
);

select * from finish();
rollback;
