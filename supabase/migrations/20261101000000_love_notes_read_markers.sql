-- ============================================
-- Push notifications, story 3.8: love notes stack apart and the badge counts
-- unread notes
--
-- Every push carries the app icon's badge: the number of partner love notes
-- the recipient has not opened. "Opened" is a per-account marker on the
-- server, written with the server clock so it compares with
-- `love_notes.created_at` (the server's delivery time) on one clock.
--
-- == love_notes_read_markers ==
-- One row per account: `last_opened_at`, when the person last had Love Notes
-- on screen. The owner may read their row; there is no client write path. The
-- only writer is `mark_love_notes_read()`, which stamps `now()`. The row goes
-- with the account through the cascade on auth.users.
--
-- The migration seeds a row at now() for every existing account, so the first
-- push after the deploy counts no old notes. An account created later has no
-- row until it first opens Love Notes, and counts every note it received.
--
-- == unread_love_note_count ==
-- The single definition of the badge: partner notes to the user that are newer
-- than the marker (every note when there is no row). The sender calls it with
-- the service role; execute is revoked from public, anon and authenticated,
-- each explicitly, because the hosted default ACL grants each one separately.
--
-- == Hosted catalog ==
-- Every object here is new; deploy.yml applies this migration to the hosted
-- project on merge to main, before the sender is redeployed.
--
-- pgTAP: supabase/tests/database/37_love_notes_read_markers.sql pins the
-- policies, the grants and the count.
-- ============================================

begin;

create table public.love_notes_read_markers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_opened_at timestamptz not null default now()
);

comment on table public.love_notes_read_markers is
  'One row per account: when the person last had Love Notes on screen, on the server clock. '
  'Written only by mark_love_notes_read(); read by its owner and, through unread_love_note_count, by the send-push Edge Function. '
  'Pinned by supabase/tests/database/37_love_notes_read_markers.sql.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.love_notes_read_markers enable row level security;

revoke all on public.love_notes_read_markers from anon, authenticated;
grant select on public.love_notes_read_markers to authenticated;

create policy "Users can view own love notes read marker"
  on public.love_notes_read_markers for select
  to authenticated
  using (user_id = (select auth.uid()));

-- So the first push after the deploy counts no old notes.
insert into public.love_notes_read_markers (user_id, last_opened_at)
select id, now() from auth.users
on conflict (user_id) do nothing;

-- --------------------------------------------
-- mark_love_notes_read
-- --------------------------------------------
create function public.mark_love_notes_read()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.love_notes_read_markers (user_id, last_opened_at)
  values (v_uid, v_now)
  on conflict (user_id) do update
    set last_opened_at = excluded.last_opened_at;

  return v_now;
end;
$$;

comment on function public.mark_love_notes_read() is
  'Stamps the caller''s Love Notes marker with the server clock and returns it. '
  'The only write path to love_notes_read_markers.';

revoke execute on function public.mark_love_notes_read() from public, anon;
grant execute on function public.mark_love_notes_read() to authenticated;

-- --------------------------------------------
-- unread_love_note_count
-- --------------------------------------------
create function public.unread_love_note_count(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.love_notes n
  where n.to_user_id = p_user_id
    and n.from_user_id <> p_user_id
    and n.created_at > coalesce(
      (select m.last_opened_at from public.love_notes_read_markers m where m.user_id = p_user_id),
      '-infinity'::timestamptz
    );
$$;

comment on function public.unread_love_note_count(uuid) is
  'Partner love notes to the user that are newer than their marker (every note when they have none). '
  'The send-push Edge Function puts it in aps.badge. Service role only.';

revoke execute on function public.unread_love_note_count(uuid) from public, anon, authenticated;
grant execute on function public.unread_love_note_count(uuid) to service_role;

commit;
