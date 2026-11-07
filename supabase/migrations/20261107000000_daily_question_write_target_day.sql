-- ============================================
-- Daily Question: the write sheet names the day a written question arrives
-- (DW-494; architecture-daily-question: AD-4, AD-16)
--
-- == What changes ==
-- * daily_day_snapshot (replaced, same signature, settings and grants): the
--   snapshot's `write` object gains `target_day`, the date the day's written
--   question is asked, or would be if written now:
--     1. a question written from the day that a couple_days row already asks:
--        that row's day.
--     2. otherwise the date assign_couple_day (20261106000000) will ask it on.
--        The question is the stored one (its target_day) or, with none, a
--        hypothetical one stored as record_written_question (20261106000000,
--        step 7) would store it: target the first date after the day with no
--        couple_days row for the pair. The walk goes through the pair's dates
--        after the day that have no couple_days row, in order, and on each one
--        takes what assign_couple_day would ask: the earliest waiting written
--        question of the pair (target_day <= the date, no couple_days row asks
--        it, not taken on an earlier date of the walk) by target_day, then the
--        source day's date, then id. The first date that takes this day's
--        question is the answer. A date with nothing waiting goes to the pool.
--   So two questions waiting on one target are asked a day apart, the later
--   source day second, and its writer's sheet names that second day. The walk
--   assumes the dates opened next are the free dates after the day, in order.
--   record_written_question and its stored target_day are unchanged.
--   assign_couple_day's pending-question rule and record_written_question's
--   target rule are copied here, so a change to either must change this
--   function in the same migration.
--   Computed for every viewer; the client reads it only while the turn is the
--   viewer's and open. Everything else in the snapshot is as 20261105030000
--   built it.
--
-- == Grants ==
-- create or replace keeps the function's ACL; the revoke and grant are stated
-- again as 20261105030000 states them. Still security definer, stable,
-- search_path = ''. No new function, so FN-GRANT-008 and the gate lists in
-- 40_daily_question_gate.sql are unchanged.
--
-- pgTAP: 42_daily_question_written_questions.sql pins target_day: the day + 1
-- with nothing waiting, the next free date when a partner opened it, the day
-- that asks a question once asked, and the second of two questions waiting on
-- one target named a day later; 40_daily_question_gate.sql pins the keys of
-- `write`.
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
  v_question uuid;
  v_target date;
  v_asked date;
  v_date date;
  v_other uuid;
  v_other_target date;
  v_other_source date;
  v_taken uuid[] := '{}';
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

  -- write.target_day: the date the day's written question is asked (see the
  -- header). The stored question, if any, and the date that asks it.
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
    )
  );
end;
$$;

comment on function public.daily_day_snapshot(uuid, uuid, timestamptz) is
  'The one day snapshot (AD-16): day, question, state, the viewer''s own pick and, once the '
  'viewer has picked, the partner''s choice and Same/Different. write carries mine, done and '
  'target_day: the date the day''s written question is asked, or would be if written now, '
  'projected through assign_couple_day''s order over the pair''s free dates after the day. '
  'Null when the viewer is not in the day''s pair. Reads choices only through '
  'visible_daily_picks. `at` is unused until a later epic. Internal.';

revoke execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) to service_role;

commit;
