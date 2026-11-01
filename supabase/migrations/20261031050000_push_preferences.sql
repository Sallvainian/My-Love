-- ============================================
-- Push notifications, story 3.7: a switch for each kind of push
--
-- A person can stop one kind of push without turning off every notification
-- in iOS. `push_preferences` holds one boolean per kind, one row per account:
--
--   love_notes        love_note
--   moods             mood
--   photos            photo
--   pokes_and_kisses  interaction
--   dates             date
--   partner_requests  partner_request and partner_accept
--
-- A missing row means every kind is on, in the sender and in the client, so
-- no account needs a row until it turns something off. The `send-push` Edge
-- Function reads the RECEIVER's switch for the kind after it resolves the
-- recipient and before it lists any device; a switch that is off builds no
-- push for any of their devices. A failed read answers 500.
--
-- == Writes ==
-- The owner writes their own row directly: an upsert on user_id that sends
-- only user_id and one column, so two switches toggled quickly never
-- overwrite each other (PostgREST's merge updates only the columns it is
-- sent). That needs SELECT, INSERT and UPDATE; there is no DELETE. The UPDATE
-- policy states WITH CHECK explicitly, because Postgres reuses USING as the
-- check and this repo was bitten by that three times.
--
-- The table is named for pushes in general so story 4.3 can add a reminders
-- column to it.
--
-- == Hosted catalog ==
-- Every object here is new; deploy.yml applies this migration to the hosted
-- project on merge to main, before the sender is redeployed. Until it is, the
-- old sender knows no switch and pushes every kind.
--
-- pgTAP: supabase/tests/database/36_push_preferences.sql pins the policies,
-- the grants and the defaults.
-- ============================================

begin;

create table public.push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  love_notes boolean not null default true,
  moods boolean not null default true,
  photos boolean not null default true,
  pokes_and_kisses boolean not null default true,
  dates boolean not null default true,
  partner_requests boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.push_preferences is
  'One row per account: a switch for each kind of push, all on by default (a missing row is all on). '
  'Read by the send-push Edge Function for the receiver and written by its owner. '
  'Pinned by supabase/tests/database/36_push_preferences.sql.';

comment on column public.push_preferences.created_at is
  'When the row was created; a later switch change does not move it.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.push_preferences enable row level security;

revoke all on public.push_preferences from anon, authenticated;
grant select, insert, update on public.push_preferences to authenticated;

create policy "Users can view own push preferences"
  on public.push_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own push preferences"
  on public.push_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own push preferences"
  on public.push_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
