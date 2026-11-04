-- ============================================
-- Settings rework, story 5.18 (DW-416): drop push_preferences.dates
--
-- The second of DW-416's two deploys. Story 5.4 (20261103000000) stopped every
-- date change from sending a push and stopped the client reading or writing
-- this column, but kept it: installed shells still selected and upserted it,
-- and a select that names a missing column fails the whole read. Nothing has
-- read it since. Owed before the PR to main merges (deploy.yml applies
-- migrations before the site): the owner confirms both phones run 5.4's update
-- or later, and the hosted catalog for push_preferences is re-read, read-only,
-- for anything added since 2026-11-04 that depends on the column.
--
-- == What goes ==
--   * push_preferences.dates, with the comment 20261103000000 put on it.
-- Every other switch, the policies, the grants and the primary key stay.
--
-- == Hosted catalog ==
-- Read read-only on 2026-11-04: the column is present (boolean, default true),
-- no function, view, trigger or index depends on it, and the three own-row
-- policies do not name it. The drop is still `if exists`, so a stack where
-- the column is already missing runs this clean.
--
-- pgTAP: supabase/tests/database/36_push_preferences.sql pins the six
-- remaining switches; 35_push_devices.sql pins the column's absence.
-- ============================================

begin;

alter table public.push_preferences drop column if exists dates;

commit;
