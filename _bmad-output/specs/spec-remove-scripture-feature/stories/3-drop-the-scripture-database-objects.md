---
title: 'Drop the scripture database objects'
type: 'chore'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: c0d4faaa00787e5365dbbde2df37b54df52439a7
context: []
warnings:
  - oversized
deferred:
  - summary: >-
      tests/support/helpers/scripture-cache.ts and reflection.ts remain
      on disk with zero live importers; scripture-cache still calls
      indexedDB.deleteDatabase('my-love-db').
    evidence: |-
      Story 1 leftover test helpers. tsconfig.test.json includes tests/
      but nothing imports these files, so typecheck stays green. Story 1
      owns leftover helper deletion.
    location: >-
      tests/support/helpers/scripture-cache.ts
    severity: low
  - summary: >-
      tests/api/check-constraint-error-mapping.spec.ts still inventories
      scripture_reflections among uncovered CHECKs after the envelopes
      comment was updated to 13 rows.
    evidence: |-
      Sibling comment in check-constraint-envelopes.ts was amended in
      this story. tests/api/ is an epic leave-alone (story 1 invoke);
      the API spec comment is now stale relative to the dropped table.
    location: >-
      tests/api/check-constraint-error-mapping.spec.ts:93-95
    severity: low
  - summary: >-
      rls-security.ts and persisted-blob.ts comments still name
      scripture after the DB objects are gone.
    evidence: |-
      rls-security.ts:4 still says "scripture RLS security E2E tests";
      persisted-blob.ts:17 still cites ./scripture-cache.ts. Story 1
      leftover comment surgery; live callers are non-scripture.
    location: >-
      tests/support/helpers/rls-security.ts:4
    severity: low
---

<intent-contract>

## Intent

**Problem:** Scripture tables, functions, enums, and four `realtime.messages` policies still exist after the app surface is gone. Dedicated pgTAP is mostly deleted, but two scripture files and several exact-set assertions still pin that schema.

**Approach:** Append one forward drop migration (do not delete creating migrations), drop the four realtime policies, repair shared pgTAP, add `love_notes`/`users` `policies_are` coverage from local names after reset, then regenerate `database.types.ts`. Destroy the data; do not re-ask.

## Boundaries & Constraints

**Always:**
- One new migration after `20260912030000_profile_name_email_ownership.sql` (latest on disk). Suggested name: `20260916000000_drop_scripture.sql`. The August slot after `20260818000001` is taken by `20260818000002_create_events_table.sql`.
- Drop realtime policies first (they do not fall off with `DROP TABLE`), then trigger, then the 12 functions using GRANT signatures, then tables child→parent, then the 4 enums.
- FN-GRANT-008 remainder is exactly `'accept_partner_request, decline_partner_request, get_my_partner_id',`
- Delete FN-GRANT-003/004 and FN-GRANT-007 in the same edit (`has_function_privilege` **errors 42883** on a missing function; it does not return false). `plan(21)` → `plan(18)`.
- After `supabase db reset`, `select policyname from pg_policies where tablename in ('love_notes','users')` and assert **those** names. If local and production disagree, stop and report; do not paper over.
- Drop objects, then `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`. Never hand-edit that file.
- Same-commit compile-graph: leftover typed callers of dropped RPCs/tables fail `npm run typecheck` (`tsconfig.test.json` includes `tests/`). If story 1 already removed them, skip.

**Never:**
- Do not delete any file under `supabase/migrations/`. Do not edit existing migrations (leave the freeze-trigger comment at `20260912030000:136-138`).
- Do not re-litigate data loss. Production 2026-08-19: 64 sessions (2 completed), 18 step states, 5 reflections, 3 bookmarks, 0 messages; Sallvain declined export.
- Do not drop `public.users`, `public.partner_requests`, `get_my_partner_id()`, `accept_partner_request`, `decline_partner_request`. Do not `CASCADE` onto those.
- Do not touch `src/services/dbSchema.ts` (story 4), `tests/api/`, or `tests/e2e-archive/`.
- Do not keep FN-GRANT-003/004/007 against dropped functions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh reset | New drop migration in `supabase/migrations/` | No scripture tables, functions, triggers, or enums; four scripture `realtime.messages` policies gone | Reset must not 42883 on surviving `GRANT EXECUTE` in `20260818000000:271-294` |
| FN-GRANT-008 | Authenticated EXECUTE names in `public` | Exact string `accept_partner_request, decline_partner_request, get_my_partner_id` | Extra or missing name fails the test |
| Types regen | `supabase gen types typescript --local` | `public.Enums` is `[_ in never]: never`; no scripture tables/functions | Never hand-edit the file |
| Policy coverage | `pg_policies` for `love_notes` and `users` after reset | New pgTAP `policies_are` matches that local set | On local vs production name drift: stop and report |
| Dropped-function grant probe | FN-GRANT-003/004/007 removed | File does not call `has_function_privilege` with a text signature of a dropped function | Leaving them is 42883, not a red `ok()` |

