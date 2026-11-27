-- ============================================
-- pgTAP: two nudges per question, held until the partner's 8 AM (20261127000000)
--
-- Story 11.1 of epic-simpler-daily-pushes-and-nudge (architecture-daily-question:
-- AD-3, AD-8, AD-9, AD-10, AD-15, AD-16, AD-17). It replaces story 8.7's file,
-- which pinned the slot model. Pinned here:
--   * structure and grants: record_daily_nudge and release_held_daily_nudges
--     (security definer, empty search_path, service_role only, no PUBLIC),
--     send_daily_nudge(day_id, source) (security definer, empty search_path, no
--     PUBLIC), daily_nudge_slot gone, and the two triggers on daily_nudges: the
--     AFTER INSERT one WHEN (not new.held) and the AFTER UPDATE OF released_at
--     one WHEN released_at goes from null to set.
--   * fixed instants with the sender on Pacific/Kiritimati (UTC+14) and the
--     partner on Pacific/Honolulu (UTC-10), so the sender's clock is a day ahead
--     of the partner's and 08:00 on the partner's clock is 18:00 UTC:
--       - the snapshot's nudges {prompt_sent, button_sent, closes_at}, no `nudge`;
--       - a nudge before 08:00 there (the day not started, and 00:00-08:00) is
--         held and queues no call, one at or after 08:00 is not held and queues
--         one, at either source;
--       - the limit is one nudge per source per question: a repeat is DQ010 and
--         records nothing, the other source is still taken, the sender's own
--         midnight resets nothing, and another day's nudges are separate;
--       - release_held_daily_nudges at 08:00-08:30 queues one call and a repeat
--         none, 07:59:59 and 08:30:00 queue none, a partner who has picked
--         queues none, two held nudges about one question queue one, a held one
--         beside a nudge pushed at 08:02 queues none, and a partner with no zone
--         row is held on UTC and never released;
--       - closes_at is the end of the day on the partner's clock and DQ009 holds
--         from that instant, not before;
--       - a one-way link (service-role update of users.partner_id) is P0002 for
--         both sources and gives no closes_at;
--       - the one-argument send_daily_nudge is recorded as the button's, an
--         unknown source is 22023, and P0002 / DQ007 / DQ008 write nothing.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

-- The snapshot's closes_at is read as text below, in the session's zone.
set local time zone 'UTC';

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(85);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Nudge ' || left(test_email, 8))
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

create temporary table t_users (label text primary key, id uuid not null);
create or replace function pg_temp.u(p text) returns uuid language sql stable as $$ select id from t_users where label = p $$;

-- A user with a push device and, optionally, a stored zone and its UTC offset in minutes.
create or replace function pg_temp.mk(p_label text, p_zone text, p_offset integer default 0)
returns void language plpgsql as $$
declare v_id uuid := tests.create_test_user('nudge50-' || p_label || '@example.com');
begin
  insert into t_users values (p_label, v_id);
  if p_zone is not null then
    insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)
    values (v_id, p_zone, p_offset, p_zone, timestamptz '2030-06-01 00:00:00+00');
  end if;
  insert into public.push_devices (user_id, token, environment) values (v_id, 'pgtap50-' || p_label, 'sandbox');
end; $$;

create or replace function pg_temp.link(p_a text, p_b text) returns void language sql as $$
  update public.users set partner_id = pg_temp.u(p_b) where id = pg_temp.u(p_a);
  update public.users set partner_id = pg_temp.u(p_a) where id = pg_temp.u(p_b);
$$;

-- The pair's day for a date, and a pick on it.
create or replace function pg_temp.day(p_a text, p_b text, p_day date) returns uuid language sql as $$
  select (public.assign_couple_day(least(pg_temp.u(p_a), pg_temp.u(p_b)), greatest(pg_temp.u(p_a), pg_temp.u(p_b)), p_day)).id
$$;
create or replace function pg_temp.pick(p_a text, p_b text, p_day date, p_who text, p_second boolean default false) returns void language sql as $$
  insert into public.daily_picks (day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second)
  values (pg_temp.day(p_a, p_b, p_day), pg_temp.u(p_who), 'this', timestamptz '2030-01-01 00:00:00+00', 'UTC', 0, 'UTC', p_second)
$$;

