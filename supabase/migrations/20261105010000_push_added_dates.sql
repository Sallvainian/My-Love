-- A new event or anniversary pushes the partner.
--
-- Owner decision 2026-11-05: "I just want notifications for when a date is
-- added, either an event or anniversary." This reverses the "added" half of
-- DW-416 (story 5.4, 20261103000000_remove_date_change_push.sql); a change to
-- a date, the wedding date, Together since or a birthday still sends nothing.
--
-- * events and anniversaries get an AFTER INSERT trigger on the existing
--   notify_push() (20261031020000), posting {kind: 'event' | 'anniversary', id}.
--   No UPDATE trigger: edits stay silent.
-- * push_requests takes event_id and anniversary_id as its seventh and eighth
--   sources, each unique with the token and cascading with its row, and the
--   one-source check is rebuilt over all eight.
-- * push_preferences.dates comes back (story 5.18 dropped it,
--   20261104000000): the receiver's switch for these pushes, on by default.
--
-- Hosted catalog read 2026-11-05: push triggers exist only on interactions,
-- love_notes, moods, partner_requests and photos; no hosted-only names.
-- Pinned by supabase/tests/database/35_push_devices.sql and
-- 36_push_preferences.sql.

begin;

alter table public.push_requests
  add column if not exists event_id uuid references public.events(id) on delete cascade,
  add column if not exists anniversary_id uuid references public.anniversaries(id) on delete cascade;

alter table public.push_requests
  drop constraint if exists push_requests_event_token_key,
  drop constraint if exists push_requests_anniversary_token_key,
  drop constraint if exists push_requests_source_check;

alter table public.push_requests
  add constraint push_requests_event_token_key unique (event_id, token),
  add constraint push_requests_anniversary_token_key unique (anniversary_id, token),
  add constraint push_requests_source_check
    check (
      num_nonnulls(
        note_id, mood_id, photo_id, interaction_id,
        partner_request_id, partner_accept_id,
        event_id, anniversary_id
      ) = 1
    );

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id, partner_request_id (a request sent), '
  'partner_accept_id (a request accepted), event_id or anniversary_id (a date added). '
  'Service role only.';

alter table public.push_preferences
  add column if not exists dates boolean not null default true;

comment on column public.push_preferences.dates is
  'The receiver''s switch for the push sent when their partner adds an event or an anniversary.';

comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests, events, '
  'anniversaries). One row, service role only; with no row both do nothing.';

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events and anniversaries, and the '
  'partner_requests triggers: posts {kind, id} (kind is the trigger argument) to the '
  'send-push Edge Function asynchronously and swallows every error.';

drop trigger if exists events_push_after_insert on public.events;
create trigger events_push_after_insert
  after insert on public.events
  for each row
  execute function public.notify_push('event');

drop trigger if exists anniversaries_push_after_insert on public.anniversaries;
create trigger anniversaries_push_after_insert
  after insert on public.anniversaries
  for each row
  execute function public.notify_push('anniversary');

commit;
