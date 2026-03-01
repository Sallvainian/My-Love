-- ============================================
-- Story 4.x Hotfix: Together session creation semantics
-- Purpose:
--   1) Start NEW together sessions in lobby phase (not reading)
--   2) Reuse existing in-progress together session for the same user pair
--      so both partners join the same session id instead of creating duplicates
-- ============================================

begin;

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
  v_user_id uuid;
  v_session_id uuid;
  v_result jsonb;
  v_start_phase public.scripture_session_phase;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_mode not in ('solo', 'together') then
    raise exception 'Invalid mode: %. Must be solo or together.', p_mode;
  end if;

  if p_mode = 'together' and p_partner_id is null then
    raise exception 'Partner ID is required for together mode.';
  end if;

  if p_mode = 'together' then
    if p_partner_id = v_user_id then
      raise exception 'Partner cannot be the current user.';
    end if;

    if not exists (select 1 from auth.users where id = p_partner_id) then
      raise exception 'Partner user not found.';
    end if;

    -- Reuse existing in-progress together session for this exact pair (any user order).
    -- Only reuse sessions still in lobby phase — sessions that have progressed
    -- past lobby (reading, reflection, etc.) should not be reused.
    select s.id
      into v_session_id
      from public.scripture_sessions s
      where s.mode = 'together'
        and s.status = 'in_progress'
        and s.current_phase = 'lobby'
        and (
          (s.user1_id = v_user_id and s.user2_id = p_partner_id)
          or
          (s.user1_id = p_partner_id and s.user2_id = v_user_id)
        )
      order by s.started_at desc
      limit 1;
  end if;

  if v_session_id is null then
    v_start_phase := case
      when p_mode = 'together' then 'lobby'::public.scripture_session_phase
      else 'reading'::public.scripture_session_phase
    end;

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
      v_user_id,
      case when p_mode = 'together' then p_partner_id else null end,
      v_start_phase,
      0,
      'in_progress'::public.scripture_session_status,
      1,
      now()
    )
    returning id into v_session_id;
  end if;

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
  )
    into v_result
    from public.scripture_sessions s
    where s.id = v_session_id;

  return v_result;
end;
$$;

grant execute on function public.scripture_create_session(text, uuid) to authenticated;

comment on function public.scripture_create_session(text, uuid)
  is 'Creates solo/together scripture session. Together mode starts in lobby and reuses existing in-progress pair session.';

commit;