-- The viewer's snapshot `nudges` for a day at an instant.
create or replace function pg_temp.nudges(p_a text, p_b text, p_day date, p_who text, p_at timestamptz) returns jsonb language sql as $$
  select public.daily_day_snapshot(pg_temp.day(p_a, p_b, p_day), pg_temp.u(p_who), p_at) -> 'nudges'
$$;

-- record_daily_nudge for a sender about a pair's day, from a source, at an instant.
create or replace function pg_temp.nudge(p_a text, p_b text, p_day date, p_who text, p_source text, p_at timestamptz) returns jsonb language sql as $$
  select public.record_daily_nudge(pg_temp.u(p_who), pg_temp.day(p_a, p_b, p_day), p_source, p_at)
$$;

-- The nudge rows a sender holds about a pair's day, as 'source:held:released' in source order.
create or replace function pg_temp.rows(p_a text, p_b text, p_day date, p_who text) returns text language sql as $$
  select coalesce(string_agg(n.source || ':' || n.held::text || ':' || (n.released_at is not null)::text, ', ' order by n.source), '')
    from public.daily_nudges n
   where n.from_user = pg_temp.u(p_who) and n.day_id = pg_temp.day(p_a, p_b, p_day)
$$;

-- How many {kind: daily_nudge, id} calls were queued about a sender's nudges for a pair's day.
create or replace function pg_temp.calls(p_a text, p_b text, p_day date, p_who text) returns integer language sql as $$
  select count(*)::int
    from public.daily_nudges n
    join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
   where n.from_user = pg_temp.u(p_who) and n.day_id = pg_temp.day(p_a, p_b, p_day)
$$;

delete from public.push_sender_settings;
insert into public.push_sender_settings (sender_url, sender_secret)
values ('http://sender.test/send-push', 'daily-nudge-test-secret');

-- ============================================
-- Structure, grants, triggers
-- ============================================
select is(
  (select count(*)::int from pg_proc p
    where p.oid in ('public.record_daily_nudge(uuid, uuid, text, timestamptz)'::regprocedure,
                    'public.release_held_daily_nudges(timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid, text)'::regprocedure)
      and p.prosecdef and p.proconfig @> array['search_path=""']),
  3,
  'DAILY-NUDGE-001: the recorder, the release and the client RPC are security definer with an empty search_path'
);
select is(
  (select count(*)::int
     from unnest(array['record_daily_nudge(uuid, uuid, text, timestamptz)', 'release_held_daily_nudges(timestamptz)']) as f(sig),
          unnest(array['anon', 'authenticated']) as r(rolename)
    where has_function_privilege(r.rolename, 'public.' || f.sig, 'EXECUTE')),
  0,
  'DAILY-NUDGE-002: the two internal functions are executable by neither anon nor authenticated'
);
select is(
  (select count(*)::int
     from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid in ('public.record_daily_nudge(uuid, uuid, text, timestamptz)'::regprocedure,
                    'public.release_held_daily_nudges(timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid, text)'::regprocedure)
      and acl.grantee = 0),
  0,
  'DAILY-NUDGE-003: none of the three is granted to PUBLIC'
);
select ok(
  has_function_privilege('service_role', 'public.record_daily_nudge(uuid, uuid, text, timestamptz)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.release_held_daily_nudges(timestamptz)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.send_daily_nudge(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.send_daily_nudge(uuid, text)', 'EXECUTE'),
  'DAILY-NUDGE-004: service_role has EXECUTE on both internal functions, authenticated (not anon) on the client RPC'
);
select is(
  (select count(*)::int from pg_proc p
    where p.oid in ('public.record_daily_nudge(uuid, uuid, text, timestamptz)'::regprocedure,
                    'public.release_held_daily_nudges(timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid, text)'::regprocedure,
                    'public.daily_day_snapshot(uuid, uuid, timestamptz)'::regprocedure,
                    'public.enqueue_daily_reminders(timestamptz)'::regprocedure)
      and obj_description(p.oid, 'pg_proc') is not null),
  5,
  'DAILY-NUDGE-005: the three functions, the snapshot and the reminders job function carry a comment'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('daily_nudge_slot')),
  0,
  'DAILY-NUDGE-006: daily_nudge_slot is gone'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('record_daily_nudge', 'send_daily_nudge')),
  2,
  'DAILY-NUDGE-007: one record_daily_nudge and one send_daily_nudge exist, so a one-argument call is never ambiguous'
);
select is(
  (select string_agg(t.tgname || ' ' || p.proname || ' ' || t.tgenabled::text || ' ' || t.tgtype::text, ', ' order by t.tgname)
     from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.daily_nudges'::regclass and not t.tgisinternal),
  'daily_nudges_push_after_insert notify_push O 5, daily_nudges_push_after_release notify_push O 17',
  'DAILY-NUDGE-008: daily_nudges carries exactly two notify_push triggers: AFTER INSERT and AFTER UPDATE, each FOR EACH ROW, enabled'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'WHEN \(\(NOT new\.held\)\) EXECUTE FUNCTION notify_push\(''daily_nudge''\)$'
     from pg_trigger t where t.tgname = 'daily_nudges_push_after_insert'),
  'DAILY-NUDGE-009: the insert trigger fires only for a nudge that is not held and posts kind daily_nudge'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'AFTER UPDATE OF released_at ON'
      and pg_get_triggerdef(t.oid) ~ 'WHEN \(\(\(old\.released_at IS NULL\) AND \(new\.released_at IS NOT NULL\)\)\) EXECUTE FUNCTION notify_push\(''daily_nudge''\)$'
     from pg_trigger t where t.tgname = 'daily_nudges_push_after_release'),
  'DAILY-NUDGE-010: the release trigger fires only when released_at goes from null to set and posts kind daily_nudge'
);

