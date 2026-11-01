-- ============================================
-- pgTAP: push_devices, push_requests, push_sender_settings, register_push_device
-- and the love-note push trigger (20261031000000); unregister_push_device
-- (20261031010000); the mood, photo and interaction triggers and the
-- one-source check on push_requests (20261031020000); the date_changes log, its
-- five triggers and the fifth push_requests source (20261031030000)
--
-- Pinned here: the exact policy sets (a policy added, renamed or dropped fails
-- this file), who can touch each table, the register RPC (reassignment by
-- token, bad environment, no session), the unregister RPC (own row only, no
-- session, anon), and the trigger -- it queues exactly one
-- pg_net call per new note with the note id and the shared secret, does nothing
-- without settings, fires nothing for an insert ignored as a duplicate, and
-- cannot fail the insert.
--
-- net.http_post only queues the call in net.http_request_queue inside the
-- caller's transaction, so the queue rows are read back here. Nothing is sent.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(94);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Push ' || left(test_email, 4))
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

create temporary table t_ids as
select
  tests.create_test_user('push-a@example.com') as a_id,
  tests.create_test_user('push-b@example.com') as b_id;

grant select on t_ids to authenticated, anon;

-- ============================================
-- Structure, RLS and policy sets
-- ============================================
select has_table('public', 'push_devices', 'PUSH-DB-001: push_devices exists');
select has_table('public', 'push_requests', 'PUSH-DB-002: push_requests exists');
select has_table('public', 'push_sender_settings', 'PUSH-DB-003: push_sender_settings exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.push_devices'::regclass, 'public.push_requests'::regclass, 'public.push_sender_settings'::regclass)),
  'PUSH-DB-004: RLS is enabled on all three push tables'
);

select policies_are(
  'public', 'push_devices',
  array['Users can view own push devices'],
  'PUSH-DB-005: push_devices carries exactly the owner SELECT policy'
);
select policies_are('public', 'push_requests', array[]::text[],
  'PUSH-DB-006: push_requests carries no policies');
select policies_are('public', 'push_sender_settings', array[]::text[],
  'PUSH-DB-007: push_sender_settings carries no policies');

select is(
  (select roles::text from pg_policies where tablename = 'push_devices'),
  '{authenticated}',
  'PUSH-DB-008: the push_devices policy is TO authenticated'
);

