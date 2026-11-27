-- ============================================
-- pgTAP: the 8 PM reminder on each person's clock (20261126000000, narrowed by
-- 20261127010000)
--
-- Story 8.5 of epic-daily-pushes-and-nudge (architecture-daily-question:
-- AD-8, AD-9, AD-10; requirements R3, R5), narrowed by story 11.2 of
-- epic-simpler-daily-pushes-and-nudge. Pinned here:
--   * enqueue_daily_reminders(at): two clocks, the window edges (08:00 queues
--     nothing and assigns no couple day; 19:59:59, 20:00:00, 20:29:59, 20:30:00),
--     a recipient who has picked (whether or not the partner has), neither or
--     only the partner having picked at 8 PM, a nudge about the day (which skips
--     nothing), the held-nudge release still running at 08:00, the accounts that
--     are not eligible (no device, no zone, unlinked, linked one way), a repeat
--     at the same instant, and one person's failure leaving the other's row.
--   * the one AFTER INSERT trigger on daily_reminders (no WHEN) and the call it
--     queues, and daily_reminders_kind_check refusing morning and evening_partner.
--   * grants (service_role only, no PUBLIC), security definer, empty search_path.
--   * pg_cron installed and the two named jobs, still one row per name after
--     scheduling them again.
--
-- The function sees every account in the database, so each assertion is scoped to
-- this file's own users (never the return count). Helpers are declared inline:
-- 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(63);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Rem ' || left(test_email, 8))
    on conflict (id) do nothing;
  return user_id;
end; $$;

create temporary table t_users (label text primary key, id uuid not null);
create or replace function pg_temp.u(p text) returns uuid language sql stable as $$ select id from t_users where label = p $$;

-- A user with, optionally, a push device and a stored zone.
create or replace function pg_temp.mk(p_label text, p_zone text, p_device boolean default true)
returns void language plpgsql as $$
declare v_id uuid := tests.create_test_user('rem48-' || p_label || '@example.com');
begin
  insert into t_users values (p_label, v_id);
  if p_zone is not null then
    insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)
    values (v_id, p_zone, 0, p_zone, timestamptz '2030-06-01 00:00:00+00');
  end if;
  if p_device then
    insert into public.push_devices (user_id, token, environment) values (v_id, 'pgtap48-' || p_label, 'sandbox');
  end if;
end; $$;

create or replace function pg_temp.link(p_a text, p_b text) returns void language sql as $$
  update public.users set partner_id = pg_temp.u(p_b) where id = pg_temp.u(p_a);
  update public.users set partner_id = pg_temp.u(p_a) where id = pg_temp.u(p_b);
$$;

-- The pair's day for a date, and a pick on it.
create or replace function pg_temp.day(p_a text, p_b text, p_day date) returns uuid language sql as $$
  select (public.assign_couple_day(least(pg_temp.u(p_a), pg_temp.u(p_b)), greatest(pg_temp.u(p_a), pg_temp.u(p_b)), p_day)).id
$$;
create or replace function pg_temp.pick(p_a text, p_b text, p_day date, p_who text) returns void language sql as $$
  insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
  values (pg_temp.day(p_a, p_b, p_day), pg_temp.u(p_who), 'this', timestamptz '2030-01-01 00:00:00+00', 'UTC', 0, 'UTC', false)
$$;

-- What a user was queued, as 'kind date, ...' ('' for none), and the calls queued about their rows.
create or replace function pg_temp.got(p text) returns text language sql as $$
  select coalesce(string_agg(r.kind || ' ' || r.local_date, ', ' order by r.local_date, r.slot), '')
    from public.daily_reminders r where r.user_id = pg_temp.u(p)
$$;
create or replace function pg_temp.queued(p text) returns text language sql as $$
  select coalesce(string_agg(convert_from(q.body, 'UTF8')::jsonb->>'kind', ', ' order by r.local_date, r.slot), '')
    from public.daily_reminders r
    join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = r.id::text
   where r.user_id = pg_temp.u(p)
