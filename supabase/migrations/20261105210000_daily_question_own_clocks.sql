-- ============================================
-- Daily Question, story 6.2: each partner's day runs on their own clock
-- (architecture-daily-question: AD-2, AD-3, AD-6, AD-8, AD-12, AD-15)
--
-- == What changes ==
-- * user_time_zones: one row per user holding the zone they last reported
--   (name, east-positive offset, the resolved effective_zone and when it was
--   reported). RLS on, no policy; anon and authenticated hold nothing;
--   service_role keeps its default privileges for the later epics that read it.
--   Nothing reads the table in this story.
-- * record_user_time_zone(viewer, time_zone, utc_offset_minutes, reported_at,
--   at) (internal): the only writer of user_time_zones, called by
--   get_daily_day. It writes nothing when viewer or reported_at is null,
--   treats a reported_at later than at + 5 minutes as `at`, and upserts,
--   updating a stored row only when its reported_at is older than the new one.
--   The effective_zone is resolved from the raw arguments, as a pick's is. A
--   pick never writes the table.
-- * record_daily_pick(viewer, day_id, choice, picked_at, time_zone,
--   utc_offset_minutes, at) (internal): story 6.1's submit body with the
--   instant passed in (AD-8), and the window and date checks added. In order:
--   22023 for a bad choice or a null picked_at; P0002 'Day not found' unless
--   the day is the viewer's pair's (the pair comes from public.users.partner_id
--   of viewer, which is what get_my_partner_id() reads for auth.uid()), under
--   the day row's lock; an existing own pick returns the stored snapshot
--   unchanged, before the new checks, so a retry of a stored pick is never
--   refused; DQ002 when picked_at is before the day's created_at - 5 minutes
--   or after at + 5 minutes; DQ001 when picked_at in the zone it was sent with
--   is not the day's date; then the insert.
-- * submit_daily_pick (client RPC) keeps its signature and grants and becomes
--   record_daily_pick(auth.uid(), ..., now()). get_daily_day keeps its
--   signature and grants and calls record_user_time_zone(auth.uid(), ...,
--   now()) right after its auth check, before the unlinked return.
--
-- == SQLSTATEs ==
-- DQ001  the pick's date, in the zone sent with it, is not the day's date.
-- DQ002  picked_at is outside [day created_at - 5 minutes, at + 5 minutes].
-- Class DQ is unused by Postgres; PostgREST answers 400 with `code` set.
--
-- == Grants ==
-- Both internal functions are security invoker with search_path = '', revoke
-- EXECUTE from public, anon and authenticated, each explicitly (hosted's
-- default ACL grants each role separately), and grant it to service_role.
-- They add nothing to FN-GRANT-008. Their caller in practice is a security
-- definer client RPC, so the table writes run with its owner's rights.
--
-- == Hosted catalog ==
-- Checked read-only on 2026-11-06: user_time_zones, record_user_time_zone,
-- record_daily_pick, get_daily_day and submit_daily_pick do not exist there.
--
-- pgTAP: supabase/tests/database/41_daily_question_own_clocks.sql pins the
-- table, the two functions, the window and the date check;
-- 40_daily_question_gate.sql lists the six internal functions and makes its
-- second-day picks through record_daily_pick.
-- ============================================

begin;

-- --------------------------------------------
-- user_time_zones
-- --------------------------------------------
create table public.user_time_zones (
  user_id uuid primary key references public.users(id) on delete cascade,
  time_zone text not null,
  utc_offset_minutes integer not null,
  effective_zone text not null,
  reported_at timestamptz not null
);

comment on table public.user_time_zones is
  'The zone each user last reported through get_daily_day, with the effective_zone resolved from it. '
  'Written only by record_user_time_zone. anon and authenticated hold no privilege (service_role keeps '
  'its default privileges). Pinned by supabase/tests/database/41_daily_question_own_clocks.sql.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated. No policy
