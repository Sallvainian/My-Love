-- ============================================
-- Pending partner requests, with the other person's name
--
-- Both request lists on the Partner tab showed "Unknown User".
-- partnerService.getPendingRequests read the caller's requests (allowed by
-- "Users can view their requests") and then looked the other person up in
-- public.users, whose SELECT policy ("Users can view self and partner
-- profiles", 20260925000000) shows an unlinked caller only their own row. A
-- pending request is by definition between two people who are not linked, so
-- that lookup never returned the other side, and every row fell through to
-- the fallback.
--
-- The SELECT policy is deliberately NOT loosened; this function answers the
-- one question the lists need, as the definer.
--
-- == What it answers ==
-- One row per PENDING request the caller sent or received -- never another
-- pair's -- newest first, with:
--   * other_display_name: the other person's chosen name, or null while their
--     profile still carries the seed sync_user_profile() gave it. The seed rule
--     is the client's isSeedFallbackName (src/api/supabaseClient.ts): blank,
--     'Unknown', or the account's own email in any case, after trimming.
--   * other_email: the other person's sign-in email, shown when there is no
--     chosen name. It discloses nothing new to either side: the sender found
--     the recipient by typing that exact address (find_partner_by_email is the
--     only way the app learns another account's id), and the recipient is
--     being asked to link irreversibly with the sender, so knowing who is
--     asking is the point.
-- Nothing at all for a NULL auth.uid(); EXECUTE is revoked from anon below as
-- well.
--
-- == Grants ==
-- Same shape as 20260926000000_find_partner_by_email.sql: PUBLIC and anon are
-- revoked and authenticated is granted explicitly.
-- supabase/tests/database/18_function_execute_grants.sql pins the exact set of
-- functions `authenticated` may call, so it is edited in the same change.
--
-- == Hosted catalog ==
-- Read before writing this (read-only, 2026-09-26): on the hosted project
-- public.partner_requests has the same columns, constraints, indexes and the
-- same two policies ("Users can create partner requests", "Users can view
-- their requests") as the local stack. Nothing is replaced or dropped here.
-- ============================================

begin;

create function public.get_my_pending_partner_requests()
returns table (
  id uuid,
  from_user_id uuid,
  to_user_id uuid,
  created_at timestamptz,
  other_display_name text,
  other_email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.from_user_id,
    r.to_user_id,
    r.created_at,
    case
      when btrim(coalesce(u.display_name, '')) = '' then null
      when btrim(u.display_name) = 'Unknown' then null
      when btrim(coalesce(u.email, '')) <> ''
        and lower(btrim(u.display_name)) = lower(btrim(u.email)) then null
      else btrim(u.display_name)
    end,
    u.email
  from public.partner_requests r
  left join public.users u
    on u.id = case
      when r.from_user_id = (select auth.uid()) then r.to_user_id
      else r.from_user_id
    end
  where (select auth.uid()) is not null
    and r.status = 'pending'
    and (r.from_user_id = (select auth.uid()) or r.to_user_id = (select auth.uid()))
  order by r.created_at desc;
$$;

comment on function public.get_my_pending_partner_requests() is
  'The caller''s own pending partner requests, sent and received, with the other person''s chosen name (null while it is the seed) and sign-in email.';

revoke execute on function public.get_my_pending_partner_requests() from public, anon;
grant execute on function public.get_my_pending_partner_requests() to authenticated;

commit;
