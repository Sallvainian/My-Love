-- ============================================
-- Daily pushes and nudge, story 8.6: a pick pushes the partner, and both answered
-- (architecture-daily-question: AD-10; requirements R1, R4)
--
-- == What changes ==
-- * Two AFTER INSERT ... FOR EACH ROW triggers on daily_picks post through
--   notify_push (AD-10), which is reused unchanged:
--   daily_picks_push_partner_picked_after_insert  when (not new.is_second)
--     posts {kind: 'daily_partner_picked', id}
--   daily_picks_push_both_answered_after_insert   when (new.is_second)
--     posts {kind: 'daily_both_answered', id}
--   The body is {kind, id} only, so no choice is posted (R1). send-push (story
--   8.3) does the rest: it drops a late first pick, words a late second pick
--   with "That day counts.", and honours each switch. A retried pick inserts no
--   row (record_daily_pick returns before any insert), so it posts nothing.
-- * The comments on notify_push(), push_sender_settings and daily_picks name the
--   new triggers.
--
-- == Deploy order ==
-- The sender shipped a deploy earlier (story 8.3: it accepted both kinds while
-- nothing posted them), so these triggers meet a sender that already knows them.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-26 (story 8.5): no trigger on daily_picks, so there
-- are no hosted-only names to drop.
--
-- pgTAP: 49_daily_pick_pushes.sql pins both triggers and the calls they queue.
-- ============================================

begin;

drop trigger if exists daily_picks_push_partner_picked_after_insert on public.daily_picks;
create trigger daily_picks_push_partner_picked_after_insert
  after insert on public.daily_picks
  for each row
  when (not new.is_second)
  execute function public.notify_push('daily_partner_picked');

drop trigger if exists daily_picks_push_both_answered_after_insert on public.daily_picks;
create trigger daily_picks_push_both_answered_after_insert
  after insert on public.daily_picks
  for each row
  when (new.is_second)
  execute function public.notify_push('daily_both_answered');

comment on table public.daily_picks is
  'One insert-only pick per user and day. `choice` is readable by no API role; only '
  'visible_daily_picks selects it. anon and authenticated hold no privilege, and service_role holds '
  'column SELECT on every column but `choice`. Inserting a first pick (is_second false) posts '
  '{kind: daily_partner_picked} and a second pick posts {kind: daily_both_answered} through '
  'notify_push, with the row id and never the choice. Pinned by '
  'supabase/tests/database/40_daily_question_gate.sql and 49_daily_pick_pushes.sql.';

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos, interactions, events, anniversaries, daily_reminders and '
  'daily_picks, and the partner_requests triggers: posts {kind, id} (kind is the trigger argument) '
  'to the send-push Edge Function asynchronously and swallows every error.';

comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions, partner_requests, events, '
  'anniversaries, daily_reminders, daily_picks). One row, service role only; with no row both do '
  'nothing.';

commit;
