-- ============================================
-- Simpler daily pushes and nudge, story 11.2: three daily pushes, three switches
-- (architecture-daily-question: AD-4, AD-9, AD-10, AD-17)
--
-- Written without begin/commit so tests/support/helpers/migration-replay.ts can
-- replay it inside a rolled-back transaction (the Supabase CLI runs a file as
-- one transaction anyway). Every step is re-runnable.
--
-- == What changes ==
-- * The 8 AM new-question push and the partner-picked push are gone: the
--   triggers daily_reminders_push_morning_after_insert and
--   daily_picks_push_partner_picked_after_insert are dropped, so a first pick
--   queues no call and an 08:00 tick inserts no reminder.
-- * daily_reminders: the stored `morning` and `evening_partner` rows are
--   deleted (their push_requests rows cascade), and daily_reminders_kind_check
--   is narrowed to `evening_self`. The generated `slot` column, the unique key
--   (user_id, local_date, slot) and the index stay; slot now always reads
--   `evening`.
-- * daily_reminders_push_evening_after_insert is recreated with no WHEN: every
--   row is the 8 PM reminder and posts {kind: 'daily_reminder'}.
--   daily_picks_push_both_answered_after_insert is the only daily_picks trigger.
-- * enqueue_daily_reminders(at): keeps the held-nudge release block unchanged,
--   then acts only when a person's own clock reads 20:00 to 20:30. It skips a
--   person whose (user, local date, 'evening') row exists, calls
--   assign_couple_day, skips a person who has picked, and otherwise inserts
--   `evening_self`. At 08:00 the loop never reaches assign_couple_day, so the
--   08:00 tick assigns no day (narrows DW-498); the held-nudge release is the
--   only work it does there.
-- * The comments on daily_reminders, daily_picks, enqueue_daily_reminders,
--   notify_push(), push_requests (and its daily_pick_id and daily_reminder_id
--   columns) and push_preferences.daily_question, daily_partner_picked and
--   daily_reminder are rewritten.
--
-- == Columns kept ==
-- push_preferences.daily_question and daily_partner_picked stay with their
-- stored values and defaults: installed builds read them by name until they
-- take the live update. Neither the app nor send-push reads or writes them
-- after this deploy; epic 10 drops them (DW-548).
--
-- == Grants ==
-- enqueue_daily_reminders keeps its internal grants, stated again: revoked from
-- public, anon and authenticated, granted to service_role.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-26 (epic Notes): no hosted-only names on these
-- tables or functions, so a plain `drop ... if exists` is enough.
--
-- pgTAP: 47_daily_pushes.sql pins the kind check, 48_daily_reminders.sql the
-- trigger and the 08:00 and 20:00 ticks, 49_daily_pick_pushes.sql the pick
-- triggers. tests/integration/three-daily-pushes-migration.spec.ts replays this
-- file over stored rows of the removed kinds.
-- ============================================

-- --------------------------------------------
-- daily_reminders: only the 8 PM reminder to whoever has not answered
-- --------------------------------------------
delete from public.daily_reminders where kind in ('morning', 'evening_partner');

alter table public.daily_reminders drop constraint if exists daily_reminders_kind_check;
alter table public.daily_reminders
  add constraint daily_reminders_kind_check check (kind = 'evening_self');

-- --------------------------------------------
-- The triggers (AD-10)
-- --------------------------------------------
drop trigger if exists daily_reminders_push_morning_after_insert on public.daily_reminders;

drop trigger if exists daily_reminders_push_evening_after_insert on public.daily_reminders;
create trigger daily_reminders_push_evening_after_insert
  after insert on public.daily_reminders
  for each row
  execute function public.notify_push('daily_reminder');

drop trigger if exists daily_picks_push_partner_picked_after_insert on public.daily_picks;

-- --------------------------------------------
-- enqueue_daily_reminders: only the 8 PM reminder, only for whoever has not picked
-- --------------------------------------------
create or replace function public.enqueue_daily_reminders(at timestamptz)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_local timestamp;
  v_date date;
  v_day public.couple_days;
  v_rows integer;
  v_count integer := 0;
