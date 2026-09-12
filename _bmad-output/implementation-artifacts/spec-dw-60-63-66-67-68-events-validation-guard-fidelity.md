---
title: 'DW-60/63/66/67/68 Events validation guard fidelity'
type: 'chore'
created: '2026-09-12'
status: 'done'
baseline_revision: 'bded91377e088a11f60811282822b298e2d6a7f6'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      EventsSettings counts UTF-16 code units while PostgreSQL char_length counts Unicode characters.
    evidence: |-
      The unchanged submit handler uses trimmedLabel.length and trimmedDescription.length.
      Measured 100 repeated emoji have JavaScript length 200 and PostgreSQL char_length 100,
      so the form rejects some values admitted by the existing database CHECK. This predates
      this bundle, which explicitly preserves production validation. The new boundary tests
      characterize the existing limits with ASCII and do not establish Unicode equivalence.
    location: >-
      src/components/Settings/EventsSettings.tsx:689
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The events drift guard reads an original migration, silently drops non-letter icon values, and compares constants without proving that the form uses those limits. A later constraint or validation-branch change can leave the guard green.

**Approach:** Compare the installed PostgreSQL CHECK constraints after the complete migration chain with a shared test contract, and compare the form declarations with that same contract. Exercise actual form submissions at and immediately above both length limits.

## Boundaries & Constraints

**Always:** Preserve production validation: label maximum 100, description maximum 500, current icons and trimming behavior. Preserve historical story acceptance criteria. Keep the guard active in existing Vitest and pgTAP runners. Retain every icon string or fail explicitly on unsupported representation. Compare the entire effective CHECK set, detecting added, dropped, and replaced constraints.

**Never:** Edit the deferred-work ledger, historical story specs, production code, generated files, or archived E2E. Parse only the original migration, silently skip unsupported syntax, or introduce a database requirement for ordinary unit tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current schema | All migrations applied, unchanged form | Both guard layers agree on the same test contract | No error |
| Later migration | Replace, drop, or add an events CHECK | Catalog comparison fails against shared contract | Diagnostic reports effective versus expected definitions |
| Icons | Database-only or UI-only value such as party-hat, uppercase, digits, underscore, or escaped quote | Complete value participates in comparison; mismatch fails | Unsupported representation fails explicitly |
| Exact limits | Submit valid date and 100-character label or 500-character description | One exact payload reaches store and saved row appears | No field error; dialog closes |
| Beyond limits | Submit label 101 or description 501 | Field error and no write; dialog stays open | Existing limit message |
| Retained constants | Branch tightened or loosened while declarations remain unchanged | Boundary tests fail | Test identifies changed accepted/rejected input |

</intent-contract>

## Code Map

