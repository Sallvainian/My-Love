-- ============================================
-- pgTAP: the server takes a nudge and pushes it (20261126020000)
--
-- Story 8.7 of epic-daily-pushes-and-nudge (architecture-daily-question:
-- AD-8, AD-10, AD-15, AD-16, AD-17; requirement R2). Pinned here:
--   * structure and grants: daily_nudge_slot and record_daily_nudge (security
--     definer, empty search_path, service_role only, no PUBLIC), send_daily_nudge
--     (security definer, empty search_path, no PUBLIC), and the one
--     daily_nudges_push_after_insert trigger, AFTER INSERT FOR EACH ROW with no
--     WHEN and kind daily_nudge.
--   * daily_nudge_slot at the 20:00 edge, with no zone row (UTC) and for a null.
--   * the snapshot's nudge {slot, spent} and record_daily_nudge at fixed instants:
--     no picks (DQ007), the partner's day over (DQ009), the first nudge, the same
--     slot again (DQ010), the evening slot decided by the sender's clock and not
--     the recipient's, a third nudge (DQ010), the partner having picked (DQ008),
--     a sender whose clock is not UTC, the recipient's date already the next day,
--     a viewer whose partner_id is no longer the day's partner, and an outsider, an unlinked caller and an
--     unknown day (P0002) writing nothing.
--   * each nudge queues exactly one {kind: daily_nudge, id} call to the sender URL
--     with the shared secret, and a refusal queues nothing.
--   * the client RPC send_daily_nudge on a pair with no zone row.
--
-- Helpers are declared inline: 00_helpers.sql rolls back before later files run.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(52);

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

-- The viewer's snapshot nudge for a day at an instant.
create or replace function pg_temp.nudge(p_a text, p_b text, p_day date, p_who text, p_at timestamptz) returns jsonb language sql as $$
  select public.daily_day_snapshot(pg_temp.day(p_a, p_b, p_day), pg_temp.u(p_who), p_at) -> 'nudge'
$$;

-- What the sender's nudge rows were queued as, as 'kind, kind' ('' for none), their body keys, and where they went.
create or replace function pg_temp.queued(p_who text) returns text language sql as $$
  select coalesce(string_agg(convert_from(q.body, 'UTF8')::jsonb->>'kind', ', ' order by n.created_at, n.slot), '')
    from public.daily_nudges n
    join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
   where n.from_user = pg_temp.u(p_who)
$$;

delete from public.push_sender_settings;
insert into public.push_sender_settings (sender_url, sender_secret)
values ('http://sender.test/send-push', 'daily-nudge-test-secret');

-- ============================================
-- Structure, grants, trigger
-- ============================================
select is(
  (select count(*)::int from pg_proc p
    where p.oid in ('public.daily_nudge_slot(uuid, timestamptz)'::regprocedure,
                    'public.record_daily_nudge(uuid, uuid, timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid)'::regprocedure)
      and p.prosecdef and p.proconfig @> array['search_path=""']),
  3,
  'DAILY-NUDGE-001: the slot, the recorder and the client RPC are security definer with an empty search_path'
);
select is(
  (select count(*)::int
     from unnest(array['daily_nudge_slot(uuid, timestamptz)', 'record_daily_nudge(uuid, uuid, timestamptz)']) as f(sig),
          unnest(array['anon', 'authenticated']) as r(rolename)
    where has_function_privilege(r.rolename, 'public.' || f.sig, 'EXECUTE')),
  0,
  'DAILY-NUDGE-002: the two internal functions are executable by neither anon nor authenticated'
);
select is(
  (select count(*)::int
     from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid in ('public.daily_nudge_slot(uuid, timestamptz)'::regprocedure,
                    'public.record_daily_nudge(uuid, uuid, timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid)'::regprocedure)
      and acl.grantee = 0),
  0,
  'DAILY-NUDGE-003: none of the three is granted to PUBLIC'
);
select ok(
  has_function_privilege('service_role', 'public.daily_nudge_slot(uuid, timestamptz)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_daily_nudge(uuid, uuid, timestamptz)', 'EXECUTE'),
  'DAILY-NUDGE-004: service_role has EXECUTE on both internal functions'
);
select is(
  (select count(*)::int from pg_proc p
    where p.oid in ('public.daily_nudge_slot(uuid, timestamptz)'::regprocedure,
                    'public.record_daily_nudge(uuid, uuid, timestamptz)'::regprocedure,
                    'public.send_daily_nudge(uuid)'::regprocedure,
                    'public.daily_day_snapshot(uuid, uuid, timestamptz)'::regprocedure)
      and obj_description(p.oid, 'pg_proc') is not null),
  4,
  'DAILY-NUDGE-005: the three new functions and the snapshot carry a comment'
);
select is(
  (select string_agg(t.tgname || ' ' || p.proname || ' ' || t.tgenabled::text || ' ' || t.tgtype::text, ', ' order by t.tgname)
     from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.daily_nudges'::regclass and not t.tgisinternal),
  'daily_nudges_push_after_insert notify_push O 5',
  'DAILY-NUDGE-006: daily_nudges carries exactly the one notify_push trigger, AFTER INSERT FOR EACH ROW, enabled'
);
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'EXECUTE FUNCTION notify_push\(''daily_nudge''\)$'
      and pg_get_triggerdef(t.oid) !~ 'WHEN'
     from pg_trigger t where t.tgname = 'daily_nudges_push_after_insert'),
  'DAILY-NUDGE-007: the trigger has no WHEN and posts kind daily_nudge'
);

