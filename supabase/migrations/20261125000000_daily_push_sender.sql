-- ============================================
-- Daily pushes and nudge, story 8.3: the sender's schema
-- (architecture-daily-question: AD-3, AD-9, AD-10, AD-15, AD-17)
--
-- == What changes ==
-- * daily_nudges (AD-17): one row per nudge a partner sends, unique per sender,
--   sender-local date and slot ('after_pick' before 20:00 on the sender's clock,
--   'evening' from 20:00). Its rows are written by send_daily_nudge (story 7).
-- * daily_reminders (AD-9): one row per 8 AM / 8 PM push the server queues,
--   unique per user, local date and slot. `slot` is a stored generated column
--   from `kind`, so no row can carry a slot that disagrees with its kind and
--   slip past the unique key. Its rows are written by enqueue_daily_reminders
--   (story 5).
-- * push_requests takes daily_pick_id, daily_nudge_id and daily_reminder_id as
--   its ninth to eleventh sources (AD-10), each unique with the token and
--   cascading with its row, and the one-source check is rebuilt over all eleven.
--   A pick serves both daily_partner_picked and daily_both_answered: story 6's
--   triggers are to post one pick as exactly one of them, and send-push does
--   not check is_second, so (daily_pick_id, token) stays clear only while their
--   WHEN clauses hold (DW-525).
-- * push_preferences takes the five switches (AD-10), one per kind, named after
--   the kind, boolean not null default true.
-- * user_local_date(user_id, at) (internal, AD-15): the user's calendar date at
--   the instant given, in their stored zone ('UTC' with no row, AD-3). The one
--   place a recipient's current date is worked out; send-push calls it and never
--   does zone arithmetic itself.
--
-- Nothing writes the new tables yet: no trigger, no cron job (stories 5 to 7: the
-- reminder triggers and pg_cron job are story 5, the pick triggers story 6, the
-- nudge story 7).
-- send-push learns the five kinds in the same change, a deploy ahead of the
-- triggers, because its old POSTED_KINDS rejects unknown kinds.
--
-- == Grants ==
-- Both tables enable RLS with no policy and revoke everything from anon and
-- authenticated (20260725170000_grant_api_roles_on_public.sql grants ALL on
-- every future public table to them); service_role keeps its default
-- privileges. user_local_date revokes EXECUTE from public, anon and
-- authenticated, each named (hosted's default ACL grants each role separately),
-- and is granted to service_role.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-25: no daily_nudges, daily_reminders or
-- user_local_date; push_requests holds only the eight migration sources and
-- constraints; push_preferences only its migration columns. No hosted-only
-- names to drop.
--
-- pgTAP: 47_daily_pushes.sql pins the structure, the cascades, the source check
-- and user_local_date.
-- ============================================

begin;

-- --------------------------------------------
-- daily_nudges
-- --------------------------------------------
create table public.daily_nudges (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.users(id) on delete cascade,
  to_user uuid not null references public.users(id) on delete cascade,
  day_id uuid not null references public.couple_days(id) on delete cascade,
  sender_local_date date not null,
  slot text not null,
  created_at timestamptz not null default now(),
  constraint daily_nudges_slot_check check (slot in ('after_pick', 'evening')),
  constraint daily_nudges_sender_date_slot_key unique (from_user, sender_local_date, slot)
);

comment on table public.daily_nudges is
  'One row per nudge a partner sends (AD-17): from_user nudges to_user about day_id, in the slot '
  '(after_pick before 20:00 on the sender''s clock, evening from 20:00) of the sender''s local date. '
  'The unique key is the server''s limit of one nudge per slot. Inserting a row posts nothing yet '
  '(story 7 adds the trigger). anon and authenticated hold no privilege (service_role keeps its '
  'default privileges). Pinned by supabase/tests/database/47_daily_pushes.sql.';

-- The unique index leads with from_user; the other two FKs need their own for the cascade.
create index idx_daily_nudges_to_user on public.daily_nudges (to_user);
create index idx_daily_nudges_day_id on public.daily_nudges (day_id);

comment on index public.idx_daily_nudges_to_user is
  'Serves the cascade from users on daily_nudges.to_user; the unique key leads with from_user.';
comment on index public.idx_daily_nudges_day_id is
  'Serves the cascade from couple_days on daily_nudges.day_id.';

-- --------------------------------------------
-- daily_reminders
-- --------------------------------------------
create table public.daily_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,
  slot text not null generated always as (case when kind = 'morning' then 'morning' else 'evening' end) stored,
  local_date date not null,
  day_id uuid not null references public.couple_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint daily_reminders_kind_check check (kind in ('morning', 'evening_self', 'evening_partner')),
  constraint daily_reminders_user_date_slot_key unique (user_id, local_date, slot)
);

