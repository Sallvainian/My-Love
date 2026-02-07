# Test Design: Epic 1 - Foundation & Solo Scripture Reading

**Date:** 2026-01-30
**Author:** Salvain
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 1 — Foundation & Solo Scripture Reading

Epic 1 delivers the foundational backend infrastructure (Supabase tables, RLS policies, RPCs, IndexedDB caching, Zustand state) and the complete solo scripture reading experience: navigation, 17-step reading flow, save/resume with optimistic UI, and accessibility foundations.

**Risk Summary:**

- Total risks identified: 8
- High-priority risks (score 6+): 2
- Critical categories: SEC, DATA, TECH

**Coverage Summary:**

- P0 scenarios: 12 tests (~18-30 hours)
- P1 scenarios: 18 tests (~14-27 hours)
- P2 scenarios: 14 tests (~4-11 hours)
- P3 scenarios: 4 tests (~0.5-2 hours)
- **Total effort**: ~36-70 hours (~1-2 weeks with 1 QA engineer)

---

## Risk Assessment

### High-Priority Risks (Score 6+)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | SEC | RLS policy bypass — unauthorized users could access another couple's scripture session data if RLS policies have gaps | 2 | 3 | 6 | Write targeted RLS boundary tests covering session membership validation for all 5 tables | QA | Sprint 1 |
| R-002 | DATA | IndexedDB cache corruption causes data loss or stale state — user sees wrong step, wrong session, or blank screen after cache error | 2 | 3 | 6 | Test corruption recovery path (clear cache → refetch from server), validate no data loss after recovery | QA | Sprint 1 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-003 | TECH | Optimistic UI rollback failure — step advancement shows wrong step after server rejection (version mismatch / 409) | 2 | 2 | 4 | Test optimistic UI with simulated server failures and version conflicts | QA |
| R-004 | DATA | Session resume loads stale state — cached session has different step index than server, user resumes at wrong position | 2 | 2 | 4 | Test cache-first read + server refresh pattern verifies latest state is rendered | QA |
| R-005 | BUS | Mode selection logic incorrect — together mode enabled when user has no partner, or disabled when partner exists | 1 | 3 | 3 | Test mode selection against partner_id state (null vs present) | QA |
| R-006 | TECH | IndexedDB version upgrade breaks existing stores — dbSchema.ts upgradeDb() at v5 could corrupt mood/photo/customMessage data | 1 | 3 | 3 | Test schema upgrade path from v4 → v5 preserves all existing stores | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| R-007 | BUS | Accessibility regressions — screen reader announcements fire on re-renders instead of semantic state changes only | 1 | 2 | 2 | Monitor; test aria-live regions and focus management |
| R-008 | PERF | Static scripture data bundle size — 17 steps with full verse text could increase initial load | 1 | 1 | 1 | Monitor; data is ~10KB, well within budget |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Test Coverage Plan

**Note:** P0/P1/P2/P3 indicates priority and risk level, NOT execution timing. See Execution Strategy for timing.

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (score 6+) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| P0-001 | RLS: Only session members can SELECT scripture_sessions | API | R-001 | Non-member user gets empty result or 403 |
| P0-002 | RLS: Only session members can SELECT scripture_reflections | API | R-001 | Cross-session isolation |
| P0-003 | RLS: Only session members can INSERT reflections/bookmarks | API | R-001 | Non-member insert rejected |
| P0-004 | RLS: user_id = auth.uid() enforced on INSERT | API | R-001 | Cannot impersonate another user |
| P0-005 | RLS: is_shared visibility — unshared reflections hidden from partner | API | R-001 | Privacy boundary |
| P0-006 | Cache corruption recovery — clear + refetch produces correct state | Unit | R-002 | IndexedDB error triggers full recovery |
| P0-007 | Cache corruption — all 4 scripture stores cleared on fatal error | Unit | R-002 | No stale data remains |
| P0-008 | Solo session creation via RPC returns valid session | API | R-001 | scripture_create_session returns correct shape |
| P0-009 | Solo reading flow — advance through 17 steps sequentially | E2E | — | Core user journey |
| P0-010 | Session save on exit — step index persisted to server | API | R-002 | Data survives app close |
| P0-011 | Session resume — loads correct step from server after cache miss | API | R-004 | Resume after cache clear works |
| P0-012 | Idempotent reflection write — duplicate (session, step, user) upserts not duplicates | API | R-001 | Unique constraint validation |

**Total P0**: 12 tests

### P1 (High)

