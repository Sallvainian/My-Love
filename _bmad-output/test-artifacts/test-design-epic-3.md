---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-02-17'
---

# Test Design: Epic 3 - Stats & Overview Dashboard

**Date:** 2026-02-17
**Author:** Sallvain
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 3 (Story 3.1: Couple-Aggregate Stats Dashboard)

**Risk Summary:**

- Total risks identified: 6
- High-priority risks (score >=6): 1 (SECURITY DEFINER RPC data isolation)
- Critical categories: SEC, DATA, PERF

**Coverage Summary:**

- P0 scenarios: 3 (~4-6 hours)
- P1 scenarios: 8 (~6-10 hours)
- P2/P3 scenarios: 8 (~4-7 hours)
- **Total effort**: ~14-23 hours (~2-3 days)

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Together mode stats** | Epic 3 is couple-aggregate only; no per-partner breakdown | Future epic if needed |
| **Stats export/sharing** | Not in AC; stats are view-only on overview page | Feature flag if requested later |
| **Historical trend charts** | Not in AC; only current aggregate values displayed | Could be a future story |
| **Offline stats computation** | Architecture is online-first; stats require server RPC | Zustand persist shows cached stats; no offline write path |

---

## Risk Assessment

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **E3-R01** | **SEC** | SECURITY DEFINER RPC bypasses RLS — flawed auth.uid() validation could expose other couples' data | 2 | 3 | **6** | pgTAP isolation test: user A must never see couple B's stats | QA + Dev | Sprint 1 |

### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| E3-R02 | DATA | Aggregate SQL bugs (wrong JOINs, missing filters, double-counting) produce incorrect metrics | 2 | 2 | 4 | pgTAP tests with known seed data; verify each metric independently | QA |
| E3-R03 | PERF | RPC aggregates across sessions + reflections + bookmarks — may exceed NFR-P3 (<2s on 3G) | 2 | 2 | 4 | Index on scripture_sessions(status); measure RPC execution time | Dev |
| E3-R06 | SEC | Partner detection misidentifies partner — stats aggregate wrong couple's data | 1 | 3 | 3 | Partner detection well-tested in Epics 1-2; E2E validates correct couple data | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| E3-R04 | BUS | Stale Zustand persist cache shows outdated stats if RPC fails silently | 2 | 1 | 2 | Document — stats are informational; cached data acceptable |
| E3-R05 | BUS | Zero-state shows errors instead of graceful dashes + "Begin your first reading" | 1 | 2 | 2 | Unit test zero-state rendering |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Entry Criteria

- [ ] Story 3.1 accepted and in-progress
- [ ] `scripture_get_couple_stats` RPC migration applied to local Supabase
- [ ] Local Supabase running (`supabase start`)
- [ ] Existing Epic 1-2 E2E tests passing (no regressions)
- [ ] Test data seeding available (scripture_seed_test_data RPC or manual setup)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing (>=95%)
- [ ] E3-R01 security test (3.1-DB-001) passes — no cross-couple data leak
- [ ] No open high-severity bugs related to stats
- [ ] Coverage >= 80% for new code (StatsSection, service method, slice additions)

---

## Test Coverage Plan

> **Note:** P0/P1/P2/P3 indicate risk-based priority, NOT execution timing. See Execution Strategy for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| 3.1-DB-001 | RPC data isolation: user A cannot see couple B's stats | Database (pgTAP) | E3-R01 | SECURITY DEFINER bypass validation |
| 3.1-DB-002 | RPC returns correct aggregate metrics for known seed data | Database (pgTAP) | E3-R02 | Verify all 5 metrics independently |
| 3.1-E2E-001 | Overview shows stats after completing a session | E2E | — | Full user journey with seeded completed sessions |

**Total P0**: 3 tests, ~4-6 hours

### P1 (High)

**Criteria:** Important features + Medium risk + Common workflows

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| 3.1-UNIT-001 | StatsSection renders 5 stat cards with correct values | Unit | — | AC#1: all 5 metrics visible |
| 3.1-UNIT-002 | StatsSection skeleton loading (isLoading=true, stats=null) | Unit | — | AC#3: loading state |
| 3.1-UNIT-003 | StatsSection stale-while-revalidate (cached stats + isLoading) | Unit | — | AC#3: shows cached data during refresh |
| 3.1-UNIT-004 | StatsSection zero-state: dashes + "Begin your first reading" | Unit | — | AC#2: empty state UX |
| 3.1-UNIT-005 | Service getCoupleStats() calls RPC, returns typed object | Unit | — | AC#1: service layer |
| 3.1-UNIT-006 | Service getCoupleStats() returns null on RPC failure | Unit | — | Error handling convention |
| 3.1-UNIT-007 | Slice loadCoupleStats() state flow (loading -> loaded) | Unit | — | AC#3: state management |
| 3.1-E2E-002 | Overview shows zero-state when no completed sessions | E2E | E3-R05 | AC#2: new user experience |

**Total P1**: 8 tests, ~6-10 hours

### P2 (Medium)

