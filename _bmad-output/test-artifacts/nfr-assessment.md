---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-define-thresholds'
  - 'step-03-gather-evidence'
  - 'step-04-evaluate-and-score'
  - 'step-04e-aggregate-nfr'
  - 'step-05-generate-report'
lastStep: 'step-05-generate-report'
lastSaved: '2026-08-19'
workflowType: 'testarch-nfr-assess'
executionMode: 'sequential'
domainOutputDir: '/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20260819-133049-ee65-worktrees-dw-events-offline-message-honesty/c64ef34e-23e1-4944-b4d7-a6872f7e96aa/scratchpad/nfr'
domainOutputTimestamp: '2026-08-19T19-51-16-000Z'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/traceability-matrix.md'
  - '_bmad-output/test-artifacts/e2e-trace-summary.json'
  - '_bmad-output/test-artifacts/gate-decision.json'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - '.claude/skills/bmad-testarch-nfr/resources/knowledge/adr-quality-readiness-checklist.md'
  - '.claude/skills/bmad-testarch-nfr/resources/knowledge/nfr-criteria.md'
  - '.claude/skills/bmad-testarch-nfr/steps-c/nfr-status-definitions.md'
---

# NFR Evidence Audit - DW-7 / DW-18: offline message honesty in `interactionService`

**Date:** 2026-08-19
**Story:** `dw-events-offline-message-honesty`
**Commit under audit:** `f486587f658fa812987a277ee1e416949f4f2fbc` plus the uncommitted working tree
**Overall Status:** CONCERNS ⚠️

---

> Note: This audit summarizes existing implementation evidence. Every number below was
> measured in this session by the command cited beside it; nothing is carried over from the
> preceding `tea.td`, `tea.automate` or `tea.trace` reports without being re-run. NFR
> thresholds come from the `test-design` output's *NFR Planning* section, which is the
> primary source per this workflow's Step 2.

## Executive Summary

**Assessment:** 6 PASS, 12 CONCERNS, 0 FAIL, 5 N/A (23 findings across 4 domains)

**Blockers:** 0. No threshold is breached, no vulnerability exists, and the full suite is green.

**High Priority Issues:** 0 CRITICAL / 0 HIGH. Three MEDIUM items are listed under *Recommended Actions*.

**Recommendation:** **CONCERNS — ship, then close the evidence gaps.** The change does what
it set out to do and every measurement taken is favourable. The CONCERNS verdict is driven
almost entirely by the workflow's own default rule: *an unmeasured target cannot pass*. Four
of the six thresholds this feature is graded against were recorded **UNKNOWN** by the test
design because this repository has no PRD and no ADR, so measurements that look strong —
87.5% branch coverage, 5/5 clean burn-in, zero reachable path that still promises a sync —
are recorded as CONCERNS rather than PASS by rule, not by observation.

**The finding most worth acting on is not in that category.** It is that the honest message
this whole change exists to produce **never reaches a user**. `PokeKissInterface.tsx:185` and
`:219` render the string constants `'Failed to send poke. Try again.'` and `'Failed to send
kiss. Try again.'`, never `error.message`. The offline user still reads a generic retry
prompt. The change is correct and worth keeping — it makes the *thrown* value honest, which
is what the next caller and the next test will read — but its user-visible benefit is
currently zero, and that should be a conscious decision rather than a surprise.

### Domain risk breakdown

| Domain | Risk | PASS | CONCERNS | FAIL | N/A |
|---|---|---|---|---|---|
| Security | LOW | 4 | 1 | 0 | 1 |
| Performance | LOW | 1 | 1 | 0 | 3 |
| Reliability | MEDIUM | 0 | 5 | 0 | 1 |
| Maintainability | MEDIUM | 1 | 5 | 0 | 0 |
| **Overall** | **MEDIUM** | **6** | **12** | **0** | **5** |

Overall risk is MEDIUM because at least one domain is MEDIUM and none is HIGH.

---

## Thresholds Used (Step 2)

Taken from `test-design-epic-dw-events-offline-message-honesty.md` → *NFR Planning*, which
this workflow treats as the primary source. No value was invented for any UNKNOWN.

| Category | Threshold | Defined? | Consequence |
|---|---|---|---|
| Reliability | Qualitative only: *"Every message a caller can read must describe what actually happened."* No PRD or ADR exists. | **UNKNOWN** | All reliability findings capped at CONCERNS |
| Maintainability (coverage) | No per-file bar. Repo global is 25% (`vitest.config.ts`). | **UNKNOWN** | Coverage finding capped at CONCERNS |
| Maintainability (invariant) | Binary: zero Supabase-only modules importing a sync-promising symbol | **Defined** | Gradeable on merit |
| Maintainability (duplication) | No tool configured; DW-33 records two hand-copied instances | **UNKNOWN** | Capped at CONCERNS |
| Security | No new surface: no new query, no new policy, no new exported symbol | **Defined** | Gradeable on merit |
| Performance | N/A — no code path gained work | **Defined as N/A** | N/A findings are legitimate |
| Observability | No stated requirement | **UNKNOWN** | Capped at CONCERNS |

**How the undefined-threshold rule was applied.** `nfr-status-definitions.md` states the rule
per *finding* ("If the threshold or evidence a **finding** depends on was marked UNKNOWN…"),
while the pseudocode in `step-04e-aggregate-nfr.md` §1a applies it per *domain*. The
per-finding prose was followed, because it is the normative statement and the domain-level
form is too coarse — it would downgrade the dependency-vulnerability PASS, whose threshold
(0 critical / 0 high, from `nfr-criteria.md`) is defined and was measured directly.
**Sensitivity disclosed:** under the literal domain-level form, maintainability would report
0 PASS / 6 CONCERNS instead of 1 / 5. The overall status is CONCERNS either way, so the gate
does not move.

