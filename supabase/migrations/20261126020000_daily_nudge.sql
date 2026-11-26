-- ============================================
-- Daily pushes and nudge, story 8.7: the server takes a nudge and pushes it
-- (architecture-daily-question: AD-8, AD-10, AD-15, AD-16, AD-17; requirement R2)
--
-- == What changes ==
-- * daily_nudge_slot(sender, at) (internal): the one definition of the sender's
--   slot. 'after_pick' while the sender's stored-zone clock (UTC with no
--   user_time_zones row, AD-3) reads before 20:00, 'evening' from 20:00. Both
--   record_daily_nudge and daily_day_snapshot call it.
-- * record_daily_nudge(viewer, day_id, at) (internal): writes one daily_nudges
--   row for a day of the viewer's current pair. In this order: P0002 unless the
--   day is the viewer's pair's (users.partner_id, as record_written_question
--   reads it); DQ007 before the viewer's own pick; DQ008 once the partner has
--   picked; DQ009 unless the partner's local date at `at` is the day; DQ010 when
--   the (viewer, sender-local date, slot) is spent. The day row is taken FOR
--   UPDATE, which serialises with record_daily_pick, and the insert is
--   ON CONFLICT ON CONSTRAINT daily_nudges_sender_date_slot_key DO NOTHING with
--   no row inserted raising DQ010, so a concurrent duplicate is refused too.
--   Returns daily_day_snapshot(day, viewer, at). Reads no clock but `at` (AD-8).
-- * send_daily_nudge(day_id) (client RPC): the thin wrapper over
--   record_daily_nudge at pg_catalog.now(), refusing a NULL auth.uid() with
--   'Authentication required' (AD-15 tier: takes only the day).
-- * daily_nudges gains its AFTER INSERT trigger daily_nudges_push_after_insert,
--   which posts {kind: 'daily_nudge', id} through notify_push (AD-10), reused
--   unchanged. The sender has known daily_nudge since story 8.3 (a deploy ahead
--   of this trigger), so the trigger meets a sender that already accepts it.
-- * daily_day_snapshot (replaced, same signature, settings and grants) gains
--   `nudge {slot, spent}` (AD-16). `slot` is daily_nudge_slot(viewer, at) when
--   the viewer has picked, the partner has not, the partner is the viewer's
--   current partner_id and the partner's local date at `at` is the day;
--   otherwise null. `spent` is whether a daily_nudges row from the viewer has
--   that sender-local date and slot, false with no slot. Every other key and the
--   write.target_day walk are copied unchanged from 20261107000000, so a change
--   to either must change both in the same migration.
-- * The comments on daily_nudges, notify_push(), push_sender_settings and
--   daily_day_snapshot (its `at` is now used) are rewritten.
--
-- == Refusal codes ==
-- DQ007 'Pick before nudging', DQ008 'Your partner has picked', DQ009 'The day
-- is not your partner's current date', DQ010 'Nudge already sent'.
--
-- == Grants ==
-- send_daily_nudge: security definer, search_path = '', revoked from public and
-- anon, granted to authenticated. daily_nudge_slot and record_daily_nudge:
-- security definer, search_path = '', revoked from public, anon and
-- authenticated (each named: hosted's default ACL grants each role separately),
-- granted to service_role. daily_day_snapshot keeps its internal grants, stated
-- again.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-26: daily_nudges, daily_day_snapshot and
-- user_local_date exist; send_daily_nudge, record_daily_nudge and
-- daily_nudge_slot do not; no trigger on daily_nudges, daily_picks or
-- daily_reminders. No hosted-only names to drop.
--
-- pgTAP: 50_daily_nudges.sql pins the slot, the rules, the snapshot and the
-- trigger's queued call; 40_daily_question_gate.sql (DAILY-038 and the new
-- client RPC's cases) and 18_function_execute_grants.sql (FN-GRANT-008) pin the
-- gate and the grant list.
-- ============================================

begin;

-- --------------------------------------------
-- daily_nudge_slot (internal)
-- --------------------------------------------
create function public.daily_nudge_slot(sender uuid, at timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zone text;
begin
  if daily_nudge_slot.sender is null or daily_nudge_slot.at is null then
    return null;
  end if;

  select z.effective_zone into v_zone
  from public.user_time_zones z
  where z.user_id = daily_nudge_slot.sender;

  return case
    when (daily_nudge_slot.at at time zone coalesce(v_zone, 'UTC'))::time < time '20:00'
      then 'after_pick'
    else 'evening'
  end;
end;
$$;

comment on function public.daily_nudge_slot(uuid, timestamptz) is
  'The slot a nudge sent by `sender` at the instant `at` takes (AD-17): after_pick while the '
  'sender''s clock in their stored effective_zone (UTC with no user_time_zones row, AD-3) reads '
  'before 20:00, evening from 20:00. The one definition of the slot: record_daily_nudge and '
  'daily_day_snapshot both call it. Null for a null argument. Stores nothing. Internal.';

revoke execute on function public.daily_nudge_slot(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_nudge_slot(uuid, timestamptz) to service_role;

-- --------------------------------------------
-- record_daily_nudge (internal)
-- --------------------------------------------
create function public.record_daily_nudge(viewer uuid, day_id uuid, at timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_day public.couple_days;
  v_date date;
  v_slot text;
  v_id uuid;
begin
  select u.partner_id into v_partner
  from public.users u
  where u.id = record_daily_nudge.viewer;

  -- Membership is in the WHERE clause, so a viewer outside the pair never takes
  -- the row lock; the lock serialises with record_daily_pick on the same day.
  select * into v_day
  from public.couple_days cd
  where cd.id = record_daily_nudge.day_id
    and v_partner is not null
    and ((cd.user_a = record_daily_nudge.viewer and cd.user_b = v_partner)
      or (cd.user_a = v_partner and cd.user_b = record_daily_nudge.viewer))
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

  if public.user_local_date(v_partner, record_daily_nudge.at) is distinct from v_day.day then
    raise exception 'The day is not your partner''s current date' using errcode = 'DQ009';
  end if;

  v_date := public.user_local_date(record_daily_nudge.viewer, record_daily_nudge.at);
  v_slot := public.daily_nudge_slot(record_daily_nudge.viewer, record_daily_nudge.at);

  if exists (
    select 1 from public.daily_nudges n
    where n.from_user = record_daily_nudge.viewer
      and n.sender_local_date = v_date
      and n.slot = v_slot
  ) then
    raise exception 'Nudge already sent' using errcode = 'DQ010';
  end if;

  -- A concurrent duplicate loses the unique key here and inserts nothing.
  insert into public.daily_nudges (from_user, to_user, day_id, sender_local_date, slot)
  values (record_daily_nudge.viewer, v_partner, v_day.id, v_date, v_slot)
  on conflict on constraint daily_nudges_sender_date_slot_key do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Nudge already sent' using errcode = 'DQ010';
  end if;

  return public.daily_day_snapshot(v_day.id, record_daily_nudge.viewer, record_daily_nudge.at);
end;
$$;

comment on function public.record_daily_nudge(uuid, uuid, timestamptz) is
  'Writes the viewer''s nudge for a day of their pair (AD-17), once per sender-local date and slot. '
  'Refuses in this order: P0002 unless the day is the viewer''s current pair''s, DQ007 before the '
  'viewer''s own pick, DQ008 once the partner has picked, DQ009 unless the partner''s local date at '
  '`at` is the day, DQ010 when the viewer''s sender-local date and slot (daily_nudge_slot) is '
  'spent. Takes the day row FOR UPDATE; a concurrent duplicate loses the unique key and is refused '
  'as DQ010. The insert posts the nudge push through its trigger. Returns the viewer''s day '
  'snapshot. Reads no clock but `at`. Internal.';

revoke execute on function public.record_daily_nudge(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.record_daily_nudge(uuid, uuid, timestamptz) to service_role;

-- --------------------------------------------
-- send_daily_nudge (client RPC): a thin wrapper
-- --------------------------------------------
create function public.send_daily_nudge(day_id uuid)
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

  return public.record_daily_nudge(v_uid, send_daily_nudge.day_id, pg_catalog.now());
end;
$$;

comment on function public.send_daily_nudge(uuid) is
  'Nudges the caller''s partner about a day of their pair through record_daily_nudge at now(): '
  'after the caller''s own pick, while the partner has not picked and the day is still the '
  'partner''s date, once per slot of the caller''s clock (DQ007 / DQ008 / DQ009 / DQ010; P0002 for '
  'a day outside the caller''s pair). Returns the caller''s snapshot of the day. The only client '
  'write path to a nudge.';

revoke execute on function public.send_daily_nudge(uuid) from public, anon;
grant execute on function public.send_daily_nudge(uuid) to authenticated;

-- --------------------------------------------
-- daily_day_snapshot: gains `nudge`
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
  v_nudge_slot text;
  v_nudge_spent boolean := false;
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

  -- nudge: the slot a nudge sent now would take, only while it could be sent
  -- (the viewer has picked, the partner has not, the pair is current and the
  -- day is still the partner's date), and whether that slot is spent.
  if v_mine
     and not v_theirs
     and v_partner is not distinct from (
       select u.partner_id from public.users u where u.id = daily_day_snapshot.viewer
     )
     and public.user_local_date(v_partner, daily_day_snapshot.at) is not distinct from v_day.day
  then
    v_nudge_slot := public.daily_nudge_slot(daily_day_snapshot.viewer, daily_day_snapshot.at);
  end if;
  if v_nudge_slot is not null then
    v_nudge_spent := exists (
      select 1 from public.daily_nudges n
      where n.from_user = daily_day_snapshot.viewer
        and n.sender_local_date = public.user_local_date(daily_day_snapshot.viewer, daily_day_snapshot.at)
        and n.slot = v_nudge_slot
    );
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
    'nudge', jsonb_build_object(
      'slot', v_nudge_slot,
      'spent', v_nudge_spent
    )
  );
end;
$$;

comment on function public.daily_day_snapshot(uuid, uuid, timestamptz) is
  'The one day snapshot (AD-16): day, question, state, the viewer''s own pick and, once the '
  'viewer has picked, the partner''s choice and Same/Different. write carries mine, done and '
  'target_day: the date the day''s written question is asked, or would be if written now, '
  'projected through assign_couple_day''s order over the pair''s free dates after the day. '
  'nudge carries slot and spent: slot is daily_nudge_slot(viewer, at) while the viewer has picked, '
  'the partner has not, the partner is the viewer''s current partner_id and the partner''s local '
  'date at `at` is the day, otherwise null; spent is whether the viewer''s nudge for that '
  'sender-local date and slot exists, false with no slot. Null when the viewer is not in the '
  'day''s pair. Reads choices only through visible_daily_picks. `at` decides the nudge. Internal.';

revoke execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) to service_role;

-- --------------------------------------------
-- The nudge posts a push
-- --------------------------------------------
drop trigger if exists daily_nudges_push_after_insert on public.daily_nudges;
create trigger daily_nudges_push_after_insert
  after insert on public.daily_nudges
  for each row
  execute function public.notify_push('daily_nudge');

comment on table public.daily_nudges is
  'One row per nudge a partner sends (AD-17): from_user nudges to_user about day_id, in the slot '
  '(after_pick before 20:00 on the sender''s clock, evening from 20:00) of the sender''s local date. '
  'The unique key is the server''s limit of one nudge per slot. Its rows are written by '
  'record_daily_nudge, which send_daily_nudge calls, and inserting one posts {kind: daily_nudge, '
  'id} through notify_push. anon and authenticated hold no privilege (service_role keeps its '
  'default privileges). Pinned by supabase/tests/database/47_daily_pushes.sql and '
  '50_daily_nudges.sql.';

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events, anniversaries, daily_reminders, '
  'daily_picks and daily_nudges, and the partner_requests triggers: posts {kind, id} (kind is the '
  'trigger argument) to the send-push Edge Function asynchronously and swallows every error.';

comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests, events, '
  'anniversaries, daily_reminders, daily_picks, daily_nudges). One row, service role only; with '
  'no row both do nothing.';

commit;
