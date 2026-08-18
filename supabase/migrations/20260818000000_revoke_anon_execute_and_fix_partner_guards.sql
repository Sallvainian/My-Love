-- ============================================
-- Migration: Close the anon-executable SECURITY DEFINER surface
-- Created: 2026-08-17
--
-- Fixes Supabase advisor lints 0028 (anon_security_definer_function_executable)
-- and 0029 (authenticated_security_definer_function_executable), which fired on
-- the nine SECURITY DEFINER functions in `public` plus one that exists only on
-- the hosted project (see the note on drift below).
--
-- Three of those warnings were not cosmetic. Verified against the local stack.
--
-- 1. accept_partner_request -- unauthenticated forced partner link (critical)
-- --------------------------------------------------------------------------
-- The recipient check was written as:
--
--     IF auth.uid() != v_to_user_id THEN
--       RAISE EXCEPTION 'Only the recipient can accept a partner request';
--     END IF;
--
-- For an anonymous caller auth.uid() is NULL, so `NULL != v_to_user_id` is NULL,
-- and plpgsql treats a NULL condition as false. The RAISE never fires and both
-- `UPDATE users SET partner_id` statements run as the definer, bypassing RLS.
--
-- Demonstrated end to end: an attacker signs up, sends a partner request to a
-- victim (permitted -- the INSERT policy only requires auth.uid() = from_user_id),
-- then replays the accept RPC with the Authorization header removed. The link is
-- created without the victim ever seeing the request. Holding partner_id then
-- grants SELECT on the victim's `users` row, every `moods` row and note, every
-- `photos` row, and the underlying `storage.objects` in the `photos` and
-- `love-notes-images` buckets.
--
-- It is also unrecoverable for the victim: `users_update_self_safe` forbids
-- clearing your own partner_id, and there is no unlink RPC.
--
-- 2. decline_partner_request -- same NULL-poisoned guard (medium)
-- --------------------------------------------------------------
-- Identical shape. An unauthenticated caller who knows a request id can kill a
-- pending link. Bounded by the id being unguessable and unreadable to anon, but
-- the sender knows their own id and is explicitly not supposed to decline.
--
-- 3. scripture_seed_test_data -- test seeder on the public API (critical)
-- ----------------------------------------------------------------------
-- Reachable by anon and by every signed-in user. Its only production guard is
-- `current_setting('app.environment', true) = 'production'`, and that GUC is set
-- nowhere -- not in config.toml, not in CI, not in any migration, and not on the
-- hosted project -- so it returns NULL and the guard never fires anywhere.
-- Since 20260725180000 the function takes explicit p_user1_id / p_user2_id and
-- only checks that those users exist, never that the caller owns them. Passing
-- p_user1_id = victim, p_user2_id = self mints a `together` session whose
-- user2_id is the attacker, and the scripture_sessions policies key on
-- `user1_id = auth.uid() OR user2_id = auth.uid()` -- a forced pairing that
-- skips the partner_requests flow entirely. p_session_count is unvalidated too.
--
-- The remaining six were verified non-exploitable BY ANON and are tightened here
-- only as defense in depth: get_my_partner_id, is_scripture_session_member,
-- scripture_get_couple_stats and scripture_submit_reflection return nothing to a
-- NULL auth.uid(); scripture_create_session has a real `IS NULL` guard;
-- sync_user_profile RETURNS trigger so PostgREST cannot invoke it.
--
-- "Non-exploitable by anon" is the whole claim. scripture_create_session in
-- particular still lets any signed-in user open a `together` session naming any
-- other user id, with no partner link and no consent -- that is a separate
-- authenticated-user bug, out of scope here, not something this migration fixes.
--
-- Why the revoke is written the way it is
-- ---------------------------------------
-- `REVOKE ... FROM anon` alone is a no-op on the local stack: proacl there is
-- NULL or `{=X/postgres,...}`, i.e. the privilege is held by PUBLIC, and an ACL
-- check is a union with no deny entry. PUBLIC is the grantee that matters. The
-- hosted project additionally carries an explicit `anon=X/postgres` from its own
-- `pg_default_acl` row (postgres | public | f), so both must be revoked to cover
-- both environments.
--
-- Revoking PUBLIC also removes the implicit grant that `authenticated` and
-- `service_role` were riding on. Four functions never had an explicit grant
-- (accept_partner_request, decline_partner_request, is_scripture_session_member,
-- scripture_seed_test_data -- the last lost its 20260128000001 grant when
-- 20260309000001 and 20260725180000 dropped and recreated it), so they are
-- granted explicitly below. Without that, revoking PUBLIC would 42501 the
-- partner accept/decline buttons and every scripture read, because the nine RLS
-- policies on scripture_step_states, scripture_reflections, scripture_bookmarks
-- and scripture_messages call is_scripture_session_member and are declared TO
-- public, so the function executes as the invoking role.
--
-- The revoke loops over pg_proc rather than naming functions, because the hosted
-- project has one function this repo does not: get_random_daily_message(text).
-- No migration creates it and nothing in src/ or tests/ calls it, so it is drift
-- rather than a dependency, but naming it explicitly would abort this migration
-- with 42883 on every environment that does not have it.
--
-- HOW THIS REGRESSES, AND WHY THERE IS NO PREVENTION HERE
-- ------------------------------------------------------
-- A plain REVOKE survives CREATE OR REPLACE and unrelated later DDL, but
-- DROP FUNCTION + CREATE FUNCTION creates a new object that re-derives its ACL
-- from scratch and lands anon-executable again. This repo already drops and
-- recreates functions in three migrations, so this is a live risk, not a
-- theoretical one.
--
-- The obvious guard does not work. Measured on PostgreSQL 17.6:
--
--   alter default privileges for role postgres in schema public
--     revoke execute on functions from anon, public;
--
-- is a no-op. PUBLIC's EXECUTE on a new function comes from the hardwired
-- acldefault(), not from a pg_default_acl row, and a schema-scoped entry is
-- merged onto that default with add-only semantics -- it can grant more, never
-- subtract. After running the statement above, the stored row reads
-- `{postgres=X/postgres}` and a freshly created function still reports
-- has_function_privilege('anon', ..., 'EXECUTE') = true.
--
-- The global form (same statement without `IN SCHEMA public`) does work, but it
-- strips PUBLIC EXECUTE from every schema this role creates functions in, which
-- breaks the `tests.*` helpers that each pgTAP file defines inline -- verified:
-- the suite drops from 158 passing to 108 with it applied. Not worth it.
--
-- So this migration does not prevent the regression; it detects it.
-- supabase/tests/database/18_function_execute_grants.sql enumerates every
-- function in `public` and fails if any of them becomes anon-executable, and
-- `supabase test db` runs in CI. A future DROP+CREATE goes red there.
--
-- NOTE FOR FUTURE MIGRATIONS: if you DROP and CREATE a function in `public`,
-- re-apply its REVOKE and its GRANT in the same migration. CREATE OR REPLACE is
-- safe and preserves the ACL.
-- ============================================

