-- ============================================
-- Mood insert idempotency
--
-- Covers the unique key that makes duplicate mood rows impossible at the
-- database. This is the load-bearing half of the duplicate-mood fix: the
-- client-side upsert in moodApi.create() and the service worker's
-- on_conflict POST both depend on this constraint existing, and neither the
-- unit tests nor the E2E suite can prove it — they mock Supabase, so they
-- assert that the mock resolves a conflict, not that Postgres does.
--
-- created_at is the conflict key because it is client-supplied from the local
-- IndexedDB record (mood.timestamp.toISOString()), so re-sending the same
-- record reproduces the same key.
--
-- The upsert cases run as an authenticated user rather than as the superuser
-- pg_prove connects with: INSERT .. ON CONFLICT DO UPDATE needs both the INSERT
-- WITH CHECK policy and the UPDATE USING policy to pass, and a superuser
-- bypasses RLS entirely, so running them unauthenticated proves nothing about
-- what the app's own role is allowed to do.
--
-- The last section covers the migration's duplicate-collapsing DELETE. On a
-- clean database that statement is a guaranteed no-op, so `supabase db reset`
-- exercises nothing — yet it is the only part of the change that destroys rows.
-- The CTE is reproduced verbatim from
-- supabase/migrations/20260726000000_moods_unique_user_created_at.sql; keep the
-- two copies in sync.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(11);

-- ============================================
-- Helpers (each test file declares its own — 00_helpers.sql rolls back)
-- ============================================
create or replace function tests.create_test_user(test_email text default 'test@example.com')
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

-- Back to the session user (the superuser pg_prove connected as), not to anon:
-- the duplicate-collapse section below needs DDL and an unfiltered view of the
-- table.
create or replace function tests.clear_authentication()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;

-- ============================================
-- Fixtures
-- ============================================
create temporary table t_ids as
select
  tests.create_test_user('mood-idem-a@test.example.com') as user_a,
  tests.create_test_user('mood-idem-b@test.example.com') as user_b,
  tests.create_test_user('mood-idem-c@test.example.com') as user_c,
  '2026-07-26 06:38:40.120+00'::timestamptz as ts;

-- The `authenticated` role cannot read this session's temp table, so republish
-- the ids the RLS section needs as transaction-local settings.
do $$
begin
  perform set_config('tests.user_a', (select user_a::text from t_ids), true);
  perform set_config('tests.user_b', (select user_b::text from t_ids), true);
  perform set_config('tests.ts', (select ts::text from t_ids), true);
end $$;

-- ============================================
-- MOOD-DB-001: the constraint exists on the expected columns
-- ============================================
select col_is_unique(
  'public', 'moods', array['user_id', 'created_at'],
  'MOOD-DB-001: (user_id, created_at) is unique'
);

-- Seed one mood for user A.
insert into public.moods (user_id, mood_type, mood_types, note, created_at)
select user_a, 'lonely', array['lonely', 'anxious'], 'seed', ts from t_ids;

-- ============================================
-- MOOD-DB-002: re-sending the same record is rejected
-- This is the retry-after-partial-success vector: the insert committed, the
-- response never arrived, and the client retried with the same created_at.
-- ============================================
select throws_ok(
  $$insert into public.moods (user_id, mood_type, mood_types, note, created_at)
    select user_a, 'lonely', array['lonely', 'anxious'], 'seed', ts from t_ids$$,
  '23505',
  null,
  'MOOD-DB-002: duplicate (user_id, created_at) is rejected'
);

-- ============================================
-- MOOD-DB-003: a genuinely later mood from the same user is allowed.
-- The constraint must not degrade into one-mood-per-day.
-- ============================================
select lives_ok(
  $$insert into public.moods (user_id, mood_type, mood_types, note, created_at)
    select user_a, 'happy', array['happy'], 'later same day', ts + interval '1 second'
    from t_ids$$,
  'MOOD-DB-003: same user, different created_at is allowed'
);

-- ============================================
-- MOOD-DB-004: partners logging at the same instant do not collide
-- ============================================
select lives_ok(
  $$insert into public.moods (user_id, mood_type, mood_types, note, created_at)
    select user_b, 'grateful', array['grateful'], 'partner', ts from t_ids$$,
  'MOOD-DB-004: different users may share a created_at'
);

-- ============================================
-- MOOD-DB-005/006: the upsert path resolves to the existing row rather than
-- adding one. This is what moodApi.create() and sw.ts now issue — as the
-- authenticated owner of the row, so RLS is enforced rather than bypassed.
-- ============================================
select tests.authenticate_as(current_setting('tests.user_a')::uuid);

