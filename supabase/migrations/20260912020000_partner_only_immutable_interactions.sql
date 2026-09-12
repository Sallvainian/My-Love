-- ============================================
-- Partner-only, immutable interactions (F4/F5, CAP-4/CAP-5)
--
-- `public.interactions` trusted whatever the caller put in the row:
--
--   * INSERT checked only `auth.uid() = from_user_id`
--     (20251206024345_remote_schema.sql:228-233), so any authenticated user who
--     had learned a UUID could poke or kiss a stranger, or themselves.
--   * UPDATE checked only recipient ownership and carried no WITH CHECK
--     (20251206024345_remote_schema.sql:316-321). PostgreSQL reuses the USING
--     expression when WITH CHECK is absent, so the recipient check was applied
--     twice and nothing made `type`, `from_user_id`, `to_user_id`, `id` or
--     `created_at` immutable. `authenticated` holds table-level ALL from
--     20260725170000_grant_api_roles_on_public.sql:35, so a recipient could
--     rewrite any column of a row it had received.
--
-- This migration moves both guarantees to the database:
--
--   1. INSERT requires sender-is-caller AND recipient-is-the-caller's-current-
--      partner, resolved through public.get_my_partner_id().
--   2. `authenticated` loses table-level UPDATE. Its only remaining UPDATE
--      privilege is the column grant on `viewed`.
--
-- Why column privileges rather than a trigger or an RPC.
-- rollout.md's F4/F5 row says to prefer the narrow privilege configuration if
-- the actual grants and clients support it. They do: the only UPDATE the app
-- issues is markAsViewed's `{ viewed: true }` (src/api/interactionService.ts).
-- A column grant makes every other column immutable without adding a function,
-- which matters because a new granted `public.` function would have to be
-- inserted into the exact-list assertion at
-- supabase/tests/database/18_function_execute_grants.sql:128-132, and F5
-- forbids a SECURITY DEFINER guard that would turn every client into a
-- privileged bypass. The trigger at
-- 20260818000001_partner_scoped_together_sessions_and_seeder_guard.sql:278-317
-- remains the fallback if a column grant ever stops fitting the API; PostgREST
-- only needs UPDATE on the columns actually present in the payload, so it fits
-- today.
--
-- Why the table-level revoke comes first.
-- 20260725170000_grant_api_roles_on_public.sql:35 granted ALL ON ALL TABLES to
-- anon, authenticated and service_role, and a table-level UPDATE subsumes any
-- column grant. Revoking and re-granting exactly what is needed is the same
-- shape 20260818000002_create_events_table.sql:106-107 uses for `events`.
-- service_role is deliberately left alone: the Playwright API specs delete
-- their fixtures with the service key.
--
-- Why plain `=` against get_my_partner_id(), with no null guard.
-- The function returns NULL for an unlinked caller, `x = NULL` evaluates to
-- NULL, and RLS admits a row only on TRUE -- so an unpartnered caller is
-- denied. Same reasoning as 20260912010000_private_couple_broadcast_policies.sql:30-33.
--
-- Why self-targeting needs no CHECK constraint.
-- `to_user_id = public.get_my_partner_id()` already rejects it: a client cannot
-- write its own partner_id (users_update_self_safe WITH CHECK,
-- 20260205000001_fix_users_rls_recursion.sql:50-55), and the only writer,
-- accept_partner_request, sources both ids from a partner_requests row carrying
-- the `no_self_requests` CHECK (20251206024345_remote_schema.sql:105-107). So
-- users.partner_id can never equal users.id.
--
-- Why `to authenticated` rather than implicit PUBLIC.
-- anon holds no EXECUTE on get_my_partner_id since
-- 20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:241-260, so a
-- PUBLIC policy would fail an anon request with "permission denied for function
-- get_my_partner_id" instead of a clean row-level-security denial
-- (20260818000002_create_events_table.sql:55-58).
--
-- Scope note: the SELECT policy "Users can view interactions to/from them" is
-- deliberately untouched. Interaction history is the user's own server-
-- authorized record, including exchanges with a former partner.
-- ============================================

begin;

-- ============================================
-- 1. INSERT: sender is the caller, recipient is the caller's current partner
-- ============================================
drop policy if exists "Users can insert interactions" on public.interactions;

create policy "interactions_sender_to_partner_insert"
  on public.interactions
  as permissive
  for insert
  to authenticated
  with check (
    from_user_id = (select auth.uid())
    and to_user_id = public.get_my_partner_id()
  );

-- ============================================
-- 2. UPDATE: the recipient may mark a received row viewed, and nothing else
-- ============================================
-- The WITH CHECK is stated explicitly rather than relying on PostgreSQL's reuse
-- of USING: with the column grant below, `to_user_id` cannot move anyway, and an
-- explicit clause keeps the row-level intent readable next to it.
drop policy if exists "Users can update received interactions" on public.interactions;

create policy "interactions_recipient_marks_viewed"
  on public.interactions
  as permissive
  for update
  to authenticated
  using (to_user_id = (select auth.uid()))
  with check (to_user_id = (select auth.uid()));

-- ============================================
-- 3. Privileges: no table-level UPDATE, only the `viewed` column
-- ============================================
revoke all on public.interactions from anon, authenticated;

grant select, insert on public.interactions to authenticated;
grant update (viewed) on public.interactions to authenticated;

commit;