comment on table public.daily_reminders is
  'One row per 8 AM or 8 PM daily push the server queues for user_id (AD-9): kind is morning, '
  'evening_self or evening_partner, slot (morning | evening) is generated from it, local_date is '
  'the recipient''s date and day_id the couple day the push is about. The unique key is the '
  'once-per-slot-and-date limit. Inserting a row posts nothing yet (story 5 adds the trigger '
  'and the cron job). anon and authenticated hold no privilege (service_role keeps its '
  'default privileges). Pinned by supabase/tests/database/47_daily_pushes.sql.';

create index idx_daily_reminders_day_id on public.daily_reminders (day_id);

comment on index public.idx_daily_reminders_day_id is
  'Serves the cascade from couple_days on daily_reminders.day_id; the unique key leads with user_id.';

-- --------------------------------------------
-- Row level security and grants
-- --------------------------------------------
-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated. No policy
-- is created, and the revokes leave no privilege to need one.
alter table public.daily_nudges enable row level security;
alter table public.daily_reminders enable row level security;

revoke all on public.daily_nudges from anon, authenticated;
revoke all on public.daily_reminders from anon, authenticated;

-- --------------------------------------------
-- push_requests: three more sources
-- --------------------------------------------
alter table public.push_requests
  add column if not exists daily_pick_id uuid references public.daily_picks(id) on delete cascade,
  add column if not exists daily_nudge_id uuid references public.daily_nudges(id) on delete cascade,
  add column if not exists daily_reminder_id uuid references public.daily_reminders(id) on delete cascade;

alter table public.push_requests
  drop constraint if exists push_requests_daily_pick_token_key,
  drop constraint if exists push_requests_daily_nudge_token_key,
  drop constraint if exists push_requests_daily_reminder_token_key,
  drop constraint if exists push_requests_source_check;

alter table public.push_requests
  add constraint push_requests_daily_pick_token_key unique (daily_pick_id, token),
  add constraint push_requests_daily_nudge_token_key unique (daily_nudge_id, token),
  add constraint push_requests_daily_reminder_token_key unique (daily_reminder_id, token),
  add constraint push_requests_source_check
    check (
      num_nonnulls(
        note_id, mood_id, photo_id, interaction_id,
        partner_request_id, partner_accept_id,
        event_id, anniversary_id,
        daily_pick_id, daily_nudge_id, daily_reminder_id
      ) = 1
    );

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id, partner_request_id (a request sent), '
  'partner_accept_id (a request accepted), event_id or anniversary_id (a date added), '
  'daily_pick_id (a pick: daily_partner_picked or daily_both_answered, by the kind posted), '
  'daily_nudge_id (daily_nudge) or daily_reminder_id (daily_question or daily_reminder, by the '
  'kind posted). '
  'Service role only.';

comment on column public.push_requests.daily_pick_id is
  'The source of daily_partner_picked and daily_both_answered: the daily_picks row that was posted; '
  'one pick is posted as exactly one of them. Cascades with the pick.';
comment on column public.push_requests.daily_nudge_id is
  'The source of daily_nudge: the daily_nudges row that was posted. Cascades with the nudge.';
comment on column public.push_requests.daily_reminder_id is
  'The source of daily_question and daily_reminder: the daily_reminders row that was posted, the '
  'kind posted deciding the copy. Cascades with the reminder.';

-- --------------------------------------------
-- push_preferences: the five daily switches
-- --------------------------------------------
alter table public.push_preferences
  add column if not exists daily_question boolean not null default true,
  add column if not exists daily_partner_picked boolean not null default true,
  add column if not exists daily_nudge boolean not null default true,
  add column if not exists daily_reminder boolean not null default true,
  add column if not exists daily_both_answered boolean not null default true;

comment on column public.push_preferences.daily_question is
  'The receiver''s switch for the 8 AM push that quotes today''s question.';
comment on column public.push_preferences.daily_partner_picked is
  'The receiver''s switch for the push sent when their partner picks first.';
comment on column public.push_preferences.daily_nudge is
  'The receiver''s switch for the push sent when their partner nudges them.';
comment on column public.push_preferences.daily_reminder is
  'The receiver''s switch for the 8 PM push, both variants (evening_self and evening_partner).';
comment on column public.push_preferences.daily_both_answered is
  'The receiver''s switch for the push sent when their partner picks second.';

-- --------------------------------------------
-- user_local_date (internal)
-- --------------------------------------------
create function public.user_local_date(user_id uuid, at timestamptz)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if user_local_date.user_id is null or user_local_date.at is null then
    return null;
  end if;

  return (
    user_local_date.at at time zone coalesce(
      (select z.effective_zone from public.user_time_zones z where z.user_id = user_local_date.user_id),
      'UTC'
    )
  )::date;
end;
$$;

comment on function public.user_local_date(uuid, timestamptz) is
  'The user''s calendar date at the instant given, in their stored effective_zone (UTC with no '
  'user_time_zones row, AD-3). The one definition of a recipient''s current date for send-push '
  '(AD-10); null for a null argument. Stores nothing. Internal.';

revoke execute on function public.user_local_date(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.user_local_date(uuid, timestamptz) to service_role;

commit;