-- ============================================
-- The pair: S (sender) on UTC+14, P (partner) on UTC-10.
-- P's 08:00 on a date d is 18:00 UTC on d; the day ends at 10:00 UTC on d+1.
-- ============================================
select pg_temp.mk('s', 'Pacific/Kiritimati', 840);
select pg_temp.mk('p', 'Pacific/Honolulu', -600);
select pg_temp.link('s', 'p');
select pg_temp.mk('o', 'UTC');   -- another couple
select pg_temp.mk('d', 'UTC');
select pg_temp.link('o', 'd');
select pg_temp.mk('u', 'UTC');   -- unlinked

-- Open the days first: the stable snapshot cannot see a row the same statement inserts.
select pg_temp.day('s', 'p', date '2030-09-10');
select pg_temp.day('s', 'p', date '2030-09-11');
select pg_temp.day('s', 'p', date '2030-09-12');
select pg_temp.day('s', 'p', date '2030-09-13');
select pg_temp.day('s', 'p', date '2030-09-15');
select pg_temp.day('s', 'p', date '2030-09-16');

-- --------------------------------------------
-- Before S has picked
-- --------------------------------------------
select is(pg_temp.nudges('s', 'p', date '2030-09-10', 's', timestamptz '2030-09-10 12:00:00+00'),
  '{"button_sent": false, "closes_at": null, "prompt_sent": false}'::jsonb,
  'DAILY-NUDGE-011: with no pick the snapshot has nothing sent and no closing instant');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-10')),
  'DQ007', 'Pick before nudging',
  'DAILY-NUDGE-012: a nudge before the sender''s own pick is DQ007');
select is((select count(*)::int from public.daily_nudges where from_user in (pg_temp.u('s'), pg_temp.u('p'))), 0,
  'DAILY-NUDGE-013: and writes nothing');

-- --------------------------------------------
-- Day A (09-10): S picks and nudges from both sources before P's 08:00
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-10', 's');

select is(pg_temp.nudges('s', 'p', date '2030-09-10', 's', timestamptz '2030-09-10 12:00:00+00'),
  '{"button_sent": false, "closes_at": "2030-09-11T10:00:00+00:00", "prompt_sent": false}'::jsonb,
  'DAILY-NUDGE-014: after S''s pick closes_at is the end of the day on P''s clock (09-11 00:00 Honolulu = 10:00 UTC)');
select ok(
  not (public.daily_day_snapshot(pg_temp.day('s', 'p', date '2030-09-10'), pg_temp.u('s'), timestamptz '2030-09-10 12:00:00+00') ? 'nudge'),
  'DAILY-NUDGE-015: and the snapshot has no nudge key');
