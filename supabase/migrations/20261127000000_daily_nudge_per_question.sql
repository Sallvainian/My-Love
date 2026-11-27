-- ============================================
-- Simpler daily pushes and nudge, story 11.1: two nudges per question, held
-- until the partner's 8 AM
-- (architecture-daily-question: AD-3, AD-8, AD-9, AD-10, AD-13, AD-15, AD-16, AD-17)
--
-- Written without begin/commit so tests/support/helpers/migration-replay.ts can
-- replay it inside a rolled-back transaction (the Supabase CLI runs a file as
-- one transaction anyway). Every table step is re-runnable.
--
-- == What changes ==
-- * daily_nudges: gains `source` ('prompt' | 'button'), `held` and
--   `released_at`. `source` is backfilled from `slot` (after_pick -> prompt,
--   evening -> button), a sender's duplicates of one (day_id, source) are
--   deleted keeping the earliest (created_at, id), then slot and
--   sender_local_date go and the limit becomes the unique key
--   daily_nudges_sender_day_source_key (from_user, day_id, source): one nudge
--   per sender per question from each source, never a date or a clock.
-- * daily_nudge_slot is dropped; nothing reads the sender's zone any more.
-- * record_daily_nudge(viewer, day_id, source, at) (internal, replaces the
--   3-argument one): in this order 22023 for an unknown source; P0002 unless
--   the day is the viewer's pair's and the link goes both ways (the viewer's
--   partner_id names the partner and the partner's names the viewer); DQ007
--   before the viewer's own pick; DQ008 once the partner has picked; DQ009 once
--   `at` has reached the end of the day on the partner's clock; DQ010 when the
--   (viewer, day, source) nudge exists. A nudge before 08:00 on the partner's
--   clock on the day is recorded `held` (no push yet). The partner's clock is
--   their stored effective_zone, UTC with no user_time_zones row (AD-3). The
--   day row is taken FOR UPDATE and the insert is ON CONFLICT ON CONSTRAINT
--   daily_nudges_sender_day_source_key DO NOTHING (no row -> DQ010).
-- * send_daily_nudge(day_id, source default 'button') (client RPC, replaces the
--   1-argument one): an old build's {day_id} request resolves to it and is
--   recorded as the button's nudge.
-- * daily_day_snapshot (same signature, settings and grants): `nudge` is gone,
--   `nudges {prompt_sent, button_sent, closes_at}` replaces it. closes_at is the
--   end of the day on the partner's clock while the viewer has picked, the
--   partner has not and the link goes both ways, else null. Every other key and
--   the write.target_day walk are copied unchanged from 20261126020000.
-- * release_held_daily_nudges(at) (internal): sets released_at on a held nudge
--   whose recipient's clock reads 08:00 to 08:30 on the nudge's day, when the
--   recipient has not picked, the link goes both ways and no other nudge from
--   the same sender about the day has been pushed. enqueue_daily_reminders
--   (replaced) calls it first, in its own exception block, and its evening_partner
--   skip is now "the recipient has sent any nudge about the day".
-- * Triggers: daily_nudges_push_after_insert is recreated WHEN (not new.held);
--   daily_nudges_push_after_release (AFTER UPDATE OF released_at, WHEN the value
--   goes from null to set) posts the held nudge's push. Both post
--   {kind: 'daily_nudge', id} through notify_push, unchanged.
-- * The comments on daily_nudges, the functions, notify_push() and
--   push_sender_settings are rewritten.
--
-- == Refusal codes ==
-- 22023 'Unknown nudge source', DQ007 'Pick before nudging', DQ008 'Your partner
-- has picked', DQ009 'The day has ended on your partner''s clock', DQ010 'Nudge
-- already sent'.
--
-- == Grants ==
-- send_daily_nudge: security definer, search_path = '', revoked from public and
-- anon, granted to authenticated. record_daily_nudge and
-- release_held_daily_nudges: security definer, search_path = '', revoked from
-- public, anon and authenticated (each named: hosted's default ACL grants each
-- role separately), granted to service_role. daily_day_snapshot and
-- enqueue_daily_reminders keep their internal grants, stated again.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-26 (epic Notes): daily_nudges, daily_reminders and
-- push_preferences match the local stack, and so do the functions and cron jobs
-- by name. No hosted-only names: plain `drop ... if exists` on the names this
-- file replaces.
--
-- pgTAP: 50_daily_nudges.sql pins the source limit, the hold, the release and
-- the snapshot; 47_daily_pushes.sql the columns and keys; 48_daily_reminders.sql
-- the reminder skip; 40_daily_question_gate.sql and
-- 18_function_execute_grants.sql the gate and the grant list. The slot ->
-- source mapping is replayed in a rolled-back transaction by
-- tests/integration/daily-nudge-per-question-migration.spec.ts.
-- ============================================

-- --------------------------------------------
-- daily_nudges: source, held, released_at
-- --------------------------------------------
alter table public.daily_nudges add column if not exists source text;
alter table public.daily_nudges add column if not exists held boolean not null default false;
alter table public.daily_nudges add column if not exists released_at timestamptz;

do $$
begin
  -- Nudges recorded before this file: the owner's decided mapping (story 11.1, criterion 23),
  -- after_pick read as the prompt and evening as the button. The old slot followed the
  -- sender's clock (20:00), so this is not a record of which control was tapped.
  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'daily_nudges' and c.column_name = 'slot'
  ) then
    update public.daily_nudges n
    set source = case when n.slot = 'after_pick' then 'prompt' else 'button' end
    where n.source is null;
  end if;

  -- The DW-532 case: keep each sender's earliest nudge per (day, source).
  delete from public.daily_nudges n
  using public.daily_nudges k
  where n.from_user = k.from_user
    and n.day_id = k.day_id
    and n.source = k.source
    and (k.created_at, k.id) < (n.created_at, n.id);

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.daily_nudges'::regclass and c.conname = 'daily_nudges_source_check'
  ) then
    alter table public.daily_nudges
      add constraint daily_nudges_source_check check (source in ('prompt', 'button'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.daily_nudges'::regclass and c.conname = 'daily_nudges_sender_day_source_key'
  ) then
    alter table public.daily_nudges
      add constraint daily_nudges_sender_day_source_key unique (from_user, day_id, source);
  end if;
end
$$;

alter table public.daily_nudges alter column source set not null;

alter table public.daily_nudges drop constraint if exists daily_nudges_sender_date_slot_key;
alter table public.daily_nudges drop constraint if exists daily_nudges_slot_check;
alter table public.daily_nudges drop column if exists slot;
alter table public.daily_nudges drop column if exists sender_local_date;

comment on table public.daily_nudges is
  'One row per nudge a partner sends (AD-17): from_user nudges to_user about day_id from a source, '
  'the after-answer prompt or the waiting card''s button. The unique key (from_user, day_id, source) '
  'is the server''s limit of one nudge per sender per question from each source. held is true for a '
  'nudge sent before 08:00 on the recipient''s clock on the day: it posts no push on insert, and '
  'release_held_daily_nudges sets released_at at 08:00-08:30 there, which posts it. Its rows are '
  'written by record_daily_nudge, which send_daily_nudge calls; a nudge that is not held posts '
  '{kind: daily_nudge, id} through notify_push on insert. anon and authenticated hold no privilege '
  '(service_role keeps its default privileges). Pinned by supabase/tests/database/47_daily_pushes.sql '
  'and 50_daily_nudges.sql.';

-- --------------------------------------------
-- The functions this file replaces
-- --------------------------------------------
drop function if exists public.daily_nudge_slot(uuid, timestamptz);
drop function if exists public.record_daily_nudge(uuid, uuid, timestamptz);
drop function if exists public.send_daily_nudge(uuid);

-- --------------------------------------------
-- record_daily_nudge (internal)
-- --------------------------------------------
create or replace function public.record_daily_nudge(viewer uuid, day_id uuid, source text, at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_day public.couple_days;
  v_zone text;
  v_hold_ends timestamptz;
  v_closes_at timestamptz;
  v_id uuid;
begin
  if record_daily_nudge.source is distinct from 'prompt'
     and record_daily_nudge.source is distinct from 'button'
  then
    raise exception 'Unknown nudge source' using errcode = '22023';
  end if;

  select u.partner_id into v_partner
  from public.users u
  where u.id = record_daily_nudge.viewer;

  -- Membership and the link both ways are in the WHERE clause, so a viewer
  -- outside the pair never takes the row lock; the lock serialises with
  -- record_daily_pick on the same day.
  select * into v_day
  from public.couple_days cd
  where cd.id = record_daily_nudge.day_id
    and v_partner is not null
    and ((cd.user_a = record_daily_nudge.viewer and cd.user_b = v_partner)
      or (cd.user_a = v_partner and cd.user_b = record_daily_nudge.viewer))
    and exists (
      select 1 from public.users p
      where p.id = v_partner and p.partner_id = record_daily_nudge.viewer
    )
  for update;
  if not found then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = record_daily_nudge.viewer
  ) then
    raise exception 'Pick before nudging' using errcode = 'DQ007';
  end if;

  if exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = v_partner
  ) then
    raise exception 'Your partner has picked' using errcode = 'DQ008';
  end if;

  -- The one read of a zone: the partner's (AD-3), UTC with no row.
  select z.effective_zone into v_zone
  from public.user_time_zones z
  where z.user_id = v_partner;
  v_hold_ends := (v_day.day::timestamp + time '08:00') at time zone coalesce(v_zone, 'UTC');
  v_closes_at := ((v_day.day + 1)::timestamp) at time zone coalesce(v_zone, 'UTC');

  if record_daily_nudge.at >= v_closes_at then
    raise exception 'The day has ended on your partner''s clock' using errcode = 'DQ009';
  end if;

  if exists (
    select 1 from public.daily_nudges n
    where n.from_user = record_daily_nudge.viewer
      and n.day_id = v_day.id
      and n.source = record_daily_nudge.source
  ) then
    raise exception 'Nudge already sent' using errcode = 'DQ010';
  end if;

  -- A concurrent duplicate loses the unique key here and inserts nothing.
  insert into public.daily_nudges (from_user, to_user, day_id, source, held)
  values (
    record_daily_nudge.viewer, v_partner, v_day.id, record_daily_nudge.source,
    record_daily_nudge.at < v_hold_ends
  )
  on conflict on constraint daily_nudges_sender_day_source_key do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Nudge already sent' using errcode = 'DQ010';
  end if;

  return public.daily_day_snapshot(v_day.id, record_daily_nudge.viewer, record_daily_nudge.at);