- `tests/unit/components/eventsValidationMirrors.test.ts:38` -- currently reads one migration and regex-extracts private UI constants/icons; replace database source with shared contract and complete literal extraction.
- `supabase/tests/database/21_events_validation_contract.sql` (new) -- tagged JSON literal is the single shared test contract. Derive a temporary expected table's CHECKs from it, then compare PostgreSQL catalog definitions with all installed `public.events` CHECKs.
- `src/components/Settings/__tests__/EventsSettings.test.tsx:634` -- existing validation suite, store double mutates rows; reuse `renderSection`, `openAddForm`, `fillForm`, `submitForm`, `currentEvents` and exact spy payload assertions.
- `src/components/Settings/EventsSettings.tsx:99,683` -- read-only constants and real submit branches trim then check lengths; `ICON_OPTIONS` is private, no production exports needed.
- `supabase/migrations/20260818000002_create_events_table.sql:19` -- read-only original constraints; complete migration chain must determine actual tested schema.
- `.github/workflows/test.yml:108,140` and `.github/actions/setup-supabase/action.yml` -- read-only independent unit and database CI jobs; fresh Supabase startup applies migrations, pgTAP discovers SQL tests. No CI reconfiguration needed.
- `vitest.config.ts` -- discovers component/unit tests without Docker. TypeScript and Zod are already installed if strict extraction needs them.
- `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md` -- historical acceptance criteria remain untouched.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/tests/database/21_events_validation_contract.sql` -- add transactional pgTAP guard using a tagged JSON contract and PostgreSQL-normalized expected CHECK definitions; compare entire set with installed catalog without relying on constraint names.
- [x] `tests/unit/components/eventsValidationMirrors.test.ts` (and a test-only helper under `tests/support/` if needed) -- consume the same contract, extract complete UI literals, fail explicitly on unsupported shapes, and test punctuation/escaping and unsupported extraction cases.
- [x] `src/components/Settings/__tests__/EventsSettings.test.tsx` -- add independent exact-boundary acceptance cases and retain/improve immediate-over-limit rejection cases at the component submission surface.
- [x] Same test files -- demonstrate discrimination against later ALTER CHECK replacements/additions/removals and retained-constant branch mutations, using rolled-back database changes and restored local source mutations; record evidence in this spec.

**Acceptance Criteria:**
- Given the complete migration chain, when Vitest mirror and pgTAP catalog guard run, then both pass against the shared contract and a later CHECK change makes the catalog guard fail.
- Given a new icon with non-letter characters on either side, when its full value is extracted and compared, then disagreement fails instead of omitting that icon; unsupported representations produce explicit failures.
- Given the rendered EventsSettings form, when exact-limit and limit-plus-one inputs are submitted, then acceptance saves the exact payload and renders the row while rejection shows the field error without a write.
- Given unchanged declarations but changed length-validation branches, when these component tests run, then both stricter and looser mutations are detected.
- Given the final diff, when checks complete, then production, historical acceptance criteria, and the ledger are unchanged, and typecheck/lint plus relevant tests pass.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 10 findings — high 0, medium 1, low 3, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` Exact-limit cases omitted whitespace-padded inputs — the existing short trimming case cannot distinguish raw-length checks from trimmed-length checks at the boundary. The implementation agent retained unpadded cases and added padded variants for both limits, asserting exact trimmed payloads and rendered rows; final component suite passes 69 tests.
  - `[medium]` `[defer]` ASCII fixtures do not expose the existing UTF-16/PostgreSQL counting difference — confirmed directly: 100 emoji measure 200 JavaScript code units and 100 PostgreSQL characters. The unchanged production branches predate this change; the user requires preserving production validation. Recorded once in this spec's deferred list, without editing the ledger.
  - `[false]` `[reject]` Filtering or rejecting ring could escape all icon coverage — the unit assertion intentionally checks declarations, while active `tests/e2e/settings/events-persistence.spec.ts:169` creates a ring event through the form, waits for the write, reloads, and checks the ring selection. That existing outer-surface test fails for either proposed ring regression; all options currently render directly from ICON_OPTIONS.
  - `[false]` `[reject]` Add-only boundaries leave a current edit-specific validation path untested — both modes use the same EventForm submit handler and trimming/length branches; handleSave only routes its already-validated payload to addEvent or editEvent. Existing edit tests assert routing and payloads. No separate preprocessing or validation path exists to diverge today.
  - `[low]` `[reject]` Raw tagged-literal extraction can read a commented-out SQL contract — confirmed by wrapping the entire SQL file in a block comment. The committed file has one executable tagged literal used by the actual pgTAP comparison. A stale pass additionally requires a future test rewrite to replace the executable contract with a differently tagged source; this is unlikely in ordinary changes, and adding a SQL lexer or source-shape enforcement is more than a direct correction.
  - `[low]` `[reject]` Mutation evidence remains in temporary files instead of a committed runner — the recorded executions and exact mutations were inspected and exist, and shipped guards run in normal CI. The requested fix either edits this build spec (rejected by workflow rule) or adds a new mutation framework beyond a direct correction; infrequent evidence replay does not justify it.
  - `[false]` `[reject]` Effective-schema detection lives in pgTAP rather than standalone Vitest — this is the documented two-runner design; existing app CI runs both, with all migrations applied before pgTAP. The invocation requires effective-constraint verification but does not require a database-backed unit runner. Catalog mutations failed the actual pgTAP guard.
  - `[false]` `[reject]` Catalog comparison can reject equivalent CHECK syntax or reordered icon lists — the intent explicitly permits failure on unsupported constraint syntax. Comparing complete definitions fails visibly and conservatively instead of silently omitting admitted values; constraint names are deliberately ignored and rename-only passed.
  - `[false]` `[reject]` Icon regression fixtures parse TypeScript and JSON rather than extracting raw SQL icons — PostgreSQL compares complete installed definitions and generates expected definitions from the same JSON. Five actual SQL icon additions failed with complete values in diagnostics, and matching unusual strings passed; the old truncating SQL extraction is eliminated.
  - `[false]` `[reject]` Component boundary tests do not submit through the live store/API — the requested surface is EventsSettings component coverage. The real submit handler runs and its exact outgoing payload and visible saved row are asserted; the independent database guard verifies the effective schema. A full API round trip is not required for these validation branches.

