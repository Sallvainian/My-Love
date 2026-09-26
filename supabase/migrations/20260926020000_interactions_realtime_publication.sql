-- ============================================
-- Deliver pokes and kisses live: publish public.interactions to Realtime
--
-- PokeKissInterface subscribes to postgres_changes INSERTs on
-- public.interactions filtered to the recipient
-- (src/api/interactionService.ts, subscribeInteractions), and the channel joins
-- and reports SUBSCRIBED -- but Realtime only streams changes for tables in the
-- `supabase_realtime` publication, and no migration ever added this one. So no
-- poke or kiss has ever arrived live: the recipient saw it only when the
-- history was next read (a signed-in start or a reconnect).
--
-- Read before writing this (read-only, 2026-09-26): on the hosted project the
-- publication holds public.love_notes alone -- added outside migrations, and
-- unused, since love notes travel over Broadcast -- and on a local stack it
-- holds nothing. This adds public.interactions on both. love_notes is left as
-- it is.
--
-- Who receives what is unchanged: Realtime checks each change against the
-- subscriber's SELECT policy ("Users can view interactions to/from them"), so a
-- row reaches only its sender and its recipient, and the client still drops
-- anything not from its current partner (validateIncomingInteraction).
--
-- Guarded so the migration is a no-op wherever the table is already published.
-- ============================================

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'interactions'
  ) then
    alter publication supabase_realtime add table public.interactions;
  end if;
end;
$$;

commit;