select ok(
  not has_table_privilege('anon', 'public.push_devices', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated', 'public.push_devices', 'INSERT, UPDATE, DELETE'),
  'PUSH-DB-009: push_devices is read-only to authenticated and closed to anon'
);

select ok(
  not has_table_privilege('authenticated', 'public.push_requests', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('anon', 'public.push_requests', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated', 'public.push_sender_settings', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('anon', 'public.push_sender_settings', 'SELECT, INSERT, UPDATE, DELETE'),
  'PUSH-DB-010: push_requests and push_sender_settings are closed to anon and authenticated'
);

select ok(
  has_table_privilege('service_role', 'public.push_requests', 'SELECT, INSERT, DELETE')
  and has_table_privilege('service_role', 'public.push_devices', 'SELECT')
  and has_table_privilege('service_role', 'public.push_sender_settings', 'SELECT'),
  'PUSH-DB-011: service_role (the sender) can use all three'
);

select ok(
  not has_function_privilege('anon', 'public.register_push_device(text, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.register_push_device(text, text)', 'EXECUTE'),
  'PUSH-DB-012: register_push_device is for authenticated only'
);

select ok(
  not has_function_privilege('authenticated', 'public.notify_love_note_push()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.notify_love_note_push()', 'EXECUTE'),
  'PUSH-DB-013: the trigger function is not callable from the API'
);

-- ============================================
-- register_push_device
-- ============================================
select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$select public.register_push_device('token-one', 'sandbox')$$,
  'PUSH-DB-014: a signed-in user registers a device'
);
select lives_ok(
  $$select public.register_push_device('token-two', 'production')$$,
  'PUSH-DB-015: a second device registers'
);

select results_eq(
  $$select token, environment from public.push_devices order by token$$,
  $$values ('token-one', 'sandbox'), ('token-two', 'production')$$,
  'PUSH-DB-016: the owner reads back both devices with their environments'
);

select throws_ok(
  $$select public.register_push_device('token-bad', 'staging')$$,
  '23514',
  null,
  'PUSH-DB-017: an unknown environment is refused by the check constraint'
);

select throws_ok(
  $$insert into public.push_devices (user_id, token, environment) values (auth.uid(), 'token-direct', 'sandbox')$$,
  '42501',
  null,
  'PUSH-DB-018: a client cannot insert a device directly'
);

-- Registering the same token again from the same device updates, not duplicates.
select lives_ok(
  $$select public.register_push_device('token-one', 'production')$$,
  'PUSH-DB-019: registering a token again succeeds'
);
select results_eq(
  $$select count(*)::int, min(environment) filter (where token = 'token-one') from public.push_devices$$,
  $$values (2, 'production')$$,
  'PUSH-DB-020: it stays one row and takes the new environment'
);

-- The other account registers the same token: the row moves to it.
select tests.authenticate_as((select b_id from t_ids));
select lives_ok(
  $$select public.register_push_device('token-one', 'sandbox')$$,
  'PUSH-DB-021: another account registers a token the first holds'
);
select results_eq(
  $$select token from public.push_devices order by token$$,
  $$values ('token-one')$$,
  'PUSH-DB-022: the row now belongs to the second account, and the first account''s other token is not visible to it'
);
reset role;
select is(
  (select user_id from public.push_devices where token = 'token-one'),
  (select b_id from t_ids),
  'PUSH-DB-023: token-one is owned by the second account only'
);

select tests.authenticate_as((select a_id from t_ids));
select results_eq(
  $$select token from public.push_devices order by token$$,
  $$values ('token-two')$$,
  'PUSH-DB-024: the first account keeps only token-two'
);

select tests.clear_jwt();
select throws_ok(
  $$select public.register_push_device('token-x', 'sandbox')$$,
  'Authentication required',
  'PUSH-DB-025: a NULL auth.uid() is refused'
);
reset role;

-- ============================================
-- unregister_push_device (20261031010000)
-- ============================================
-- Here the second account owns token-one and the first owns token-two.
select ok(
  not has_function_privilege('anon', 'public.unregister_push_device(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.unregister_push_device(text)', 'EXECUTE'),
  'PUSH-DB-034: unregister_push_device is for authenticated only'
);

select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$select public.unregister_push_device('token-one')$$,
  'PUSH-DB-035: unregistering another account''s token does not raise'
);
reset role;
select is(
  (select user_id from public.push_devices where token = 'token-one'),
  (select b_id from t_ids),
  'PUSH-DB-036: and the other account''s row is untouched'
);

select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$select public.unregister_push_device('token-two')$$,
  'PUSH-DB-037: a signed-in user unregisters their own device'
);
reset role;
select is(
  (select count(*)::int from public.push_devices where token = 'token-two'),
  0,
  'PUSH-DB-038: their row is gone'
);

select tests.authenticate_as((select b_id from t_ids));
select tests.clear_jwt();
select throws_ok(
  $$select public.unregister_push_device('token-one')$$,
  'Authentication required',
  'PUSH-DB-039: a NULL auth.uid() is refused'
);
reset role;

select set_config('role', 'anon', true);
select throws_ok(
  $$select public.unregister_push_device('token-one')$$,
  '42501',
  null,
  'PUSH-DB-040: anon cannot call it'
);
reset role;
select is(
  (select count(*)::int from public.push_devices where token = 'token-one'),
  1,
  'PUSH-DB-041: the refused calls removed nothing'
);

-- ============================================
-- The trigger
-- ============================================
-- No settings: nothing is queued.
delete from public.push_sender_settings;
delete from net.http_request_queue;

insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
select a_id, b_id, 'no settings', 'k-none' from t_ids;

select is(
  (select count(*)::int from net.http_request_queue),
  0,
  'PUSH-DB-026: with no sender settings the trigger queues nothing'
);

insert into public.push_sender_settings (sender_url, sender_secret)
values ('http://sender.test/send-push', 'trigger-test-secret-1234');

-- One call per new note, carrying the note's id and the secret, as the sender
-- expects.
insert into public.love_notes (id, from_user_id, to_user_id, content, idempotency_key)
select '99999999-0000-4000-8000-000000000001', a_id, b_id, 'hello', 'k-one' from t_ids;