end;
$$;

comment on function public.record_daily_nudge(uuid, uuid, text, timestamptz) is
  'Writes the viewer''s nudge for a day of their pair from a source, prompt or button (AD-17), once '
  'per sender, day and source. Refuses in this order: 22023 for an unknown source, P0002 unless the '
  'day is the viewer''s current pair''s and the partner''s partner_id names the viewer, DQ007 before '
  'the viewer''s own pick, DQ008 once the partner has picked, DQ009 once `at` has reached the end of '
  'the day on the partner''s clock (their stored zone, UTC with no row), DQ010 when the viewer''s '
  'nudge from that source exists. A nudge before 08:00 on the partner''s clock on the day is stored '
  'held and posts no push until release_held_daily_nudges. Takes the day row FOR UPDATE; a '
  'concurrent duplicate loses the unique key and is refused as DQ010. Returns the viewer''s day '
  'snapshot. Reads no clock but `at`. Internal.';

revoke execute on function public.record_daily_nudge(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_daily_nudge(uuid, uuid, text, timestamptz) to service_role;

-- --------------------------------------------
-- send_daily_nudge (client RPC): a thin wrapper
-- --------------------------------------------
create or replace function public.send_daily_nudge(day_id uuid, source text default 'button')
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

  return public.record_daily_nudge(v_uid, send_daily_nudge.day_id, send_daily_nudge.source, pg_catalog.now());
end;
$$;

comment on function public.send_daily_nudge(uuid, text) is
  'Nudges the caller''s partner about a day of their pair through record_daily_nudge at now(), from '
  'the prompt or the button (default button, so a build''s old {day_id} request is the button''s '
  'nudge): after the caller''s own pick, while the partner has not picked and the day has not ended '
  'on the partner''s clock, once per source and day (22023 / DQ007 / DQ008 / DQ009 / DQ010; P0002 '
  'for a day outside the caller''s pair or a one-way link). Returns the caller''s snapshot of the '
  'day. The only client write path to a nudge.';

revoke execute on function public.send_daily_nudge(uuid, text) from public, anon;
grant execute on function public.send_daily_nudge(uuid, text) to authenticated;

-- --------------------------------------------
-- daily_day_snapshot: `nudges` replaces `nudge`
-- --------------------------------------------
create or replace function public.daily_day_snapshot(day_id uuid, viewer uuid, at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day public.couple_days;
  v_partner uuid;
  v_this text;
  v_that text;
  v_mine boolean;
  v_theirs boolean;
  v_state text;
  v_my_choice text;
  v_my_picked_at timestamptz;
  v_partner_choice text;
  v_question uuid;
  v_target date;
  v_asked date;
  v_date date;
  v_other uuid;
  v_other_target date;
  v_other_source date;
  v_taken uuid[] := '{}';
  v_zone text;
  v_closes_at timestamptz;
begin
  select * into v_day
  from public.couple_days cd
  where cd.id = daily_day_snapshot.day_id;
  if not found
     or daily_day_snapshot.viewer is null
     or daily_day_snapshot.viewer not in (v_day.user_a, v_day.user_b)
  then
    return null;
  end if;

  v_partner := case
    when daily_day_snapshot.viewer = v_day.user_a then v_day.user_b
    else v_day.user_a
  end;

  select q.this_text, q.that_text into v_this, v_that
  from public.daily_questions q
  where q.id = v_day.question_id;

  -- Existence only: the fact that a partner picked is visible, what they chose is not.
  v_mine := exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = daily_day_snapshot.viewer
  );
  v_theirs := exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = v_partner
  );
  v_state := case
    when v_mine and v_theirs then 'both'
    when v_mine then 'me'
    when v_theirs then 'partner'
    else 'none'
  end;

  select vp.choice, vp.picked_at into v_my_choice, v_my_picked_at
  from public.visible_daily_picks(daily_day_snapshot.viewer, daily_day_snapshot.at) vp
  where vp.day_id = v_day.id and vp.user_id = daily_day_snapshot.viewer;

  select vp.choice into v_partner_choice
  from public.visible_daily_picks(daily_day_snapshot.viewer, daily_day_snapshot.at) vp
  where vp.day_id = v_day.id and vp.user_id = v_partner;

  -- nudges: whether the viewer's nudge from each source is on record for this
  -- day (always, whatever the state), and the instant the day stops taking
  -- nudges, the end of the day on the partner's clock (UTC with no
  -- user_time_zones row, AD-3). closes_at is given only while a nudge could
  -- still be offered: the viewer has picked, the partner has not and the link
  -- goes both ways, as enqueue_daily_reminders reads it. The server does not
  -- null it after the instant; the client compares it with its own clock.
  if v_mine
     and not v_theirs
     and exists (
       select 1
       from public.users a
       join public.users b on b.id = a.partner_id and b.partner_id = a.id
       where a.id = daily_day_snapshot.viewer and a.partner_id = v_partner
     )
  then
    select z.effective_zone into v_zone
    from public.user_time_zones z
    where z.user_id = v_partner;
    v_closes_at := ((v_day.day + 1)::timestamp) at time zone coalesce(v_zone, 'UTC');
  end if;

  -- write.target_day: the date the day's written question is asked (see
  -- 20261107000000). The stored question, if any, and the date that asks it.
  select q.id, q.target_day into v_question, v_target
  from public.daily_questions q
  where q.source_day_id = v_day.id;
  if v_question is not null then
    select min(asked.day) into v_asked
    from public.couple_days asked
    where asked.question_id = v_question;
  end if;

  if v_asked is not null then
    v_target := v_asked;
  else
    -- With no stored question, record_written_question's target: the first
    -- later date with no couple_days row for the pair.
    if v_target is null then
      v_target := v_day.day + 1;
      while exists (
        select 1 from public.couple_days cd
        where cd.user_a = v_day.user_a and cd.user_b = v_day.user_b and cd.day = v_target
      ) loop
        v_target := v_target + 1;
      end loop;
    end if;

    -- assign_couple_day's order over the free dates after the day.
    v_date := v_day.day;
    loop
      v_date := v_date + 1;
      continue when exists (
        select 1 from public.couple_days cd
        where cd.user_a = v_day.user_a and cd.user_b = v_day.user_b and cd.day = v_date
      );

      v_other := null;
      select q.id, q.target_day, src.day into v_other, v_other_target, v_other_source
      from public.daily_questions q
      join public.couple_days src on src.id = q.source_day_id
      where q.user_a = v_day.user_a
        and q.user_b = v_day.user_b
        and q.source_day_id <> v_day.id
        and q.target_day <= v_date
        and not exists (
          select 1 from public.couple_days asked where asked.question_id = q.id
        )
        and not (q.id = any (v_taken))
      order by q.target_day, src.day, q.id
      limit 1;

      -- This day's question is eligible and comes first: the date asks it.
      -- (Source days are unique, so the id never decides between the two.)
      exit when v_date >= v_target
        and (v_other is null or (v_target, v_day.day) < (v_other_target, v_other_source));

      if v_other is not null then
        v_taken := v_taken || v_other;
      end if;
    end loop;
    v_target := v_date;
  end if;

  return jsonb_build_object(
    'day_id', v_day.id,
    'day', v_day.day,
    'question', jsonb_build_object('this', v_this, 'that', v_that),
    'state', v_state,
    'my_choice', v_my_choice,
    'my_picked_at', v_my_picked_at,
    'partner_choice', v_partner_choice,
    'same', case
      when v_my_choice is not null and v_partner_choice is not null
        then v_my_choice = v_partner_choice
    end,
    'write', jsonb_build_object(
      'mine', daily_day_snapshot.viewer = v_day.writer,
      'done', exists (
        select 1 from public.daily_questions q where q.source_day_id = v_day.id
      ),
      'target_day', v_target
    ),
    'nudges', jsonb_build_object(
      'prompt_sent', exists (
        select 1 from public.daily_nudges n
        where n.from_user = daily_day_snapshot.viewer
          and n.day_id = v_day.id
          and n.source = 'prompt'
      ),
      'button_sent', exists (
        select 1 from public.daily_nudges n
        where n.from_user = daily_day_snapshot.viewer
          and n.day_id = v_day.id
          and n.source = 'button'
      ),
      'closes_at', v_closes_at
    )
  );
