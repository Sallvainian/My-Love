-- Both partners read, edit and delete every event and anniversary.
--
-- Owner decision 2026-11-05: anniversaries work exactly like events, and a
-- partner's events and anniversaries are read and write, not read-only. So:
--
-- * anniversaries_select gains the partner arm events_select already has
--   (20260818000002_create_events_table.sql).
-- * events_update, events_delete, anniversaries_update and anniversaries_delete
--   admit the owner or the owner's partner. The partner arm is plain `=`
--   against get_my_partner_id(), which returns NULL for an unlinked caller, so
--   it denies rather than matches -- the same reasoning as events_select.
-- * Inserts stay owner-only: a new row is recorded under the person who adds it.
-- * user_id never changes. WITH CHECK can only see the new row, and now admits
--   either partner's id, so it no longer stops a row being handed between the
--   two; keep_date_owner() refuses any change of user_id with 42501, the code
--   the old check raised.
--
-- Hosted catalog read 2026-11-05: events and anniversaries carry exactly the
-- four policies each of their creating migrations, no hosted-only names.
-- Pinned by supabase/tests/database/20_events.sql and 27_local_data_tables.sql.

begin;

drop policy if exists "anniversaries_select" on public.anniversaries;
create policy "anniversaries_select" on public.anniversaries
  as permissive for select to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

drop policy if exists "anniversaries_update" on public.anniversaries;
create policy "anniversaries_update" on public.anniversaries
  as permissive for update to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  )
  with check (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

drop policy if exists "anniversaries_delete" on public.anniversaries;
create policy "anniversaries_delete" on public.anniversaries
  as permissive for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events
  as permissive for update to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  )
  with check (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events
  as permissive for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

create or replace function public.keep_date_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A date keeps the person who added it'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.keep_date_owner() is
  'Refuses an UPDATE that changes user_id on events and anniversaries: either '
  'partner may edit a date, but it stays recorded under the person who added it.';

revoke all on function public.keep_date_owner() from public, anon, authenticated;

drop trigger if exists events_keep_owner on public.events;
create trigger events_keep_owner
  before update on public.events
  for each row execute function public.keep_date_owner();

drop trigger if exists anniversaries_keep_owner on public.anniversaries;
create trigger anniversaries_keep_owner
  before update on public.anniversaries
  for each row execute function public.keep_date_owner();

comment on table public.events is
  'Couple-shared countdown events. Both partners read, edit and delete every '
  'row; a new row is inserted under its author, and keep_date_owner() keeps it '
  'there. Pinned by supabase/tests/database/20_events.sql.';

comment on table public.anniversaries is
  'Anniversary countdowns. Both partners read, edit and delete every row; a '
  'new row is inserted under its author. Pinned by '
  'supabase/tests/database/27_local_data_tables.sql.';

commit;