select is(pg_temp.nudges('s', 'p', date '2030-09-10', 'p', timestamptz '2030-09-10 12:00:00+00'),
  '{"button_sent": false, "closes_at": null, "prompt_sent": false}'::jsonb,
  'DAILY-NUDGE-016: P, who has not picked, is given no closing instant');

-- The day has not started on P's clock: 09-09 20:00 UTC is P's 10:00 on 09-09, S's 10:00 on 09-10.
select set_config('tests.r', pg_temp.nudge('s', 'p', date '2030-09-10', 's', 'prompt', timestamptz '2030-09-09 20:00:00+00')::text, false);
select is((current_setting('tests.r')::jsonb) -> 'nudges' ->> 'prompt_sent', 'true',
  'DAILY-NUDGE-017: a prompt nudge the day before P''s day starts is taken and returns prompt_sent');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'prompt:true:false',
  'DAILY-NUDGE-018: and is held, not released');
select is(pg_temp.calls('s', 'p', date '2030-09-10', 's'), 0,
  'DAILY-NUDGE-019: and queues no call');

-- 00:00-08:00 on P's day: 09-10 12:00 UTC is P's 02:00 and S's 02:00 on 09-11.
select is(pg_temp.nudges('s', 'p', date '2030-09-10', 's', timestamptz '2030-09-10 12:00:00+00'),
  '{"button_sent": false, "closes_at": "2030-09-11T10:00:00+00:00", "prompt_sent": true}'::jsonb,
  'DAILY-NUDGE-020: the prompt is sent, the button is not, and the closing instant stays');
select lives_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-10')),
  'DAILY-NUDGE-021: the button''s nudge at P''s 02:00 is taken: using the prompt did not spend it');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'button:true:false, prompt:true:false',
  'DAILY-NUDGE-022: both are held');
select is(pg_temp.calls('s', 'p', date '2030-09-10', 's'), 0,
  'DAILY-NUDGE-023: and still no call is queued');

-- The limit is the question's, not the date's: S's own clock is past midnight, P's day is not over.
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-10')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-024: a second prompt nudge, though S''s date moved on, is DQ010');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-09-10 17:59:59+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-10')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-025: a second button nudge at P''s 07:59:59 is DQ010');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'button:true:false, prompt:true:false',
  'DAILY-NUDGE-026: and the refusals recorded nothing');

-- Order the two held nudges: the prompt is the earlier.
update public.daily_nudges set created_at = timestamptz '2030-09-09 20:00:00+00'
 where from_user = pg_temp.u('s') and day_id = pg_temp.day('s', 'p', date '2030-09-10') and source = 'prompt';
update public.daily_nudges set created_at = timestamptz '2030-09-10 12:00:00+00'
 where from_user = pg_temp.u('s') and day_id = pg_temp.day('s', 'p', date '2030-09-10') and source = 'button';

-- Before 08:00 nothing is released.
select public.release_held_daily_nudges(timestamptz '2030-09-10 17:59:59+00');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'button:true:false, prompt:true:false',
  'DAILY-NUDGE-027: at P''s 07:59:59 neither held nudge is released');

-- At P's 08:00 the job (enqueue_daily_reminders) releases the first and only the first.
select public.enqueue_daily_reminders(timestamptz '2030-09-10 18:00:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'button:true:false, prompt:true:true',
  'DAILY-NUDGE-028: at P''s 08:00 the earlier nudge is released and the other never is');
select is(pg_temp.calls('s', 'p', date '2030-09-10', 's'), 1,
  'DAILY-NUDGE-029: and exactly one {kind: daily_nudge, id} call is queued for the two nudges');
select is(
  (select array_agg(k order by k)
     from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text,
          jsonb_object_keys(convert_from(q.body, 'UTF8')::jsonb) k
    where n.from_user = pg_temp.u('s') and n.day_id = pg_temp.day('s', 'p', date '2030-09-10')),
  array['id', 'kind'],
  'DAILY-NUDGE-030: its body holds exactly the keys kind and id');
select results_eq(
  $$select distinct q.headers->>'x-push-secret', q.url, convert_from(q.body, 'UTF8')::jsonb->>'kind'
      from public.daily_nudges n
      join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
     where n.from_user = (select id from t_users where label = 's')$$,
  $$values ('daily-nudge-test-secret'::text, 'http://sender.test/send-push'::text, 'daily_nudge'::text)$$,
  'DAILY-NUDGE-031: the call goes to the sender URL with the shared secret, kind daily_nudge');