</intent-contract>

## Code Map

Re-verified 2026-09-16 on `c0d4faaa00787e5365dbbde2df37b54df52439a7`. Inventory line numbers still match.

**New migration** `supabase/migrations/20260916000000_drop_scripture.sql` (sorts after latest `20260912030000_profile_name_email_ownership.sql`; 38 files today, none is a drop).

DROP order and signatures (GRANT block `20260818000000:271-294`; trigger not in that block):

1. Policies on `realtime.messages`: `scripture_session_members_can_receive_broadcasts`, `scripture_session_members_can_send_broadcasts` (`20260220000001:70,85`); `scripture_presence_members_can_receive_broadcasts`, `scripture_presence_members_can_send_broadcasts` (`20260222000001:300,315`).
2. Trigger `scripture_sessions_freeze_membership` on `public.scripture_sessions` (`20260818000001:314`), then `public.scripture_sessions_freeze_membership()`.
3. Functions: `public.is_scripture_session_member(uuid)`, `public.scripture_seed_test_data(int, boolean, boolean, text, int[], uuid, uuid)`, `public.scripture_create_session(text, uuid)`, `public.scripture_get_couple_stats()`, `public.scripture_submit_reflection(uuid, int, int, text, boolean)`, `public.scripture_select_role(uuid, text)`, `public.scripture_toggle_ready(uuid, boolean)`, `public.scripture_convert_to_solo(uuid)`, `public.scripture_lock_in(uuid, int, int)`, `public.scripture_undo_lock_in(uuid, int)`, `public.scripture_end_session(uuid)`.
4. Tables: `public.scripture_messages`, `public.scripture_reflections`, `public.scripture_bookmarks`, `public.scripture_step_states`, `public.scripture_sessions`.
5. Enums: `public.scripture_session_mode`, `public.scripture_session_phase`, `public.scripture_session_status`, `public.scripture_session_role` (`20260220000001:18`, lowercase, easy to miss).

**pgTAP deletes:** `supabase/tests/database/01_schema.sql` (`plan(34)`, 100% scripture), `02_rls_policies.sql` (`plan(14)`, 100% scripture). The 12 dedicated files (`03`–`13`, `19`) are already gone.

**Shared pgTAP:**
- `18_function_execute_grants.sql:29` `plan(21)` → `plan(18)`. Delete `:93-103` (FN-GRANT-003/004) and `:158-161` (FN-GRANT-007). Replace `:128-132` with the three-name remainder. Reword comments at `:108` (seed-test-data grant-drift story), `:141-143` ("every scripture read return 42501"), `:154-157`. Keep FN-GRANT-001/002/005/006/009 and Parts 2/3.
- `23_couple_broadcast_policies.sql:25-37` shrink to `couple_broadcast_recipient_can_receive` and `couple_broadcast_partner_can_send`. Reword `:15-18`, `:129` ("scripture topics included"), `:167-181` (PERMISSIVE vs scripture). **`plan(10)` stays.**
- `00_helpers.sql:65-90` delete only `tests.create_session_as_admin`. **Keep `:16-59`** (`create_test_user` / `authenticate_as` / `reset_role`). `plan(1)` stays.
- `15_love_notes_idempotency.sql:9` drop the `(matches 03_scripture_rpcs.sql)` parenthetical; keep the rollback fact.

**New file** `supabase/tests/database/26_love_notes_and_users_policies.sql`: `policies_are` for `love_notes` and `users` using names from `pg_policies` after reset. House style: `20_events.sql:110-112` or `24_interactions_partner_only.sql:55-63`. Do not copy names from migrations — `20251206024345` added a second love_notes generation without `DROP POLICY`. `25_profile_name_email_ownership.sql:28-31` still notes no file pins the users set.

**Types:** `src/types/database.types.ts:665-681` — four scripture enums are the only `public.Enums` entries; regen must yield `[_ in never]: never`. Functions `:608-663` are the scripture RPCs plus the three partner RPCs that stay.

