-- Account data that used to live only in each device's browser storage
-- (spec-move-local-data-to-supabase): anniversaries, custom messages, and
-- favorites of the bundled daily messages, plus one receipt row per completed
-- one-time upload of a device's local copy.
--
-- All four are private to their author, exactly as the local copies were: no
-- policy here reads get_my_partner_id(), and the partner sees nothing new.
--
-- client_key is the idempotency key for every insert. The one-time upload
-- derives it deterministically from the local row (a:<date>:<hash(label)>,
-- c:<createdAt ms>:<hash(text)>), so a re-run -- or the service-worker reload
-- that interrupts the first run -- collides on UNIQUE (user_id, client_key)
-- and is ignored (ON CONFLICT DO NOTHING) instead of inserting a duplicate.
-- The in-app creates send a key minted once per submit and reused on its
-- retry (a custom-message import keys each row by its text), and read the
-- stored row back on a conflict. The random default is only a fallback. A
-- plain constraint, not a
-- partial index: PostgREST's on_conflict cannot express an index predicate
-- (same reasoning as 20260727000000_love_notes_idempotency.sql).
--
-- updated_at is client-maintained, as on public.events: there is deliberately
-- no trigger, and the writing client sets it on every UPDATE.
--
-- Length checks mirror src/validation/schemas.ts: an anniversary label must be
-- non-empty (AnniversarySchema has no maximum, and a tighter server limit would
-- make a valid local row un-uploadable forever), and a custom message's text
-- is 1-1000 characters after trimming (CreateMessageInputSchema).

begin;

-- ---------------------------------------------------------------------------
-- anniversaries
-- ---------------------------------------------------------------------------

create table if not exists public.anniversaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_date date not null,
  label text not null check (char_length(label) >= 1),
  description text,
  client_key text not null default gen_random_uuid()::text
    check (char_length(client_key) <= 200),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint anniversaries_user_id_client_key_key unique (user_id, client_key)
);

comment on table public.anniversaries is
  'Per-user anniversary countdowns. Owner-only: pinned by '
  'supabase/tests/database/27_local_data_tables.sql.';
comment on column public.anniversaries.event_date is
  'A calendar date, not an instant: every viewer reads the same YYYY-MM-DD.';
comment on column public.anniversaries.client_key is
  'Idempotency key. Deterministic for rows from the one-time local upload, and one per submit (reused on its retry) for in-app creates.';

-- ---------------------------------------------------------------------------
-- custom_messages
-- ---------------------------------------------------------------------------

create table if not exists public.custom_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null
    check (char_length(btrim(text)) >= 1 and char_length(text) <= 1000),
  -- Mirrors MessageCategory in src/types/index.ts.
  category text not null
    check (category in ('reason', 'memory', 'affirmation', 'future', 'custom')),
  active boolean not null default true,
  is_favorite boolean not null default false,
  tags text[] not null default '{}',
  client_key text not null default gen_random_uuid()::text
    check (char_length(client_key) <= 200),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint custom_messages_user_id_client_key_key unique (user_id, client_key)
);

comment on table public.custom_messages is
  'Per-user custom daily messages. Owner-only: pinned by '
  'supabase/tests/database/27_local_data_tables.sql.';
comment on column public.custom_messages.is_favorite is
  'The author''s favorite flag for their own custom message. Favorites of the '
  'bundled messages live in public.message_favorites.';

-- ---------------------------------------------------------------------------
-- message_favorites (bundled daily messages only)
-- ---------------------------------------------------------------------------

-- Bundled message ids are device-local autoincrement values, so the key is a
-- stable hash of the message text instead (b:<sha-256 hex>).
create table if not exists public.message_favorites (
  user_id uuid references auth.users(id) on delete cascade not null,
  message_key text not null check (char_length(message_key) <= 200),
  created_at timestamptz default now() not null,
  primary key (user_id, message_key)
);

comment on table public.message_favorites is
  'Per-user favorites of the bundled daily messages, keyed by a hash of the '
  'text. Owner-only; no UPDATE.';

-- ---------------------------------------------------------------------------
-- local_data_uploads (receipts)
-- ---------------------------------------------------------------------------

-- Counts and origin only, never content: this is the evidence that a device's
-- one-time upload completed, and nothing more.
create table if not exists public.local_data_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  origin text not null check (char_length(origin) <= 200),
  anniversaries_count integer not null check (anniversaries_count >= 0),
  custom_messages_count integer not null check (custom_messages_count >= 0),
  favorites_count integer not null check (favorites_count >= 0),
  created_at timestamptz default now() not null
);

comment on table public.local_data_uploads is
  'One receipt per completed one-time upload of a device''s local data: '
  'user, origin and per-feature counts only. SELECT and INSERT only.';

create index if not exists idx_local_data_uploads_user_id
  on public.local_data_uploads (user_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.anniversaries enable row level security;
alter table public.custom_messages enable row level security;
alter table public.message_favorites enable row level security;
alter table public.local_data_uploads enable row level security;

-- anniversaries: owner-only CRUD. UPDATE states WITH CHECK explicitly so a row
-- cannot be donated by rewriting user_id.
create policy "anniversaries_select" on public.anniversaries
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "anniversaries_insert" on public.anniversaries
  as permissive for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "anniversaries_update" on public.anniversaries
  as permissive for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "anniversaries_delete" on public.anniversaries
  as permissive for delete to authenticated
  using ((select auth.uid()) = user_id);

-- custom_messages: owner-only CRUD.
create policy "custom_messages_select" on public.custom_messages
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "custom_messages_insert" on public.custom_messages
  as permissive for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "custom_messages_update" on public.custom_messages
  as permissive for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "custom_messages_delete" on public.custom_messages
  as permissive for delete to authenticated
  using ((select auth.uid()) = user_id);

-- message_favorites: add and remove only; a favorite has nothing to edit.
create policy "message_favorites_select" on public.message_favorites
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "message_favorites_insert" on public.message_favorites
  as permissive for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "message_favorites_delete" on public.message_favorites
  as permissive for delete to authenticated
  using ((select auth.uid()) = user_id);

-- local_data_uploads: a receipt is written once and never changed.
create policy "local_data_uploads_select" on public.local_data_uploads
  as permissive for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "local_data_uploads_insert" on public.local_data_uploads
  as permissive for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Grants: anon gets nothing; authenticated gets exactly what the policies use
-- ---------------------------------------------------------------------------

revoke all on public.anniversaries from anon, authenticated;
revoke all on public.custom_messages from anon, authenticated;
revoke all on public.message_favorites from anon, authenticated;
revoke all on public.local_data_uploads from anon, authenticated;

grant select, insert, update, delete on public.anniversaries to authenticated;
grant select, insert, update, delete on public.custom_messages to authenticated;
grant select, insert, delete on public.message_favorites to authenticated;
grant select, insert on public.local_data_uploads to authenticated;

commit;