One PASS *was* downgraded under the rule: maintainability's *Documentation and Rationale*
finding. Its evidence is strong and verifiable, but no bar for "enough rationale" was ever
stated, so it reports CONCERNS by default. That is the rule firing, not an adverse finding.

---

## Execution Mode

- **Requested:** `auto` (`tea_execution_mode: auto`, `tea_capability_probe: true`)
- **Resolved:** `sequential`
- **Why:** the capability probe returns false for both parallel modes in this runtime. No
  agent-team primitive is available, and `CLAUDE.md` forbids delegating bmad-loop worktree
  work to a background subagent and waiting on it — background subagents cannot be polled in
  this Claude Code build, so a session that sleeps on one burns its whole timeout. The four
  domain audits were therefore run blocking, in order, by this session.
- **Performance gain:** baseline (no parallel speedup).

Domain outputs were written to the session scratchpad rather than `/tmp`, per the harness
rule; the resolved directory and timestamp are in this document's frontmatter.

---

## Performance Assessment

**Domain risk: LOW.** The change adds no work to any success path. Both new constructs —
`networkFailure` (`src/api/interactionService.ts:76-79`) and the `error instanceof
InteractionWriteError` re-throw (`:191-193`) — execute only after a rejection.

### Response Time (p95)

- **Status:** N/A
- **Threshold:** N/A per test design — no code path gained work
- **Actual:** No added latency on any success path
- **Evidence:** `git diff main...HEAD -- src/api/interactionService.ts` — every added statement sits inside a `catch` block or before the `try`'s first `await`. The `isOnline()` guard pre-dates this change; only the error it throws was altered.
- **Findings:** Nothing to measure. No SLO or latency target exists anywhere in the repository.

### Throughput

- **Status:** N/A
- **Threshold:** N/A
- **Actual:** Unchanged — single-row inserts, one per user gesture, in a two-person application
- **Evidence:** The diff contains no change to `.insert`, `.select`, `.or`, `.order` or `.range`.
- **Findings:** No batching or concurrency behaviour was touched.

### Resource Usage

- **Status:** N/A
- **Threshold:** N/A
- **Actual:** One `Error` allocated per failure, replacing one `SupabaseServiceError` allocated per failure
- **Evidence:** `interactionService.ts:76-79` returns a single `new Error`; `errorHandlers.ts:91-99` returned a single `new SupabaseServiceError`.
- **Findings:** Net-zero allocation delta.

### Client Bundle Delta

- **Status:** CONCERNS ⚠️
- **Threshold:** **UNKNOWN.** `.github/workflows/bundle-size.yml:41-46` runs `preactjs/compressed-size-action` with `compression: brotli` and `minimum-change-threshold: 100` — a *reporting* floor in bytes, not a failing budget. Nothing in CI can fail on bundle growth.
- **Actual:** Not measured this session. The production delta is roughly 30 added lines in one module, most of them comments.
- **Evidence:** `.github/workflows/bundle-size.yml:41-46`
- **Findings:** Repo-level gap, not a defect of this change. Recorded as an evidence gap.

### Test Suite Execution Cost

- **Status:** PASS ✅
- **Threshold:** The test design's *Execution Strategy* names 15 minutes as the bar that would justify deferring anything out of the PR tier.
- **Actual:** 5.51 s for the whole suite; 284 ms for the two files under audit
- **Evidence:** `npx --no-install vitest run` (this session) → **90 files / 1345 tests passed, 5.51 s**. The two audited files → **44 tests, 284 ms**, of which `interactionService.test.ts` is 7 ms.
- **Findings:** Three orders of magnitude below the bar. The added tests cost nothing.

---

## Security Assessment

**Domain risk: LOW.** The change's own threshold — no new query, no new policy, no new
exported symbol — is defined and verifiably met.

### Attack Surface Delta

- **Status:** PASS ✅
- **Threshold:** No new query, no new policy, no new exported symbol
- **Actual:** All three hold
- **Evidence:**
  - `git diff main...HEAD --name-only | grep -c '^supabase/'` → **0** — no migration and no policy file is touched
  - `grep -n '^export' src/api/interactionService.ts` → only `SupabaseInteractionRecord:34`, `InteractionType:39`, `Interaction:44`, `InteractionService:90`. `class InteractionWriteError` (`:62`) and `function networkFailure` (`:76`) are declared without `export`, as the spec claims.
  - The diff touches only throw sites; no query-construction call was altered.
- **Findings:** None.

### Authorization Controls

- **Status:** N/A
- **Threshold:** RLS policy set asserted by `supabase/tests/database/02_rls_policies.sql`
- **Actual:** Unchanged by this diff; **not re-verified this session**
- **Evidence:** Zero files under `supabase/` appear in the branch diff.
- **Findings:** `supabase test db` needs `supabase start`, which is not running in this worktree. Recorded as an evidence gap rather than a finding against the change.

### Data Protection

- **Status:** CONCERNS ⚠️
- **Threshold:** UNKNOWN — no requirement is stated for error-message content
- **Actual:** `networkFailure` interpolates the raw upstream `error.message` into the thrown message
- **Evidence:**
  - `src/api/interactionService.ts:77` → `const detail = error instanceof Error ? error.message : 'Unknown network error';`
  - `src/api/errorHandlers.ts:92` → the helper being replaced performs the identical interpolation, so this is **not a regression**
  - The value reaches `console.error` at `interactionsSlice.ts:94` / `:127` and `PokeKissInterface.tsx:184` / `:218`; it never reaches the DOM
- **Findings:** No evidence of an actual leak was found, and no test pins the property. Low priority.
- **Recommendation:** If any upstream fetch error can carry a URL with query credentials, add an assertion that the thrown message excludes it.

### Vulnerability Management