select results_eq(
  $$select url, convert_from(body, 'UTF8')::jsonb, headers->>'x-push-secret'
      from net.http_request_queue$$,
  $$values ('http://sender.test/send-push'::text,
            '{"note_id": "99999999-0000-4000-8000-000000000001"}'::jsonb,
            'trigger-test-secret-1234'::text)$$,
  'PUSH-DB-027: a new note queues one call with its id and the shared secret'
);

-- A retried upsert ignored as a duplicate fires nothing.
insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
select a_id, b_id, 'hello again', 'k-one' from t_ids
on conflict (from_user_id, idempotency_key) do nothing;

select is(
  (select count(*)::int from net.http_request_queue),
  1,
  'PUSH-DB-028: an insert ignored as a duplicate queues no second call'
);
select is(
  (select count(*)::int from public.love_notes where idempotency_key = 'k-one'),
  1,
  'PUSH-DB-029: and the duplicate left one row'
);

-- A failing sender call never fails the insert: an empty URL makes
-- net.http_post raise "invalid URL".
update public.push_sender_settings set sender_url = '';

select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
    select a_id, b_id, 'still lands', 'k-two' from t_ids$$,
  'PUSH-DB-030: the insert succeeds when the pg_net call itself raises'
);

update public.push_sender_settings set sender_url = 'http://sender.test/send-push';

select is(
  (select count(*)::int from public.love_notes where idempotency_key = 'k-two'),
  1,
  'PUSH-DB-031: and the note is committed'
);

select is(
  (select count(*)::int from net.http_request_queue),
  1,
  'PUSH-DB-032: the queue holds only the one call from the good insert'
);

-- Deleting a note takes its recorded requests with it.
insert into public.push_requests (note_id, token, environment, payload, delivery)
values ('99999999-0000-4000-8000-000000000001', 'token-two', 'production', '{"aps":{}}', 'recorded');
delete from public.love_notes where id = '99999999-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.push_requests
    where note_id = '99999999-0000-4000-8000-000000000001'),
  0,
  'PUSH-DB-033: deleting a note deletes its recorded requests'
);

-- ============================================
-- Moods, photos and interactions (20261031020000, story 3.4)
-- ============================================
-- notify_push() posts {kind, id}; the love-note trigger is untouched.
select ok(
  not has_function_privilege('authenticated', 'public.notify_push()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.notify_push()', 'EXECUTE')
  and not has_function_privilege('public', 'public.notify_push()', 'EXECUTE'),
  'PUSH-DB-042: notify_push() is executable by no API role'
);

select is(
  (select count(*)::int from pg_trigger
    where tgname in ('moods_push_after_insert', 'photos_push_after_insert', 'interactions_push_after_insert')
      and tgenabled = 'O'),
  3,
  'PUSH-DB-043: the mood, photo and interaction triggers exist and are enabled'
);

delete from net.http_request_queue;

-- A new mood queues one call with its kind and id, and the shared secret.
insert into public.moods (id, user_id, mood_type, mood_types, created_at)
select '99999999-0000-4000-8000-000000000011', a_id, 'happy', array['happy', 'grateful'], '2026-10-31 12:00:00+00' from t_ids;

select results_eq(
  $$select url, convert_from(body, 'UTF8')::jsonb, headers->>'x-push-secret'
      from net.http_request_queue$$,
  $$values ('http://sender.test/send-push'::text,
            '{"kind": "mood", "id": "99999999-0000-4000-8000-000000000011"}'::jsonb,
            'trigger-test-secret-1234'::text)$$,
  'PUSH-DB-044: a new mood queues one {kind, id} call with the shared secret'
);

-- The same (user_id, created_at) upserted again takes the DO UPDATE path:
-- the row changes, no INSERT trigger fires, no second call is queued.
insert into public.moods (user_id, mood_type, mood_types, note, created_at)
select a_id, 'sad', array['sad'], 'edited', '2026-10-31 12:00:00+00' from t_ids
on conflict (user_id, created_at) do update
  set mood_type = excluded.mood_type, mood_types = excluded.mood_types, note = excluded.note;