begin;

-- ============================================
-- 1. accept_partner_request: deny a NULL auth.uid() explicitly
-- ============================================
-- Body is unchanged from 20251206024345 apart from the guard.
create or replace function public.accept_partner_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  DECLARE
    v_caller_id UUID;
    v_from_user_id UUID;
    v_to_user_id UUID;
    v_request_status TEXT;
  BEGIN
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT from_user_id, to_user_id, status
    INTO v_from_user_id, v_to_user_id, v_request_status
    FROM partner_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Partner request not found';
    END IF;

    IF v_request_status != 'pending' THEN
      RAISE EXCEPTION 'Partner request is not pending';
    END IF;

    -- IS DISTINCT FROM, not !=: a NULL on either side must deny, not fall
    -- through. v_to_user_id is NOT NULL in practice, but the operator makes the
    -- guard correct regardless of which side is NULL.
    IF v_caller_id IS DISTINCT FROM v_to_user_id THEN
      RAISE EXCEPTION 'Only the recipient can accept a partner request';
    END IF;

    IF EXISTS (
      SELECT 1 FROM users
      WHERE id IN (v_from_user_id, v_to_user_id)
      AND partner_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'One or both users already have a partner';
    END IF;

    UPDATE users SET partner_id = v_to_user_id, updated_at = now()
    WHERE id = v_from_user_id;

    UPDATE users SET partner_id = v_from_user_id, updated_at = now()
    WHERE id = v_to_user_id;

    UPDATE partner_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = p_request_id;

    UPDATE partner_requests
    SET status = 'declined', updated_at = now()
    WHERE id != p_request_id
      AND status = 'pending'
      AND (from_user_id IN (v_from_user_id, v_to_user_id)
           OR to_user_id IN (v_from_user_id, v_to_user_id));
  END;
  $function$;

-- ============================================
-- 2. decline_partner_request: same fix
-- ============================================
create or replace function public.decline_partner_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  DECLARE
    v_caller_id UUID;
    v_to_user_id UUID;
  BEGIN
    v_caller_id := auth.uid();

    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT to_user_id
    INTO v_to_user_id
    FROM partner_requests
    WHERE id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Partner request not found or already processed';
    END IF;

    IF v_caller_id IS DISTINCT FROM v_to_user_id THEN
      RAISE EXCEPTION 'Only the recipient can decline a partner request';
    END IF;

    UPDATE partner_requests
    SET status = 'declined', updated_at = now()
    WHERE id = p_request_id;
  END;
  $function$;

-- ============================================
-- 3. Drop anon/PUBLIC execute across public
-- ============================================
-- Extension-owned routines are skipped so this never touches objects the repo
-- does not own; today `public` holds only the 15 application functions, because
-- pgtap and friends are installed into `extensions`.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as routine
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on routine %s from anon', r.routine);
    execute format('revoke execute on routine %s from public', r.routine);
  end loop;
end;
$$;

-- ============================================
-- 4. Restore the grants the app actually needs
-- ============================================
-- These four rode on PUBLIC's implicit grant and would 42501 without this.
grant execute on function public.accept_partner_request(uuid) to authenticated;
grant execute on function public.decline_partner_request(uuid) to authenticated;

-- Required by the nine RLS policies that call it (they are declared TO public,
-- so the function runs as the invoking role, not as the policy owner).
grant execute on function public.is_scripture_session_member(uuid) to authenticated;

-- Test seeder: service_role only. tests/support/factories/index.ts:147 calls it
-- through the admin client, which is the only caller in the repo. It is
-- deliberately NOT granted to authenticated -- that is lint 0029, and the whole
-- point is that a signed-in user must not be able to seed rows into someone
-- else's account.
grant execute on function public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)
  to service_role;

