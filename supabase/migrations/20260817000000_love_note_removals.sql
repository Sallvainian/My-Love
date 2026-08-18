-- Per-user removal of a love note ("delete for me"), and the read path that honours it.
--
-- Why a separate table
-- --------------------
-- There is exactly one love_notes row per message, and it IS simultaneously the
-- partner's copy, so a removal must not touch it. It cannot be a flag column
-- either: 20260727000000_love_notes_idempotency.sql:15-19 records the standing
-- decision -- "Deliberately NOT paired with an UPDATE policy. love_notes grants
-- only INSERT and SELECT" ... "Adding UPDATE purely to support merge-duplicates
-- would also let a user edit notes they had already sent." So the removal gets
-- its own per-user table and love_notes keeps exactly the two policies it has.
--
-- Why a view rather than an RPC
-- ----------------------------
-- PostgREST cannot express a NOT EXISTS anti-join as a plain query, and the
-- anti-join has to run before the LIMIT: notesSlice.ts:236 and :318 both derive
-- notesHasMore as `(data?.length || 0) === limit`, so a page filtered after the
-- response would be short and the flag would lie.
--
-- A view keeps the client's query shape -- .or()/.lt()/.order()/.limit() are
-- unchanged, only the relation name moves -- which also keeps the four E2E
-- interceptors on '**/rest/v1/love_notes**' (tests/e2e/notes/love-notes.spec.ts:
-- 18,39,54,67) matching, where an RPC at /rest/v1/rpc/ would not. And
-- security_definer_view is an ERROR-level lint in the CI gate
-- (.github/workflows/supabase-migrations.yml:68), so the security property below
-- is enforced forever; there is no equivalent lint for a function.

begin;

-- ---------------------------------------------------------------------------
-- 1. The removal record
-- ---------------------------------------------------------------------------

-- auth.users(id), matching love_notes.from_user_id / to_user_id at
-- 20251203000001_create_base_schema.sql:116-117.
create table if not exists public.love_note_removals (
  user_id    uuid        not null references auth.users(id)        on delete cascade,
  note_id    uuid        not null references public.love_notes(id) on delete cascade,
  removed_at timestamptz not null default now(),
  constraint love_note_removals_pkey primary key (user_id, note_id)
);

comment on table public.love_note_removals is
  'One row per (user, love_note) the user has removed from their own history. The '
  'love_notes row is never touched -- it is simultaneously the partner''s copy. '
  'Insert-only: removal is one-way, so this table carries no UPDATE and no DELETE '
  'policy and neither privilege is granted.';

-- (user_id, note_id) is the primary key and serves the anti-join, which is an
-- equality on both columns. This second index only serves the FK cascade from
-- love_notes and auth.users, which would otherwise seq-scan per deleted row.
create index if not exists idx_love_note_removals_note
  on public.love_note_removals (note_id);

-- Mandatory in this same migration. 20260725170000_grant_api_roles_on_public.sql:35
-- runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated,
-- service_role;` and :40-41 extends that to future tables via ALTER DEFAULT
-- PRIVILEGES, so a new public table without RLS is readable and writable by every
-- authenticated user. RLS is the gate.
alter table public.love_note_removals enable row level security;

-- A user reads only their own removals. This is also what makes the anti-join in
-- love_notes_visible correct under security_invoker: a caller cannot see, and so
-- cannot be filtered by, anyone else's removals.
create policy "love_note_removals_select"
  on public.love_note_removals
  as permissive
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- A user records a removal only for themselves, and only for a note they are a
-- party to -- the same test love_notes' own SELECT policy applies at
-- 20251206024345_remote_schema.sql:260.
create policy "love_note_removals_insert"
  on public.love_note_removals
  as permissive
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.love_notes n
      where n.id = note_id
        and (    (select auth.uid()) = n.from_user_id
              or (select auth.uid()) = n.to_user_id )
    )
  );

-- Deliberately no UPDATE and no DELETE policy: there is no undo and no restore.
-- The privilege layer says the same thing, so "insert-only" holds even if a
-- future migration adds a policy without thinking it through.
revoke all on public.love_note_removals from anon, authenticated;
grant select, insert on public.love_note_removals to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The filtered read path
-- ---------------------------------------------------------------------------

-- security_invoker: love_notes' own SELECT policy ("Users can view their own
-- messages", 20251206024345_remote_schema.sql:255-260) still decides visibility,
-- so a third party reads zero rows through this view exactly as through the table.
create or replace view public.love_notes_visible
  with (security_invoker = true)
  as
select n.*
from public.love_notes n
where not exists (
  select 1
  from public.love_note_removals r
  where r.note_id = n.id
    and r.user_id = (select auth.uid())
);

comment on view public.love_notes_visible is
  'love_notes minus the rows the calling user has removed for themselves. '
  'security_invoker, so love_notes RLS still applies and the partner''s view is '
  'unaffected. Read paths select from here instead of love_notes so the exclusion '
  'happens before the LIMIT and notesHasMore stays honest. NOTE: `select n.*` '
  'freezes the column list at creation -- a migration that adds a column to '
  'love_notes must recreate this view, and 17_love_note_removals.sql fails if it '
  'does not.';

revoke all on public.love_notes_visible from anon, authenticated;
grant select on public.love_notes_visible to authenticated;

commit;
