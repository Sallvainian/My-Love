-- ============================================
-- pgTAP: partner-only, immutable interactions (F4/F5, CAP-4/CAP-5)
--
-- Two guarantees live in 20260912020000_partner_only_immutable_interactions.sql
-- and both are asserted here, in metadata and in behaviour:
--
--   * CAP-4 -- an INSERT is accepted only when the caller is the sender AND the
--     recipient is the caller's current linked partner.
--   * CAP-5 -- a recipient may set `viewed` and nothing else. That is enforced
--     by a column grant, not by a policy, so `policies_are` alone would pass
--     against a table where `authenticated` had table-level UPDATE back.
--
-- The behavioural half switches role with `tests.authenticate_as`, so the
-- assertions run as the `authenticated` role with a real `sub` claim -- the
-- shape the app's browser client actually presents. A rejected UPDATE is always
-- followed by a read-back: a zero-row update is not proof of column
-- immutability (remediation.md, F5).
--
-- If you add, rename or drop a policy on public.interactions, the array in
-- INT-DB-001 must be edited in the same change or this file fails.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(51);

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
-- Policy metadata
-- ============================================
select policies_are(
  'public',
  'interactions',
  array[
    'Users can view interactions to/from them',
    'interactions_sender_to_partner_insert',
    'interactions_recipient_marks_viewed'
  ],
  'INT-DB-001: interactions carries exactly the three expected policies'
);

select policy_cmd_is(
  'public'::name, 'interactions'::name,
  'interactions_sender_to_partner_insert'::name, 'INSERT',
  'INT-DB-002: the partner-recipient policy is INSERT only'
);

select policy_cmd_is(
  'public'::name, 'interactions'::name,
  'interactions_recipient_marks_viewed'::name, 'UPDATE',
  'INT-DB-003: the mark-viewed policy is UPDATE only'
);

select policy_cmd_is(
  'public'::name, 'interactions'::name,
  'Users can view interactions to/from them'::name, 'SELECT',
  'INT-DB-004: the untouched history policy is still SELECT'
);

-- `to authenticated`, not PUBLIC: anon holds no EXECUTE on get_my_partner_id,
-- so a PUBLIC policy would surface a function-permission error instead of a
-- clean RLS denial.
select policy_roles_are(
  'public'::name, 'interactions'::name,
  'interactions_sender_to_partner_insert'::name,
  array['authenticated'],
  'INT-DB-005: the insert policy is restricted to authenticated'
);

select policy_roles_are(
  'public'::name, 'interactions'::name,
  'interactions_recipient_marks_viewed'::name,
  array['authenticated'],
  'INT-DB-006: the update policy is restricted to authenticated'
);

-- PERMISSIVE, not RESTRICTIVE: policies_are, policy_cmd_is and policy_roles_are
-- are all indifferent to this, and a RESTRICTIVE insert policy would AND itself
-- against nothing else and silently deny every insert.
select is(
  (select array_agg(permissive order by policyname) from pg_policies
    where schemaname = 'public'
      and tablename = 'interactions'
      and policyname in (
        'interactions_sender_to_partner_insert',
        'interactions_recipient_marks_viewed'
      )),
  array['PERMISSIVE', 'PERMISSIVE'],
  'INT-DB-007: both new policies are PERMISSIVE'
);

-- The recipient conjunct is the whole of CAP-4. Asserted on the substring that
-- carries the meaning rather than on the exact deparsed spelling, which differs
-- between PostgreSQL versions.
select ok(
  strpos(
    (select with_check from pg_policies
      where schemaname = 'public' and tablename = 'interactions'
        and policyname = 'interactions_sender_to_partner_insert'),
    'get_my_partner_id'
  ) > 0,
  'INT-DB-008: the insert predicate derives the recipient from get_my_partner_id()'
);

