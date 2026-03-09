-- Migration: Fix mutable search_path security warning
-- Purpose: Add `set search_path = ''` to SECURITY DEFINER functions to prevent
--          schema-injection attacks via mutable search_path. Flagged by Supabase advisor.
-- Affected functions:
--   - public.is_scripture_session_member
--   - public.scripture_seed_test_data
--   - public.scripture_create_session
--   - public.scripture_submit_reflection
-- Changes: search_path locked + all bare table references fully qualified with public.
-- Logic: unchanged.

-- ============================================================
-- 1. is_scripture_session_member
-- ============================================================
create or replace function public.is_scripture_session_member(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.scripture_sessions
    where id = p_session_id
    and (user1_id = auth.uid() or user2_id = auth.uid())
  );
$$;

-- ============================================================
-- 2. scripture_seed_test_data
-- ============================================================
create or replace function public.scripture_seed_test_data(
  p_session_count int default 1,
  p_include_reflections boolean default false,
  p_include_messages boolean default false,
  p_preset text default null  -- 'mid_session', 'completed', 'with_help_flags'
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

  -- get or create test users from existing auth.users
  -- in local dev, we use the first two users found
  select id into v_test_user1_id from auth.users order by created_at limit 1;
  select id into v_test_user2_id from auth.users where id != v_test_user1_id order by created_at limit 1;

  -- if no users exist, we cannot seed (requires authenticated users)
  if v_test_user1_id is null then
    raise exception 'No users found in auth.users. Create test users first.';
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
      case when v_test_user2_id is not null then 'together'::public.scripture_session_mode else 'solo'::public.scripture_session_mode end,
      v_test_user1_id,
      v_test_user2_id,
      v_current_phase,
      v_current_step,
      v_status,
      1,
      jsonb_build_object('seeded', true, 'preset', coalesce(p_preset, 'default')),
      now() - (i || ' hours')::interval,
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
        case when v_test_user2_id is not null then now() - ((v_current_step - j) || ' minutes')::interval else null end,
        now() - ((v_current_step - j) || ' minutes')::interval
      );
    end loop;

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

-- ============================================================
-- 3. scripture_create_session
-- ============================================================
create or replace function public.scripture_create_session(
  p_mode text,
  p_partner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  -- validate mode
  if p_mode not in ('solo', 'together') then
    raise exception 'Invalid mode: %. Must be solo or together.', p_mode;
  end if;

  -- validate partner for together mode
  if p_mode = 'together' and p_partner_id is null then
    raise exception 'Partner ID is required for together mode.';
  end if;

  if p_mode = 'together' then
    -- verify partner exists
    if not exists (select 1 from auth.users where id = p_partner_id) then
      raise exception 'Partner user not found.';
    end if;
  end if;

  -- create the session
  insert into public.scripture_sessions (
    mode,
    user1_id,
    user2_id,
    current_phase,
    current_step_index,
    status,
    version,
    started_at
  ) values (
    p_mode::public.scripture_session_mode,
    auth.uid(),
    case when p_mode = 'together' then p_partner_id else null end,
    'reading'::public.scripture_session_phase,
    0,
    'in_progress'::public.scripture_session_status,
    1,
    now()
  ) returning id into v_session_id;

  -- return the full session object
  select jsonb_build_object(
    'id', s.id,
    'mode', s.mode,
    'user1_id', s.user1_id,
    'user2_id', s.user2_id,
    'current_phase', s.current_phase,
    'current_step_index', s.current_step_index,
    'status', s.status,
    'version', s.version,
    'started_at', s.started_at,
    'completed_at', s.completed_at
  ) into v_result
  from public.scripture_sessions s
  where s.id = v_session_id;

  return v_result;
end;
$$;

-- ============================================================
-- 4. scripture_submit_reflection
-- ============================================================
create or replace function public.scripture_submit_reflection(
  p_session_id uuid,
  p_step_index int,
  p_rating int,
  p_notes text,
  p_is_shared boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_reflection_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();

  -- validate session membership
  if not public.is_scripture_session_member(p_session_id) then
    raise exception 'User is not a member of this session.';
  end if;

  -- validate rating range
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  -- upsert reflection (insert or update on conflict)
  insert into public.scripture_reflections (
    session_id,
    step_index,
    user_id,
    rating,
    notes,
    is_shared,
    created_at
  ) values (
    p_session_id,
    p_step_index,
    v_user_id,
    p_rating,
    p_notes,
    p_is_shared,
    now()
  )
  on conflict (session_id, step_index, user_id)
  do update set
    rating = excluded.rating,
    notes = excluded.notes,
    is_shared = excluded.is_shared
  returning id into v_reflection_id;

  -- return the reflection object
  select jsonb_build_object(
    'id', r.id,
    'session_id', r.session_id,
    'step_index', r.step_index,
    'user_id', r.user_id,
    'rating', r.rating,
    'notes', r.notes,
    'is_shared', r.is_shared,
    'created_at', r.created_at
  ) into v_result
  from public.scripture_reflections r
  where r.id = v_reflection_id;

  return v_result;
end;
$$;
