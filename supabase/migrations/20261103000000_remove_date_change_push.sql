-- ============================================
-- Settings rework, story 5.4 (DW-416): adding or changing a date sends no push
--
-- Story 3.5 (20261031030000) pushed the partner for every event added or
-- changed, the wedding date, the date the couple got together and a birthday.
-- The owner decided on 2026-11-02 that no date change pushes; with tap-to-edit
-- every field save would push. This is the first of DW-416's two deploys: it
-- removes everything 20261031030000 created. The send-push Edge Function loses
-- its `date` kind and the client stops using the `dates` switch in the same
-- change.
--
-- == What goes ==
--   * the triggers events_push_after_insert, events_push_after_update,
--     couple_settings_push_after_insert, couple_settings_push_after_update and
--     users_push_after_birthday;
--   * notify_date_change();
--   * push_requests.date_change_id, with its foreign key and its unique key
--     push_requests_date_change_token_key. Rows that name a date change are
--     deleted first: the source check below needs exactly one source column
--     set, and a row whose only source was date_change_id would have none;
--   * date_changes (its index goes with it).
-- push_requests_source_check is rebuilt over the six remaining sources.
--
-- == What stays ==
-- push_preferences.dates. Installed shells still select and upsert that column,
-- and a select that names a missing column fails the whole read. Story 18 drops
-- it once both phones run code that no longer touches it. Nothing reads it now:
-- send-push no longer maps a kind to it.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-03: exactly the objects 20261031030000 created,
-- and no hosted-only names. Every drop is still `if exists`, so every stack
-- ends the same.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql pins the absence and that
-- a date write queues no call. 18_function_execute_grants.sql is unchanged: the
-- dropped function was executable by no API role.
-- ============================================

begin;

-- --------------------------------------------
-- The triggers and their function
-- --------------------------------------------
drop trigger if exists events_push_after_insert on public.events;
drop trigger if exists events_push_after_update on public.events;
drop trigger if exists couple_settings_push_after_insert on public.couple_settings;
drop trigger if exists couple_settings_push_after_update on public.couple_settings;
drop trigger if exists users_push_after_birthday on public.users;

drop function if exists public.notify_date_change();

-- --------------------------------------------
-- push_requests: back to six sources
-- --------------------------------------------
delete from public.push_requests
 where date_change_id is not null;

alter table public.push_requests
  drop constraint if exists push_requests_source_check;

alter table public.push_requests
  drop constraint if exists push_requests_date_change_token_key;

alter table public.push_requests
  drop column if exists date_change_id;

alter table public.push_requests
  add constraint push_requests_source_check
    check (
      num_nonnulls(
        note_id, mood_id, photo_id, interaction_id,
        partner_request_id, partner_accept_id
      ) = 1
    );

drop table if exists public.date_changes;

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id, partner_request_id (a request sent) or '
  'partner_accept_id (a request accepted). Service role only.';

-- --------------------------------------------
-- push_sender_settings: read by two trigger functions again
-- --------------------------------------------
comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests). One row, '
  'service role only; with no row both do nothing.';

-- --------------------------------------------
-- push_preferences.dates: kept, unread
-- --------------------------------------------
comment on column public.push_preferences.dates is
  'Unread since story 5.4 (DW-416): no date change sends a push. Kept because installed shells '
  'still select and upsert it; story 18 drops it.';

commit;
