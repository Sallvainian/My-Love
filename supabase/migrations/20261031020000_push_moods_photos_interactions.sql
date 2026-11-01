-- ============================================
-- Push notifications, story 3.4: moods, photos, pokes and kisses push
--
-- Story 3.1 made a new love note push. This migration extends the same
-- trigger-and-sender pattern to the other three things a partner sees only
-- while the app is open: a new mood, a new photo, and a new poke or kiss.
--
-- == push_requests ==
-- The dedupe key was (note, device). A request can now belong to a mood, a
-- photo or an interaction instead, so `note_id` becomes nullable and three
-- sibling columns are added, each a foreign key to its table with
-- ON DELETE CASCADE (deleting a source row deletes its requests, as for notes)
-- and each unique with the device token. Separate columns, not one untyped
-- `source_id`, keep the cascade and leave every existing `note_id` row, query
-- and test valid. Exactly one of the four is set: push_requests_source_check.
-- Every existing row carries a note_id, so the check holds for hosted data.
--
-- == notify_push ==
-- One trigger function for the three new tables. The trigger names the kind in
-- its argument (`'mood'`, `'photo'`, `'interaction'`) and the function posts
-- `{kind, id}` to the send-push Edge Function, with the shared secret, exactly
-- as notify_love_note_push does for a note (which is unchanged, and still
-- posts `{note_id}`). The sender reads the row with the service role and works
-- out the recipient and the text itself, so a forged call can name no target
-- beyond an existing row.
--
-- AFTER INSERT ... FOR EACH ROW fires only for a row that was inserted:
--   * a mood upsert that hits (user_id, created_at) takes the DO UPDATE path
--     (moodApi.create, sw.ts upsertMood, merge-duplicates) and fires no INSERT
--     trigger, so a re-sent mood pushes nothing;
--   * a photo upsert ignored on storage_path inserts nothing and fires nothing;
--   * no UPDATE trigger exists, so no edit pushes.
--
-- Like notify_love_note_push the body never fails or delays the insert: it
-- reads the settings, makes only an asynchronous net.http_post (2 s timeout),
-- and sits in an exception block that raises a warning and swallows the error.
-- With no push_sender_settings row it does nothing.
--
-- Revoked from public, anon and authenticated: only the trigger runs it.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql pins the triggers, the
-- source check, the cascade and the grant;
-- 18_function_execute_grants.sql FN-GRANT-008's list is unchanged (it lists
-- the functions the API roles may execute, and this is not one).
-- ============================================

begin;

-- --------------------------------------------
-- push_requests: one source per row
-- --------------------------------------------
alter table public.push_requests
  alter column note_id drop not null;

alter table public.push_requests
  add column mood_id uuid references public.moods(id) on delete cascade,
  add column photo_id uuid references public.photos(id) on delete cascade,
  add column interaction_id uuid references public.interactions(id) on delete cascade;

alter table public.push_requests
  add constraint push_requests_mood_token_key unique (mood_id, token),
  add constraint push_requests_photo_token_key unique (photo_id, token),
  add constraint push_requests_interaction_token_key unique (interaction_id, token),
  add constraint push_requests_source_check
    check (num_nonnulls(note_id, mood_id, photo_id, interaction_id) = 1);

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id or interaction_id. Service role only.';

-- --------------------------------------------
-- push_sender_settings: now read by two trigger functions
-- --------------------------------------------
comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes) and notify_push (moods, photos, interactions). One row, service role only; '
  'with no row both triggers do nothing.';

-- --------------------------------------------
-- The mood / photo / interaction trigger
-- --------------------------------------------
create function public.notify_push()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    select s.sender_url, s.sender_secret
      into v_url, v_secret
      from public.push_sender_settings s;

    if v_url is null or v_secret is null then
      return null;
    end if;

    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('kind', tg_argv[0], 'id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      timeout_milliseconds := 2000
    );
  exception when others then
    -- A push is never worth a lost mood, photo or poke, but a bad URL or
    -- secret should show in the database log rather than vanish.
    raise warning 'notify_push: %', sqlerrm;
  end;

  return null;
end;
$$;

comment on function public.notify_push() is
  'AFTER INSERT trigger on moods, photos and interactions: posts {kind, id} (kind is the trigger '
  'argument) to the send-push Edge Function asynchronously and swallows every error.';

revoke execute on function public.notify_push() from public, anon, authenticated;

create trigger moods_push_after_insert
  after insert on public.moods
  for each row
  execute function public.notify_push('mood');

create trigger photos_push_after_insert
  after insert on public.photos
  for each row
  execute function public.notify_push('photo');

create trigger interactions_push_after_insert
  after insert on public.interactions
  for each row
  execute function public.notify_push('interaction');

commit;