begin
  if enqueue_daily_reminders.at is null then
    return 0;
  end if;

  -- Held nudges whose hold has ended go out on this same tick (story 11.1).
  -- Its failure never costs a reminder its row, and the count returned stays
  -- the reminder rows inserted.
  begin
    perform public.release_held_daily_nudges(enqueue_daily_reminders.at);
  exception when others then
    raise warning 'enqueue_daily_reminders: release_held_daily_nudges: %', sqlerrm;
  end;

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
      if not (v_local::time >= '20:00' and v_local::time < '20:30') then
        continue;
      end if;
      v_date := v_local::date;

      if exists (
        select 1 from public.daily_reminders x
         where x.user_id = r.user_id and x.local_date = v_date and x.slot = 'evening'
      ) then
        continue;
      end if;

      v_day := public.assign_couple_day(
        least(r.user_id, r.partner_id), greatest(r.user_id, r.partner_id), v_date
      );

      if exists (
        select 1 from public.daily_picks k where k.day_id = v_day.id and k.user_id = r.user_id
      ) then
        continue;
      end if;

      insert into public.daily_reminders (user_id, kind, local_date, day_id)
      values (r.user_id, 'evening_self', v_date, v_day.id)
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
  'First releases the held nudges whose hold has ended (release_held_daily_nudges, in its own '
  'exception block). Then inserts the evening_self daily_reminders row of each eligible person '
  '(linked both ways, a push device and a stored zone) whose own clock at the instant given reads '
  '20:00 to 20:30 and who has not picked that day, after assign_couple_day for their local date '
  '(AD-9). It does nothing else at any other time of day, 08:00 included, where only the held-nudge '
  'release runs. Reads no other clock (AD-8). One person''s error is a warning. Returns the reminder '
  'rows inserted; a repeat inserts none. Internal.';

revoke execute on function public.enqueue_daily_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_daily_reminders(timestamptz) to service_role;

-- --------------------------------------------
-- Comments
-- --------------------------------------------
comment on table public.daily_reminders is
  'One row per 8 PM daily push the server queues for user_id (AD-9): kind is evening_self, the '
  'reminder to a person who has not answered, slot is generated from it and always reads evening, '
  'local_date is the recipient''s date and day_id the couple day the push is about. The unique key '
  'is the once-per-date limit. Rows are written by enqueue_daily_reminders, which the '
  'daily-reminders pg_cron job runs every 5 minutes; inserting one posts {kind: daily_reminder} '
  'through notify_push. anon and authenticated hold no privilege (service_role keeps its default '
  'privileges). Pinned by supabase/tests/database/47_daily_pushes.sql and 48_daily_reminders.sql.';

comment on table public.daily_picks is
  'One insert-only pick per user and day. `choice` is readable by no API role; only '
  'visible_daily_picks selects it. anon and authenticated hold no privilege, and service_role holds '
  'column SELECT on every column but `choice`. Inserting a second pick (is_second true) posts '
  '{kind: daily_both_answered} through notify_push, with the row id and never the choice; a first '
  'pick posts nothing. Pinned by supabase/tests/database/40_daily_question_gate.sql and '
  '49_daily_pick_pushes.sql.';

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events, anniversaries, daily_reminders, '
  'daily_picks (the second pick only) and daily_nudges (not held), the partner_requests triggers, '
  'and the AFTER UPDATE trigger that posts a held daily_nudges row when released_at is set: posts '
  '{kind, id} (kind is the trigger argument) to the send-push Edge Function asynchronously and '
  'swallows every error.';

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id, partner_request_id (a request sent), '
  'partner_accept_id (a request accepted), event_id or anniversary_id (a date added), '
  'daily_pick_id (a second pick: daily_both_answered), daily_nudge_id (daily_nudge) or '
  'daily_reminder_id (the 8 PM reminder: daily_reminder). '
  'Service role only.';

comment on column public.push_requests.daily_pick_id is
  'The source of daily_both_answered: the second daily_picks row that was posted. Cascades with '
  'the pick.';
comment on column public.push_requests.daily_reminder_id is
  'The source of daily_reminder: the evening_self daily_reminders row that was posted. Cascades '
  'with the reminder.';

comment on column public.push_preferences.daily_question is
  'No longer read or written by the app or send-push (story 11.2). Kept for installed builds '
  'that still select it by name until they take the live update; epic 10 drops it (DW-548).';
comment on column public.push_preferences.daily_partner_picked is
  'No longer read or written by the app or send-push (story 11.2). Kept for installed builds '
  'that still select it by name until they take the live update; epic 10 drops it (DW-548).';
comment on column public.push_preferences.daily_reminder is
  'The receiver''s switch for the 8 PM reminder sent to a person who has not answered.';
