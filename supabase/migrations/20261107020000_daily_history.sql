-- ============================================
-- Streak and Partner Page, story 7.7: the Partner page lists past questions
-- (architecture-daily-question: AD-5, AD-15, AD-16)
--
-- == What changes ==
-- * get_daily_history(before date default null) (client RPC): the caller's
--   current pair's done days as an array of AD-16 snapshots
--   (daily_day_snapshot(day_id, uid, now())), newest first, at most 30, all
--   strictly before `before` when given. A day is done when both partners'
--   daily_picks rows exist (existence only, never `choice`). The next page is
--   the call with `before` = the oldest day of the page in hand.
--
-- == Rules ==
-- * 'Authentication required' for a null auth.uid().
-- * An empty array '[]' when get_my_partner_id() is null: the unlinked caller
--   reads nothing (the Partner page learns unlinked from the partner read).
-- * The pair is least(uid, partner), greatest(uid, partner), so a caller who
--   relinked to someone else reads none of the old pair's days.
-- * Choices come only through daily_day_snapshot, which reads them through
--   visible_daily_picks (AD-5). A done day has both picks, so the caller has
--   picked and the snapshot shows both choices and Same/Different; a day the
--   caller has not picked is never done and never listed. This function never
--   selects daily_picks.choice.
-- * Takes no pair, viewer or instant (AD-15). stable, security definer,
--   search_path = ''. Reads only.
--
-- == Grants ==
-- get_daily_history revokes EXECUTE from public and anon and is granted to
-- authenticated; it is the one new entry in FN-GRANT-008.
--
-- == Hosted catalog ==
-- Checked read-only on 2026-11-07: get_daily_history does not exist there.
--
-- pgTAP: 46_daily_history.sql pins the structure, the grants, paging, half
-- days, the pair boundary and Same/Different; 40_daily_question_gate.sql lists
-- the function and calls it as the second partner before and after their pick;
-- 18_function_execute_grants.sql pins FN-GRANT-008 and FN-GRANT-023.
-- ============================================

begin;

create function public.get_daily_history(before date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_partner uuid;
  v_before date := get_daily_history.before;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_partner := public.get_my_partner_id();
  if v_partner is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        public.daily_day_snapshot(page.id, v_uid, pg_catalog.now()) order by page.day desc
      )
      from (
        select cd.id, cd.day
        from public.couple_days cd
        where cd.user_a = least(v_uid, v_partner)
          and cd.user_b = greatest(v_uid, v_partner)
          and (v_before is null or cd.day < v_before)
          and exists (
            select 1 from public.daily_picks pa
            where pa.day_id = cd.id and pa.user_id = cd.user_a
          )
          and exists (
            select 1 from public.daily_picks pb
            where pb.day_id = cd.id and pb.user_id = cd.user_b
          )
        order by cd.day desc
        limit 30
      ) page
    ),
    '[]'::jsonb
  );
end;
$$;

comment on function public.get_daily_history(date) is
  'The caller''s current pair''s done days (both picks exist) as AD-16 snapshots, newest first, at '
  'most 30, strictly before `before` when given; [] with no partner. Takes no pair, viewer or '
  'instant; derived from auth.uid() and get_my_partner_id(). Choices only through '
  'daily_day_snapshot. Reads only.';

revoke execute on function public.get_daily_history(date) from public, anon;
grant execute on function public.get_daily_history(date) to authenticated;

commit;