- **Status:** PASS ✅
- **Threshold:** 0 critical, 0 high (`nfr-criteria.md`)
- **Actual:** 0 vulnerabilities of any severity
- **Evidence:**
  - `npm audit` (run this session) → **"found 0 vulnerabilities"**
  - `.github/workflows/dependency-review.yml:24-27` → `actions/dependency-review-action@v5` with `fail-on-severity: moderate` on every PR to `main`/`develop`
  - `.github/workflows/codeql.yml:2-10` → CodeQL on push to `main`, on PR, and weekly
- **Findings:** Clean and gated. This is the strongest evidence in the audit.

### Secrets Management

- **Status:** PASS ✅
- **Threshold:** No hardcoded credential in source
- **Actual:** No credential-shaped literal anywhere in the branch diff
- **Evidence:** `git diff main...HEAD | grep -Ei '(eyJ[A-Za-z0-9_-]{10,}|sk_live|apikey|api_key|secret|password|token)\s*[:=]'` → **no matches**. `AGENTS.md` records secrets as age-encrypted inline in the committed `fnox.toml`.
- **Findings:** None.

### Compliance

- **Status:** N/A
- **Standards:** None applicable. A two-person personal PWA with no payment data, no regulated health data and no third-party data processing; SOC2 / PCI-DSS / HIPAA do not apply.
- **Findings:** Recorded as N/A deliberately rather than left blank.

---

## Reliability Assessment

**Domain risk: MEDIUM.** Every measurement taken is good; every threshold those measurements
would be graded against is UNKNOWN. The domain reports CONCERNS by the workflow's default
rule, not because anything was observed to fail.

### Error Handling Truthfulness (the change's core property)

- **Status:** CONCERNS ⚠️ *(capped — threshold UNKNOWN)*
- **Threshold:** **UNKNOWN.** Qualitative only: *"Every message a caller can read must describe what actually happened."*
- **Actual:** Holds on every path a test can reach
- **Evidence:**
  - All five `handleNetworkError` call sites in `src/api/interactionService.ts` are replaced. Grepping the file for the symbol returns **comment lines only** — `:9`, `:58`, `:71`, `:157`.
  - `grep -rn "synced when you're back online" src/` → the sole **code** match is `src/api/errorHandlers.ts:95`. Every other hit is explanatory prose in `interactionService.ts` or `eventsService.ts`.
  - The only importers of `handleNetworkError` in `src/` are `moodApi.ts` and `moodSyncService.ts` — both offline-first with a real service-worker sync queue, so the promise stays true where it is still made.
  - 44 tests across `tests/unit/api/interactionService.test.ts` (33) and `tests/unit/api/offlineMessageHonesty.test.ts` (11) passed in this session.
- **Findings:** The acceptance criterion holds. It cannot be graded PASS because no testable bar was ever written down.

### Failure-Path Coverage

- **Status:** CONCERNS ⚠️ *(capped — threshold UNKNOWN)*
- **Threshold:** **UNKNOWN** per file. Only global thresholds exist, all at 25%.
- **Actual:** 82.53% statements, **87.5% branches**, 71.42% functions, 83.87% lines
- **Evidence:** `npx --no-install vitest run tests/unit/api/interactionService.test.ts tests/unit/api/offlineMessageHonesty.test.ts --coverage --coverage.include='src/api/interactionService.ts'` (this session) → `Statements 82.53% (52/63) · Branches 87.5% (35/40) · Functions 71.42% (10/14) · Lines 83.87% (52/62)`, uncovered `238-262`. `vitest.config.ts` thresholds block → `lines 25, functions 25, branches 25, statements 25`, global only.
- **Findings:** Branch coverage is the number that matters for a failure-surface file, and 87.5% is strong. But with no per-file rule, a regression from 82% back to 30% in this file would not fail CI.

### Fault Tolerance / Recovery Path

- **Status:** CONCERNS ⚠️
- **Threshold:** UNKNOWN
- **Actual:** No retry, no queue, no circuit breaker for interactions
- **Evidence:** `src/api/interactionService.ts:159` → ``throw new InteractionWriteError(`You are offline. A ${type} needs a connection to send.`)``. `AGENTS.md` records photos, love notes and partner interactions as Supabase-only; only mood and daily/custom messages are offline-first.
- **Findings:** This is the state the change now *states honestly* rather than hides. Truthfulness improved; recoverability did not. A poke refused while offline is still lost. That is a product decision, not a defect.

### CI Burn-In (Stability)

- **Status:** CONCERNS ⚠️ *(capped — no burn-in threshold defined)*
- **Threshold:** **UNKNOWN** — no burn-in bar exists in the repo
- **Actual:** 5/5 clean, zero flakes
- **Evidence:** 5× burn-in of both audited files run in this session → `pass=5 fail=0`. Full suite → 90 files / 1345 tests passed.
- **Findings:** No instability observed. Independently reproduces the `tea.automate` (10/10) and `tea.trace` (5/5) results.

### Realtime Subscription Status Handling

- **Status:** CONCERNS ⚠️
- **Threshold:** UNKNOWN
- **Actual:** `subscribeInteractions` surfaces neither `CHANNEL_ERROR` nor `TIMED_OUT` to its caller — the subscribe callback only logs
- **Evidence:**
  - Coverage report uncovered lines for the changed file → **`238-262`**, which is exactly `subscribeInteractions`. It is the entire remaining gap.
  - `src/api/interactionService.ts:253-255` → `.subscribe((status) => { logger.info('[InteractionService] Realtime subscription status:', status); })`
  - `:230-237` — an in-file comment documenting the shared-topic teardown hazard, since `supabase.channel()` is called directly, which `AGENTS.md` records as a repo-wide pitfall
- **Findings:** Pre-existing, ledgered as **DW-35**, untouched by this change. It is the single largest reliability gap in the file.

### Availability / Error Rate / MTTR

- **Status:** N/A
- **Threshold:** None defined
- **Actual:** No uptime target, error-rate budget, health check or incident-response process exists
- **Evidence:** No SLO, SLA or monitoring configuration found anywhere in the repository.
- **Findings:** Not implied by a client-side error-message change. Recorded as an architecture-level gap.