select is(
  (select count(*)::int from net.http_request_queue),
  1,
  'PUSH-DB-045: a mood re-sent with the same (user_id, created_at) queues no second call'
);
select results_eq(
  $$select mood_type, note from public.moods where id = '99999999-0000-4000-8000-000000000011'$$,
  $$values ('sad'::text, 'edited'::text)$$,
  'PUSH-DB-046: and the re-sent mood did update the existing row'
);

-- A plain UPDATE pushes nothing either.
update public.moods set note = 'edited again' where id = '99999999-0000-4000-8000-000000000011';
select is(
  (select count(*)::int from net.http_request_queue),
  1,
  'PUSH-DB-047: updating a mood queues nothing'
);

-- A new photo queues one call; a retry ignored on storage_path queues none.
insert into public.photos (id, user_id, storage_path, filename, file_size, width, height)
select '99999999-0000-4000-8000-000000000012', a_id, 'push-test/one.jpg', 'one.jpg', 1000, 10, 10 from t_ids;

select results_eq(
  $$select convert_from(body, 'UTF8')::jsonb from net.http_request_queue
     where convert_from(body, 'UTF8')::jsonb->>'kind' = 'photo'$$,
  $$values ('{"kind": "photo", "id": "99999999-0000-4000-8000-000000000012"}'::jsonb)$$,
  'PUSH-DB-048: a new photo queues one {kind, id} call'
);

insert into public.photos (user_id, storage_path, filename, file_size, width, height)
select a_id, 'push-test/one.jpg', 'one.jpg', 1000, 10, 10 from t_ids
on conflict (storage_path) do nothing;

select is(
  (select count(*)::int from net.http_request_queue),
  2,
  'PUSH-DB-049: a photo insert ignored on storage_path queues no second call'
);

-- A new interaction queues one call.
insert into public.interactions (id, from_user_id, to_user_id, type)
select '99999999-0000-4000-8000-000000000013', a_id, b_id, 'poke' from t_ids;

select results_eq(
  $$select convert_from(body, 'UTF8')::jsonb from net.http_request_queue
     where convert_from(body, 'UTF8')::jsonb->>'kind' = 'interaction'$$,
  $$values ('{"kind": "interaction", "id": "99999999-0000-4000-8000-000000000013"}'::jsonb)$$,
  'PUSH-DB-050: a new interaction queues one {kind, id} call'
);

-- A failing sender call never fails a mood, photo or interaction insert.
update public.push_sender_settings set sender_url = '';

select lives_ok(
  $$insert into public.moods (user_id, mood_type, created_at)
      select a_id, 'tired', '2026-10-31 13:00:00+00' from t_ids;
    insert into public.photos (user_id, storage_path, filename, file_size, width, height)
      select a_id, 'push-test/two.jpg', 'two.jpg', 1000, 10, 10 from t_ids;
    insert into public.interactions (from_user_id, to_user_id, type)
      select a_id, b_id, 'kiss' from t_ids$$,
  'PUSH-DB-051: the inserts succeed when the pg_net call itself raises'
);

update public.push_sender_settings set sender_url = 'http://sender.test/send-push';

select is(
  (select count(*)::int from public.moods
    where user_id = (select a_id from t_ids) and created_at = '2026-10-31 13:00:00+00')
  + (select count(*)::int from public.photos where storage_path = 'push-test/two.jpg')
  + (select count(*)::int from public.interactions
    where from_user_id = (select a_id from t_ids) and type = 'kiss'),
  3,
  'PUSH-DB-052: and all three rows are committed'
);

-- push_requests takes exactly one source.
select lives_ok(
  $$insert into public.push_requests (mood_id, token, environment, payload, delivery)
      values ('99999999-0000-4000-8000-000000000011', 'token-m', 'sandbox', '{"aps":{}}', 'recorded');
    insert into public.push_requests (photo_id, token, environment, payload, delivery)
      values ('99999999-0000-4000-8000-000000000012', 'token-p', 'sandbox', '{"aps":{}}', 'recorded');
    insert into public.push_requests (interaction_id, token, environment, payload, delivery)
      values ('99999999-0000-4000-8000-000000000013', 'token-i', 'sandbox', '{"aps":{}}', 'recorded')$$,
  'PUSH-DB-053: a request can belong to a mood, a photo or an interaction'
);