-- Without an explicit WITH CHECK, PostgreSQL reuses USING -- which is exactly
-- the shape the report found. Pin that the clause is stated.
select isnt(
  (select with_check from pg_policies
    where schemaname = 'public' and tablename = 'interactions'
      and policyname = 'interactions_recipient_marks_viewed'),
  null,
  'INT-DB-009: the update policy states its WITH CHECK rather than reusing USING'
);

-- ============================================
-- Privileges -- where CAP-5 actually lives
-- ============================================
-- anon's and authenticated's narrowed privileges are easy to lose: the ALTER
-- DEFAULT PRIVILEGES in 20260725170000:40-43 grants ALL on every public table,
-- and only the revoke in 20260912020000 undoes it for this table. A later
-- blanket re-grant would pass every policy assertion above.
select ok(has_table_privilege('authenticated', 'public.interactions', 'SELECT'),
  'INT-DB-010: authenticated can still SELECT interactions');

-- Column-scoped, so `has_table_privilege` is false by design: it reports the
-- table-wide grant, and this one names columns. The columns the client actually
-- sends are asserted individually at INT-DB-049/050.
select ok(has_column_privilege('authenticated', 'public.interactions', 'type', 'INSERT'),
  'INT-DB-011: authenticated can still INSERT interactions');

select ok(not has_table_privilege('authenticated', 'public.interactions', 'UPDATE'),
  'INT-DB-012: authenticated holds no table-level UPDATE on interactions');

select ok(not has_table_privilege('authenticated', 'public.interactions', 'DELETE'),
  'INT-DB-013: authenticated cannot DELETE interactions');

select ok(has_column_privilege('authenticated', 'public.interactions', 'viewed', 'UPDATE'),
  'INT-DB-014: authenticated can UPDATE the viewed column');

select ok(not has_column_privilege('authenticated', 'public.interactions', 'type', 'UPDATE'),
  'INT-DB-015: authenticated cannot UPDATE type');

-- The INSERT grant is column-scoped for the same reason the UPDATE grant is.
-- A table-level INSERT lets the caller name `created_at`, and
-- getInteractionHistory orders `created_at desc`, so a far-future value pins a
-- row to the top of the feed for good.
select ok(not has_column_privilege('authenticated', 'public.interactions', 'created_at', 'INSERT'),
  'INT-DB-049: authenticated cannot supply created_at on INSERT');

select ok(has_column_privilege('authenticated', 'public.interactions', 'viewed', 'INSERT'),
  'INT-DB-050: authenticated may still supply viewed on INSERT, which the client sends as false');

select ok(not has_column_privilege('authenticated', 'public.interactions', 'from_user_id', 'UPDATE'),
  'INT-DB-016: authenticated cannot UPDATE from_user_id');

select ok(not has_column_privilege('authenticated', 'public.interactions', 'to_user_id', 'UPDATE'),
  'INT-DB-017: authenticated cannot UPDATE to_user_id');

select ok(not has_column_privilege('authenticated', 'public.interactions', 'id', 'UPDATE'),
  'INT-DB-018: authenticated cannot UPDATE id');

select ok(not has_column_privilege('authenticated', 'public.interactions', 'created_at', 'UPDATE'),
  'INT-DB-019: authenticated cannot UPDATE created_at');

select ok(not has_table_privilege('anon', 'public.interactions', 'SELECT'),
  'INT-DB-020: anon cannot SELECT interactions');

select ok(not has_table_privilege('anon', 'public.interactions', 'INSERT'),
  'INT-DB-021: anon cannot INSERT interactions');

select ok(not has_column_privilege('anon', 'public.interactions', 'viewed', 'UPDATE'),
  'INT-DB-022: anon cannot UPDATE interactions');

select ok(not has_table_privilege('anon', 'public.interactions', 'DELETE'),
  'INT-DB-023: anon cannot DELETE interactions');

-- service_role is deliberately untouched: the Playwright API specs delete their
-- fixtures with the service key.
select ok(has_table_privilege('service_role', 'public.interactions', 'DELETE'),
  'INT-DB-024: service_role still holds DELETE for fixture cleanup');

