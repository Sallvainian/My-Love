-- ============================================
-- Daily Question, story 6.3: tomorrow's question is written in turns on the
-- server
-- (architecture-daily-question: AD-4, AD-8, AD-15, AD-16)
--
-- == What changes ==
-- * daily_questions_written_has_target: a couple-written row (user_a set)
--   must carry a target_day.
-- * record_written_question(viewer, day_id, this_text, that_text, at)
--   (internal): the only writer of a couple's written question. Takes the
--   pair's advisory lock, then checks in this order, each later check running
--   only when the earlier ones pass:
--     1. viewer has no partner, or day_id is not a day of the viewer's pair
--        (the pair is (least, greatest) of viewer and public.users.partner_id,
--        which is what get_my_partner_id() reads for auth.uid()): P0002
--        'Day not found'. The lock is the one assign_couple_day takes
--        ('couple_days:' || user_a || ':' || user_b), taken before the day row
--        is selected.
--     2. the viewer's own daily_picks row for the day is missing: DQ005.
--     3. the viewer is not the day's couple_days.writer: DQ004.
--     4. a daily_questions row with source_day_id = day_id exists: the day's
--        snapshot comes back, the stored row unchanged, whatever the new texts
--        or `at` (a retry).
--     5. `at`, in the effective_zone stored on the viewer's own pick, is not
--        the day's date: DQ006. The pick's zone is the caller's clock;
--        user_time_zones is not read.
--     6. each text is trimmed of leading and trailing whitespace (\s); a text
--        outside 1 to 40 characters, or two texts equal ignoring case: DQ003.
--     7. the target is the first date after the day with no couple_days row
--        for the pair, so a partner who is ahead and already opened the next
--        date does not push the question to the pool. The row is inserted
--        (trimmed texts, pair, target, source) on conflict on
--        daily_questions_source_day_id_key do nothing, and the snapshot comes
--        back.
-- * submit_written_question(day_id, this_text, that_text) (client RPC): a thin
--   security definer wrapper over record_written_question(auth.uid(), ...,
--   now()).
-- * assign_couple_day (replaced, same signature and grants): after the
--   existing-row return and the writer, it takes the pair's pending written
--   question (target_day <= day, no couple_days row asks it), earliest
--   target_day first, then the source day's date, then id. Otherwise it draws
--   at random from the coach rows plus the pair's written rows already asked on
--   some day, excluding the current cycle's question_ids, and rolls to
--   cycle + 1 over the same set when none is left. A pending row with
--   target_day > day is never drawn. "Pending" is derived, never stored.
--
-- == SQLSTATEs ==
-- DQ003  a text is empty or over 40 characters after trimming, or the two
--        texts are equal ignoring case.
-- DQ004  the caller is not the day's writer.
-- DQ005  the caller has not picked for the day.
-- DQ006  `at` is no longer the day's date in the zone of the caller's pick.
-- (DQ001 and DQ002 belong to record_daily_pick, 20261105210000.)
-- Class DQ is unused by Postgres; PostgREST answers 400 with `code` set.
--
-- == Grants ==
-- record_written_question is security invoker with search_path = '', revokes
-- EXECUTE from public, anon and authenticated, each explicitly (hosted's
-- default ACL grants each role separately), and grants it to service_role.
-- submit_written_question is security definer with search_path = '', revokes
-- EXECUTE from public and anon and is granted to authenticated; it is the one
-- new entry in FN-GRANT-008. assign_couple_day keeps its grants.
--
-- == Hosted catalog ==
-- Checked read-only on 2026-11-06: neither submit_written_question nor
-- record_written_question exists there.
--
-- pgTAP: supabase/tests/database/42_daily_question_written_questions.sql pins
-- the turns, the next-day question, the pool and every refusal;
-- 40_daily_question_gate.sql lists the seven internal functions and the three
-- client RPCs, and calls submit_written_question as the second partner before
-- their own pick; 18_function_execute_grants.sql pins FN-GRANT-008 and
-- FN-GRANT-019.
-- ============================================

begin;

-- --------------------------------------------
-- A written row always has a target day
-- --------------------------------------------
alter table public.daily_questions
  add constraint daily_questions_written_has_target
  check (user_a is null or target_day is not null);