select throws_ok(
  $$insert into public.push_requests (token, environment, payload, delivery)
      values ('token-none', 'sandbox', '{"aps":{}}', 'recorded')$$,
  '23514',
  null,
  'PUSH-DB-054: a request with no source id is refused'
);

select throws_ok(
  $$insert into public.push_requests (mood_id, photo_id, token, environment, payload, delivery)
      values ('99999999-0000-4000-8000-000000000011', '99999999-0000-4000-8000-000000000012',
              'token-both', 'sandbox', '{"aps":{}}', 'recorded')$$,
  '23514',
  null,
  'PUSH-DB-055: a request with two source ids is refused'
);

select throws_ok(
  $$insert into public.push_requests (mood_id, token, environment, payload, delivery)
      values ('99999999-0000-4000-8000-000000000011', 'token-m', 'sandbox', '{"aps":{}}', 'recorded')$$,
  '23505',
  null,
  'PUSH-DB-056: the same mood and device token cannot be claimed twice'
);

-- Deleting the source row deletes its requests.
delete from public.moods where id = '99999999-0000-4000-8000-000000000011';
delete from public.photos where id = '99999999-0000-4000-8000-000000000012';
delete from public.interactions where id = '99999999-0000-4000-8000-000000000013';
select is(
  (select count(*)::int from public.push_requests where token in ('token-m', 'token-p', 'token-i')),
  0,
  'PUSH-DB-057: deleting a mood, photo or interaction deletes its recorded requests'
);

-- ============================================
-- Date changes (20261031030000, story 3.5)
-- ============================================
-- notify_date_change() logs each push-worthy change in date_changes and posts
-- {kind: 'date', id: <change id>}. Helpers and fixtures first.
create temporary table t_pair as
select least(a_id, b_id) as lo, greatest(a_id, b_id) as hi from t_ids;
grant select on t_pair to authenticated, anon;

create temporary table t_c as select tests.create_test_user('push-c@example.com') as c_id;

-- The queued call count and every non-event change by this file's three accounts (the
-- database is shared, so other rows are ignored), as 'N | subject action who, ...'.
create or replace function tests.date_state()
returns text language sql as $$
  select (select count(*) from net.http_request_queue)::text || ' | ' || coalesce(
    (select string_agg(s, ', ' order by s) from (
       select c.subject || ' ' || c.action || ' ' ||
              case c.sender_id when (select a_id from t_ids) then 'a'
                               when (select b_id from t_ids) then 'b' else 'c' end as s
         from public.date_changes c
        where c.subject <> 'event'
          and c.sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c)) q), '');
$$;

-- The two accounts are partners (set as superuser: users.partner_id has no client write).
update public.users set partner_id = (select b_id from t_ids) where id = (select a_id from t_ids);
update public.users set partner_id = (select a_id from t_ids) where id = (select b_id from t_ids);

select has_table('public', 'date_changes', 'PUSH-DB-058: date_changes exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.date_changes'::regclass),
  'PUSH-DB-059: RLS is enabled on date_changes'
);
select policies_are('public', 'date_changes', array[]::text[],
  'PUSH-DB-060: date_changes carries no policies');