-- A repeat tick, and a later one inside the window, post nothing more.
select public.release_held_daily_nudges(timestamptz '2030-09-10 18:00:00+00');
select public.release_held_daily_nudges(timestamptz '2030-09-10 18:05:00+00');
select is(pg_temp.calls('s', 'p', date '2030-09-10', 's'), 1,
  'DAILY-NUDGE-032: a repeat tick and a later tick in the window queue no second call');
select is(pg_temp.rows('s', 'p', date '2030-09-10', 's'), 'button:true:false, prompt:true:true',
  'DAILY-NUDGE-033: and both nudges still count as used');
select is(pg_temp.nudges('s', 'p', date '2030-09-10', 's', timestamptz '2030-09-10 18:05:00+00'),
  '{"button_sent": true, "closes_at": "2030-09-11T10:00:00+00:00", "prompt_sent": true}'::jsonb,
  'DAILY-NUDGE-034: the snapshot shows both sources sent');

-- --------------------------------------------
-- Day B (09-11): yesterday's nudges leave today's open; the window missed
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-11', 's');
select lives_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-10 20:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-11')),
  'DAILY-NUDGE-035: after both of 09-10''s nudges were used, the prompt about 09-11 is taken');
select lives_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-09-10 20:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-11')),
  'DAILY-NUDGE-036: and so is the button''s');
select is(pg_temp.rows('s', 'p', date '2030-09-11', 's'), 'button:true:false, prompt:true:false',
  'DAILY-NUDGE-037: both held, as P''s 09-11 has not started');

select public.release_held_daily_nudges(timestamptz '2030-09-11 18:30:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-11', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-11', 's'),
  'button:true:false, prompt:true:false / 0',
  'DAILY-NUDGE-038: a tick at P''s 08:30:00 is past the window: nothing is released or queued');
select public.release_held_daily_nudges(timestamptz '2030-09-12 18:00:00+00');
select is(pg_temp.calls('s', 'p', date '2030-09-11', 's'), 0,
  'DAILY-NUDGE-039: nor does a tick on the next day: a missed window sends nothing later');

-- --------------------------------------------
-- Day C (09-12): P answers before the release
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-12', 's');
select pg_temp.nudge('s', 'p', date '2030-09-12', 's', 'button', timestamptz '2030-09-11 20:00:00+00');
select pg_temp.pick('s', 'p', date '2030-09-12', 'p', true);
select public.release_held_daily_nudges(timestamptz '2030-09-12 18:05:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-12', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-12', 's'),
  'button:true:false / 0',
  'DAILY-NUDGE-040: a partner who answered before 08:00 gets nothing, and the nudge still counts as sent');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-12 19:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-12')),
  'DQ008', 'Your partner has picked',
  'DAILY-NUDGE-041: and a nudge once the partner has picked is DQ008');
select is(pg_temp.nudges('s', 'p', date '2030-09-12', 's', timestamptz '2030-09-12 19:00:00+00'),
  '{"button_sent": true, "closes_at": null, "prompt_sent": false}'::jsonb,
  'DAILY-NUDGE-042: the snapshot keeps the button sent and gives no closing instant');

-- --------------------------------------------
-- Day D (09-13): one held, the other sent at P's 08:02
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-13', 's');
select pg_temp.nudge('s', 'p', date '2030-09-13', 's', 'prompt', timestamptz '2030-09-12 20:00:00+00');
select pg_temp.nudge('s', 'p', date '2030-09-13', 's', 'button', timestamptz '2030-09-13 18:02:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-13', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-13', 's'),
  'button:false:false, prompt:true:false / 1',
  'DAILY-NUDGE-043: a nudge at P''s 08:02 is not held and queues its call at once; the earlier one is held');
select public.release_held_daily_nudges(timestamptz '2030-09-13 18:05:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-13', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-13', 's'),
  'button:false:false, prompt:true:false / 1',
  'DAILY-NUDGE-044: the 08:05 tick drops the held one: no second push, both count as used');