insert into public.moods (user_id, mood_type, mood_types, note, created_at)
values (
  current_setting('tests.user_a')::uuid,
  'sad',
  array['sad'],
  'edited by a racing writer',
  current_setting('tests.ts')::timestamptz
)
on conflict (user_id, created_at) do update
  set mood_type = excluded.mood_type,
      mood_types = excluded.mood_types,
      note = excluded.note;

select is(
  (select count(*)::int from public.moods
     where user_id = current_setting('tests.user_a')::uuid
       and created_at = current_setting('tests.ts')::timestamptz),
  1,
  'MOOD-DB-005: upsert on conflict adds no second row'
);

select is(
  (select note from public.moods
     where user_id = current_setting('tests.user_a')::uuid
       and created_at = current_setting('tests.ts')::timestamptz),
  'edited by a racing writer',
  'MOOD-DB-006: upsert on conflict updates the existing row in place'
);

-- ============================================
-- MOOD-DB-006a: the merge-duplicates upsert is not a way around RLS. User B
-- aiming at user A's key must be rejected, not silently merged into A's row.
-- ============================================
select tests.authenticate_as(current_setting('tests.user_b')::uuid);

select throws_ok(
  $$insert into public.moods (user_id, mood_type, mood_types, note, created_at)
    values (
      current_setting('tests.user_a')::uuid,
      'angry',
      array['angry'],
      'written by the wrong user',
      current_setting('tests.ts')::timestamptz
    )
    on conflict (user_id, created_at) do update set note = excluded.note$$,
  '42501',
  'new row violates row-level security policy for table "moods"',
  'MOOD-DB-006a: user B cannot upsert onto user A''s key'
);

select tests.clear_authentication();

-- ============================================
-- MOOD-DB-007: created_at stays nullable.
-- The app never writes a NULL — the column only defaults to now() for direct
-- SQL inserts — but the migration must not tighten the column while adding the
-- constraint: rows with a NULL created_at are the ones its cleanup DELETE skips
-- and the ones a plain UNIQUE treats as distinct.
-- ============================================
select col_is_null(
  'public', 'moods', 'created_at',
  'MOOD-DB-007: created_at is still nullable'
);

-- ============================================
-- MOOD-DB-008/009/010: the migration's duplicate-collapsing DELETE.
--
-- The constraint is dropped inside this transaction so the duplicates the
-- cleanup exists to remove can actually be created; the rollback at the end of
-- the file restores it.
-- ============================================
alter table public.moods drop constraint moods_user_id_created_at_key;

-- Three writes of one logged mood (the retry/second-writer duplicates), plus a
-- genuine re-log later the same day. Ids are explicit so "lowest id survives"
-- is observable, and they are inserted out of order so physical order cannot
-- stand in for id order.
insert into public.moods (id, user_id, mood_type, mood_types, note, created_at)
select 'dddddddd-0000-4000-8000-000000000003'::uuid, user_c, 'sad', array['sad'], 'third write', ts from t_ids
union all
select 'dddddddd-0000-4000-8000-000000000001'::uuid, user_c, 'happy', array['happy'], 'first write', ts from t_ids
union all
select 'dddddddd-0000-4000-8000-000000000002'::uuid, user_c, 'tired', array['tired'], 'second write', ts from t_ids
union all
select 'dddddddd-0000-4000-8000-000000000004'::uuid, user_c, 'grateful', array['grateful'], 'genuine re-log', ts + interval '5 hours' from t_ids;

-- Verbatim from 20260726000000_moods_unique_user_created_at.sql.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, created_at
      order by id
    ) as row_num
  from public.moods
  where created_at is not null
)
delete from public.moods m
using ranked r
where m.id = r.id
  and r.row_num > 1;

select is(
  (select count(*)::int from public.moods m, t_ids t
     where m.user_id = t.user_c and m.created_at = t.ts),
  1,
  'MOOD-DB-008: exact duplicates collapse to a single row'
);

select is(
  (select m.id from public.moods m, t_ids t
     where m.user_id = t.user_c and m.created_at = t.ts),
  'dddddddd-0000-4000-8000-000000000001'::uuid,
  'MOOD-DB-009: the surviving row is the lowest id in the group'
);

select is(
  (select array_agg(m.note order by m.created_at) from public.moods m, t_ids t
     where m.user_id = t.user_c),
  array['first write', 'genuine re-log'],
  'MOOD-DB-010: a same-day mood with a different created_at is left untouched'
);

select * from finish();
rollback;
