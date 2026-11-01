-- ============================================
-- Push notifications, story 3.6: partner requests push
--
-- A person learned of a partner request sent to them, or of their own request
-- being accepted, only while the app was open. This migration pushes both.
--
-- == What pushes ==
--   * a partner_requests INSERT whose status is 'pending' posts
--     {kind: 'partner_request', id}; the sender pushes it to to_user_id;
--   * an UPDATE of status from 'pending' to 'accepted' (made by
--     accept_partner_request) posts {kind: 'partner_accept', id}; the sender
--     pushes it to from_user_id.
-- Nothing is posted for a decline: decline_partner_request, and the other
-- pending requests that accept_partner_request auto-declines, move a request to
-- 'declined', which neither WHEN clause matches. An INSERT that arrives already
-- 'accepted' or 'declined' posts nothing either.
--
-- == Reuse ==
-- notify_push() (20261031020000) already posts {kind: tg_argv[0], id: new.id}
-- and reads nothing else from the row, so it works unchanged in an AFTER UPDATE.
-- Its body is not touched; only its COMMENT is. The new triggers inherit its
-- rules: with no push_sender_settings row nothing is posted, and a failure
-- never fails or delays the write (net.http_post, 2 s timeout, exception block
-- that raises a warning).
--
-- == Dedupe ==
-- A request row is inserted once and accepted at most once (accept requires
-- 'pending'), so its id is a sound dedupe source for both kinds. They get
-- separate columns on push_requests, so the same device token can never
-- collide across the two pushes of one request, for example after a device
-- switched accounts.
--
-- == Forged accepts ==
-- The sender treats a partner_accept post as a claim that the request was
-- accepted and re-checks its status, so a replayed or forged post for a
-- pending or declined request announces nothing.
--
-- == Cascades ==
-- Deleting a partner request (or either user) deletes its push_requests.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql pins the columns, the
-- check, the triggers and the queued calls. 18_function_execute_grants.sql is
-- unchanged: no function is added.
-- ============================================

begin;

-- --------------------------------------------
-- push_requests: a sixth and seventh source
-- --------------------------------------------
alter table public.push_requests
  add column partner_request_id uuid references public.partner_requests(id) on delete cascade,
  add column partner_accept_id uuid references public.partner_requests(id) on delete cascade;

alter table public.push_requests
  add constraint push_requests_partner_request_token_key unique (partner_request_id, token);

alter table public.push_requests
  add constraint push_requests_partner_accept_token_key unique (partner_accept_id, token);

alter table public.push_requests
  drop constraint push_requests_source_check;

alter table public.push_requests
  add constraint push_requests_source_check
    check (
      num_nonnulls(
        note_id, mood_id, photo_id, interaction_id, date_change_id,
        partner_request_id, partner_accept_id
      ) = 1
    );

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id, date_change_id, partner_request_id (a request '
  'sent) or partner_accept_id (a request accepted). Service role only.';

-- --------------------------------------------
-- The settings row and the shared trigger function: comments only
-- --------------------------------------------
comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes), notify_push (moods, photos, interactions, partner_requests) and '
  'notify_date_change (events, couple_settings, users). One row, service role only; with no '
  'row all three do nothing.';

comment on function public.notify_push() is
  'AFTER INSERT (and, on partner_requests, AFTER UPDATE) trigger on moods, photos, interactions and '
  'partner_requests: posts {kind, id} (kind is the trigger argument) to the send-push Edge Function '
  'asynchronously and swallows every error.';

-- --------------------------------------------
-- The triggers
-- --------------------------------------------
create trigger partner_requests_push_after_insert
  after insert on public.partner_requests
  for each row
  when (new.status = 'pending')
  execute function public.notify_push('partner_request');

create trigger partner_requests_push_after_accept
  after update of status on public.partner_requests
  for each row
  when (old.status = 'pending' and new.status = 'accepted')
  execute function public.notify_push('partner_accept');

commit;