-- --------------------------------------------
-- Day E (09-15): not held from 08:00; the limit per source
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-15', 's');
select pg_temp.nudge('s', 'p', date '2030-09-15', 's', 'prompt', timestamptz '2030-09-15 18:00:00+00');
select is(pg_temp.rows('s', 'p', date '2030-09-15', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-15', 's'),
  'prompt:false:false / 1',
  'DAILY-NUDGE-045: a nudge at P''s 08:00:00 is not held and queues one call');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-15 19:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-15')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-046: the same source again is DQ010');
select is(pg_temp.rows('s', 'p', date '2030-09-15', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-15', 's'),
  'prompt:false:false / 1',
  'DAILY-NUDGE-047: and the refusal recorded and queued nothing');

-- The last instant before the day ends on P's clock is still taken; the end itself is not.
select lives_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-09-16 09:59:59+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-15')),
  'DAILY-NUDGE-048: the button''s nudge at P''s 23:59:59 is taken, not held');
select is(pg_temp.rows('s', 'p', date '2030-09-15', 's') || ' / ' || pg_temp.calls('s', 'p', date '2030-09-15', 's'),
  'button:false:false, prompt:false:false / 2',
  'DAILY-NUDGE-049: both sources are used and each queued its own call');

-- --------------------------------------------
-- Day F (09-16): the day has ended on P's clock
-- --------------------------------------------
select pg_temp.pick('s', 'p', date '2030-09-16', 's');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-17 10:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-16')),
  'DQ009', 'The day has ended on your partner''s clock',
  'DAILY-NUDGE-050: at P''s 00:00:00 on the next day a prompt nudge is DQ009');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-09-20 00:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-16')),
  'DQ009', 'The day has ended on your partner''s clock',
  'DAILY-NUDGE-051: and so is a button nudge days later');
select is(pg_temp.rows('s', 'p', date '2030-09-16', 's'), '',
  'DAILY-NUDGE-052: neither recorded anything');
select is(
  (pg_temp.nudges('s', 'p', date '2030-09-16', 's', timestamptz '2030-09-20 00:00:00+00') ->> 'closes_at')::timestamptz,
  timestamptz '2030-09-17 10:00:00+00',
  'DAILY-NUDGE-053: the snapshot still gives the closing instant after it has passed (the client compares it)');

-- Outsiders: the day belongs to the pair S/P, and O is linked to D.
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-17 09:59:59+00')$$,
         pg_temp.u('o'), pg_temp.day('s', 'p', date '2030-09-16')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-054: a partnered caller outside the pair gets P0002, even at a valid instant');

-- --------------------------------------------
-- A one-way link
-- --------------------------------------------
select pg_temp.mk('w1', 'UTC');
select pg_temp.mk('w2', 'UTC');
select pg_temp.link('w1', 'w2');
select pg_temp.day('w1', 'w2', date '2030-10-01');
select pg_temp.pick('w1', 'w2', date '2030-10-01', 'w1');
select is(pg_temp.nudges('w1', 'w2', date '2030-10-01', 'w1', timestamptz '2030-10-01 12:00:00+00') ->> 'closes_at', '2030-10-02T00:00:00+00:00',
  'DAILY-NUDGE-055: with the link both ways, a partner on UTC closes the day at UTC midnight');
update public.users set partner_id = null where id = pg_temp.u('w2');
select is(pg_temp.nudges('w1', 'w2', date '2030-10-01', 'w1', timestamptz '2030-10-01 12:00:00+00'),
  '{"button_sent": false, "closes_at": null, "prompt_sent": false}'::jsonb,
  'DAILY-NUDGE-056: once the partner''s partner_id no longer names the viewer, the snapshot offers no closing instant');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-10-01 12:00:00+00')$$,
         pg_temp.u('w1'), pg_temp.day('w1', 'w2', date '2030-10-01')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-057: a prompt nudge across a one-way link is P0002');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'button', timestamptz '2030-10-01 12:00:00+00')$$,
         pg_temp.u('w1'), pg_temp.day('w1', 'w2', date '2030-10-01')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-058: and so is a button nudge');
select is(pg_temp.rows('w1', 'w2', date '2030-10-01', 'w1'), '',
  'DAILY-NUDGE-059: and neither recorded anything');

