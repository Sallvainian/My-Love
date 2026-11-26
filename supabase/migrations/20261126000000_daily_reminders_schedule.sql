-- ============================================
-- Daily pushes and nudge, story 8.5: the 8 AM and 8 PM pushes on each person's clock
-- (architecture-daily-question: AD-8, AD-9, AD-10; requirements R3, R5)
--
-- == What changes ==
-- * pg_cron is installed (`create extension if not exists pg_cron with schema
--   pg_catalog`, which creates the `cron` schema).
-- * enqueue_daily_reminders(at) (internal, AD-9): for each eligible person whose
--   own clock reads 08:00 to 08:30 (morning) or 20:00 to 20:30 (evening) at the
--   instant given, inserts that person's daily_reminders row. It takes only `at`
--   and reads no other clock (AD-8), so a test can pass any instant. Returns the
--   number of rows inserted.
--   - Eligible: users.partner_id set and the partner's partner_id pointing back,
--     at least one push_devices row, and a user_time_zones row. Local time is
--     `at at time zone effective_zone`, the expression user_local_date uses.
--   - Morning: the recipient has not picked. Evening: not both picked;
--     `evening_self` while the recipient has not picked, else `evening_partner`,
--     and no evening_partner once the recipient has spent that date's evening
--     nudge (a daily_nudges row from them, slot 'evening').
--   - Both slots call assign_couple_day for the recipient's local date before
--     deciding, so every row has a day_id; the call is skipped when the (user,
--     local date, slot) row exists.
--   - Each person runs in their own exception block: one failure is a warning
--     and leaves the others' rows. The insert is `on conflict do nothing`, so a
--     second pass at the same instant adds nothing and posts nothing.
-- * Two pg_cron jobs, scheduled by name (cron.schedule replaces a job of the same
--   name, so re-running this file leaves one row per name):
--   daily-reminders          every 5 minutes: enqueue_daily_reminders(now())
--   daily-reminders-run-history  daily: drops cron.job_run_details older than 7 days (an unfinished run by its start)
-- * Two AFTER INSERT triggers on daily_reminders post through notify_push (AD-10):
--   a `morning` row posts {kind: 'daily_question', id}, any other row posts
--   {kind: 'daily_reminder', id}. send-push (story 3) turns each into the push.
--
-- == Grants ==
-- enqueue_daily_reminders is security definer with an empty search_path; EXECUTE
-- is revoked from public, anon and authenticated, each named (hosted's default
-- ACL grants each role separately), and granted to service_role.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-26: pg_cron 1.6.4 available, not installed, in
-- shared_preload_libraries, cron.database_name = postgres; no `cron` schema; no
-- enqueue_daily_reminders; no trigger on daily_reminders, daily_nudges or
-- daily_picks; story 8.3's objects present; one push_sender_settings row. No
-- hosted-only names to drop.
--
-- pgTAP: 48_daily_reminders.sql pins the function, the triggers, the grants and
-- the two jobs.
-- ============================================

begin;

create extension if not exists pg_cron with schema pg_catalog;

-- --------------------------------------------
-- enqueue_daily_reminders (internal)
-- --------------------------------------------
create function public.enqueue_daily_reminders(at timestamptz)
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
               and n.sender_local_date = v_date
               and n.slot = 'evening'
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
  'Inserts the daily_reminders row of each eligible person (linked both ways, a push device and a '
  'stored zone) whose own clock at the instant given reads 08:00 to 08:30 (morning, recipient has '
  'not picked) or 20:00 to 20:30 (evening: evening_self while the recipient has not picked, else '
  'evening_partner unless their evening nudge is spent; none once both picked), after '
  'assign_couple_day for their local date (AD-9). Reads no other clock (AD-8). One person''s error '
  'is a warning. Returns the rows inserted; a repeat inserts none. Internal.';

revoke execute on function public.enqueue_daily_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_daily_reminders(timestamptz) to service_role;

-- --------------------------------------------
-- The daily_reminders triggers (AD-10)
-- --------------------------------------------
drop trigger if exists daily_reminders_push_morning_after_insert on public.daily_reminders;
create trigger daily_reminders_push_morning_after_insert
  after insert on public.daily_reminders
  for each row
  when (new.kind = 'morning')
  execute function public.notify_push('daily_question');

drop trigger if exists daily_reminders_push_evening_after_insert on public.daily_reminders;
create trigger daily_reminders_push_evening_after_insert
  after insert on public.daily_reminders
  for each row
  when (new.kind <> 'morning')
  execute function public.notify_push('daily_reminder');

comment on table public.daily_reminders is
  'One row per 8 AM or 8 PM daily push the server queues for user_id (AD-9): kind is morning, '
  'evening_self or evening_partner, slot (morning | evening) is generated from it, local_date is '
  'the recipient''s date and day_id the couple day the push is about. The unique key is the '
  'once-per-slot-and-date limit. Rows are written by enqueue_daily_reminders, which the '
  'daily-reminders pg_cron job runs every 5 minutes; inserting one posts {kind: daily_question} '
  '(morning) or {kind: daily_reminder} (the evening kinds) through notify_push. anon and '
  'authenticated hold no privilege (service_role keeps its default privileges). Pinned by '
  'supabase/tests/database/47_daily_pushes.sql and 48_daily_reminders.sql.';

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events, anniversaries and daily_reminders, '
  'and the partner_requests triggers: posts {kind, id} (kind is the trigger argument) to the '
  'send-push Edge Function asynchronously and swallows every error.';

comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests, events, '
  'anniversaries, daily_reminders). One row, service role only; with no row both do nothing.';

-- --------------------------------------------
-- The two pg_cron jobs
-- --------------------------------------------
select cron.schedule(
  'daily-reminders',
  '*/5 * * * *',
  $job$select public.enqueue_daily_reminders(now())$job$
);

select cron.schedule(
  'daily-reminders-run-history',
  '17 3 * * *',
  $job$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days'$job$
);

commit;
