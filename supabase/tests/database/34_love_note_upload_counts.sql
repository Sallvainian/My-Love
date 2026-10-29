-- ============================================
-- pgTAP: love_note_upload_counts and claim_love_note_upload (20261029000000)
--
-- The shared count behind upload-love-note-image's 10-per-minute limit
-- (DW-322). Pinned here: nobody but the definer can touch the table, who may
-- call the function, and the fixed-window matrix -- ten allowed with remaining
-- 9..0, the eleventh refused without raising the count, users counted apart,
-- an expired window restarting, and a NULL auth.uid() refused.
--
-- now() is the transaction timestamp, so every call below shares one instant;
-- an expired window is made by moving window_started_at back as postgres.
-- ============================================

begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

select plan(21);

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

-- Clears the JWT only, leaving the database role alone, so auth.uid() is NULL
-- while the caller still holds EXECUTE: that exercises the in-function guard
-- rather than the grant.
create or replace function tests.clear_jwt()
returns void language plpgsql set search_path = '' as $$
begin
  perform set_config('request.jwt.claims', '', true);
end; $$;

grant execute on all functions in schema tests to authenticated, anon;

-- ============================================
-- Fixtures
-- ============================================
create temporary table t_ids as
select
  tests.create_test_user('upload-count-me@example.com') as me_id,
  tests.create_test_user('upload-count-other@example.com') as other_id;

grant select on t_ids to authenticated, anon;

create temporary table t_claims (seq integer, allowed boolean, remaining integer);
grant select, insert on t_claims to authenticated;

-- ============================================
-- Structure and privileges
-- ============================================
select has_table('public', 'love_note_upload_counts', 'LNU-DB-001: love_note_upload_counts exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.love_note_upload_counts'::regclass),
  true,
  'LNU-DB-002: RLS is enabled on love_note_upload_counts'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'love_note_upload_counts'),
  0,
  'LNU-DB-003: love_note_upload_counts carries no policies'
);

select ok(
  not has_table_privilege('authenticated', 'public.love_note_upload_counts', 'SELECT, INSERT, UPDATE, DELETE'),
  'LNU-DB-004: authenticated holds none of SELECT, INSERT, UPDATE, DELETE on love_note_upload_counts'
);

select ok(
  not has_table_privilege('anon', 'public.love_note_upload_counts', 'SELECT, INSERT, UPDATE, DELETE'),
  'LNU-DB-005: anon holds none of SELECT, INSERT, UPDATE, DELETE on love_note_upload_counts'
);

select ok(
  (select prosecdef from pg_proc where oid = 'public.claim_love_note_upload()'::regprocedure),
  'LNU-DB-006: claim_love_note_upload is SECURITY DEFINER'
);

select is(
  (select proconfig from pg_proc where oid = 'public.claim_love_note_upload()'::regprocedure),
  array['search_path=""'],
  'LNU-DB-007: claim_love_note_upload pins an empty search_path'
);

select ok(
  not has_function_privilege('anon', 'public.claim_love_note_upload()', 'EXECUTE'),
  'LNU-DB-008: anon does not hold EXECUTE on claim_love_note_upload'
);

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select * from public.claim_love_note_upload()$$,
  '42501',
  'permission denied for function claim_love_note_upload',
  'LNU-DB-009: anon cannot call claim_love_note_upload'
);
reset role;

-- ============================================
-- One window, as ME
-- ============================================
select tests.authenticate_as((select me_id from t_ids));

do $$
begin
  for i in 1..10 loop
    insert into t_claims
    select i, c.allowed, c.remaining from public.claim_love_note_upload() c;
  end loop;
end
$$;

select results_eq(
  $$select seq, allowed, remaining from t_claims order by seq$$,
  $$values (1, true, 9), (2, true, 8), (3, true, 7), (4, true, 6), (5, true, 5),
           (6, true, 4), (7, true, 3), (8, true, 2), (9, true, 1), (10, true, 0)$$,
  'LNU-DB-010: ten uploads in one window are all allowed, remaining 9 down to 0'
);

select results_eq(
  $$select allowed, remaining from public.claim_love_note_upload()$$,
  $$values (false, 0)$$,
  'LNU-DB-011: the eleventh upload in the window is refused with remaining 0'
);

-- The table is closed to the caller even at the limit (AC: not readable or
-- writable with their own JWT).
select throws_ok(
  $$select upload_count from public.love_note_upload_counts$$,
  '42501',
  'permission denied for table love_note_upload_counts',
  'LNU-DB-012: the caller cannot read love_note_upload_counts'
);

select throws_ok(
  $$update public.love_note_upload_counts set upload_count = 0$$,
  '42501',
  'permission denied for table love_note_upload_counts',
  'LNU-DB-013: the caller cannot reset their count with an UPDATE'
);

select throws_ok(
  $$delete from public.love_note_upload_counts$$,
  '42501',
  'permission denied for table love_note_upload_counts',
  'LNU-DB-014: the caller cannot reset their count with a DELETE'
);

reset role;
select is(
  (select upload_count from public.love_note_upload_counts where user_id = (select me_id from t_ids)),
  10,
  'LNU-DB-015: the refused eleventh call left the stored count at 10'
);

-- ============================================
-- A second user is counted apart
-- ============================================
select tests.authenticate_as((select other_id from t_ids));
select results_eq(
  $$select allowed, remaining from public.claim_love_note_upload()$$,
  $$values (true, 9)$$,
  'LNU-DB-016: a second user''s first upload is allowed with remaining 9'
);

reset role;
select results_eq(
  $$select user_id, upload_count from public.love_note_upload_counts
     where user_id in ((select me_id from t_ids), (select other_id from t_ids))
     order by upload_count$$,
  $$select other_id, 1 from t_ids union all select me_id, 10 from t_ids$$,
  'LNU-DB-017: the two users'' counts are independent'
);

-- ============================================
-- An expired window restarts
-- ============================================
update public.love_note_upload_counts
   set window_started_at = now() - interval '61 seconds'
 where user_id = (select me_id from t_ids);

select tests.authenticate_as((select me_id from t_ids));
select results_eq(
  $$select allowed, remaining from public.claim_love_note_upload()$$,
  $$values (true, 9)$$,
  'LNU-DB-018: once the window has expired the next upload is allowed with remaining 9'
);

reset role;
select results_eq(
  $$select window_started_at, upload_count from public.love_note_upload_counts
     where user_id = (select me_id from t_ids)$$,
  $$values (now(), 1)$$,
  'LNU-DB-019: the expired window restarted at now with a count of 1'
);

-- A window exactly one minute old has expired too (the boundary is inclusive).
update public.love_note_upload_counts
   set window_started_at = now() - interval '1 minute', upload_count = 10
 where user_id = (select me_id from t_ids);

select tests.authenticate_as((select me_id from t_ids));
select results_eq(
  $$select allowed, remaining from public.claim_love_note_upload()$$,
  $$values (true, 9)$$,
  'LNU-DB-020: a full window exactly one minute old restarts'
);

-- ============================================
-- No session
-- ============================================
select tests.clear_jwt();
select throws_ok(
  $$select * from public.claim_love_note_upload()$$,
  'Authentication required',
  'LNU-DB-021: a NULL auth.uid() is refused'
);

select * from finish();
rollback;
