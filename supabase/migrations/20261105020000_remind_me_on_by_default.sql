-- Remind me is on by default.
--
-- Owner decision 2026-11-05: a date's "Remind me" switch (the month-before and
-- week-before reminders) starts on. Before this a row in countdown_marks meant
-- on and a missing row off; now a missing row is on and a row records the
-- person's choice in `reminds`. Every row written before this one meant on, so
-- the column defaults to true and those rows keep their meaning; no row is
-- rewritten or deleted.
--
-- The app turns a date off by inserting a row with reminds = false (after
-- deleting any row for that key) and on by deleting the row, so there is still
-- no UPDATE and no UPDATE policy. An installed shell that predates this, until
-- its live update lands, inserts rows with the default (on) and deletes rows to
-- turn a date off, which now reads as on.
--
-- Hosted catalog read 2026-11-05: exactly the three policies of
-- 20261101010000_countdown_marks.sql and select, insert, delete for
-- authenticated. Pinned by supabase/tests/database/38_countdown_marks.sql.

begin;

alter table public.countdown_marks
  add column if not exists reminds boolean not null default true;

comment on table public.countdown_marks is
  'One row per date whose Remind me (month-and-a-week-before reminders) a person set; a missing '
  'row is on. Private to its owner. Pinned by supabase/tests/database/38_countdown_marks.sql.';

comment on column public.countdown_marks.reminds is
  'false: the person switched this date''s Remind me off. true (rows from before Remind me '
  'defaulted on, 2026-11-05): on, the same as no row.';

commit;