### Disaster Recovery

- **Status:** N/A for this change; **not assessed** at system level
- **RTO / RPO:** Undefined. No recovery plan exists in the repository.
- **Backups:** Supabase-managed; no evidence in-repo either way.
- **Findings:** No automated Step 4 worker covers DR in this workflow, and this change touches no data, schema or policy. Recorded as an evidence gap, explicitly **not** attributed to this change.

---

## Maintainability Assessment

**Domain risk: MEDIUM.**

### Test Coverage

- **Status:** CONCERNS ⚠️ *(capped — threshold UNKNOWN)*
- **Threshold:** **UNKNOWN** per file; global floor 25%
- **Actual:** 82.53% statements / 87.5% branches — up from the 71.42% / 50% the test design measured before the automate run
- **Evidence:** the coverage command and `vitest.config.ts` block cited under *Failure-Path Coverage* above. `.github/workflows/test.yml:126-127` runs `npm run test:unit:coverage` and uploads the report as an artifact (`:129-134`) — it does not gate on it.
- **Findings:** A real and substantial improvement, measured against a bar that does not exist.
- **Recommendation:** Set a per-file threshold (the test design proposed ≥85% statements / ≥75% branches) or record the decision not to.

### Honesty Invariant Guard

- **Status:** CONCERNS ⚠️
- **Threshold:** **Defined and binary** — zero Supabase-only modules importing a sync-promising symbol
- **Actual:** The invariant **holds today**, but the guard enforcing it covers 6 of at least 9 Supabase-only modules
- **Evidence:**
  - `tests/unit/api/offlineMessageHonesty.test.ts` → `SUPABASE_ONLY_MODULES` holds 6 entries: `interactionService.ts`, `eventsService.ts`, `photoService.ts`, `notesSlice.ts`, `eventsSlice.ts`, `interactionsSlice.ts`
  - **Verified outside that list in this session:** `src/stores/slices/photosSlice.ts` (header lines 15-17: *"Supabase: photos stored in photos table + storage bucket"* / *"No local persistence"*), `src/services/loveNoteImageService.ts`, and `src/api/partnerService.ts` — all three return **0** for `grep -ciE 'indexeddb|dbSchema|BaseIndexedDB|localStorage'`
  - The invariant is currently intact: the only importers of either sync-promising symbol in `src/` are `moodApi.ts`, `moodSyncService.ts` and `MoodTracker.tsx`, all offline-first and all in the guard's positive-control list
  - The guard is **falsifiable, not merely green**: three detector tests assert the positive controls still resolve, and that a symbol appearing only in a comment is not counted — the latter matters because `interactionService.ts` names `handleNetworkError` four times in prose explaining why it does *not* use it
- **Findings:** This is about what the guard **would catch**, not a live violation. It independently confirms the `tea.trace` finding that TEST-03 is PARTIAL.
- **Recommendation:** Extend the list; then consider promoting the check to an ESLint `no-restricted-imports` override, which resolves modules rather than string-matching imports.

### Code Duplication

- **Status:** CONCERNS ⚠️ *(capped — threshold UNKNOWN and unmeasured)*
- **Threshold:** **UNKNOWN.** No duplication tool is configured.
- **Actual:** Unmeasured. Two hand-copied instances are known and documented.
- **Evidence:** `grep -rn 'jscpd' package.json .github/workflows/` → **no matches**. `src/api/interactionService.ts:71-79` states the builder is *"Copied from `eventsService.ts:124-127`"*; `:55-60` states the error class has the *"Same shape as `EventWriteError` (`eventsService.ts:108-113`)"*.
- **Findings:** DW-33 records this deliberately.
- **Recommendation:** Leave as-is per DW-33's own reasoning — a third Supabase-only feature is the stated trigger for extraction. Two well-cross-referenced copies is the cheaper state today.

### Vulnerability Scan

- **Status:** PASS ✅
- **Threshold:** 0 critical, 0 high — **defined** by `nfr-criteria.md`
- **Actual:** 0 vulnerabilities
- **Evidence:** `npm audit` (this session) → *"found 0 vulnerabilities"*; plus `dependency-review.yml` (`fail-on-severity: moderate`) and `codeql.yml` gating every PR.
- **Findings:** None.

### Observability

- **Status:** CONCERNS ⚠️ *(capped — threshold UNKNOWN)*
- **Threshold:** **UNKNOWN** — no observability requirement is stated
- **Actual:** Console-only, unstructured logging; no error-tracking integration
- **Evidence:**
  - `src/utils/logger.ts` exposes only `debug` (gated on `import.meta.env.DEV`, so **not toggleable without a rebuild**) and `info`; both delegate to `console` with no structured payload
  - `grep -rniE 'sentry|datadog|bugsnag|rollbar|newrelic' package.json src/` → **no matches**
  - `src/api/errorHandlers.ts:135-147` — `logSupabaseError` emits a structured object to `console.error`, the closest thing to a log schema in the codebase
- **Findings:** Thin repo-wide, unchanged by this feature. What this change *does* do well: the `InteractionWriteError` re-throw at `:191-193` deliberately bypasses `logSupabaseError`, and the test file asserts `console.error` was **not** called on that path **and was** called on the neighbouring one. Asserting by contrast is stronger than a single-sided check, which a test that simply never triggers logging would also satisfy.

### Documentation and Rationale

- **Status:** CONCERNS ⚠️ *(downgraded from PASS — no bar for "enough rationale" was ever stated; this is the default rule firing, not an adverse finding)*
- **Threshold:** **UNKNOWN**
- **Actual:** Rationale is written where the next reader will hit it, with citations
- **Evidence:**
  - `src/api/interactionService.ts:8-16` — module header explaining the convention, citing `errorHandlers.ts:95` and `eventsService.ts:19-26`
  - Four inline `// NOT handleNetworkError:` comments at the replaced call sites
  - `tests/unit/api/offlineMessageHonesty.test.ts:1-32` — header documenting why the guard exists and naming the ESLint upgrade it defers to
  - The guard's module list annotates each entry with the file and line proving that module is Supabase-only
