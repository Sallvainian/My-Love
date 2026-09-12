---
title: 'Correct source and test contract comments (DW-73, DW-77, DW-82)'
type: 'chore'
created: '2026-09-12'
status: 'done'
baseline_revision: '04ce556cad49a915ed324a1379e6ffdaae709b60'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Three file headers misdescribe existing contracts: the event persistence suite overstates reload coverage, the error-handler unit suite excludes four selective callers, and the interactions slice claims it has no cross-slice dependencies.

**Approach:** Correct these headers using the current implementations as evidence, resolving DW-73, DW-77, and DW-82 in the source-test-contract-comments bundle. Keep the work documentation-only and give it its own documentation commit.

## Boundaries & Constraints

**Always:** Verify each updated claim against its implementation. Distinguish reload assertions from observed PATCH and Settings/Home assertions; describe selective CHECK routing without implying every error uses the shared handler; name both authSlice dependencies and their actual uses. Preserve all executable source and test code. Keep the orchestrator's supplied worktree and record workflow evidence in this spec.

**Never:** Edit `_bmad-output/implementation-artifacts/deferred-work.md`, change runtime behavior or test assertions, add tests for comments, repair archived E2E specs, or expand into unrelated implementation changes. Do not claim a browser run occurred when validation only inspected code.

</intent-contract>

## Code Map

- `tests/e2e/settings/events-persistence.spec.ts` — edit the leading header. DE.5-E2E-004 and 005 call `page.reload()`; DE.5-E2E-006 observes the pass-through PATCH request's `description: null`, HTTP 200, the cleared Settings row, and Home card without reloading.
- `src/services/eventsService.ts` — read-only evidence: `getEvents` orders future rows by `event_date` and `created_at`, maps them through `toCoupleEvent`, and `updateEvent` includes defined descriptions (including null).
- `src/components/Settings/EventsSettings.tsx` — read-only evidence: form submission uses `trimmedDescription || null`, edit input uses `input.description ?? null`, and the save failure displays `saveFailure.error`.
- `tests/unit/api/errorHandlers.test.ts` — edit the leading header's caller inventory and directly related coverage wording. This suite calls the mapper directly; it does not exercise each caller integration.
- `src/api/errorHandlers.ts`, `src/api/moodApi.ts`, `src/api/interactionService.ts`, `src/services/eventsService.ts` — read-only shared SQLSTATE mapping and general database-error callers.
- `src/services/photoService.ts:396`, `src/stores/slices/notesSlice.ts:519` and `:667`, `src/api/partnerService.ts:192`, `:301`, and `:329`, `src/services/scriptureReadingService.ts:332` — read-only selective callers gated by `isPostgrestError(error)` and SQLSTATE `23514`. Photos report a mapped message through an optional callback, notes set `notesError` for send/retry, partner requests replace the original error message for send/accept/decline, and reflection submission wraps the mapped message.
- `tests/api/empty-database-error-fallback.spec.ts` — read-only evidence that other tests also assert CHECK mapping and fallback messages; avoid exclusive test-coverage claims in the edited header.
- `src/stores/slices/interactionsSlice.ts` — edit only the leading cross-slice dependency bullets. `userId` is read by sends, unviewed filtering, history loading, subscriptions and identity guards. The incoming record callback additionally compares captured `authSessionVersion`; the status callback only checks identity and subscription activity.
- `src/stores/slices/authSlice.ts:140` — read-only owner of `userId` and `authSessionVersion`; session version changes on sign-out and identity change and stays stable on same-user refresh.

## Tasks & Acceptance

**Execution:**
- [x] `tests/e2e/settings/events-persistence.spec.ts` — distinguish the two reload cases from the cleared-description PATCH and UI case in the header.
- [x] `tests/unit/api/errorHandlers.test.ts` — replace the false caller exclusion with accurate selective CHECK routing and clarify mapper-level coverage; keep any related header corrections limited to this contract.
- [x] `src/stores/slices/interactionsSlice.ts` — replace the self-contained claim with `authSlice.userId` and `authSlice.authSessionVersion`, identifying identity and incoming-record session ownership uses.
- [x] `_bmad-output/implementation-artifacts/spec-dw-73-77-82-source-test-contract-comments.md` — record validation and workflow results; include this artifact and the three header edits in a dedicated documentation commit.

**Acceptance Criteria:**
- Given the persistence suite's current tests, when a maintainer reads the header, then it attributes reload coverage to DE.5-E2E-004/005 and describes DE.5-E2E-006 as observing a null-description PATCH, successful response, and Settings/Home changes without reloading.
- Given the current mapper and caller implementations, when a maintainer reads the error-handler test header, then it identifies photos, notes, partner requests, and scripture reflections as selective `23514` callers and does not imply that these direct unit tests exercise all caller paths or that other errors use the selective routing.
- Given an isolated interactions slice fixture, when a maintainer reads the dependency header, then both authSlice fields are identified, with session ownership attributed specifically to incoming subscription records.
- Given the completed diff, when its source and test changes are inspected, then only the three leading comments differ, the deferred-work ledger is unchanged, and all changes belong to a dedicated documentation commit.

## Spec Change Log

- 2026-09-12: Completed the three header corrections without changing the intent, scope or acceptance criteria. The frontmatter lists no context files. Kept the supplied worktree and branch `bmad-loop/20260912-034111-45e0/dw-source-test-contract-comments`; this artifact accompanies the headers in the dedicated `docs(contracts): correct source and test contract comments` commit.

