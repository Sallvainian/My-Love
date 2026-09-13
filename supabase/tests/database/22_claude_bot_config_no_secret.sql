-- ============================================
-- pgTAP: claude_bot_config must never carry the bot password
--
-- Regression cover for security finding F1. The original
-- 20260316031209_create_claude_bot_config.sql seeded the live bot password as a
-- literal; that row is no longer inserted, and
-- 20260912000000_remove_claude_bot_password_row.sql deletes it on databases
-- migrated before the fix. On the fresh replay `supabase test db` runs against,
-- the DELETE finds nothing to remove, so what this file proves is the state a
-- fresh replay ends in; the hosted-row deletion is confirmed after deploy by a
-- count against the linked project. The assertions:
--
--   * the table still exists with RLS on and no policies, so the grant
--     migration's "RLS with no policies is deny-all" reasoning stays true;
--   * the two identifier rows remain and no `test_password` row exists;
--   * anon and authenticated see nothing; service_role still reads both rows.
-- ============================================

begin;

select plan(8);

select has_table('public', 'claude_bot_config', 'claude_bot_config table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.claude_bot_config'::regclass),
  'claude_bot_config has row level security enabled'
);

select policies_are(
  'public',
  'claude_bot_config',
  array[]::text[],
  'claude_bot_config has no policies (deny-all for anon and authenticated)'
);

select is(
  (select count(*)::int from public.claude_bot_config where key = 'test_password'),
  0,
  'no test_password row exists after migrations replay'
);

select is(
  (select count(*)::int from public.claude_bot_config where key in ('test_email', 'partner_email')),
  2,
  'identifier rows test_email and partner_email remain'
);

set local role authenticated;
select is(
  (select count(*)::int from public.claude_bot_config),
  0,
  'authenticated role sees no claude_bot_config rows'
);
reset role;

set local role anon;
select is(
  (select count(*)::int from public.claude_bot_config),
  0,
  'anon role sees no claude_bot_config rows'
);
reset role;

set local role service_role;
select is(
  (select count(*)::int from public.claude_bot_config),
  2,
  'service_role still reads both identifier rows'
);
reset role;

select * from finish();

rollback;
