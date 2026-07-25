-- Grant the PostgREST API roles explicit DML on public, instead of relying on
-- Postgres default privileges to supply it.
--
-- Why this exists
-- ---------------
-- Nothing in this repo has ever granted table privileges. Every table's grants
-- came from the default privileges that Supabase's Postgres image installs for
-- the `public` schema. That worked until the image changed them.
--
-- Supabase CLI 2.109.1 ships two default-ACL entries for `public`:
--
--   FOR ROLE supabase_admin  -> arwdDxtm  (full) to anon, authenticated, service_role
--   FOR ROLE postgres        -> Dxtm      (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN only)
--
-- Migrations run as `postgres`, so every table created by this repo picks up the
-- second rule and lands with no SELECT/INSERT/UPDATE/DELETE for the API roles.
-- PostgREST then answers every request with 42501 "permission denied for table
-- users" — including requests made with the service_role key, because grants are
-- checked before RLS and service_role's BYPASSRLS does not bypass a missing grant.
--
-- CI pins the CLI to 2.77.1 (.github/actions/setup-supabase), whose defaults are
-- still generous, so this only bites a local stack on a newer CLI. Granting
-- explicitly makes the schema self-sufficient either way.
--
-- Safety
-- ------
-- This does not widen real access. Every table in `public` has RLS enabled, and
-- a grant is not a bypass: anon and authenticated remain confined to their
-- policies, and a table with RLS on and no policies (claude_bot_config) stays
-- deny-all to them. This is Supabase's normal posture — broad grants, RLS as the
-- gate — and matches what the hosted platform already applies.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Cover tables created by later migrations, so this does not have to be
-- re-applied every time the schema grows.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
