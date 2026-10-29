-- ============================================
-- Love-note image uploads: one shared count per user (DW-322)
--
-- upload-love-note-image allowed 10 uploads per minute per user, but kept the
-- count in a module-level Map in handler.ts. Every edge-runtime isolate has its
-- own copy of that Map, so once one user's requests spread across isolates
-- (measured locally under [edge_runtime] policy = "per_worker") each isolate
-- counted separately and the limit was not enforced. The count now lives here,
-- where every isolate sees the same row.
--
-- == Semantics: a fixed window per user ==
-- The first counted upload opens a one-minute window; up to 10 uploads are
-- admitted in it, and the first call at or after one minute from its start
-- opens a new window. That can admit up to 20 in a 60 s span straddling a
-- window edge; the per-isolate sliding window it replaces admitted 10 per
-- isolate. A sliding window would need a row per upload; one count per user
-- is what was chosen. Retry-After: 60 stays a correct upper bound.
--
-- == What the function answers ==
-- claim_love_note_upload() takes no arguments, so a caller cannot widen the
-- limit through /rest/v1/rpc: the user is auth.uid(), and the limit (10) and
-- window (1 minute) are fixed here. CONFIG.RATE_LIMIT_MAX_UPLOADS and
-- RATE_LIMIT_WINDOW_MS in the function mirror these values and must change
-- with them. One row: allowed, and remaining (uploads left in the window
-- after this one). A refused call does not raise the count. The caller's row
-- is locked for the read-modify-write, so concurrent calls serialize. A NULL
-- auth.uid() raises 'Authentication required'; anon has no EXECUTE either.
--
-- == The table ==
-- RLS on, no policies, and no table grants for anon or authenticated: only
-- the definer writes it. service_role keeps its default grant, which
-- tests/api/upload-love-note-image-limits.spec.ts uses to reset its own row.
--
-- == Grants ==
-- Same shape as 20260926010000_my_pending_partner_requests.sql: PUBLIC and
-- anon are revoked and authenticated is granted explicitly.
-- supabase/tests/database/18_function_execute_grants.sql pins the exact set
-- of functions `authenticated` may call, so it is edited in the same change.
--
-- == Deploy order ==
-- Edge Functions are not deployed by deploy.yml. The upload-love-note-image
-- deploy that calls this function must follow `supabase db push` of this
-- migration; until then every upload answers 500 'Rate limit check failed'.
--
-- == Hosted catalog ==
-- New objects only; nothing is replaced or dropped.
-- ============================================

begin;

create table public.love_note_upload_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  upload_count integer not null default 0 check (upload_count >= 0)
);

comment on table public.love_note_upload_counts is
  'Per-user love-note image upload count for the current one-minute window. '
  'Written only by claim_love_note_upload(); no client access. Pinned by '
  'supabase/tests/database/34_love_note_upload_counts.sql.';

-- Mandatory in this same migration: 20260725170000_grant_api_roles_on_public.sql
-- grants ALL on every future public table to anon and authenticated.
alter table public.love_note_upload_counts enable row level security;

revoke all on public.love_note_upload_counts from anon, authenticated;

create function public.claim_love_note_upload()
returns table (allowed boolean, remaining integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_max_uploads constant integer := 10;
  c_window constant interval := interval '1 minute';
  v_uid uuid := (select auth.uid());
  v_start timestamptz;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Create the row if it is missing, then lock it: every concurrent call for
  -- this user waits here until the one ahead of it commits.
  insert into public.love_note_upload_counts (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select c.window_started_at, c.upload_count
    into v_start, v_count
    from public.love_note_upload_counts c
   where c.user_id = v_uid
     for update;

  if v_start <= now() - c_window then
    v_start := now();
    v_count := 0;
  end if;

  if v_count >= c_max_uploads then
    -- Refused: the stored count is left as it is.
    allowed := false;
    remaining := 0;
    return next;
    return;
  end if;

  v_count := v_count + 1;

  update public.love_note_upload_counts c
     set window_started_at = v_start,
         upload_count = v_count
   where c.user_id = v_uid;

  allowed := true;
  remaining := c_max_uploads - v_count;
  return next;
end;
$$;

comment on function public.claim_love_note_upload() is
  'Counts one love-note image upload for the caller against 10 per one-minute window. '
  'Returns allowed and the uploads remaining; a refused call is not counted.';

revoke execute on function public.claim_love_note_upload() from public, anon;
grant execute on function public.claim_love_note_upload() to authenticated;

commit;