-- --------------------------------------------
-- record_written_question (internal)
-- --------------------------------------------
create function public.record_written_question(
  viewer uuid,
  day_id uuid,
  this_text text,
  that_text text,
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
  v_a uuid;
  v_b uuid;
  v_day public.couple_days;
  v_zone text;
  v_this text;
  v_that text;
  v_target date;
begin
  select u.partner_id into v_partner
  from public.users u
  where u.id = record_written_question.viewer;

  if record_written_question.viewer is null or v_partner is null then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  v_a := least(record_written_question.viewer, v_partner);
  v_b := greatest(record_written_question.viewer, v_partner);

  -- The key assign_couple_day uses, taken before the day is selected.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('couple_days:' || v_a || ':' || v_b, 0)
  );

  select * into v_day
  from public.couple_days cd
  where cd.id = record_written_question.day_id
    and cd.user_a = v_a
    and cd.user_b = v_b;
  if not found then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  select p.effective_zone into v_zone
  from public.daily_picks p
  where p.day_id = v_day.id and p.user_id = record_written_question.viewer;
  if not found then
    raise exception 'Pick before writing' using errcode = 'DQ005';
  end if;

  if v_day.writer <> record_written_question.viewer then
    raise exception 'Not the writer for this day' using errcode = 'DQ004';
  end if;

  -- A retry: the stored question stands, whatever the new texts or `at`.
  if exists (
    select 1 from public.daily_questions q where q.source_day_id = v_day.id
  ) then
    return public.daily_day_snapshot(v_day.id, record_written_question.viewer, record_written_question.at);
  end if;

  if (record_written_question.at at time zone v_zone)::date is distinct from v_day.day then
    raise exception 'The turn ended with its date' using errcode = 'DQ006';
  end if;

  v_this := regexp_replace(coalesce(record_written_question.this_text, ''), '^\s+|\s+$', '', 'g');
  v_that := regexp_replace(coalesce(record_written_question.that_text, ''), '^\s+|\s+$', '', 'g');
  if char_length(v_this) not between 1 and 40 then
    raise exception 'The first option must be 1 to 40 characters' using errcode = 'DQ003';
  end if;
  if char_length(v_that) not between 1 and 40 then
    raise exception 'The second option must be 1 to 40 characters' using errcode = 'DQ003';
  end if;
  if lower(v_this) = lower(v_that) then
    raise exception 'The two options must differ' using errcode = 'DQ003';
  end if;

  v_target := v_day.day + 1;
  while exists (
    select 1 from public.couple_days cd
    where cd.user_a = v_a and cd.user_b = v_b and cd.day = v_target
  ) loop
    v_target := v_target + 1;
  end loop;

  insert into public.daily_questions (this_text, that_text, user_a, user_b, target_day, source_day_id)
  values (v_this, v_that, v_a, v_b, v_target, v_day.id)
  on conflict on constraint daily_questions_source_day_id_key do nothing;

  return public.daily_day_snapshot(v_day.id, record_written_question.viewer, record_written_question.at);
end;
$$;

comment on function public.record_written_question(uuid, uuid, text, text, timestamptz) is
  'The only writer of a couple''s written question, once per source day. Under the pair''s advisory '
  'lock: P0002 unless the day is the viewer''s pair''s; DQ005 before the viewer''s own pick; DQ004 '
  'unless the viewer is the day''s writer; a stored question comes back unchanged; DQ006 when `at` '
  'is not the day''s date in the zone of the viewer''s pick; DQ003 for a trimmed text outside 1 to '
  '40 characters or two equal texts. The target is the first later date with no couple_days row. '
  'Returns the source day''s snapshot. Internal.';

