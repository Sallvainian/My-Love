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

A pain to solve. Scripture reading is essentially never used, yet it is the single largest thing in the repository: 26,800 of 75,363 lines of `src` + `tests` (36%), 144 of 220 E2E tests (65%), all 4 API spec files, 584 unit and component test cases, and 15 database objects. Every push pays for it — the two slowest tests in the entire suite are its reconnect specs at 40.6s and 42.1s — and every future change to shared state, navigation, IndexedDB or RLS has to reason around it. Sallvain owns the product and does not want the feature. Removing it reclaims a third of the codebase and the majority of the E2E suite.

The CI saving is real but bounded, and this spec is honest about the ceiling: each E2E job pays ~150s of Supabase startup before any test runs, and that floor does not move. See `ci-baseline.md` for the measured numbers and what removal can and cannot change.

## Capabilities

- **CAP-1**
  - **intent:** The running app offers no scripture reading anywhere — no route, no navigation destination, no view, no store slice, no hooks, no services.
  - **success:** `/scripture` resolves to the home view rather than a scripture page; the navigation tray lists six destinations, not seven; `grep -ri scripture src/` returns no matches outside regenerated types.

- **CAP-2**
  - **intent:** The scripture database objects are dropped, so the schema carries no trace of the feature.
  - **success:** A fresh `supabase db reset` completes with zero scripture tables, functions, triggers or enum types present, and `supabase test db` passes.

- **CAP-3**
  - **intent:** Every scripture test is gone, and every shared test file that referenced scripture still passes.
  - **success:** `npm run typecheck`, `npm run lint`, `npm run test:ci-local` and `supabase test db` are all green with no scripture spec, fixture or helper remaining.

- **CAP-4**
  - **intent:** The four exact-set assertions that enumerate the scripture surface are corrected in the same commit as the change that invalidates them, so none of them fails in isolation.
  - **success:** Each of `18_function_execute_grants.sql` FN-GRANT-008, `dbSchema.test.ts` store-count assertions, `storageSchema.test.ts` `ALL_STORES`, and `signOutClearsAccountState.test.ts` `EXPECTED_RESET` passes on the first run after its paired change, with no follow-up fix commit.

- **CAP-5**
  - **intent:** Devices that already hold the four scripture IndexedDB object stores have them removed, rather than carrying them forever.
  - **success:** A profile opened at the previous `DB_VERSION` upgrades and afterwards reports exactly four object stores (`messages`, `photos`, `moods`, `sw-auth`), with the surviving stores' data intact.

- **CAP-6**
  - **intent:** The CI E2E shard layout is re-sized against the suite that actually remains.
  - **success:** A post-removal shard count is chosen from a measured green run, and the decision — including the numbers it rests on — is recorded in `.github/workflows/test.yml` alongside the existing sharding rationale.

## Constraints

