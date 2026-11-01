-- ============================================
-- pgTAP: love_notes_read_markers (20261101000000)
--
-- Pinned here: RLS on, the exact policy set, the grants (select only for
-- authenticated, nothing for anon), the owner's read, the refusal across
-- accounts, mark_love_notes_read() (sets the row, refuses a null auth.uid()),
-- and unread_love_note_count (only notes to the user, from others, newer than
-- the marker; every note with no row; not executable by authenticated or anon).
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
  insert into public.users (id, email, display_name) values (user_id, test_email, 'Marker ' || left(test_email, 4))
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
  tests.create_test_user('marker-a@example.com') as a_id,
  tests.create_test_user('marker-b@example.com') as b_id;

grant select on t_ids to authenticated, anon;

-- ============================================
-- Structure, RLS and policy set
-- ============================================
select has_table('public', 'love_notes_read_markers', 'MARKER-001: love_notes_read_markers exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.love_notes_read_markers'::regclass),
  'MARKER-002: RLS is enabled'
);

select policies_are(
  'public', 'love_notes_read_markers',
  array['Users can view own love notes read marker'],
  'MARKER-003: exactly the one owner SELECT policy'
);

select is(
  (select string_agg(distinct roles::text, ',') from pg_policies where tablename = 'love_notes_read_markers'),
  '{authenticated}',
  'MARKER-004: the policy is TO authenticated'
);

select ok(
  has_table_privilege('authenticated', 'public.love_notes_read_markers', 'SELECT')
  and not has_table_privilege('authenticated', 'public.love_notes_read_markers', 'INSERT, UPDATE, DELETE'),
  'MARKER-005: authenticated can select and cannot write'
);

select ok(
  not has_table_privilege('anon', 'public.love_notes_read_markers', 'SELECT, INSERT, UPDATE, DELETE'),
  'MARKER-006: anon has no privilege at all'
);

select ok(
  has_table_privilege('service_role', 'public.love_notes_read_markers', 'SELECT'),
  'MARKER-007: service_role can read it'
);

select fk_ok('public', 'love_notes_read_markers', 'user_id', 'auth', 'users', 'id',
  'MARKER-008: user_id references auth.users');

select col_is_pk('public', 'love_notes_read_markers', 'user_id', 'MARKER-009: user_id is the primary key');

-- ============================================
-- Function grants
-- ============================================
select ok(
  has_function_privilege('authenticated', 'public.mark_love_notes_read()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.mark_love_notes_read()', 'EXECUTE'),
  'MARKER-010: mark_love_notes_read is executable by authenticated, not by anon'
);

select ok(
  not has_function_privilege('authenticated', 'public.unread_love_note_count(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.unread_love_note_count(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.unread_love_note_count(uuid)', 'EXECUTE'),
  'MARKER-011: unread_love_note_count is service_role only'
);

-- ============================================
-- Counting (as the superuser, which is how the service role reaches it)
-- ============================================
-- A and B write each other; A has no marker row yet.
insert into public.love_notes (from_user_id, to_user_id, content, created_at)
select b_id, a_id, 'b to a, old', now() - interval '3 hours' from t_ids;
insert into public.love_notes (from_user_id, to_user_id, content, created_at)
select a_id, b_id, 'a to b', now() - interval '2 hours' from t_ids;
insert into public.love_notes (from_user_id, to_user_id, content, created_at)
select b_id, a_id, 'b to a, newer', now() - interval '1 hour' from t_ids;

select is(
  public.unread_love_note_count((select a_id from t_ids)),
  2,
  'MARKER-012: with no marker row every note received counts'
);

select is(
  public.unread_love_note_count((select b_id from t_ids)),
  1,
  'MARKER-013: and only notes to the user, never the ones they sent'
);

insert into public.love_notes_read_markers (user_id, last_opened_at)
select a_id, now() - interval '90 minutes' from t_ids;

select is(
  public.unread_love_note_count((select a_id from t_ids)),
  1,
  'MARKER-014: only notes newer than the marker count'
);

update public.love_notes_read_markers set last_opened_at = now();

select is(
  public.unread_love_note_count((select a_id from t_ids)),
  0,
  'MARKER-015: a marker newer than every note counts none'
);

insert into public.love_notes (from_user_id, to_user_id, content, created_at)
select b_id, a_id, 'b to a, after marker', now() + interval '1 second' from t_ids;

select is(
  public.unread_love_note_count((select a_id from t_ids)),
  1,
  'MARKER-016: a note after the marker counts'
);

-- ============================================
-- The owner and the RPC
-- ============================================
select tests.authenticate_as((select a_id from t_ids));

select is(
  (select count(*)::int from public.love_notes_read_markers),
  1,
  'MARKER-017: the owner reads their own row'
);

select throws_ok(
  $$insert into public.love_notes_read_markers (user_id) select a_id from t_ids on conflict (user_id) do nothing$$,
  '42501',
  null,
  'MARKER-018: the owner cannot write the table directly'
);

select ok(
  public.mark_love_notes_read() >= now() - interval '1 minute',
  'MARKER-019: mark_love_notes_read returns the server time'
);

select is(
  (select count(*)::int from public.love_notes_read_markers where last_opened_at <= now() and last_opened_at > now() - interval '1 minute'),
  1,
  'MARKER-020: and sets the row to it'
);

-- B has no row; the RPC creates it.
select tests.authenticate_as((select b_id from t_ids));

select is(
  (select count(*)::int from public.love_notes_read_markers),
  0,
  'MARKER-021: another account reads no row of the owner'
);

select lives_ok(
  $$select public.mark_love_notes_read()$$,
  'MARKER-022: an account with no row marks read'
);

select is(
  (select count(*)::int from public.love_notes_read_markers),
  1,
  'MARKER-023: and then reads its own row only'
);

-- ============================================
-- anon and a null auth.uid()
-- ============================================
reset role;
select tests.clear_jwt();
select throws_ok(
  $$select public.mark_love_notes_read()$$,
  'Authentication required',
  'MARKER-024: mark_love_notes_read rejects a null auth.uid()'
);

set local role anon;
select throws_ok(
  $$select public.mark_love_notes_read()$$,
  '42501',
  null,
  'MARKER-025: anon cannot execute mark_love_notes_read'
);
reset role;

-- ============================================
-- Cascade
-- ============================================
delete from auth.users where id = (select a_id from t_ids);
select is(
  (select count(*)::int from public.love_notes_read_markers where user_id = (select a_id from t_ids)),
  0,
  'MARKER-026: deleting the account deletes its marker'
);

select * from finish();
rollback;