$$;

delete from public.push_sender_settings;
insert into public.push_sender_settings (sender_url, sender_secret)
values ('http://sender.test/send-push', 'daily-reminders-test-secret');

-- ============================================
-- Structure, grants, triggers
-- ============================================
select has_function('public', 'enqueue_daily_reminders', array['timestamp with time zone'],
  'DAILY-REM-001: enqueue_daily_reminders(at) exists');
select is(
  (select count(*)::int from pg_proc p
    where p.oid = 'public.enqueue_daily_reminders(timestamptz)'::regprocedure
      and p.prosecdef and p.provolatile = 'v' and p.proconfig @> array['search_path=""']),
  1,
  'DAILY-REM-002: it is security definer, volatile and has an empty search_path'
);
select is(
  (select count(*)::int
     from unnest(array['anon', 'authenticated']) as r(rolename)
    where has_function_privilege(r.rolename, 'public.enqueue_daily_reminders(timestamptz)', 'EXECUTE')),
  0,
  'DAILY-REM-003: it is executable by neither anon nor authenticated'
);
select is(
  (select count(*)::int
     from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.enqueue_daily_reminders(timestamptz)'::regprocedure and acl.grantee = 0),
  0,
  'DAILY-REM-004: it is not granted to PUBLIC'
);
select ok(
  has_function_privilege('service_role', 'public.enqueue_daily_reminders(timestamptz)', 'EXECUTE'),
  'DAILY-REM-005: service_role has EXECUTE'
);
select is(
  (select count(*)::int from pg_proc p where p.oid = 'public.enqueue_daily_reminders(timestamptz)'::regprocedure
    and obj_description(p.oid, 'pg_proc') is not null),
  1,
  'DAILY-REM-006: the function carries a comment'
);

select is(
  (select string_agg(t.tgname || ' ' || p.proname || ' ' || t.tgenabled::text || ' ' || t.tgtype::text, ', ' order by t.tgname)
     from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.daily_reminders'::regclass and not t.tgisinternal),
  'daily_reminders_push_evening_after_insert notify_push O 5',
  'DAILY-REM-007: daily_reminders carries exactly the evening notify_push trigger, AFTER INSERT FOR EACH ROW, enabled'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'FOR EACH ROW EXECUTE FUNCTION notify_push\(''daily_reminder''\)$'
     from pg_trigger t where t.tgname = 'daily_reminders_push_evening_after_insert'),
  'DAILY-REM-008: the daily_reminder trigger has no WHEN and posts daily_reminder'
);
select ok(
  not exists (select 1 from pg_trigger t where t.tgname = 'daily_reminders_push_morning_after_insert'),
  'DAILY-REM-009: the daily_question trigger is gone'
);

-- ============================================
-- pg_cron and the two jobs
-- ============================================
select ok(
  exists (select 1 from pg_extension where extname = 'pg_cron'),
  'DAILY-REM-010: pg_cron is installed'
);
select results_eq(
  $$select jobname::text, schedule::text, command::text, active, database::text from cron.job
     where jobname in ('daily-reminders', 'daily-reminders-run-history') order by jobname$$,
  $$values
    ('daily-reminders'::text, '*/5 * * * *'::text, 'select public.enqueue_daily_reminders(now())'::text,
     true, current_database()::text collate "default"),
    ('daily-reminders-run-history'::text, '17 3 * * *'::text,
     'delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval ''7 days'''::text,
     true, current_database()::text collate "default")$$,
  'DAILY-REM-011: each job has one row, active, on this database, with its schedule and command'
);

select cron.schedule('daily-reminders', '*/5 * * * *', $job$select public.enqueue_daily_reminders(now())$job$);
select cron.schedule('daily-reminders-run-history', '17 3 * * *',
  $job$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days'$job$);
select results_eq(
  $$select jobname::text, count(*)::int from cron.job
     where jobname in ('daily-reminders', 'daily-reminders-run-history') group by jobname order by jobname$$,
  $$values ('daily-reminders'::text, 1), ('daily-reminders-run-history'::text, 1)$$,
  'DAILY-REM-012: scheduling both again leaves one row per name'
);

-- ============================================
-- Two clocks: New York and Tokyo
-- ============================================
select pg_temp.mk('na', 'America/New_York');
select pg_temp.mk('nb', 'Asia/Tokyo');
select pg_temp.link('na', 'nb');

-- 08:10 in New York (EDT) on 07-10; Tokyo is at 21:10. The 8 AM tick queues no
-- reminder and assigns no couple day for the pair.
select public.enqueue_daily_reminders(timestamptz '2030-07-10 12:10:00+00');
select is(pg_temp.got('na'), '', 'DAILY-REM-013: A, at their 08:10, gets no row');
select is(pg_temp.got('nb'), '', 'DAILY-REM-014: B, at 21:10 their time, gets none');
select is(pg_temp.queued('na') || '|' || pg_temp.queued('nb'), '|', 'DAILY-REM-015: and nothing is queued');

-- 08:10 in Tokyo on 07-11; New York is at 19:10 on 07-10.
select public.enqueue_daily_reminders(timestamptz '2030-07-10 23:10:00+00');
select is(pg_temp.got('na') || '|' || pg_temp.got('nb'), '|', 'DAILY-REM-016: B, at their 08:10, gets no row either, and A gets nothing');
select is(
  (select count(*)::int from public.couple_days d
    where d.user_a = least(pg_temp.u('na'), pg_temp.u('nb')) and d.user_b = greatest(pg_temp.u('na'), pg_temp.u('nb'))),
  0,
  'DAILY-REM-017: the two 8 AM ticks assigned no couple day to the pair'
);

-- 20:10 in New York on 07-10 (07-11 00:10 UTC); Tokyo is at 09:10 on 07-11.
select public.enqueue_daily_reminders(timestamptz '2030-07-11 00:10:00+00');
select is(pg_temp.got('na'), 'evening_self 2030-07-10',
  'DAILY-REM-047: A, at their 20:10, gets an evening_self row for their date');
select is(pg_temp.got('nb'), '', 'DAILY-REM-048: B, at 09:10 their time, gets none');
select is(pg_temp.queued('na'), 'daily_reminder', 'DAILY-REM-063: the evening_self row queued one daily_reminder call');

-- 20:10 in Tokyo on 07-11 (11:10 UTC); New York is at 07:10.
select public.enqueue_daily_reminders(timestamptz '2030-07-11 11:10:00+00');
select is(pg_temp.got('nb'), 'evening_self 2030-07-11',
  'DAILY-REM-049: B, at their 20:10, gets an evening_self row for B''s date');
select is(pg_temp.got('na'), 'evening_self 2030-07-10', 'DAILY-REM-050: A, at 07:10 their time, gets nothing more');
select is(
  (select count(*)::int from public.daily_reminders r
     join public.couple_days d on d.id = r.day_id
    where r.user_id in (pg_temp.u('na'), pg_temp.u('nb'))
      and d.user_a = least(pg_temp.u('na'), pg_temp.u('nb')) and d.user_b = greatest(pg_temp.u('na'), pg_temp.u('nb'))
      and d.day = r.local_date),
  2,
  'DAILY-REM-018: each row''s day_id is the pair''s couple day for the recipient''s own date'
);

-- ============================================
-- A zone Postgres lacks: effective_zone is a POSIX offset
-- ============================================
select pg_temp.mk('za', null);
select pg_temp.mk('zb', null);
select pg_temp.link('za', 'zb');
insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)
select id, 'Mars/Olympus', 345, public.effective_zone('Mars/Olympus', 345), timestamptz '2030-06-01 00:00:00+00'
  from t_users where label in ('za', 'zb');

-- +05:45 reads 20:10 at 14:25 UTC; -05:45 would read it at 01:55 UTC the next day.
select public.enqueue_daily_reminders(timestamptz '2030-08-13 01:55:00+00');
select is(pg_temp.got('za') || '|' || pg_temp.got('zb'), '|', 'DAILY-REM-051: where -05:45 would read 20:10, an unknown zone at +05:45 gets no row');
select public.enqueue_daily_reminders(timestamptz '2030-08-12 14:25:00+00');
select is(pg_temp.got('za') || '|' || pg_temp.got('zb'), 'evening_self 2030-08-12|evening_self 2030-08-12',
  'DAILY-REM-052: where +05:45 reads 20:10, an unknown zone at +05:45 gets an evening_self row for its own date');

-- ============================================
-- Window edges (both users on UTC)
-- ============================================
select pg_temp.mk('ea', 'UTC');
select pg_temp.mk('eb', 'UTC');
select pg_temp.link('ea', 'eb');

select public.enqueue_daily_reminders(timestamptz '2030-08-01 07:59:59+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-01 08:00:00+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-01 08:29:59+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-01 08:30:00+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-01 19:59:59+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-01 20:30:00+00');
select is(pg_temp.got('ea') || '|' || pg_temp.got('eb'), '|',
  'DAILY-REM-019: 08:00:00 and 08:29:59 queue nothing, nor do 07:59:59, 08:30:00, 19:59:59 and 20:30:00');
select is(
  (select count(*)::int from public.couple_days d
    where d.user_a = least(pg_temp.u('ea'), pg_temp.u('eb')) and d.user_b = greatest(pg_temp.u('ea'), pg_temp.u('eb'))),
  0,
  'DAILY-REM-053: and no couple day is assigned at any of those instants');

select public.enqueue_daily_reminders(timestamptz '2030-08-01 20:00:00+00');
select is(pg_temp.got('ea') || '|' || pg_temp.got('eb'), 'evening_self 2030-08-01|evening_self 2030-08-01',
  'DAILY-REM-020: 20:00:00 queues an evening_self row for both (nobody has picked)');

select public.enqueue_daily_reminders(timestamptz '2030-08-02 20:29:59+00');
select is(pg_temp.got('ea'), 'evening_self 2030-08-01, evening_self 2030-08-02', 'DAILY-REM-021: 20:29:59 (another date) queues an evening_self row');

select public.enqueue_daily_reminders(timestamptz '2030-08-03 19:59:59+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-03 20:30:00+00');
select is(pg_temp.got('ea'), 'evening_self 2030-08-01, evening_self 2030-08-02', 'DAILY-REM-022: 19:59:59 and 20:30:00 queue nothing');

select public.enqueue_daily_reminders(timestamptz '2030-08-03 20:00:00+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-04 20:29:59+00');
select is(pg_temp.got('ea'),
  'evening_self 2030-08-01, evening_self 2030-08-02, evening_self 2030-08-03, evening_self 2030-08-04',
  'DAILY-REM-023: 20:00:00 and 20:29:59 queue an evening_self row');
select is(pg_temp.queued('eb'), 'daily_reminder, daily_reminder, daily_reminder, daily_reminder',
  'DAILY-REM-024: each evening row queued one daily_reminder call');

-- ============================================
-- Repeat: the same instant again adds no row and no call
-- ============================================
create temporary table t_snap as
select pg_temp.got('ea') as g, pg_temp.queued('ea') as q, pg_temp.got('eb') as gb, pg_temp.queued('eb') as qb;

select public.enqueue_daily_reminders(timestamptz '2030-08-02 20:29:59+00');
select public.enqueue_daily_reminders(timestamptz '2030-08-04 20:29:59+00');
select is(pg_temp.got('ea') || '|' || pg_temp.got('eb'), (select g || '|' || gb from t_snap),
  'DAILY-REM-025: a repeat at the same instant adds no row');
select is(pg_temp.queued('ea') || '|' || pg_temp.queued('eb'), (select q || '|' || qb from t_snap),
  'DAILY-REM-026: and queues no further call');
select is(public.enqueue_daily_reminders(null), 0, 'DAILY-REM-027: a null instant inserts nothing');

-- ============================================
-- Picked: whether or not the partner has picked
-- ============================================
select pg_temp.mk('pa', 'UTC');
select pg_temp.mk('pb', 'UTC');
select pg_temp.link('pa', 'pb');
select pg_temp.pick('pa', 'pb', date '2030-08-05', 'pa');

select public.enqueue_daily_reminders(timestamptz '2030-08-05 08:10:00+00');
select is(pg_temp.got('pa') || '|' || pg_temp.got('pb'), '|',
  'DAILY-REM-028: at 08:10 nobody gets a row, the one who has not picked included');
select public.enqueue_daily_reminders(timestamptz '2030-08-05 20:10:00+00');
select is(pg_temp.got('pa') || '|' || pg_temp.got('pb'), '|evening_self 2030-08-05',
  'DAILY-REM-054: at 20:10 the one who picked gets no row, and the partner who has not does');

-- Only the partner has picked: the one who has not still gets evening_self
select pg_temp.mk('qa', 'UTC');
select pg_temp.mk('qb', 'UTC');
select pg_temp.link('qa', 'qb');
select pg_temp.pick('qa', 'qb', date '2030-08-06', 'qa');
select public.enqueue_daily_reminders(timestamptz '2030-08-06 20:10:00+00');
select is(pg_temp.got('qa'), '', 'DAILY-REM-029: at 8 PM the one who picked gets no row, though the partner has not');
select is(pg_temp.got('qb'), 'evening_self 2030-08-06', 'DAILY-REM-030: and the one who has not picked gets evening_self, the partner having picked');

-- Both picked, evening
select pg_temp.mk('ra', 'UTC');
select pg_temp.mk('rb', 'UTC');
select pg_temp.link('ra', 'rb');
select pg_temp.pick('ra', 'rb', date '2030-08-07', 'ra');
select pg_temp.pick('ra', 'rb', date '2030-08-07', 'rb');
select public.enqueue_daily_reminders(timestamptz '2030-08-07 20:10:00+00');
select is(pg_temp.got('ra') || '|' || pg_temp.got('rb'), '|', 'DAILY-REM-031: when both have picked, 8 PM queues nothing');

-- A nudge about the day (from either source) skips nothing
select pg_temp.mk('sa', 'UTC');
select pg_temp.mk('sb', 'UTC');
select pg_temp.link('sa', 'sb');
select pg_temp.pick('sa', 'sb', date '2030-08-08', 'sa');
insert into public.daily_nudges (from_user, to_user, day_id, source)
values (pg_temp.u('sa'), pg_temp.u('sb'), pg_temp.day('sa', 'sb', date '2030-08-08'), 'button');
select public.enqueue_daily_reminders(timestamptz '2030-08-08 20:10:00+00');
select is(pg_temp.got('sa'), '', 'DAILY-REM-032: a picker who nudged about the day gets no row');
select is(pg_temp.got('sb'), 'evening_self 2030-08-08', 'DAILY-REM-033: the partner still gets evening_self');

-- A nudge about another day, or the partner's nudge about this one, changes nothing.
select pg_temp.mk('ta', 'UTC');
select pg_temp.mk('tb', 'UTC');
select pg_temp.link('ta', 'tb');
select pg_temp.pick('ta', 'tb', date '2030-08-09', 'ta');
insert into public.daily_nudges (from_user, to_user, day_id, source)
values (pg_temp.u('ta'), pg_temp.u('tb'), pg_temp.day('ta', 'tb', date '2030-08-08'), 'prompt'),
       (pg_temp.u('tb'), pg_temp.u('ta'), pg_temp.day('ta', 'tb', date '2030-08-09'), 'button');
select public.enqueue_daily_reminders(timestamptz '2030-08-09 20:10:00+00');
select is(pg_temp.got('ta') || '|' || pg_temp.got('tb'), '|evening_self 2030-08-09',
  'DAILY-REM-034: the picker gets no row whatever nudges exist, and the partner who sent one still gets evening_self');

-- The prompt's nudge skips nothing either.
select pg_temp.mk('ua', 'UTC');
select pg_temp.mk('ub', 'UTC');
select pg_temp.link('ua', 'ub');
select pg_temp.pick('ua', 'ub', date '2030-08-12', 'ua');
insert into public.daily_nudges (from_user, to_user, day_id, source)
values (pg_temp.u('ua'), pg_temp.u('ub'), pg_temp.day('ua', 'ub', date '2030-08-12'), 'prompt');
select public.enqueue_daily_reminders(timestamptz '2030-08-12 20:10:00+00');
select is(pg_temp.got('ua') || '|' || pg_temp.got('ub'), '|evening_self 2030-08-12',
  'DAILY-REM-055: the prompt''s nudge about the day leaves the picker with no row and the partner with evening_self');

-- ============================================
-- A held nudge is still released at the 8 AM tick (story 11.1)
-- ============================================
select pg_temp.mk('ha', 'UTC');
select pg_temp.mk('hb', 'UTC');
select pg_temp.link('ha', 'hb');
select pg_temp.pick('ha', 'hb', date '2030-08-14', 'ha');
insert into public.daily_nudges (from_user, to_user, day_id, source, held)
values (pg_temp.u('ha'), pg_temp.u('hb'), pg_temp.day('ha', 'hb', date '2030-08-14'), 'button', true);
select is(
  (select count(*)::int from public.daily_nudges n where n.from_user = pg_temp.u('ha') and n.released_at is not null),
  0, 'DAILY-REM-056: the held nudge starts unreleased');
select public.enqueue_daily_reminders(timestamptz '2030-08-14 08:10:00+00');
select is(
  (select count(*)::int from public.daily_nudges n where n.from_user = pg_temp.u('ha') and n.released_at is not null),
  1, 'DAILY-REM-057: the 08:10 tick releases it');
select is(
  (select string_agg(convert_from(q.body, 'UTF8')::jsonb->>'kind', ', ')
     from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
    where n.from_user = pg_temp.u('ha')),
  'daily_nudge', 'DAILY-REM-058: and its release queued one daily_nudge call');
select is(pg_temp.got('ha') || '|' || pg_temp.got('hb'), '|', 'DAILY-REM-059: and the 08:10 tick queued no reminder for either partner');

-- ============================================
-- Not eligible
-- ============================================
select pg_temp.mk('n1', 'UTC', false);   -- no device
select pg_temp.mk('n2', 'UTC');
select pg_temp.link('n1', 'n2');
select pg_temp.mk('n3', null);           -- no zone
select pg_temp.mk('n4', 'UTC');
select pg_temp.link('n3', 'n4');
select pg_temp.mk('n5', 'UTC');          -- unlinked
select pg_temp.mk('n6', 'UTC');          -- linked one way
select pg_temp.mk('n7', 'UTC');
update public.users set partner_id = pg_temp.u('n7') where id = pg_temp.u('n6');

select public.enqueue_daily_reminders(timestamptz '2030-08-10 20:10:00+00');
select is(pg_temp.got('n1'), '', 'DAILY-REM-035: no device, no row');
select is(pg_temp.got('n2'), 'evening_self 2030-08-10', 'DAILY-REM-036: the linked partner with a device still gets theirs');
select is(pg_temp.got('n3'), '', 'DAILY-REM-037: no stored zone, no row');
select is(pg_temp.got('n4'), 'evening_self 2030-08-10', 'DAILY-REM-038: the linked partner with a zone still gets theirs');
select is(pg_temp.got('n5'), '', 'DAILY-REM-039: unlinked, no row');
select is(pg_temp.got('n6') || '|' || pg_temp.got('n7'), '|', 'DAILY-REM-040: linked one way only, no row for either');

-- ============================================
-- One person's failure leaves the other's row
-- ============================================
select pg_temp.mk('fa', 'UTC');
select pg_temp.mk('fb', 'UTC');
select pg_temp.link('fa', 'fb');

create table public.pgtap48_fail_for (user_id uuid primary key);
insert into public.pgtap48_fail_for values (least(pg_temp.u('fa'), pg_temp.u('fb')));
create function public.pgtap48_fail() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.pgtap48_fail_for f where f.user_id = new.user_id) then
    raise exception 'pgtap48: forced failure';
  end if;
  return new;
