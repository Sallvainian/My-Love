-- Couple-shared events (spec-dynamic-events, story 1: data foundation only).
--
-- event_date is a `date`, deliberately not `timestamptz`: a timestamptz stores
-- one absolute instant and each browser projects it onto its own wall clock, so
-- the calendar date itself becomes viewer-dependent (New York and Berlin can
-- disagree about which day an event falls on). A `date` comes back from
-- PostgREST as a bare "YYYY-MM-DD" string every viewer reads identically, and
-- each partner's own local midnight then decides when a card flips.
--
-- No couple_id column: partner visibility is the SELECT policy below, via
-- public.get_my_partner_id() -- not a direct read of public.users, which is the
-- photos anti-pattern (20251203190800:55-63).

begin;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null check (char_length(label) <= 100),
  event_date date not null,
  description text check (char_length(description) <= 500),
  icon text not null default 'calendar' check (icon in ('ring', 'plane', 'calendar')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.events is
  'Couple-shared countdown events. Creator-only writes, both partners read. The '
  'creator-only rule lives entirely in the four RLS policy predicates: UPDATE '
  'and DELETE must be granted for the creator to use them, and a grant cannot '
  'distinguish creator from partner, so the privilege layer is no backstop. '
  'Pinned by supabase/tests/database/20_events.sql.';
comment on column public.events.event_date is
  'A calendar date, not an instant: every viewer reads the same YYYY-MM-DD and '
  'their own local midnight decides when the card flips.';
comment on column public.events.icon is
  'Mirrors the IconType union in src/components/RelationshipTimers/EventCountdown.tsx.';
comment on column public.events.updated_at is
  'Client-maintained: the writing client must set updated_at on every UPDATE, as '
  'src/api/moodApi.ts does for moods (updated_at: new Date().toISOString()). '
  'There is deliberately no trigger, and PostgREST does not set it.';

-- The events read is "my events and my partner''s, soonest first", so the index
-- is on the event date, not created_at (shape follows photos:37-38).
create index if not exists idx_events_user_event_date
  on public.events (user_id, event_date);

-- Mandatory in this same migration. 20260725170000_grant_api_roles_on_public.sql:35
-- grants ALL on all public tables -- present and future (:40-41) -- to anon,
-- authenticated and service_role, so a new public table without RLS is readable
-- and writable by every authenticated user. RLS is the gate.
alter table public.events enable row level security;

-- All four policies `to authenticated`, not implicit PUBLIC: the SELECT arm
-- calls get_my_partner_id(), on which anon holds no EXECUTE since 20260818000000,
-- so a PUBLIC policy would make an anon request fail with "permission denied for
-- function get_my_partner_id" instead of a clean row-level-security denial
-- (recorded at 20260818000001:205-210).
--
-- Plain `=` against get_my_partner_id(), deliberately not `is not distinct
-- from`, and no null guard: the function returns NULL for an unlinked caller,
-- `user_id = NULL` evaluates to NULL, and RLS admits a row only on TRUE -- so
-- NULL denies. `is not distinct from` would instead make NULL match NULL.
create policy "events_select"
  on public.events
  as permissive
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or user_id = public.get_my_partner_id()
  );

create policy "events_insert"
  on public.events
  as permissive
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- UPDATE states `with check` as well as `using`: omitting it makes Postgres
-- reuse USING as the check (the shape recorded at 20260818000001:234-243). Here
-- the check is what stops a creator donating a row by rewriting user_id to
-- their partner's.
create policy "events_update"
  on public.events
  as permissive
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "events_delete"
  on public.events
  as permissive
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Unlike love_note_removals (20260817000000:105-109), the privilege layer
-- CANNOT restate the creator-only rule: UPDATE and DELETE must be granted for
-- the creator to use them, and a grant cannot distinguish creator from partner.
-- So the creator-only restriction lives entirely in the four policy predicates
-- above, with no second line of defence; supabase/tests/database/20_events.sql
-- is what guards it.
revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;

commit;
