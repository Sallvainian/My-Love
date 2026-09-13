-- ============================================
-- Profile names belong to the profile, the email mirror belongs to auth (CAP-9/F9)
--
-- Two halves of the same ownership question, both wrong today.
--
--   * `public.sync_user_profile()` (20251206024345_remote_schema.sql:156-169) is
--     fired by `on_auth_user_created AFTER INSERT OR UPDATE ON auth.users`
--     (:369) and ends
--
--       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
--                                      display_name = EXCLUDED.display_name,
--                                      updated_at = NOW()
--
--     so EVERY auth update -- a sign-in touching last_sign_in_at, a token
--     refresh, an email change -- rewrites the profile name back to
--     `raw_user_meta_data->>'display_name'` or the email address. The chosen
--     name cannot survive in `public.users` while that branch stands, which is
--     why the client had to keep the name in auth metadata
--     (DisplayNameSetup.tsx:62) and read it back from there.
--
--   * `users_update_self_safe` (20260205000001_fix_users_rls_recursion.sql:39-55)
--     pins `partner_id` and nothing else, and `authenticated` holds table-level
--     ALL on every public table from
--     20260725170000_grant_api_roles_on_public.sql:35. So a signed-in client can
--     PATCH `public.users.email` on its own row to any string it likes. The
--     mirror is read as an identity by real code --
--     tests/support/auth/global-setup.ts:78 and tests/support/helpers/events.ts:50
--     resolve an account BY that column -- and partnerService surfaces it as the
--     partner's address (src/api/partnerService.ts:87-88). Nothing legitimate ever
--     writes it from the client: the definer sync above is its only writer.
--
-- This migration makes the trigger stop clobbering the name, and takes the email
-- mirror away from the client.
--
-- == Why the conflict branch keeps `email` but drops `display_name` ==
-- The INSERT seed is unchanged, so a brand-new row still gets
-- COALESCE(metadata display_name, email, 'Unknown') and a password signup that
-- carried a name in its metadata still lands with that name and never sees the
-- setup screen. What changes is the UPDATE path: after the row exists,
-- `display_name` is the profile's own column and auth has no further say in it.
-- `email` stays on the definer path precisely because the client is losing it
-- below -- something has to keep the mirror true, and the trigger is the only
-- writer that sees the authoritative value.
--
-- Existing rows are deliberately NOT backfilled or rewritten. Whatever name a
-- row carries now is what the last trigger firing left there, and the client's
-- "needs setup" rule treats the seed fallbacks (null, empty, the email, or
-- 'Unknown') as "no chosen name" so those users are offered the setup screen
-- once instead of having their row edited underneath them.
--
-- == Why a column privilege rather than a trigger ==
-- rollout.md's preference, and the same shape story 7 used for `interactions`
-- (20260912020000_partner_only_immutable_interactions.sql:113-124): the narrow
-- privilege configuration wins when the actual grants and the actual client
-- support it. They do. `grep -rn "from('users')" src` returns exactly one write
-- -- DisplayNameSetup.tsx -- and after this change it sends
-- `{ display_name, updated_at }` through a plain `.update().eq('id', uid)`.
-- Everything else in `src/` reads. PostgREST needs UPDATE only on the columns
-- actually present in the payload, so the two-column grant covers it.
--
-- A SECURITY INVOKER trigger comparing OLD.email to NEW.email was the stated
-- fallback. It is not needed, and it would cost more: a column privilege makes
-- the refusal a hard 42501 at the statement level rather than a raised
-- exception, it cannot be tricked by a no-op self-assignment, and it adds no
-- function that would have to be threaded into the exact-list assertion at
-- supabase/tests/database/18_function_execute_grants.sql:118-134.
--
-- == Why the table-level revoke comes first ==
-- 20260725170000_grant_api_roles_on_public.sql:35 granted ALL ON ALL TABLES to
-- anon, authenticated and service_role, and a table-level UPDATE subsumes any
-- column grant -- so granting columns without revoking the table first changes
-- nothing at all. `anon` is named in the revoke alongside `authenticated` for
-- the same reason 20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:368
-- names both on `partner_requests`: anon has no UPDATE policy on `public.users`
-- and so could never have updated a row, but leaving the privilege in place
-- makes the denial an empty result instead of a permission error, and leaves a
-- live table-level grant for a future policy to trip over. service_role is
-- deliberately untouched -- the Playwright specs and
-- tests/support/auth/global-setup.ts:99-109 link partner pairs with the service
-- key, and `accept_partner_request` is SECURITY DEFINER so it runs as the owner
-- and never consults these grants either.
--
-- == What is deliberately NOT touched ==
-- `users_update_self_safe` and its `partner_id` pin, `get_my_partner_id()`, the
-- SELECT policy, the INSERT policy, and every privilege other than UPDATE. No
-- policy is added, renamed or dropped on `public.users`, so no `policies_are`
-- array anywhere in supabase/tests/database/ has to move
-- (`grep -rn "policies_are..public., .users." supabase/tests` returns nothing).
-- The public schema shape is unchanged -- a column privilege is not a column --
-- so `src/types/database.types.ts` does not need regenerating.
-- ============================================

begin;

-- ============================================
-- 1. The trigger seeds a name once and never rewrites it
-- ============================================
-- CREATE OR REPLACE, not DROP + CREATE: replacing in place preserves both the
-- ACL (the revocation re-asserted below is belt-and-braces, not the load-bearing
-- part) and the dependency from `on_auth_user_created`, which a DROP would have
-- to cascade and rebuild. Same SECURITY DEFINER and same search_path as
-- 20251206024345_remote_schema.sql:156-161.
create or replace function public.sync_user_profile()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
BEGIN
  INSERT INTO public.users (id, email, display_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, 'Unknown'), NOW(), NOW())
  -- `display_name` is absent on purpose: once the row exists the profile owns
  -- its own name. See this file's header.
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- FN-GRANT-009 (18_function_execute_grants.sql:136-139) pins that this function
-- is callable by nobody. Postgres checks EXECUTE on a trigger function at
-- CREATE TRIGGER time rather than at fire time, so `on_auth_user_created` keeps
-- working with no grant at all. Re-asserted here so that a future DROP + CREATE
-- of this function -- which DOES re-derive the ACL from the default privileges,
-- unlike the CREATE OR REPLACE above -- has a revocation next to it to copy.
revoke execute on function public.sync_user_profile() from public, anon;
revoke execute on function public.sync_user_profile() from authenticated, service_role;

-- ============================================
-- 2. The email mirror leaves the client's reach
-- ============================================
revoke update on public.users from anon, authenticated;

-- `updated_at` rides along with `display_name` because the client sets it in the
-- same payload and there is no BEFORE UPDATE trigger on `public.users` to supply
-- it -- the only two triggers this repo creates are on_auth_user_created on
-- auth.users and scripture_sessions_freeze_membership on scripture_sessions
-- (20260818000001:314). `email`, `id`, `partner_id`, `partner_name`, `device_id` and
-- `created_at` are all omitted: `partner_id` moves only through
-- accept_partner_request, and nothing in src/ has ever written the other four.
grant update (display_name, updated_at) on public.users to authenticated;

commit;
