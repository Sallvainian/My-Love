-- Table for storing Claude bot test credentials
-- Only accessible via service role (no RLS policies = no anon/authenticated access)
CREATE TABLE IF NOT EXISTS claude_bot_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE claude_bot_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role can read/write

INSERT INTO claude_bot_config (key, value) VALUES
  ('test_email', 'claude-bot@test.example.com'),
  ('test_password', '7fCRFw0t4d0GjV6QEObE4yns4TZQsMcM'),
  ('partner_email', 'claude-bot-partner@test.example.com')
ON CONFLICT (key) DO NOTHING;
