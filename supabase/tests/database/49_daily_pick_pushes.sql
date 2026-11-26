-- ============================================
-- pgTAP: a pick pushes the partner, and both answered (20261126010000)
--
-- Story 8.6 of epic-daily-pushes-and-nudge (architecture-daily-question: AD-10;
-- requirements R1, R4). Pinned here:
--   * daily_picks carries exactly the two notify_push triggers, AFTER INSERT FOR
--     EACH ROW, enabled, each with its WHEN and its kind.
--   * a first pick queues one {kind: daily_partner_picked, id} call and a second
--     pick one {kind: daily_both_answered, id} call, each body holding exactly the
--     keys kind and id (no choice), to the sender URL with the shared secret.
--   * a repeat record_daily_pick for a stored pick inserts nothing and queues
--     nothing more.
--   * with no push_sender_settings row a pick lands and nothing is queued.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(14);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Pick ' || left(test_email, 8))
    on conflict (id) do nothing;
  return user_id;
end; $$;

create temporary table t_users (label text primary key, id uuid not null);
create or replace function pg_temp.u(p text) returns uuid language sql stable as $$ select id from t_users where label = p $$;

select tests.create_test_user('pickpush49-a@example.com') as id \gset a_
select tests.create_test_user('pickpush49-b@example.com') as id \gset b_
insert into t_users values ('a', :'a_id'), ('b', :'b_id');
update public.users set partner_id = pg_temp.u('b') where id = pg_temp.u('a');
update public.users set partner_id = pg_temp.u('a') where id = pg_temp.u('b');

-- The pair's day for today, and a pick by the client path (record_daily_pick).
create or replace function pg_temp.day() returns uuid language sql as $$
  select (public.assign_couple_day(least(pg_temp.u('a'), pg_temp.u('b')), greatest(pg_temp.u('a'), pg_temp.u('b')),
          (now() at time zone 'UTC')::date)).id
$$;
create or replace function pg_temp.pick(p_who text) returns void language sql as $$
  select public.record_daily_pick(pg_temp.u(p_who), pg_temp.day(), 'this', now(), 'UTC', 0, now())
$$;

-- What a pick row was queued as, as 'kind' ('' for none), and its body's keys.
create or replace function pg_temp.queued(p_who text) returns text language sql as $$
  select coalesce(string_agg(convert_from(q.body, 'UTF8')::jsonb->>'kind', ', '), '')
    from public.daily_picks k
    join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = k.id::text
   where k.day_id = pg_temp.day() and k.user_id = pg_temp.u(p_who)
$$;

delete from public.push_sender_settings;
insert into public.push_sender_settings (sender_url, sender_secret)
values ('http://sender.test/send-push', 'daily-picks-test-secret');

-- ============================================
-- Structure
-- ============================================
select is(
  (select string_agg(t.tgname || ' ' || p.proname || ' ' || t.tgenabled::text || ' ' || t.tgtype::text, ', ' order by t.tgname)
     from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.daily_picks'::regclass and not t.tgisinternal),
  'daily_picks_push_both_answered_after_insert notify_push O 5, daily_picks_push_partner_picked_after_insert notify_push O 5',
  'DAILY-PICK-001: daily_picks carries exactly the two notify_push triggers, AFTER INSERT FOR EACH ROW, enabled'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'WHEN \(\(NOT new\.is_second\)\) EXECUTE FUNCTION notify_push\(''daily_partner_picked''\)'
     from pg_trigger t where t.tgname = 'daily_picks_push_partner_picked_after_insert'),
  'DAILY-PICK-002: the daily_partner_picked trigger fires only for a first pick'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'WHEN \(new\.is_second\) EXECUTE FUNCTION notify_push\(''daily_both_answered''\)'
     from pg_trigger t where t.tgname = 'daily_picks_push_both_answered_after_insert'),
  'DAILY-PICK-003: the daily_both_answered trigger fires only for a second pick'
);

-- ============================================
-- A first pick, a second pick and a retry
-- ============================================
select pg_temp.pick('a');
select is(pg_temp.queued('a'), 'daily_partner_picked', 'DAILY-PICK-004: a first pick queued one daily_partner_picked call');