All four review layers completed. The verification-gap layer reported no gaps and the edge-case layer returned no findings. The blind-hunter layer supplied six findings; the intent layer supplied four surface observations, each explicitly triaged above. No intent gap or bad-spec loopback remains.

## Design Notes

The guard spans the existing two CI jobs: Vitest checks UI against one JSON contract embedded in the pgTAP SQL file; PostgreSQL checks that same contract against the effective schema. A temporary expected table lets PostgreSQL normalize CHECK syntax itself, retaining complete icon strings. Equivalent but differently expressed future CHECKs may require a deliberate guard update: comparison must fail with definitions rather than silently ignore syntax. No custom migration parser or database-dependent unit test is needed.

## Verification

**Commands:**
- `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts src/components/Settings/__tests__/` -- all targeted suites pass.
- `supabase test db` -- full pgTAP suite, including new effective-schema guard, passes against applied migrations.
- `npm run typecheck` and `npm run lint` -- exit zero.
- Controlled mutation runs -- later length/icon/add/drop constraints and tighter/looser form branches fail the relevant guard; all changes roll back or restore before final verification.

**Measured implementation results (2026-09-12):**
- `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts src/components/Settings/__tests__/` -- 6 files, 139 tests passed, including 42 mirror/extraction cases and 67 cases in the main component suite.
- `supabase test db` -- 22 files, 236 tests passed. The existing local database migration history matched all 34 repository migration versions, with no missing or extra versions, before testing; no database reset was needed.
- `npm run typecheck` -- exit 0. `npm run lint` -- exit 0, with only the three existing `react-refresh/only-export-components` warnings in `EventCountdown.tsx` (lines 68, 91, 132).
- `git diff --check` -- clean. Production code, migrations, generated files, the deferred-work ledger, historical story specs, and archived E2E are unchanged.

The pgTAP test builds temporary CHECKs from the tagged JSON using PostgreSQL literal quoting and compares sorted `pg_get_constraintdef` arrays for every installed events CHECK. Array comparison retains duplicate definitions and reports both complete arrays on failure. The test-only TypeScript helper uses the compiler AST and strict JSON validation; it preserves quoted/escaped values and rejects spreads, computed properties, expressions, malformed syntax, missing/duplicate declarations, and invalid contract shapes explicitly.

**Controlled database mutations:** Each case used a temporary copy of the actual guard, with an `ALTER TABLE public.events` statement inserted after `begin`, and ran through `supabase test db <temporary.sql>`. Every copy retained `rollback`; all fields of the events CHECK catalog rows, including OIDs, names, definitions, and metadata, matched their original snapshot after each run.

| Mutation after the applied migration chain | Measured result |
|---|---|
| Replace label CHECK with `char_length(label) <= 99` | Exit 1; EV-DB-037 failed with effective/expected definitions |
| Replace description CHECK with `char_length(description) <= 499` | Exit 1; EV-DB-037 failed |
| Add each of `party-hat`, `UPPERCASE`, `icon2`, `under_score`, and `partner's` to the icon CHECK in five independent runs | All five exit 1; complete added strings appear in mismatch diagnostics |
| Add a nonempty-label CHECK | Exit 1; extra CHECK detected |
| Add a second CHECK identical to the label limit | Exit 1; duplicate CHECK detected |
| Drop the label CHECK | Exit 1; missing CHECK detected |
| Drop all three CHECKs | Exit 1; absent effective set detected |
| Rename a CHECK without changing its definition | Exit 0; names do not affect comparison |
| Expand both the icon CHECK and the temporary JSON contract with the five non-letter values | Exit 0; PostgreSQL quoting preserves every value, including the escaped quote |