## Review Triage Log

- 2026-09-12: Implementation claims checked against the current source and tests. No formal review was requested or run during this implementation; no findings or deferred work were added.

### 2026-09-12 — Review pass

- The earlier entry describes the implementation handoff. The workflow subsequently completed all four review lenses. Verification-gap and edge-case reviewers returned no findings; the intent auditor found no substantive mismatch. Git history independently confirmed the dedicated documentation commit, which a unified diff alone cannot establish.
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The revised persistence header over-attributed displayed ordering to Postgres — `eventsSlice.loadEvents` calls `replayCompletedMutations`, which always calls `sortByDate`, so DE.5-E2E-005 cannot isolate server ordering. Corrected the header to describe chronological display after reload and acknowledge the slice's sort.
  - `[low]` `[patch]` The ordering coverage bullet obscured the absence of same-date tiebreak coverage — DE.5-E2E-005 creates dates 10, 25 and 40 days from one anchor, so it cannot establish `created_at` ordering among equal dates. Corrected the same bullet to limit coverage to distinct dates and separate implementation context from assertions. Grouped with the preceding finding as one coverage-attribution defect.
  - `[low]` `[patch]` The revised caller paragraph described the map as SQLSTATE-only — `errorMessages[error.code]` also handles `PGRST116` and `PGRST301`, both exercised by the unit suite. Updated the header title and paragraph to identify SQLSTATE and PostgREST error codes while retaining the selective SQLSTATE `23514` gate.
  - `[low]` `[patch]` The new session dependency note omitted lifecycle details useful to isolated fixtures — `authSlice` advances the version on sign-out and identity changes, preserves it on same-user refresh, and the interaction record callback compares the captured value. Added that lifecycle to the header so a fixture author can model same-user reauthentication and refresh correctly; existing subscription tests exercise both cases.
- Grouped patch entries: high 0, medium 0, low 3. All four findings were fixed with direct comment corrections. Deferred 0; rejected 0.

## Verification

- 2026-09-12: `git diff --check` passed with no whitespace errors.
- A byte comparison against `04ce556cad49a915ed324a1379e6ffdaae709b60`, removing only the leading `/** ... */` block from each of the three TypeScript files, passed. Every remaining byte is identical to the baseline.
- `npx eslint tests/e2e/settings/events-persistence.spec.ts tests/unit/api/errorHandlers.test.ts src/stores/slices/interactionsSlice.ts` passed (exit 0).
- Inspected DE.5-E2E-004/005 reloads and DE.5-E2E-006's observed PATCH payload, HTTP 200, Settings row and Home assertions. Confirmed `getEvents` orders future rows by `event_date`/`created_at`, maps them through `toCoupleEvent`, and `updateEvent` includes defined descriptions. Confirmed the Settings form's null conversions and `saveFailure.error` display.
- Inspected the mapper, the three general database-error callers, all four selective callers and `tests/api/empty-database-error-fallback.spec.ts`. Confirmed the selective paths require `isPostgrestError` and `23514`, and the unit suite calls the mapper directly.
- Inspected `interactionsSlice` and `authSlice`: user identity supports the listed actions and guards; the incoming-record callback additionally checks the captured auth session version, while the status callback checks only identity and activity.
- Inspected the diff: source and test changes are confined to the three leading comments. The deferred-work ledger matches the baseline byte-for-byte and has no diff. No runtime suite, browser run or production build was performed because executable code and assertions are unchanged.
- After review patches, the parent reran targeted ESLint, the baseline diff whitespace check, and the byte comparisons: all passed. The updated comments were inspected against the service, slice sorting, mapper, auth lifecycle and test assertions.

## Auto Run Result

Status: done

Implemented DW-73, DW-77 and DW-82 as documentation-only corrections. The existing dedicated documentation commit is `a196ccf4c80b2fc8d755083ce1c0ad43459fed6c`; final review corrections and this result are recorded in a subsequent documentation commit, preserving the implementation commit as required by the workflow.

Files changed:

- `tests/e2e/settings/events-persistence.spec.ts` — distinguishes reload coverage from the cleared-description PATCH and Settings/Home checks; explains distinct-date ordering coverage.
- `tests/unit/api/errorHandlers.test.ts` — documents all four selective CHECK callers and direct mapper coverage, including SQLSTATE and PostgREST codes.
- `src/stores/slices/interactionsSlice.ts` — documents auth identity and session dependencies, their callback uses and session lifecycle.
- `_bmad-output/implementation-artifacts/spec-dw-73-77-82-source-test-contract-comments.md` — records the plan, implementation evidence, review triage and completion.

Review result: four low findings, resolved in three grouped comment patches; zero deferred and zero rejected findings. All acceptance criteria passed source inspection. Follow-up review recommended: false; patched entries were high 0, medium 0, low 3, with no remaining unverified risk identified.

Verification: targeted ESLint exited 0; `git diff 04ce556cad49a915ed324a1379e6ffdaae709b60 --check` passed; every byte after the leading comment in each TypeScript file matches the baseline; the ledger matches byte-for-byte. Runtime tests and browser checks were not run because executable source and test assertions did not change. No residual implementation risk was identified; the documentation remains a snapshot of the current implementation.