- **Findings:** Substantively the strongest maintainability signal in the change.

---

## Custom NFR Evidence Audits

**N/A.** `workflow.yaml`'s `custom_nfr_categories` variable is empty and no additional
category was requested for this run, so the audit covers exactly the four standard domains
plus the eight ADR checklist categories. Section retained and explicitly marked N/A rather
than dropped, so its absence is a recorded decision.

---

## Cross-Domain Risks

**2 identified.**

### CDR-1 — Maintainability gaps leave the reliability property unguarded (Impact: MEDIUM)

**Domains:** maintainability + reliability

Two maintainability gaps compound into one reliability exposure. The honesty guard covers 6
of at least 9 Supabase-only modules, so a new module importing `handleNetworkError` or
`OFFLINE_ERROR_MESSAGE` can reintroduce the exact defect DW-7 and DW-18 fixed without failing
anything. And with no per-file coverage floor, the failure-path tests that pin the honest
messages could be gutted and CI would still pass at the 25% global bar.

Not rated HIGH because the invariant demonstrably holds today (verified by grep across `src/`
this session) and the blast radius is a misleading toast string in a two-person application.

### CDR-2 — The honest message never reaches a user (Impact: MEDIUM)

**Domains:** reliability + QoE

`interactionService` now throws truthful errors, but `PokeKissInterface.tsx:185` and `:219`
render the constants `'Failed to send poke. Try again.'` and `'Failed to send kiss. Try
again.'`, never `error.message`. The user-facing benefit of the change is currently **zero**.

The change is still correct and worth keeping — the thrown value is what the next caller,
the next test and the next maintainer read, and leaving a false promise in place to be
inherited later is worse. But if the intent was that offline users stop being told their poke
will sync, that intent is not yet delivered, and it needs one line in the component.

This independently reproduces the test design's **R-6**, which scored it 3 (probability 3 ×
impact 1) and recorded it as a scope exclusion rather than a defect.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

Criteria that the change does not touch and for which no evidence was gathered this session
are counted in the CONCERNS column, per the "undefined evidence defaults to CONCERNS" rule,
and are flagged in the notes so they are not misread as regressions.

| Category | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
| --- | --- | --- | --- | --- | --- |
| 1. Testability & Automation | 4/4 | 4 | 0 | 0 | PASS ✅ |
| 2. Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS ✅ |
| 3. Scalability & Availability | 1/4 | 1 | 3 | 0 | CONCERNS ⚠️ |
| 4. Disaster Recovery | 0/3 | 0 | 3 | 0 | CONCERNS ⚠️ |
| 5. Security | 3/4 | 3 | 1 | 0 | PASS ✅ |
| 6. Monitorability, Debuggability & Manageability | 0/4 | 0 | 4 | 0 | CONCERNS ⚠️ |
| 7. QoS & QoE | 1/4 | 1 | 3 | 0 | CONCERNS ⚠️ |
| 8. Deployability | 2/3 | 2 | 1 | 0 | CONCERNS ⚠️ |
| **Total** | **14/29 (48%)** | **14** | **15** | **0** | **CONCERNS ⚠️** |

**Criteria Met Scoring:** ≥26/29 = strong foundation · 20-25/29 = room for improvement ·
**<20/29 = significant gaps**.

**Read this number carefully.** 14/29 scores the *system*, not the change. **Eleven of the
fifteen unmet criteria are architecture-level and identical before and after this commit** —
categories 3, 4, 6 and most of 7 describe a two-person personal PWA with no SLA, no DR plan,
no APM and no metrics endpoint, none of which a client-side error-message change could move.
The change-scoped verdict is the *Executive Summary*, and it is materially better than 48%.

### Per-criterion detail

**1. Testability & Automation — 4/4 ✅**

| Criterion | Status | Evidence |
|---|---|---|
| 1.1 Isolation | ✅ | `InteractionService` has no constructor dependencies and `tests/setup.ts` installs no Supabase mock, so a per-file `vi.mock` gives complete control. `tests/unit/api/fakeInteractionsBackend.ts` is a purpose-built 336-line boundary fake. |
| 1.2 Headless | ✅ | All changed logic is a plain class, fully reachable without UI. 44 tests, no browser. |
| 1.3 State Control | ✅ | `setOnline()` redefines `navigator.onLine` with `configurable: true`; the fake injects the `PGRST116`, empty-body and mid-flight-throw states on demand. |
| 1.4 Sample Requests | ✅ | The spec's `## I/O & Edge-Case Matrix` (6 rows) supplies the input→output pairs this criterion asks for. |

**2. Test Data Strategy — 3/3 ✅**

| Criterion | Status | Evidence |
|---|---|---|
| 2.1 Segregation | ✅ | The fake is per-test; no shared or production data is involved. |
| 2.2 Generation | ✅ | Rows are synthesised by the fake. No production dump. |
| 2.3 Teardown | ✅ | `afterEach` restores `navigator.onLine`; the fake is reconstructed per test. |

**3. Scalability & Availability — 1/4 ⚠️** *(all gaps pre-date this change)*

| Criterion | Status | Evidence |
|---|---|---|
| 3.1 Statelessness | ✅ | The service is a stateless class; Supabase holds all state. |
| 3.2 Bottlenecks | ⚠️ | No load test exists. Low real risk at two users. |
| 3.3 SLA Definitions | ⚠️ | Undefined — UNKNOWN threshold. |
| 3.4 Circuit Breakers | ⚠️ | None. A failed interaction has no retry path; the change makes that honest, not recoverable. |

**4. Disaster Recovery — 0/3 ⚠️** *(out of scope for this change; no Step 4 worker covers DR)*

