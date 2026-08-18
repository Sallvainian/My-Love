-- ============================================
-- Migration: Stop forced `together` pairings, and give the test seeder a guard
--            that actually fires
-- Created: 2026-08-17
--
-- Two follow-ups to 20260818000000, which closed the anon-executable surface.
-- Neither of these is reachable by an anonymous caller, so no advisor lint flags
-- them; both are reachable by any signed-in user.
--
-- 1. Forced `together` sessions
-- ----------------------------
-- scripture_create_session validated p_partner_id only as
--
--     if not exists (select 1 from auth.users where id = p_partner_id)
--
-- i.e. "is this a real account", never "is this MY partner". Any signed-in user
-- could therefore name any other user by id and open a `together` session with
-- them. Both rows then satisfy is_scripture_session_member, and
-- scripture_messages_select is keyed on exactly that, so the attacker gets a
-- two-way message channel with a stranger plus SELECT/UPDATE on the session --
-- bypassing the partner_requests flow entirely.
--
-- Fixing the RPC alone would have been cosmetic. `authenticated` holds a direct
-- INSERT grant on scripture_sessions and the insert policy read
--
--     with check (user1_id = auth.uid())
--
-- which constrains only user1_id. Verified: a client can skip the RPC, INSERT a
-- `together` row naming any victim as user2_id, and the victim immediately
-- returns true from is_scripture_session_member. So the policy is tightened in
-- the same migration. Its NAME is unchanged, so the `policies_are` array in
-- supabase/tests/database/02_rls_policies.sql:70-73 still matches and needs no
-- edit.
--
-- Sessions forced before this migration are cleaned up below.
--
-- 2. The seeder's guard that never fired
-- --------------------------------------
-- scripture_seed_test_data's only in-body protection was
--
--     if current_setting('app.environment', true) = 'production' then raise
--
-- and `app.environment` is set in no environment -- not supabase/config.toml,
-- not .github/, not any migration, and not on the hosted project -- so
-- current_setting returned NULL and the branch was dead everywhere, production
-- included. 20260818000000 already revoked EXECUTE from anon and authenticated,
-- so the hole is closed by the grant today; this replaces the dead branch so
-- that a future DROP FUNCTION + CREATE FUNCTION (which resets the ACL and
-- re-grants PUBLIC, and which this repo has already done twice to this very
-- function) does not silently reopen arbitrary cross-account seeding.
--
-- The obvious guard does not work: inside a SECURITY DEFINER function
-- `current_user` is the OWNER, so it reads 'postgres' for attacker and admin
-- alike. Measured. The `role` GUC is not rewritten by SECURITY DEFINER and still
-- reports the role PostgREST switched to, so that is what the new guard reads.
--
-- Rejected alternative: setting app.environment properly via
-- `ALTER DATABASE ... SET` in supabase/seed.sql. `postgres` is not superuser on
-- Supabase and the statement fails with "permission denied to set parameter",
-- seed.sql never runs against a remote project anyway, and ALTER DATABASE does
-- not reach PostgREST's already-open connections.
--
-- Both functions use CREATE OR REPLACE, never DROP: a DROP would reset proacl
-- and undo 20260818000000's revokes.
-- ============================================

begin;

