-- ============================================
-- Push notifications, story 3.2: sign-out removes this device's registration
--
-- A signed-in shell signing out calls unregister_push_device with the APNs
-- token it registered, before its session ends, so the outgoing account's
-- pushes stop reaching the device (src/services/pushNotifications.ts,
-- removePushRegistration). Only the caller's own row for that token goes: a
-- token registered to another account is left alone, so a stale or guessed
-- token can remove nothing that is not the caller's.
--
-- SECURITY DEFINER because push_devices is read-only to authenticated (every
-- write goes through an RPC, as register_push_device in 20261031000000 does);
-- the `user_id = auth.uid()` filter is the whole authorisation.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql and
-- 18_function_execute_grants.sql pin the grant and the behaviour.
-- ============================================

begin;

create function public.unregister_push_device(p_token text)
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
   where token = p_token
     and user_id = v_uid;
end;
$$;

comment on function public.unregister_push_device(text) is
  'Removes the caller''s registration of an APNs device token, called on sign-out. '
  'A token registered to another account is left untouched.';

revoke execute on function public.unregister_push_device(text) from public, anon;
grant execute on function public.unregister_push_device(text) to authenticated;

commit;
