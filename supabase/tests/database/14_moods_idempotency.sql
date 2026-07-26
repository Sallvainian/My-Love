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
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(7);

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

-- ============================================
-- Fixtures
-- ============================================
create temporary table t_ids as
select
  tests.create_test_user('mood-idem-a@test.example.com') as user_a,
  tests.create_test_user('mood-idem-b@test.example.com') as user_b,
  '2026-07-26 06:38:40.120+00'::timestamptz as ts;

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
-- adding one. This is what moodApi.create() and sw.ts now issue.
-- ============================================
insert into public.moods (user_id, mood_type, mood_types, note, created_at)
select user_a, 'sad', array['sad'], 'edited by a racing writer', ts from t_ids
on conflict (user_id, created_at) do update
  set mood_type = excluded.mood_type,
      mood_types = excluded.mood_types,
      note = excluded.note;

select is(
  (select count(*)::int from public.moods m, t_ids t
     where m.user_id = t.user_a and m.created_at = t.ts),
  1,
  'MOOD-DB-005: upsert on conflict adds no second row'
);

select is(
  (select m.note from public.moods m, t_ids t
     where m.user_id = t.user_a and m.created_at = t.ts),
  'edited by a racing writer',
  'MOOD-DB-006: upsert on conflict updates the existing row in place'
);

-- ============================================
-- MOOD-DB-007: NULL created_at rows do not collide with each other.
-- The app never writes these — the column only defaults to now() for direct
-- SQL inserts — but NULLs are distinct under a plain UNIQUE constraint, so a
-- backfill or manual insert must not start failing.
-- ============================================
select lives_ok(
  $$insert into public.moods (user_id, mood_type, mood_types, note, created_at)
    select user_a, 'tired', array['tired'], 'null ts', null::timestamptz from t_ids
    union all
    select user_a, 'tired', array['tired'], 'null ts again', null::timestamptz from t_ids$$,
  'MOOD-DB-007: NULL created_at rows are not treated as duplicates'
);

select * from finish();
rollback;
