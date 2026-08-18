-- Per-user love note removal (LNR-DB-001 .. 013)
--
-- The property under test: a removal is one-way, private to the user who made
-- it, and never reaches the partner's copy of the message. The love_notes row
-- IS the partner's copy, so anything that mutated or deleted it would be a bug
-- rather than a feature.
--
-- Helpers are declared inline rather than pulled from 00_helpers.sql: that file
-- creates its schema inside a transaction that rolls back, so the objects do
-- not exist by the time this file runs (matches 15_love_notes_idempotency.sql).

begin;

select plan(13);

create schema if not exists tests;

-- The helpers are called again after the role has switched to `authenticated`,
-- which cannot reach the schema without these (matches 02_rls_policies.sql:8-9).
grant usage on schema tests to authenticated, anon;
alter default privileges in schema tests grant execute on functions to authenticated, anon;

create or replace function tests.create_test_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', p_email, '', now(), now(), now());
  insert into public.users (id, email) values (v_id, p_email)
    on conflict (id) do nothing;
  return v_id;
end;
$$;

create or replace function tests.authenticate_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated',
                      'aud', 'authenticated')::text, true);
end;
$$;

create or replace function tests.be_postgres()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixture: A and B hold a conversation; C is an unrelated third party.
-- ---------------------------------------------------------------------------

do $$
declare
  v_a uuid; v_b uuid; v_c uuid; v_n1 uuid; v_n2 uuid; v_bc uuid;
begin
  v_a := tests.create_test_user('lnr-a@test.local');
  v_b := tests.create_test_user('lnr-b@test.local');
  v_c := tests.create_test_user('lnr-c@test.local');

  -- Five notes between A and B, oldest first, with distinct timestamps so the
  -- keyset ordering under test is deterministic. Note 1 carries an image so the
  -- partner's attachment can be asserted intact after A removes it.
  insert into public.love_notes (from_user_id, to_user_id, content, image_url,
                                 idempotency_key, created_at)
  values (v_a, v_b, 'note one',   'lnr/a/one.jpg', 'lnr-k1', now() - interval '5 min')
  returning id into v_n1;

  insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, created_at)
  values (v_b, v_a, 'note two',   'lnr-k2', now() - interval '4 min')
  returning id into v_n2;

  insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, created_at)
  values (v_a, v_b, 'note three', 'lnr-k3', now() - interval '3 min');
  insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, created_at)
  values (v_b, v_a, 'note four',  'lnr-k4', now() - interval '2 min');
  insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, created_at)
  values (v_a, v_b, 'note five',  'lnr-k5', now() - interval '1 min');

  -- A note A is not a party to.
  insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
  values (v_b, v_c, 'not for a', 'lnr-k6')
  returning id into v_bc;

  perform set_config('tests.a',  v_a::text,  false);
  perform set_config('tests.b',  v_b::text,  false);
  perform set_config('tests.c',  v_c::text,  false);
  perform set_config('tests.n1', v_n1::text, false);
  perform set_config('tests.n2', v_n2::text, false);
  perform set_config('tests.bc', v_bc::text, false);
end
$$;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'love_note_removals',
  'LNR-DB-001: love_note_removals table exists');

-- The blanket GRANT ALL in 20260725170000_grant_api_roles_on_public.sql leaves a
-- new public table open to every authenticated user unless RLS is turned on.
select is(
  (select relrowsecurity from pg_class where oid = 'public.love_note_removals'::regclass),
  true,
  'LNR-DB-002: row level security is enabled on love_note_removals');

select col_is_pk('public', 'love_note_removals', array['user_id', 'note_id'],
  'LNR-DB-003: (user_id, note_id) is the primary key, so removing twice converges');

-- Exact set: adding a DELETE or UPDATE policy here would reintroduce undo, which
-- the spec rules out. This assertion is what makes that a failing build.
select policies_are('public', 'love_note_removals',
  array['love_note_removals_select', 'love_note_removals_insert'],
  'LNR-DB-004: love_note_removals carries exactly the select and insert policies');

