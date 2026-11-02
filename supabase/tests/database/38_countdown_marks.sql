-- ============================================
-- pgTAP: countdown_marks (20261101010000)
--
-- Pinned here: RLS on, the exact policy set (a policy added, renamed or
-- dropped fails this file), the grants (select, insert and delete for
-- authenticated, nothing for anon, no update), the owner's insert, select and
-- delete of their own rows, the refusals across accounts, the date_key check,
-- and the cascade from auth.users.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(26);

create or replace function tests.create_test_user(test_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid;
begin
  user_id := gen_random_uuid();
  insert into auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
  values (user_id, '00000000-0000-0000-0000-000000000000', test_email, extensions.crypt('password123', extensions.gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), now(), '');
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Mark ' || left(test_email, 4))
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
  tests.create_test_user('mark-a@example.com') as a_id,
  tests.create_test_user('mark-b@example.com') as b_id;

grant select on t_ids to authenticated, anon;

-- ============================================
-- Structure, RLS and policy set
-- ============================================
select has_table('public', 'countdown_marks', 'MARKS-001: countdown_marks exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.countdown_marks'::regclass),
  'MARKS-002: RLS is enabled'
);

select policies_are(
  'public', 'countdown_marks',
  array[
    'Users can view own countdown marks',
    'Users can insert own countdown marks',
    'Users can delete own countdown marks'
  ],
  'MARKS-003: exactly the three owner policies'
);

select is(
  (select string_agg(distinct roles::text, ',') from pg_policies where tablename = 'countdown_marks'),
  '{authenticated}',
  'MARKS-004: every policy is TO authenticated'
);

select ok(
  has_table_privilege('authenticated', 'public.countdown_marks', 'SELECT')
  and has_table_privilege('authenticated', 'public.countdown_marks', 'INSERT')
  and has_table_privilege('authenticated', 'public.countdown_marks', 'DELETE')
  and not has_table_privilege('authenticated', 'public.countdown_marks', 'UPDATE'),
  'MARKS-005: authenticated can select, insert and delete, and cannot update'
);

select ok(
  not has_table_privilege('anon', 'public.countdown_marks', 'SELECT, INSERT, UPDATE, DELETE'),
  'MARKS-006: anon has no privilege at all'
);

select fk_ok('public', 'countdown_marks', 'user_id', 'auth', 'users', 'id',
  'MARKS-007: user_id references auth.users');

select col_is_pk('public', 'countdown_marks', array['user_id', 'date_key'],
  'MARKS-008: the primary key is (user_id, date_key)');

-- ============================================
-- The owner
-- ============================================
select tests.authenticate_as((select a_id from t_ids));

select lives_ok(
  $$insert into public.countdown_marks (user_id, date_key)
      select a_id, 'event:11111111-2222-3333-4444-555555555555' from t_ids$$,
  'MARKS-009: the owner marks an event'
);

select lives_ok(
  $$insert into public.countdown_marks (user_id, date_key)
      select a_id, k from t_ids,
        unnest(array['anniversary:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'relationship-start', 'wedding', 'own-birthday', 'partner-birthday']) as k$$,
  'MARKS-010: and an anniversary and each fixed date'
);

select is(
  (select count(*)::int from public.countdown_marks),
  6,
  'MARKS-011: the owner reads all six back'
);

select lives_ok(
  $$insert into public.countdown_marks (user_id, date_key)
      select a_id, 'wedding' from t_ids
      on conflict (user_id, date_key) do nothing$$,
  'MARKS-012: marking a marked date again is a no-op'
);

select throws_ok(
  $$insert into public.countdown_marks (user_id, date_key) select a_id, 'wedding' from t_ids$$,
  '23505',
  null,
  'MARKS-013: a plain duplicate insert violates the primary key'
);

select throws_ok(
  $$update public.countdown_marks set date_key = 'wedding' where date_key = 'own-birthday'$$,
  '42501',
  null,
  'MARKS-014: the owner cannot update a row'
);

select lives_ok(
  $$delete from public.countdown_marks where user_id = (select a_id from t_ids) and date_key = 'wedding'$$,
  'MARKS-015: the owner unmarks a date'
);

select throws_ok(
  $$insert into public.countdown_marks (user_id, date_key) select a_id, 'birthday' from t_ids$$,
  '23514',
  null,
  'MARKS-016: a date_key of no known form is refused by the check'
);

select throws_ok(
  $$insert into public.countdown_marks (user_id, date_key) select a_id, 'event:not-a-uuid' from t_ids$$,
  '23514',
  null,
  'MARKS-017: and so is an event key that does not carry a uuid'
);

-- ============================================
-- Across accounts
-- ============================================
select tests.authenticate_as((select b_id from t_ids));

select is(
  (select count(*)::int from public.countdown_marks),
  0,
  'MARKS-018: another account reads no mark of the owner'
);

select throws_ok(
  $$insert into public.countdown_marks (user_id, date_key) select a_id, 'wedding' from t_ids$$,
  '42501',
  null,
  'MARKS-019: another account cannot insert a mark for the owner'
);

with removed as (
  delete from public.countdown_marks where user_id = (select a_id from t_ids) returning 1
)
select is((select count(*)::int from removed), 0,
  'MARKS-020: another account deletes 0 rows of the owner');

select lives_ok(
  $$insert into public.countdown_marks (user_id, date_key) select b_id, 'wedding' from t_ids$$,
  'MARKS-021: but marks for itself'
);

-- ============================================
-- anon
-- ============================================
reset role;
select tests.clear_jwt();
set local role anon;
select throws_ok(
  $$select * from public.countdown_marks$$,
  '42501',
  null,
  'MARKS-022: anon cannot read the table'
);
reset role;

-- ============================================
-- Cascade
-- ============================================
select is(
  (select count(*)::int from public.countdown_marks where user_id = (select a_id from t_ids)),
  5,
  'MARKS-023: the owner still has five marks before the account goes'
);

delete from auth.users where id = (select a_id from t_ids);
select is(
  (select count(*)::int from public.countdown_marks where user_id = (select a_id from t_ids)),
  0,
  'MARKS-024: deleting the account deletes its marks'
);

select is(
  (select count(*)::int from public.countdown_marks where user_id = (select b_id from t_ids)),
  1,
  'MARKS-025: and leaves the other account''s mark'
);

select ok(
  (select count(*) from pg_constraint where conrelid = 'public.countdown_marks'::regclass and contype = 'c') = 1,
  'MARKS-026: the date_key check is the table''s one check constraint'
);

select * from finish();
rollback;
