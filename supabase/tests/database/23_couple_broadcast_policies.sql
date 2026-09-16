-- ============================================
-- pgTAP: directional RLS on the couple broadcast topics (F2/F3)
--
-- 20260912010000_private_couple_broadcast_policies.sql adds the two policies
-- that make `love-notes:<uuid>` and `mood-updates:<uuid>` private topics:
-- receive only on your own topic, send only to your current partner's topic.
--
-- What this file proves is the shape of the policy set after a fresh replay --
-- that both policies exist, are scoped to the right command, and are restricted
-- to `authenticated` rather than PUBLIC. Behavioural proof (an outsider's join
-- rejected, a partner's send delivered, anon denied) needs a real Realtime
-- websocket, which pgTAP cannot open; that lives in
-- tests/api/couple-broadcast-authorization.spec.ts.
--
-- The policies_are assertion lists the two couple policies on purpose.
-- Adding, renaming or dropping any realtime.messages policy must fail here
-- until this array is updated in the same change.
-- ============================================

begin;

select plan(10);

select policies_are(
  'realtime',
  'messages',
  array[
    'couple_broadcast_recipient_can_receive',
    'couple_broadcast_partner_can_send'
  ],
  'realtime.messages carries exactly the two couple policies'
);

select policy_cmd_is(
  'realtime'::name,
  'messages'::name,
  'couple_broadcast_recipient_can_receive'::name,
  'SELECT',
  'the couple receive policy is SELECT only (receivers get no send grant from it)'
);

select policy_cmd_is(
  'realtime'::name,
  'messages'::name,
  'couple_broadcast_partner_can_send'::name,
  'INSERT',
  'the couple send policy is INSERT only -- a sender never gets blanket SELECT across partner topics'
);

-- `to authenticated`, not PUBLIC: anon holds no EXECUTE on get_my_partner_id,
-- so a PUBLIC policy would surface a function-permission error instead of an
-- RLS denial.
select policy_roles_are(
  'realtime'::name,
  'messages'::name,
  'couple_broadcast_recipient_can_receive'::name,
  array['authenticated'],
  'the couple receive policy is restricted to authenticated'
);

select policy_roles_are(
  'realtime'::name,
  'messages'::name,
  'couple_broadcast_partner_can_send'::name,
  array['authenticated'],
  'the couple send policy is restricted to authenticated'
);

-- The text comparison is the fail-closed part: a topic segment that is not a
-- UUID must not raise 22P02 during policy evaluation, so the predicate must
-- carry no ::uuid cast at all.
--
-- Asserted against the parsed, normalised expression Postgres stores, but only
-- on the substrings that carry the meaning. Pinning the exact deparsed spelling
-- (`(( SELECT auth.uid() AS uid))::text`) would fail on a PG version that
-- reformats it, with nothing about the policy's behaviour having changed. The
-- absence of `::uuid` is the durable half and is checked exactly.
select ok(
  strpos(
    (select qual from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_recipient_can_receive'),
    'split_part(topic'
  ) > 0
  and strpos(
    (select qual from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_recipient_can_receive'),
    'auth.uid'
  ) > 0
  and strpos(
    (select qual from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_recipient_can_receive'),
    '::uuid'
  ) = 0,
  'the receive predicate compares the topic segment against auth.uid() with no ::uuid cast that could raise 22P02'
);

select ok(
  strpos(
    (select with_check from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_partner_can_send'),
    'get_my_partner_id'
  ) > 0
  and strpos(
    (select with_check from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_partner_can_send'),
    '::uuid'
  ) = 0,
  'the send predicate resolves the partner through public.get_my_partner_id(), with no ::uuid cast'
);

-- The topic-prefix guard is what SCOPES these policies. Without it the receive
-- policy grants read on ANY realtime topic whose second segment is your id,
-- and the send policy write to any topic whose second segment is your
-- partner's. Every other assertion in this file still passes with those two
-- `like` clauses deleted, so they are pinned here.
select ok(
  strpos(
    (select qual from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_recipient_can_receive'),
    'love-notes:%'
  ) > 0
  and strpos(
    (select qual from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_recipient_can_receive'),
    'mood-updates:%'
  ) > 0,
  'the receive predicate is scoped to the two couple topic prefixes'
);

select ok(
  strpos(
    (select with_check from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_partner_can_send'),
    'love-notes:%'
  ) > 0
  and strpos(
    (select with_check from pg_policies
      where schemaname = 'realtime'
        and tablename = 'messages'
        and policyname = 'couple_broadcast_partner_can_send'),
    'mood-updates:%'
  ) > 0,
  'the send predicate is scoped to the two couple topic prefixes'
);

-- PERMISSIVE, not RESTRICTIVE. policies_are, policy_cmd_is and policy_roles_are
-- are all indifferent to this, so a policy declared `as restrictive` would pass
-- every assertion above while AND-ing itself against the other couple policy
-- and denying traffic the matching PERMISSIVE policy would have allowed.
select is(
  (select array_agg(permissive order by policyname) from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname in (
        'couple_broadcast_recipient_can_receive',
        'couple_broadcast_partner_can_send'
      )),
  array['PERMISSIVE', 'PERMISSIVE'],
  'both couple policies are PERMISSIVE, so neither AND-s against the other'
);

select * from finish();

rollback;
