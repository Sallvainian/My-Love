-- Table naming the Claude bot test accounts (identifiers only, never credentials)
-- Only accessible via service role (no RLS policies = no anon/authenticated access)
--
-- This file originally also seeded the bot password as a literal. That was a
-- live credential in public git history (security finding F1), so the literal
-- was removed, the password was rotated, and the value now lives only in the
-- age-encrypted fnox.toml entry CLAUDE_BOT_PASSWORD. It is applied to the hosted
-- Auth user by `fnox exec -- node scripts/provision-claude-bot.mjs`, never by
-- committed SQL. A fresh database needs no bot credential at all.
-- 20260912000000_remove_claude_bot_password_row.sql deletes the row that the
-- original version of this migration left on already-migrated databases.
CREATE TABLE IF NOT EXISTS claude_bot_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE claude_bot_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can read/write

INSERT INTO claude_bot_config (key, value) VALUES
  ('test_email', 'claude-bot@test.example.com'),
  ('partner_email', 'claude-bot-partner@test.example.com')
ON CONFLICT (key) DO NOTHING;