-- ============================================
-- Behaviour: three identities, one linked pair
-- ============================================
do $$
declare
  v_a uuid;
  v_b uuid;
  v_c uuid;
begin
  v_a := tests.create_test_user('int_a@test.com');
  v_b := tests.create_test_user('int_b@test.com');
  v_c := tests.create_test_user('int_c@test.com');

  -- Linked as accept_partner_request would leave them: both directions set.
  update public.users set partner_id = v_b where id = v_a;
  update public.users set partner_id = v_a where id = v_b;
  -- C stays unlinked, which is what makes it a genuine outsider.

  perform set_config('tests.user_a', v_a::text, true);
  perform set_config('tests.user_b', v_b::text, true);
  perform set_config('tests.user_c', v_c::text, true);
end;
$$;

-- --- As A, the linked sender -------------------------------------------------
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select lives_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_a'), current_setting('tests.user_b')
  ),
  'INT-DB-025: a linked partner can send a poke'
);

select lives_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'kiss', current_setting('tests.user_a'), current_setting('tests.user_b')
  ),
  'INT-DB-026: a linked partner can send a kiss'
);

-- Behavioural half of INT-DB-049/050, driven by the SAME linked pair as the two
-- accepted inserts above. `viewed` is the only difference, so a pass here cannot
-- come from the recipient conjunct. Without the `viewed = false` clause a sender
-- could deliver a poke that `getUnviewedInteractions` -- which filters
-- `viewed = false` -- never returns, so it would never reach the unread badge.
select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id, viewed) values (%L, %L, %L, true)',
    'poke', current_setting('tests.user_a'), current_setting('tests.user_b')
  ),
  '42501',
  null,
  'INT-DB-051: a sender cannot insert an interaction that is already viewed'
);

select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_a'), current_setting('tests.user_a')
  ),
  '42501',
  null,
  'INT-DB-027: self-targeting is refused'
);

select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_a'), current_setting('tests.user_c')
  ),
  '42501',
  null,
  'INT-DB-028: targeting a stranger is refused'
);

select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_c'), current_setting('tests.user_a')
  ),
  '42501',
  null,
  'INT-DB-029: spoofing another sender is refused'
);

-- --- As C, the unlinked outsider ---------------------------------------------
select tests.authenticate_as(current_setting('tests.user_c')::uuid);

select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_c'), current_setting('tests.user_a')
  ),
  '42501',
  null,
  'INT-DB-030: an unlinked caller cannot send at all (partner_id is NULL)'
);

select is_empty(
  'select id from public.interactions',
  'INT-DB-031: an outsider reads none of the couple''s interactions'
);

-- --- As B, the recipient -----------------------------------------------------
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select results_eq(
  'select count(*)::int from public.interactions',
  array[2],
  'INT-DB-032: the recipient sees exactly the two legitimate rows'
);

select lives_ok(
  format(
    'update public.interactions set viewed = true where from_user_id = %L and type = %L',
    current_setting('tests.user_a'), 'poke'
  ),
  'INT-DB-033: the recipient can mark a received interaction viewed'
);

select results_eq(
  format(
    'select viewed from public.interactions where from_user_id = %L and type = %L',
    current_setting('tests.user_a'), 'poke'
  ),
  array[true],
  'INT-DB-034: the viewed update actually persisted'
);

select throws_ok(
  $q$update public.interactions set type = 'kiss' where type = 'poke'$q$,
  '42501',
  null,
  'INT-DB-035: the recipient cannot rewrite type'
);

select throws_ok(
  format(
    'update public.interactions set from_user_id = %L where type = %L',
    current_setting('tests.user_c'), 'poke'
  ),
  '42501',
  null,
  'INT-DB-036: the recipient cannot rewrite the sender'
);