select ok(
  not has_table_privilege('anon', 'public.date_changes', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated', 'public.date_changes', 'SELECT, INSERT, UPDATE, DELETE')
  and has_table_privilege('service_role', 'public.date_changes', 'SELECT'),
  'PUSH-DB-061: date_changes is closed to anon and authenticated, readable by the sender (service_role)'
);

select ok(
  not has_function_privilege('authenticated', 'public.notify_date_change()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.notify_date_change()', 'EXECUTE')
  and not has_function_privilege('public', 'public.notify_date_change()', 'EXECUTE'),
  'PUSH-DB-062: notify_date_change() is executable by no API role'
);

select is(
  (select count(*)::int from pg_trigger
    where tgname in ('events_push_after_insert', 'events_push_after_update',
                     'couple_settings_push_after_insert', 'couple_settings_push_after_update',
                     'users_push_after_birthday')
      and tgenabled = 'O'),
  5,
  'PUSH-DB-063: the five date triggers exist and are enabled'
);

-- ---- events ----
delete from net.http_request_queue;

insert into public.events (id, user_id, label, event_date)
select '99999999-0000-4000-8000-000000000021', a_id, 'Paris trip', '2027-05-01' from t_ids;

select results_eq(
  $$select url, convert_from(body, 'UTF8')::jsonb, headers->>'x-push-secret' from net.http_request_queue$$,
  $$select 'http://sender.test/send-push'::text, jsonb_build_object('kind', 'date', 'id', c.id),
           'trigger-test-secret-1234'::text
      from public.date_changes c where c.event_id = '99999999-0000-4000-8000-000000000021'$$,
  'PUSH-DB-064: a new event queues one {kind: date, id} call naming its logged change'
);

select results_eq(
  $$select subject, action, sender_id from public.date_changes
     where event_id = '99999999-0000-4000-8000-000000000021'$$,
  $$select 'event'::text, 'added'::text, a_id from t_ids$$,
  'PUSH-DB-065: and the change is logged as the creator adding the event'
);

-- A save that changes only updated_at, or rewrites the same values, logs nothing.
update public.events set updated_at = now() + interval '1 minute'
 where id = '99999999-0000-4000-8000-000000000021';
update public.events
   set label = 'Paris trip', event_date = '2027-05-01', description = null, icon = 'calendar',
       updated_at = now() + interval '2 minutes'
 where id = '99999999-0000-4000-8000-000000000021';

select results_eq(
  $$select (select count(*)::int from net.http_request_queue),
           (select count(*)::int from public.date_changes where event_id = '99999999-0000-4000-8000-000000000021')$$,
  $$values (1, 1)$$,
  'PUSH-DB-066: updated_at alone, or the same label, date, description and icon, logs and queues nothing'
);

update public.events set event_date = '2027-05-02' where id = '99999999-0000-4000-8000-000000000021';

select results_eq(
  $$select (select count(*)::int from net.http_request_queue),
           (select count(*)::int from public.date_changes
             where event_id = '99999999-0000-4000-8000-000000000021' and action = 'changed')$$,
  $$values (2, 1)$$,
  'PUSH-DB-067: changing the event date logs a change and queues a call'
);

update public.events set label = 'Rome trip' where id = '99999999-0000-4000-8000-000000000021';
update public.events set description = 'Flights booked' where id = '99999999-0000-4000-8000-000000000021';
update public.events set icon = 'plane' where id = '99999999-0000-4000-8000-000000000021';

select results_eq(
  $$select (select count(*)::int from net.http_request_queue),
           (select count(*)::int from public.date_changes where event_id = '99999999-0000-4000-8000-000000000021'),
           (select count(*)::int from public.date_changes
             where event_id = '99999999-0000-4000-8000-000000000021' and action = 'changed')$$,
  $$values (5, 5, 4)$$,
  'PUSH-DB-068: a changed label, description or icon each log a change too'
);

-- No trigger exists on anniversaries.
insert into public.anniversaries (user_id, label, event_date)
select a_id, 'First date', '2026-01-01' from t_ids;

select is(
  (select count(*)::int from net.http_request_queue),
  5,
  'PUSH-DB-069: an anniversary write queues nothing'
);

-- push_requests takes a date change as its fifth source.
select lives_ok(
  $$insert into public.push_requests (date_change_id, token, environment, payload, delivery)
      select c.id, 'token-d', 'sandbox', '{"aps":{}}', 'recorded'
        from public.date_changes c
       where c.event_id = '99999999-0000-4000-8000-000000000021' limit 1$$,
  'PUSH-DB-070: a request can belong to a date change'
);

select throws_ok(
  $$insert into public.push_requests (note_id, date_change_id, token, environment, payload, delivery)
      select gen_random_uuid(), c.id, 'token-two-src', 'sandbox', '{"aps":{}}', 'recorded'
        from public.date_changes c
       where c.event_id = '99999999-0000-4000-8000-000000000021' limit 1$$,
  '23514',
  null,
  'PUSH-DB-071: a request with a date change and another source is refused'
);

select throws_ok(
  $$insert into public.push_requests (date_change_id, token, environment, payload, delivery)
      select c.id, 'token-d', 'sandbox', '{"aps":{}}', 'recorded'
        from public.date_changes c
       where c.event_id = '99999999-0000-4000-8000-000000000021' limit 1$$,
  '23505',
  null,
  'PUSH-DB-072: the same date change and device token cannot be claimed twice'
);

-- Deleting the event takes its changes and their requests with it, and pushes nothing.
delete from public.events where id = '99999999-0000-4000-8000-000000000021';

select results_eq(
  $$select (select count(*)::int from public.push_requests where token = 'token-d'),
           (select count(*)::int from public.date_changes where event_id = '99999999-0000-4000-8000-000000000021'),
           (select count(*)::int from net.http_request_queue)$$,
  $$values (0, 0, 5)$$,
  'PUSH-DB-073: deleting an event deletes its changes and requests and queues nothing'
);

-- ---- couple_settings ----
-- The writer is auth.uid(); the row does not record it.
delete from net.http_request_queue;

select tests.authenticate_as((select a_id from t_ids));
insert into public.couple_settings (user_a, user_b, wedding_date)
select lo, hi, '2027-06-12' from t_pair;
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '1 | wedding_date added a',
  'PUSH-DB-074: a first couple write with a wedding date logs that date as added by the writer');

