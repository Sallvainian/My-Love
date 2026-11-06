-- ============================================
-- Daily Question, story 6.1: the server assigns today's question and releases
-- a pick's choice only to a partner who has picked
-- (architecture-daily-question: AD-1 to AD-6, AD-15, AD-16)
--
-- == Tables (RLS on, no policies; anon and authenticated hold nothing) ==
-- daily_questions  the coach's pool (user_a/user_b null) and, from story 3, a
--                  couple's written questions (pair set, source_day_id set).
-- couple_days      one row per ordered pair and calendar date: the question
--                  asked, the cycle it was drawn in, and the writer whose turn
--                  it is to write the next question.
-- daily_picks      one row per user and day, insert-only. `choice` is
--                  readable by no API role: not by anon, not by authenticated
--                  and not by service_role. The one SQL that selects it is
--                  visible_daily_picks (AD-5).
--
-- == Rules ==
-- * The couple is the ordered pair user_a < user_b (AD-1).
-- * No daily table grants anon or authenticated any privilege, SELECT
--   included: every read and write goes through a client RPC (AD-15). Question
--   text reaches a client only inside a snapshot. On daily_questions and
--   couple_days service_role keeps its default privileges (the E2E helper that
--   clears a pair's days relies on them).
-- * service_role gets column SELECT on every daily_picks column except
--   `choice` and no other privilege on it, so send-push cannot read a choice
--   past the gate (AD-5). A delete of a couple_days row still cascades to its
--   picks, because the cascade runs with the table owner's rights.
-- * Only assign_couple_day creates a couple_days row. It takes the pair's
--   advisory lock, inserts on conflict do nothing, then selects (AD-4). The
--   writer is fixed from the date alone: user_a on an even day count since
--   2000-01-01, else user_b, so a date with no row keeps the turns alternating.
-- * The draw takes a coach question not used in the pair's current cycle; with
--   none left it opens cycle + 1; with no coach question at all it raises
--   P0002. The pool is seeded by a later story, so until then it is empty.
-- * visible_daily_picks returns the viewer's own picks, and a partner's pick
--   only where the viewer's own pick for that day exists and the day belongs
--   to the viewer's current pair (AD-5). daily_day_snapshot reads choices only
--   through it; its `state` tests that a pick exists, never what it chose.
-- * Picks are insert-only. submit_daily_pick locks the day row, so the
--   `is_second` flag cannot race, and a repeat returns the stored pick without
--   updating it (AD-6). This story ships no date or picked_at window check.
-- * Internal functions (effective_zone, assign_couple_day,
--   visible_daily_picks, daily_day_snapshot) revoke EXECUTE from public, anon
--   and authenticated, each explicitly, because hosted's default ACL grants
--   each role separately; service_role keeps it. Client RPCs (get_daily_day,
--   submit_daily_pick) are security definer with search_path = '', derive the
--   pair from auth.uid() and get_my_partner_id(), and are granted to
--   authenticated only.
-- * A zone is never rejected. effective_zone returns an IANA name pg knows,
--   else the offset as a POSIX spec written with the sign Postgres expects
--   ('<+0530>-05:30' for +330 minutes east), never a text offset, which
--   Postgres reads with the sign inverted (AD-2).
--
-- == Hosted catalog ==
-- Checked read-only on 2026-11-05: none of these table or function names
-- exists there.
--
-- pgTAP: supabase/tests/database/40_daily_question_gate.sql pins the gate, the
-- grants and the draw; 18_function_execute_grants.sql pins the two RPCs.
-- ============================================

begin;

-- --------------------------------------------
-- daily_questions (the source_day_id FK follows couple_days)
-- --------------------------------------------
create table public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  this_text text not null,
  that_text text not null,
  user_a uuid references public.users(id) on delete cascade,
  user_b uuid references public.users(id) on delete cascade,
  target_day date,
  source_day_id uuid,
  constraint daily_questions_this_text_check
    check (this_text !~ '^\s|\s$' and char_length(this_text) between 1 and 40),
  constraint daily_questions_that_text_check
    check (that_text !~ '^\s|\s$' and char_length(that_text) between 1 and 40),
  constraint daily_questions_texts_differ
    check (lower(this_text) <> lower(that_text)),
  constraint daily_questions_source_day_id_key unique (source_day_id),
  constraint daily_questions_coach_or_written check (
    (user_a is null and user_b is null and target_day is null and source_day_id is null)
    or (user_a is not null and user_b is not null and user_a < user_b and source_day_id is not null)
  )
);

comment on table public.daily_questions is
  'The coach''s question pool (user_a and user_b null) and a couple''s written questions '
  '(ordered pair set). anon and authenticated hold no privilege (service_role keeps its default '
  'privileges): questions reach a client only inside a get_daily_day or submit_daily_pick snapshot. Pinned by '
  'supabase/tests/database/40_daily_question_gate.sql.';