-- ============================================
-- 1a. scripture_create_session: require the caller's real partner
-- ============================================
-- Body is unchanged from the live definition apart from the guard noted inline.
CREATE OR REPLACE FUNCTION public.scripture_create_session(p_mode text, p_partner_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_result jsonb;
  v_start_phase public.scripture_session_phase;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_mode not in ('solo', 'together') then
    raise exception 'Invalid mode: %. Must be solo or together.', p_mode;
  end if;

  if p_mode = 'together' and p_partner_id is null then
    raise exception 'Partner ID is required for together mode.';
  end if;

  if p_mode = 'together' then
    if p_partner_id = v_user_id then
      raise exception 'Partner cannot be the current user.';
    end if;

    -- Only the caller's own linked partner. p_partner_id arrives from the client
    -- and used to be validated only as "is some auth.users row", which let any
    -- signed-in user open a `together` session naming a stranger -- both sides
    -- then satisfy is_scripture_session_member, which is a two-way
    -- scripture_messages channel the victim never agreed to.
    --
    -- IS DISTINCT FROM, not <>: an unpartnered caller reads NULL here and must be
    -- denied rather than fall through a NULL comparison.
    --
    -- This sits BEFORE the reuse lookup below on purpose. Behind it, a session
    -- forced before this migration would still be handed back by the reuse
    -- branch, reopening the same channel.
    --
    -- Accepted consequence of that ordering: a couple who unlinks can no longer
    -- REJOIN an in-progress together lobby through this RPC, only read the row
    -- they are already a member of. That is the right trade against re-serving a
    -- forced session, and nothing reachable regresses -- the Together button is
    -- disabled unless partnerStatus is 'linked'
    -- (src/components/scripture-reading/containers/ScriptureOverview.tsx:509) --
    -- and scripture_convert_to_solo remains available to the stranded caller.
    --
    -- public. qualification is required: this function is SET search_path TO ''.
    if p_partner_id is distinct from public.get_my_partner_id() then
      raise exception 'Together mode requires your linked partner.'
        using errcode = '42501';
    end if;

    -- Reuse existing in-progress together session for this exact pair (any user order).
    -- Only reuse sessions still in lobby phase — sessions that have progressed
    -- past lobby (reading, reflection, etc.) should not be reused.
    select s.id
      into v_session_id
      from public.scripture_sessions s
      where s.mode = 'together'
        and s.status = 'in_progress'
        and s.current_phase = 'lobby'
        and (
          (s.user1_id = v_user_id and s.user2_id = p_partner_id)
          or
          (s.user1_id = p_partner_id and s.user2_id = v_user_id)
        )
      order by s.started_at desc
      limit 1;
  end if;

  if v_session_id is null then
    v_start_phase := case
      when p_mode = 'together' then 'lobby'::public.scripture_session_phase
      else 'reading'::public.scripture_session_phase
    end;

    insert into public.scripture_sessions (
      mode,
      user1_id,
      user2_id,
      current_phase,
      current_step_index,
      status,
      version,
      started_at
    ) values (
      p_mode::public.scripture_session_mode,
      v_user_id,
      case when p_mode = 'together' then p_partner_id else null end,
      v_start_phase,
      0,
      'in_progress'::public.scripture_session_status,
      1,
      now()
    )
    returning id into v_session_id;
  end if;

  select jsonb_build_object(
    'id', s.id,
    'mode', s.mode,
    'user1_id', s.user1_id,
    'user2_id', s.user2_id,
    'current_phase', s.current_phase,
    'current_step_index', s.current_step_index,
    'status', s.status,
    'version', s.version,
    'started_at', s.started_at,
    'completed_at', s.completed_at
  )
    into v_result
    from public.scripture_sessions s
    where s.id = v_session_id;

  return v_result;
end;
$function$;

-- ============================================
-- 1b. Close the direct-INSERT path that bypasses the RPC entirely
-- ============================================
-- Same policy name as before, so the policies_are array in
-- supabase/tests/database/02_rls_policies.sql still matches.
-- `user2_id is null` covers solo sessions.
drop policy if exists scripture_sessions_insert on public.scripture_sessions;

-- `to authenticated`, not the previous implicit PUBLIC: the check calls
-- get_my_partner_id(), on which anon holds no EXECUTE since 20260818000000, so a
-- PUBLIC policy makes an anon INSERT fail with "permission denied for function
-- get_my_partner_id" instead of a clean row-level-security denial. Both refuse
-- the write; scoping the policy keeps the error honest and drops the dependency
-- on anon's grants.
--
-- Knowingly NOT applied to the nine TO public policies from 20260128000001 that
-- call is_scripture_session_member, which anon likewise no longer holds EXECUTE
-- on, so anon still gets the function error on those tables. The reasoning is
-- the same but the cost is not: this policy was being rewritten anyway, whereas
-- re-declaring nine otherwise-untouched policies across four tables to change an
-- error message that no app or test path can reach unauthenticated is churn with
-- no security gain. Both forms deny. If those policies are rewritten for another
-- reason, add `to authenticated` then.
create policy scripture_sessions_insert on public.scripture_sessions
  for insert
  to authenticated
  with check (
    user1_id = (select auth.uid())
    and (
      user2_id is null
      or user2_id = public.get_my_partner_id()
    )
  );

-- ============================================
-- 1c. Close the UPDATE path, which the INSERT policy does not cover
-- ============================================
-- scripture_sessions_update is
--
--     using ((user1_id = auth.uid()) or (user2_id = auth.uid()))
--
-- with no WITH CHECK, so Postgres reuses USING as the check -- the same shape as
-- the partner_requests bug fixed in 20260818000000. Verified: an attacker creates
-- a SOLO session (no partner required), then UPDATEs it to
-- `mode = 'together', user2_id = <victim>`. USING still passes because they are
-- still user1_id, and the victim immediately returns true from
-- is_scripture_session_member. Tightening only the INSERT policy left this open.
--
-- A WITH CHECK cannot express the rule: it cannot see OLD, so it cannot say
-- "user2_id must not change". Stating it as a value constraint instead --
-- "user2_id must be the pair's partner" -- would also strand a legitimate
-- in-flight session the moment a couple unlinks, because every later phase/step
-- UPDATE would start failing the check. A BEFORE UPDATE trigger says exactly
-- what is meant and nothing more.
--
-- user2_id is allowed to become NULL because scripture_convert_to_solo does
-- precisely that (`set mode = 'solo', user2_id = null`). What is forbidden is
-- moving it to a NEW non-null value, which is the only shape the attack needs.
-- SECURITY INVOKER, which keeps it off the SECURITY DEFINER advisor surface
-- entirely (lints 0028/0029). search_path is still pinned: lint 0011
-- (function_search_path_mutable) applies to every function, not only definer
-- ones, and this repo already has a migration dedicated to that class
-- (20260221000001_fix_function_search_paths.sql). The body references no object,
-- so the empty path costs nothing.
--
-- The trigger is unconditional: row triggers are not skipped for table owners or
-- BYPASSRLS roles, so this also blocks postgres and service_role. A future
-- migration that legitimately needs to repoint membership must wrap its UPDATE in
--   alter table public.scripture_sessions disable trigger scripture_sessions_freeze_membership;
--   ... ; alter table public.scripture_sessions enable trigger ...;
--
-- One existing writer, and it is worth knowing about: tests/support/helpers/
-- scripture-overview.ts:74-79 (adoptSessionForBrowserUser) issues
-- `supabaseAdmin.from('scripture_sessions').update({ user1_id: browserUserId })`
-- on the paths used by scripture-reflection-2.2, 2.2-errors and 2.3. It passes
-- only because it is now a no-op: tests/support/factories/index.ts:140-144 seeds
-- onto the same worker user the browser is signed in as, and `is distinct from`
-- lets an unchanged value through. Verified both ways -- same id updates fine,
-- a different id raises 42501. If those ids ever diverge that helper fails loudly
-- instead of silently reassigning, which is the intended outcome; the helper
-- carries a note saying so.
create or replace function public.scripture_sessions_freeze_membership()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.user1_id is distinct from old.user1_id then
    raise exception 'scripture_sessions.user1_id is immutable'
      using errcode = '42501';
  end if;

  -- Unchanged, or cleared by scripture_convert_to_solo. Never repointed.
  if new.user2_id is distinct from old.user2_id and new.user2_id is not null then
    raise exception 'scripture_sessions.user2_id cannot be reassigned'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- A new function in `public` is created with PostgreSQL's built-in default of
-- EXECUTE to PUBLIC, which 20260818000000 could not prevent for future functions
-- (see its header). Left alone this one would be anon-executable and both advisor
-- lints would fire again. Caught by FN-GRANT-002 in
-- supabase/tests/database/18_function_execute_grants.sql, which is exactly the
-- regression net that migration says it is.
--
-- Nobody needs EXECUTE: Postgres checks a trigger function's EXECUTE privilege at
-- CREATE TRIGGER time, not at fire time, so the trigger below keeps working with
-- no grant at all -- same as sync_user_profile.
revoke execute on function public.scripture_sessions_freeze_membership()
  from anon, authenticated, service_role, public;

drop trigger if exists scripture_sessions_freeze_membership on public.scripture_sessions;

create trigger scripture_sessions_freeze_membership
  before update on public.scripture_sessions
  for each row
  execute function public.scripture_sessions_freeze_membership();

-- ============================================
-- 1d. Close the same missing-WITH-CHECK shape on the child tables
-- ============================================
-- scripture_reflections_insert and scripture_bookmarks_insert both check
-- `is_scripture_session_member(session_id)`. Their UPDATE counterparts check only
-- `user_id = auth.uid()` and, having no WITH CHECK, reuse that as the check -- so
-- session_id is unconstrained on update. Verified: an attacker writes a
-- reflection in their own session, then repoints it with
-- `update ... set session_id = <victim session>`, and the victim reads
-- attacker-authored text inside their own private session.
--
-- Names are unchanged, so the policies_are arrays in
-- supabase/tests/database/02_rls_policies.sql:80-89 still match.
--
-- scripture_step_states_update already uses is_scripture_session_member as its
-- USING clause, so its implicit check is sound and it is left alone.
-- scripture_messages has no UPDATE policy at all.
drop policy if exists scripture_reflections_update on public.scripture_reflections;

create policy scripture_reflections_update on public.scripture_reflections
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_scripture_session_member(session_id)
  );

