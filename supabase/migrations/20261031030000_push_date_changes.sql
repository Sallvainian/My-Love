-- ============================================
-- Push notifications, story 3.5: date changes push
--
-- Story 3.4 pushed a new mood, photo, poke or kiss. This migration does the
-- same for the dates a partner sees only while the app is open: a new or
-- changed shared event, the wedding date, the date the couple got together,
-- and a birthday.
--
-- == Why a log table ==
-- The story 3.4 pattern posts {kind, id} of the row that was inserted. That
-- does not fit here for two reasons. An edit must push again for the same
-- source row, and push_requests is unique on (source row, device), so an
-- event's id could be claimed only once. And a couple_settings row does not
-- record who changed it, nor which of its two dates changed. So each
-- push-worthy change is written to public.date_changes (one row per change,
-- naming its sender) and the trigger posts {kind: 'date', id: <change id>}.
-- The sender reads that row, pushes to the sender's partner, and claims one
-- push_requests row per (change, device) in the new date_change_id column.
--
-- == What counts as a change ==
--   * an events INSERT (action 'added');
--   * an events UPDATE where label, event_date, description or icon is
--     distinct from its old value (action 'changed'); an update that changes
--     only updated_at logs nothing;
--   * a couple_settings INSERT, or UPDATE, where relationship_start or
--     wedding_date is non-NULL and distinct from its old value. One change is
--     logged per such column, so an INSERT carrying both dates logs two. The
--     action is 'added' when the old value was NULL (or there was no old row),
--     else 'changed';
--   * a users UPDATE where birthday is non-NULL and distinct from its old
--     value, with the same action rule.
-- Nothing is logged for a DELETE, for a value cleared to NULL, or for any write
-- to anniversaries (no trigger exists on that table).
--
-- == Who sent it ==
-- events.user_id for an event, users.id for a birthday. couple_settings does
-- not record its writer, so it is auth.uid(), and only when that is user_a or
-- user_b: a service-role write (no session) or a stranger logs nothing. The
-- recipient is not stored: the sender looks up the sender's users.partner_id
-- when it reads the change.
--
-- == The trigger body ==
-- Like notify_love_note_push and notify_push it never fails or delays the
-- write: it reads the settings, logs and posts through net.http_post (2 s
-- timeout, asynchronous), and sits in an exception block that raises a warning
-- and swallows the error. With no push_sender_settings row it logs and posts
-- nothing. The exception block is a subtransaction, so when posting raises
-- (an unusable sender URL) the change rows logged in the same call roll back
-- with it: no sender is told, so there is nothing to keep.
--
-- == Cascades ==
-- Deleting an event deletes its date_changes (event_id), and deleting a
-- change deletes its push_requests (date_change_id). Deleting a user deletes
-- the changes it sent.
--
-- == Access ==
-- date_changes enables RLS here and has no policies. 20260725170000 grants ALL
-- on future public tables to anon and authenticated, so both are revoked.
-- Only the trigger function (SECURITY DEFINER) and the service role touch it.
-- notify_date_change() is executable by no API role.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql pins the table, the
-- triggers, the source check, the cascades and the grants;
-- 18_function_execute_grants.sql FN-GRANT-008's list is unchanged (it lists
-- the functions the API roles may execute, and this is not one).
-- ============================================

begin;

-- --------------------------------------------
-- date_changes: one row per push-worthy change
-- --------------------------------------------
create table public.date_changes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users(id) on delete cascade,
  subject text not null
    check (subject in ('event', 'wedding_date', 'relationship_start', 'birthday')),
  action text not null
    check (action in ('added', 'changed')),
  event_id uuid references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint date_changes_event_subject_check check ((subject = 'event') = (event_id is not null))
);

comment on table public.date_changes is
  'Log of push-worthy date changes (an event added or changed, the wedding date, the date the couple '
  'got together, a birthday), one row per change, written by notify_date_change(). The send-push '
  'Edge Function reads a row to build the push. No policies; service role only.';
comment on column public.date_changes.sender_id is
  'Who made the change: events.user_id, users.id, or auth.uid() for couple_settings.';
comment on column public.date_changes.event_id is
  'The event the change is about; set exactly when subject is ''event''. Deleting the event deletes the change.';

create index date_changes_event_id_idx on public.date_changes (event_id);

-- Mandatory in this same migration: future public tables are granted to anon and authenticated.
alter table public.date_changes enable row level security;
revoke all on public.date_changes from anon, authenticated;

-- --------------------------------------------
-- push_requests: a fifth source
-- --------------------------------------------
alter table public.push_requests
  add column date_change_id uuid references public.date_changes(id) on delete cascade;

alter table public.push_requests
  add constraint push_requests_date_change_token_key unique (date_change_id, token);

alter table public.push_requests
  drop constraint push_requests_source_check;

