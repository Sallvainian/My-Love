-- ============================================
-- pgTAP: push_preferences (20261031050000)
--
-- Pinned here: RLS on, the exact policy set (a policy added, renamed or
-- dropped fails this file), the grants (select, insert and update for
-- authenticated, nothing for anon, no delete), every switch defaulting to on,
-- the owner's insert, select and single-column update of their own row, the
-- refusals across accounts, and the cascade from auth.users.
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
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Pref ' || left(test_email, 4))
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
  tests.create_test_user('pref-a@example.com') as a_id,
  tests.create_test_user('pref-b@example.com') as b_id;

grant select on t_ids to authenticated, anon;

-- ============================================
-- Structure, RLS and policy set
-- ============================================
select has_table('public', 'push_preferences', 'PUSH-PREF-001: push_preferences exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_preferences'::regclass),
  'PUSH-PREF-002: RLS is enabled'
);

select policies_are(
  'public', 'push_preferences',
  array[
    'Users can view own push preferences',
    'Users can insert own push preferences',
    'Users can update own push preferences'
  ],
  'PUSH-PREF-003: exactly the three owner policies'
);

select is(
  (select string_agg(distinct roles::text, ',') from pg_policies where tablename = 'push_preferences'),
  '{authenticated}',
  'PUSH-PREF-004: every policy is TO authenticated'
);

select is(
  (select with_check from pg_policies
    where tablename = 'push_preferences' and policyname = 'Users can update own push preferences'),
  '(user_id = ( SELECT auth.uid() AS uid))',
  'PUSH-PREF-005: the UPDATE policy states WITH CHECK explicitly'
);

select ok(
  has_table_privilege('authenticated', 'public.push_preferences', 'SELECT')
  and has_table_privilege('authenticated', 'public.push_preferences', 'INSERT')
  and has_table_privilege('authenticated', 'public.push_preferences', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.push_preferences', 'DELETE'),
  'PUSH-PREF-006: authenticated can select, insert and update, and cannot delete'
);

select ok(
  not has_table_privilege('anon', 'public.push_preferences', 'SELECT, INSERT, UPDATE, DELETE'),
  'PUSH-PREF-007: anon has no privilege at all'
);

select ok(
  has_table_privilege('service_role', 'public.push_preferences', 'SELECT'),
  'PUSH-PREF-008: service_role (the sender) can read it'
);

select is(
  (select string_agg(a.attname || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''), ',' order by a.attnum)
     from pg_attribute a
     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = 'public.push_preferences'::regclass and a.attnum > 0 and not a.attisdropped
      and a.atttypid = 'boolean'::regtype),
  'love_notes:true:true,moods:true:true,photos:true:true,pokes_and_kisses:true:true,dates:true:true,partner_requests:true:true',
  'PUSH-PREF-009: the six switches are boolean not null default true'
);

select fk_ok('public', 'push_preferences', 'user_id', 'auth', 'users', 'id',
  'PUSH-PREF-010: user_id references auth.users');

select col_is_pk('public', 'push_preferences', 'user_id', 'PUSH-PREF-011: user_id is the primary key');

-- ============================================
-- The owner
-- ============================================
select tests.authenticate_as((select a_id from t_ids));

select lives_ok(
  $$insert into public.push_preferences (user_id) select a_id from t_ids$$,
  'PUSH-PREF-012: the owner inserts their row with only user_id'
);

select results_eq(
  $$select love_notes, moods, photos, pokes_and_kisses, dates, partner_requests from public.push_preferences$$,
  $$values (true, true, true, true, true, true)$$,
  'PUSH-PREF-013: the owner reads it back with every switch on'
);

select lives_ok(
  $$insert into public.push_preferences (user_id, love_notes)
      select a_id, false from t_ids
      on conflict (user_id) do update set love_notes = excluded.love_notes$$,
  'PUSH-PREF-014: the owner upserts one switch off'
);

select lives_ok(
  $$insert into public.push_preferences (user_id, moods)
      select a_id, false from t_ids
      on conflict (user_id) do update set moods = excluded.moods$$,
  'PUSH-PREF-015: and a second switch, from another upsert'
);

select results_eq(
  $$select love_notes, moods, photos, pokes_and_kisses, dates, partner_requests from public.push_preferences$$,
  $$values (false, false, true, true, true, true)$$,
  'PUSH-PREF-016: each upsert changed only the column it sent'
);

select lives_ok(
  $$update public.push_preferences set love_notes = true where user_id = (select a_id from t_ids)$$,
  'PUSH-PREF-017: the owner switches one back on'
);

select throws_ok(
  $$delete from public.push_preferences where user_id = (select a_id from t_ids)$$,
  '42501',
  null,
  'PUSH-PREF-018: the owner cannot delete the row'
);

-- ============================================
-- Across accounts
-- ============================================
select tests.authenticate_as((select b_id from t_ids));

select is(
  (select count(*)::int from public.push_preferences),
  0,
  'PUSH-PREF-019: another account reads no row of the owner'
);

with changed as (
  update public.push_preferences set moods = true where user_id = (select a_id from t_ids) returning 1
)
select is((select count(*)::int from changed), 0,
  'PUSH-PREF-020: another account updates 0 rows of the owner');

select throws_ok(
  $$insert into public.push_preferences (user_id) select a_id from t_ids$$,
  '42501',
  null,
  'PUSH-PREF-021: another account cannot insert a row for the owner'
);

select lives_ok(
  $$insert into public.push_preferences (user_id) select b_id from t_ids$$,
  'PUSH-PREF-022: but inserts its own'
);

select throws_ok(
  $$update public.push_preferences set user_id = (select a_id from t_ids) where user_id = (select b_id from t_ids)$$,
  '42501',
  null,
  'PUSH-PREF-023: and cannot hand its row to the owner (WITH CHECK)'
);

-- ============================================
-- anon
-- ============================================
reset role;
select tests.clear_jwt();
set local role anon;
select throws_ok(
  $$select * from public.push_preferences$$,
  '42501',
  null,
  'PUSH-PREF-024: anon cannot read the table'
);
reset role;

-- ============================================
-- Cascade
-- ============================================
delete from auth.users where id = (select a_id from t_ids);
select is(
  (select count(*)::int from public.push_preferences where user_id = (select a_id from t_ids)),
  0,
  'PUSH-PREF-025: deleting the account deletes its row'
);

select is(
  (select count(*)::int from public.push_preferences where user_id = (select b_id from t_ids)),
  1,
  'PUSH-PREF-026: and leaves the other account''s row'
);

select * from finish();
rollback;
