---
id: SPEC-remove-scripture-feature
companions:
  - removal-inventory.md
  - ci-baseline.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Remove the Scripture Reading Feature

## Why

A pain to solve. Scripture reading is essentially never used, and Sallvain does not want the feature, yet it still ships: route, tray destination, lazy-loaded view, store slice, hooks, services, five database tables, and four IndexedDB stores. Dedicated tests are already gone — commit `820be2d2` (`test(scripture): remove the scripture reading test suites`) deleted the 14 E2E specs, 4 scripture API specs, 10+ component tests, 15 unit files, and 12 dedicated pgTAP files — and AGENTS.md records the freeze: "its tests were deleted first, so do not add, repair or extend scripture code". CAP-3 is therefore PARTIAL, not done.

The 144 of 220 E2E tests and the 381s scripture-driven shard on run `32279178457` were the original CI driver. That dedicated-test win is already banked. What remains is the running feature and the leftover shared-file, database, IndexedDB, and shard-comment surgery. Every future change to shared state, navigation, IndexedDB or RLS still has to reason around it.

The CI saving from the remaining work is bounded: each E2E job still pays ~150s of Supabase startup, and that floor does not move. See `ci-baseline.md` for the historical 381s numbers, the already-banked dedicated-test win, and what CAP-6 still has to measure.

## Capabilities

- **CAP-1**
  - **intent:** The running app offers no scripture reading anywhere — no route, no navigation destination, no view, no store slice, no hooks, no services.
  - **success:** `/scripture` resolves to the home view rather than a scripture page; the navigation tray lists six destinations, not seven; `grep -ri scripture src/` returns no matches (types regenerated, so `database.types.ts` is clean too). Re-confirmed 2026-09-15: `DESTINATIONS` in `NavigationTray.tsx:48-56` is seven including scripture; post-removal it is six.

- **CAP-2**
  - **intent:** The scripture database objects are dropped, so the schema carries no trace of the feature.
  - **success:** A fresh `supabase db reset` completes with zero scripture tables, functions, triggers or enum types present, the four scripture `realtime.messages` policies gone, and `supabase test db` passes.

- **CAP-3**
  - **intent:** Every scripture test is gone, and every shared test file that referenced scripture still passes.
  - **success:** Dedicated suites are already deleted in `820be2d2`. After leftover surgery: no scripture fixture or helper remains under `tests/` except `tests/e2e-archive/` (frozen, out of scope); `tests/api/` is untouched and green; `npm run typecheck`, `npm run lint`, `npm run test:ci-local` and `supabase test db` are all green.

- **CAP-4**
  - **intent:** The exact-set assertions that enumerate the scripture surface are corrected in the same commit as the change that invalidates them, so none of them fails in isolation.
  - **success:** Each of `18_function_execute_grants.sql` FN-GRANT-008, `dbSchema.test.ts` store-count and version assertions, `storageSchema.test.ts` `ALL_STORES`, `signOutClearsAccountState.test.ts` `EXPECTED_RESET`, and `23_couple_broadcast_policies.sql` `realtime.messages` `policies_are` passes on the first run after its paired change, with no follow-up fix commit.

- **CAP-5**
  - **intent:** Devices that already hold the four scripture IndexedDB object stores have them removed, rather than carrying them forever.
  - **success:** A profile opened at `DB_VERSION` 9 upgrades to 10 and afterwards reports exactly five object stores (`messages`, `message-favorites`, `photos`, `moods`, `sw-auth`), with the surviving stores' data intact.

- **CAP-6**
  - **intent:** The CI E2E shard layout is re-sized against the suite that actually remains after the rest of this removal.
  - **success:** A post-removal shard count is chosen from a measured green run after stories 1–4, and the decision — including the numbers it rests on — is recorded in `.github/workflows/test.yml` alongside the existing sharding rationale at lines 343-347. The 381s figure from run `32279178457` is the historical baseline, not a current measurement.

## Constraints

