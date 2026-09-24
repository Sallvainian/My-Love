-- Couple-level settings shared by one linked pair (spec-unified-data-storage,
-- story 3): the relationship start date. Story 4's wedding date joins it here.
--
-- One row per couple, keyed on the ORDERED pair (user_a < user_b), rather than
-- a column on each public.users row: two per-user columns could hold two
-- different dates, and writing both rows would need an RPC (the RPC set is
-- pinned by FN-GRANT-008 in 18_function_execute_grants.sql). Keying on the pair
-- also means an account that is later linked to someone else never sees the
-- old couple's row.
--
-- Access is the pair only: auth.uid() must be one side and get_my_partner_id()
-- the other. For an unlinked caller get_my_partner_id() is NULL, `x = NULL` is
-- NULL, and RLS admits a row only on TRUE -- so an unlinked caller reads and
-- writes nothing. There is no DELETE policy and no DELETE grant: a couple's
-- settings are cleared by writing NULL, never by removing the row.
--
-- Last write wins. updated_at is client-maintained, as on public.events and
-- public.anniversaries: there is deliberately no trigger (a trigger function
-- would be a new function in public), and the writing client sets it.
--
-- Nothing is seeded: no couple's data goes in a migration. A linked couple
-- with no row sees a "set your start date" placeholder until one partner sets
-- it. Pinned by supabase/tests/database/28_couple_settings.sql.

begin;

create table if not exists public.couple_settings (
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  relationship_start timestamptz,
  updated_at timestamptz default now() not null,
  constraint couple_settings_pkey primary key (user_a, user_b),
  constraint couple_settings_ordered_pair check (user_a < user_b)
);

comment on table public.couple_settings is
  'One row of shared settings per linked couple, keyed on the ordered pair '
  '(user_a < user_b). Readable and writable by the pair only: pinned by '
  'supabase/tests/database/28_couple_settings.sql.';
comment on column public.couple_settings.relationship_start is
  'When the couple got together: a date AND time, so the Home "Together for" '
  'counter keeps its hours, minutes and seconds. NULL until one partner sets it.';

-- The PK index serves user_a lookups; user_b needs its own for the FK cascade.
create index if not exists idx_couple_settings_user_b
  on public.couple_settings (user_b);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.couple_settings enable row level security;

create policy "couple_settings_select" on public.couple_settings
  as permissive for select to authenticated
  using (
    ((select auth.uid()) = user_a and user_b = (select public.get_my_partner_id()))
    or ((select auth.uid()) = user_b and user_a = (select public.get_my_partner_id()))
  );

create policy "couple_settings_insert" on public.couple_settings
  as permissive for insert to authenticated
  with check (
    ((select auth.uid()) = user_a and user_b = (select public.get_my_partner_id()))
    or ((select auth.uid()) = user_b and user_a = (select public.get_my_partner_id()))
  );

-- UPDATE states WITH CHECK explicitly: the row must still name the caller and
-- their partner after the update, so it cannot be re-pointed at another pair.
create policy "couple_settings_update" on public.couple_settings
  as permissive for update to authenticated
  using (
    ((select auth.uid()) = user_a and user_b = (select public.get_my_partner_id()))
    or ((select auth.uid()) = user_b and user_a = (select public.get_my_partner_id()))
  )
  with check (
    ((select auth.uid()) = user_a and user_b = (select public.get_my_partner_id()))
    or ((select auth.uid()) = user_b and user_a = (select public.get_my_partner_id()))
  );

-- ---------------------------------------------------------------------------
-- Grants: anon gets nothing; authenticated gets exactly what the policies use
-- ---------------------------------------------------------------------------

revoke all on public.couple_settings from anon, authenticated;
grant select, insert, update on public.couple_settings to authenticated;

commit;
