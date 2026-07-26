-- ============================================
-- Migration: Make mood inserts idempotent at the database
-- Created: 2026-07-26
--
-- Why
-- ---
-- public.moods has no unique key beyond `id`, so every guard against writing the
-- same logged mood twice is client-side, and three vectors defeat them:
--
--   1. Retry after partial success. moodApi.create() commits, the response path
--      fails (network timeout, or SupabaseMoodSchema.parse throwing), and
--      markAsSynced never runs — so the retry re-enters with supabaseId still
--      undefined and inserts again, up to 4 attempts.
--   2. Unsynchronised writers. The isSyncing guard in moodSlice lives in one
--      page's JS heap; the service worker and any second tab cannot see it.
--   3. Edit after a failed first sync. supabaseId is still undefined, so the
--      edit inserts rather than PATCHes.
--
-- The database is the only layer all three writers share, so the guard belongs
-- here. `created_at` is the idempotency key because it is client-supplied from
-- the local record (src/sw.ts and src/api/moodSyncService.ts both send
-- mood.timestamp.toISOString()) rather than defaulted to now() — re-sending the
-- same record reproduces the same key.
--
-- Note there is deliberately NO constraint on (user_id, local_day): the local
-- day is client-timezone dependent and is not stored on the row, and a user may
-- legitimately log more than one mood in a day.
--
-- Cleanup
-- -------
-- The constraint cannot be created while duplicate (user_id, created_at) rows
-- exist, so exact duplicates are collapsed first, keeping the lowest `id` per
-- group. This only touches rows that share a byte-identical client-supplied
-- created_at — i.e. the ones this constraint exists to prevent. Historical
-- same-day duplicates with differing created_at are left alone; some may be
-- intentional re-logs.
--
-- Rows with a NULL created_at (none are written by the app — the column only
-- defaults to now() for direct SQL inserts) are skipped: NULLs are distinct
-- under a plain UNIQUE constraint, so they neither collide nor block it.
-- ============================================

begin;

-- Collapse exact duplicates, keeping the lowest id per (user_id, created_at).
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, created_at
      order by id
    ) as row_num
  from public.moods
  where created_at is not null
)
delete from public.moods m
using ranked r
where m.id = r.id
  and r.row_num > 1;

-- Add the constraint idempotently so `supabase db reset` and any re-run of this
-- file against an already-migrated database both succeed.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'moods_user_id_created_at_key'
      and conrelid = 'public.moods'::regclass
  ) then
    alter table public.moods
      add constraint moods_user_id_created_at_key unique (user_id, created_at);
  end if;
end $$;

commit;
