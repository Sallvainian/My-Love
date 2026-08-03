-- photos bucket overwrite permission (PH-DB-001 .. 004)
--
-- photoService.uploadPhoto uploads with `upsert: true` against a path derived
-- from the caller's idempotency key. Overwriting is an UPDATE on
-- storage.objects, and the bucket originally granted only INSERT/SELECT/DELETE,
-- so every retry -- the exact case the stable path exists to serve -- was
-- rejected by RLS. Unit tests cannot see this: their storage fake models the
-- duplicate-path rule but not the policies.
--
-- These assert the policy itself rather than driving an upload, because the
-- storage API is not reachable from pgTAP.

begin;

select plan(4);

select policies_are(
  'storage',
  'objects',
  array[
    'Users can upload own photos',
    'Users can read own photos',
    'Partners can read partner photos',
    'Users can delete own photos from storage',
    'Users can update own photos in storage',
    'Users upload own love note images',
    'Users read own love note images',
    'Partners read partner love note images',
    'Users delete own love note images'
  ],
  'PH-DB-001: storage.objects carries exactly the nine expected policies'
);

-- The regression this guards: an UPDATE policy scoped to the photos bucket must
-- exist, or `upsert: true` fails on every retry.
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'UPDATE'
      and policyname = 'Users can update own photos in storage'),
  1,
  'PH-DB-002: the photos bucket grants UPDATE'
);

-- Assert the predicate, not merely that one exists. The folder scoping is the
-- entire security content of the policy, and it carries more weight here than
-- it looks: "Partners can read partner photos" makes a partner's storage rows
-- SELECT-visible to the caller, so this USING clause is the only thing stopping
-- one partner renaming the other's object into their own folder via
-- POST /object/move. A policy relaxed to `using (true)` would satisfy a
-- mere not-null check.
select is(
  (select qual
     from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own photos in storage'),
  '((bucket_id = ''photos''::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))',
  'PH-DB-003: the UPDATE policy is scoped to the caller''s own folder in the photos bucket'
);

-- Postgres reuses USING as the WITH CHECK for UPDATE when WITH CHECK is
-- omitted, so this is not what stops a row escaping its folder -- USING alone
-- would already do that. It is asserted because the migration states both
-- explicitly, and a later edit that changed only one of them would otherwise
-- go unnoticed.
select is(
  (select with_check
     from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own photos in storage'),
  '((bucket_id = ''photos''::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))',
  'PH-DB-004: the WITH CHECK predicate matches the USING predicate'
);

select * from finish();

rollback;