-- The remaining app functions already carry an explicit `authenticated` grant
-- from their own migrations, which step 3 left untouched. Re-stated here so a
-- reader can see the intended end state in one place, and so the local stack
-- matches the hosted project where the platform default ACL had granted them.
grant execute on function public.get_my_partner_id() to authenticated;
grant execute on function public.scripture_create_session(text, uuid) to authenticated;
grant execute on function public.scripture_get_couple_stats() to authenticated;
grant execute on function public.scripture_submit_reflection(uuid, int, int, text, boolean) to authenticated;
grant execute on function public.scripture_select_role(uuid, text) to authenticated;
grant execute on function public.scripture_toggle_ready(uuid, boolean) to authenticated;
grant execute on function public.scripture_convert_to_solo(uuid) to authenticated;
grant execute on function public.scripture_lock_in(uuid, int, int) to authenticated;
grant execute on function public.scripture_undo_lock_in(uuid, int) to authenticated;
grant execute on function public.scripture_end_session(uuid) to authenticated;

-- ============================================
-- 4b. Revoke from `authenticated` where the grant is explicit, not implicit
-- ============================================
-- Step 3 only removes anon and PUBLIC, which is enough on a local stack: there,
-- `authenticated` reaches these two purely through PUBLIC, so revoking PUBLIC
-- takes it away as a side effect.
--
-- The hosted project is NOT shaped like that. Its pg_default_acl carries
--
--   postgres | public | f | {postgres=X/postgres,anon=X/postgres,
--                            authenticated=X/postgres,service_role=X/postgres}
--
-- so every function there holds a SEPARATE, explicit `authenticated=X` entry
-- that survives revoking PUBLIC. Verified after applying steps 1-4 to
-- xojempkrugifnaveqtqc: anon was correctly false everywhere, but
-- scripture_seed_test_data still reported authenticated = true -- lint 0029 was
-- still firing and the seeder was still reachable by every signed-in user, which
-- is the whole point of locking it down. These two revokes are what actually
-- close it on hosted; on local they are harmless no-ops.
revoke execute on function public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)
  from authenticated;