end;
$$;

comment on function public.daily_day_snapshot(uuid, uuid, timestamptz) is
  'The one day snapshot (AD-16): day, question, state, the viewer''s own pick and, once the '
  'viewer has picked, the partner''s choice and Same/Different. write carries mine, done and '
  'target_day: the date the day''s written question is asked, or would be if written now, '
  'projected through assign_couple_day''s order over the pair''s free dates after the day. '
  'nudges carries prompt_sent and button_sent, whether the viewer''s nudge from each source is on '
  'record for the day (always), and closes_at, the end of the day on the partner''s clock (their '
  'stored zone, UTC with no row) while the viewer has picked, the partner has not and the link '
  'goes both ways, otherwise null; it is not nulled after the instant. There is no `nudge` key. '
  'Null when the viewer is not in the day''s pair. Reads choices only through visible_daily_picks. '
  '`at` decides nothing but the choices'' visibility. Internal.';

revoke execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) to service_role;

-- --------------------------------------------
-- release_held_daily_nudges (internal)
-- --------------------------------------------
create or replace function public.release_held_daily_nudges(at timestamptz)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_rows integer;
  v_count integer := 0;
begin
  if release_held_daily_nudges.at is null then
    return 0;
  end if;

  -- A recipient with no stored zone is never released (AD-3): the inner join
  -- drops them. The order makes the first of two held nudges about one
  -- question win, so the second finds its sibling pushed and is dropped.
  for r in
    select n.id, n.from_user, n.to_user, n.day_id
      from public.daily_nudges n
      join public.couple_days d on d.id = n.day_id
      join public.user_time_zones z on z.user_id = n.to_user
     where n.held
       and n.released_at is null
       and (release_held_daily_nudges.at at time zone z.effective_zone)::date = d.day
       and (release_held_daily_nudges.at at time zone z.effective_zone)::time >= time '08:00'
       and (release_held_daily_nudges.at at time zone z.effective_zone)::time < time '08:30'
     order by n.from_user, n.day_id, n.created_at, n.id
  loop
    begin
      -- Serialises with record_daily_pick and record_daily_nudge on the day.
      perform 1 from public.couple_days d where d.id = r.day_id for update;

      if exists (
        select 1 from public.daily_picks k
        where k.day_id = r.day_id and k.user_id = r.to_user
      ) then
        continue;
      end if;

      if not exists (
        select 1
        from public.users a
        join public.users b on b.id = a.partner_id and b.partner_id = a.id
        where a.id = r.from_user and a.partner_id = r.to_user
      ) then
        continue;
      end if;

      if exists (
        select 1 from public.daily_nudges s
        where s.from_user = r.from_user
          and s.day_id = r.day_id
          and s.id <> r.id
          and (not s.held or s.released_at is not null)
      ) then
        continue;
      end if;

      update public.daily_nudges n
         set released_at = release_held_daily_nudges.at
       where n.id = r.id and n.released_at is null;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    exception when others then
      raise warning 'release_held_daily_nudges: % (%)', sqlerrm, r.id;
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.release_held_daily_nudges(timestamptz) is
  'Sets released_at on held nudges whose recipient''s clock at the instant given reads 08:00 to '
  '08:30 on the nudge''s day (AD-9), which posts the nudge''s push through the release trigger. A '
  'recipient with no stored zone is never released. Skips a nudge when the recipient has picked, '
  'the link does not go both ways, or another nudge from the same sender about the day has been '
  'pushed (not held, or released), so two nudges about one question send one push; a skipped '
  'nudge stays unreleased and still counts as sent. Each nudge runs in its own exception block (a '
  'warning). Reads no clock but `at` (AD-8). Returns the nudges released; a repeat releases none. '
  'enqueue_daily_reminders calls it. Internal.';