-- ============================================
-- daily_nudge_slot
-- ============================================
select pg_temp.mk('c', null);   -- no zone row: UTC
select pg_temp.mk('e', null);
select pg_temp.link('c', 'e');

select is(public.daily_nudge_slot(pg_temp.u('c'), timestamptz '2030-09-10 19:59:59+00'), 'after_pick',
  'DAILY-NUDGE-008: with no zone row the slot is after_pick at 19:59:59 UTC');
select is(public.daily_nudge_slot(pg_temp.u('c'), timestamptz '2030-09-10 20:00:00+00'), 'evening',
  'DAILY-NUDGE-009: and evening at 20:00:00 UTC');
select ok(
  public.daily_nudge_slot(null, now()) is null and public.daily_nudge_slot(pg_temp.u('c'), null) is null,
  'DAILY-NUDGE-010: a null sender or a null instant has no slot'
);

-- ============================================
-- The pair: a on UTC, b on New York (UTC-4 in September)
-- ============================================
select pg_temp.mk('a', 'UTC');
select pg_temp.mk('b', 'America/New_York', -240);
select pg_temp.link('a', 'b');
select pg_temp.mk('o', 'UTC');   -- another couple
select pg_temp.mk('d', 'UTC');
select pg_temp.link('o', 'd');
select pg_temp.mk('u', 'UTC');   -- unlinked

-- Open the days first: the stable snapshot cannot see a row the same statement inserts.
select pg_temp.day('a', 'b', date '2030-09-10');
select pg_temp.day('a', 'b', date '2030-09-12');

-- 2. No picks.
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 12:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-011: with no pick the snapshot has no slot and nothing spent');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10')),
  'DQ007', 'Pick before nudging',
  'DAILY-NUDGE-012: a nudge before the sender''s own pick is DQ007');
select is((select count(*)::int from public.daily_nudges where from_user in (pg_temp.u('a'), pg_temp.u('b'))), 0,
  'DAILY-NUDGE-013: and writes nothing');

-- 3. A picks; B's clock at 03:00 UTC still reads the day before.
select pg_temp.pick('a', 'b', date '2030-09-10', 'a');
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 03:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-014: while B''s own clock is still the day before, A has no slot');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-10 03:00:00+00')$$,
         pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10')),
  'DQ009', 'The day is not your partner''s current date',
  'DAILY-NUDGE-015: and a nudge then is DQ009');

-- 4. 12:00 UTC: A's clock 12:00, B's 08:00 on the day.
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 12:00:00+00'),
  '{"slot": "after_pick", "spent": false}'::jsonb,
  'DAILY-NUDGE-016: at A''s 12:00 the snapshot offers the after_pick slot, unspent');
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'b', timestamptz '2030-09-10 12:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-017: B, who has not picked, has no slot');
select set_config('tests.r', public.record_daily_nudge(pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10'),
  timestamptz '2030-09-10 12:00:00+00')::text, false);
select is((current_setting('tests.r')::jsonb) -> 'nudge', '{"slot": "after_pick", "spent": true}'::jsonb,
  'DAILY-NUDGE-018: the nudge returns the snapshot with the slot spent');
select is(
  (select n.to_user::text || ' ' || n.sender_local_date || ' ' || n.slot
     from public.daily_nudges n where n.from_user = pg_temp.u('a')),
  pg_temp.u('b')::text || ' 2030-09-10 after_pick',
  'DAILY-NUDGE-019: one row, to B, on A''s local date, in the after_pick slot');
