-- When a love note was written, kept apart from when the server received it.
--
-- Love-note text is queued on the device and sent later when the device is
-- offline (services/noteQueue.ts), so a note written at 9:00 and delivered at
-- 14:00 got created_at 14:00 and showed 14:00. created_at stays the server's
-- delivery time and keeps ordering the thread: the thread order, the
-- pagination cursor (`created_at <`) and the refresh merge all key on it and
-- must not change. written_at is display-only: the client sets it from the
-- queued row's composition time, and the bubble shows it when it is
-- meaningfully earlier than created_at. NULL means "not known" (an image note,
-- an older client, or a value the trigger below refused).
--
-- The client's clock sets it, so a BEFORE INSERT trigger NULLs a value that
-- cannot be a composition time: one later than now(), or older than 30 days.
-- It never rejects the insert: a rejection would mark a valid note failed.
--
-- UPDATE: love_notes has RLS enabled and no UPDATE policy (pinned exactly by
-- policies_are in 26_love_notes_and_users_policies.sql), so no client can
-- change written_at, or anything else, after insert. Only INSERT needs the
-- guard.
--
-- Inserts are table-granted (20260725170000_grant_api_roles_on_public.sql), not
-- column-granted, so no GRANT is needed for the new column.
--
-- love_notes_visible is `select n.*`, whose column list was frozen when it was
-- created, so it is replaced here to carry written_at (17_love_note_removals.sql
-- LNR-DB-005 fails otherwise). Same query, same security_invoker, comment and
-- grants as 20260817000000_love_note_removals.sql; CREATE OR REPLACE VIEW may
-- only append columns, which is all `n.*` now does.
--
-- Pinned by supabase/tests/database/29_love_notes_written_at.sql.

begin;

alter table public.love_notes
  add column if not exists written_at timestamptz;

comment on column public.love_notes.written_at is
  'When the sender wrote the note, from the client''s clock; NULL when unknown. '
  'Display only: ordering and pagination use created_at, the server delivery '
  'time. A value later than now() or older than 30 days is NULLed on insert by '
  'love_notes_written_at_guard.';

-- SECURITY INVOKER: it reads nothing and writes only NEW.
create or replace function public.love_notes_written_at_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.written_at is not null
     and (new.written_at > now() or new.written_at < now() - interval '30 days') then
    new.written_at := null;
  end if;
  return new;
end;
$$;

comment on function public.love_notes_written_at_guard() is
  'BEFORE INSERT on love_notes: NULLs a written_at later than now() or older than '
  '30 days (a wrong client clock). Never rejects the insert.';

-- Every function in public is reachable at /rest/v1/rpc/<name>, and
-- 18_function_execute_grants.sql pins who may call which (FN-GRANT-002/008).
-- Postgres checks EXECUTE on a trigger function at CREATE TRIGGER time only,
-- so the trigger fires with no grant at all.
revoke execute on function public.love_notes_written_at_guard() from public, anon, authenticated;

drop trigger if exists love_notes_written_at_guard on public.love_notes;
create trigger love_notes_written_at_guard
  before insert on public.love_notes
  for each row
  execute function public.love_notes_written_at_guard();

-- The read path, recreated to carry the new column. Unchanged otherwise.
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