**Criteria:** Important features + Medium risk (score 3-4) + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| P1-001 | Optimistic step advance — UI shows next step before server confirms | E2E | R-003 | Verify instant feedback |
| P1-002 | Version mismatch rollback — 409 response triggers state refresh | Unit | R-003 | Stale-write rejection |
| P1-003 | Cache-first read — cached session returned immediately, then server refresh | Unit | R-004 | Two-phase read pattern |
| P1-004 | Write-through — server write success updates IndexedDB cache | Unit | R-004 | Cache consistency |
| P1-005 | Write failure — server POST fails, retry UI shown, local state preserved | Unit | R-003 | No silent data loss |
| P1-006 | Mode selection — partner_id null disables Together mode | Component | R-005 | Correct UI state |
| P1-007 | Mode selection — partner_id present enables both modes | Component | R-005 | Both options available |
| P1-008 | Resume prompt — "Continue where you left off?" with correct step number | Component | R-004 | Shows step X of 17 |
| P1-009 | Start fresh — clears saved state and begins new session | E2E | R-004 | Clean slate path |
| P1-010 | Verse → Response transition — crossfade animation renders correctly | Component | — | 200ms duration, or 0 if reduced-motion |
| P1-011 | Step → Step transition — slide-left + fade animation | Component | — | 300ms or 0 if reduced-motion |
| P1-012 | Progress indicator — "Verse X of 17" updates on each advance | Component | — | Text-based, not progress bar |
| P1-013 | Zustand slice — createSession sets isLoading → session → isInitialized | Unit | — | State machine correctness |
| P1-014 | Zustand slice — loadSession with null returns SESSION_NOT_FOUND error | Unit | — | Error state handling |
| P1-015 | Zustand slice — exitSession resets all state to initial | Unit | — | Clean teardown |
| P1-016 | Scripture data — 17 steps, contiguous indexes 0-16, all fields present | Unit | — | Static data integrity |
| P1-017 | Scripture data — 6 section themes covered | Unit | — | All themes represented |
| P1-018 | DB schema upgrade — v4 → v5 creates new stores, preserves existing | Unit | R-006 | No data loss on upgrade |

**Total P1**: 18 tests

### P2 (Medium)