select is(pg_temp.queued('a'), 'daily_nudge', 'DAILY-NUDGE-020: the row queued one daily_nudge call');
select is(
  (select array_agg(k order by k)
     from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text,
          jsonb_object_keys(convert_from(q.body, 'UTF8')::jsonb) k
    where n.from_user = pg_temp.u('a')),
  array['id', 'kind'],
  'DAILY-NUDGE-021: its body holds exactly the keys kind and id');
select results_eq(
  $$select distinct q.headers->>'x-push-secret', q.url
      from public.daily_nudges n
      join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
     where n.from_user = (select id from t_users where label = 'a')$$,
  $$values ('daily-nudge-test-secret'::text, 'http://sender.test/send-push'::text)$$,
  'DAILY-NUDGE-022: the call goes to the sender URL with the shared secret');

-- 5. The same slot again, then the evening slot on A's clock.
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 19:59:59+00'),
  '{"slot": "after_pick", "spent": true}'::jsonb,
  'DAILY-NUDGE-023: at 19:59:59 the slot is still after_pick and spent');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-10 19:59:59+00')$$,
         pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-024: a second nudge in the slot is DQ010');
select is((select count(*)::int from public.daily_nudges where from_user = pg_temp.u('a')), 1,
  'DAILY-NUDGE-025: and still one row');

-- B's clock reads 16:00 at this instant; the sender's clock decides the slot.
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 20:00:00+00'),
  '{"slot": "evening", "spent": false}'::jsonb,
  'DAILY-NUDGE-026: at A''s 20:00 (B''s 16:00) the snapshot offers the evening slot, unspent');
select set_config('tests.r', public.record_daily_nudge(pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10'),
  timestamptz '2030-09-10 20:00:00+00')::text, false);
select is((current_setting('tests.r')::jsonb) -> 'nudge', '{"slot": "evening", "spent": true}'::jsonb,
  'DAILY-NUDGE-027: the evening nudge returns the slot spent');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-10 21:00:00+00')$$,
         pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-028: a third nudge at 21:00 is DQ010');
select is(
  (select string_agg(n.slot, ', ' order by n.slot) from public.daily_nudges n where n.from_user = pg_temp.u('a')),
  'after_pick, evening',
  'DAILY-NUDGE-029: two rows, one per slot');
select is(pg_temp.queued('a'), 'daily_nudge, daily_nudge',
  'DAILY-NUDGE-030: two calls were queued, and the refusals queued none');

-- 6. B picks: the nudge is moot.
select pg_temp.pick('a', 'b', date '2030-09-10', 'b', true);
select is(pg_temp.nudge('a', 'b', date '2030-09-10', 'a', timestamptz '2030-09-10 12:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-031: once the partner has picked A has no slot, even for a slot already spent');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-10 12:00:00+00')$$,
         pg_temp.u('a'), pg_temp.day('a', 'b', date '2030-09-10')),
  'DQ008', 'Your partner has picked',
  'DAILY-NUDGE-032: and a nudge is DQ008');

-- 7. A sender whose clock is not UTC: B on 09-12, A (the recipient) on UTC.
select pg_temp.pick('a', 'b', date '2030-09-12', 'b');
select is(pg_temp.nudge('a', 'b', date '2030-09-12', 'b', timestamptz '2030-09-12 21:00:00+00'),
  '{"slot": "after_pick", "spent": false}'::jsonb,
  'DAILY-NUDGE-033: at 21:00 UTC B''s clock reads 17:00, so B''s slot is after_pick');
select lives_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-12 21:00:00+00')$$,
         pg_temp.u('b'), pg_temp.day('a', 'b', date '2030-09-12')),
  'DAILY-NUDGE-034: B nudges');
select is(
  (select n.sender_local_date || ' ' || n.slot || ' ' || (n.to_user = pg_temp.u('a'))::text
     from public.daily_nudges n where n.from_user = pg_temp.u('b')),
  '2030-09-12 after_pick true',
  'DAILY-NUDGE-035: the row carries B''s local date and B''s slot, to A');

-- The recipient's day is over: at 01:00 UTC on 09-13 B's clock still reads 21:00 on 09-12, A's is 09-13.
select is(pg_temp.nudge('a', 'b', date '2030-09-12', 'b', timestamptz '2030-09-13 01:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-049: once the partner''s date is the next day, B has no slot');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-13 01:00:00+00')$$,
         pg_temp.u('b'), pg_temp.day('a', 'b', date '2030-09-12')),
  'DQ009', 'The day is not your partner''s current date',
  'DAILY-NUDGE-050: and a nudge then is DQ009');

