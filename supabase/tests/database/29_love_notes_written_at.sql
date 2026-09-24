-- love_notes.written_at (LNW-DB-001 .. 009)
--
-- The composition time a queued note carries (20260924010000). Display only,
-- set from the client's clock, so a BEFORE INSERT trigger NULLs a value that
-- cannot be a composition time -- later than now(), or older than 30 days --
-- and never rejects the insert over it.
--
-- Helpers are declared inline rather than pulled from 00_helpers.sql: that file
-- creates its schema inside a transaction that rolls back, so the objects do
-- not exist by the time this file runs.

begin;

select plan(9);

create schema if not exists tests;

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

do $$
begin
  perform set_config('tests.sender', tests.create_test_user('lnw-sender@test.local')::text, false);
  perform set_config('tests.recipient', tests.create_test_user('lnw-recipient@test.local')::text, false);
end
$$;

-- LNW-DB-001: the column exists, nullable, with no default
select col_is_null('public', 'love_notes', 'written_at',
  'LNW-DB-001: love_notes.written_at is nullable');
select col_hasnt_default('public', 'love_notes', 'written_at',
  'LNW-DB-002: love_notes.written_at has no default');

-- A note composed an hour ago and delivered now keeps its composition time.
insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, written_at)
values (current_setting('tests.sender')::uuid, current_setting('tests.recipient')::uuid,
        'written earlier', 'lnw-past', now() - interval '1 hour');

select is(
  (select written_at from public.love_notes where idempotency_key = 'lnw-past'),
  now() - interval '1 hour',
  'LNW-DB-003: a past written_at within 30 days is kept'
);

-- A client clock ahead of the server: the value cannot be a composition time.
select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, written_at)
    values (current_setting('tests.sender')::uuid, current_setting('tests.recipient')::uuid,
            'from the future', 'lnw-future', now() + interval '5 minutes')$$,
  'LNW-DB-004: a future written_at does not reject the insert'
);
select is(
  (select written_at from public.love_notes where idempotency_key = 'lnw-future'),
  null,
  'LNW-DB-005: a future written_at is stored as NULL'
);

-- A clock far behind: older than 30 days is NULLed, the note still lands.
select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key, written_at)
    values (current_setting('tests.sender')::uuid, current_setting('tests.recipient')::uuid,
            'from long ago', 'lnw-ancient', now() - interval '31 days')$$,
  'LNW-DB-006: a written_at older than 30 days does not reject the insert'
);
select is(
  (select written_at from public.love_notes where idempotency_key = 'lnw-ancient'),
  null,
  'LNW-DB-007: a written_at older than 30 days is stored as NULL'
);

-- An insert without it (an image note, an older client) stays NULL.
insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
values (current_setting('tests.sender')::uuid, current_setting('tests.recipient')::uuid,
        'no written time', 'lnw-omitted');
select is(
  (select written_at from public.love_notes where idempotency_key = 'lnw-omitted'),
  null,
  'LNW-DB-008: an insert without written_at leaves it NULL'
);

-- The read path carries it (the view's column list is frozen at creation).
select has_column('public', 'love_notes_visible', 'written_at',
  'LNW-DB-009: love_notes_visible exposes written_at');

select * from finish();

rollback;
