# Test Design: Epic 1 - Scripture Reading Foundation & Solo Mode

**Date:** 2026-01-27
**Author:** Salvain
**Status:** Draft

---

## Executive Summary

**Scope:** Full test design for Epic 1

**Epic Description:** Users can access Scripture Reading, start solo sessions, progress through all 17 steps at their own pace, and complete sessions with reflections. Creates all foundational database tables (5 Supabase tables), Zustand slice, IndexedDB stores, services, and core UI components. Delivers complete offline-capable solo experience.

**Stories Covered:** 1.1-1.10

**FRs Covered:** FR1, FR1a, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR30, FR31, FR32, FR33, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49

**Risk Summary:**

- Total risks identified: 6
- High-priority risks (>=6): 0 (reduced via online-only architecture decision)
- Critical categories: TECH, SEC, BUS

**Architecture Decision:** Online-required with optimistic UI. Offline-first sync removed - if user is doing Scripture Reading, they need internet for partner communication anyway.

**Coverage Summary:**

- P0 scenarios: 14 (~18-25 hours)
- P1 scenarios: 21 (~16-26 hours)
- P2/P3 scenarios: 15 (~5-12 hours)
- **Total effort**: ~39-63 hours (~1-1.5 weeks)

---

## Risk Assessment

### High-Priority Risks (Score >=6)

**None** - Online-only architecture decision eliminated high-priority risks.

| Risk ID | Original Score | New Status | Rationale |
|---------|----------------|------------|-----------|
| R-E1-001 | 6 | **ELIMINATED** | No offline writes = no sync data loss risk |
| R-E1-002 | 6 | **REDUCED to 2** | IndexedDB is cache-only; corruption = clear & refetch |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-E1-002 | TECH | IndexedDB v5 migration fails - Cache-only stores; corruption recoverable via clear & refetch | 1 | 2 | 2 | Create centralized dbSchema.ts; on failure, clear cache and refetch | Backend |
| R-E1-003 | TECH | Network drops mid-reflection - Transient failure could lose unsaved data | 2 | 2 | 4 | Optimistic UI with 3x retry; warn before navigating with unsaved changes | Frontend |
| R-E1-004 | BUS | Stats calculation incorrect for couple aggregate - Partner data not included correctly in stats queries | 2 | 2 | 4 | Add comprehensive stats calculation tests; verify both user and partner data aggregated | Backend |
| R-E1-005 | SEC | Unlinked user can access Together mode via direct URL - UI disabled but API not protected | 2 | 2 | 4 | Add server-side partner validation in session creation RPC | Backend |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-E1-006 | OPS | Test data seeding RPC exposed in production | 1 | 2 | 2 | Add environment check to RPC; block in production |
| R-E1-007 | BUS | Reflection note truncation not visible to user | 1 | 1 | 1 | Add character counter UI; verify truncation feedback |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

## Test Coverage Plan