**Compile-graph (skip if story 1 already removed):**
- `tests/support/factories/index.ts` — delete `SeedResult` / `createTestSession` / `cleanupTestSession` and scripture table/`rpc` calls (`:147`, `:253-257`). **Keep `TypedSupabaseClient` (`:16`).**
- `tests/support/fixtures/index.ts` — delete `testSession` (`:49,69,89-102`). **Keep `supabaseAdmin` (`:47,73`).**
- `tests/integration/example-rpc.spec.ts` — **rewrite against `events`**, do not delete (directory also has `claude-bot-config-forward-migration.spec.ts`).
- `tests/support/check-constraint-envelopes.ts:73` — drop `scripture_reflections` from the uncovered list.

**Leave alone:** every existing file under `supabase/migrations/`; `src/services/dbSchema.ts`; `tests/api/`; `tests/e2e-archive/`.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/20260916000000_drop_scripture.sql` -- add forward drop in the order in Code Map -- CAP-2; surviving `20260818000000:271-294` GRANTs need the functions to exist during replay
- `supabase/tests/database/23_couple_broadcast_policies.sql` -- shrink `policies_are` to the two couple policies; reword scripture comments; keep `plan(10)` -- CAP-4
- `supabase/tests/database/01_schema.sql` and `02_rls_policies.sql` -- delete -- leftover dedicated pgTAP
- `supabase/tests/database/18_function_execute_grants.sql` -- FN-GRANT-008 remainder; delete 003/004/007; `plan(18)`; reword comments -- CAP-4; avoids 42883
- `supabase/tests/database/00_helpers.sql` -- delete `create_session_as_admin` only -- helper inserts into dropped tables
- `supabase/tests/database/15_love_notes_idempotency.sql` -- drop `03_scripture_rpcs.sql` parenthetical -- stale pointer
- `supabase/tests/database/26_love_notes_and_users_policies.sql` -- after `supabase db reset`, `select policyname from pg_policies where tablename in ('love_notes','users')`; compare production if reachable and **stop on drift**; add `policies_are` for those local names -- replacement coverage (Sallvain 2026-08-19)
- `src/types/database.types.ts` -- regenerate with the gen-types pipeline after the drop; never hand-edit -- CAP-1 types cleanliness
- `tests/support/factories/index.ts`, `tests/support/fixtures/index.ts`, `tests/integration/example-rpc.spec.ts`, `tests/support/check-constraint-envelopes.ts` -- skip if gone; else delete scripture factory/fixture surface (keep `TypedSupabaseClient` / `supabaseAdmin`), rewrite example-rpc against events, drop `scripture_reflections` from the comment -- typecheck compile-graph after regen

**Acceptance Criteria:**
- Given a fresh `supabase db reset`, when the schema is inspected, then no `scripture_*` tables, functions, triggers, or enum types remain, and the four scripture `realtime.messages` policies are gone.
- Given `18_function_execute_grants.sql`, when FN-GRANT-008 runs, then the authenticated EXECUTE set is exactly `accept_partner_request, decline_partner_request, get_my_partner_id`.
- Given `23_couple_broadcast_policies.sql`, when `policies_are` runs, then `realtime.messages` lists only the two couple policies.
- Given regenerated `src/types/database.types.ts`, when `public.Enums` is read, then it is `[_ in never]: never`.
- Given the new pgTAP file, when it runs against a reset local DB, then `love_notes` and `users` policy arrays match `pg_policies` from that reset.

## Spec Change Log

## Review Triage Log

### 2026-09-16 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 9, false 6, maybe-false 0
- findings:
  - `[low]` `[defer]` `scripture-cache.ts` / `reflection.ts` still on disk with zero importers; cache helper still `deleteDatabase('my-love-db')` — Story 1 leftover; typecheck does not import them
  - `[low]` `[patch]` `factories/index.ts` header still described RPC seed helpers after the file was reduced to `TypedSupabaseClient` — reworded the header
  - `[low]` `[patch]` `factories/events.ts` still said it mirrored `resolveAppUserIdByEmail` in `./index.ts` — dropped the dangling pointer; `resolveAppUserId` stays in events.ts
  - `[low]` `[patch]` `25_profile_name_email_ownership.sql:28-31` still said no file pins the users policy set — pointed the comment at `26_love_notes_and_users_policies.sql`
  - `[low]` `[defer]` `tests/api/check-constraint-error-mapping.spec.ts:93-95` still names `scripture_reflections` after the envelopes comment was updated — epic leave-alone for `tests/api/`
  - `[low]` `[patch]` `26_…sql` comment claimed `20251206024345` added a second love_notes generation without `DROP POLICY` — false; dump drops the own-notes policies at `:7-11`; reworded
  - `[false]` `[reject]` hosted project ref in `26_…sql` is a new public leak — `xojempkrugifnaveqtqc` already sits in `vitest.config.ts:13` and other tracked files; ref was removed from the comment anyway
  - `[false]` `[reject]` rewritten `example-rpc.spec.ts` INT-002 is weaker than scripture FK-order cleanup — events analogue is seed/assert/delete via `coupleEvents`; FK-order was scripture-table specific
  - `[low]` `[reject]` `20260818000000:273-274` still points at `factories/index.ts:147` — intent forbids editing existing migrations
  - `[false]` `[reject]` `26_…sql` omits `hasnt_trigger` and the four realtime policy names — `23_couple_broadcast_policies.sql` `policies_are` pins realtime to the two couple policies; trigger dies with `scripture_sessions`; trigger function is in `hasnt_function`
  - `[low]` `[defer]` `rls-security.ts:4` and `persisted-blob.ts:17` still name scripture — Story 1 leftover comments; live callers are non-scripture
  - `[false]` `[reject]` `CASCADE` on `is_scripture_session_member` might touch shared objects — post-reset `users` / `partner_requests` / partner RPCs remain; table drops have no `CASCADE`
  - `[false]` `[reject]` Always bullet says 12 GRANT-signature functions vs 11 in the GRANT block — fix would be editing this spec
  - `[false]` `[reject]` `26_…sql` does not pin `policy_cmd_is` — intent asked for `policies_are` names after reset, not command types
  - `[low]` `[reject]` `26_…sql` mixes love_notes/users `policies_are` with CAP-2 `hasnt_*` under one `plan(23)` — split is more than a direct correction; 222 pgTAP tests pass

## Auto Run Result

Status: done

Summary: Forward drop migration removes the five scripture tables, twelve functions, freeze trigger, four enums, and four `realtime.messages` policies. Shared pgTAP exact-set assertions match the empty schema. Generated types have `public.Enums: [_ in never]: never`. Leftover typed callers of the dropped RPCs were stripped so typecheck passes. Production vs local `love_notes`/`users` policy names matched; no drift.

Files changed:
- `supabase/migrations/20260916000000_drop_scripture.sql` — forward drop after `20260912030000`
- Deleted `01_schema.sql` and `02_rls_policies.sql`
- `18_function_execute_grants.sql` — FN-GRANT-008 remainder; 003/004/007 gone; `plan(18)`
- `23_couple_broadcast_policies.sql` — two couple policies; `plan(10)` kept
- `00_helpers.sql` — `create_session_as_admin` gone; keep 16-59
- `26_love_notes_and_users_policies.sql` — local `policies_are` plus CAP-2 `hasnt_*`
- `src/types/database.types.ts` — regenerated, not hand-edited
- Compile-graph: factories/fixtures/example-rpc/envelopes
- Review patches: factory headers, `25_profile` pointer, `26` dump comment

Review findings: 4 patch (all low comments), 3 deferred (Story 1 leftovers / `tests/api/`), 8 rejected. Follow-up review: false.

Verification:
- `supabase db reset` — exit 0; drop applied last; no 42883
- inspect after reset — 0 scripture tables/functions/types/policies; `love_notes`/`users` names match `26_…sql`
- `supabase test db` — Files=13, Tests=222, PASS
- `npm run typecheck` — exit 0

Residual risks: Story 1 helpers (`scripture-cache.ts`, `reflection.ts`) and `tests/api/` comment still name scripture. IndexedDB stores remain until story 4. Hosted drop happens when this migration is applied to production.

## Design Notes

`DROP TABLE` does not remove policies on `realtime.messages`. `DROP FUNCTION` / `has_function_privilege(..., 'public.scripture_seed_test_data(int, ...)', 'EXECUTE')` raises 42883 if the function is already gone — that is why 003/004/007 are deleted, not flipped to `not ok`.

Do not copy love_notes/users policy names from migrations. Remote dump `20251206024345` added a second love_notes generation with no `DROP POLICY`; local after reset is the contract.

Do not `CASCADE` table drops onto `public.users`. Child→parent table order is enough.

`tests/e2e-archive/` still names `testSession`; it is excluded from `tsconfig.test.json` and must not be edited.

## Verification

**Commands:**
- `supabase db reset` -- expected: exit 0 (no 42883 on scripture GRANTs during replay)
- `supabase test db` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0