select tests.authenticate_as((select a_id from t_ids));
update public.couple_settings set wedding_date = '2027-06-13' where user_a = (select lo from t_pair);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | wedding_date added a, wedding_date changed a',
  'PUSH-DB-075: a different wedding date logs a change');

select tests.authenticate_as((select a_id from t_ids));
update public.couple_settings set wedding_date = null where user_a = (select lo from t_pair);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | wedding_date added a, wedding_date changed a',
  'PUSH-DB-076: clearing the wedding date logs and queues nothing');

select tests.authenticate_as((select b_id from t_ids));
update public.couple_settings set relationship_start = '2026-01-01 00:00:00+00' where user_a = (select lo from t_pair);
reset role;
select tests.clear_jwt();
select is(tests.date_state(),
  '3 | relationship_start added b, wedding_date added a, wedding_date changed a',
  'PUSH-DB-077: the partner setting the start date on an existing row is logged under the partner');

select tests.authenticate_as((select a_id from t_ids));
update public.couple_settings set relationship_start = '2026-02-02 00:00:00+00' where user_a = (select lo from t_pair);
reset role;
select tests.clear_jwt();
select is(tests.date_state(),
  '4 | relationship_start added b, relationship_start changed a, wedding_date added a, wedding_date changed a',
  'PUSH-DB-078: a different start date logs a change');

select tests.authenticate_as((select a_id from t_ids));
update public.couple_settings
   set updated_at = now() + interval '1 minute', relationship_start = relationship_start
 where user_a = (select lo from t_pair);
reset role;
select tests.clear_jwt();
select is(tests.date_state(),
  '4 | relationship_start added b, relationship_start changed a, wedding_date added a, wedding_date changed a',
  'PUSH-DB-079: updated_at alone, or the same start date, logs nothing');

-- A write with no session (the service role) and one by a non-member log nothing.
update public.couple_settings set wedding_date = '2027-07-01' where user_a = (select lo from t_pair);
select is(tests.date_state(),
  '4 | relationship_start added b, relationship_start changed a, wedding_date added a, wedding_date changed a',
  'PUSH-DB-080: a couple write with no session logs nothing');

select set_config('request.jwt.claims',
  json_build_object('sub', (select c_id from t_c)::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
update public.couple_settings set wedding_date = '2027-07-02' where user_a = (select lo from t_pair);
select tests.clear_jwt();
select is(tests.date_state(),
  '4 | relationship_start added b, relationship_start changed a, wedding_date added a, wedding_date changed a',
  'PUSH-DB-081: a couple write by an account outside the pair logs nothing');

-- An insert carrying both dates logs one change per date.
delete from net.http_request_queue;
delete from public.date_changes
 where subject <> 'event'
   and sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c);
delete from public.couple_settings where user_a = (select lo from t_pair);

select tests.authenticate_as((select a_id from t_ids));
insert into public.couple_settings (user_a, user_b, relationship_start, wedding_date)
select lo, hi, '2026-01-01 00:00:00+00', '2027-06-12' from t_pair;
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | relationship_start added a, wedding_date added a',
  'PUSH-DB-082: an insert carrying both dates logs and queues one change per date');

-- ---- birthdays ----
delete from net.http_request_queue;
delete from public.date_changes
 where subject <> 'event'
   and sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c);