select pg_temp.pick('b');
select is(pg_temp.queued('b'), 'daily_both_answered', 'DAILY-PICK-005: a second pick queued one daily_both_answered call');
select is(pg_temp.queued('a'), 'daily_partner_picked', 'DAILY-PICK-006: and the first pick queued nothing more');

select is(
  (select string_agg(distinct (select string_agg(k, ',' order by k) from jsonb_object_keys(convert_from(q.body, 'UTF8')::jsonb) k), ';')
     from public.daily_picks p
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = p.id::text
    where p.day_id = pg_temp.day()),
  'id,kind',
  'DAILY-PICK-007: each body holds exactly the keys kind and id, so no choice is posted'
);
select results_eq(
  $$select distinct q.headers->>'x-push-secret', q.url
      from net.http_request_queue q join public.daily_picks p on convert_from(q.body, 'UTF8')::jsonb->>'id' = p.id::text
     where p.day_id = pg_temp.day()$$,
  $$values ('daily-picks-test-secret'::text, 'http://sender.test/send-push'::text)$$,
  'DAILY-PICK-008: the calls go to the sender URL with the shared secret'
);

create temporary table t_snap as
select (select count(*)::int from public.daily_picks where day_id = pg_temp.day()) as picks,
       (select count(*)::int from net.http_request_queue q join public.daily_picks p
          on convert_from(q.body, 'UTF8')::jsonb->>'id' = p.id::text where p.day_id = pg_temp.day()) as calls;
select pg_temp.pick('a');
select pg_temp.pick('b');
select is(
  (select count(*)::int from public.daily_picks where day_id = pg_temp.day()),
  (select picks from t_snap),
  'DAILY-PICK-009: a repeat pick for a stored pick inserts no row'
);
select is(
  (select count(*)::int from net.http_request_queue q join public.daily_picks p
     on convert_from(q.body, 'UTF8')::jsonb->>'id' = p.id::text where p.day_id = pg_temp.day()),
  (select calls from t_snap),
  'DAILY-PICK-010: and queues no further call'
);

-- ============================================
-- No settings row: the pick lands, nothing is queued
-- ============================================
delete from public.push_sender_settings;
select tests.create_test_user('pickpush49-c@example.com') as id \gset c_
select tests.create_test_user('pickpush49-d@example.com') as id \gset d_
insert into t_users values ('c', :'c_id'), ('d', :'d_id');
update public.users set partner_id = pg_temp.u('d') where id = pg_temp.u('c');
update public.users set partner_id = pg_temp.u('c') where id = pg_temp.u('d');
create or replace function pg_temp.day2() returns uuid language sql as $$
  select (public.assign_couple_day(least(pg_temp.u('c'), pg_temp.u('d')), greatest(pg_temp.u('c'), pg_temp.u('d')),
          (now() at time zone 'UTC')::date)).id
$$;
select public.record_daily_pick(pg_temp.u('c'), pg_temp.day2(), 'this', now(), 'UTC', 0, now());
select public.record_daily_pick(pg_temp.u('d'), pg_temp.day2(), 'that', now(), 'UTC', 0, now());
select is(
  (select count(*)::int from public.daily_picks where day_id = pg_temp.day2()),
  2,
  'DAILY-PICK-011: with no settings row both picks land'
);
select is(
  (select count(*)::int from net.http_request_queue q join public.daily_picks p
     on convert_from(q.body, 'UTF8')::jsonb->>'id' = p.id::text where p.day_id = pg_temp.day2()),
  0,
  'DAILY-PICK-012: and nothing is queued'
);

-- ============================================
-- Comments name the new triggers
-- ============================================
select ok(
  obj_description('public.daily_picks'::regclass, 'pg_class') like '%daily_partner_picked%'
    and obj_description('public.daily_picks'::regclass, 'pg_class') like '%daily_both_answered%',
  'DAILY-PICK-013: the daily_picks comment names both kinds'
);
select ok(
  obj_description('public.notify_push()'::regprocedure, 'pg_proc') like '%daily_picks%'
    and obj_description('public.push_sender_settings'::regclass, 'pg_class') like '%daily_picks%',
  'DAILY-PICK-014: the notify_push and push_sender_settings comments name daily_picks'
);

select * from finish();
rollback;
