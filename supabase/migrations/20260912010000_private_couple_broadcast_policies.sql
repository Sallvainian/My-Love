-- ============================================
-- Directional RLS for the couple broadcast topics (F2/F3, CAP-2/CAP-3)
--
-- `love-notes:<uuid>` and `mood-updates:<uuid>` were public Realtime topics:
-- anyone holding the project's anon key could join a stranger's topic and both
-- read and forge partner traffic on it. Both clients now join with
-- `private: true`, which makes Realtime evaluate RLS on realtime.messages at
-- join and on every send.
--
-- The grant is deliberately directional, one policy per direction and one
-- predicate covering both prefixes so there is a single place to audit:
--
--   * SELECT (receive) -- only on YOUR OWN topic. The second topic segment must
--     be the caller's own id.
--   * INSERT (send)    -- only to your CURRENT partner's topic, resolved
--     through public.get_my_partner_id().
--
-- A sender therefore gets no read access across partner topics: Supabase grants
-- a private join for read OR write, so INSERT alone is enough to join and
-- broadcast (guides/realtime/authorization.mdx).
--
-- Why the topic segment is compared as TEXT, not cast to ::uuid.
-- The scripture precedent casts (20260220000001_scripture_lobby_and_roles.sql:74).
-- A topic whose second segment is not a UUID then raises 22P02 during policy
-- evaluation instead of denying the join. `split_part(topic, ':', 2) =
-- (select auth.uid())::text` cannot raise, and a non-canonical UUID simply
-- fails to match -- fail closed. Both clients build these topics from
-- Supabase-issued lowercase UUID strings.
--
-- Why plain `=` against get_my_partner_id(), with no null guard.
-- The function returns NULL for an unlinked caller, `x = NULL` evaluates to
-- NULL, and RLS admits a row only on TRUE -- so an unpartnered caller is
-- denied. Same reasoning as 20260818000002_create_events_table.sql:60.
--
-- Why `to authenticated` rather than implicit PUBLIC.
-- anon holds no EXECUTE on get_my_partner_id since
-- 20260818000000_revoke_anon_execute_and_fix_partner_guards.sql, so a PUBLIC
-- policy would fail an anon request with "permission denied for function
-- get_my_partner_id" instead of a clean row-level-security denial
-- (20260818000002_create_events_table.sql:55-58).
--
-- Scope note: this touches nothing in the realtime schema beyond RLS policies on
-- realtime.messages, which remains supported under the July 2026 Realtime
-- schema restriction.
-- ============================================

begin;

-- SELECT (receive): only broadcasts addressed to your own topic.
create policy "couple_broadcast_recipient_can_receive"
  on realtime.messages
  for select
  to authenticated
  using (
    (topic like 'love-notes:%' or topic like 'mood-updates:%')
    and split_part(topic, ':', 2) = (select auth.uid())::text
  );

-- INSERT (send): only to the topic owned by your current partner.
create policy "couple_broadcast_partner_can_send"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (topic like 'love-notes:%' or topic like 'mood-updates:%')
    and split_part(topic, ':', 2) = public.get_my_partner_id()::text
  );

commit;
