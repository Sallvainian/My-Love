-- ============================================
-- pgTAP Tests: scripture_get_couple_stats RPC
--
-- Story 3.1: Couple-Aggregate Stats Dashboard
-- Test IDs: 3.1-DB-001 (P0), 3.1-DB-002 (P0), 3.1-DB-003 (P2)
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(13);

-- ============================================
-- Helpers (reuse existing pattern from 03_scripture_rpcs.sql)
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

-- ============================================
-- Setup: Create two couples (A+B, C+D) and a zero-state couple (E+F)
-- Couple A: user_a + user_b (sessions + reflections + bookmarks)
-- Couple C: user_c + user_d (1 session from user_c)
-- Couple E: user_e + user_f (no sessions — zero-state test)
-- ============================================
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_user_c uuid;
  v_user_d uuid;
  v_user_e uuid;
  v_user_f uuid;
  v_session_1 uuid;
  v_session_2 uuid;
  v_session_3 uuid;
begin
  -- Create users for couple A
  v_user_a := tests.create_test_user('couple_stats_a@test.com');
  v_user_b := tests.create_test_user('couple_stats_b@test.com');

  -- Create users for couple C
  v_user_c := tests.create_test_user('couple_stats_c@test.com');
  v_user_d := tests.create_test_user('couple_stats_d@test.com');

  -- Create users for couple E (zero-state)
  v_user_e := tests.create_test_user('couple_stats_e@test.com');
  v_user_f := tests.create_test_user('couple_stats_f@test.com');

  -- ============================================
  -- Set partner_id linkage in public.users
  -- The sync_user_profile() trigger already created rows when auth.users was inserted.
  -- The RPC looks up partner_id from public.users to aggregate couple data.
  -- Without partner_id set, v_partner_id is always NULL and couple aggregation is untested.
  -- ============================================

  -- Couple A: user_a <-> user_b
  update public.users set partner_id = v_user_b where id = v_user_a;
  update public.users set partner_id = v_user_a where id = v_user_b;

  -- Couple C: user_c <-> user_d
  update public.users set partner_id = v_user_d where id = v_user_c;
  update public.users set partner_id = v_user_c where id = v_user_d;

  -- Couple E: user_e <-> user_f (zero-state — no sessions)
  update public.users set partner_id = v_user_f where id = v_user_e;
  update public.users set partner_id = v_user_e where id = v_user_f;

  -- Store user IDs for later tests
  perform set_config('tests.stats_user_a', v_user_a::text, true);
  perform set_config('tests.stats_user_b', v_user_b::text, true);
  perform set_config('tests.stats_user_c', v_user_c::text, true);
  perform set_config('tests.stats_user_d', v_user_d::text, true);
  perform set_config('tests.stats_user_e', v_user_e::text, true);
  perform set_config('tests.stats_user_f', v_user_f::text, true);

  -- ============================================
  -- Seed data for couple A: 3 sessions, 2 completed
  -- ============================================

  -- Session 1: completed solo by user_a (5 steps)
  v_session_1 := gen_random_uuid();
  insert into public.scripture_sessions (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at, completed_at)
  values (v_session_1, 'solo', v_user_a, null, 'complete', 4, 'complete', 1, '2026-02-10T10:00:00Z', '2026-02-10T11:00:00Z');

  -- Session 2: completed together by user_a + user_b (8 steps)
  v_session_2 := gen_random_uuid();
  insert into public.scripture_sessions (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at, completed_at)
  values (v_session_2, 'together', v_user_a, v_user_b, 'complete', 7, 'complete', 1, '2026-02-12T14:00:00Z', '2026-02-12T15:30:00Z');

  -- Session 3: in_progress solo by user_a (should NOT count in completed stats)
  v_session_3 := gen_random_uuid();
  insert into public.scripture_sessions (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at, completed_at)
  values (v_session_3, 'solo', v_user_a, null, 'reading', 2, 'in_progress', 1, '2026-02-14T09:00:00Z', null);

  perform set_config('tests.stats_session_1', v_session_1::text, true);
  perform set_config('tests.stats_session_2', v_session_2::text, true);
  perform set_config('tests.stats_session_3', v_session_3::text, true);

  -- ============================================
  -- Seed reflections for couple A
  -- Session 1: user_a rated steps 0-4 (ratings: 3, 4, 5, 2, 4 → avg 3.6)
  -- Session 2: user_a rated steps 0-3 (ratings: 5, 5, 4, 3 → avg 4.25)
  --            user_b rated steps 0-3 (ratings: 4, 3, 5, 4 → avg 4.0)
  -- Combined avg: (3+4+5+2+4+5+5+4+3+4+3+5+4) / 13 = 51/13 ≈ 3.923...
  -- ============================================

  -- Session 1 reflections (user_a)
  insert into public.scripture_reflections (id, session_id, step_index, user_id, rating, notes, is_shared, created_at)
  values
    (gen_random_uuid(), v_session_1, 0, v_user_a, 3, 'Good', true, '2026-02-10T10:10:00Z'),
    (gen_random_uuid(), v_session_1, 1, v_user_a, 4, 'Great', true, '2026-02-10T10:20:00Z'),
    (gen_random_uuid(), v_session_1, 2, v_user_a, 5, 'Amazing', true, '2026-02-10T10:30:00Z'),
    (gen_random_uuid(), v_session_1, 3, v_user_a, 2, 'OK', false, '2026-02-10T10:40:00Z'),
    (gen_random_uuid(), v_session_1, 4, v_user_a, 4, 'Nice', true, '2026-02-10T10:50:00Z');

  -- Session 2 reflections (user_a)
  insert into public.scripture_reflections (id, session_id, step_index, user_id, rating, notes, is_shared, created_at)
  values
    (gen_random_uuid(), v_session_2, 0, v_user_a, 5, 'Wonderful', true, '2026-02-12T14:10:00Z'),
    (gen_random_uuid(), v_session_2, 1, v_user_a, 5, 'Inspiring', true, '2026-02-12T14:20:00Z'),
    (gen_random_uuid(), v_session_2, 2, v_user_a, 4, 'Thoughtful', true, '2026-02-12T14:30:00Z'),
    (gen_random_uuid(), v_session_2, 3, v_user_a, 3, 'Decent', true, '2026-02-12T14:40:00Z');

  -- Session 2 reflections (user_b)
  insert into public.scripture_reflections (id, session_id, step_index, user_id, rating, notes, is_shared, created_at)
  values
    (gen_random_uuid(), v_session_2, 0, v_user_b, 4, 'Lovely', true, '2026-02-12T14:15:00Z'),
    (gen_random_uuid(), v_session_2, 1, v_user_b, 3, 'Fine', true, '2026-02-12T14:25:00Z'),
    (gen_random_uuid(), v_session_2, 2, v_user_b, 5, 'Beautiful', true, '2026-02-12T14:35:00Z'),
    (gen_random_uuid(), v_session_2, 3, v_user_b, 4, 'Good stuff', true, '2026-02-12T14:45:00Z');

  -- ============================================
  -- Seed bookmarks for couple A
  -- Session 1: 2 bookmarks (user_a)
  -- Session 2: 3 bookmarks (2 from user_a, 1 from user_b) = 5 total
  -- ============================================
  insert into public.scripture_bookmarks (id, session_id, step_index, user_id, share_with_partner, created_at)
  values
    (gen_random_uuid(), v_session_1, 1, v_user_a, true, '2026-02-10T10:22:00Z'),
    (gen_random_uuid(), v_session_1, 4, v_user_a, false, '2026-02-10T10:52:00Z'),
    (gen_random_uuid(), v_session_2, 0, v_user_a, true, '2026-02-12T14:12:00Z'),
    (gen_random_uuid(), v_session_2, 2, v_user_a, true, '2026-02-12T14:32:00Z'),
    (gen_random_uuid(), v_session_2, 1, v_user_b, true, '2026-02-12T14:27:00Z');

  -- ============================================
  -- Seed separate couple C session (for isolation test)
  -- Should NOT appear in couple A's stats
  -- ============================================
  declare
    v_session_c uuid := gen_random_uuid();
  begin
    insert into public.scripture_sessions (id, mode, user1_id, user2_id, current_phase, current_step_index, status, version, started_at, completed_at)
    values (v_session_c, 'solo', v_user_c, null, 'complete', 3, 'complete', 1, '2026-02-11T08:00:00Z', '2026-02-11T09:00:00Z');

    insert into public.scripture_reflections (id, session_id, step_index, user_id, rating, notes, is_shared, created_at)
    values
      (gen_random_uuid(), v_session_c, 0, v_user_c, 1, 'Bad', true, '2026-02-11T08:10:00Z'),
      (gen_random_uuid(), v_session_c, 1, v_user_c, 1, 'Terrible', true, '2026-02-11T08:20:00Z');

    insert into public.scripture_bookmarks (id, session_id, step_index, user_id, share_with_partner, created_at)
    values
      (gen_random_uuid(), v_session_c, 0, v_user_c, true, '2026-02-11T08:12:00Z'),
      (gen_random_uuid(), v_session_c, 1, v_user_c, true, '2026-02-11T08:22:00Z'),
      (gen_random_uuid(), v_session_c, 2, v_user_c, true, '2026-02-11T08:32:00Z');
  end;
