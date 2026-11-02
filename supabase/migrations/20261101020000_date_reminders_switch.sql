-- ============================================
-- Date reminders, story 4.3: a switch that turns date reminders off
--
-- The date reminders are local notifications the iOS shell schedules itself
-- (src/services/dateReminders.ts); no server sends them. A person who does not
-- want them turns them off in Settings. The switch rides on story 3.7's
-- `push_preferences` row, so it is account-kept like the six push switches: it
-- follows the person to a new device. The reminder planner reads it offline
-- through the `push-preferences` local copy; Settings shows it only from a
-- server read.
--
-- A missing row, like the default, means on. The `send-push` Edge Function
-- reads one named column per kind of push, so it neither reads nor is affected
-- by this column. Policies and grants are unchanged: the owner already selects,
-- inserts and updates their own row.
--
-- == Hosted catalog ==
-- Every object here is new; deploy.yml applies this migration to the hosted
-- project on merge to main.
--
-- pgTAP: supabase/tests/database/36_push_preferences.sql pins the column.
-- ============================================

begin;

alter table public.push_preferences
  add column date_reminders boolean not null default true;

comment on column public.push_preferences.date_reminders is
  'Whether the iOS shell schedules the account''s date reminders (local notifications); on by default. '
  'Not read by send-push, which sends no date reminder.';

commit;