Together with the unchanged baseline, these were 14 runner executions: 11 expected failures and 3 passing controls. Temporary SQL files, runner logs, catalog snapshots, and `summary.json` were saved under `/var/folders/f9/qpc_qq_n2077v8tvckxs186c0000gn/T/events-catalog-mutations-ifuj2c7y`.

**Controlled form-branch mutations:** `npx vitest run src/components/Settings/__tests__/EventsSettings.test.tsx -t 'EventsSettings validation' --reporter=json --outputFile=<temporary-report.json>` ran four times with declarations unchanged. Each source mutation was restored in a `finally` block before the next run.

| Branch-only mutation | Test that failed |
|---|---|
| Label comparison changed from `>` to `>= LABEL_MAX_LENGTH` | Exact 100-character label acceptance |
| Description comparison changed from `>` to `>= DESCRIPTION_MAX_LENGTH` | Exact 500-character description acceptance |
| Label comparison changed to `> LABEL_MAX_LENGTH + 1` | 101-character label rejection |
| Description comparison changed to `> DESCRIPTION_MAX_LENGTH + 1` | 501-character description rejection |

Each run exited 1 with exactly 1 failure, 7 passing validation cases, and 59 skipped cases. The source was restored byte-for-byte (SHA-256 `05f267da70fd0b443cfb0a4791e528cb5a246a65e53eee25a1ee07a0e5044723`), and the restored main component suite passed 67/67 before the final targeted run above. JSON reports and logs were saved under `/var/folders/f9/qpc_qq_n2077v8tvckxs186c0000gn/T/events-boundary-mutations-_9fdbznv`.

## Auto Run Result

Status: done

Implemented DW-60, DW-63, DW-66, DW-67, and DW-68 as one shared-contract guard spanning Vitest and pgTAP. The installed complete CHECK set determines database agreement after all migrations; complete icon literals are retained or rejected explicitly; form submissions prove acceptance at 100/500 (with and without surrounding whitespace) and rejection at 101/501.

Files changed:
- `tests/unit/components/eventsValidationMirrors.test.ts` — contract comparisons and strict extraction regressions.
- `tests/support/eventsValidationContract.ts` — test-only JSON validation and TypeScript AST literal extraction.
- `supabase/tests/database/21_events_validation_contract.sql` — shared contract and effective CHECK comparison.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — exact-limit acceptance, trimmed-limit variants, and retained over-limit rejection assertions.
- This spec — implementation plan, mutation evidence, review triage, and final result.

Review: one low-severity patch applied (padded boundaries), one pre-existing medium issue deferred (Unicode counting), eight findings rejected with individual reasons in the Review Triage Log. Rejections cover existing ring E2E coverage, the shared add/edit validation path, disproportionate SQL-comment parsing, temporary mutation evidence, and the four documented testing-surface choices. Patched entry counts: high 0, medium 0, low 1. Follow-up review recommended: false.

Final parent verification after the review patch:
- Targeted Vitest command — 6 files, 141 tests passed (42 mirror/extraction, 69 main component, 30 neighboring component cases).
- `supabase test db` — 22 files, 236 tests passed against all 34 applied repository migrations.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0, with the same three pre-existing EventCountdown react-refresh warnings.
- `git diff --check` — clean. Production code, migrations, generated files, historical story acceptance criteria, archived E2E, and the deferred-work ledger are unchanged.
- Parent inspected all 14 database mutation results (11 expected failures, 3 passing controls), exact catalog restoration snapshots, and all four branch-mutation JSON reports; each branch mutation failed precisely its intended boundary assertion.

Matrix audit: current schema is covered by the passing mirror and pgTAP tests; later changes by the executed replacement/addition/drop mutation cases; icons by the passing 42-case mirror/extraction suite and SQL icon mutations; exact and beyond limits by the passing component cases; retained constants by the four discriminating branch runs. Every matrix row has executed evidence and no disabled test substitutes for coverage.

Residual limits: both existing CI runners are needed for the complete guard. Catalog definitions intentionally fail on unsupported equivalent syntax. Existing UTF-16 counting behavior remains unchanged and is recorded in the deferred list. No deployment or production change is part of this work.