revoke execute on function public.record_written_question(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_written_question(uuid, uuid, text, text, timestamptz)
  to service_role;

-- --------------------------------------------
-- submit_written_question (client RPC): a thin wrapper
-- --------------------------------------------
create function public.submit_written_question(
  day_id uuid,
  this_text text,
  that_text text
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

  return public.record_written_question(
    v_uid,
    submit_written_question.day_id,
    submit_written_question.this_text,
    submit_written_question.that_text,
    pg_catalog.now()
  );
end;
$$;

comment on function public.submit_written_question(uuid, text, text) is
  'Writes the caller''s question for a day of their pair through record_written_question at now(): '
  'only the day''s writer, after their own pick, on the day''s date in the zone of that pick '
  '(DQ004 / DQ005 / DQ006), with two different texts of 1 to 40 characters (DQ003). A repeat '
  'returns the stored question''s day unchanged. Returns the source day''s snapshot. The only '
  'client write path to a written question.';

revoke execute on function public.submit_written_question(uuid, text, text) from public, anon;
grant execute on function public.submit_written_question(uuid, text, text) to authenticated;

-- --------------------------------------------
-- assign_couple_day (internal): pending written question first, then the pool
-- --------------------------------------------
create or replace function public.assign_couple_day(user_a uuid, user_b uuid, day date)
returns public.couple_days
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.couple_days;
  v_cycle integer;
  v_question uuid;
  v_writer uuid;
begin
  if assign_couple_day.user_a is null
     or assign_couple_day.user_b is null
     or assign_couple_day.day is null
     or assign_couple_day.user_a >= assign_couple_day.user_b
  then
    raise exception 'Invalid couple day' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'couple_days:' || assign_couple_day.user_a || ':' || assign_couple_day.user_b, 0
    )
  );

  select * into v_row
  from public.couple_days cd
  where cd.user_a = assign_couple_day.user_a
    and cd.user_b = assign_couple_day.user_b
    and cd.day = assign_couple_day.day;
  if found then
    return v_row;
  end if;

  v_writer := case
    when mod(assign_couple_day.day - date '2000-01-01', 2) = 0 then assign_couple_day.user_a
    else assign_couple_day.user_b
  end;

  select coalesce(max(cd.cycle), 1) into v_cycle
  from public.couple_days cd
  where cd.user_a = assign_couple_day.user_a
    and cd.user_b = assign_couple_day.user_b;

  -- The pair's earliest pending written question: its target has come and no
  -- day asks it yet.
  select q.id into v_question
  from public.daily_questions q
  join public.couple_days src on src.id = q.source_day_id
  where q.user_a = assign_couple_day.user_a
    and q.user_b = assign_couple_day.user_b
    and q.target_day <= assign_couple_day.day
    and not exists (
      select 1 from public.couple_days asked where asked.question_id = q.id
    )
  order by q.target_day, src.day, q.id
  limit 1;

  if v_question is null then
    -- The pool: the coach's rows plus the pair's written rows already asked.
    select q.id into v_question
    from public.daily_questions q
    where (
        q.user_a is null
        or (
          q.user_a = assign_couple_day.user_a
          and q.user_b = assign_couple_day.user_b
          and exists (select 1 from public.couple_days asked where asked.question_id = q.id)
        )
      )
      and not exists (
        select 1 from public.couple_days cd
        where cd.user_a = assign_couple_day.user_a
          and cd.user_b = assign_couple_day.user_b
          and cd.cycle = v_cycle
          and cd.question_id = q.id
      )
    order by random()
    limit 1;

    if v_question is null then
      v_cycle := v_cycle + 1;
      select q.id into v_question
      from public.daily_questions q
      where q.user_a is null
         or (
           q.user_a = assign_couple_day.user_a
           and q.user_b = assign_couple_day.user_b
           and exists (select 1 from public.couple_days asked where asked.question_id = q.id)
         )
      order by random()
      limit 1;
    end if;
  end if;

  if v_question is null then
    raise exception 'No daily question available' using errcode = 'P0002';
  end if;

  insert into public.couple_days (user_a, user_b, day, question_id, cycle, writer)
  values (
    assign_couple_day.user_a, assign_couple_day.user_b, assign_couple_day.day,
    v_question, v_cycle, v_writer
  )
  on conflict on constraint couple_days_pair_day_key do nothing;

  select * into v_row
  from public.couple_days cd
  where cd.user_a = assign_couple_day.user_a
    and cd.user_b = assign_couple_day.user_b
    and cd.day = assign_couple_day.day;
  return v_row;
end;
$$;

comment on function public.assign_couple_day(uuid, uuid, date) is
  'The only function that creates a couple_days row: takes the pair''s advisory lock, returns '
  'the day''s row if it exists, else asks the pair''s earliest pending written question (target_day '
  '<= day, asked by no day), else draws from the coach''s questions plus the pair''s written ones '
  'already asked, not used in the pair''s current cycle (cycle + 1 when none is left; P0002 on an '
  'empty pool). Internal.';

commit;
