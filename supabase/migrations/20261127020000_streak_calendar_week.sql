-- ============================================
-- Simpler daily pushes and nudge, story 11.3: the streak's week runs Sunday to Saturday
-- (architecture-daily-question: AD-3, AD-7, AD-15)
--
-- == What changes ==
-- * couple_streak(user_a, user_b, viewer, at) (internal) is replaced in place with
--   the body of 20261107010000 unchanged except for one new key, `calendar_week`:
--   seven {day, state} objects, Sunday to Saturday of the week holding the
--   viewer's date (the viewer's stored zone, UTC with no row, AD-3). state is
--   done | missed | open as in `week`, and `upcoming` for every date after the
--   viewer's date whatever rows exist. A date before the pair's first day is
--   open. The no-day answer carries it too (open to the viewer's date, then
--   upcoming).
-- * `week` is byte-identical (the last seven dates ending on the viewer's date,
--   done | missed | open): installed builds, the cold banner and the +1 screen
--   read it, and an installed build's schema accepts exactly those three
--   states, so the new state lives only in the new field.
-- * get_couple_streak() is not touched: it passes couple_streak's answer through.
--   The AD-5 gate file and FN-GRANT-008 are unchanged.
--
-- == Grants ==
-- couple_streak keeps its internal grants, stated again: revoked from public,
-- anon and authenticated, each named, and granted to service_role.
--
-- == Hosted catalog ==
-- One function replaced in place with the same signature; nothing is dropped,
-- so no hosted-only name is at stake.
--
-- pgTAP: 45_couple_streak.sql pins calendar_week (STREAK-050 on) and the
-- unchanged week. tests/api/couple-streak-old-build.spec.ts reads the answer
-- through the schema of the build before this story.
-- ============================================

begin;

-- --------------------------------------------
-- couple_streak (internal)
-- --------------------------------------------
create or replace function public.couple_streak(user_a uuid, user_b uuid, viewer uuid, at timestamptz)
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
  v_sunday date;
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
  v_sunday := v_today - extract(dow from v_today)::int;

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
      ),
      'calendar_week', (
        select jsonb_agg(
          jsonb_build_object(
            'day', v_sunday + w.i,
            'state', case when v_sunday + w.i > v_today then 'upcoming' else 'open' end
          ) order by w.i
        )
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
    ),
    'calendar_week', (
      select jsonb_agg(
        jsonb_build_object(
          'day', w.dt,
          'state', case when w.dt > v_today then 'upcoming' else coalesce(s.state, 'open') end
        ) order by w.dt
      )
      from (select v_sunday + g.i as dt from generate_series(0, 6) as g(i)) w
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
  '(grey | orange | blue), milestones, same, done, missed, a seven-day week and a calendar_week. A date '
  'is done when both picks exist, closed once both partners'' local dates have passed it (each in the '
  'zone of their own pick of it, else their stored zone, else UTC), missed when closed and not done, '
  'counted from the pair''s first day. today_state is orange when the viewer''s date is done, else '
  'blue when a date is missed after the newest done date (missed > 0), else grey. week is the last '
  'seven dates ending on the viewer''s date (done | missed | open); calendar_week is Sunday to '
  'Saturday of the week holding the viewer''s date, each date with that state, a date after the '
  'viewer''s date upcoming. Choices are read only through visible_daily_picks. Stores nothing. '
  '22023 unless user_a < user_b and viewer is one of them. Internal.';

revoke execute on function public.couple_streak(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.couple_streak(uuid, uuid, uuid, timestamptz) to service_role;

commit;