-- love_notes_visible is `select n.*`, which freezes the column list at creation.
-- Without this, a later migration adding a column to love_notes would leave the
-- client silently reading a view that no longer matches the table.
select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'love_notes_visible'),
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'love_notes'),
  'LNR-DB-005: love_notes_visible exposes exactly love_notes'' columns');

-- ---------------------------------------------------------------------------
-- Behaviour: the removal is private to the remover
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

insert into public.love_note_removals (user_id, note_id)
values (current_setting('tests.a')::uuid, current_setting('tests.n1')::uuid);

select is(
  (select count(*)::int from public.love_notes_visible
    where id = current_setting('tests.n1')::uuid),
  0,
  'LNR-DB-006: the remover no longer reads the note through the view');

select tests.authenticate_as(current_setting('tests.b')::uuid);

select is(
  (select content || '|' || coalesce(image_url, '')
     from public.love_notes_visible
    where id = current_setting('tests.n1')::uuid),
  'note one|lnr/a/one.jpg',
  'LNR-DB-007: the partner still reads the note, content and image intact');

select tests.authenticate_as(current_setting('tests.c')::uuid);

-- Scoped to A and B's conversation: C legitimately sees their own note with B,
-- so a bare count over the view would be 1 and would prove nothing.
select is(
  (select count(*)::int from public.love_notes_visible
    where (from_user_id = current_setting('tests.a')::uuid
           and to_user_id = current_setting('tests.b')::uuid)
       or (from_user_id = current_setting('tests.b')::uuid
           and to_user_id = current_setting('tests.a')::uuid)),
  0,
  'LNR-DB-008: a third party reads none of someone else''s conversation through the view');

-- ---------------------------------------------------------------------------
-- Behaviour: what a user may not do
-- ---------------------------------------------------------------------------

select tests.authenticate_as(current_setting('tests.a')::uuid);

select throws_ok(
  format($$insert into public.love_note_removals (user_id, note_id)
           values (%L, %L)$$,
         current_setting('tests.b'), current_setting('tests.n2')),
  '42501',
  null,
  'LNR-DB-009: a user cannot record a removal on their partner''s behalf');

select throws_ok(
  format($$insert into public.love_note_removals (user_id, note_id)
           values (%L, %L)$$,
         current_setting('tests.a'), current_setting('tests.bc')),
  '42501',
  null,
  'LNR-DB-010: a user cannot remove a note they are not a party to');

-- No DELETE policy and no DELETE privilege: removal is one-way.
select throws_ok(
  format($$delete from public.love_note_removals where user_id = %L$$,
         current_setting('tests.a')),
  '42501',
  null,
  'LNR-DB-011: a user cannot delete a removal, so there is no undo');

-- ---------------------------------------------------------------------------
-- Behaviour: the underlying message is untouched, and pages still fill
-- ---------------------------------------------------------------------------

select tests.be_postgres();

select is(
  (select content from public.love_notes where id = current_setting('tests.n1')::uuid),
  'note one',
  'LNR-DB-012: the love_notes row itself survives the removal unchanged');

select tests.authenticate_as(current_setting('tests.a')::uuid);

-- A has five notes with B and has removed one. A limit of 4 must still come back
-- with 4 rows; if the exclusion ran after the limit it would return 3 and
-- notesHasMore would lie.
select is(
  (select count(*)::int from (
     select id from public.love_notes_visible
      where (from_user_id = current_setting('tests.a')::uuid
             and to_user_id = current_setting('tests.b')::uuid)
         or (from_user_id = current_setting('tests.b')::uuid
             and to_user_id = current_setting('tests.a')::uuid)
      order by created_at desc
      limit 4) page),
  4,
  'LNR-DB-013: a page still fills to its limit when a removal falls inside it');

select tests.be_postgres();

select * from finish();

rollback;