end; $$;
create trigger pgtap48_fail before insert on public.daily_reminders
  for each row execute function public.pgtap48_fail();

select lives_ok(
  $$select public.enqueue_daily_reminders(timestamptz '2030-08-11 20:10:00+00')$$,
  'DAILY-REM-041: a failure for one person does not abort the run'
);
select is(
  (select count(*)::int from public.daily_reminders r
    where r.user_id = (select user_id from public.pgtap48_fail_for)),
  0,
  'DAILY-REM-042: the person whose insert raised has no row'
);
select is(
  (select count(*)::int from public.daily_reminders r
    where r.user_id in (pg_temp.u('fa'), pg_temp.u('fb'))
      and r.user_id <> (select user_id from public.pgtap48_fail_for)
      and r.kind = 'evening_self' and r.local_date = date '2030-08-11'),
  1,
  'DAILY-REM-043: the other person''s row stays'
);
drop trigger pgtap48_fail on public.daily_reminders;

-- ============================================
-- The trigger and the kind check, by direct inserts
-- ============================================
select pg_temp.mk('ga', 'UTC');
select pg_temp.mk('gb', 'UTC');
select pg_temp.link('ga', 'gb');

insert into public.daily_reminders (user_id, kind, local_date, day_id)
values (pg_temp.u('ga'), 'evening_self', date '2030-09-01', pg_temp.day('ga', 'gb', date '2030-09-01')),
       (pg_temp.u('gb'), 'evening_self', date '2030-09-01', pg_temp.day('ga', 'gb', date '2030-09-01'));
