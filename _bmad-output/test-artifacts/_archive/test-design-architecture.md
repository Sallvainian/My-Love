# Test Design for Architecture: Scripture Reading for Couples

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by Architecture/Dev teams. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-01-28
**Author:** TEA (Test Engineer Agent)
**Status:** Architecture Review Pending
**Project:** My-Love
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md`

---

## Executive Summary

**Scope:** Scripture Reading feature - Solo and Together modes with real-time sync, reflections, and Daily Prayer Report

**Business Context** (from PRD):
- **Revenue/Impact:** Couples engagement and retention - core relationship ritual
- **Problem:** Couples need a "safe-to-be-honest" ritual for connection and repair
- **GA Launch:** MVP timeline pending

**Architecture** (from ADR):
- **Key Decision 1:** Supabase Broadcast for real-time Together mode sync
- **Key Decision 2:** Server-authoritative state with version-based concurrency control
- **Key Decision 3:** IndexedDB as read cache with optimistic UI (server is source of truth)
- **Key Decision 4:** Normalized 5-table schema with session-based RLS

**Expected Scale** (from ADR):
- Couples app with gradual growth; standard Supabase scaling sufficient

**Risk Summary:**
- **Total risks**: 9
- **High-priority (score >=6)**: 3 risks requiring immediate mitigation
- **Test effort**: ~100-150 tests (~3-5 weeks for 1 QA)

---

## Quick Guide

### BLOCKERS - Team Must Decide (Can't Proceed Without)

**Sprint 0 Critical Path** - These MUST be completed before QA can write integration tests:

1. **R-001: Test Data Seeding API** - Backend must implement `/api/test-data` endpoints for session, reflection, and message seeding (recommended owner: Backend Dev)
2. **R-002: Supabase Broadcast Mock** - Need mock/stub strategy for Broadcast channels in CI (recommended owner: Backend Dev + QA)
3. **R-008: Centralized dbSchema.ts** - Tech debt fix required before IndexedDB caching works reliably (recommended owner: Backend Dev)

**What we need from team:** Complete these 3 items in Sprint 0 or test development is blocked.

---

### HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R-003: Race Condition Prevention** - Server-authoritative state with `expected_version` validation looks solid; recommend testing version mismatch scenarios extensively (Sprint 1)
2. **R-004: Reconnection Handling** - Broadcast reconnection with state resync defined; recommend chaos testing (periodic disconnect) in staging (Sprint 1-2)
3. **R-005: IndexedDB Cache Corruption** - Recovery strategy defined (clear and refetch); recommend automated recovery validation (Sprint 1)

**What we need from team:** Review recommendations and approve (or suggest changes).

---

### INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy**: ~70% API/Unit, ~20% Integration, ~10% E2E (API-heavy architecture)
2. **Tooling**: Playwright + @seontechnologies/playwright-utils (configured)
3. **Tiered CI/CD**: PR (~10-15 min), Nightly (performance), Weekly (chaos)
4. **Coverage**: ~100-150 test scenarios prioritized P0-P3 with risk-based classification
5. **Quality gates**: P0 100%, P1 >=95%, high-risk mitigations complete

**What we need from team:** Just review and acknowledge (we already have the solution).

---

## For Architects and Devs - Open Topics

### Risk Assessment

**Total risks identified**: 9 (3 high-priority score >=6, 4 medium, 2 low)

#### High-Priority Risks (Score >=6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|-------------|--------|-------|------------|-------|----------|
| **R-001** | **TECH** | No test data seeding APIs for sessions, reflections, messages | 3 | 3 | **9** | Implement `/api/test-data` endpoints (dev/staging only) | Backend Dev | Sprint 0 |
| **R-002** | **TECH** | Supabase Broadcast cannot be mocked in CI | 3 | 2 | **6** | Create mock broadcast channel for CI tests | Backend Dev + QA | Sprint 0 |
| **R-003** | **DATA** | Race conditions in Together mode lock-in and phase advancement | 2 | 3 | **6** | Version-based concurrency control already in ADR; extensive testing needed | QA | Sprint 1 |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
|---------|----------|-------------|-------------|--------|-------|------------|-------|
| R-004 | TECH | Broadcast reconnection may lose state during network flaps | 2 | 2 | 4 | Server resync on reconnect (defined in ADR) | Backend Dev |
| R-005 | DATA | IndexedDB cache corruption could block feature | 2 | 2 | 4 | Clear cache and refetch (defined in ADR) | Backend Dev |
| R-006 | SEC | RLS policies may have gaps for partner data isolation | 2 | 2 | 4 | Session-based RLS pattern; penetration testing | Security + QA |
| R-007 | PERF | Real-time sync latency may exceed 500ms target | 2 | 2 | 4 | Monitor P95 latency; optimize if needed | Backend Dev |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
|---------|----------|-------------|-------------|--------|-------|--------|
| R-008 | TECH | dbSchema.ts centralization is tech debt affecting reliability | 1 | 2 | 2 | Address in Sprint 0 as prerequisite |
| R-009 | OPS | Feature flag for gradual rollout not defined | 1 | 1 | 1 | Add feature flag if needed post-MVP |

#### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

---

### Testability Concerns and Architectural Gaps

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
|---------|--------|--------------------------------|-------|----------|
| **No test data seeding APIs** | Cannot create test sessions, reflections, or messages programmatically | `/api/test-data` endpoints: `POST /scripture/seed-session`, `POST /scripture/seed-reflection`, `POST /scripture/seed-message` | Backend Dev | Sprint 0 |
| **Supabase Broadcast not mockable** | Cannot run Together mode tests in CI | Mock broadcast channel implementation OR Supabase local instance in CI | Backend Dev + DevOps | Sprint 0 |
| **IndexedDB version management fragmented** | Existing VersionError flakiness affects all caching tests | Centralize to `src/services/dbSchema.ts` as specified in ADR | Backend Dev | Sprint 0 |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Test Customer ID Scoping**
   - **Current problem**: Tests may pollute real user data if `customer_id` not properly isolated
   - **Required change**: Ensure all queries scope by `user_id` or `session_id`; add `is_test_data` flag for cleanup
   - **Impact if not fixed**: Test data pollution, GDPR concerns
   - **Owner**: Backend Dev
   - **Timeline**: Sprint 0

2. **Idempotent Seeding Endpoints**
   - **Current problem**: No seeding mechanism exists
   - **Required change**: Implement idempotent seed RPCs: `scripture_seed_test_data(session_count, include_reflections, include_messages)`
   - **Impact if not fixed**: Slow test setup, inability to test edge cases
   - **Owner**: Backend Dev
   - **Timeline**: Sprint 0

---

### Testability Assessment Summary

#### What Works Well

- API-first design (all business logic accessible via RPCs)
- Server-authoritative state prevents client-side race conditions
- Normalized schema enables clean SQL queries for test assertions
- Session-based RLS is consistent and testable
- Zustand slice pattern enables unit testing state logic

#### Accepted Trade-offs (No Action Required)

For Scripture Reading MVP, the following trade-offs are acceptable:
- **No offline writes in Together mode** - Online-required; tests don't need offline sync scenarios
- **No push notifications** - Keep calm UX; no notification testing needed for MVP

---

### Risk Mitigation Plans (High-Priority Risks >=6)

#### R-001: No Test Data Seeding APIs (Score: 9) - CRITICAL

**Mitigation Strategy:**
1. Implement Supabase RPC `scripture_seed_test_data(session_count?, include_reflections?, include_messages?)`
2. Restrict RPC to dev/staging environments only (check environment variable)
3. Return created IDs for cleanup in test teardown
4. Include edge case presets: "user_with_completed_session", "user_mid_session_step_7", "user_with_help_flags"

**Owner:** Backend Dev
**Timeline:** Sprint 0 (Week 1)
**Status:** Planned
**Verification:** QA can call seed RPC and verify data created in <100ms

---

#### R-002: Supabase Broadcast Not Mockable (Score: 6) - HIGH

**Mitigation Strategy:**
1. Option A: Run Supabase local instance in CI (preferred - realistic testing)
2. Option B: Create broadcast channel mock that simulates message delivery
3. Document mock behavior for QA to understand limitations

**Owner:** Backend Dev + DevOps
**Timeline:** Sprint 0 (Week 1-2)
**Status:** Planned
**Verification:** CI can run Together mode happy path test with mock/local Supabase

---

#### R-003: Race Conditions in Together Mode (Score: 6) - HIGH

**Mitigation Strategy:**
1. ADR already specifies version-based concurrency control (`expected_version` in RPCs)
2. QA will create dedicated race condition test suite:
   - Concurrent lock-ins from both partners
   - Stale client attempting phase advance
   - Network latency simulation (delay responses)
3. All race condition tests must pass 100/100 runs (flakiness = fail)

**Owner:** QA (test creation), Backend Dev (RPC hardening if issues found)
**Timeline:** Sprint 1
**Status:** Planned
**Verification:** Race condition test suite passes 100/100 in CI

---

### Assumptions and Dependencies

#### Assumptions

1. Supabase Realtime Broadcast channel limits are sufficient for couples use (2 users per channel)
2. IndexedDB storage quotas are sufficient for scripture reading cache (~1MB expected)
3. Network latency for Broadcast is typically <500ms in production

#### Dependencies

1. Supabase local or mock - Required by Sprint 0 Week 2
2. Backend seed RPCs - Required by Sprint 0 Week 1
3. dbSchema.ts centralization - Required by Sprint 0 Week 1

#### Risks to Plan

- **Risk**: Supabase Broadcast behavior differs in CI vs production
  - **Impact**: False positives/negatives in Together mode tests
  - **Contingency**: Run critical Together mode tests against staging environment nightly

---

**End of Architecture Document**

**Next Steps for Architecture Team:**
1. Review Quick Guide (BLOCKERS/HIGH PRIORITY/INFO ONLY) and prioritize blockers
2. Assign owners and timelines for high-priority risks (>=6)
3. Validate assumptions and dependencies
4. Provide feedback to QA on testability gaps

**Next Steps for QA Team:**
1. Wait for Sprint 0 blockers to be resolved
2. Refer to companion QA doc (test-design-qa.md) for test scenarios
3. Begin test infrastructure setup (factories, fixtures, environments)
