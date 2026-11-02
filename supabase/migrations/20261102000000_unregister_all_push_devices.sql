-- ============================================
-- DW-353: "Sign out of all devices" removes every push registration
--
-- unregister_push_device (20261031010000) removes one token, the signing-out
-- device's own. Signing out everywhere ends every session, but the other
-- devices' push_devices rows stayed until an APNs 410 removed them, so a lost
-- phone kept receiving the account's pushes. This function deletes every row
-- the caller owns; src/api/auth/actionService.ts signOut({ everywhere: true })
-- calls it (src/services/pushNotifications.ts, removeAllPushRegistrations)
-- before the global sign-out ends the session that authorises it.
--
-- SECURITY DEFINER because push_devices is read-only to authenticated (every
-- write goes through an RPC, as register_push_device in 20261031000000 does);
-- the `user_id = auth.uid()` filter is the whole authorisation.
--
-- pgTAP: supabase/tests/database/39_unregister_all_push_devices.sql and
-- 18_function_execute_grants.sql pin the grant and the behaviour.
-- ============================================

begin;

create function public.unregister_all_push_devices()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  delete from public.push_devices
   where user_id = v_uid;
end;
$$;

comment on function public.unregister_all_push_devices() is
  'Removes every push registration the caller owns, called by Sign out of all devices. '
  'Another account''s registrations are left untouched.';

revoke execute on function public.unregister_all_push_devices() from public, anon;
grant execute on function public.unregister_all_push_devices() to authenticated;

commit;
