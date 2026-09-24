-- Birthdays and the wedding date (spec-unified-data-storage, story 4).
--
-- * public.users.birthday: each person's own birthday, a plain date. It lives
--   on the person's row rather than on couple_settings because it belongs to
--   one person and exists before linking. The existing users SELECT policy
--   already admits only self and partner, so the partner reads it and nobody
--   else does.
-- * public.couple_settings.wedding_date: the couple's shared wedding date, a
--   plain date either partner sets, changes or clears (NULL). The existing
--   couple_settings policies already admit the pair only.
--
-- The client writes its own birthday through a COLUMN grant. Table-level UPDATE
-- on public.users was revoked in 20260912030000_profile_name_email_ownership.sql
-- (display_name and updated_at are the only other columns granted), and
-- users_update_self_safe keeps the rows to the caller's own. No other users
-- column is opened by this migration.
--
-- Nothing is seeded: no birthday or wedding date goes into a migration.
-- Pinned by supabase/tests/database/25_profile_name_email_ownership.sql and
-- 28_couple_settings.sql.

begin;

alter table public.users add column if not exists birthday date;

comment on column public.users.birthday is
  'The person''s own birthday (a plain date). Set by its owner in Settings; '
  'readable by self and partner through the users SELECT policy.';

grant update (birthday) on public.users to authenticated;

alter table public.couple_settings add column if not exists wedding_date date;

comment on column public.couple_settings.wedding_date is
  'The couple''s wedding date (a plain date). NULL until one partner sets it, '
  'and cleared by writing NULL.';

commit;
