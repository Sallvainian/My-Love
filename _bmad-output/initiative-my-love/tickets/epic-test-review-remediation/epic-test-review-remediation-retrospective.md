---
epic: epic-test-review-remediation
date: 2026-10-29
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: Test Review Remediation

## Epic summary

**Epic:** `epic-test-review-remediation` (initiative `initiative-my-love`), the only epic in the initiative. The epic file's `status:` is still `in-progress`. Closing it is Sofia's (`bmad-agent-po`) job, with the owner's confirmation.

**Tickets** (`tickets.py status`, build order): all 13 are `status: done`, `state: done`. `pending_tickets` is empty. No ticket is left at `built`.

| Ref | Title | Covers |
|---|---|---|
| 1.1 | Make every test able to fail | R1 |
| 1.2 | Remove clock, timing and async nondeterminism | R2 |
| 1.3 | Wait for data before interacting in e2e specs | R2 |
| 1.4 | Isolate tests and make cleanup failure-proof | R3 |
| 1.5 | Drive component tests through user-event | R4 |
| 1.6 | Adopt playwright-utils in Playwright specs | R5 |
| 1.7 | Build test data through factories and name magic values | R6 |
| 1.8 | Fix names, selectors, markers and test structure | R6 |
| 1.9 | Split oversize test files | R6 |
| 1.10 | Fix the 2026-10-03 tests/unit findings | R1, R6 |
| 1.11 | Fix the 2026-10-03 tests/e2e and tests/api findings | R1, R2, R6 |
| 1.12 | Fix the 2026-10-03 src findings | R6 |
| 1.13 | Fix the 2026-10-28 tests/unit and src High findings and tests that cannot fail | R1, R3 |

