-- ============================================
-- Streak and Partner Page, story 7.1: the server counts the couple's streak
-- (architecture-daily-question: AD-3, AD-5, AD-7, AD-8, AD-15)
--
-- == What changes ==
-- * couple_streak(user_a, user_b, viewer, at) (internal): the one definition of
--   the couple's streak (AD-7), computed from couple_days, daily_picks,
--   user_time_zones and the gate at the instant given. Nothing is stored, so a
--   late pick corrects the count by itself. Returns jsonb with exactly:
--     held         the streak: the number of done dates
--     run          done dates after the newest missed date (all, with none)
--     today_state  'orange' when the viewer's date is done, else 'blue' when
--                  `missed` is above 0 (a date is missed after the newest done
--                  date), else 'grey'
--     milestones   floor(held / 25)
--     same         done dates whose two choices, both read through
--                  visible_daily_picks(viewer, at), are equal
--     done         the same count as held (no freeze exists today)
--     missed       missed dates after the newest done date (all, with none)
--     week         seven {day, state} objects, oldest first, ending on the
--                  viewer's date; state is done | missed | open, and a date
--                  before the pair's first day is open
--
-- == Rules ==
-- * Day d of the pair is done when both partners' picks exist. It is closed
--   when (at at time zone z)::date > d for both partners, where z is that
--   partner's daily_picks.effective_zone from their own pick of d, else their
--   user_time_zones.effective_zone, else 'UTC' (AD-3). Missed is closed and not
--   done, for every calendar date from the pair's first couple_days.day, dates
--   with no row included. Otherwise the date is open, and an open date never
--   breaks the run.
-- * blue is `missed > 0`, not "the newest closed date is missed". The two differ
--   only when a date done by both is not yet closed on one partner's clock (New
--   York past midnight, Chicago not) and is newer than a closed missed date:
--   both have picked again, so that state is grey with missed 0. Blue ends as
--   soon as a done date is newer than every missed date, and the cold banner
--   never reads 0 days missed. Whenever the newest done date is closed the two
--   rules agree.
-- * The viewer's date is `at` in the viewer's stored zone ('UTC' with no row).
--   The dates considered run from the pair's first day to the greatest of the
--   two partners' dates and the pair's last couple_days.day.
-- * Closure compares local dates, never a constructed midnight, so it is
--   DST-safe.
-- * Choices are read only through visible_daily_picks (AD-5): `same` is the
--   snapshot's own expression (both choices through the gate, equal). The
--   function never selects daily_picks.choice itself, and a day counts as done
--   from the existence of both picks, which is what the snapshot's `state`
--   already shows.
-- * Raises 22023 unless user_a < user_b and viewer is one of them. stable,
--   security definer, search_path = ''.
--
-- * get_couple_streak() (client RPC): 'Authentication required' for a null
--   auth.uid(); {status: 'unlinked'} when get_my_partner_id() is null; else
--   {status: 'ok', streak: couple_streak(least, greatest, uid, now())}. It takes
--   no pair, viewer or instant (AD-8, AD-15) and reads only.
--
-- == Grants ==
-- couple_streak revokes EXECUTE from public, anon and authenticated, each named
-- (hosted's default ACL grants each role separately), and is granted to
-- service_role. get_couple_streak revokes it from public and anon and is
-- granted to authenticated; it is the one new entry in FN-GRANT-008.
--
-- == Hosted catalog ==
-- Checked read-only on 2026-11-07: neither function exists there.
--
-- pgTAP: 45_couple_streak.sql pins the projection over fixed 2030 instants, the
-- structure and the grants; 40_daily_question_gate.sql lists both functions and
-- calls get_couple_streak as the second partner before and after their pick;
-- 18_function_execute_grants.sql pins FN-GRANT-008 and FN-GRANT-022.
-- ============================================

begin;

-- --------------------------------------------
-- couple_streak (internal)
-- --------------------------------------------
create function public.couple_streak(user_a uuid, user_b uuid, viewer uuid, at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_a uuid := couple_streak.user_a;
  v_b uuid := couple_streak.user_b;
  v_viewer uuid := couple_streak.viewer;
  v_at timestamptz := couple_streak.at;
  v_partner uuid;
  v_zone_viewer text;
  v_zone_partner text;
  v_today date;
  v_today_partner date;
  v_first date;
  v_max date;
  v_last date;
  v_result jsonb;
begin
  if v_a is null or v_b is null or v_viewer is null or v_at is null
     or v_a >= v_b
     or v_viewer not in (v_a, v_b)
  then
    raise exception 'Invalid couple streak' using errcode = '22023';
  end if;

  v_partner := case when v_viewer = v_a then v_b else v_a end;

  v_zone_viewer := coalesce(
    (select z.effective_zone from public.user_time_zones z where z.user_id = v_viewer), 'UTC'
  );
  v_zone_partner := coalesce(
    (select z.effective_zone from public.user_time_zones z where z.user_id = v_partner), 'UTC'
  );
  v_today := (v_at at time zone v_zone_viewer)::date;
  v_today_partner := (v_at at time zone v_zone_partner)::date;

  select min(cd.day), max(cd.day) into v_first, v_max
  from public.couple_days cd
  where cd.user_a = v_a and cd.user_b = v_b;

  if v_first is null then
    return jsonb_build_object(
      'held', 0,
      'run', 0,
      'today_state', 'grey',
      'milestones', 0,
      'same', 0,
      'done', 0,
      'missed', 0,
      'week', (
        select jsonb_agg(jsonb_build_object('day', v_today - 6 + w.i, 'state', 'open') order by w.i)
        from generate_series(0, 6) as w(i)
      )
    );
  end if;

  v_last := greatest(v_today, v_today_partner, v_max);

  with series as (
    select v_first + g.i as dt
    from generate_series(0, v_last - v_first) as g(i)
  ),
  days as (
    select s.dt,
           cd.id as day_id,
           (pa.id is not null and pb.id is not null) as done,
           coalesce(pa.effective_zone, za.effective_zone, 'UTC') as zone_a,
           coalesce(pb.effective_zone, zb.effective_zone, 'UTC') as zone_b
    from series s
    left join public.couple_days cd
      on cd.user_a = v_a and cd.user_b = v_b and cd.day = s.dt
    left join public.daily_picks pa on pa.day_id = cd.id and pa.user_id = v_a
    left join public.daily_picks pb on pb.day_id = cd.id and pb.user_id = v_b
    left join public.user_time_zones za on za.user_id = v_a
    left join public.user_time_zones zb on zb.user_id = v_b
  ),
  closure as (
    select d.*,
           ((v_at at time zone d.zone_a)::date > d.dt
            and (v_at at time zone d.zone_b)::date > d.dt) as closed
    from days d
  ),
  states as (
    select c.dt,
           c.day_id,
           case
             when c.done then 'done'
             when c.closed then 'missed'
             else 'open'
           end as state
    from closure c
  ),
  agg as (
    select count(*) filter (where s.state = 'done') as held,
           max(s.dt) filter (where s.state = 'missed') as last_missed,
           max(s.dt) filter (where s.state = 'done') as last_done
    from states s
  ),
  res as (
    select a.*,
           (select count(*) from states s
            where s.state = 'missed' and (a.last_done is null or s.dt > a.last_done)) as missed
    from agg a
  ),
  visible as materialized (
    select vp.day_id, vp.user_id, vp.choice
    from public.visible_daily_picks(v_viewer, v_at) vp
  )
  select jsonb_build_object(
    'held', a.held,
    'run', (
      select count(*) from states s
      where s.state = 'done' and (a.last_missed is null or s.dt > a.last_missed)
    ),
    'today_state', case
      when (select s.state from states s where s.dt = v_today) = 'done' then 'orange'
      when a.missed > 0 then 'blue'
      else 'grey'
    end,
    'milestones', a.held / 25,
    'same', (
      select count(*)
      from states s
      join visible vm on vm.day_id = s.day_id and vm.user_id = v_viewer
      join visible vp on vp.day_id = s.day_id and vp.user_id = v_partner
      where s.state = 'done' and vm.choice = vp.choice
    ),
    'done', a.held,
    'missed', a.missed,
    'week', (
      select jsonb_agg(
        jsonb_build_object('day', w.dt, 'state', coalesce(s.state, 'open')) order by w.dt
      )
      from (select v_today - 6 + g.i as dt from generate_series(0, 6) as g(i)) w
      left join states s on s.dt = w.dt
    )
  )
  into v_result
  from res a;

  return v_result;
end;
$$;

comment on function public.couple_streak(uuid, uuid, uuid, timestamptz) is
  'The one definition of the couple''s streak (AD-7) at the instant given: held, run, today_state '
  '(grey | orange | blue), milestones, same, done, missed and a seven-day week. A date is done when '
  'both picks exist, closed once both partners'' local dates have passed it (each in the zone of '
  'their own pick of it, else their stored zone, else UTC), missed when closed and not done, '
  'counted from the pair''s first day. today_state is orange when the viewer''s date is done, else '
  'blue when a date is missed after the newest done date (missed > 0), else grey. Choices are read only through visible_daily_picks. Stores '
  'nothing. 22023 unless user_a < user_b and viewer is one of them. Internal.';

revoke execute on function public.couple_streak(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.couple_streak(uuid, uuid, uuid, timestamptz) to service_role;

-- --------------------------------------------
-- get_couple_streak (client RPC)
-- --------------------------------------------
create function public.get_couple_streak()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_partner uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_partner := public.get_my_partner_id();
  if v_partner is null then
    return jsonb_build_object('status', 'unlinked');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'streak', public.couple_streak(
      least(v_uid, v_partner), greatest(v_uid, v_partner), v_uid, pg_catalog.now()
    )
  );
end;
$$;

comment on function public.get_couple_streak() is
  'The caller''s couple streak at now(): {status: ''unlinked''} with no partner, else {status: ''ok'', '
  'streak} from couple_streak. Takes no pair, viewer or instant; derived from auth.uid() and '
  'get_my_partner_id(). Reads only.';

revoke execute on function public.get_couple_streak() from public, anon;
grant execute on function public.get_couple_streak() to authenticated;

commit;
