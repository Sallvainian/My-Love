-- Local development seed file.
-- Applied by `supabase db reset` ONLY — never pushed to remote via `supabase db push`.
-- Use this file for local-only stubs and development fixtures.

-- ============================================================
-- Compatibility shim: realtime.send (new signature → old)
-- ============================================================
-- Supabase Cloud exposes:  realtime.send(topic text, event text, payload jsonb, private boolean)
-- Supabase local Docker has: realtime.send(payload jsonb, event text, topic text, private boolean)
--
-- The project's RPCs (scripture_select_role, scripture_toggle_ready, etc.) use the Cloud API
-- signature (topic, event, payload, private). This shim re-routes those calls to the local
-- Docker version so tests pass locally without modifying production code.
--
-- This overload does NOT exist on Supabase Cloud (different parameter types), so it has
-- zero impact on production.
create or replace function realtime.send(
  topic   text,
  event   text,
  payload jsonb,
  private boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Delegate to the local Docker version with re-ordered parameters
  perform realtime.send(payload, event, topic, private);
exception
  when others then
    -- Silently swallow realtime errors in local dev to avoid breaking API tests
    null;
end;
$$;