-- sync_user_profile is intentionally callable by nobody. It RETURNS trigger, so
-- PostgREST cannot expose it, and Postgres checks EXECUTE on a trigger function
-- at CREATE TRIGGER time rather than at fire time, so on_auth_user_created keeps
-- working with no grant at all.
revoke execute on function public.sync_user_profile() from authenticated, service_role;

-- Not touched: service_role's explicit grants on the remaining functions, which
-- exist on hosted and not on local. service_role is the trusted secret key, the
-- advisor lints do not cover it, and broad service_role access is Supabase's
-- normal posture -- so this migration deliberately does not try to make the two
-- environments byte-identical there. anon and authenticated, which are what the
-- lints and the threat model care about, ARE identical on both after this runs.

-- service_role is also deliberately not re-granted on anything but the seeder.
-- It rode on PUBLIC before this migration and nothing in the repo needs it:
-- scripture_seed_test_data is the only RPC called through the admin client
-- (tests/support/factories/index.ts:147), and service_role has BYPASSRLS, so it
-- never evaluates a policy that would call is_scripture_session_member. A future
-- Edge Function that calls an RPC server-side needs its own explicit grant.

-- ============================================
-- 5. Close the same hole one layer up: direct UPDATE on partner_requests
-- ============================================
-- Fixing the NULL guard above stops an ANONYMOUS caller from forging a partner
-- link. It does not stop a SIGNED-IN one, because accept_partner_request trusts
-- the row it reads, and the row was writable by the attacker:
--
--   policy "Users can update received requests" ON partner_requests
--     FOR UPDATE USING ((SELECT auth.uid()) = to_user_id)
--
-- had no WITH CHECK, and Postgres reuses USING for the check when WITH CHECK is
-- absent. That constrains only to_user_id, leaving from_user_id and status
-- unconstrained. So the recipient of any request can rewrite from_user_id to an
-- arbitrary victim and then accept it legitimately -- the caller really is
-- to_user_id, so the repaired guard passes. Verified end to end: attacker gets a
-- burner account to send them a request, PATCHes from_user_id to the victim,
-- accepts, and reads the victim's moods and profile. Same irreversible link, one
-- free signup instead of none.
--
-- A WITH CHECK cannot express the rule, because RLS check expressions cannot see
-- OLD -- there is no way to say "from_user_id must not change". The write path is
-- unnecessary anyway: the app never UPDATEs this table (src/api/partnerService.ts
-- inserts at :184 and selects at :222; accept and decline go through the two
-- SECURITY DEFINER RPCs), so the fix is to remove the path rather than fence it.
--
-- Both RPCs keep working: they are SECURITY DEFINER, so their UPDATEs are
-- checked against the owner, not the caller. No pgTAP `policies_are` array
-- covers partner_requests, so nothing in supabase/tests/database needs editing.
drop policy if exists "Users can update received requests" on public.partner_requests;

revoke update on public.partner_requests from anon, authenticated;

commit;