- **The scripture migrations must not be deleted.** Surviving migration `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:271-294` issues `grant execute on function public.scripture_*`; if the creating migrations are gone, a fresh `supabase db reset` fails with `42883 function does not exist`. Removal must be a **new forward drop migration** ordered after `20260912030000_profile_name_email_ownership.sql`. The August slot "immediately after `20260818000001`" is taken by `20260818000002_create_events_table.sql`.
- **`src/types/database.types.ts` is generated and must never be hand-edited** (AGENTS.md policy). Drop the objects first, then regenerate with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.
- **`tests/support/merged-fixtures.ts` is an import choke point.** 59 spec files import it (all remaining importers are non-scripture). Lines 21, 23, 66, 68, 82 and 84 must be edited in the same commit that deletes `fixtures/scripture-navigation.ts` and `fixtures/together-mode.ts`, or the entire Playwright suite fails at import.
- **`navigationSlice.ts:25` and `:58` must change atomically.** `pathMap` is typed `Record<ViewType, string>`, so removing the union member without the map entry — or the reverse — is a TypeScript error.
- **Removing the IndexedDB stores requires `DB_VERSION` 9 → 10 plus `deleteObjectStore` through idb's `unwrap()`**, because the typed wrapper cannot name a store absent from `MyLoveDBSchema`. The existing branches are gated on store existence, not `oldVersion < N`, so the rest of the upgrade stays correct. Surviving stores are five, not four: `messages`, `message-favorites`, `photos`, `moods`, `sw-auth`.
- **A service worker holding a v9 connection blocks the v10 upgrade, and CAP-5 must handle that explicitly.** `src/sw-db.ts:27` opens the database independently with its own `DB_VERSION` import; an installed-but-not-yet-updated worker will fire a `versionchange` blocked event. The `blocked` handler must surface a clear reload prompt rather than let the app hang or silently fail. Skipping the version bump and leaving the four orphan stores in place was considered and rejected (2026-08-19).
- **`dbSchema.test.ts` `toBe(9)` is both a store count and a version assertion.** `:73`, `:127` and `:344` are store counts and become 5. `:488` `expect(DB_VERSION).toBe(9)` becomes 10. `:106` `toBe(4)` asserts the v4 pre-scripture count and must not be touched. A blind replace of `toBe(9)` is itself the bug.
- **Shared database objects must survive:** `public.users`, `public.partner_requests`, `public.get_my_partner_id()`, `public.accept_partner_request` and `public.decline_partner_request`. Scripture reads them but does not own them.
- **The four scripture `realtime.messages` policies must be dropped explicitly.** They were created in `20260220000001` and `20260222000001` on `realtime.messages`, not on scripture tables, so `DROP TABLE` does not remove them. `23_couple_broadcast_policies.sql:25-37` pins the set of six; after the drop it must list only `couple_broadcast_recipient_can_receive` and `couple_broadcast_partner_can_send`.
- **Shared app and test code must survive:** `src/hooks/useFocusTrap.ts` has non-scripture consumers; `TypedSupabaseClient` in `tests/support/factories/index.ts:16` is imported by non-scripture specs; `supabaseAdmin` in `tests/support/fixtures/index.ts:73` is used by non-scripture specs; `tests/support/helpers/rls-security.ts` has live importers in `tests/api/` and `tests/e2e/auth/` (the 2026-08-19 delete is superseded — see below); `tests/support/helpers/index.ts` is the directory barrel and stays.
- **Do not touch `tests/api/`.** It holds 16 live non-scripture specs. Comment citations of deleted scripture files there are historical pattern pointers; leave them.
- **Do not add, repair, or delete specs under `tests/e2e-archive/`.** Frozen documentation; excluded from `tsconfig.test.json` and `tsconfig.tsr.json`; matched by no Playwright project.
- **Do not tell the loop to delete test files already removed in `820be2d2`.** The component tests under `src/components/scripture-reading/__tests__/`, the 15 scripture-named unit files, the 14 E2E specs, the 4 API specs, and the 12 dedicated pgTAP files are gone.
- **`tests/integration/example-rpc.spec.ts` is rewritten against `events`, not deleted.** `tests/integration/` already also holds `claude-bot-config-forward-migration.spec.ts`; the directory must not be left empty. (Sallvain, 2026-08-19.)
- **A new `policies_are` assertion must cover `love_notes` and `users`.** Deleting `02_rls_policies.sql` removes the scripture exact-policy-set tests. `25_profile_name_email_ownership.sql:28-31` still notes that no file pins the users policy set. The assertion must be written against the **local** policy names after `supabase db reset`; if local and production disagree, that drift is itself a finding and must be reported rather than smoothed over. (Sallvain, 2026-08-19.)
- **`tests/support/helpers/rls-security.ts` is kept.** The 2026-08-19 delete assumed its only consumer was `tests/e2e/scripture/scripture-rls-security.spec.ts`. On current main it is imported by `events-wire-contract.spec.ts`, `couple-broadcast-authorization.spec.ts`, `interaction-authorization.spec.ts`, `profile-name-email-ownership.spec.ts`, `implicit-fragment-rejection.spec.ts`, and `tests/unit/helpers/rls-security.test.ts`.
- **FN-GRANT-008 remainder is still exactly** `'accept_partner_request, decline_partner_request, get_my_partner_id'`. Re-read 2026-09-15 at `18_function_execute_grants.sql:128-132`; the list is still the three partner RPCs plus the ten scripture functions. `select plan(21);` at line 29 becomes `plan(18)` after deleting FN-GRANT-003/004 and FN-GRANT-007.
- **Story 1 is leftover shared-file surgery only.** It does not delete `tests/e2e/scripture/` (absent) and does not touch `tests/api/`.
- Branch as `<type>/<description>` and commit as `type(scope): description`; documentation-only changes get their own commit (AGENTS.md).

