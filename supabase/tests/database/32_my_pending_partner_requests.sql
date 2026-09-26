-- ============================================
-- pgTAP: get_my_pending_partner_requests (20260926010000)
--
-- The Partner tab's request lists. It runs as the definer, so it reads
-- public.users rows the SELECT policy hides from the caller; pinned here: who
-- may call it, that it returns only the caller's own PENDING requests, and that
-- it names the OTHER person, with a seed name answered as null.
--
-- Identities: ME sends to NAMED and receives from SEEDED; STRANGER_A has a
-- pending request to STRANGER_B that ME must never see; OLD is an already
-- declined request to ME.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(14);

-- ============================================
-- Helpers (re-created per file: each test file runs in its own transaction)
-- ============================================
create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  return user_id;
end; $$;

create or replace function tests.authenticate_as(test_user_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', test_user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- ============================================
-- Fixtures (as postgres; on_auth_user_created seeds each public.users row
-- with the email as its name, which is the seed this function must hide)
-- ============================================
create temporary table t_ids as
select
  tests.create_test_user('pending-me@example.com') as me_id,
  tests.create_test_user('pending-named@example.com') as named_id,
  tests.create_test_user('pending-seeded@example.com') as seeded_id,
  tests.create_test_user('pending-stranger-a@example.com') as stranger_a_id,
  tests.create_test_user('pending-stranger-b@example.com') as stranger_b_id,
  tests.create_test_user('pending-old@example.com') as old_id;

grant select on t_ids to authenticated, anon;

update public.users set display_name = '  Named Person '
where id = (select named_id from t_ids);
update public.users set display_name = 'Stranger B'
where id = (select stranger_b_id from t_ids);

insert into public.partner_requests (id, from_user_id, to_user_id, status, created_at)
select '88888888-0000-0000-0000-000000000001', me_id, named_id, 'pending', now() - interval '2 hours' from t_ids;
insert into public.partner_requests (id, from_user_id, to_user_id, status, created_at)
select '88888888-0000-0000-0000-000000000002', seeded_id, me_id, 'pending', now() - interval '1 hour' from t_ids;
insert into public.partner_requests (id, from_user_id, to_user_id, status)
select '88888888-0000-0000-0000-000000000003', stranger_a_id, stranger_b_id, 'pending' from t_ids;
insert into public.partner_requests (id, from_user_id, to_user_id, status)
select '88888888-0000-0000-0000-000000000004', old_id, me_id, 'declined' from t_ids;

-- ============================================
-- Shape and privileges
-- ============================================
select ok(
  (select prosecdef from pg_proc where oid = 'public.get_my_pending_partner_requests()'::regprocedure),
  'MPR-DB-001: get_my_pending_partner_requests is SECURITY DEFINER'
);

select is(
  (select proconfig from pg_proc where oid = 'public.get_my_pending_partner_requests()'::regprocedure),
  array['search_path=""'],
  'MPR-DB-002: get_my_pending_partner_requests pins an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.get_my_pending_partner_requests()', 'EXECUTE'),
  'MPR-DB-003: anon does not hold EXECUTE on get_my_pending_partner_requests'
);

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select * from public.get_my_pending_partner_requests()$$,
  '42501',
  'permission denied for function get_my_pending_partner_requests',
  'MPR-DB-004: anon cannot call get_my_pending_partner_requests'
);
reset role;

select is(
  (select count(*)::int from public.get_my_pending_partner_requests()),
  0,
  'MPR-DB-005: a NULL auth.uid() gets no requests'
);

-- ============================================
-- Behaviour, as ME
-- ============================================
select tests.authenticate_as((select me_id from t_ids));

-- Premise: the users SELECT policy hides both other people from ME, which is
-- why the lists showed "Unknown User".
select is(
  (select count(*)::int from public.users
    where id in ((select named_id from t_ids), (select seeded_id from t_ids))),
  0,
  'MPR-DB-006: premise -- ME cannot read the other side of either request directly'
);

select results_eq(
  $$select id from public.get_my_pending_partner_requests()$$,
  $$values ('88888888-0000-0000-0000-000000000002'::uuid), ('88888888-0000-0000-0000-000000000001'::uuid)$$,
  'MPR-DB-007: exactly my two pending requests, newest first -- not another pair''s, not a declined one'
);

select results_eq(
  $$select from_user_id, to_user_id, other_display_name, other_email
      from public.get_my_pending_partner_requests()
     where id = '88888888-0000-0000-0000-000000000001'$$,
  $$select me_id, named_id, 'Named Person'::text, 'pending-named@example.com'::text from t_ids$$,
  'MPR-DB-008: a sent request names the recipient, trimmed, with their email'
);

select results_eq(
  $$select from_user_id, to_user_id, other_display_name, other_email
      from public.get_my_pending_partner_requests()
     where id = '88888888-0000-0000-0000-000000000002'$$,
  $$select seeded_id, me_id, null::text, 'pending-seeded@example.com'::text from t_ids$$,
  'MPR-DB-009: a received request from a seed-named sender answers a null name, and the email'
);

-- The other seed forms, on the same received request.
reset role;
update public.users set display_name = 'PENDING-SEEDED@example.com '
where id = (select seeded_id from t_ids);
select tests.authenticate_as((select me_id from t_ids));
select is(
  (select other_display_name from public.get_my_pending_partner_requests()
    where id = '88888888-0000-0000-0000-000000000002'),
  null,
  'MPR-DB-010: the email in another case, with a trailing space, is a seed name'
);

reset role;
update public.users set display_name = 'Unknown'
where id = (select seeded_id from t_ids);
select tests.authenticate_as((select me_id from t_ids));
select is(
  (select other_display_name from public.get_my_pending_partner_requests()
    where id = '88888888-0000-0000-0000-000000000002'),
  null,
  'MPR-DB-011: the trigger''s ''Unknown'' is a seed name'
);

reset role;
update public.users set display_name = '   '
where id = (select seeded_id from t_ids);
select tests.authenticate_as((select me_id from t_ids));
select is(
  (select other_display_name from public.get_my_pending_partner_requests()
    where id = '88888888-0000-0000-0000-000000000002'),
  null,
  'MPR-DB-012: a blank name is a seed name'
);

-- ============================================
-- The other side, and a stranger
-- ============================================
select tests.authenticate_as((select named_id from t_ids));
select results_eq(
  $$select id, other_display_name, other_email from public.get_my_pending_partner_requests()$$,
  $$values ('88888888-0000-0000-0000-000000000001'::uuid, null::text, 'pending-me@example.com'::text)$$,
  'MPR-DB-013: the recipient sees the same request, naming ME (seed name, so null) and my email'
);

select tests.authenticate_as((select stranger_b_id from t_ids));
select results_eq(
  $$select id from public.get_my_pending_partner_requests()$$,
  $$values ('88888888-0000-0000-0000-000000000003'::uuid)$$,
  'MPR-DB-014: a stranger sees only their own request, none of ME''s'
);

select * from finish();
rollback;
