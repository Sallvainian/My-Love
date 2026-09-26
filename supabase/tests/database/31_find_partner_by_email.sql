-- ============================================
-- pgTAP: find_partner_by_email (20260926000000)
--
-- The Partner tab's search. It runs as the definer, so it is the one path by
-- which a signed-in user learns anything about a row the users SELECT policy
-- hides from them. Pinned here: who may call it, that it answers only an exact
-- (case-insensitive, trimmed) sign-in email, and its three answers -- found
-- (an unlinked account: id and name), taken (a linked account: a flag and
-- nothing else), and missing (no row: no such account, or the caller).
--
-- Identities: SEEKER is unlinked and searches. TARGET is unlinked and is the
-- account to be found. LINKED_A and LINKED_B are partners of each other.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(17);

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
-- Fixtures (as postgres; on_auth_user_created seeds each public.users row)
-- ============================================
create temporary table t_ids as
select
  tests.create_test_user('find-seeker@example.com') as seeker_id,
  tests.create_test_user('find-target@example.com') as target_id,
  tests.create_test_user('find-linked-a@example.com') as linked_a_id,
  tests.create_test_user('find-linked-b@example.com') as linked_b_id;

-- Read after the role switches away from postgres.
grant select on t_ids to authenticated, anon;

update public.users set display_name = 'Target Person'
where id = (select target_id from t_ids);

-- A linked pair, written directly as postgres: this file tests the search, not
-- accept_partner_request.
update public.users set partner_id = (select linked_b_id from t_ids)
where id = (select linked_a_id from t_ids);
update public.users set partner_id = (select linked_a_id from t_ids)
where id = (select linked_b_id from t_ids);

-- ============================================
-- Shape and privileges
-- ============================================
select ok(
  (select prosecdef from pg_proc where oid = 'public.find_partner_by_email(text)'::regprocedure),
  'FPE-DB-001: find_partner_by_email is SECURITY DEFINER'
);

select is(
  (select proconfig from pg_proc where oid = 'public.find_partner_by_email(text)'::regprocedure),
  array['search_path=""'],
  'FPE-DB-002: find_partner_by_email pins an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.find_partner_by_email(text)', 'EXECUTE'),
  'FPE-DB-003: anon does not hold EXECUTE on find_partner_by_email'
);

-- The catalog check above, and the call itself refused.
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select * from public.find_partner_by_email('find-target@example.com')$$,
  '42501',
  'permission denied for function find_partner_by_email',
  'FPE-DB-004: anon cannot call find_partner_by_email'
);
reset role;

-- The body does not rely on the grant: with no sub claim, auth.uid() is NULL
-- and the function answers nothing even to a role that may execute it.
select is(
  (select count(*)::int from public.find_partner_by_email('find-target@example.com')),
  0,
  'FPE-DB-005: a NULL auth.uid() finds nobody'
);

-- ============================================
-- Behaviour, as the signed-in seeker
-- ============================================
select tests.authenticate_as((select seeker_id from t_ids));

-- Premise: the users SELECT policy hides the target from the seeker, which is
-- the reason the function exists.
select is(
  (select count(*)::int from public.users where email = 'find-target@example.com'),
  0,
  'FPE-DB-006: premise -- the seeker cannot read the target row directly'
);

select results_eq(
  $$select id, display_name, is_taken from public.find_partner_by_email('find-target@example.com')$$,
  $$select target_id, 'Target Person'::text, false from t_ids$$,
  'FPE-DB-007: found -- the exact sign-in email of an unlinked account returns its id and name'
);

select results_eq(
  $$select id, is_taken from public.find_partner_by_email('  Find-Target@EXAMPLE.com ')$$,
  $$select target_id, false from t_ids$$,
  'FPE-DB-008: found -- a different case, with surrounding spaces, finds the same account'
);

select is(
  (select count(*)::int from public.find_partner_by_email('find-target')),
  0,
  'FPE-DB-009: missing -- a leading part of the email finds nothing'
);

select is(
  (select count(*)::int from public.find_partner_by_email('target@example.com')),
  0,
  'FPE-DB-010: missing -- a trailing part of the email finds nothing'
);

select is(
  (select count(*)::int from public.find_partner_by_email('Target Person')),
  0,
  'FPE-DB-011: missing -- the display name finds nothing'
);

select is(
  (select count(*)::int from public.find_partner_by_email('find-seeker@example.com')),
  0,
  'FPE-DB-012: self -- the caller never finds themself'
);

-- Taken: one row saying so, and nothing that identifies the account.
select results_eq(
  $$select id, display_name, is_taken from public.find_partner_by_email('find-linked-a@example.com')$$,
  $$values (null::uuid, null::text, true)$$,
  'FPE-DB-013: taken -- an account that already has a partner is flagged, with no id or name'
);

select results_eq(
  $$select id, display_name, is_taken from public.find_partner_by_email('FIND-LINKED-B@example.com')$$,
  $$values (null::uuid, null::text, true)$$,
  'FPE-DB-014: taken -- the flag holds for either side of the pair, in any case'
);

select is(
  (select count(*)::int from public.find_partner_by_email('nobody-here@example.com')),
  0,
  'FPE-DB-015: missing -- an email no account uses finds nothing'
);

select is(
  (select count(*)::int from public.find_partner_by_email('   ')),
  0,
  'FPE-DB-016: missing -- a blank query finds nothing'
);

-- A linked caller searching their own address is still "self", not "taken".
select tests.authenticate_as((select linked_a_id from t_ids));
select is(
  (select count(*)::int from public.find_partner_by_email('find-linked-a@example.com')),
  0,
  'FPE-DB-017: self -- a linked caller searching their own email finds nothing, not taken'
);

select * from finish();
rollback;
