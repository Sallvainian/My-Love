-- Evaluate auth.uid() once per query in the photos and users policies, and give
-- photos one SELECT policy. Clears the Supabase advisors auth_rls_initplan
-- (a bare auth.uid() is re-run for every row; `(select auth.uid())` becomes an
-- init plan run once) and multiple_permissive_policies (two permissive SELECT
-- policies on photos are both evaluated for every row).
--
-- Who can see or change what does not change:
--   photos SELECT  own rows, or rows of the caller's linked partner. The old
--                  partner policy's EXISTS (users.id = auth.uid() AND
--                  users.partner_id = photos.user_id) is exactly
--                  get_my_partner_id(), the SECURITY DEFINER helper from
--                  20260205000001_fix_users_rls_recursion.sql.
--   photos INSERT  own rows only (photoService's upsert uses ignoreDuplicates,
--                  i.e. ON CONFLICT DO NOTHING, which needs no UPDATE policy).
--   photos DELETE  own rows only.
--   users SELECT   self, partner, and anyone who names the caller as partner.
-- The photos policies were created for every role; they are now TO
-- authenticated. anon never matched them, since auth.uid() is NULL for anon.
--
-- Production drift: the hosted project's photos policies were edited outside
-- migrations (same migration history as this repo). It has one SELECT policy
-- named "Users can view own or partner photos" and an UPDATE policy "Users can
-- update own photos" that no migration creates and nothing in the app, the
-- tests or the edge function uses. Both are dropped here, so every stack ends
-- with the same three photos policies. On a local or CI stack those two drops
-- are no-ops.

begin;

drop policy if exists "Users can view own photos" on public.photos;
drop policy if exists "Partners can view partner photos" on public.photos;
drop policy if exists "Users can view own or partner photos" on public.photos;
drop policy if exists "Users can update own photos" on public.photos;
drop policy if exists "Users can insert own photos" on public.photos;
drop policy if exists "Users can delete own photos" on public.photos;

create policy "Users can view own and partner photos"
  on public.photos
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or user_id = (select public.get_my_partner_id())
  );

create policy "Users can insert own photos"
  on public.photos
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can delete own photos"
  on public.photos
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can view self and partner profiles" on public.users;

create policy "Users can view self and partner profiles"
  on public.users
  as permissive
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or id = (select public.get_my_partner_id())
    or partner_id = (select auth.uid())
  );

commit;