-- A held nudge whose link broke before 08:00 is not released.
select pg_temp.link('w1', 'w2');
select pg_temp.nudge('w1', 'w2', date '2030-10-01', 'w1', 'prompt', timestamptz '2030-10-01 06:00:00+00');
update public.users set partner_id = null where id = pg_temp.u('w2');
select public.release_held_daily_nudges(timestamptz '2030-10-01 08:10:00+00');
select is(pg_temp.rows('w1', 'w2', date '2030-10-01', 'w1') || ' / ' || pg_temp.calls('w1', 'w2', date '2030-10-01', 'w1'),
  'prompt:true:false / 0',
  'DAILY-NUDGE-060: a held nudge is not released across a link that went one-way, and still counts');

-- --------------------------------------------
-- Outsiders and unknowns write nothing
-- --------------------------------------------
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'prompt', timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('u'), pg_temp.day('s', 'p', date '2030-09-10')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-061: an unlinked caller gets P0002');
select throws_ok(
  format($$select public.record_daily_nudge(%L, gen_random_uuid(), 'prompt', timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('s')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-062: a day id no row has gets P0002');
select throws_ok(
  $$select public.record_daily_nudge(null, gen_random_uuid(), 'prompt', now())$$,
  'P0002', 'Day not found',
  'DAILY-NUDGE-063: a null viewer gets P0002');
select is(
  (select count(*)::int from public.daily_nudges where from_user in (pg_temp.u('o'), pg_temp.u('d'), pg_temp.u('u'))),
  0,
  'DAILY-NUDGE-064: and none of them wrote a row');

-- Bad sources, before anything else is read.
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, 'other', timestamptz '2030-09-16 12:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-16')),
  '22023', 'Unknown nudge source',
  'DAILY-NUDGE-065: an unknown source is 22023');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, null, timestamptz '2030-09-16 12:00:00+00')$$,
         pg_temp.u('s'), pg_temp.day('s', 'p', date '2030-09-16')),
  '22023', 'Unknown nudge source',
  'DAILY-NUDGE-066: so is a null source');
select is(pg_temp.rows('s', 'p', date '2030-09-16', 's'), '',
  'DAILY-NUDGE-067: and neither recorded anything');

-- --------------------------------------------
-- A partner with no zone row: the hold and the closing instant are on UTC
-- --------------------------------------------
select pg_temp.mk('c', null);
select pg_temp.mk('e', null);
select pg_temp.link('c', 'e');
select pg_temp.day('c', 'e', date '2030-09-20');
select pg_temp.day('c', 'e', date '2030-09-21');
select pg_temp.pick('c', 'e', date '2030-09-20', 'c');
select pg_temp.pick('c', 'e', date '2030-09-21', 'c');

select is((pg_temp.nudges('c', 'e', date '2030-09-20', 'c', timestamptz '2030-09-20 12:00:00+00') ->> 'closes_at')::timestamptz,
  timestamptz '2030-09-21 00:00:00+00',
  'DAILY-NUDGE-068: with no zone row the day ends at UTC midnight');
select pg_temp.nudge('c', 'e', date '2030-09-20', 'c', 'prompt', timestamptz '2030-09-20 07:59:59+00');
select pg_temp.nudge('c', 'e', date '2030-09-21', 'c', 'prompt', timestamptz '2030-09-21 08:00:00+00');
select is(pg_temp.rows('c', 'e', date '2030-09-20', 'c') || ' / ' || pg_temp.rows('c', 'e', date '2030-09-21', 'c'),
  'prompt:true:false / prompt:false:false',
  'DAILY-NUDGE-069: held at 07:59:59 UTC and not held at 08:00:00 UTC');
select public.release_held_daily_nudges(timestamptz '2030-09-20 08:10:00+00');
select is(pg_temp.rows('c', 'e', date '2030-09-20', 'c') || ' / ' || pg_temp.calls('c', 'e', date '2030-09-20', 'c'),
  'prompt:true:false / 0',
  'DAILY-NUDGE-070: a held nudge for a partner with no zone row is never released, and still counts');
select is(pg_temp.calls('c', 'e', date '2030-09-21', 'c'), 1,
  'DAILY-NUDGE-071: the one at 08:00 UTC queued its call on insert');