| Criterion | Status | Evidence |
|---|---|---|
| 4.1 RTO/RPO | ⚠️ | Undefined; no recovery plan in-repo. |
| 4.2 Failover | ⚠️ | Not assessed — Supabase-managed, no in-repo evidence. |
| 4.3 Backups | ⚠️ | Not assessed — no restore drill evidence in-repo. |

**5. Security — 3/4 ✅**

| Criterion | Status | Evidence |
|---|---|---|
| 5.1 AuthN/AuthZ | ✅ | Supabase Auth + RLS, untouched — 0 files under `supabase/` in the diff. |
| 5.2 Encryption | ⚠️ | Not re-verified this session; needs `supabase start`. Unchanged by the diff. |
| 5.3 Secrets | ✅ | No credential-shaped literal in the diff; fnox age-encrypted config. |
| 5.4 Input Validation | ✅ | No new query; PostgREST parameterises. `interactionValidation.test.ts` → 20 tests green. |

**6. Monitorability, Debuggability & Manageability — 0/4 ⚠️** *(all repo-level, unchanged)*

| Criterion | Status | Evidence |
|---|---|---|
| 6.1 Tracing | ⚠️ | No correlation IDs, no W3C trace context. |
| 6.2 Logs | ⚠️ | `logger.debug` is gated on `import.meta.env.DEV` at build time — no runtime toggle. Not structured. |
| 6.3 Metrics | ⚠️ | No metrics endpoint; not meaningful for a static PWA, but absent. |
| 6.4 Config | ⚠️ | Vite inlines env vars at build time (`AGENTS.md`), so behaviour cannot change without a rebuild. |

**7. QoS & QoE — 1/4 ⚠️**

| Criterion | Status | Evidence |
|---|---|---|
| 7.1 Latency | ⚠️ | No P95/P99 target defined. |
| 7.2 Throttling | ⚠️ | No app-level rate limiting; Supabase's own limits not assessed. |
| 7.3 Perceived Performance | ✅ | `PokeKissInterface` tracks `isPoking`/`isKissing` in-flight state and clears it in `finally`; `interactionsSlice` inserts the interaction optimistically. |
| 7.4 Degradation | ⚠️ | **CDR-2.** A friendly message is shown, never a stack trace — so not a FAIL — but it is a hardcoded constant, so the honest message never surfaces. |

**8. Deployability — 2/3 ⚠️**

| Criterion | Status | Evidence |
|---|---|---|
| 8.1 Zero Downtime | ✅ | Static PWA published atomically to GitHub Pages by `deploy.yml`. |
| 8.2 Backward Compatibility | ✅ | No DB change at all — 0 files under `supabase/` in the diff, so no code/schema lock-step. |
| 8.3 Rollback | ⚠️ | No automated rollback on health-check failure; revert-and-redeploy is the manual mechanism. |

---

## Quick Wins

**2 quick wins identified.**

1. **Extend the honesty guard's module list** (Maintainability) — MEDIUM — ~15 min
   - Add `src/stores/slices/photosSlice.ts`, `src/services/loveNoteImageService.ts` and `src/api/partnerService.ts` to `SUPABASE_ONLY_MODULES` in `tests/unit/api/offlineMessageHonesty.test.ts`.
   - All three were confirmed Supabase-only in this session; the guard already has the machinery, so this is three list entries plus their annotations.
   - Test-only change. No production code, no operator decision required.

2. **Surface the honest message in the UI** (QoE / CDR-2) — MEDIUM — ~20 min
   - Replace the hardcoded constants at `PokeKissInterface.tsx:185` and `:219` with the thrown `error.message`, guarded by an `instanceof Error` check and a fallback to the current string.
   - This is what turns the whole change from internally-correct into user-visible. It is a *product* decision — confirm the wording is wanted on screen before doing it.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

**None.** No FAIL status, no breached threshold, no blocker. The suite is green
(90 files / 1345 tests), lint exits 0, `npm audit` is clean, and burn-in is 5/5.

### Short-term (Next Milestone) — MEDIUM Priority

1. **Extend the honesty guard to every Supabase-only module** — MEDIUM — ~15 min — DEV
   - Three entries confirmed this session; see *Quick Wins* #1.
   - **Validation:** `npx vitest run tests/unit/api/offlineMessageHonesty.test.ts` still green with 9+ parameterised cases.

2. **Decide whether the honest message should reach the user** — MEDIUM — ~20 min — OPERATOR then DEV
   - CDR-2. Until this is answered, the change's user-facing value is zero.
   - **Validation:** a component test asserting the toast reflects the thrown message. Note the test design's R-6 caveat — today no test at any level above the service can distinguish the pre- and post-change build.

3. **Schedule DW-35 — `subscribeInteractions` surfaces neither `CHANNEL_ERROR` nor `TIMED_OUT`** — MEDIUM — ~2-4 h — DEV
   - Lines `238-262` are the entire remaining coverage gap in the file, and the method calls `supabase.channel()` directly against `AGENTS.md`'s guidance.
   - Blocked today: the spec's Never list excludes the production change, which is why TEST-07 stays deferred.
   - **Validation:** the subscribe callback propagates error statuses to the caller; the channel is registered through `moodSyncService`'s refcounted registry; coverage of the file exceeds 95% statements.

### Long-term (Backlog) — LOW Priority

4. **Set a per-file coverage threshold for `src/api/interactionService.ts`** — LOW — ~30 min — OPERATOR
   - Test design proposed ≥85% statements / ≥75% branches; measured today 82.53% / 87.5%. Note statements sit *below* that proposal until DW-35 lands, so adopting it verbatim would fail CI immediately — set 80/85, or gate it behind DW-35.

5. **Promote the honesty guard to an ESLint `no-restricted-imports` override** — LOW — ~1 h — OPERATOR
   - Stronger than the static scan (resolves modules, no comment-stripping needed) and runs in the job that already lints `src`. Deferred because it edits `eslint.config.js`.

