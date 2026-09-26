-- ============================================
-- pgTAP: public.interactions is published to Realtime (20260926020000)
--
-- PokeKissInterface receives pokes and kisses as postgres_changes INSERTs, and
-- Realtime streams changes only for tables in the `supabase_realtime`
-- publication. Without this row every poke waited for the next history read.
-- ============================================

begin;

select plan(2);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'interactions'
  ),
  'IRP-DB-001: public.interactions is in the supabase_realtime publication'
);

-- Realtime filters each change through the subscriber's SELECT policy, which is
-- what keeps a published row to its sender and recipient.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.interactions'::regclass),
  'IRP-DB-002: public.interactions still enforces row level security'
);

select * from finish();
rollback;