**Criteria:** Secondary features + Low risk (score 1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
| ------- | ----------- | ---------- | --------- | ----- |
| P2-001 | Keyboard navigation — all interactive elements reachable via Tab | E2E | R-007 | Tab order logical |
| P2-002 | Screen reader — aria-labels on all buttons | E2E | R-007 | Descriptive labels |
| P2-003 | Screen reader — aria-live region announces verse transitions | E2E | R-007 | Polite announcements only |
| P2-004 | Screen reader — announcements only on semantic state changes | E2E | R-007 | No re-render noise |
| P2-005 | Focus management — verse screen focuses verse heading | E2E | R-007 | After transition |
| P2-006 | Focus management — response screen focuses nav button | E2E | R-007 | After transition |
| P2-007 | Reduced motion — useMotionConfig returns duration: 0 | Unit | R-007 | prefers-reduced-motion |
| P2-008 | Touch targets — minimum 48x48px with 8px spacing | E2E | R-007 | WCAG compliance |
| P2-009 | Offline indicator — shown when navigator.onLine is false | Component | — | Visual feedback |
| P2-010 | Offline — step advancement blocked | Component | — | No silent failures |
| P2-011 | Exit confirmation — "Save your progress?" prompt appears | E2E | — | UX guardrail |
| P2-012 | Session completion — step 17 transitions to reflection phase | E2E | — | End-of-flow boundary |
| P2-013 | Lavender Dreams theme — purple gradients and glass morphism on overview | Component | — | Visual design compliance |
| P2-014 | Color contrast — WCAG AA ratios (4.5:1 normal, 3:1 large) | E2E | R-007 | Automated axe check |

**Total P2**: 14 tests

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
| ------- | ----------- | ---------- | ----- |
| P3-001 | Static scripture data bundle size < 15KB | Unit | Performance budget |
| P3-002 | IndexedDB read latency — cache read < 50ms | Unit | Local perf baseline |
| P3-003 | Scripture reading flow — visual regression snapshot | E2E | Pixel comparison |
| P3-004 | Partner link flow — "Set up partner" navigates correctly | E2E | Secondary path |

**Total P3**: 4 tests

---

## Execution Strategy

**Philosophy**: Run everything in PRs unless significant infrastructure overhead. Playwright with parallelization handles 100+ tests in ~10-15 minutes.

### Every PR: Playwright + Vitest (~10-15 min)

All functional tests:
- All E2E tests (P0-009, P1-001, P1-009, P2-001 through P2-014, P3-003, P3-004)
- All Unit tests via Vitest (P0-006/007, P1-002 through P1-018, P2-007, P3-001/002)
- All Component tests (P1-006 through P1-012, P2-009/010/013)
- All API tests against local Supabase (P0-001 through P0-005, P0-008, P0-010 through P0-012)
- Total: ~48 tests, parallelized

No tests deferred to nightly or weekly — Epic 1 has no performance tests (k6), chaos engineering, or long-running infrastructure tests.

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| -------- | ----- | ---------- | ----------- | ----- |
| P0 | 12 | 1.5-2.5 | ~18-30 | RLS boundary tests, cache recovery, core flow |
| P1 | 18 | 0.75-1.5 | ~14-27 | Optimistic UI, state management, transitions |
| P2 | 14 | 0.25-0.75 | ~4-11 | Accessibility, edge cases, visual checks |
| P3 | 4 | 0.1-0.5 | ~0.5-2 | Performance baselines, visual regression |
| **Total** | **48** | — | **~36-70** | **~1-2 weeks** |

### Prerequisites

**Test Data:**
- Scripture session factory (creates valid session with configurable step/phase/mode)
- Supabase test user factory (two users for partner/RLS tests)
- `scripture_seed_test_data` RPC (already in migration — 'mid_session' preset)

**Tooling:**
- Vitest for unit/component tests (already configured)
- Playwright for E2E tests (already configured)
- `@seontechnologies/playwright-utils` for API test fixtures
- `fake-indexeddb` for IndexedDB mocking (already in devDependencies)
- `@axe-core/playwright` for accessibility audits (P2 tests)

**Environment:**
- Local Supabase instance for API/RLS tests
- `scripture_seed_test_data` RPC enabled in test environment

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (score 6+) items unmitigated
- [ ] RLS security tests (R-001) pass 100%
- [ ] Cache recovery tests (R-002) pass 100%

---

## Mitigation Plans

### R-001: RLS Policy Bypass (Score: 6)

**Mitigation Strategy:**
1. Write API tests for each scripture table (5 tables) with two test users
2. Verify non-member SELECT returns empty results
3. Verify non-member INSERT is rejected
4. Verify is_shared=false reflections are invisible to partner
5. Verify user_id enforcement on all INSERT operations

**Owner:** QA
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** All P0-001 through P0-005 pass with real Supabase instance

### R-002: IndexedDB Cache Corruption (Score: 6)

**Mitigation Strategy:**
1. Simulate IndexedDB read errors and verify recovery path fires
2. Verify all 4 scripture stores are cleared on corruption detection
3. Verify server refetch produces correct state after cache clear
4. Verify user sees no error UI during transparent recovery

**Owner:** QA
**Timeline:** Sprint 1
**Status:** Partially covered (P0-006, P0-007 exist as unit tests in Story 1.1)
**Verification:** P0-006 and P0-007 pass; no stale data after simulated corruption

---

## Assumptions and Dependencies

### Assumptions

1. Local Supabase instance available for API/RLS testing in CI
2. `scripture_seed_test_data` RPC is functional and accessible in test environments
3. Story 1.1 implementation passes code review without major refactors that change service/slice APIs
4. Accessibility tests (P2) rely on axe-core which detects WCAG AA violations automatically

### Dependencies

1. Story 1.1 merged — backend infrastructure (service, slice, data, schema) must be stable before E2E tests can run
2. Playwright test framework configured — test harness from existing `tests/` README setup
3. `@seontechnologies/playwright-utils` available for API test fixtures
4. `@axe-core/playwright` added to devDependencies for accessibility testing

### Risks to Plan

- **Risk**: Story 1.1 code review results in significant API changes
  - **Impact**: P0/P1 tests targeting service/slice methods need updating
  - **Contingency**: Write tests against acceptance criteria behavior, not internal APIs

---

## Existing Test Coverage (Story 1.1)

Story 1.1 already produced 31 unit tests across 3 files:

| File | Tests | Coverage |
| ---- | ----- | -------- |
| `tests/unit/services/scriptureReadingService.test.ts` | 11 | IndexedDB CRUD, cache recovery, error codes |
| `tests/unit/stores/scriptureReadingSlice.test.ts` | 13 | State transitions, create/load/exit/updatePhase, error handling |
| `tests/unit/data/scriptureSteps.test.ts` | 7 | 17 steps, fields, themes, uniqueness |

These cover R-002 (cache corruption) and basic state management. The test design above identifies **gaps** — particularly RLS security (R-001), optimistic UI (R-003), E2E flow, accessibility (R-007), and session resume (R-004).

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/` (product requirements)
- Epic: `_bmad-output/planning-artifacts/epics/epic-1-foundation-solo-scripture-reading.md`
- Architecture: `_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`
- Story 1.1: `_bmad-output/implementation-artifacts/1-1-database-schema-and-backend-infrastructure.md`

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
