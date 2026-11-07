-- ============================================
-- Daily Question, story 6.11: a live check can clear the bot pair's days
-- (architecture-daily-question: AD-15)
--
-- == What changes ==
-- * reset_bot_daily_days() (client RPC, no arguments): deletes the caller's
--   current couple's couple_days, which cascades to their daily_picks and to
--   any written question sourced from those days, and returns the number of
--   days deleted. Picks are insert-only, so this is the one way a repeatable
--   post-deploy check of the live site can start from an empty pair without
--   the Supabase secret key. security definer with search_path = ''. In order:
--     1. a null auth.uid(): 'Authentication required'.
--     2. the caller's auth.users.email, lowercased, is neither the lowercased
--        test_email nor partner_email value of public.claude_bot_config:
--        SQLSTATE 42501. auth.users.email, not public.users.email, so a
--        profile row edit can never pass the check.
--     3. the caller has no partner: nothing deleted, returns 0.
--     4. the partner's auth.users.email, lowercased, is not one of those two
--        values either: SQLSTATE 42501, so a bot linked to a real user can
--        never delete that user's days.
--     5. otherwise it takes the pair's advisory lock (the key
--        assign_couple_day takes) and deletes the couple_days of
--        (least(uid, partner), greatest(uid, partner)).
--   It returns no config value and no choice.
--
-- == Grants ==
-- security definer, revokes EXECUTE from public and anon and is granted to
-- authenticated; it is the one new entry in FN-GRANT-008. No client app code
-- calls it; only tests/live/daily-question-live.spec.ts does.
--
-- pgTAP: 44_reset_bot_daily_days.sql covers each case;
-- 18_function_execute_grants.sql pins FN-GRANT-008 and FN-GRANT-021;
-- 40_daily_question_gate.sql asserts a non-bot is refused.
-- ============================================

begin;

create function public.reset_bot_daily_days()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_partner uuid;
  v_partner_email text;
  v_user_a uuid;
  v_user_b uuid;
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select pg_catalog.lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or not exists (
    select 1
    from public.claude_bot_config c
    where c.key in ('test_email', 'partner_email')
      and pg_catalog.lower(c.value) = v_email
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_partner := public.get_my_partner_id();
  if v_partner is null then
    return 0;
  end if;

  select pg_catalog.lower(u.email) into v_partner_email
  from auth.users u
  where u.id = v_partner;

  if v_partner_email is null or not exists (
    select 1
    from public.claude_bot_config c
    where c.key in ('test_email', 'partner_email')
      and pg_catalog.lower(c.value) = v_partner_email
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_user_a := least(v_uid, v_partner);
  v_user_b := greatest(v_uid, v_partner);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('couple_days:' || v_user_a || ':' || v_user_b, 0)
  );

  delete from public.couple_days cd
  where cd.user_a = v_user_a
    and cd.user_b = v_user_b;
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

comment on function public.reset_bot_daily_days() is
  'Deletes the couple_days (and so the picks) of the caller''s current pair and returns how many '
  'days went. Only the two accounts whose auth.users email matches claude_bot_config''s test_email '
  'or partner_email (case-insensitive) may call it, and only while linked to the other one: anyone '
  'else, or a bot whose partner is not a bot, gets 42501; no session gets '
  '''Authentication required''; a bot with no partner gets 0. Pair derived from auth.uid() and '
  'get_my_partner_id(); takes the pair''s assign_couple_day advisory lock. Returns no config value.';

revoke execute on function public.reset_bot_daily_days() from public, anon;
grant execute on function public.reset_bot_daily_days() to authenticated;

commit;