revoke execute on function public.release_held_daily_nudges(timestamptz) from public, anon, authenticated;
grant execute on function public.release_held_daily_nudges(timestamptz) to service_role;

-- --------------------------------------------
-- enqueue_daily_reminders: releases held nudges, new evening_partner skip
-- --------------------------------------------
create or replace function public.enqueue_daily_reminders(at timestamptz)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_local timestamp;
  v_slot text;
  v_date date;
  v_day public.couple_days;
  v_self_picked boolean;
  v_partner_picked boolean;
  v_kind text;
  v_rows integer;
  v_count integer := 0;
begin
  if enqueue_daily_reminders.at is null then
    return 0;
  end if;

  -- Held nudges whose hold has ended go out on this same tick (story 11.1).
  -- Its failure never costs a reminder its row, and the count returned stays
  -- the reminder rows inserted.
  begin
    perform public.release_held_daily_nudges(enqueue_daily_reminders.at);
  exception when others then
    raise warning 'enqueue_daily_reminders: release_held_daily_nudges: %', sqlerrm;
  end;

  for r in
    select u.id as user_id, u.partner_id, z.effective_zone
      from public.users u
      join public.users p on p.id = u.partner_id and p.partner_id = u.id
      join public.user_time_zones z on z.user_id = u.id
     where exists (select 1 from public.push_devices d where d.user_id = u.id)
     order by u.id
  loop
    begin
      v_local := enqueue_daily_reminders.at at time zone r.effective_zone;
      v_slot := case when v_local::time >= '08:00' and v_local::time < '08:30' then 'morning'
                     when v_local::time >= '20:00' and v_local::time < '20:30' then 'evening' end;
      if v_slot is null then
        continue;
      end if;
      v_date := v_local::date;

      if exists (
        select 1 from public.daily_reminders x
         where x.user_id = r.user_id and x.local_date = v_date and x.slot = v_slot
      ) then
        continue;
      end if;

      v_day := public.assign_couple_day(
        least(r.user_id, r.partner_id), greatest(r.user_id, r.partner_id), v_date
      );

      v_self_picked := exists (
        select 1 from public.daily_picks k where k.day_id = v_day.id and k.user_id = r.user_id
      );

      if v_slot = 'morning' then
        if v_self_picked then
          continue;
        end if;
        v_kind := 'morning';
      else
        v_partner_picked := exists (
          select 1 from public.daily_picks k where k.day_id = v_day.id and k.user_id = r.partner_id
        );
        if v_self_picked and v_partner_picked then
          continue;
        end if;
        if not v_self_picked then
          v_kind := 'evening_self';
        else
          if exists (
            select 1 from public.daily_nudges n
             where n.from_user = r.user_id
               and n.day_id = v_day.id
          ) then
            continue;
          end if;
          v_kind := 'evening_partner';
        end if;
      end if;

      insert into public.daily_reminders (user_id, kind, local_date, day_id)
      values (r.user_id, v_kind, v_date, v_day.id)
      on conflict (user_id, local_date, slot) do nothing;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    exception when others then
      -- One person's failure never costs the others their push, but it should
      -- show in the database log rather than vanish.
      raise warning 'enqueue_daily_reminders: % (%)', sqlerrm, r.user_id;
    end;
  end loop;

  return v_count;