select is(pg_temp.queued('ga'), 'daily_reminder', 'DAILY-REM-044: an evening_self row queues one daily_reminder call');
select is(pg_temp.queued('gb'), 'daily_reminder', 'DAILY-REM-045: for either partner');
select results_eq(
  $$select distinct q.headers->>'x-push-secret', q.url
      from net.http_request_queue q join public.daily_reminders r on convert_from(q.body, 'UTF8')::jsonb->>'id' = r.id::text
     where r.user_id in (select id from t_users where label in ('ga', 'gb'))$$,
  $$values ('daily-reminders-test-secret'::text, 'http://sender.test/send-push'::text)$$,
  'DAILY-REM-046: the calls go to the sender URL with the shared secret'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'morning', date '2030-09-02', %L)$$, pg_temp.u('ga'), pg_temp.day('ga', 'gb', date '2030-09-02')),
  '23514', null,
  'DAILY-REM-060: a morning row is refused by daily_reminders_kind_check'
);
select throws_ok(
  format($$insert into public.daily_reminders (user_id, kind, local_date, day_id)
           values (%L, 'evening_partner', date '2030-09-02', %L)$$, pg_temp.u('ga'), pg_temp.day('ga', 'gb', date '2030-09-02')),
  '23514', null,
  'DAILY-REM-061: an evening_partner row is refused by daily_reminders_kind_check'
);
select is(
  (select count(*)::int from pg_proc p
    where p.oid in ('public.enqueue_daily_reminders(timestamptz)'::regprocedure)
      and (obj_description(p.oid, 'pg_proc') ~ '(daily_partner_picked|daily_question|evening_partner|morning)'
        or obj_description('public.daily_reminders'::regclass, 'pg_class') ~ '(daily_partner_picked|daily_question|evening_partner|morning)')),
  0,
  'DAILY-REM-062: the daily_reminders and enqueue_daily_reminders comments name no removed kind'
);

select * from finish();
rollback;