-- is created, and the revoke leaves no privilege to need one.
alter table public.user_time_zones enable row level security;
revoke all on public.user_time_zones from anon, authenticated;

-- --------------------------------------------
-- record_user_time_zone (internal)
-- --------------------------------------------
create function public.record_user_time_zone(
  viewer uuid,
  time_zone text,
  utc_offset_minutes integer,
  reported_at timestamptz,
  at timestamptz
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_reported timestamptz;
begin
  if record_user_time_zone.viewer is null or record_user_time_zone.reported_at is null then
    return;
  end if;

  v_reported := record_user_time_zone.reported_at;
  if v_reported > record_user_time_zone.at + interval '5 minutes' then
    v_reported := record_user_time_zone.at;
  end if;

  insert into public.user_time_zones (user_id, time_zone, utc_offset_minutes, effective_zone, reported_at)
  values (
    record_user_time_zone.viewer,
    coalesce(record_user_time_zone.time_zone, ''),
    coalesce(record_user_time_zone.utc_offset_minutes, 0),
    public.effective_zone(record_user_time_zone.time_zone, record_user_time_zone.utc_offset_minutes),
    v_reported
  )
  on conflict on constraint user_time_zones_pkey do update
    set time_zone = excluded.time_zone,
        utc_offset_minutes = excluded.utc_offset_minutes,
        effective_zone = excluded.effective_zone,
        reported_at = excluded.reported_at
    where public.user_time_zones.reported_at < excluded.reported_at;
end;
$$;

comment on function public.record_user_time_zone(uuid, text, integer, timestamptz, timestamptz) is
  'The only writer of user_time_zones: upserts the viewer''s zone when the stored reported_at is older '
  'than the new one (a reported_at later than at + 5 minutes counts as at). Writes nothing for a null '
  'viewer or reported_at. Internal.';

revoke execute on function public.record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_user_time_zone(uuid, text, integer, timestamptz, timestamptz)
  to service_role;

-- --------------------------------------------
-- record_daily_pick (internal)
-- --------------------------------------------
create function public.record_daily_pick(
  viewer uuid,
  day_id uuid,
  choice text,
  picked_at timestamptz,
  time_zone text,
  utc_offset_minutes integer,
  at timestamptz
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_partner uuid;
  v_day public.couple_days;
  v_is_second boolean;
  v_other uuid;
begin
  if record_daily_pick.choice is null
     or record_daily_pick.choice not in ('this', 'that')
  then
    raise exception 'Invalid choice' using errcode = '22023';
  end if;
  if record_daily_pick.picked_at is null then
    raise exception 'Invalid pick time' using errcode = '22023';
  end if;

  select u.partner_id into v_partner
  from public.users u
  where u.id = record_daily_pick.viewer;

  -- Membership is in the WHERE clause, so a viewer outside the pair never
  -- takes the row lock.
  select * into v_day
  from public.couple_days cd
  where cd.id = record_daily_pick.day_id
    and v_partner is not null
    and ((cd.user_a = record_daily_pick.viewer and cd.user_b = v_partner)
      or (cd.user_a = v_partner and cd.user_b = record_daily_pick.viewer))
  for update;
  if not found then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  -- A stored pick comes back unchanged, before the window and date checks, so
  -- a retry of a pick that already landed is never refused.
  if exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = record_daily_pick.viewer
  ) then
    return public.daily_day_snapshot(v_day.id, record_daily_pick.viewer, record_daily_pick.at);
  end if;

  if record_daily_pick.picked_at < v_day.created_at - interval '5 minutes'
     or record_daily_pick.picked_at > record_daily_pick.at + interval '5 minutes'
  then
    raise exception 'Pick time outside the allowed window' using errcode = 'DQ002';
  end if;

  if (
    record_daily_pick.picked_at at time zone public.effective_zone(
      record_daily_pick.time_zone, record_daily_pick.utc_offset_minutes
    )
  )::date <> v_day.day
  then
    raise exception 'Pick date is not the day''s date' using errcode = 'DQ001';
  end if;

  v_other := case when record_daily_pick.viewer = v_day.user_a then v_day.user_b else v_day.user_a end;
  v_is_second := exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = v_other
  );

  insert into public.daily_picks (
    day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second
  )
  values (
    v_day.id,
    record_daily_pick.viewer,
    record_daily_pick.choice,
    record_daily_pick.picked_at,
    coalesce(record_daily_pick.time_zone, ''),
    coalesce(record_daily_pick.utc_offset_minutes, 0),
    public.effective_zone(record_daily_pick.time_zone, record_daily_pick.utc_offset_minutes),
    v_is_second
  )
  on conflict on constraint daily_picks_day_user_key do nothing;

  return public.daily_day_snapshot(v_day.id, record_daily_pick.viewer, record_daily_pick.at);