alter table public.push_requests
  add constraint push_requests_source_check
    check (num_nonnulls(note_id, mood_id, photo_id, interaction_id, date_change_id) = 1);

comment on table public.push_requests is
  'One row per (source row, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. The source is exactly one of '
  'note_id, mood_id, photo_id, interaction_id or date_change_id. Service role only.';

-- --------------------------------------------
-- push_sender_settings: now read by three trigger functions
-- --------------------------------------------
comment on table public.push_sender_settings is
  'Where the push triggers post and the shared secret they present: notify_love_note_push '
  '(love_notes), notify_push (moods, photos, interactions) and notify_date_change (events, '
  'couple_settings, users). One row, service role only; with no row all three do nothing.';

-- --------------------------------------------
-- The date-change trigger
-- --------------------------------------------
create function public.notify_date_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_sender uuid;
  v_event_id uuid;
  v_subjects text[] := '{}';
  v_actions text[] := '{}';
  v_old_start timestamptz;
  v_old_wedding date;
  v_old_birthday date;
  v_change_id uuid;
  i int;
begin
  begin
    select s.sender_url, s.sender_secret
      into v_url, v_secret
      from public.push_sender_settings s;

    if v_url is null or v_secret is null then
      return null;
    end if;

    if tg_table_name = 'events' then
      v_sender := new.user_id;
      v_event_id := new.id;
      v_subjects := array['event'];
      v_actions := array[case when tg_op = 'INSERT' then 'added' else 'changed' end];

    elsif tg_table_name = 'couple_settings' then
      -- The row does not record who wrote it; only a member of the pair counts.
      v_sender := auth.uid();
      if v_sender is null or v_sender not in (new.user_a, new.user_b) then
        return null;
      end if;
      if tg_op = 'UPDATE' then
        v_old_start := old.relationship_start;
        v_old_wedding := old.wedding_date;
      end if;
      if new.relationship_start is not null
         and new.relationship_start is distinct from v_old_start then
        v_subjects := array_append(v_subjects, 'relationship_start');
        v_actions := array_append(v_actions, case when v_old_start is null then 'added' else 'changed' end);
      end if;
      if new.wedding_date is not null
         and new.wedding_date is distinct from v_old_wedding then
        v_subjects := array_append(v_subjects, 'wedding_date');
        v_actions := array_append(v_actions, case when v_old_wedding is null then 'added' else 'changed' end);
      end if;

    elsif tg_table_name = 'users' then
      v_sender := new.id;
      if tg_op = 'UPDATE' then
        v_old_birthday := old.birthday;
      end if;
      if new.birthday is not null and new.birthday is distinct from v_old_birthday then
        v_subjects := array['birthday'];
        v_actions := array[case when v_old_birthday is null then 'added' else 'changed' end];
      end if;
    end if;

    for i in 1 .. coalesce(cardinality(v_subjects), 0) loop
      insert into public.date_changes (sender_id, subject, action, event_id)
      values (v_sender, v_subjects[i], v_actions[i], v_event_id)
      returning id into v_change_id;

      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('kind', 'date', 'id', v_change_id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-secret', v_secret
        ),
        timeout_milliseconds := 2000
      );
    end loop;
  exception when others then
    -- A push is never worth a lost event, date or birthday, but a bad URL or
    -- secret should show in the database log rather than vanish.
    raise warning 'notify_date_change: %', sqlerrm;
  end;

  return null;
end;
$$;

comment on function public.notify_date_change() is
  'AFTER INSERT/UPDATE trigger on events, couple_settings and users: logs each push-worthy date change '
  'in date_changes and posts {kind: date, id} to the send-push Edge Function asynchronously, '
  'swallowing every error.';

revoke execute on function public.notify_date_change() from public, anon, authenticated;

create trigger events_push_after_insert
  after insert on public.events
  for each row
  execute function public.notify_date_change();

create trigger events_push_after_update
  after update on public.events
  for each row
  when (
    old.label is distinct from new.label
    or old.event_date is distinct from new.event_date
    or old.description is distinct from new.description
    or old.icon is distinct from new.icon
  )
  execute function public.notify_date_change();

create trigger couple_settings_push_after_insert
  after insert on public.couple_settings
  for each row
  when (new.relationship_start is not null or new.wedding_date is not null)
  execute function public.notify_date_change();

create trigger couple_settings_push_after_update
  after update on public.couple_settings
  for each row
  when (
    (new.relationship_start is not null and old.relationship_start is distinct from new.relationship_start)
    or (new.wedding_date is not null and old.wedding_date is distinct from new.wedding_date)
  )
  execute function public.notify_date_change();

create trigger users_push_after_birthday
  after update of birthday on public.users
  for each row
  when (new.birthday is not null and old.birthday is distinct from new.birthday)
  execute function public.notify_date_change();

commit;