6. **Fix the second false sync promise** — LOW — DEV
   - `OFFLINE_ERROR_MESSAGE` (`src/utils/offlineErrorHandler.ts:74`) reads *"You're offline. Changes will sync when reconnected."* Its only consumer today is `MoodTracker.tsx:432`, where the promise is **true**, so nothing is currently wrong. It is listed because it is the other symbol the guard watches.

---

## Monitoring Hooks

**1 recommended.** Deliberately short: adding monitoring infrastructure to a two-person PWA
to satisfy a checklist would be scope invented by this audit rather than requested by it.

### Reliability Monitoring

- [ ] Track the per-file coverage of `src/api/interactionService.ts` in the PR comment so a
      drop is visible even without a gate.
  - **Owner:** OPERATOR · **Deadline:** with action #4

### Error Tracking

- [ ] **Considered and not recommended now.** Observability is CONCERNS, and the checklist
      asks for an error-tracking suggestion — but adding Sentry or equivalent to a two-person
      PWA is a product and privacy decision far outside this change, which alters no logging
      behaviour. Recorded here so the omission is deliberate. If it is ever wanted,
      `src/utils/logger.ts` is the single choke point.
  - **Owner:** OPERATOR · **Deadline:** none set — not scheduled

### Performance / Security Monitoring and Alerting Thresholds

- **None recommended.** No SLO exists to alert against, so any threshold would be invented
  here rather than derived. CodeQL and `dependency-review` already gate the security surface
  on every PR, and both were confirmed green in this session.

---

## Fail-Fast Mechanisms

**2 recommended.**

### Validation Gates (Security)

- [ ] Already in place — `dependency-review.yml` fails a PR at `moderate` severity. No action.

### Coverage/Duplication Gates (Maintainability)