select throws_ok(
  format(
    'update public.interactions set to_user_id = %L where type = %L',
    current_setting('tests.user_c'), 'poke'
  ),
  '42501',
  null,
  'INT-DB-037: the recipient cannot rewrite the recipient'
);

select throws_ok(
  $q$update public.interactions set id = gen_random_uuid() where type = 'poke'$q$,
  '42501',
  null,
  'INT-DB-038: the recipient cannot rewrite the id'
);

select throws_ok(
  $q$update public.interactions set created_at = now() - interval '1 year' where type = 'poke'$q$,
  '42501',
  null,
  'INT-DB-039: the recipient cannot rewrite creation metadata'
);

-- The combined patch runs against the still-unviewed kiss row, so the read-back
-- below distinguishes "rejected as a whole" from "viewed applied, forgery
-- dropped".
select throws_ok(
  $q$update public.interactions set viewed = true, type = 'poke' where type = 'kiss'$q$,
  '42501',
  null,
  'INT-DB-040: a combined viewed-plus-forgery patch is refused'
);

select results_eq(
  $q$select type, viewed from public.interactions where viewed = false$q$,
  $q$values ('kiss'::text, false)$q$,
  'INT-DB-041: the combined patch changed nothing, not even viewed'
);

-- --- As A again: the sender cannot mark its own sent row viewed ---------------
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select results_eq(
  $q$with updated as (
       update public.interactions set viewed = true where type = 'kiss' returning 1
     )
     select count(*)::int from updated$q$,
  array[0],
  'INT-DB-042: the sender''s mark-viewed matches no row'
);

-- --- A former partner is no longer a valid recipient --------------------------
-- The relationship is repointed at a third account rather than cleared: an
-- unlinked caller is already covered by INT-DB-030, and the report names the
-- *stale former-partner target* as its own case.
reset role;

do $$
begin
  update public.users set partner_id = current_setting('tests.user_c')::uuid
    where id = current_setting('tests.user_a')::uuid;
  update public.users set partner_id = current_setting('tests.user_a')::uuid
    where id = current_setting('tests.user_c')::uuid;
end;
$$;

select tests.authenticate_as(current_setting('tests.user_a')::uuid);

select throws_ok(
  format(
    'insert into public.interactions (type, from_user_id, to_user_id) values (%L, %L, %L)',
    'poke', current_setting('tests.user_a'), current_setting('tests.user_b')
  ),
  '42501',
  null,
  'INT-DB-043: a former partner is refused once the relationship moves on'
);

-- The SELECT policy is deliberately untouched by 20260912020000, so what the
-- couple already exchanged stays readable to both of them afterwards. A future
-- tightening that erased former-partner history would fail here.
select results_eq(
  'select count(*)::int from public.interactions',
  array[2],
  'INT-DB-044: the former sender still reads the history, and no rejected attempt created a row'
);

select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select results_eq(
  'select count(*)::int from public.interactions',
  array[2],
  'INT-DB-045: the former recipient still reads the history too'
);

-- --- anon reaches the table not at all --------------------------------------
-- The privilege assertions above say anon holds nothing; these say what that
-- means at the statement level, so a re-grant is caught as a behaviour change
-- and not only as an ACL change.
--
-- The JWT claims are cleared as well as the role. `set local role anon` alone
-- would leave the previous user's `sub` installed, so auth.uid() would still
-- answer -- and a re-grant would then be judged against a signed-in identity no
-- real anon client has.
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok(
  'select id from public.interactions',
  '42501',
  null,
  'INT-DB-046: anon cannot read interactions at all'
);

select throws_ok(
  $q$insert into public.interactions (type, from_user_id, to_user_id)
     values ('poke', gen_random_uuid(), gen_random_uuid())$q$,
  '42501',
  null,
  'INT-DB-047: anon cannot insert an interaction'
);

select throws_ok(
  'update public.interactions set viewed = true',
  '42501',
  null,
  'INT-DB-048: anon cannot update an interaction'
);

reset role;

select * from finish();

rollback;