**References:**
- Architecture blockers: See [Architecture doc Quick Guide](test-design-architecture.md#quick-guide)
- System-level test scenarios: See [QA doc](test-design-qa.md)

### P0 (Critical) - Core Paths

**Criteria**: Blocks core journey + High risk (>=6) + No workaround

#### Story 1.1: Navigation Entry Point (~3 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P0-E1-001 | Bottom nav includes Scripture icon and navigates correctly | E2E | - | FR1a verification |
| P0-E1-002 | Unlinked user sees "Link your partner" message with Solo available | E2E | R-E1-005 | FR4, FR48 |
| P0-E1-003 | Partner link detection works correctly | API | - | FR47 |

#### Story 1.2: Data Foundation (~5 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P0-E1-004 | IndexedDB migrates to v5 with 5 new stores, existing data preserved | API | R-E1-002 | Critical migration |
| P0-E1-005 | All 5 Supabase tables created with correct schema | API | - | Tables exist with columns |
| P0-E1-006 | RLS on scripture_sessions: user can only access own sessions | API | - | Security critical |
| P0-E1-007 | RLS on scripture_reflections: user sees own + shared partner | API | - | Privacy critical |
| P0-E1-008 | scriptureReadingService CRUD operations work offline | API | R-E1-001 | Offline-first |

#### Story 1.3: Solo Session UI (~2 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P0-E1-009 | User can start Solo session, record created in IndexedDB | E2E | - | FR2, FR3 |
| P0-E1-010 | Solo session starts at step 0, phase 'reading' | API | - | Correct initial state |

#### Story 1.6: Reflection Submission (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P0-E1-011 | Reflection saves with rating, help flag, notes to IndexedDB | API | R-E1-001 | FR11, FR30-32 |
| P0-E1-012 | Reflection requires rating before submit (validation) | E2E | - | FR30 |
| P0-E1-013 | Idempotent upsert: re-submitting same step updates, no duplicate | API | - | NFR-R6 |
| P0-E1-014 | Step 16 reflection triggers session completion | API | - | FR7 |

#### Story 1.9: Network Detection & Optimistic UI (~2 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P0-E1-015 | Offline state shows "No connection" indicator | E2E | R-E1-003 | Graceful degradation |
| P0-E1-016 | Transient network failure retries 3x then shows error | API | R-E1-003 | Optimistic UI |

**Total P0**: 14 tests

---

### P1 (High) - Feature Flows

**Criteria**: Important features + Medium risk (3-4) + Common workflows

#### Story 1.4: Verse Reading Flow (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-001 | User sees verse text with Playfair Display 20px | E2E | - | FR9, typography |
| P1-E1-002 | "I've read this" advances to response phase | E2E | - | FR9 phase transition |
| P1-E1-003 | Progress indicator shows "Verse X of 17" correctly | E2E | - | FR26 |
| P1-E1-004 | Content loading error shows retry option | E2E | - | Error handling |

#### Story 1.5: Response Display Flow (~3 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-005 | Response text displays after marking verse read | E2E | - | FR10 |
| P1-E1-006 | "Back to Verse" navigation works within step | E2E | - | Free navigation |
| P1-E1-007 | "Continue to Reflection" advances phase correctly | E2E | - | FR10 |

#### Story 1.6: Reflection (extended) (~3 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-008 | Rating scale shows 1-5 with accessible labels | E2E | - | FR30, FR33 |
| P1-E1-009 | Help flag toggle saves correctly | E2E | - | FR31 |
| P1-E1-010 | Note truncated at 200 chars with counter | E2E | R-E1-007 | FR32 |

#### Story 1.7: Session Completion & Exit (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-011 | Exit confirmation dialog appears on close | E2E | - | FR5 |
| P1-E1-012 | Exit saves progress, session remains active | E2E | R-E1-003 | FR12 |
| P1-E1-013 | Completion screen shows after step 16 | E2E | - | FR7 |
| P1-E1-014 | Force close preserves session state | E2E | R-E1-003 | Crash recovery |

#### Story 1.8: Resume Session UI (~3 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-015 | "Continue Session" card shows for active session | E2E | - | FR6 |
| P1-E1-016 | Resume loads correct step and phase | E2E | - | FR6 |
| P1-E1-017 | Most recent session shown if multiple active | E2E | - | Edge case |

#### Story 1.10: Overview Page with Stats (~5 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P1-E1-018 | Total sessions count displays correctly | E2E | R-E1-004 | FR42 |
| P1-E1-019 | Average rating calculated (1.0-5.0, one decimal) | API | R-E1-004 | FR45 |
| P1-E1-020 | Help requests count accurate | API | R-E1-004 | FR46 |
| P1-E1-021 | Stats load from cache when available | E2E | - | Cache performance |
| P1-E1-022 | Stats loading/error states handled | E2E | - | UX |

**Total P1**: 21 tests

---

### P2 (Medium) - Edge Cases

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| P2-E1-001 | Partner linking mid-session enables Together option | E2E | - | Dynamic state |
| P2-E1-002 | Empty note allowed (optional field) | E2E | - | FR32 |
| P2-E1-003 | Rating 1-5 boundary validation | API | - | Invalid rejected |
| P2-E1-004 | Step index 0-16 boundary validation | API | - | Invalid rejected |
| P2-E1-005 | IndexedDB quota exceeded shows warning | E2E | - | Graceful error |
| P2-E1-006 | Large sync queue (50+ items) processes correctly | API | - | Batch handling |
| P2-E1-007 | Browser refresh preserves session state | E2E | R-E1-003 | Recovery |
| P2-E1-008 | Navigate to partner linking works | E2E | - | FR49 |

**Total P2**: 8 tests

---

### P3 (Low) - Nice-to-have

**Criteria**: Exploratory + Performance + Documentation

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| P3-E1-001 | Initial feature load <2s on 3G | Perf | NFR-P3 |
| P3-E1-002 | Phase transition <200ms perceived | Perf | NFR-P2 |
| P3-E1-003 | Touch targets >=48px | E2E | Accessibility |
| P3-E1-004 | Lavender Dreams theme colors correct | Visual | #A855F7 primary |
| P3-E1-005 | All 17 steps have verse+response content | API | Content completeness |
| P3-E1-006 | scripture_seed_test_data RPC works | API | Test infrastructure |
| P3-E1-007 | Test data cleanup works | API | Test infrastructure |

**Total P3**: 7 tests

---

## Execution Order

### Smoke Tests (<5 min)

**Purpose**: Fast feedback, catch build-breaking issues

- [ ] P0-E1-001: Bottom nav includes Scripture (30s)
- [ ] P0-E1-005: Supabase tables exist (30s)
- [ ] P0-E1-009: Can start Solo session (1min)

**Total**: 3 scenarios

### P0 Tests (<10 min)

**Purpose**: Critical path validation

- [ ] All 14 P0 scenarios (parallelized)
- [ ] Focus: Data foundation, network handling, security

**Total**: 14 scenarios

### P1 Tests (<15 min)

**Purpose**: Feature flow coverage

- [ ] All 21 P1 scenarios (parallelized)
- [ ] Focus: Complete user journeys, stats, resume

**Total**: 21 scenarios

### P2/P3 Tests (<10 min)

**Purpose**: Edge case and regression coverage

- [ ] All 15 P2/P3 scenarios (parallelized)
- [ ] Focus: Edge cases, validation, performance

**Total**: 15 scenarios

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
|----------|-------|------------|-------------|-------|
| P0 | 14 | 1.25-1.75 | ~18-25 | Simpler: no offline sync complexity |
| P1 | 21 | 0.75-1.25 | ~16-26 | Standard: flows, UI validation |
| P2 | 8 | 0.5-1.0 | ~4-8 | Edge cases |
| P3 | 7 | 0.25-0.5 | ~2-4 | Simple: perf, visual |
| **Total** | **50** | **-** | **~39-63** | **~1-1.5 weeks** |

### Prerequisites

**Test Data:**

- sessionFactory (faker-based, auto-cleanup)
- reflectionFactory (all 17 steps)
- userFactory (with/without partner linking)

**Tooling:**

- Playwright for E2E/API tests
- @seontechnologies/playwright-utils for API fixtures
- k6 for performance tests (P3 only)

**Environment:**

- IndexedDB v5 migration completed
- Supabase tables deployed with RLS
- scripture_seed_test_data RPC available

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: >=95% (waivers required for failures)
- **P2/P3 pass rate**: >=90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: >=80%
- **Security scenarios**: 100%
- **Offline scenarios**: 100%
- **Edge cases**: >=50%

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (>=6) items unmitigated (currently: 0)
- [ ] Network error handling tests pass 100%
- [ ] IndexedDB cache migration tests pass 100%

---

## Mitigation Plans

### R-E1-003: Network Drops Mid-Reflection (Score: 4)

**Mitigation Strategy:**
1. Optimistic UI: show success immediately, POST in background
2. Retry 3x with 2s delay on network error
3. If still failing after retries: show toast "Couldn't save, please try again"
4. Warn user before navigation if unsaved changes exist
5. Keep unsaved reflection in component state (not IndexedDB)

**Owner:** Frontend
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** E2E test: submit reflection, simulate network drop, verify retry and error handling

### R-E1-002: IndexedDB Migration (Reduced to Score: 2)

**Mitigation Strategy:**
1. Create centralized dbSchema.ts with single DB_VERSION constant
2. IndexedDB is cache-only; on corruption, clear cache and refetch from Supabase
3. No complex rollback needed - server is source of truth

**Owner:** Backend
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Migration test: trigger upgrade, verify stores created; on failure, verify cache clear works

---

## Assumptions and Dependencies

### Assumptions

1. **Online-required architecture** - App requires internet; IndexedDB is cache-only
2. IndexedDB centralized schema (dbSchema.ts) completed before Epic 1 development starts
3. Supabase migration with 5 tables deployed before Story 1.2
4. Playwright Utils available with API fixtures
5. Static scripture content (17 steps) available as JSON

### Dependencies

1. **dbSchema.ts** - Required by Sprint 0 Week 1
2. **Supabase tables** - Required by Sprint 0 Week 2
3. **scripture_seed_test_data RPC** - Required by Sprint 1 start
4. **System-level test design approved** - Required before Epic 1 QA starts

### Risks to Plan

- **Risk**: IndexedDB migration takes longer than expected
  - **Impact**: Delays all Story 1.2+ testing
  - **Contingency**: Parallelize with mock IndexedDB for unit tests

- **Risk**: Offline sync edge cases more complex than estimated
  - **Impact**: P0 sync tests take 2x longer
  - **Contingency**: Prioritize happy path sync; defer edge cases to P2

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once implementation exists.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: _______ Date: _______
- [ ] Tech Lead: _______ Date: _______
- [ ] QA Lead: _______ Date: _______

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md`
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 1 section)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- System-level Test Design: `_bmad-output/test-design-architecture.md`, `_bmad-output/test-design-qa.md`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
