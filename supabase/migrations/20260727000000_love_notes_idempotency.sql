-- Give love_notes an idempotency key so a retried send cannot post twice.
--
-- sendNote() and retryFailedMessage() both issued a bare INSERT with no
-- client-supplied key, and the table had no uniqueness beyond its surrogate id.
-- When an INSERT committed but the response was lost -- dropped connection,
-- backgrounded tab, request timeout -- the client marked the note failed and
-- offered Retry, which re-sent the identical row. The partner's chat then
-- showed the same note twice, permanently, with no way for either client to
-- detect or collapse it.
--
-- The client already generates a `tempId` per composed message and reuses it on
-- retry, so it is the natural key; this just gives the server somewhere to put
-- it and something to enforce.
--
-- Deliberately NOT paired with an UPDATE policy. love_notes grants only INSERT
-- and SELECT, and the resend path uses ON CONFLICT DO NOTHING rather than DO
-- UPDATE, so a retry resolves to the row already stored instead of rewriting
-- it. Adding UPDATE purely to support merge-duplicates would also let a user
-- edit notes they had already sent.

begin;

alter table public.love_notes
  add column if not exists idempotency_key text;

-- Backfill before the NOT NULL. Existing rows get their own id, which is
-- unique per row and so cannot collide with anything.
update public.love_notes
  set idempotency_key = id::text
  where idempotency_key is null;

alter table public.love_notes
  alter column idempotency_key set default gen_random_uuid()::text;

alter table public.love_notes
  alter column idempotency_key set not null;

comment on column public.love_notes.idempotency_key is
  'Client-generated per composed message (tempId), reused on retry so a re-sent note resolves to the original row instead of inserting a second one.';

-- Scoped to the sender: two people may independently generate the same key
-- without colliding, and a user cannot suppress someone else''s note by
-- guessing theirs.
--
-- A plain constraint rather than a partial index: PostgREST''s on_conflict
-- cannot express an index predicate, so a partial unique index would not be
-- usable as a conflict target.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'love_notes_from_user_id_idempotency_key_key'
      and conrelid = 'public.love_notes'::regclass
  ) then
    alter table public.love_notes
      add constraint love_notes_from_user_id_idempotency_key_key
      unique (from_user_id, idempotency_key);
  end if;
end
$$;

commit;