- [ ] Per-file coverage threshold for `src/api/interactionService.ts` (action #4)
  - **Owner:** OPERATOR · **Effort:** ~30 min
- [ ] ESLint `no-restricted-imports` override for the sync-promising symbols (action #5)
  - **Owner:** OPERATOR · **Effort:** ~1 h

### Circuit Breakers (Reliability) / Rate Limiting (Performance)

Not recommended. Neither is warranted at this application's scale, and inventing them would
exceed the change's scope.

---

## Evidence Gaps

**5 gaps identified.** Deadlines are expressed relative to the loop's own milestones rather
than as invented dates — no release calendar exists in this repository to anchor them to.

- [ ] **RLS policy set not re-verified** (Security)
  - **Owner:** DEV · **Deadline:** next session that has `supabase start` running
  - **Suggested Evidence:** `supabase test db` — `02_rls_policies.sql` asserts the exact policy set via pgTAP
  - **Impact:** LOW. Zero files under `supabase/` appear in the diff, so no policy could have changed.

- [ ] **No per-file coverage threshold** (Maintainability)
  - **Owner:** OPERATOR · **Deadline:** with recommended action #4, and after DW-35 lands
  - **Suggested Evidence:** a `vitest.config.ts` per-file rule
  - **Impact:** MEDIUM. A measured 82.53% is ungraded and unprotected — see CDR-1.

- [ ] **No duplication measurement** (Maintainability)
  - **Owner:** DEV · **Deadline:** deferred to DW-33's own stated trigger — a third Supabase-only feature
  - **Suggested Evidence:** a jscpd run; DW-33 already documents the two known copies
  - **Impact:** LOW. The duplication is deliberate, documented and cross-referenced.

- [ ] **No bundle-size budget** (Performance)
  - **Owner:** OPERATOR · **Deadline:** none set — not scheduled, informational by current design
  - **Suggested Evidence:** a failing budget in `bundle-size.yml`, which today only reports
  - **Impact:** LOW for this change (~30 lines, mostly comments); repo-level otherwise.

- [ ] **No performance or availability baseline of any kind** (Performance / Reliability)
  - **Owner:** OPERATOR · **Deadline:** none set — not scheduled
  - **Suggested Evidence:** k6 or Lighthouse budgets, an uptime target
  - **Impact:** LOW for this change (N/A — no runtime work added); it is why every
    performance and availability criterion in the ADR table is unmet.

---

## Quality Gate Ladder

Applying the checklist's four gate levels explicitly, so the verdict is not left to inference.

| Gate level | Triggered? | Basis |
|---|---|---|
| **Release Blocker (FAIL)** | **No** | No NFR in any domain carries FAIL. Security is LOW risk with a defined, met threshold; reliability shows no observed failure. |
| **PR Blocker (HIGH CONCERNS)** | **No** | Zero CRITICAL and zero HIGH issues. The three MEDIUM items are follow-ups, and two of them are blocked on operator decisions rather than on code. |
| **Warning (CONCERNS)** | **Yes** | 12 CONCERNS across four domains, 8 of them capped by UNKNOWN thresholds. Address before the next release. |
| **Pass (PASS)** | **No** | Not all NFRs are PASS, so the release-ready gate is not claimed. |

**Net:** this change is not blocked at any level, and the audit records a Warning.

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-08-19'
  story_id: 'dw-events-offline-message-honesty'
  feature_name: 'DW-7 / DW-18: offline message honesty in interactionService'
  source_sha: 'f486587f658fa812987a277ee1e416949f4f2fbc'
  scope: 'commit f486587 plus the uncommitted working tree'
  adr_checklist_score: '14/29' # ADR Quality Readiness Checklist
  execution_mode: 'sequential'
  categories:
    testability_automation: 'PASS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'CONCERNS'
    security: 'PASS'
    monitorability: 'CONCERNS'
    qos_qoe: 'CONCERNS'
    deployability: 'CONCERNS'
  domain_risk:
    security: 'LOW'
    performance: 'LOW'
    reliability: 'MEDIUM'
    maintainability: 'MEDIUM'
  overall_risk: 'MEDIUM'
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 3
  concerns: 12
  blockers: false
  quick_wins: 2
  evidence_gaps: 5
  cross_domain_risks: 2
  threshold_note: >-
    Four of seven thresholds were recorded UNKNOWN by the test design because this
    repository has no PRD and no ADR. Findings depending on them are capped at
    CONCERNS by the workflow default rule, not by any observed failure.
  recommendations:
    - 'Extend the honesty guard to photosSlice.ts, loveNoteImageService.ts and partnerService.ts'
    - 'Decide whether the honest message should reach the user — PokeKissInterface renders constants, so today it does not'
    - 'Schedule DW-35: subscribeInteractions surfaces neither CHANNEL_ERROR nor TIMED_OUT'
```

---

## Related Artifacts

- **Spec:** `_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md` (source of all thresholds)
- **Automation Summary:** `_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md`
- **Traceability Matrix:** `_bmad-output/test-artifacts/traceability-matrix.md` (trace gate: PASS, 84% overall)
- **Trace Gate JSON:** `_bmad-output/test-artifacts/gate-decision.json` — *trace's* gate, schema 0.1.0. This NFR audit records its own gate in the YAML snippet above and in `nfr-gate-decision.json`; neither overwrites trace's.
- **Deferred-Work Ledger:** `_bmad-output/implementation-artifacts/deferred-work.md` (DW-31, DW-32, DW-33, DW-34, DW-35)
- **Tech Spec / PRD:** **none exist in this repository** — this is the direct cause of four UNKNOWN thresholds.
- **Evidence sources:**
  - Unit tests: `tests/unit/api/interactionService.test.ts`, `tests/unit/api/offlineMessageHonesty.test.ts`, `tests/unit/api/fakeInteractionsBackend.ts`
  - Coverage: `--coverage.include='src/api/interactionService.ts'`, run in-session
  - CI definitions: `.github/workflows/{test,codeql,dependency-review,bundle-size,lighthouse,deploy}.yml`
  - Domain worker JSON: see `domainOutputDir` in this document's frontmatter

---

## Verification Performed In This Session

Every claim in this report traces to one of these. No number was copied from a prior report
without re-running its command.

| Command | Result |
|---|---|
| `npx --no-install vitest run` | 90 files / **1345 tests passed**, 5.51 s |
| `npx --no-install vitest run <2 audited files> --coverage --coverage.include='src/api/interactionService.ts'` | 44 passed · **82.53% stmts / 87.5% branch / 71.42% funcs / 83.87% lines** · uncovered `238-262` |
| 5× burn-in of both audited files | **pass=5 fail=0** |
| `npm run lint` | **exit 0**, 2 pre-existing warnings in `EventCountdown.tsx` (untouched by this branch) |
| `npm audit` | **found 0 vulnerabilities** |
| `git diff main...HEAD --name-only \| grep -c '^supabase/'` | **0** |
| `grep -n '^export' src/api/interactionService.ts` | 4 exports; `InteractionWriteError` and `networkFailure` absent — both unexported as claimed |
| `grep -rn "synced when you're back online" src/` | sole **code** match `src/api/errorHandlers.ts:95`; all others are comments |
| `grep -rn 'handleNetworkError' src/` | code importers are only `moodApi.ts` and `moodSyncService.ts` — both offline-first |
| `grep -ciE 'indexeddb\|dbSchema\|BaseIndexedDB\|localStorage'` on the 3 candidate modules | **0** for each — all three confirmed Supabase-only and absent from the guard |
| `git diff main...HEAD \| grep -Ei '(eyJ…\|sk_live\|apikey\|secret\|password\|token)\s*[:=]'` | no matches |
| `grep -rn 'jscpd' package.json .github/workflows/` | no matches — no duplication tooling |
| `grep -rniE 'sentry\|datadog\|bugsnag\|rollbar\|newrelic' package.json src/` | no matches — no error tracking |

**Browser-based evidence collection (Step 3 §2):** not performed, and therefore **no
`playwright-cli` session was opened and none needs closing**. `tea_browser_automation` is
`auto`, which permits CLI collection, but the change under audit is error-handling logic in
an isolated service class with no observable UI difference — `PokeKissInterface` renders
string constants on every failure path (CDR-2), so a live page could not distinguish the
pre- and post-change build. Collecting a screenshot or network trace would have produced
evidence that looks relevant and proves nothing.

---

## Recommendations Summary

**Release Blocker:** None. Nothing in this audit should stop this change from shipping.

**High Priority:** None.

**Medium Priority:** Extend the honesty guard's module list; decide whether the honest message
should reach the user (CDR-2); schedule DW-35.

**Next Steps:** The trace gate already reads PASS (84% overall, P1 at 93%). This NFR audit
reads CONCERNS, driven by UNKNOWN thresholds rather than observed failures. The two verdicts
are consistent: coverage of the requirements is good, and the *targets* those requirements
would be graded against were never written down. Closing that permanently means either
writing a short NFR section into a spec, or recording once that this project accepts
qualitative bars — after which future `nfr-assess` runs can grade PASS on merit instead of
being capped.

---

## Sign-Off

**NFR Evidence Audit:**

- Overall Status: **CONCERNS ⚠️**
- Overall Risk: **MEDIUM**
- Critical Issues: **0**
- High Priority Issues: **0**
- Concerns: **12** (of which 8 are capped by UNKNOWN thresholds rather than observed failures)
- Cross-Domain Risks: **2**
- Evidence Gaps: **5**
- Blockers: **none**

**Gate Status:** CONCERNS ⚠️ — proceed with the three MEDIUM actions tracked.

**Next Actions:**

- CONCERNS ⚠️: address the MEDIUM items above, then re-run `/bmad-testarch-nfr`. Because
  8 of the 12 CONCERNS are threshold-definition gaps rather than defects, defining the
  thresholds is the single change that would move this result the most.

**Generated:** 2026-08-19
**Workflow:** testarch-nfr v5.0 (sequential execution, 4 domains)

---

<!-- Powered by BMAD-CORE™ -->
