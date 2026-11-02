-- ============================================
-- pgTAP: unregister_all_push_devices (20261102000000)
--
-- Pinned here: the grant (authenticated yes, anon no), that it deletes every
-- row the caller owns and none of another account's, that a NULL auth.uid()
-- is refused, that anon gets 42501, and that the refused calls delete nothing.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(9);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'All ' || left(test_email, 4))
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
  tests.create_test_user('push-all-a@example.com') as a_id,
  tests.create_test_user('push-all-b@example.com') as b_id;

grant select on t_ids to authenticated, anon;

-- Two devices for the first account, one for the second.
insert into public.push_devices (user_id, token, environment)
select a_id, 'all-token-one', 'sandbox' from t_ids
union all
select a_id, 'all-token-two', 'production' from t_ids
union all
select b_id, 'all-token-three', 'sandbox' from t_ids;

select ok(
  not has_function_privilege('anon', 'public.unregister_all_push_devices()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.unregister_all_push_devices()', 'EXECUTE'),
  'PUSH-ALL-001: unregister_all_push_devices is for authenticated only'
);

select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$select public.unregister_all_push_devices()$$,
  'PUSH-ALL-002: a signed-in user unregisters every device'
);
reset role;

select is(
  (select count(*)::int from public.push_devices where user_id = (select a_id from t_ids)),
  0,
  'PUSH-ALL-003: both of their rows are gone'
);
select is(
  (select user_id from public.push_devices where token = 'all-token-three'),
  (select b_id from t_ids),
  'PUSH-ALL-004: the other account''s row is untouched'
);

select tests.authenticate_as((select a_id from t_ids));
select lives_ok(
  $$select public.unregister_all_push_devices()$$,
  'PUSH-ALL-005: calling it with nothing registered does not raise'
);
reset role;

select tests.authenticate_as((select b_id from t_ids));
select tests.clear_jwt();
select throws_ok(
  $$select public.unregister_all_push_devices()$$,
  'Authentication required',
  'PUSH-ALL-006: a NULL auth.uid() is refused'
);
reset role;

select set_config('role', 'anon', true);
select throws_ok(
  $$select public.unregister_all_push_devices()$$,
  '42501',
  null,
  'PUSH-ALL-007: anon cannot call it'
);
reset role;

select is(
  (select count(*)::int from public.push_devices where user_id = (select b_id from t_ids)),
  1,
  'PUSH-ALL-008: the refused calls removed nothing'
);

select is(
  (select count(*)::int from public.push_devices where token like 'all-token-%'),
  1,
  'PUSH-ALL-009: one row is left in total'
);

select * from finish();
rollback;
