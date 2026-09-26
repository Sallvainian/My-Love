-- ============================================
-- In-app partner search: look an account up by its exact sign-in email
--
-- The Partner tab's "Connect with Your Partner" search could never find anyone.
-- partnerService.searchUsers queried public.users directly with an ilike on
-- email and display_name, but the only SELECT policy on that table
-- ("Users can view self and partner profiles", 20260925000000) shows a caller
-- their own row, their partner's row, and rows that name them as partner. An
-- unlinked user is exactly the one who needs the search, and for them every
-- other row is invisible -- so the search returned nothing and nobody could
-- connect in-app.
--
-- The SELECT policy is deliberately NOT loosened. Opening public.users to
-- every signed-in user would publish every account's email, name, birthday and
-- partner link. Instead this function answers one narrow question as the
-- definer and returns only what the connect screen needs.
--
-- == What it answers ==
-- Zero or one row, keyed on the EXACT sign-in email, compared
-- case-insensitively after trimming. No partial match and no name search: the
-- caller must already know the address, so the function cannot be used to
-- browse accounts. public.users.email mirrors auth.users.email through
-- sync_user_profile() and clients cannot write it (20260912030000), so matching
-- it is matching the sign-in address.
--
--   * No row: no account uses the email, or it is the caller's own. The caller
--     never finds themself, and the two cases are indistinguishable.
--   * (id, display_name, is_taken = false): an account with no partner, which
--     the caller can send a request to.
--   * (null, null, is_taken = true): the account exists but already has a
--     partner. The screen says so instead of "no account", because a person
--     typing their partner's address deserves to know why it cannot be
--     connected. Nothing else about that account is returned -- no id to send
--     a request to (accept_partner_request would refuse it anyway) and no name.
--   * No row at all for a NULL auth.uid(). EXECUTE is revoked from anon below,
--     but the body does not rely on that.
--
-- The email is never returned: the caller typed it. auth.users keeps sign-in
-- emails unique, and the LIMIT makes "at most one" hold even if the mirror ever
-- disagreed.
--
-- The lookup uses idx_users_email_search, the btree on lower(email) from
-- 20251206024345_remote_schema.sql:85, present on hosted too.
--
-- == Grants ==
-- Same shape as 20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:
-- PUBLIC and anon are revoked (the local stack grants EXECUTE through PUBLIC,
-- the hosted project additionally through an explicit anon entry from its
-- pg_default_acl), and authenticated is granted explicitly because revoking
-- PUBLIC removes the implicit grant it would otherwise ride on.
-- supabase/tests/database/18_function_execute_grants.sql pins the exact set of
-- functions `authenticated` may call, so this function is added there in the
-- same change.
--
-- == Hosted catalog ==
-- Read before writing this (read-only, 2026-09-26): public on the hosted
-- project holds accept_partner_request, decline_partner_request,
-- get_my_partner_id, love_notes_written_at_guard and sync_user_profile -- no
-- function of this name or signature -- and public.users carries the same three
-- policies as the local stack. Nothing is replaced or dropped here, so there
-- is no hosted-only object to clear.
-- ============================================

begin;

create function public.find_partner_by_email(p_email text)
returns table (id uuid, display_name text, is_taken boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when u.partner_id is null then u.id end,
    case when u.partner_id is null then u.display_name end,
    u.partner_id is not null
  from public.users u
  where (select auth.uid()) is not null
    and btrim(coalesce(p_email, '')) <> ''
    and lower(u.email) = lower(btrim(p_email))
    and u.id <> (select auth.uid())
  limit 1;
$$;

comment on function public.find_partner_by_email(text) is
  'Partner search by exact sign-in email (case-insensitive, trimmed). No row: no such account, or the caller. is_taken = false: id and display_name of an unlinked account. is_taken = true: the account already has a partner; id and display_name are null.';

revoke execute on function public.find_partner_by_email(text) from public, anon;
grant execute on function public.find_partner_by_email(text) to authenticated;

commit;
