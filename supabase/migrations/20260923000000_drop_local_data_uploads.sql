-- Forward drop of public.local_data_uploads, the receipt table of the retired
-- one-time upload of each device's local data.
--
-- The creating migration (20260922000000_local_data_tables.sql) stays on disk:
-- a reset replays it, then this drops the table. DROP TABLE takes the table's
-- two policies, its index and its grants with it; nothing else references the
-- table, so there is no CASCADE.
--
-- anniversaries, custom_messages and message_favorites stay. client_key stays
-- too: the in-app creates still send it, so only its comment changes.

begin;

drop table if exists public.local_data_uploads;

comment on column public.anniversaries.client_key is
  'Idempotency key: one per submit, reused on its retry, for in-app creates.';

commit;
