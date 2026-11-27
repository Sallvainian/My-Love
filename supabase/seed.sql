-- Local development seed file.
-- Applied by `supabase db reset` ONLY — never pushed to remote via `supabase db push`.
-- Use this file for local-only stubs and development fixtures.

-- Push notifications (story 3.1): where the love-note trigger posts locally and
-- the shared secret it presents. Local only; the hosted project gets its own
-- values in story 3.3. The URL reaches the `send-push` function through Kong
-- from inside the Docker network, so `supabase functions serve` (or CI's
-- edge-runtime) must be running for the sender to be called at all.
insert into public.push_sender_settings (sender_url, sender_secret)
values (
  'http://supabase_kong_My-Love:8000/functions/v1/send-push',
  'local-only-push-sender-secret'
)
on conflict (singleton) do update
  set sender_url = excluded.sender_url,
      sender_secret = excluded.sender_secret;