-- 8. Outsiders write nothing.
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-12 21:00:00+00')$$,
         pg_temp.u('o'), pg_temp.day('a', 'b', date '2030-09-12')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-036: a partnered caller outside the pair gets P0002');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-12 21:00:00+00')$$,
         pg_temp.u('u'), pg_temp.day('a', 'b', date '2030-09-12')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-037: an unlinked caller gets P0002');
select throws_ok(
  format($$select public.record_daily_nudge(%L, gen_random_uuid(), timestamptz '2030-09-12 21:00:00+00')$$,
         pg_temp.u('a')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-038: a day id no row has gets P0002');
select throws_ok(
  $$select public.record_daily_nudge(null, gen_random_uuid(), now())$$,
  'P0002', 'Day not found',
  'DAILY-NUDGE-039: a null viewer gets P0002');
select is(
  (select count(*)::int from public.daily_nudges where from_user in (pg_temp.u('o'), pg_temp.u('d'), pg_temp.u('u'))),
  0,
  'DAILY-NUDGE-040: and none of them wrote a row');

-- A pair that is no longer current: B's partner_id is cleared, so B has no slot and the day is not B's.
update public.users set partner_id = null where id = pg_temp.u('b');
select is(pg_temp.nudge('a', 'b', date '2030-09-12', 'b', timestamptz '2030-09-12 21:00:00+00'),
  '{"slot": null, "spent": false}'::jsonb,
  'DAILY-NUDGE-051: with no current partner_id the snapshot has no slot');
select throws_ok(
  format($$select public.record_daily_nudge(%L, %L, timestamptz '2030-09-12 21:00:00+00')$$,
         pg_temp.u('b'), pg_temp.day('a', 'b', date '2030-09-12')),
  'P0002', 'Day not found',
  'DAILY-NUDGE-052: and a nudge is P0002');
update public.users set partner_id = pg_temp.u('a') where id = pg_temp.u('b');

-- ============================================
-- The client RPC, on a pair with no zone row (UTC, today's UTC date)
-- ============================================
select pg_temp.pick('c', 'e', (now() at time zone 'UTC')::date, 'c');
select set_config('tests.cday', pg_temp.day('c', 'e', (now() at time zone 'UTC')::date)::text, false);

select tests.authenticate_as(pg_temp.u('c'));
select set_config('tests.c_res', public.send_daily_nudge(current_setting('tests.cday')::uuid)::text, false);
reset role;

select is((current_setting('tests.c_res')::jsonb) #>> '{nudge,spent}', 'true',
  'DAILY-NUDGE-041: send_daily_nudge answers with the slot spent');
select is((current_setting('tests.c_res')::jsonb) #>> '{nudge,slot}',
  public.daily_nudge_slot(pg_temp.u('c'), now()),
  'DAILY-NUDGE-042: in the slot daily_nudge_slot gives for now()');
select is(
  (select n.slot from public.daily_nudges n where n.from_user = pg_temp.u('c')),
  public.daily_nudge_slot(pg_temp.u('c'), now()),
  'DAILY-NUDGE-043: and one row exists, in that slot');

select tests.authenticate_as(pg_temp.u('c'));
select throws_ok(
  format($$select public.send_daily_nudge(%L)$$, current_setting('tests.cday')),
  'DQ010', 'Nudge already sent',
  'DAILY-NUDGE-044: sending again is DQ010');
reset role;

select tests.authenticate_as(pg_temp.u('e'));
select throws_ok(
  format($$select public.send_daily_nudge(%L)$$, current_setting('tests.cday')),
  'DQ007', 'Pick before nudging',
  'DAILY-NUDGE-045: the partner who has not picked is DQ007');
reset role;

select is(
  (select count(*)::int from public.daily_nudges where from_user in (pg_temp.u('c'), pg_temp.u('e'))),
  1,
  'DAILY-NUDGE-046: the refusals added no row');
select is(pg_temp.queued('c'), 'daily_nudge', 'DAILY-NUDGE-047: the one row queued one call');

-- Every nudge row, however it was written, queued one call.
select is(
  (select count(*)::int from public.daily_nudges n
     join net.http_request_queue q on convert_from(q.body, 'UTF8')::jsonb->>'id' = n.id::text
    where n.from_user in (pg_temp.u('a'), pg_temp.u('b'), pg_temp.u('c'))),
  4,
  'DAILY-NUDGE-048: every row of this file queued exactly one call');

select * from finish();
rollback;
