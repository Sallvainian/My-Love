-- ============================================
-- DW-406: register_push_device refuses a caller whose session has ended
--
-- "Sign out of all devices" (src/api/auth/actionService.ts, signOut with
-- everywhere) signs out with scope=global, which deletes every auth.sessions
-- row of the account, and removes every push_devices row through
-- unregister_all_push_devices() (20261102000000). Another device's access
-- token stays valid until it expires (supabase/config.toml jwt_expiry), and
-- App.tsx registers again on every signed-in start, so a lost phone opened
-- within that window re-created its push_devices row. register_push_device
-- checked only auth.uid().
--
-- It now also requires the JWT's session_id claim to name a live
-- auth.sessions row of the same user. A token with no session_id, a
-- malformed one, or another user's session is refused the same way. A
-- refused call writes nothing, so it neither creates nor reassigns a row.
-- This check alone cannot refuse a registration landing before the global
-- sign-out, while the session is still live, so "Sign out of all devices" now
-- signs out globally first and calls unregister_all_push_devices() after it,
-- with the access token read before it (DW-412): every row registered before
-- the sign-out is removed, and every registration after it is refused here.
-- Owner decision 2026-11-02: jwt_expiry stays as is, and the check covers push
-- registration only -- a still-valid token reading app data until it expires
-- is accepted.
--
-- The signature is unchanged (create or replace), so database types are not
-- regenerated; the grants are restated to match 20261031000000. The function
-- owner (postgres) has SELECT on auth.sessions locally and on the hosted
-- project (read-only catalog check, 2026-11-02).
--
-- pgTAP: supabase/tests/database/35_push_devices.sql and
-- 18_function_execute_grants.sql pin the behaviour and the grant.
-- ============================================

begin;

create or replace function public.register_push_device(p_token text, p_environment text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session_id text := (select auth.jwt() ->> 'session_id');
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Compared as text so a malformed claim is refused here rather than raising
  -- a cast error; sessions_user_id_idx serves the lookup.
  if v_session_id is null or not exists (
    select 1
      from auth.sessions s
     where s.user_id = v_uid
       and s.id::text = v_session_id
  ) then
    raise exception 'Session has ended' using errcode = '42501';
  end if;

  -- A bad environment is refused by push_devices_environment_check (23514).
  insert into public.push_devices (user_id, token, environment)
  values (v_uid, p_token, p_environment)
  on conflict (token) do update
    set user_id = excluded.user_id,
        environment = excluded.environment,
        updated_at = now();
end;
$$;

comment on function public.register_push_device(text, text) is
  'Registers the caller''s APNs device token with its environment (sandbox or production). '
  'A token already registered to another account moves to the caller. Refused when the '
  'caller''s JWT session_id no longer names a live auth.sessions row (DW-406).';

revoke execute on function public.register_push_device(text, text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;

commit;