end;
$$;

-- ============================================
-- 3.1-DB-001 (P0): RPC data isolation
-- User A must NOT see couple C's stats.
-- User C must NOT see couple A's stats.
-- User B (partner of A) must see same couple A stats as user A.
-- User D (partner of C) must see couple C stats via partner linkage.
-- This is the highest-priority security test (E3-R01, risk score 6).
-- ============================================

-- Test: user_a calls RPC → totalSessions should be 2 (not 3 — couple C has 1)
select tests.authenticate_as(current_setting('tests.stats_user_a')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_a', v_result::text, true);
end;
$$;

select is(
  (current_setting('tests.stats_result_a')::jsonb->>'totalSessions')::int,
  2,
  '3.1-DB-001a: User A sees only couple A completed sessions (2), not couple C'
);

-- Test: user_c calls RPC → totalSessions should be 1 (not 2 — couple A has 2)
select tests.authenticate_as(current_setting('tests.stats_user_c')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_c', v_result::text, true);
end;
$$;

select is(
  (current_setting('tests.stats_result_c')::jsonb->>'totalSessions')::int,
  1,
  '3.1-DB-001b: User C sees only couple C completed sessions (1), not couple A'
);

-- Test: user_c bookmark count should be 3, not 5 (couple A has 5)
select is(
  (current_setting('tests.stats_result_c')::jsonb->>'bookmarkCount')::int,
  3,
  '3.1-DB-001c: User C sees only couple C bookmarks (3), not couple A'
);

-- Test: user_c avg rating should be 1.0 (two ratings of 1), not couple A's ~3.9
select ok(
  abs((current_setting('tests.stats_result_c')::jsonb->>'avgRating')::numeric - 1.0) < 0.01,
  '3.1-DB-001d: User C avg rating is 1.0, not contaminated by couple A ratings'
);

-- Test: user_b (partner of A) should see BOTH couple A sessions via partner_id linkage
-- This proves couple aggregation works — user_b sees user_a's solo session (session 1)
-- even though user_b is NOT user1_id or user2_id on that session.
select tests.authenticate_as(current_setting('tests.stats_user_b')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_b', v_result::text, true);
end;
$$;

select is(
  (current_setting('tests.stats_result_b')::jsonb->>'totalSessions')::int,
  2,
  '3.1-DB-001e: User B (partner) sees both couple A sessions (2) via partner_id linkage'
);

-- Test: user_d (partner of C, has no own sessions) should see couple C's session
-- This proves partner_id lookup works for users with no sessions of their own.
select tests.authenticate_as(current_setting('tests.stats_user_d')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_d', v_result::text, true);
end;
$$;

select is(
  (current_setting('tests.stats_result_d')::jsonb->>'totalSessions')::int,
  1,
  '3.1-DB-001f: User D (partner, no own sessions) sees couple C session (1) via partner_id'
);

-- ============================================
-- 3.1-DB-002 (P0): Correct aggregate metrics for couple A
-- Verify each metric independently against known seed data.
-- ============================================
select tests.authenticate_as(current_setting('tests.stats_user_a')::uuid);

-- Re-fetch for user_a (already stored above, but re-authenticate)
do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_a2', v_result::text, true);
end;
$$;

-- totalSessions: 2 completed sessions (session 3 is in_progress, should not count)
select is(
  (current_setting('tests.stats_result_a2')::jsonb->>'totalSessions')::int,
  2,
  '3.1-DB-002a: totalSessions = 2 (excludes in_progress session)'
);

-- totalSteps: session 1 has 5 steps (0-4), session 2 has 8 steps (0-7) = 13 total
-- Steps = current_step_index + 1 for each completed session
select is(
  (current_setting('tests.stats_result_a2')::jsonb->>'totalSteps')::int,
  13,
  '3.1-DB-002b: totalSteps = 13 (5 from session 1 + 8 from session 2)'
);

-- lastCompleted: most recent completed_at = '2026-02-12T15:30:00Z' (session 2)
select ok(
  (current_setting('tests.stats_result_a2')::jsonb->>'lastCompleted') like '2026-02-12T15:30:00%',
  '3.1-DB-002c: lastCompleted is session 2 completed_at'
);

-- avgRating: 13 ratings totaling 51 → 51/13 ≈ 3.923
-- Allow small floating point tolerance
select ok(
  abs((current_setting('tests.stats_result_a2')::jsonb->>'avgRating')::numeric - 3.923) < 0.01,
  '3.1-DB-002d: avgRating ≈ 3.92 (51/13 ratings across both partners)'
);

-- bookmarkCount: 5 total bookmarks (2 from session 1 + 3 from session 2)
select is(
  (current_setting('tests.stats_result_a2')::jsonb->>'bookmarkCount')::int,
  5,
  '3.1-DB-002e: bookmarkCount = 5 (2 + 3 across sessions)'
);

-- ============================================
-- 3.1-DB-003 (P2): Zero-state — couple with no sessions
-- Couple E (user_e + user_f) has partner_id set but no sessions.
-- Both partners should see zero-state metrics.
-- ============================================
select tests.authenticate_as(current_setting('tests.stats_user_e')::uuid);

do $$
declare
  v_result jsonb;
begin
  v_result := scripture_get_couple_stats();
  perform set_config('tests.stats_result_e', v_result::text, true);
end;
$$;

select is(
  (current_setting('tests.stats_result_e')::jsonb->>'totalSessions')::int,
  0,
  '3.1-DB-003a: Zero-state couple has totalSessions = 0'
);

select ok(
  (current_setting('tests.stats_result_e')::jsonb->>'lastCompleted') is null
    or (current_setting('tests.stats_result_e')::jsonb->>'lastCompleted') = 'null',
  '3.1-DB-003b: Zero-state couple has lastCompleted = null'
);

select * from finish();
rollback;
