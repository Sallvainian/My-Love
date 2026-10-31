-- ============================================
-- Push notifications, story 3.1: devices, the sender's settings, the recorded
-- requests and the love-note trigger
--
-- A love note reaches the partner's iPhone as a push. This migration is the
-- server half: the table of registered devices, the RPC a signed-in shell
-- registers through, the table the sender records its requests in, and an
-- AFTER INSERT trigger on love_notes that tells the `send-push` Edge Function
-- a note exists.
--
-- == push_devices ==
-- One row per APNs device token. The token is unique, so a device registered
-- again under another account moves to it (register_push_device reassigns the
-- row by token). `environment` is what the shell's provisioning says the token
-- was issued for: an Xcode development install gets a sandbox token that a
-- production APNs send rejects, so the sender picks the APNs host from the row.
-- Clients may read their own rows; every write goes through the RPC, which is
-- SECURITY DEFINER because the reassignment must update a row another account
-- owns.
--
-- == push_requests ==
-- One row per (note, device): the dedupe key (a retried send yields one push)
-- and, when the sender has no APNs key, the request it would have sent
-- (device token, environment, payload) for `sim push` to deliver. RLS on, no
-- policies, no grants for anon or authenticated: only service_role (the
-- sender) reads or writes it.
--
-- == push_sender_settings ==
-- The sender's URL and the shared secret the trigger presents to it. One row,
-- service-only like push_requests. Local stacks get theirs from seed.sql;
-- hosted gets them in story 3.3. With no row the trigger does nothing, so CI
-- and the hosted project before that story are unaffected.
--
-- == The trigger never fails or delays the insert ==
-- net.http_post only queues the call (pg_net's worker sends it after the
-- transaction commits), and the whole body sits in an exception block that
-- swallows every error. An AFTER INSERT row trigger does not fire for an
-- INSERT ... ON CONFLICT DO NOTHING that was ignored as a duplicate, so a
-- retried note sends no second push.
--
-- == Hosted catalog ==
-- pg_net was dropped from the hosted project in 20251206024345_remote_schema.sql.
-- `create extension if not exists` covers both states; the hosted state is
-- read read-only in story 3.13 before anything is applied there. Every other
-- object here is new.
--
-- pgTAP: supabase/tests/database/35_push_devices.sql and
-- 18_function_execute_grants.sql pin the policies and grants.
-- ============================================

begin;

create extension if not exists pg_net with schema extensions;

-- --------------------------------------------
-- push_devices
-- --------------------------------------------
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  environment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_token_key unique (token),
  constraint push_devices_environment_check check (environment in ('sandbox', 'production')),
  constraint push_devices_token_check check (char_length(token) between 1 and 512)
);

create index push_devices_user_id_idx on public.push_devices (user_id);

comment on table public.push_devices is
  'APNs device tokens by account, with the APNs environment each was issued for. '
  'Written only by register_push_device(); read by the owner and by the send-push '
  'Edge Function (service role). Pinned by supabase/tests/database/35_push_devices.sql.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.push_devices enable row level security;

revoke all on public.push_devices from anon, authenticated;
grant select on public.push_devices to authenticated;

create policy "Users can view own push devices"
  on public.push_devices for select
  to authenticated
  using (user_id = (select auth.uid()));

-- --------------------------------------------
-- register_push_device
-- --------------------------------------------
create function public.register_push_device(p_token text, p_environment text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- A bad environment is refused by push_devices_environment_check (23514).
  insert into public.push_devices (user_id, token, environment)
  values (v_uid, p_token, p_environment)
  on conflict (token) do update
    set user_id = excluded.user_id,
        environment = excluded.environment,
        updated_at = now();
end;
$$;

comment on function public.register_push_device(text, text) is
  'Registers the caller''s APNs device token with its environment (sandbox or production). '
  'A token already registered to another account moves to the caller.';

revoke execute on function public.register_push_device(text, text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;

-- --------------------------------------------
-- push_requests
-- --------------------------------------------
create table public.push_requests (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.love_notes(id) on delete cascade,
  token text not null,
  environment text not null,
  payload jsonb not null,
  delivery text not null,
  created_at timestamptz not null default now(),
  constraint push_requests_note_token_key unique (note_id, token),
  constraint push_requests_environment_check check (environment in ('sandbox', 'production')),
  constraint push_requests_delivery_check check (delivery in ('recorded', 'sent'))
);

comment on table public.push_requests is
  'One row per (love note, device token): the sender''s dedupe key and, with no APNs key '
  '(delivery = recorded), the request it would have sent. Service role only.';

alter table public.push_requests enable row level security;

revoke all on public.push_requests from anon, authenticated;

-- --------------------------------------------
-- push_sender_settings
-- --------------------------------------------
create table public.push_sender_settings (
  singleton boolean primary key default true check (singleton),
  sender_url text not null,
  sender_secret text not null check (char_length(sender_secret) >= 16)
);

comment on table public.push_sender_settings is
  'Where the love-note trigger posts and the shared secret it presents. One row, service role '
  'only; with no row the trigger does nothing.';

alter table public.push_sender_settings enable row level security;

revoke all on public.push_sender_settings from anon, authenticated;

-- --------------------------------------------
-- The love-note trigger
-- --------------------------------------------
create function public.notify_love_note_push()
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
      body := jsonb_build_object('note_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      timeout_milliseconds := 2000
    );
  exception when others then
    -- A push is never worth a lost note, but a bad URL or secret should show
    -- in the database log rather than vanish.
    raise warning 'notify_love_note_push: %', sqlerrm;
  end;

  return null;
end;
$$;

comment on function public.notify_love_note_push() is
  'AFTER INSERT trigger on love_notes: posts the new note''s id to the send-push Edge Function '
  'asynchronously and swallows every error.';

revoke execute on function public.notify_love_note_push() from public, anon, authenticated;

create trigger love_notes_push_after_insert
  after insert on public.love_notes
  for each row
  execute function public.notify_love_note_push();

commit;