-- --------------------------------------------
-- couple_days
-- --------------------------------------------
create table public.couple_days (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  day date not null,
  question_id uuid not null references public.daily_questions(id),
  cycle integer not null check (cycle >= 1),
  writer uuid not null,
  created_at timestamptz not null default now(),
  constraint couple_days_ordered_pair check (user_a < user_b),
  constraint couple_days_writer_in_pair check (writer = user_a or writer = user_b),
  constraint couple_days_pair_day_key unique (user_a, user_b, day)
);

comment on table public.couple_days is
  'One row per ordered pair and calendar date: the question asked, the cycle it was drawn in '
  'and the writer whose turn it is. Created only by assign_couple_day. anon and authenticated '
  'hold no privilege (service_role keeps its default privileges). Pinned by supabase/tests/database/40_daily_question_gate.sql.';

alter table public.daily_questions
  add constraint daily_questions_source_day_id_fkey
  foreign key (source_day_id) references public.couple_days(id) on delete cascade;

-- The pair's unique index leads with user_a; user_b and question_id need their own.
create index idx_couple_days_user_b on public.couple_days (user_b);
create index idx_couple_days_question_id on public.couple_days (question_id);
create index idx_daily_questions_pair on public.daily_questions (user_a, user_b);
create index idx_daily_questions_user_b on public.daily_questions (user_b);