-- ============================================
-- The client RPC, today on UTC (no zone row)
-- ============================================
select pg_temp.pick('c', 'e', (now() at time zone 'UTC')::date, 'c');
select set_config('tests.cday', pg_temp.day('c', 'e', (now() at time zone 'UTC')::date)::text, false);

-- The old build's one-argument request is the button's nudge.
select tests.authenticate_as(pg_temp.u('c'));
select set_config('tests.c_res', public.send_daily_nudge(current_setting('tests.cday')::uuid)::text, false);
reset role;

select is((current_setting('tests.c_res')::jsonb) -> 'nudges' ->> 'button_sent', 'true',
  'DAILY-NUDGE-072: the one-argument send_daily_nudge answers with the button sent');
select is((current_setting('tests.c_res')::jsonb) -> 'nudges' ->> 'prompt_sent', 'false',
  'DAILY-NUDGE-073: and the prompt not');
select is(
  (select string_agg(n.source, ', ') from public.daily_nudges n where n.from_user = pg_temp.u('c') and n.day_id = current_setting('tests.cday')::uuid),
  'button',
  'DAILY-NUDGE-074: it was recorded as source button');
select is(
  (select n.held from public.daily_nudges n where n.from_user = pg_temp.u('c') and n.day_id = current_setting('tests.cday')::uuid),
  now() < (((now() at time zone 'UTC')::date)::timestamp + time '08:00') at time zone 'UTC',
  'DAILY-NUDGE-075: held exactly when now() is before 08:00 UTC today, as the partner has no zone');

select tests.authenticate_as(pg_temp.u('c'));
select throws_ok(
  format($$select public.send_daily_nudge(%L, 'button')$$, current_setting('tests.cday')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-076: sending the button again is DQ010');
select lives_ok(
  format($$select public.send_daily_nudge(%L, 'prompt')$$, current_setting('tests.cday')),
  'DAILY-NUDGE-077: the prompt is still taken');
select throws_ok(
  format($$select public.send_daily_nudge(%L, 'other')$$, current_setting('tests.cday')),
  '22023', 'Unknown nudge source',
  'DAILY-NUDGE-078: an unknown source through the client RPC is 22023');
reset role;

select tests.authenticate_as(pg_temp.u('e'));
select throws_ok(
  format($$select public.send_daily_nudge(%L, 'prompt')$$, current_setting('tests.cday')),
  'DQ007', 'Pick before nudging',
  'DAILY-NUDGE-079: the partner who has not picked is DQ007');
reset role;

select is(
  (select count(*)::int from public.daily_nudges n where n.from_user in (pg_temp.u('c'), pg_temp.u('e')) and n.day_id = current_setting('tests.cday')::uuid),
  2,
  'DAILY-NUDGE-080: the refusals added no row beyond the two sent');
select is(
  (select count(*)::int from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
    where n.from_user = pg_temp.u('c') and n.day_id = current_setting('tests.cday')::uuid),
  case when now() < (((now() at time zone 'UTC')::date)::timestamp + time '08:00') at time zone 'UTC' then 0 else 2 end,
  'DAILY-NUDGE-081: and the two queued a call each, unless held');

-- Every nudge row of the pair S/P that was not held queued exactly one call, and every held, unreleased one none.
select is(
  (select count(*)::int from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
    where n.from_user = pg_temp.u('s') and (n.held and n.released_at is null)),
  0,
  'DAILY-NUDGE-082: no held and unreleased nudge of S queued a call');
select is(
  (select count(*)::int from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
    where n.from_user = pg_temp.u('s') and (not n.held or n.released_at is not null)),
  (select count(*)::int from public.daily_nudges n where n.from_user = pg_temp.u('s') and (not n.held or n.released_at is not null)),
  'DAILY-NUDGE-083: every not-held or released nudge of S queued one');

-- The client RPC refuses a NULL auth.uid() (the claims left by authenticate_as are cleared first).
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select public.send_daily_nudge(gen_random_uuid(), 'prompt')$$,
  'Authentication required',
  'DAILY-NUDGE-084: send_daily_nudge rejects a NULL auth.uid()');
select is(public.release_held_daily_nudges(null), 0,
  'DAILY-NUDGE-085: release_held_daily_nudges with a null instant releases nothing');

select * from finish();
rollback;