drop policy if exists scripture_bookmarks_update on public.scripture_bookmarks;

create policy scripture_bookmarks_update on public.scripture_bookmarks
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_scripture_session_member(session_id)
  );

-- ============================================
-- 1e. No cleanup of pre-existing forced sessions -- deliberately
-- ============================================
-- An earlier draft deleted `together` sessions whose two users are not mutually
-- linked. That predicate is not safe, because it cannot tell a forced session
-- from a legitimate one belonging to a couple who has since unlinked: membership
-- is keyed on user ids only (is_scripture_session_member reads neither mode nor
-- status nor partner_id), so an ordinary break-up produces exactly the same row
-- shape as an attack. Deleting on that signal would destroy real in-progress
-- sessions, and the delete cascades to messages, reflections, bookmarks and step
-- states.
--
-- It is also unnecessary: a read-only count of that predicate against the hosted
-- project returned 0 rows out of 64 sessions, and the local stack has none
-- either. There is nothing to clean up, so this migration does not delete data.
-- If forced rows ever do appear, they need a targeted one-off with a human
-- deciding which are real -- not a blanket DELETE inside a migration.

-- ============================================
-- 2. scripture_seed_test_data: a guard that fires
-- ============================================
-- Body is unchanged from the live definition apart from the guard noted inline.
CREATE OR REPLACE FUNCTION public.scripture_seed_test_data(p_session_count integer DEFAULT 1, p_include_reflections boolean DEFAULT false, p_include_messages boolean DEFAULT false, p_preset text DEFAULT NULL::text, p_bookmark_steps integer[] DEFAULT NULL::integer[], p_user1_id uuid DEFAULT NULL::uuid, p_user2_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_caller_role text;
  v_result jsonb;
  v_session_ids uuid[] := '{}';
  v_reflection_ids uuid[] := '{}';
  v_message_ids uuid[] := '{}';
  v_test_user1_id uuid;
  v_test_user2_id uuid;
  v_session_id uuid;
  v_temp_id uuid;  -- separate variable for returning in sub-inserts
  v_step_index int;
  v_current_step int;
  v_current_phase public.scripture_session_phase;
  v_status public.scripture_session_status;
  v_completed_at timestamptz;
  i int;
  j int;
begin
  -- Caller guard, replacing an `app.environment = 'production'` check that never
  -- fired because that GUC is set in no environment, production included.
  --
  -- `current_user` is useless here: this function is SECURITY DEFINER owned by
  -- postgres, so inside the body current_user is 'postgres' no matter who called.
  -- The `role` GUC is not rewritten by SECURITY DEFINER, so it still reports the
  -- role PostgREST switched to for the request, which is what we need. Measured
  -- inside a definer body: authenticated -> 'authenticated', service_role ->
  -- 'service_role', direct psql / migration / pgTAP -> the GUC default, 'none'.
  --
  -- Fail closed: an allow-list, so a role nobody anticipated is denied rather
  -- than admitted. This is defence in depth behind the EXECUTE grant, which is
  -- service_role-only as of 20260818000000; it exists so that a future
  -- DROP FUNCTION + CREATE FUNCTION -- which resets the ACL and re-grants
  -- PUBLIC -- does not silently reopen arbitrary cross-account seeding.
  --
  -- 'none' is the `role` GUC's default value, not an absence -- current_setting
  -- returns the literal string, never NULL. It therefore means "no SET ROLE was
  -- issued", which covers psql, migrations and pgTAP but ALSO covers
  -- `authenticator`, the untrusted login role PostgREST itself connects as. So
  -- 'none' is only trusted when session_user is genuinely an admin login;
  -- service_role is trusted on the role GUC alone, because for a legitimate
  -- service-key request session_user is 'authenticator' too.
  --
  -- The coalesce is deliberate belt-and-braces, not dead code. current_setting's
  -- missing_ok signature is NULL-able, and `if not (NULL in (...) or ...)` is
  -- NULL, which plpgsql treats as false -- the RAISE would be skipped and the
  -- call would proceed. That is the exact fall-through that made
  -- accept_partner_request exploitable, and a guard whose comment says "fail
  -- closed" should not carry it, unreachable or not. '' is in no allow-list, so
  -- a NULL denies.
  v_caller_role := coalesce(current_setting('role', true), '');
  if not (
       v_caller_role in ('postgres', 'service_role')
       or (v_caller_role = 'none' and session_user in ('postgres', 'supabase_admin'))
     ) then
    raise exception 'scripture_seed_test_data is not callable by role %', v_caller_role
      using errcode = '42501';
  end if;

  -- resolve the users to seed for
  if p_user1_id is not null then
    -- caller-scoped path: the caller owns these rows, so parallel callers do
    -- not contend. validated rather than trusted, because a silently-wrong
    -- user id produces sessions attached to somebody else's account and the
    -- resulting test failure points nowhere near the cause.
    v_test_user1_id := p_user1_id;
    v_test_user2_id := p_user2_id;

    if not exists (select 1 from auth.users where id = v_test_user1_id) then
      raise exception 'p_user1_id % not found in auth.users', v_test_user1_id;
    end if;

    if v_test_user2_id is not null then
      if v_test_user2_id = v_test_user1_id then
        raise exception 'p_user1_id and p_user2_id must differ (both %)', v_test_user1_id;
      end if;
      if not exists (select 1 from auth.users where id = v_test_user2_id) then
        raise exception 'p_user2_id % not found in auth.users', v_test_user2_id;
      end if;
    end if;
  else
    -- legacy fallback: first two users by creation order. retained so callers
    -- that have not been updated keep working; not safe under parallelism.
    select id into v_test_user1_id
      from auth.users order by created_at, id limit 1;
    select id into v_test_user2_id
      from auth.users where id <> v_test_user1_id order by created_at, id limit 1;

    -- if no users exist, we cannot seed (requires authenticated users)
    if v_test_user1_id is null then
      raise exception 'No users found in auth.users. Create test users first.';
    end if;
  end if;

  -- determine session state based on preset
  case p_preset
    when 'mid_session' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'completed' then
      v_current_step := 16;
      v_current_phase := 'complete';
      v_status := 'complete';
      v_completed_at := now();
    when 'with_help_flags' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'unlinked' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'at_reflection' then
      v_current_step := 16;
      v_current_phase := 'reflection';
      v_status := 'in_progress';
      v_completed_at := null;
    else
      -- default: fresh session
      v_current_step := 0;
      v_current_phase := 'lobby';
      v_status := 'pending';
      v_completed_at := null;
  end case;

  -- create sessions
  for i in 1..p_session_count loop
    insert into public.scripture_sessions (
      mode,
      user1_id,
      user2_id,
      current_phase,
      current_step_index,
      status,
      version,
      snapshot_json,
      started_at,
      completed_at
    ) values (
      case when p_preset in ('unlinked', 'at_reflection') then 'solo'::public.scripture_session_mode
           when v_test_user2_id is not null then 'together'::public.scripture_session_mode
           else 'solo'::public.scripture_session_mode end,
      v_test_user1_id,
      case when p_preset in ('unlinked', 'at_reflection') then null else v_test_user2_id end,
      v_current_phase,
      v_current_step,
      v_status,
      1,
      jsonb_build_object('seeded', true, 'preset', coalesce(p_preset, 'default')),
      now() - (i || ' hours')::interval,  -- stagger start times
      v_completed_at
    ) returning id into v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);

    -- create step states for completed steps
    for j in 0..v_current_step loop
      insert into public.scripture_step_states (
        session_id,
        step_index,
        user1_locked_at,
        user2_locked_at,
        advanced_at
      ) values (
        v_session_id,
        j,
        now() - ((v_current_step - j) || ' minutes')::interval,
        case when p_preset in ('unlinked', 'at_reflection') then null
             when v_test_user2_id is not null then now() - ((v_current_step - j) || ' minutes')::interval
             else null end,
        case when j = 16 and p_preset = 'at_reflection' then null
             else now() - ((v_current_step - j) || ' minutes')::interval end
      );
    end loop;

    -- create bookmarks for at_reflection preset when p_bookmark_steps is provided
    if p_preset = 'at_reflection' and p_bookmark_steps is not null then
      declare
        v_bm_step int;
      begin
        foreach v_bm_step in array p_bookmark_steps loop
          insert into public.scripture_bookmarks (
            session_id,
            step_index,
            user_id,
            share_with_partner
          ) values (
            v_session_id,
            v_bm_step,
            v_test_user1_id,
            false
          );
        end loop;
      end;
    end if;

    -- create reflections if requested (uses v_temp_id to avoid overwriting v_session_id)
    if p_include_reflections then
      for j in 0..least(v_current_step, 16) loop
        insert into public.scripture_reflections (
          session_id,
          step_index,
          user_id,
          rating,
          notes,
          is_shared,
          created_at
        ) values (
          v_session_id,
          j,
          v_test_user1_id,
          (j % 5) + 1,  -- rotating rating 1-5
          'Test reflection for step ' || j,
          j % 2 = 0,  -- share every other one
          now() - ((v_current_step - j) || ' minutes')::interval
        ) returning id into v_temp_id;
        v_reflection_ids := array_append(v_reflection_ids, v_temp_id);
      end loop;
    end if;

    -- create messages if requested (uses v_temp_id to avoid overwriting v_session_id)
    if p_include_messages then
      for j in 1..3 loop
        insert into public.scripture_messages (
          session_id,
          sender_id,
          message,
          created_at
        ) values (
          v_session_id,
          v_test_user1_id,
          'Test prayer message ' || j,
          now() - (j || ' minutes')::interval
        ) returning id into v_temp_id;
        v_message_ids := array_append(v_message_ids, v_temp_id);
      end loop;
    end if;
  end loop;

  -- build result
  v_result := jsonb_build_object(
    'session_ids', to_jsonb(v_session_ids),
    'session_count', p_session_count,
    'preset', coalesce(p_preset, 'default'),
    'test_user1_id', v_test_user1_id,
    'test_user2_id', v_test_user2_id
  );

  if p_include_reflections then
    v_result := v_result || jsonb_build_object('reflection_ids', to_jsonb(v_reflection_ids));
  end if;

  if p_include_messages then
    v_result := v_result || jsonb_build_object('message_ids', to_jsonb(v_message_ids));
  end if;

  return v_result;
end;
$function$;

commit;