end;
$$;

comment on function public.enqueue_daily_reminders(timestamptz) is
  'First releases the held nudges whose hold has ended (release_held_daily_nudges, in its own '
  'exception block). Then inserts the daily_reminders row of each eligible person (linked both '
  'ways, a push device and a stored zone) whose own clock at the instant given reads 08:00 to '
  '08:30 (morning, recipient has not picked) or 20:00 to 20:30 (evening: evening_self while the '
  'recipient has not picked, else evening_partner unless the recipient has sent a nudge about the '
  'day; none once both picked), after assign_couple_day for their local date (AD-9). Reads no '
  'other clock (AD-8). One person''s error is a warning. Returns the reminder rows inserted; a '
  'repeat inserts none. Internal.';

revoke execute on function public.enqueue_daily_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_daily_reminders(timestamptz) to service_role;

-- --------------------------------------------
-- The nudge's push: on insert unless held, on release
-- --------------------------------------------
drop trigger if exists daily_nudges_push_after_insert on public.daily_nudges;
create trigger daily_nudges_push_after_insert
  after insert on public.daily_nudges
  for each row
  when (not new.held)
  execute function public.notify_push('daily_nudge');

drop trigger if exists daily_nudges_push_after_release on public.daily_nudges;
create trigger daily_nudges_push_after_release
  after update of released_at on public.daily_nudges
  for each row
  when (old.released_at is null and new.released_at is not null)
  execute function public.notify_push('daily_nudge');

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events, anniversaries, daily_reminders, '
  'daily_picks and daily_nudges (not held), the partner_requests triggers, and the AFTER UPDATE '
  'trigger that posts a held daily_nudges row when released_at is set: posts {kind, id} (kind is '
  'the trigger argument) to the send-push Edge Function asynchronously and swallows every error.';

comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests, events, '
  'anniversaries, daily_reminders, daily_picks, daily_nudges). One row, service role only; with '
  'no row both do nothing.';