## Non-goals

- **No data preservation.** Sallvain explicitly chose to drop the tables rather than keep the schema, and no export is taken first. **What this destroys, measured against production on 2026-08-19:** 64 sessions (56 started by Sallvain with 1 completed, 5 by the partner with 0 completed, 3 by test accounts), 18 step states, 3 bookmarks, 0 messages — and **2 shared reflections the couple wrote to each other on 2026-03-13**, 52 and 60 characters, both rated 5. The sessions confirm the feature was essentially never used; the 2 reflections are the only personally meaningful content. **Sallvain was shown these exact figures, was offered a one-time export, and declined it on 2026-08-19** — "you don't need to export those. I'm not using the scripture feature anymore." This is settled: proceed and destroy the data, and do not re-ask.
- **Not removing partner linking.** Partner requests, `get_my_partner_id()` and the accept/decline RPCs are shared and stay exactly as they are.
- **Not removing Supabase Realtime.** Love notes, moods and partner interactions still use it; only scripture's own channels and the four scripture `realtime.messages` policies go.
- **Not changing the Supabase container exclusion list or `.github/actions/setup-supabase/action.yml`.** The ~150s startup floor is out of scope for this work.
- **Not restructuring burn-in.** Its cost tracks which specs a branch changed, not scripture; leave `test.yml`'s burn-in job alone apart from anything CAP-6 requires (including deleting the stale scripture spec names in the comment at line 414).
- **Not adding replacement functionality.** Nothing is built to fill the space scripture leaves.
- **Not re-adding a `docs/` tree** to record any of this (AGENTS.md).
- **Not touching `tests/api/`** and **not editing `tests/e2e-archive/`**.

## Success signal

A push to the branch produces a fully green CI run in which `grep -ri scripture` over `src/`, `tests/` (excluding `tests/e2e-archive/` and comment-only citations inside `tests/api/`), `supabase/tests/`, `eslint.config.js`, `playwright.config.ts`, `.github/workflows/test.yml` and `README.md` returns matches only inside the new drop migration, the pre-existing migration history, and any remaining AGENTS.md historical sentence — and the app, opened in a browser against a fresh profile, shows six navigation destinations with every surviving feature working. The measured worst-case E2E shard time from that run is recorded against the historical 381s baseline in `ci-baseline.md`.

## Assumptions

- The August estimate of a ~220s worst E2E shard versus 381s assumed ~76 surviving tests. That arithmetic is historical. Current remaining E2E is 37 spec files and 107 `test(`/`it(` matches (`find tests/e2e -name '*.spec.ts' | wc -l`; `rg -c "^\s*(test|it)\(" tests/e2e --glob '*.spec.ts'`). CAP-6 exists to replace both figures with a real number from a green run after stories 1–4.
- ~~No production user other than Sallvain and their partner has scripture data worth considering.~~ **Replaced by measurement** — see the production-data note in Non-goals; this is no longer an assumption.
- ~~The three enum types created in migrations but absent from `database.types.ts` are not live.~~ **Verified against production 2026-08-19, no longer an assumption:** `pg_type`/`pg_enum` report exactly four enums in `public`, all scripture (`scripture_session_mode`, `_phase`, `_role`, `_status`). Regeneration will correctly empty that block. Re-confirmed 2026-09-15: `src/types/database.types.ts` `public.Enums` still lists only those four.

<!-- No open questions remain. All four from 2026-08-19 were resolved by Sallvain and are recorded as constraints or in the data-preservation non-goal. The 2026-09-15 rls-security keep supersedes the August delete without re-opening it. -->