**The epic ran in two phases.**
- **Phase 1 (2026-09-25 to 2026-09-26):** bmad-loop run `20260925-162226-e69b` built stories 1–9 on a loop-local `main`. They landed on main as the single squash commit `c2933427` (PR #375).
- **Between the phases:** five more PRs landed outside the ticket tree: #376 (`273fbf2c`), #377 (`6be94f31`), #385 (`37f863ef`), #386 (`254dbd93`) and #387 (`bab5120e`).
- **Phase 2 (2026-10-28 to 2026-10-29):** the epic was reopened at `6aaa29f3`. Run `20261028-211538-d302` built 1.10–1.12, which landed through PR #404 (`6103e00a`, one squash commit per story: `7a97aebb`, `f0453e06`, `04acfef7`). PR #405 (`419236e5`, DW-301) followed. Run `20261029-001352-2222` built 1.13, which landed through PR #406 (`fbab584a`: `d0f47e48`, `12ff94a1`, `d01d3370`).

**Plan ranges.** Every baseline from 1.2 to 1.12 is a loop merge commit that is not an ancestor of main. Those objects survive only as unreachable commits, so the ranges below were measured on the loop histories. The last range of each run ends at that run's final story merge, found with `git fsck --unreachable`. Ranges are inferred, not recorded. Commands: `git_evidence.py --range <range> --stories <ref>`.

| Ref | Range | Commits (merges) | Files | +/− (non-merge) |
|---|---|---|---|---|
| 1.1 | `e11e6a87..ba713da4` | 2 (1) | 58 | +2196 / −1121 |
| 1.2 | `ba713da4..ad5115cd` | 2 (1) | 60 | +1962 / −833 |
| 1.3 | `ad5115cd..dfc30d5a` | 3 (1) | 35 | +1201 / −163 |
| 1.4 | `dfc30d5a..95f6f427` | 2 (1) | 23 | +860 / −167 |
| 1.5 | `95f6f427..00ab451d` | 2 (1) | 43 | +1386 / −883 |
| 1.6 | `00ab451d..ae2b37b4` | 2 (1) | 39 | +1301 / −481 |
| 1.7 | `ae2b37b4..744ef0f7` | 2 (1) | 76 | +1722 / −1664 |
| 1.8 | `744ef0f7..116b0cc7` | 2 (1) | 129 | +5179 / −1919 |
| 1.9 | `116b0cc7..e4ac1ae6` (end inferred: the story-9 loop merge) | 2 (1) | 63 | +14466 / −10607 |
| 1.10 | `4ac86ac6..119d4780` | 2 (1) | 22 | +507 / −134 |
| 1.11 | `119d4780..c92214a7` | 2 (1) | 20 | +177 / −44 |
| 1.12 | `c92214a7..39052eff` (end inferred: the 1.12 loop merge) | 2 (1) | 23 | +342 / −116 |
| 1.13 | `a709d500..d01d3370` (end inferred: PR #406's branch head, which includes two review follow-ups) | 3 (0) | 25 | +351 / −57 |

In every range `merges_measured` equals `merge_count`. No range has binary revisions. Across all ranges, 298 distinct paths changed. On main the landed code diff is `cfee8209..bab5120e` (349 files, +33355 / −20183, including unrelated dependency and partner PRs) plus `4ac86ac6..fbab584a` (77 files, +821 / −356).

**Evidence inventory**

| Evidence | Status |
|---|---|
| Epic file, `corrections.md`, the `findings-2026-10-03-*.md` and `findings-2026-10-28-unit-src.md` companions, `.memlog.md` | Read |
| 13 plans | Read: frontmatter for all; the build-record sections for 1.10–1.13; Verification and Review Triage for 1.2 and 1.4. Plans 1.1, 1.3 and 1.5–1.9 were read only for frontmatter and deferred entries. |
| Story files | None. Every `find` returns `story_file: null`; the entries' descriptions and the plans are the specs. |
| Fresh TEA reports, `_bmad-output/test-artifacts/test-review/` | Read: 2026-10-28 for tests/e2e and for tests/api + tests/integration; 2026-10-29 for src and tests/unit. The reports are **gitignored and overwritten on every run**, so the evidence for Done when 1 survives only on this machine and in this document. |
| `deferred-work.md` | Read: the epic-linked entries DW-255 to DW-301 and the five open entries. |
| Previous retrospective | None exists (see Previous-retro follow-through). |
| Session logs | **Not read.** The loop transcripts under `.bmad-loop/runs/` and `archive/` were not opened. Process lessons come from the plans, `.memlog.md`, the ledger and git history only. |
| CI | `gh run list --branch main`: Tests, Deploy, CodeQL and Lighthouse all `success` at `fbab584a`. |

## Findings

Dispositions: **fix now** becomes an action item; **defer** goes to the ledger; **accept** records a deviation so later retros stop flagging it. Each entry also gives the upstream lesson where there is one. Findings that came from the review lenses were re-checked against the files at HEAD, and the checks are noted.

### Spec-to-implementation reconciliation

- **S1. Done when 1 is met.** The fresh reports give 0 Critical / 0 High on every folder:
  - `test-review-target-tests-e2e.md:115`: 0C / 0H / 1M / 1L
  - `test-review-target-tests.md:121` (tests/api + tests/integration, per `:37`): 0C / 0H / 1M / 1L
  - `test-review-target-src.md:101`: 0C / 0H / 5M / 9L
  - `test-review-target-tests-unit.md:98`: 0C / 0H / 3M / 15L

  Every in-scope row is recorded as fixed:
  - 1.10: 30 rows.
  - 1.11: 22 rows.
  - 1.12: 21 rows.
  - 1.13: 12 High rows and the advisory notes A1–A7. Each note has a recorded break-and-fail (plan 1.13, Implementation Notes).

  That is 73 rows across 1.10–1.12, matching the 69 folder rows plus 4 suite rows. *Disposition: accept.*
- **S2. Done when 2 was spot-checked, not proven.** About 30 of the roughly 40 `corrections.md` items were checked against HEAD, and every one checked is resolved. Some of the checks:
  - `error-boundary.spec.ts:34` now forces a module throw.
  - `couple-broadcast-authorization.spec.ts:494,523` asserts instead of logging.
  - `dateFormat` and `moodGrouping` no longer contain `expect(true)`.
  - `swMoodSync` lets `fireBackgroundSync` reject.
  - `partnerService.check` no longer uses the `requests.length` premise.
  - `MessageInput` now uses `user.keyboard('{Shift>}{Enter}{/Shift}')`.
  - `handler.ts:381` derives `Retry-After` from `RATE_LIMIT_WINDOW_MS`.
  - `offlineMessageHonesty.test.ts:146-147` pins the counts.

  Not re-checked one by one: the four false-positive items, `EventsSettings.test.tsx:1493` and `EventsSettings.focus.test.tsx:363`, and `useNetworkStatus.test.ts:321-341`. *Disposition: accept, with that narrowing recorded.*
- **S3. Done when 3 is met.** CI is green on main at `fbab584a`. *Disposition: accept.*
- **S4. The R3 success clause "a full e2e run leaves behind no rows it created" was verified narrowly.** Plan 1.4 checked only three `love_notes` content prefixes, and only across the changed specs (its Verification section: "counts … stayed at 16/34/42"). PR #377 later moved cleanup into fixture teardown, but nobody has audited a full run across tables. *Disposition: defer. Lesson: a success clause needs a command that checks it, or the plan should say which part it narrows.*
- **S5. Fixes in 1.11 weakened what three tests prove, against the Constraint that a fix "keeps or strengthens what a test proves".**
  - `tests/e2e/offline/network-status.spec.ts:25,32,45,50`: `toBeVisible` became `toHaveText` alone, so a hidden indicator now passes.
  - `tests/e2e/navigation/kit-chrome.spec.ts:55`: the wordmark text lost its visibility check.
  - `tests/e2e/settings/settings-kit.spec.ts:56-57` and `tests/e2e/partner/partner-connect.spec.ts:382,420`: a case-insensitive, page-wide `getByText` became a case-sensitive `not.toContainText` on one container. Confirmed in `git show f0453e06`.

  The 1.11 commit also claims "absence checks use test ids", but these checks still match copy text. *Source: edge-case and adversarial lenses, re-checked. Disposition: fix now (A1). Lesson: the review step should diff each replaced assertion for what it no longer covers.*
- **S6. Accepted deviation from plan 1.2:** the e2e clock anchor comes from the live clock's day, at or behind real time, never from a fixed date. The plan's Review Triage Log gives the reasons: a fixed date "would put the page clock arbitrarily far behind server timestamps and collide unique created_at rows across reruns", and a clock ahead of the session makes supabase-js refresh the token (plan 1.2, Implementation hints). *Disposition: accept; proposed as a decision record (D1).*

### Diff-scope review (bmad-review: adversarial, edge-case and verification-gap lenses)

Scope narrowing: the lenses ran on the phase-2 code diff only (`4ac86ac6..fbab584a` excluding `_bmad-output`: 3101 diff lines, 77 files, covering tickets 1.10–1.13 and PR #405). The phase-1 diff (349 files, more than 53k changed lines) was not lens-reviewed in this retro. Since it landed, it has been re-reviewed by five TEA rounds (2026-09-26, 10-01, 10-03 and 10-28/29) and by the per-PR reviews of #375–#387. The full lens output is in the session. Findings that cross ticket boundaries are marked ⟷.

- **R1. ⟷ 1.10 / #405: the DW-301 duplicate came back.** 1.10 (`7a97aebb`) strengthened `'throws OfflineError when offline'` to `toMatchObject({ name, operation: 'save', message })`. That makes `'includes operation name in thrown error'` (`tests/unit/utils/offlineErrorHandler.test.ts:130-136`) a subset of it. PR #405 closed DW-301 for the `OfflineError` describe only. The same file still hard-codes the offline message at `:21` and `:174`, even though it imports `OFFLINE_RETRY_MESSAGE`. *Source: verification-gap and adversarial lenses, re-checked. Disposition: fix now (A2); reopen or annotate DW-301.*
- **R2. ⟷ 1.10 / src: the same constant name has two values.** `tests/unit/stores/moodSlice.test.ts:260-261` defines `PARTNER_MOOD_LIMIT = 10` with the comment "Partner Mood's row limit". The view uses 30 (`PartnerMoodView.tsx:99,193`), and `PartnerMoodView.kit.test.tsx:31` defines `PARTNER_MOOD_LIMIT = 30`. The case never asserts that the limit reaches `fetchMoods`. *Disposition: fix now (A3).*
- **R3. Assertions that prove less than their names claim:**
  - `AdminPanel.accountData.test.tsx:262-265` checks only that an alert exists, not its text.
  - `upload-love-note-image-limits.spec.ts:134` asserts `remaining < MAX`, which holds by construction, so a counter that never decrements passes. Commit `f0453e06` calls this "pinned to exact values".
  - `LoveNoteMessage.test.tsx` cannot observe the retry's `forceRefresh` argument. Plan 1.13 already lists this as a residual risk.
  - `PokeKissInterface.test.tsx`'s new `useState` spy has no positive control while the component is mounted.
  - `loaderIdentityGuards.events.test.ts`'s `JSON.stringify(state)` leak check cannot see an `Error`, `Map` or `Set`.

  *Disposition: defer (A4). These are Medium or Low tier beyond the reports in scope.*
- **R4. Fragile fixtures:**
  - `events.spec.ts:142-144` hard-codes the plural `days`, so `daysFromNow: 2` would fail against a correct "1 day".
  - `notesSlice.idempotency.test.ts` reads `tempId` before the drain settles.
  - `usePhotoImage.test.ts` shares one hoisted `PHOTO` object across tests.
  - `photoImageCache.test.ts`'s settle probe depends on private coalescing in the module.
  - `settleNameLookups` waits forever if the own-name lookup rejects.

  *Disposition: defer (A4).*
- **R5. Inconsistent pinning of one contract:** `login.spec.ts:135` uses `toHaveCount(0)` for `login-screen`, while `bootstrap-notification-order.spec.ts:188,218` still uses `not.toBeVisible()`. *Disposition: defer (A4).*

### Duplication map

- **D-dup1. ⟷ 1.12 / 1.10 / 1.13: three photo-row builder patterns.** Six src files spread `{ ...createPhotoInsert(...), ...keys }`, all with an unexplained `file_size: 68`. `photosSlice.localCopy.test.ts` casts with `as SupabasePhoto`, and `loaderIdentityGuards.photos` uses a third variant.
- **D-dup2. Four verbatim copies of the hoisted `vi.mock('react')` `useState` observer:** `EventsSettings.pagination`, `EventsSettings.lifetime`, `PokeKissInterface` and `LoveNoteMessage` (`grep -l "vi.mock('react'"`).
- **D-dup3. SQLSTATE constants declared file by file:** `CHECK_VIOLATION_CODE`, `NOT_NULL_VIOLATION`, `INSUFFICIENT_PRIVILEGE` and `CONNECTION_FAILURE`. `'23514'` and `'08006'` still appear as literals in files this epic touched.
- **D-dup4. `loadFailure()` was adopted in only three EventsSettings files** (1.12). Five siblings still build `{ status: 'failure', error }` by hand.
- **D-dup5. `settleNameLookups()` is pasted into two files** (`OwnDisplayName.test.tsx` and `LoveNotes.realtimeStatus.test.tsx`).
- **D-dup6. The store list is duplicated:** `dbSchema.v15MessageData.test.ts` hard-codes the list `storageSchema.test.ts` holds as `ALL_STORES`.
- **D-dup7. Ten hand-rolled IndexedDB opens across nine e2e specs** read stores that `tests/support/helpers/local-copy.ts` `savedLocalCopy` cannot read (`note-queue`, `image-cache`, `moods`, `messages`). Three of them (`logout.spec.ts:28`, `love-notes-offline-send.spec.ts:52`, `photos-offline.spec.ts:61`) skip the `indexedDB.databases()` guard the helper documents.

*Disposition for all: defer, as one refactor story (A5). Lesson: when a story is split by folder, the shared fixtures and constants each side will need belong in a named support module in the spec, so two sessions do not each invent one.*

### God-class / size growth

- Ranked on `files`, the largest net growth comes from 1.9's splits. Examples: `loaderIdentityGuards.photos.test.ts` +649, `loaderIdentityGuards.customMessages.test.ts` +647 and `useRealtimeMessages.retriedJoin.test.ts` +563. Each is a new file carved out of an oversize one, so it is not growth.
- The largest test files at HEAD (`wc -l`) are `tests/unit/stores/eventsSlice.test.ts` (991), `signOutClearsAccountState.test.ts` (907), `needs-a-connection.spec.ts` (880) and `LoveNoteMessage.test.tsx` (862). All are under R6's 1000-line limit. `eventsSlice.test.ts` grew from 954 to 991 during the epic and is 9 lines from the limit. *Disposition: accept (R6 met); watch it.*
- Files touched by the most tickets: `notesSlice.offlineQueue.test.ts` (7 tickets), then `EventsSettings.test.tsx`, `LoveNoteMessage.test.tsx`, `useRealtimeMessages.test.ts`, `events.spec.ts`, `dbSchema.test.ts` and `signOutClearsAccountState.test.ts` (6 each). This is churn from rule-by-rule slicing, and it is why one file's rows took several sessions. *Lesson below (P4).*

### Architecture delta

- App code changed only as the Constraints allow. Phase 2 changed 5 app files with attribute-only test hooks (+20 / −6: `LoginScreen`, `MoodTracker`, `AppNavigation`, `LoveNotes`, `MessageInput`). Phase 1's PR #375 changed 27 app files: test ids plus three bug fixes (the DST-safe day label in `moodGrouping.ts`, the badge spring, and `Retry-After` from the window constant). No new module dependencies or layering changes. No dependency-graph tool was run; this view was derived from `git diff --stat` on the non-test `src` paths.
- **A-arch1. The bug-fix commit rule is lost on main.** PR #375 is one `test:` commit, and the three app fixes inside it are not separate `fix(...)` commits, against the Constraint "A bug fix is a separate commit named as a fix" (`git log -1 c2933427`). *Disposition: accept for history; lesson P3.*

### Pattern divergence

- **P-div1. `stalePersistedMood()` still defaults `anchor: Date = new Date()`** (`tests/support/helpers/persisted-blob.ts:180`), and `persisted-events-strip.spec.ts:214` relies on that default. This is the wall-clock default PR #387 removed from `isoDateDaysFromNow` and `seedEvent`. *Disposition: defer (A5).*
- **P-div2. Commit granularity differs from what the plans claim.** Every plan prescribes "one commit per finding group", and the plans cite those commits (for example `50d962e8`, `81f3055b` and `a7279406`). The loop folds each story into one `story N: implemented and reviewed via bmad-loop` commit (for example `38d25fa2`, parent `4ac86ac6`), so every cited SHA exists only off main. *Lesson P3.*

### Process (from the plans, the memlog, the ledger and git; session logs not read)

- **P1. The epic was first closed without running its own gate.** `.memlog.md` (2026-10-28 source-change event) says "Done when 1 … is not met although all 9 stories and the epic were marked done". Five ad-hoc PRs followed (#376, #377, #385, #386, #387), with no ticket or plan, before the epic was reopened at `6aaa29f3`.
- **P2. The gate's evidence is not durable.** The fresh TEA reports are gitignored and overwritten on each run (`.memlog.md`, 2026-10-28 decision). Nothing tracked records that the 2026-10-28/29 runs reported 0 Critical / 0 High, apart from this retrospective.
- **P3. Commit history does not match the specs.** The commit granularity the specs require (P-div2, A-arch1) is erased twice: first by the loop's per-story commit, then by squash merges.
- **P4. Plan size.** 12 of 13 plans carry `warnings: ['oversized']` (`grep '^warnings:'`). The only exception is 1.11. The folder-based split in phase 2 still left two of its three stories oversized. AGENTS.md already says "Keep loop story specs short and split large ones".
- **P5. Reviewer variance moved the target.** `.memlog.md` notes that src went from 9 to 21 rows between runs after every row was fixed. The owner changed Done when 1 from "zero findings" to "no Critical or High" (epic Notes, 2026-10-28). This was the correct reconciliation and is recorded here as an accepted deviation from the original R-clauses.

## Behavior verification

- **Exercised:**
  - `npm run test:unit` on HEAD `fbab584a`: 197 files, 3090 tests passed (exit 0).
  - `npx vitest run --sequence.shuffle --sequence.seed=20261029`: 197 files, 3090 tests passed (exit 0). This supports R3's "unit suites pass in shuffled order" for one more seed. CI already runs the suite shuffled through `test:unit:coverage` (`package.json:21`, fixed in PR #376 for DW-269).
- **Not exercised in this retro:**
  - The e2e and api suites. Local Supabase was not started. The evidence for them is CI's `Tests` workflow, green on the push to main at `fbab584a`; per AGENTS.md, pushes to main run every stage.
  - The app at runtime. Phase-2 app changes are attribute-only test hooks. The three phase-1 app fixes (the DST day label, the badge spring, `Retry-After`) were not exercised in a browser.
  - A full e2e run's leftover rows (S4).

## Previous-retro follow-through

There was nothing to follow through: no previous retrospective file exists. This is the initiative's only epic (`tickets.py status` lists one epic), and no `*retrospective*` file exists anywhere under `_bmad-output/`.

## Action items

Remediation items and spec reconciliations below are **proposed, not applied**.

| # | Kind | Action | Owner |
|---|---|---|---|
| A1 | Remediation (fix now) | Restore what 1.11 weakened (S5). Add `toBeVisible()` beside `toHaveText` in `tests/e2e/offline/network-status.spec.ts:25,32,45,50` and `tests/e2e/navigation/kit-chrome.spec.ts:55`. Make the absence checks in `settings-kit.spec.ts:56-57` and `partner-connect.spec.ts:382,420` case-insensitive (`/…/i`). | dev loop (`bmad-build`) |
| A2 | Remediation (fix now) | In `tests/unit/utils/offlineErrorHandler.test.ts`, fold `'includes operation name in thrown error'` into `'throws OfflineError when offline'` as a second operation, and replace the literals at `:21` and `:174` with `OFFLINE_RETRY_MESSAGE`. Annotate DW-301 to say the `withOfflineCheck` describe had the same overlap. | dev loop; ledger note by the owner |
| A3 | Remediation (fix now) | In `tests/unit/stores/moodSlice.test.ts:260`, rename `PARTNER_MOOD_LIMIT` (for example to `NON_DEFAULT_LIMIT`), correct its comment, and assert `fetchMoods` is called with `('partner-uuid', NON_DEFAULT_LIMIT)`. | dev loop |
| A4 | Remediation (defer) | Add ledger entries for R3, R4 and R5: alert text, rate-limit decrement, `forceRefresh`, the PokeKiss positive control, the `JSON.stringify` leak check, the day plural, the `tempId` read, the shared `PHOTO`, the photoImageCache probe, `settleNameLookups` rejection, and the `login-screen` contract. | Sofia (`bmad-agent-po`) |
| A5 | Remediation (defer) | One refactor story for the duplication map (D-dup1 to D-dup7) and P-div1: shared photo-row factories, a react-state-spy module, a SQLSTATE constants module, `loadFailure` adoption, a love-notes test kit, a shared `ALL_STORES`, a generic IndexedDB store reader with the existence guard, and a required anchor for `stalePersistedMood`. | Sofia |
| A6 | Spec reconciliation | Settle the four open epic deferrals against the fresh reports. **DW-260** (no H1/H2/M6/M1 row in any 2026-10-28/29 report), **DW-263** (the e2e report has no M1 row) and **DW-279** (the e2e and api reports have no M9 or L9 rows) can close. **DW-276**: the src report now scores two M5 rows (`DisplayNameSetup.test.tsx:90`, `kitSurfaces.test.tsx:409`), which are Medium rows outside the epic's Boundaries; re-scope it or close it as out of scope. | owner, through Sofia |
| A7 | Spec reconciliation | Record in the epic file's Notes the fresh-review run dates and totals that met Done when 1 (S1), because the reports are gitignored (P2). Then close the epic. | Sofia, with owner confirmation |
| A8 | Remediation (defer) | Add a post-run audit that counts rows created by the e2e worker pool across the seeded tables, to close the full-run part of R3 (S4). | Sofia to ticket |
| L1 | Process lesson | Run the epic's Done-when gate before marking an epic done, and send follow-up fixes through tickets rather than ad-hoc PRs (P1). | owner |
| L2 | Process lesson | Either drop "one commit per finding group" and "separate fix commit" from loop story specs, or keep the per-group commits on main (for example with loop-archive refs and a non-squash PR merge), so the plans' cited SHAs resolve (P3). | owner (loop and PR policy) |
| L3 | Process lesson | Size stories by row count and shared files, not by folder. Name the shared support modules (factories, constants, kits) in the spec when two stories will both need them (P4, D-dup). | Sofia |
| L4 | Process lesson | In review, compare each replaced assertion with its replacement for anything it no longer covers: visibility, case, scope (S5). | owner (review guidance) |

## Decision records

- **D1 (proposed, not written).** `adr-e2e-page-clock-anchors-at-the-live-day.md`, to sit beside `tests/support/helpers/events.ts`.
  - **Context:** R2 requires that no asserted value derives from the live clock.
  - **Decision:** e2e specs install a page clock anchored at or behind real time and derived from the live day. They do not use a fixed calendar date.
  - **Why (from plan 1.2):** a fixed date "would put the page clock arbitrarily far behind server timestamps and collide unique created_at rows across reruns" (Review Triage Log). A clock ahead of the session makes supabase-js refresh the token (Implementation hints, citing the `events-read-window.spec.ts` header). Asserted relations such as day counts and "today" are fixed relative to the anchor, so they cannot flip mid-run.
  - **Sources:** plan `story-remove-clock-timing-and-async-nondeterminism-plan.md`; loop commit `2daf8ace`, landed in `c2933427`.
  - **Status:** headless run, so proposed only. No file was written.
- No other decision in the plans' intent contracts, Design Notes or Implementation Notes passed the test of being hard to reverse, surprising and a real trade-off. The Done when 1 rewrite (P5) is a planning decision and is already recorded in the epic file's Notes.

## Acceptance verdict

**accepted-with-open-items** (criteria **declared**: the epic file's Requirements R1–R6 and Done when 1–3).

- Every ticket is finished (`pending_tickets` is empty).
- Done when 1 is met (S1), Done when 2 is met on the items checked (S2, narrowing recorded), and Done when 3 is met (S3).
- R6's 1000-line limit holds: the largest test file is 991 lines. R3's shuffled-order clause holds on CI's shuffled run and on this retro's run.
- No blocking finding stands. These remain open:
  - The three assertion weakenings and recurrences the epic itself introduced (A1–A3).
  - The narrowly verified full-run clause of R3 (S4, A8).
  - The deferred assertion-strength and duplication items (A4, A5).

Because these are named and routed, and none contradicts a Done when criterion, the verdict is accepted with open items rather than rejected. No human decision was taken, so this is the machine verdict.

## Open questions

- Should A1–A3 reopen this epic as a story 14? Or do they go to the backlog, given that the Boundaries put new Medium and Low rows out of scope? A1 is a breach of a Constraint, not a new row, which argues for fixing it under this epic.
- Should the passing fresh-review totals be committed somewhere durable (A7), or is this retrospective the intended record?
- Does the owner want the phase-1 diff (`cfee8209..bab5120e`) lens-reviewed as well? This retro narrowed the lens review to phase 2.
- The loop session transcripts were not read. If process lessons about *why* sessions diverged matter (for example why 1.11 swapped `toBeVisible` for `toHaveText`), they are the only source.

## Assumptions

- **Epic resolution:** `-H epic-test-review-remediation` matched the slug in `tickets.py status` `epics`. The folder is the parent of `epic_file` from `find 1.1`: `_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/`.
- **pending_tickets:** empty, so the verdict was not forced to rejected.
- **Ranges:** baselines 1.2–1.12 are not on main. Ranges were measured on the surviving unreachable loop commits, and the end points of 1.9, 1.12 and 1.13 were inferred (see Epic summary). 1.13's range includes the two PR-review follow-ups (`12ff94a1`, `d01d3370`), which name no ticket but landed on that ticket's PR.
- **Narrowed review scope:** the bmad-review lenses ran on the phase-2 diff only. The phase-1 diff was judged through later TEA re-reviews instead.
- **Machine verdict:** `accepted-with-open-items`, rendered without a human decision.
- **Proposed items:** A1–A8 and L1–L4 are proposals; none was applied. Decision record D1 is proposed and was not written.
- **Owner naming:** "owner" means the repository owner, per the public-repo rule.
- **Nothing else was written:** no status change, no `tickets.py mark`, no edit to the epic file, any plan or the ledger.