end;
$$;

comment on function public.record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz) is
  'Writes the viewer''s pick for a day of their pair, once: a stored pick comes back unchanged, '
  'before the checks. Otherwise picked_at must lie within [day created_at - 5 min, at + 5 min] '
  '(DQ002) and on the day''s date in the zone sent (DQ001). Locks the day row so is_second cannot '
  'race. Returns the day snapshot. Internal; the only write path to daily_picks.';

revoke execute on function public.record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_daily_pick(uuid, uuid, text, timestamptz, text, integer, timestamptz)
  to service_role;

-- --------------------------------------------
-- get_daily_day (client RPC): records the caller's zone
-- --------------------------------------------
create or replace function public.get_daily_day(
  time_zone text,
  utc_offset_minutes integer,
  reported_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_partner uuid;
  v_day date;
  v_row public.couple_days;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform public.record_user_time_zone(
    v_uid,
    get_daily_day.time_zone,
    get_daily_day.utc_offset_minutes,
    get_daily_day.reported_at,
    pg_catalog.now()
  );

  v_partner := public.get_my_partner_id();
  if v_partner is null then
    return jsonb_build_object('status', 'unlinked');
  end if;

  v_day := (
    pg_catalog.now() at time zone public.effective_zone(
      get_daily_day.time_zone, get_daily_day.utc_offset_minutes
    )
  )::date;

  v_row := public.assign_couple_day(least(v_uid, v_partner), greatest(v_uid, v_partner), v_day);

  return jsonb_build_object(
    'status', 'ok',
    'snapshot', public.daily_day_snapshot(v_row.id, v_uid, pg_catalog.now())
  );
end;
$$;

comment on function public.get_daily_day(text, integer, timestamptz) is
  'The caller''s day for the date in the zone sent: {status: ''unlinked''} with no partner, '
  'else {status: ''ok'', snapshot} after assign_couple_day opened the pair''s row. Records the '
  'zone sent in user_time_zones first. Pair derived from auth.uid() and get_my_partner_id().';

-- --------------------------------------------
-- submit_daily_pick (client RPC): a thin wrapper
-- --------------------------------------------
create or replace function public.submit_daily_pick(
  day_id uuid,
  choice text,
  picked_at timestamptz,
  time_zone text,
  utc_offset_minutes integer
)
returns jsonb
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

  return public.record_daily_pick(
    v_uid,
    submit_daily_pick.day_id,
    submit_daily_pick.choice,
    submit_daily_pick.picked_at,
    submit_daily_pick.time_zone,
    submit_daily_pick.utc_offset_minutes,
    pg_catalog.now()
  );
end;
$$;

comment on function public.submit_daily_pick(uuid, text, timestamptz, text, integer) is
  'Writes the caller''s pick for a day of their pair through record_daily_pick at now(): once, '
  'within five minutes of now() and on the day''s date in the zone sent (DQ002 / DQ001). A repeat '
  'returns the stored pick unchanged. Returns the day snapshot. The only client write path to '
  'daily_picks.';

commit;