-- --------------------------------------------
-- daily_picks
-- --------------------------------------------
create table public.daily_picks (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.couple_days(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  choice text not null check (choice in ('this', 'that')),
  picked_at timestamptz not null,
  time_zone text not null,
  utc_offset_minutes integer not null,
  effective_zone text not null,
  is_second boolean not null,
  created_at timestamptz not null default now(),
  constraint daily_picks_day_user_key unique (day_id, user_id)
);

comment on table public.daily_picks is
  'One insert-only pick per user and day. `choice` is readable by no API role; only '
  'visible_daily_picks selects it. anon and authenticated hold no privilege, and service_role holds '
  'column SELECT on every column but `choice`. Pinned by '
  'supabase/tests/database/40_daily_question_gate.sql.';

-- The unique index leads with day_id; user_id needs its own for the FK cascade.
create index idx_daily_picks_user_id on public.daily_picks (user_id);

-- --------------------------------------------
-- Row level security and grants
-- --------------------------------------------
-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated. No policy
-- is created, and the revokes below leave no privilege to need one.
alter table public.daily_questions enable row level security;
alter table public.couple_days enable row level security;
alter table public.daily_picks enable row level security;

revoke all on public.daily_questions from anon, authenticated;
revoke all on public.couple_days from anon, authenticated;
revoke all on public.daily_picks from anon, authenticated, service_role;

grant select (id, day_id, user_id, picked_at, time_zone, utc_offset_minutes,
              effective_zone, is_second, created_at)
  on public.daily_picks to service_role;

-- --------------------------------------------
-- effective_zone (internal)
-- --------------------------------------------
create function public.effective_zone(time_zone text, utc_offset_minutes integer)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_offset integer;
  v_abs integer;
  v_hours text;
  v_minutes text;
begin
  if effective_zone.time_zone is not null
     and effective_zone.time_zone <> ''
     and exists (
       select 1 from pg_catalog.pg_timezone_names n
       where n.name = effective_zone.time_zone
     )
  then
    return effective_zone.time_zone;
  end if;

  if effective_zone.utc_offset_minutes is null then
    return 'UTC';
  end if;

  v_offset := greatest(-840, least(840, effective_zone.utc_offset_minutes));
  v_abs := abs(v_offset);
  v_hours := lpad((v_abs / 60)::text, 2, '0');
  v_minutes := lpad((v_abs % 60)::text, 2, '0');

  -- POSIX reads the sign inverted: east of UTC is written with a minus.
  return '<' || case when v_offset >= 0 then '+' else '-' end || v_hours || v_minutes || '>'
      || case when v_offset >= 0 then '-' else '+' end || v_hours || ':' || v_minutes;
end;
$$;

comment on function public.effective_zone(text, integer) is
  'The only value ever passed to AT TIME ZONE: the IANA name when pg_timezone_names has it, '
  'else the east-positive minute offset as a POSIX spec (''<+0530>-05:30'' for +330), clamped '
  'to +-840, else UTC. Never raises. Internal.';

revoke execute on function public.effective_zone(text, integer) from public, anon, authenticated;
grant execute on function public.effective_zone(text, integer) to service_role;

-- --------------------------------------------
-- assign_couple_day (internal)
-- --------------------------------------------
create function public.assign_couple_day(user_a uuid, user_b uuid, day date)
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

  select q.id into v_question
  from public.daily_questions q
  where q.user_a is null
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
    order by random()
    limit 1;
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
  'the day''s row if it exists, else draws a coach question not used in the pair''s current '
  'cycle (cycle + 1 when none is left; P0002 on an empty pool). Internal.';

revoke execute on function public.assign_couple_day(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.assign_couple_day(uuid, uuid, date) to service_role;

-- --------------------------------------------
-- visible_daily_picks (internal): the only SQL that selects daily_picks.choice
-- --------------------------------------------
create function public.visible_daily_picks(viewer uuid, at timestamptz)
returns table (day_id uuid, user_id uuid, choice text, picked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.day_id, p.user_id, p.choice, p.picked_at
  from public.daily_picks p
  where p.user_id = viewer
     or (
       p.day_id in (
         select mine.day_id from public.daily_picks mine where mine.user_id = viewer
       )
       and exists (
         select 1
         from public.couple_days cd
         join public.users u on u.id = viewer
         where cd.id = p.day_id
           and u.partner_id is not null
           and p.user_id = u.partner_id
           and ((cd.user_a = viewer and cd.user_b = u.partner_id)
             or (cd.user_a = u.partner_id and cd.user_b = viewer))
       )
     );
$$;

comment on function public.visible_daily_picks(uuid, timestamptz) is
  'The gate: the viewer''s own picks, and a partner''s pick only where the viewer''s own pick '
  'for that day exists and the day belongs to the viewer''s current pair. The only SQL that '
  'selects daily_picks.choice. `at` is unused until a later epic. Internal.';

revoke execute on function public.visible_daily_picks(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.visible_daily_picks(uuid, timestamptz) to service_role;

-- --------------------------------------------
-- daily_day_snapshot (internal)
-- --------------------------------------------
create function public.daily_day_snapshot(day_id uuid, viewer uuid, at timestamptz)
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
      )
    )
  );
end;
$$;

comment on function public.daily_day_snapshot(uuid, uuid, timestamptz) is
  'The one day snapshot (AD-16): day, question, state, the viewer''s own pick and, once the '
  'viewer has picked, the partner''s choice and Same/Different. Null when the viewer is not in '
  'the day''s pair. Reads choices only through visible_daily_picks. `at` is unused until a '
  'later epic. Internal.';

revoke execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.daily_day_snapshot(uuid, uuid, timestamptz) to service_role;

-- --------------------------------------------
-- get_daily_day (client RPC)
-- --------------------------------------------
create function public.get_daily_day(
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

  v_partner := public.get_my_partner_id();
  if v_partner is null then
    return jsonb_build_object('status', 'unlinked');
  end if;

  -- `reported_at` is accepted and unused until the stored-zone story.
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
  'else {status: ''ok'', snapshot} after assign_couple_day opened the pair''s row. Pair derived '
  'from auth.uid() and get_my_partner_id().';

revoke execute on function public.get_daily_day(text, integer, timestamptz) from public, anon;
grant execute on function public.get_daily_day(text, integer, timestamptz) to authenticated;

-- --------------------------------------------
-- submit_daily_pick (client RPC)
-- --------------------------------------------
create function public.submit_daily_pick(
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
  v_partner uuid;
  v_day public.couple_days;
  v_is_second boolean;
  v_other uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if submit_daily_pick.choice is null
     or submit_daily_pick.choice not in ('this', 'that')
  then
    raise exception 'Invalid choice' using errcode = '22023';
  end if;
  if submit_daily_pick.picked_at is null then
    raise exception 'Invalid pick time' using errcode = '22023';
  end if;

  v_partner := public.get_my_partner_id();

  -- Membership is in the WHERE clause, so a caller outside the pair never
  -- takes the row lock.
  select * into v_day
  from public.couple_days cd
  where cd.id = submit_daily_pick.day_id
    and v_partner is not null
    and ((cd.user_a = v_uid and cd.user_b = v_partner)
      or (cd.user_a = v_partner and cd.user_b = v_uid))
  for update;
  if not found then
    raise exception 'Day not found' using errcode = 'P0002';
  end if;

  v_other := case when v_uid = v_day.user_a then v_day.user_b else v_day.user_a end;

  if not exists (
    select 1 from public.daily_picks p
    where p.day_id = v_day.id and p.user_id = v_uid
  ) then
    v_is_second := exists (
      select 1 from public.daily_picks p
      where p.day_id = v_day.id and p.user_id = v_other
    );

    insert into public.daily_picks (
      day_id, user_id, choice, picked_at, time_zone, utc_offset_minutes, effective_zone, is_second
    )
    values (
      v_day.id,
      v_uid,
      submit_daily_pick.choice,
      submit_daily_pick.picked_at,
      coalesce(submit_daily_pick.time_zone, ''),
      coalesce(submit_daily_pick.utc_offset_minutes, 0),
      public.effective_zone(submit_daily_pick.time_zone, submit_daily_pick.utc_offset_minutes),
      v_is_second
    )
    on conflict on constraint daily_picks_day_user_key do nothing;
  end if;

  return public.daily_day_snapshot(v_day.id, v_uid, pg_catalog.now());
end;
$$;

comment on function public.submit_daily_pick(uuid, text, timestamptz, text, integer) is
  'Writes the caller''s pick for a day of their pair, once: a repeat returns the stored pick '
  'unchanged. Locks the day row so is_second cannot race. Returns the day snapshot. The only '
  'write path to daily_picks.';

revoke execute on function public.submit_daily_pick(uuid, text, timestamptz, text, integer) from public, anon;
grant execute on function public.submit_daily_pick(uuid, text, timestamptz, text, integer) to authenticated;

commit;