select tests.authenticate_as((select a_id from t_ids));
update public.users set birthday = '1990-05-01' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '1 | birthday added a',
  'PUSH-DB-083: setting a birthday logs it as added by its owner');

select tests.authenticate_as((select a_id from t_ids));
update public.users set birthday = '1990-05-01' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '1 | birthday added a',
  'PUSH-DB-084: saving the same birthday again logs nothing');

select tests.authenticate_as((select a_id from t_ids));
update public.users set birthday = '1990-05-02' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | birthday added a, birthday changed a',
  'PUSH-DB-085: a different birthday logs a change');

select tests.authenticate_as((select a_id from t_ids));
update public.users set birthday = null where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | birthday added a, birthday changed a',
  'PUSH-DB-086: clearing the birthday logs and queues nothing');

select tests.authenticate_as((select a_id from t_ids));
update public.users set display_name = 'Casey' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '2 | birthday added a, birthday changed a',
  'PUSH-DB-087: an update that does not touch the birthday logs nothing');

select tests.authenticate_as((select a_id from t_ids));
update public.users set birthday = '1990-05-03' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();
select is(tests.date_state(), '3 | birthday added a, birthday added a, birthday changed a',
  'PUSH-DB-088: a birthday set again after being cleared is added again');

-- ---- no settings, and a failing call ----
-- Every trigger is checked: an event, a couple write by a pair member and a birthday.
delete from public.push_sender_settings;
delete from net.http_request_queue;
delete from public.date_changes
 where sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c);
delete from public.couple_settings where user_a = (select lo from t_pair);

insert into public.events (id, user_id, label, event_date)
select '99999999-0000-4000-8000-000000000022', a_id, 'No settings', '2027-05-01' from t_ids;

select tests.authenticate_as((select a_id from t_ids));
insert into public.couple_settings (user_a, user_b, relationship_start, wedding_date)
select lo, hi, '2026-01-01 00:00:00+00', '2027-06-12' from t_pair;
update public.users set birthday = '1990-06-01' where id = (select a_id from t_ids);
reset role;
select tests.clear_jwt();

select results_eq(
  $$select tests.date_state(),
           (select count(*)::int from public.date_changes
             where sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c))$$,
  $$values ('0 | '::text, 0)$$,
  'PUSH-DB-089: with no sender settings an event, a couple write and a birthday log and queue nothing'
);

insert into public.push_sender_settings (sender_url, sender_secret)
values ('', 'trigger-test-secret-1234');
delete from public.couple_settings where user_a = (select lo from t_pair);

select lives_ok(
  $$insert into public.events (id, user_id, label, event_date)
      select '99999999-0000-4000-8000-000000000023', a_id, 'Still lands', '2027-05-01' from t_ids$$,
  'PUSH-DB-090: an event insert succeeds when the pg_net call itself raises'
);

select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$insert into public.couple_settings (user_a, user_b, relationship_start, wedding_date)
      select lo, hi, '2026-01-01 00:00:00+00', '2027-06-12' from t_pair$$,
  'PUSH-DB-091: a couple write succeeds when the pg_net call itself raises'
);
select lives_ok(
  $$update public.users set birthday = '1990-06-02' where id = (select a_id from t_ids)$$,
  'PUSH-DB-092: a birthday write succeeds when the pg_net call itself raises'
);
reset role;
select tests.clear_jwt();

select results_eq(
  $$select (select count(*)::int from public.events where id = '99999999-0000-4000-8000-000000000023'),
           (select count(*)::int from public.couple_settings
             where user_a = (select lo from t_pair) and wedding_date = '2027-06-12'),
           (select birthday from public.users where id = (select a_id from t_ids))$$,
  $$values (1, 1, '1990-06-02'::date)$$,
  'PUSH-DB-093: and the event, the couple row and the birthday are committed'
);

-- The raising post rolls back the change rows logged in the same call.
select results_eq(
  $$select (select count(*)::int from public.date_changes where event_id = '99999999-0000-4000-8000-000000000023'),
           (select count(*)::int from public.date_changes
             where sender_id in (select a_id from t_ids union select b_id from t_ids union select c_id from t_c))$$,
  $$values (0, 0)$$,
  'PUSH-DB-094: and no change row survives for those writes'
);

select * from finish();
rollback;