**Criteria:** Secondary features + Low risk + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| 3.1-UNIT-008 | Stat labels contain no gamification language | Unit | — | AC#5: tone compliance |
| 3.1-UNIT-009 | Last completed date renders as relative time (e.g., "3 days ago") | Unit | — | AC#1: date formatting |
| 3.1-UNIT-010 | Average rating renders with 1 decimal place | Unit | — | AC#1: number formatting |
| 3.1-UNIT-011 | Glass morphism card classes present (backdrop-blur, white/80%) | Unit | — | AC#5: design compliance |
| 3.1-UNIT-012 | Stat values have aria-label attributes | Unit | — | Accessibility |
| 3.1-DB-003 | RPC returns zeros/nulls for couple with no sessions | Database (pgTAP) | — | AC#2: DB-level zero-state |

**Total P2**: 6 tests, ~3-5 hours

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| 3.1-PERF-001 | RPC execution time <500ms | Database | E3-R03: performance baseline |
| 3.1-UNIT-013 | Zod schema validates RPC response shape | Unit | Schema correctness |

**Total P3**: 2 tests, ~1-2 hours

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless expensive or long-running. Playwright parallelization handles 100s of tests in 10-15 minutes.

| Trigger | What Runs | Estimated Time |
|---------|-----------|----------------|
| **Every PR** | All unit tests + DB tests + E2E P0-P1 | <5 min |
| **Nightly** | Full suite including P2-P3 + performance benchmark | ~10-15 min |

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Total Hours | Notes |
|----------|-------|-------------|-------|
| P0 | 3 | ~4-6 | pgTAP security + RPC correctness + E2E journey |
| P1 | 8 | ~6-10 | Component/service/slice unit tests + E2E zero-state |
| P2 | 6 | ~3-5 | Accessibility, formatting, design compliance |
| P3 | 2 | ~1-2 | Performance benchmark, schema validation |
| **Total** | **19** | **~14-23** | **~2-3 days** |

### Prerequisites

**Test Data:**

- Scripture session seed data (completed sessions with reflections and bookmarks for both partners)
- Existing `scripture_seed_test_data` RPC or manual seed via Supabase Admin API

**Tooling:**

- Vitest + happy-dom for unit/component tests
- Playwright + @seontechnologies/playwright-utils for E2E
- pgTAP via `supabase test db` for database tests
- fake-indexeddb for IndexedDB mocking in unit tests

**Environment:**

- Local Supabase running (`supabase start`)
- `.env.test` with local Supabase credentials

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: E3-R01 security test must pass before merge

### Coverage Targets

- **Critical paths (stats display)**: >=80%
- **Security scenarios (RPC isolation)**: 100%
- **Business logic (aggregation, formatting)**: >=70%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] E3-R01 (score 6) mitigated — 3.1-DB-001 passes
- [ ] Security tests (SEC category) pass 100%

---

## Mitigation Plans

### E3-R01: SECURITY DEFINER RPC Data Isolation (Score: 6)

**Mitigation Strategy:**
1. pgTAP test creates two separate couples (couple A and couple B) with distinct sessions
2. Call `scripture_get_couple_stats` as user from couple A
3. Assert returned metrics only reflect couple A's data
4. Call as user from couple B — assert only couple B's data
5. Verify RPC rejects unauthenticated calls

**Owner:** QA (test), Dev (RPC implementation)
**Timeline:** Sprint 1 (concurrent with implementation)
**Status:** Planned
**Verification:** 3.1-DB-001 passes with complete data isolation

---

## Assumptions and Dependencies

### Assumptions

1. `scripture_get_couple_stats` RPC will be implemented as SECURITY DEFINER with internal auth.uid() validation
2. Zustand persist middleware correctly caches `coupleStats` to localStorage without additional configuration
3. Partner detection (from Epics 1-2) works correctly — stats aggregate the right couple's data

### Dependencies

1. `scripture_get_couple_stats` RPC migration — Required before E2E and DB tests can run
2. Local Supabase with scripture tables — Required for all DB and E2E tests
3. Existing test infrastructure (auth-setup, merged-fixtures) — Already in place from Epics 1-2

### Risks to Plan

- **Risk**: RPC implementation changes during development (different return shape)
  - **Impact**: Zod schema and unit tests need updating
  - **Contingency**: Keep Zod schema as single source of truth; tests reference it

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **ScriptureOverview.tsx** | New StatsSection child component added | Existing overview E2E tests must still pass (navigation, mode selection, resume prompt) |
| **scriptureReadingSlice.ts** | New state fields (coupleStats, isStatsLoading) | Existing slice tests must pass (session management, phase transitions) |
| **scriptureReadingService.ts** | New getCoupleStats() method | Existing service tests must pass (CRUD, cache operations) |
| **Zustand persist** | New fields persisted to localStorage | Verify no serialization issues with existing persisted state |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework (probability x impact scoring)
- `probability-impact.md` - Risk scoring methodology (1-3 scale, thresholds)
- `test-levels-framework.md` - Test level selection (unit/integration/E2E decision matrix)
- `test-priorities-matrix.md` - P0-P3 prioritization criteria

### Related Documents

- Epic: `_bmad-output/planning-artifacts/epics/epic-3-stats-overview-dashboard.md`
- Story: `_bmad-output/implementation-artifacts/3-1-couple-aggregate-stats-dashboard.md`
- Architecture: `_bmad-output/test-design-architecture.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/tea/testarch/test-design`
**Version**: 5.0 (BMad v6)
