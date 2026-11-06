-- ============================================
-- Daily Question, story 6.6: the partner's pick shows without a reload
-- (architecture-daily-question: AD-5, AD-8, AD-11, AD-15, AD-16)
--
-- == What changes ==
-- * get_daily_day_by_id(day_id) (client RPC): the caller's snapshot of one
--   named day of their current pair, for the receiver of a `daily_pick`
--   broadcast, which carries only a day_id and asks for a server re-read.
--   security definer with search_path = ''. In order:
--     1. a null auth.uid(): 'Authentication required'.
--     2. the caller has no partner, or day_id is not a couple_days row of the
--        caller's current pair (user_a = least(uid, partner), user_b =
--        greatest(uid, partner), which is what get_my_partner_id() reads for
--        auth.uid()): P0002 'Day not found'.
--     3. otherwise daily_day_snapshot(day_id, uid, now()), so a choice is read
--        only through the gate (AD-5): before the caller's own pick the answer
--        has state 'partner' and no choice, mark or count.
--   It records no zone and writes nothing.
--
-- == Grants ==
-- security definer, revokes EXECUTE from public and anon and is granted to
-- authenticated; it is the one new entry in FN-GRANT-008.
--
-- pgTAP: 40_daily_question_gate.sql calls it as the second partner before and
-- after their own pick and as a partnered and an unlinked outsider;
-- 18_function_execute_grants.sql pins FN-GRANT-008 and FN-GRANT-020.
-- ============================================

begin;

create function public.get_daily_day_by_id(day_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_partner uuid;
  v_found uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_partner := public.get_my_partner_id();

  select cd.id into v_found
  from public.couple_days cd
  where cd.id = get_daily_day_by_id.day_id
    and v_partner is not null
    and cd.user_a = least(v_uid, v_partner)
    and cd.user_b = greatest(v_uid, v_partner);
  if not found then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  return public.daily_day_snapshot(v_found, v_uid, pg_catalog.now());
end;
$$;

comment on function public.get_daily_day_by_id(uuid) is
  'The caller''s snapshot of one day of their current pair, at now(): P0002 ''Day not found'' with '
  'no partner or for a day of another pair. A choice comes back only through the gate, so before '
  'the caller''s own pick the state is ''partner'' and no choice, mark or count is in it. Pair '
  'derived from auth.uid() and get_my_partner_id(). Reads only.';

revoke execute on function public.get_daily_day_by_id(uuid) from public, anon;
grant execute on function public.get_daily_day_by_id(uuid) to authenticated;

commit;
