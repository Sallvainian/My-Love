# Test Design for Architecture: Scripture Reading for Couples

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-01-27
**Author:** TEA (Test Engineering Agent)
**Status:** Architecture Review Pending
**Project:** My-Love
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md`

---

## Executive Summary

**Scope:** Scripture Reading feature - a guided spiritual activity where couples read scripture together (synchronized real-time) or solo, with reflection tracking, help flags, and a "daily prayer report" summary. 17 scripture steps across themes of healing, forgiveness, confession, peace, words, and character.

**Business Context** (from PRD):
- **Revenue/Impact:** Engagement retention (7-day return >=50%, 30-day >=30%)
- **Problem:** Couples need a calm, "safe-to-be-honest" ritual for connection and repair
- **GA Launch:** MVP Phase 1

**Architecture** (from ADR):
- **Decision 1:** 5 normalized Supabase tables with RLS
- **Decision 2:** Hybrid sync (server-authoritative + client pending state)
- **Decision 3:** Zustand slice with phase enum state machine

**Expected Scale** (from ADR):
- Couples app with gradual growth; standard Supabase scaling sufficient

**Risk Summary:**
- **Total risks**: 8
- **High-priority (>=6)**: 3 risks requiring immediate mitigation
- **Test effort**: ~80-120 tests (~2-3 weeks for 1 QA)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Sprint 0 Critical Path** - These MUST be completed before QA can write integration tests:

1. **B-001: IndexedDB Centralized Schema** - Create `src/services/dbSchema.ts` with single version source of truth before adding 5 new stores (recommended owner: Backend/Dev)
2. **B-002: Supabase Migration with RLS** - Deploy `scripture_sessions`, `scripture_reflections`, `scripture_step_states`, `scripture_bookmarks`, `scripture_messages` tables with RLS policies (recommended owner: Backend)
3. **B-003: Test Data Seeding API** - Provide method to seed test sessions/reflections for parallel test execution (recommended owner: Backend)

**What we need from team:** Complete these 3 items in Sprint 0 or test development is blocked.

---

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R-001: Race Condition Prevention** - Validate version-based optimistic locking prevents double-advances in Together mode (Architecture review Sprint 1)
2. **R-002: Broadcast Channel Authorization** - Confirm Supabase Broadcast doesn't leak session events to unauthorized users (Security review Sprint 1)
3. **R-003: Offline Sync Conflict Resolution** - Validate last-write-wins strategy doesn't cause data loss in edge cases (Dev review Sprint 1)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: 60/30/10 API/E2E/Unit (real-time sync is API-testable, E2E for critical user journeys)
2. **Tooling**: Playwright for E2E/API tests with `@seontechnologies/playwright-utils`
3. **Tiered CI/CD**: All Playwright tests in PR (~10-15 min parallelized), performance tests nightly
4. **Coverage**: ~80-120 test scenarios prioritized P0-P3 with risk-based classification
5. **Quality gates**: P0 100% pass, P1 >=95%, no unmitigated high-risk items

**What we need from team:** Just review and acknowledge (we already have the solution).

---

## For Architects and Devs - Open Topics

### Risk Assessment

**Total risks identified**: 8 (3 high-priority score >=6, 3 medium, 2 low)

#### High-Priority Risks (Score >=6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **R-001** | **TECH** | Race conditions in Together mode lock-in causing double-advances or stuck sessions | 2 | 3 | **6** | Server-authoritative version check; reject stale mutations with 409 | Backend | Sprint 0 |
| **R-002** | **SEC** | Broadcast channel could leak session events to non-participants | 2 | 3 | **6** | Validate session membership on channel subscription; audit RLS | Security | Sprint 0 |
| **R-003** | **DATA** | Offline sync conflicts could lose reflections when both devices edit same step | 2 | 3 | **6** | Last-write-wins with `updated_at`; log conflicts for debugging | Backend | Sprint 1 |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-004 | TECH | IndexedDB VersionError from non-centralized schema | 2 | 2 | 4 | Create `dbSchema.ts` as single source of truth | Backend |
| R-005 | PERF | Real-time sync latency exceeds 500ms SLO under load | 2 | 2 | 4 | Test with 100+ concurrent sessions; optimize broadcast payload | Backend |
| R-006 | OPS | Partner reconnection fails to resync state correctly | 2 | 2 | 4 | Server-authoritative resync on reconnection; test offline scenarios | Backend |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-007 | BUS | User completes partial session offline, partner unaware | 1 | 2 | 2 | Monitor; Solo sessions sync asynchronously by design |
| R-008 | OPS | sw-db.ts manual sync with dbSchema.ts forgotten | 1 | 1 | 1 | Add comment warning; document in tech debt |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Architecture Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
|---------|--------|--------------------------------|-------|----------|
| **No test data seeding API** | Cannot create sessions/reflections programmatically for tests; tests slow and coupled | Provide `scriptureReadingService.seedTestSession()` or RPC `scripture_seed_test_data` | Backend | Sprint 0 |
| **IndexedDB version conflicts** | Existing VersionError flakiness will affect new stores; parallel test execution unreliable | Complete centralized `dbSchema.ts` before adding scripture stores | Backend | Sprint 0 |
| **Broadcast channel mocking** | Cannot unit test real-time sync without live Supabase connection | Provide mock broadcast channel adapter for testing | Backend | Sprint 1 |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Centralized IndexedDB Schema**
   - **Current problem**: Multiple services use different DB versions causing VersionError
   - **Required change**: Create `src/services/dbSchema.ts` with single `DB_VERSION` constant; all services import from there
   - **Impact if not fixed**: Flaky tests, unreliable offline mode, regression risk
   - **Owner**: Backend
   - **Timeline**: Sprint 0

2. **Session Cleanup for Tests**
   - **Current problem**: No mechanism to delete test sessions/reflections after test runs
   - **Required change**: Add soft-delete or hard-delete RPC for test cleanup (protected by test environment flag)
   - **Impact if not fixed**: Test data accumulates; tests become slower; database bloat
   - **Owner**: Backend
   - **Timeline**: Sprint 0

3. **Deterministic Countdown Testing**
   - **Current problem**: 3-second countdown is wall-clock based; tests must wait real time
   - **Required change**: Accept optional `countdown_start_time` in test mode to fast-forward
   - **Impact if not fixed**: Slow E2E tests; flaky timing-dependent assertions
   - **Owner**: Frontend
   - **Timeline**: Sprint 1

---

### Testability Assessment Summary

**📊 CURRENT STATE - FYI**

#### What Works Well

- API-first design with server-authoritative state supports parallel test execution
- Zustand slice pattern enables isolated unit testing of state logic
- Session-based RLS pattern allows clean test isolation per session
- Explicit phase enum (`lobby | countdown | reading | reflection | report | complete`) makes assertions straightforward
- Existing brownfield patterns (MoodService, SyncService) provide proven templates

#### Accepted Trade-offs (No Action Required)

For Scripture Reading Phase 1, the following trade-offs are acceptable:
- **Together mode is online-required** - Solo covers offline; Together can be tested in online integration environment only
- **Last-write-wins for sync conflicts** - Edge case; logging sufficient for debugging
- **Manual sw-db.ts sync** - Documented; Service Worker can't import idb library

---

### Risk Mitigation Plans (High-Priority Risks >=6)

**Purpose**: Detailed mitigation strategies for all 3 high-priority risks (score >=6). These risks MUST be addressed before MVP launch.

#### R-001: Race Conditions in Together Mode Lock-In (Score: 6) - HIGH

**Mitigation Strategy:**
1. Implement `expected_version` parameter on all state-mutating RPCs (`scripture_lock_in`, `scripture_advance_phase`)
2. Reject mutations where `expected_version != current_version` with HTTP 409
3. Client rollback on 409: refetch session state, update local cache, retry with new version
4. Add unique constraint on `scripture_step_states(session_id, step_index, user_id)`

**Owner:** Backend
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** E2E test simulating concurrent lock-in from two clients; verify no double-advance

---

#### R-002: Broadcast Channel Authorization (Score: 6) - HIGH

**Mitigation Strategy:**
1. Validate session membership on Supabase Broadcast channel subscription (server-side RLS check)
2. Include `session_id` and `user_id` in broadcast payload; clients ignore events for wrong session
3. Security audit: attempt to subscribe to another user's session channel; verify rejection
4. Add RLS policy on broadcast channel if Supabase supports it

**Owner:** Security
**Timeline:** Sprint 0
**Status:** Planned
**Verification:** Security test attempting unauthorized channel subscription; verify 403

---

#### R-003: Offline Sync Conflict Resolution (Score: 6) - HIGH

**Mitigation Strategy:**
1. Use `updated_at` timestamp for last-write-wins conflict resolution
2. Log all conflicts to `scripture_sync_conflicts` table for debugging (session_id, user_id, local_value, server_value, resolved_at)
3. Silent resolution: no user notification required for reflection conflicts (user's own data)
4. Edge case: if both partners edit same step offline simultaneously, most recent wins; other is logged

**Owner:** Backend
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Integration test: two devices edit same reflection offline, reconnect, verify one wins and both synced correctly

---

### Assumptions and Dependencies

#### Assumptions

1. Supabase Realtime Broadcast supports session-scoped channels (verified in existing codebase)
2. IndexedDB quota is sufficient for storing 17-step sessions locally (typical session ~50KB)
3. RLS policies can enforce session-based access without performance degradation
4. Playwright can test Supabase Broadcast via WebSocket interception or integration mode

#### Dependencies

1. **Centralized dbSchema.ts** - Required by Sprint 0 start
2. **Supabase migration deployed** - Required by Sprint 0 week 2
3. **Test data seeding mechanism** - Required by Sprint 1 start
4. **Playwright Utils configured** - Required by Sprint 1 (existing dependency, should be available)

#### Risks to Plan

- **Risk**: Supabase Broadcast doesn't support channel-level authorization
  - **Impact**: Cannot guarantee R-002 mitigation; may need application-level validation
  - **Contingency**: Add client-side validation + server-side audit logging

- **Risk**: IndexedDB VersionError persists despite centralization
  - **Impact**: Offline tests remain flaky
  - **Contingency**: Reset IndexedDB before each test run; accept slower test execution

---

**End of Architecture Document**

**Next Steps for Architecture Team:**
1. Review Quick Guide (blockers/high priority) and assign owners
2. Complete Sprint 0 blockers (dbSchema.ts, Supabase migration, test seeding)
3. Validate assumptions about Broadcast channel authorization
4. Provide feedback on testability gaps

**Next Steps for QA Team:**
1. Wait for Sprint 0 blockers to be resolved
2. Refer to companion QA doc (test-design-qa.md) for test scenarios
3. Begin test infrastructure setup (factories, fixtures, environments)
