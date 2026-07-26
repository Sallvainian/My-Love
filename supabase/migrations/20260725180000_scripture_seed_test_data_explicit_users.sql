-- ============================================
-- Migration: Let scripture_seed_test_data seed for explicit users
-- Created: 2026-07-25
--
-- Why
-- ---
-- The function resolved its users with:
--
--   select id into v_test_user1_id from auth.users order by created_at limit 1;
--
-- i.e. globally, ignoring the caller. Every parallel Playwright worker therefore
-- received the same two rows, even though tests/support/auth/global-setup.ts
-- already provisions 24 dedicated pairs (testworker{i} / testworker{i}-partner)
-- and links each pair. Worker isolation existed everywhere except here, so any
-- worker mutating those two users — linking, unlinking, seeding — did it to
-- every other worker at the same time.
--
-- This adds p_user1_id / p_user2_id. When supplied they are used verbatim.
-- When omitted the old global lookup still runs, so existing callers are
-- unaffected and can migrate one at a time. The fallback gains `, id` as a
-- tiebreaker: global-setup creates the worker pool in one batch, so created_at
-- ties are common and the previous ordering was not deterministic even in the
-- single-user local case.
--
-- Also restores `set search_path = ''` and the fully-qualified table references
-- that 20260221000001_fix_function_search_paths.sql introduced ("Flagged by
-- Supabase advisor") and that 20260309000001_at_reflection_preset.sql dropped
-- when it recreated the function as a bare SECURITY DEFINER.
--
-- Seeding logic is otherwise unchanged from 20260309000001.
-- ============================================

begin;

-- Both prior signatures, so the new 7-arg form cannot collide with a leftover
-- overload. Postgres will not resolve a call that matches more than one.
drop function if exists public.scripture_seed_test_data(int, boolean, boolean, text, int[]);
drop function if exists public.scripture_seed_test_data(int, boolean, boolean, text);

create or replace function public.scripture_seed_test_data(
  p_session_count int default 1,
  p_include_reflections boolean default false,
  p_include_messages boolean default false,
  p_preset text default null,  -- 'mid_session', 'completed', 'with_help_flags', 'unlinked', 'at_reflection'
  p_bookmark_steps int[] default null,  -- step indices for bookmarks (used with 'at_reflection' preset)
  p_user1_id uuid default null,  -- seed for this user instead of the global first row
  p_user2_id uuid default null   -- partner; null yields a solo session
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_env text;
  v_result jsonb;
  v_session_ids uuid[] := '{}';
  v_reflection_ids uuid[] := '{}';
  v_message_ids uuid[] := '{}';
  v_test_user1_id uuid;
  v_test_user2_id uuid;
  v_session_id uuid;
  v_temp_id uuid;  -- separate variable for returning in sub-inserts
  v_step_index int;
  v_current_step int;
  v_current_phase public.scripture_session_phase;
  v_status public.scripture_session_status;
  v_completed_at timestamptz;
  i int;
  j int;
begin
  -- environment guard: reject calls in production
  v_env := current_setting('app.environment', true);
  if v_env = 'production' then
    raise exception 'Seeding not allowed in production environment';
  end if;

  -- resolve the users to seed for
  if p_user1_id is not null then
    -- caller-scoped path: the caller owns these rows, so parallel callers do
    -- not contend. validated rather than trusted, because a silently-wrong
    -- user id produces sessions attached to somebody else's account and the
    -- resulting test failure points nowhere near the cause.
    v_test_user1_id := p_user1_id;
    v_test_user2_id := p_user2_id;

    if not exists (select 1 from auth.users where id = v_test_user1_id) then
      raise exception 'p_user1_id % not found in auth.users', v_test_user1_id;
    end if;

    if v_test_user2_id is not null then
      if v_test_user2_id = v_test_user1_id then
        raise exception 'p_user1_id and p_user2_id must differ (both %)', v_test_user1_id;
      end if;
      if not exists (select 1 from auth.users where id = v_test_user2_id) then
        raise exception 'p_user2_id % not found in auth.users', v_test_user2_id;
      end if;
    end if;
  else
    -- legacy fallback: first two users by creation order. retained so callers
    -- that have not been updated keep working; not safe under parallelism.
    select id into v_test_user1_id
      from auth.users order by created_at, id limit 1;
    select id into v_test_user2_id
      from auth.users where id <> v_test_user1_id order by created_at, id limit 1;

    -- if no users exist, we cannot seed (requires authenticated users)
    if v_test_user1_id is null then
      raise exception 'No users found in auth.users. Create test users first.';
    end if;
  end if;

  -- determine session state based on preset
  case p_preset
    when 'mid_session' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'completed' then
      v_current_step := 16;
      v_current_phase := 'complete';
      v_status := 'complete';
      v_completed_at := now();
    when 'with_help_flags' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'unlinked' then
      v_current_step := 7;
      v_current_phase := 'reading';
      v_status := 'in_progress';
      v_completed_at := null;
    when 'at_reflection' then
      v_current_step := 16;
      v_current_phase := 'reflection';
      v_status := 'in_progress';
      v_completed_at := null;
    else
      -- default: fresh session
      v_current_step := 0;
      v_current_phase := 'lobby';
      v_status := 'pending';
      v_completed_at := null;
  end case;

  -- create sessions
  for i in 1..p_session_count loop
    insert into public.scripture_sessions (
      mode,
      user1_id,
      user2_id,
      current_phase,
      current_step_index,
      status,
      version,
      snapshot_json,
      started_at,
      completed_at
    ) values (
      case when p_preset in ('unlinked', 'at_reflection') then 'solo'::public.scripture_session_mode
           when v_test_user2_id is not null then 'together'::public.scripture_session_mode
           else 'solo'::public.scripture_session_mode end,
      v_test_user1_id,
      case when p_preset in ('unlinked', 'at_reflection') then null else v_test_user2_id end,
      v_current_phase,
      v_current_step,
      v_status,
      1,
      jsonb_build_object('seeded', true, 'preset', coalesce(p_preset, 'default')),
      now() - (i || ' hours')::interval,  -- stagger start times
      v_completed_at
    ) returning id into v_session_id;

    v_session_ids := array_append(v_session_ids, v_session_id);

    -- create step states for completed steps
    for j in 0..v_current_step loop
      insert into public.scripture_step_states (
        session_id,
        step_index,
        user1_locked_at,
        user2_locked_at,
        advanced_at
      ) values (
        v_session_id,
        j,
        now() - ((v_current_step - j) || ' minutes')::interval,
        case when p_preset in ('unlinked', 'at_reflection') then null
             when v_test_user2_id is not null then now() - ((v_current_step - j) || ' minutes')::interval
             else null end,
        case when j = 16 and p_preset = 'at_reflection' then null
             else now() - ((v_current_step - j) || ' minutes')::interval end
      );
    end loop;

    -- create bookmarks for at_reflection preset when p_bookmark_steps is provided
    if p_preset = 'at_reflection' and p_bookmark_steps is not null then
      declare
        v_bm_step int;
      begin
        foreach v_bm_step in array p_bookmark_steps loop
          insert into public.scripture_bookmarks (
            session_id,
            step_index,
            user_id,
            share_with_partner
          ) values (
            v_session_id,
            v_bm_step,
            v_test_user1_id,
            false
          );
        end loop;
      end;
    end if;

    -- create reflections if requested (uses v_temp_id to avoid overwriting v_session_id)
    if p_include_reflections then
      for j in 0..least(v_current_step, 16) loop
        insert into public.scripture_reflections (
          session_id,
          step_index,
          user_id,
          rating,
          notes,
          is_shared,
          created_at
        ) values (
          v_session_id,
          j,
          v_test_user1_id,
          (j % 5) + 1,  -- rotating rating 1-5
          'Test reflection for step ' || j,
          j % 2 = 0,  -- share every other one
          now() - ((v_current_step - j) || ' minutes')::interval
        ) returning id into v_temp_id;
        v_reflection_ids := array_append(v_reflection_ids, v_temp_id);
      end loop;
    end if;

    -- create messages if requested (uses v_temp_id to avoid overwriting v_session_id)
    if p_include_messages then
      for j in 1..3 loop
        insert into public.scripture_messages (
          session_id,
          sender_id,
          message,
          created_at
        ) values (
          v_session_id,
          v_test_user1_id,
          'Test prayer message ' || j,
          now() - (j || ' minutes')::interval
        ) returning id into v_temp_id;
        v_message_ids := array_append(v_message_ids, v_temp_id);
      end loop;
    end if;
  end loop;

  -- build result
  v_result := jsonb_build_object(
    'session_ids', to_jsonb(v_session_ids),
    'session_count', p_session_count,
    'preset', coalesce(p_preset, 'default'),
    'test_user1_id', v_test_user1_id,
    'test_user2_id', v_test_user2_id
  );

  if p_include_reflections then
    v_result := v_result || jsonb_build_object('reflection_ids', to_jsonb(v_reflection_ids));
  end if;

  if p_include_messages then
    v_result := v_result || jsonb_build_object('message_ids', to_jsonb(v_message_ids));
  end if;

  return v_result;
end;
$$;

commit;
