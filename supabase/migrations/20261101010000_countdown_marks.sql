-- ============================================
-- Date reminders, story 4.2: dates marked for the countdown
--
-- A person marks the dates they want an early heads-up for. A marked date gets
-- "In a month: ..." and "In a week: ..." local reminders at 9:00 on top of the
-- day-before one; the planner is src/services/dateReminders.ts. A mark is one
-- row, `(user_id, date_key)`, and unmarking deletes it, so a missing row is
-- "not marked". Marks belong to the person who set them: a partner can neither
-- read nor write them.
--
-- == Keys ==
--   event:<events.id>               an event
--   anniversary:<anniversaries.id>  one of the person's own anniversaries
--   relationship-start, wedding, own-birthday, partner-birthday
--                                   the fixed dates
-- A key that matches no current date is ignored by the client, and nothing
-- here cleans up a mark whose date was deleted.
--
-- == Writes ==
-- The owner writes directly. A mark is an insert with
-- `upsert(..., { onConflict: 'user_id,date_key', ignoreDuplicates: true })`
-- (a retried mark is a no-op) and an unmark is a delete. There is no update,
-- so there is no UPDATE policy to get WITH CHECK wrong.
--
-- == Hosted catalog ==
-- Every object here is new; deploy.yml applies this migration to the hosted
-- project on merge to main.
--
-- pgTAP: supabase/tests/database/38_countdown_marks.sql pins the policies, the
-- grants and the key check.
-- ============================================

begin;

create table public.countdown_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date_key),
  constraint countdown_marks_date_key_check check (
    date_key in ('relationship-start', 'wedding', 'own-birthday', 'partner-birthday')
    or date_key ~ '^(event|anniversary):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

comment on table public.countdown_marks is
  'One row per date a person marked for a month-and-a-week-before reminder; a missing row is not marked. '
  'Private to its owner. Pinned by supabase/tests/database/38_countdown_marks.sql.';

comment on column public.countdown_marks.date_key is
  'event:<events.id>, anniversary:<anniversaries.id>, or one of relationship-start, wedding, own-birthday, partner-birthday.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.countdown_marks enable row level security;

revoke all on public.countdown_marks from anon, authenticated;
grant select, insert, delete on public.countdown_marks to authenticated;

create policy "Users can view own countdown marks"
  on public.countdown_marks for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own countdown marks"
  on public.countdown_marks for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can delete own countdown marks"
  on public.countdown_marks for delete
  to authenticated
  using (user_id = (select auth.uid()));

commit;