- **The nine scripture migrations must not be deleted.** Surviving migration `20260818000000_revoke_anon_execute_and_fix_partner_guards.sql:271-294` issues `grant execute on function public.scripture_*`; if the creating migrations are gone, a fresh `supabase db reset` fails with `42883 function does not exist`. Removal must be a **new forward drop migration** ordered after `20260818000001`.
- **`src/types/database.types.ts` is generated and must never be hand-edited** (AGENTS.md policy). Drop the objects first, then regenerate with `supabase gen types typescript --local | grep -v '^Connecting to' > src/types/database.types.ts`.
- **`tests/support/merged-fixtures.ts` is an import choke point.** 42 spec files import it and 23 of them are non-scripture. Its lines 21, 23, 60 and 62 must be edited in the same commit that deletes `fixtures/scripture-navigation.ts` and `fixtures/together-mode.ts`, or the entire Playwright suite fails at import.
- **`navigationSlice.ts:24` and `:57` must change atomically.** `pathMap` is typed `Record<ViewType, string>`, so removing the union member without the map entry — or the reverse — is a TypeScript error.
- **Removing the IndexedDB stores requires `DB_VERSION` 7 → 8 plus `deleteObjectStore` through idb's `unwrap()`**, because the typed wrapper cannot name a store absent from `MyLoveDBSchema`. The existing branches are gated on store existence, not `oldVersion < N`, so the rest of the upgrade stays correct.
- **A service worker holding a v7 connection blocks the v8 upgrade, and CAP-5 must handle that explicitly.** `src/sw-db.ts:27` opens the database independently with its own `DB_VERSION` import; an installed-but-not-yet-updated worker will fire a `versionchange` blocked event. The `blocked` handler must surface a clear reload prompt rather than let the app hang or silently fail. Skipping the version bump and leaving the four orphan stores in place was considered and rejected.
- **Shared database objects must survive:** `public.users`, `public.partner_requests`, `public.get_my_partner_id()`, `public.accept_partner_request` and `public.decline_partner_request`. Scripture reads them but does not own them.
- **Shared app code must survive:** `src/hooks/useFocusTrap.ts` has seven non-scripture consumers; `TypedSupabaseClient` in `tests/support/factories/index.ts:16` is imported by non-scripture event specs; `supabaseAdmin` in `tests/support/fixtures/index.ts` is used by non-scripture specs.
- **Three tests lose their only subject and must be retargeted, not deleted:** `NavigationTray.test.tsx:132-142` is the sole test that a destination selection reports the view and closes the tray, and it clicks scripture. `tests/integration/example-rpc.spec.ts` is the only file in `tests/integration/`. `02_rls_policies.sql` holds the suite's only `policies_are` net besides `16_photos_storage_update_policy.sql`.
- **`tests/integration/example-rpc.spec.ts` is rewritten against `events`, not deleted.** It is the only file in `tests/integration/` and the repo's documented worked example for that test level; the directory must not be left empty. (Sallvain, 2026-08-19.)
- **A new `policies_are` assertion must cover `love_notes` and `users`.** Deleting `02_rls_policies.sql` removes the last exact-policy-set test outside `storage.objects`, and measured against production 11 non-scripture tables carry RLS policies with no such test. The assertion must be written against the **local** policy names after `supabase db reset`, not the production names quoted in `stories.yaml`; if the two disagree, that drift is itself a finding and must be reported rather than smoothed over. (Sallvain, 2026-08-19.)
- **`tests/support/helpers/rls-security.ts` is deleted along with its only consumer.** Its exports are domain-neutral but become uncalled, and unused test helpers drift out of sync with the suite. (Sallvain, 2026-08-19.)
- Branch as `<type>/<description>` and commit as `type(scope): description`; documentation-only changes get their own commit (AGENTS.md).

## Non-goals

- **No data preservation.** Sallvain explicitly chose to drop the tables rather than keep the schema, and no export is taken first. **What this destroys, measured against production on 2026-08-19:** 64 sessions (56 started by Sallvain with 1 completed, 5 by the partner with 0 completed, 3 by test accounts), 18 step states, 3 bookmarks, 0 messages — and **2 shared reflections the couple wrote to each other on 2026-03-13**, 52 and 60 characters, both rated 5. The sessions confirm the feature was essentially never used; the 2 reflections are the only personally meaningful content. **Sallvain was shown these exact figures, was offered a one-time export, and declined it on 2026-08-19** — "you don't need to export those. I'm not using the scripture feature anymore." This is settled: proceed and destroy the data, and do not re-ask.
- **Not removing partner linking.** Partner requests, `get_my_partner_id()` and the accept/decline RPCs are shared and stay exactly as they are.
- **Not removing Supabase Realtime.** Love notes, moods and partner interactions still use it; only scripture's own channels go.
- **Not changing the Supabase container exclusion list or `.github/actions/setup-supabase/action.yml`.** The ~150s startup floor is out of scope for this work.
- **Not restructuring burn-in.** Its cost tracks which specs a branch changed, not scripture; leave `test.yml`'s burn-in job alone apart from anything CAP-6 requires.
- **Not adding replacement functionality.** Nothing is built to fill the space scripture leaves.
- **Not re-adding a `docs/` tree** to record any of this (AGENTS.md).

## Success signal

A push to the branch produces a fully green CI run in which `grep -ri scripture` over `src/`, `tests/` and `supabase/` returns matches only inside the new drop migration and the pre-existing migration history — and the app, opened in a browser against a fresh profile, shows six navigation destinations with every surviving feature working. The measured worst-case E2E shard time from that run is recorded against the 381s baseline in `ci-baseline.md`.

## Assumptions

- Post-removal worst E2E shard is estimated at ~220s versus 381s measured today (~2.5 min saved), from the 150s setup floor plus ~76 surviving tests at 2-7s each. This is an estimate, not a measurement; CAP-6 exists to replace it with a real number.
- ~~No production user other than Sallvain and their partner has scripture data worth considering.~~ **Replaced by measurement** — see the production-data note below; this is no longer an assumption.
- The three enum types created in migrations but absent from `database.types.ts` `public.Enums` (`interaction_type`, `mood_type`, `partner_request_status`) are not live in the current schema; only the four scripture enums are, so regeneration will correctly empty that block.

<!-- No open questions remain. All four were resolved by Sallvain on 2026-08-19 and are recorded as constraints or in the data-preservation non-goal. -->
