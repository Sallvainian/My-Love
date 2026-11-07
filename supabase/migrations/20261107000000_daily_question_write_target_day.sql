-- ============================================
-- Daily Question: the write sheet names the day a written question arrives
-- (DW-494; architecture-daily-question: AD-4, AD-16)
--
-- == What changes ==
-- * daily_day_snapshot (replaced, same signature, settings and grants): the
--   snapshot's `write` object gains `target_day`, the date a question written
--   now from the day would be stored for. Once a question was written from the
--   day it is that row's target_day, which a retry returns unchanged. Before,
--   it is the rule record_written_question (20261106000000, step 7) applies:
--   the first date after the day with no couple_days row for the day's pair,
--   which is the day + 1 unless a partner whose clock is ahead has already
--   opened that date. Computed for every viewer; the client reads it only
--   while the turn is the viewer's and open. record_written_question is
--   unchanged and keeps its own copy of the rule, so the two must change
--   together.
--   Everything else in the snapshot is as 20261105030000 built it.
--
-- == Grants ==
-- create or replace keeps the function's ACL; the revoke and grant are stated
-- again as 20261105030000 states them. Still security definer, stable,
-- search_path = ''. No new function, so FN-GRANT-008 and the gate lists in
-- 40_daily_question_gate.sql are unchanged.
--
-- pgTAP: 42_daily_question_written_questions.sql pins target_day (the day + 1
-- with no row there, the next free date when there is); 40_daily_question_gate.sql
-- pins the keys of `write`.
-- ============================================

begin;

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
  v_target date;
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

  -- The stored question's target; with none, record_written_question's rule:
  -- the first later date with no couple_days row for the pair.
  select q.target_day into v_target
  from public.daily_questions q
  where q.source_day_id = v_day.id;
  if v_target is null then
    v_target := v_day.day + 1;
    while exists (
      select 1 from public.couple_days cd
      where cd.user_a = v_day.user_a and cd.user_b = v_day.user_b and cd.day = v_target
    ) loop
      v_target := v_target + 1;
    end loop;
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
    )
  );
end;
$$;

comment on function public.daily_day_snapshot(uuid, uuid, timestamptz) is
  'The one day snapshot (AD-16): day, question, state, the viewer''s own pick and, once the '
  'viewer has picked, the partner''s choice and Same/Different. write carries mine, done and '
  'target_day: the written question''s target_day, or with none the first later date with no '
  'couple_days row for the pair (record_written_question''s target). Null when the viewer is not in the day''s pair. Reads choices only through '
  'visible_daily_picks. `at` is unused until a later epic. Internal.';

revoke execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) to service_role;

commit;
