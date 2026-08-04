-- love_notes idempotency key (LN-DB-001 .. 006)
--
-- The duplicate-note defect: sendNote/retryFailedMessage issued a bare INSERT
-- with no client key, so a retry after a lost response added a second identical
-- row. These assert the constraint that makes the resend resolve instead.
--
-- Helpers are declared inline rather than pulled from 00_helpers.sql: that file
-- creates its schema inside a transaction that rolls back, so the objects do
-- not exist by the time this file runs (matches 03_scripture_rpcs.sql).

begin;

select plan(6);

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

-- ---------------------------------------------------------------------------

do $$
declare
  v_sender uuid;
  v_recipient uuid;
begin
  v_sender := tests.create_test_user('ln-sender@test.local');
  v_recipient := tests.create_test_user('ln-recipient@test.local');
  perform set_config('tests.sender', v_sender::text, false);
  perform set_config('tests.recipient', v_recipient::text, false);
end
$$;

-- LN-DB-001: the column exists and carries a value without the client sending one
select col_not_null(
  'public', 'love_notes', 'idempotency_key',
  'LN-DB-001: love_notes.idempotency_key is NOT NULL'
);

-- LN-DB-002: uniqueness is on the pair, not the key alone
select col_is_unique(
  'public', 'love_notes', array['from_user_id', 'idempotency_key'],
  'LN-DB-002: (from_user_id, idempotency_key) is unique'
);

-- LN-DB-003: a first send is accepted
select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
    values (current_setting('tests.sender')::uuid,
            current_setting('tests.recipient')::uuid,
            'i love you', 'temp-abc-123')$$,
  'LN-DB-003: first send with a client key is accepted'
);

-- LN-DB-004: the retry of that same send is rejected rather than duplicated
select throws_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
    values (current_setting('tests.sender')::uuid,
            current_setting('tests.recipient')::uuid,
            'i love you', 'temp-abc-123')$$,
  '23505',
  null,
  'LN-DB-004: a resend under the same key violates the unique constraint'
);

-- LN-DB-005: two genuinely different messages still both land
select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
    values (current_setting('tests.sender')::uuid,
            current_setting('tests.recipient')::uuid,
            'i love you', 'temp-def-456')$$,
  'LN-DB-005: the same text sent again under a new key is a separate note'
);

-- LN-DB-006: the key is scoped to the sender, so the recipient reusing the same
-- string is not blocked by the sender's row
select lives_ok(
  $$insert into public.love_notes (from_user_id, to_user_id, content, idempotency_key)
    values (current_setting('tests.recipient')::uuid,
            current_setting('tests.sender')::uuid,
            'i love you too', 'temp-abc-123')$$,
  'LN-DB-006: the other partner may reuse the same key value'
);

select * from finish();

rollback;
