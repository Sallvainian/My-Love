# Test Design for QA: Scripture Reading for Couples

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-01-28
**Author:** TEA (Test Engineer Agent)
**Status:** Draft
**Project:** My-Love

**Related:** See Architecture doc (test-design-architecture.md) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Scripture Reading feature - Solo mode, Together mode, reflections, Daily Prayer Report

**Risk Summary:**
- Total Risks: 9 (3 high-priority score >=6, 4 medium, 2 low)
- Critical Categories: TECH (test infrastructure), DATA (race conditions), SEC (partner isolation)

**Coverage Summary:**
- P0 tests: ~25 (critical paths, security, data integrity)
- P1 tests: ~40 (important features, integration)
- P2 tests: ~30 (edge cases, regression)
- P3 tests: ~10 (exploratory, benchmarks)
- **Total**: ~105 tests (~3-5 weeks with 1 QA)

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### Backend/Architecture Dependencies (Sprint 0)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans

1. **R-001: Test Data Seeding API** - Backend - Sprint 0 Week 1
   - Need: `scripture_seed_test_data()` RPC
   - Blocks: All tests requiring session/reflection/message data

2. **R-002: Supabase Broadcast Mock** - Backend + DevOps - Sprint 0 Week 2
   - Need: Mock channel or Supabase local in CI
   - Blocks: All Together mode tests in CI

3. **R-008: dbSchema.ts Centralization** - Backend - Sprint 0 Week 1
   - Need: Centralized IndexedDB version management
   - Blocks: Caching and optimistic UI tests

### QA Infrastructure Setup (Sprint 0)

1. **Test Data Factories** - QA
   - Session factory with faker-based randomization
   - Reflection factory with rating/note variations
   - Message factory for Daily Prayer Report
   - Auto-cleanup fixtures for parallel safety

2. **Test Environments** - QA
   - Local: Supabase local + Vite dev server
   - CI/CD: GitHub Actions with Supabase local or mock
   - Staging: Real Supabase instance for nightly runs

**Factory pattern example:**

```typescript
import { test, expect } from '@playwright/test';
import { apiRequest } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { faker } from '@faker-js/faker';

// Session factory
export function createTestSession(overrides: Partial<ScriptureSession> = {}) {
  return {
    id: `test-session-${faker.string.uuid()}`,
    mode: 'solo' as const,
    user1_id: `test-user-${faker.string.uuid()}`,
    user2_id: null,
    current_phase: 'reading' as const,
    current_step_index: 0,
    status: 'in_progress' as const,
    version: 1,
    ...overrides,
  };
}

// Reflection factory
export function createTestReflection(sessionId: string, userId: string, stepIndex: number) {
  return {
    id: `test-reflection-${faker.string.uuid()}`,
    session_id: sessionId,
    step_index: stepIndex,
    user_id: userId,
    rating: faker.number.int({ min: 1, max: 5 }),
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    is_shared: false,
    created_at: new Date().toISOString(),
  };
}
```

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| **R-001** | TECH | No test data seeding APIs | **9** | Prerequisite - tests blocked until resolved |
| **R-002** | TECH | Supabase Broadcast not mockable | **6** | Prerequisite for Together mode tests |
| **R-003** | DATA | Race conditions in Together mode | **6** | P0: Concurrent lock-in tests, version mismatch tests |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| R-004 | TECH | Broadcast reconnection state loss | 4 | P1: Reconnection recovery tests |
| R-005 | DATA | IndexedDB cache corruption | 4 | P1: Cache corruption recovery tests |
| R-006 | SEC | RLS policy gaps | 4 | P0: Cross-user data access tests |
| R-007 | PERF | Real-time sync latency | 4 | P3: Performance benchmark tests |

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround + Affects majority of users

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-001** | User can start Solo session (FR2, FR3) | API | - | Core entry point |
| **P0-002** | User can progress through 17 steps in Solo (FR8) | E2E | - | Core user journey |
| **P0-003** | User can submit reflection per step (FR30-32) | API | - | Core data capture |
| **P0-004** | Session marked complete at step 17 (FR7) | API | - | Completion integrity |
| **P0-005** | Solo resume from saved state (FR6, FR12) | API | - | Session recovery |
| **P0-006** | Together mode lobby join (FR15-16) | API | R-002 | Sync prerequisite |
| **P0-007** | Together mode ready state sync (FR17) | API | R-002, R-003 | Race condition target |
| **P0-008** | Together mode countdown starts when both ready (FR19) | E2E | R-003 | Server-authoritative |
| **P0-009** | Phase advancement requires both reflections (FR25) | API | R-003 | Race condition target |
| **P0-010** | Reader/Responder role assignment (FR14, FR20-23) | API | - | Role integrity |
| **P0-011** | Concurrent lock-in from both partners (race) | API | R-003 | Race condition |
| **P0-012** | Version mismatch rejection (409) | API | R-003 | Concurrency control |
| **P0-013** | User cannot access other user's session (RLS) | API | R-006 | Security |
| **P0-014** | User cannot access unlinked partner's reflections | API | R-006 | Security |
| **P0-015** | Unauthenticated request returns 401 | API | R-006 | Security |
| **P0-016** | Expired token rejected | API | R-006 | Security |
| **P0-017** | Daily Prayer Report message send (FR34) | API | - | Core feature |
| **P0-018** | Daily Prayer Report view partner message (FR38) | API | - | Core feature |
| **P0-019** | Unlinked user can only use Solo (FR4) | API | - | Access control |
| **P0-020** | Together mode disabled for unlinked user | E2E | - | Access control |
| **P0-021** | Server state recovery on reconnect | API | R-004 | Reliability |
| **P0-022** | Broadcast state update received correctly | API | R-002 | Sync integrity |
| **P0-023** | Optimistic UI reflects pending state | E2E | - | UX |
| **P0-024** | IndexedDB cache populated on session load | API | R-005 | Caching |
| **P0-025** | Keyboard navigation works for all controls (FR50) | E2E | - | Accessibility |

**Total P0:** ~25 tests

---

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows + Workaround exists but difficult

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-001** | Lobby fallback to Solo without shame (FR18) | E2E | - | UX critical |
| **P1-002** | Partner offline indicator (FR27) | E2E | R-004 | Reconnection UX |
| **P1-003** | Clean exit while partner offline (FR29) | API | R-004 | Edge case |
| **P1-004** | Phase pause while partner offline (FR28) | API | R-004 | Sync behavior |
| **P1-005** | Reconnection resumes correct phase | API | R-004 | Recovery |
| **P1-006** | IndexedDB corruption triggers recovery | API | R-005 | Resilience |
| **P1-007** | Cache cleared on corruption, refetch works | API | R-005 | Recovery |
| **P1-008** | Overview page shows stats (FR42-46) | API | - | Dashboard |
| **P1-009** | Total sessions count correct | API | - | Stats |
| **P1-010** | Total steps count correct | API | - | Stats |
| **P1-011** | Average rating calculated correctly | API | - | Stats |
| **P1-012** | Help flag count aggregated correctly | API | - | Stats |
| **P1-013** | Last session date displayed | E2E | - | Stats |
| **P1-014** | Reflection rating 1-5 scale saves correctly | API | - | Data integrity |
| **P1-015** | Help flag toggle persists | API | - | Data integrity |
| **P1-016** | Optional note (200 chars) saves | API | - | Data integrity |
| **P1-017** | Note truncated at 200 chars | API | - | Validation |
| **P1-018** | Message (300 chars) saves | API | - | Data integrity |
| **P1-019** | Message truncated at 300 chars | API | - | Validation |
| **P1-020** | Skip message option works (FR35) | API | - | Optional feature |
| **P1-021** | Solo report shows own ratings (FR37) | E2E | - | Report display |
| **P1-022** | Together report shows both ratings (FR41) | E2E | - | Report display |
| **P1-023** | Unlinked user skips message step (FR39) | API | - | Edge case |
| **P1-024** | Partner receives async Solo report (FR40) | API | - | Async delivery |
| **P1-025** | Progress indicator shows step X/17 (FR26) | E2E | - | UX |
| **P1-026** | Phase transitions announce (screen reader) (FR52) | E2E | - | Accessibility |
| **P1-027** | Focus moves on phase transition | E2E | - | Accessibility |
| **P1-028** | prefers-reduced-motion respected (FR53) | E2E | - | Accessibility |
| **P1-029** | Color + icon/text for states (FR54) | E2E | - | Accessibility |
| **P1-030** | Rating scale aria-labels clear (FR51) | E2E | - | Accessibility |
| **P1-031** | Session exit clean with confirmation (FR5) | E2E | - | UX |
| **P1-032** | Resume prompt on return (FR6) | E2E | - | UX |
| **P1-033** | Initial load < 2s on 3G (NFR-P3) | PERF | - | Performance |
| **P1-034** | Phase transition < 200ms (NFR-P2) | PERF | - | Performance |
| **P1-035** | "Syncing..." indicator on latency (NFR-P4) | E2E | - | UX |
| **P1-036** | Reflection data encrypted at rest (NFR-S4) | Manual | - | Security |
| **P1-037** | TLS 1.2+ enforced (NFR-S4) | API | - | Security |
| **P1-038** | Session state 100% recoverable (NFR-R1) | API | - | Reliability |
| **P1-039** | No lost reflections (NFR-R2) | API | - | Reliability |
| **P1-040** | Reflection write idempotent (NFR-R6) | API | - | Reliability |

**Total P1:** ~40 tests

---

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P2-001** | Empty session stats for new user | API | - | Edge case |
| **P2-002** | First session increments count | API | - | Edge case |
| **P2-003** | Partner links mid-usage | API | - | Edge case |
| **P2-004** | Multiple incomplete sessions | API | - | Edge case |
| **P2-005** | Session with all help flags | API | - | Edge case |
| **P2-006** | Session with no notes | API | - | Edge case |
| **P2-007** | Session with all notes filled | API | - | Edge case |
| **P2-008** | Reflection with minimum rating (1) | API | - | Boundary |
| **P2-009** | Reflection with maximum rating (5) | API | - | Boundary |
| **P2-010** | Note with exactly 200 chars | API | - | Boundary |
| **P2-011** | Message with exactly 300 chars | API | - | Boundary |
| **P2-012** | Step 0 boundary (first step) | API | - | Boundary |
| **P2-013** | Step 16 boundary (last step) | API | - | Boundary |
| **P2-014** | Version 1 (new session) | API | - | Boundary |
| **P2-015** | High version number (1000+) | API | - | Boundary |
| **P2-016** | Rapid consecutive lock-ins | API | - | Stress |
| **P2-017** | Rapid phase transitions | API | - | Stress |
| **P2-018** | Multiple browser tabs same user | E2E | - | Edge case |
| **P2-019** | Browser back button behavior | E2E | - | Navigation |
| **P2-020** | Deep link to mid-session | E2E | - | Navigation |
| **P2-021** | Tablet viewport (768-1024px) | E2E | - | Responsive |
| **P2-022** | Desktop viewport (>1024px) | E2E | - | Responsive |
| **P2-023** | Touch targets >= 44px | E2E | - | Mobile |
| **P2-024** | Bottom-anchored actions visible | E2E | - | Mobile |
| **P2-025** | Skeleton loading states | E2E | - | UX |
| **P2-026** | Error boundary catches exceptions | E2E | - | Error handling |
| **P2-027** | Friendly error message (no stack trace) | E2E | - | Error handling |
| **P2-028** | Network error shows retry option | E2E | - | Error handling |
| **P2-029** | Zustand slice state transitions | Unit | - | State logic |
| **P2-030** | calculateRiskScore function | Unit | - | Utility logic |

**Total P2:** ~30 tests

---

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Performance benchmarks + Documentation validation

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| **P3-001** | Real-time sync latency <500ms (NFR-P1) | PERF | k6 load test |
| **P3-002** | P95 latency under load | PERF | k6 load test |
| **P3-003** | P99 latency under load | PERF | k6 load test |
| **P3-004** | Concurrent sessions stress test | PERF | k6 load test |
| **P3-005** | IndexedDB quota handling | PERF | Edge case |
| **P3-006** | Memory leak during long session | PERF | Profiling |
| **P3-007** | Scripture content JSON validity | Unit | Data validation |
| **P3-008** | All 17 scripture steps present | Unit | Data validation |
| **P3-009** | Visual regression (optional) | E2E | Playwright screenshot |
| **P3-010** | API documentation accuracy | Manual | Doc validation |

**Total P3:** ~10 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with parallelization is extremely fast (100s of tests in ~10-15 min).

**Organized by TOOL TYPE:**

### Every PR: Playwright Tests (~10-15 min)

**All functional tests** (from any priority level):
- All E2E, API, integration, unit tests using Playwright
- Parallelized across 4 shards
- Total: ~95 Playwright tests (P0, P1, P2 functional tests)

**Why run in PRs:** Fast feedback, no expensive infrastructure

### Nightly: k6 Performance Tests (~30-60 min)

**All performance tests** (from any priority level):
- Real-time sync latency tests (P3-001 to P3-004)
- IndexedDB quota handling (P3-005)
- Memory profiling (P3-006)
- Total: ~6 k6/perf tests

**Why defer to nightly:** Expensive infrastructure, long-running (10-40 min per test)

### Weekly: Manual & Long-Running (~hours)

**Special tests:**
- Security validation (P1-036: encryption at rest) - Manual DBA check
- Visual regression review (P3-009) - Human approval
- API documentation review (P3-010) - Manual validation

**Why defer to weekly:** Requires human intervention, infrequent validation sufficient

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps, Backend, Data Eng work):

| Priority | Count | Effort Range | Notes |
|----------|-------|--------------|-------|
| P0 | ~25 | ~1.5-2.5 weeks | Complex setup (security, race conditions, sync) |
| P1 | ~40 | ~1-2 weeks | Standard coverage (integration, accessibility) |
| P2 | ~30 | ~3-5 days | Edge cases, simple validation |
| P3 | ~10 | ~1-2 days | Performance benchmarks, exploratory |
| **Total** | ~105 | **~3-5 weeks** | **1 QA engineer, full-time** |

**Assumptions:**
- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort)
- Assumes test infrastructure (factories, fixtures) ready
- Timing pessimistic until R-001 (seeding APIs) resolved

**Dependencies from other teams:**
- See "Dependencies & Test Blockers" section for what QA needs from Backend, DevOps

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
import { test, expect } from '@playwright/test';
import { apiRequest } from '@seontechnologies/playwright-utils/api-request/fixtures';

// P0 critical security test
test('@P0 @API @Security unauthenticated request returns 401', async ({ request }) => {
  const response = await request.post('/rest/v1/rpc/scripture_create_session', {
    data: { mode: 'solo' },
    headers: {
      'Content-Type': 'application/json',
      // No Authorization header
    },
  });

  expect(response.status()).toBe(401);
});

// P0 race condition test
test('@P0 @API @RaceCondition concurrent lock-in resolves correctly', async ({ request }) => {
  // Seed session with two users
  const session = await seedTestSession({ mode: 'together' });

  // Simulate concurrent lock-ins
  const [response1, response2] = await Promise.all([
    request.post('/rest/v1/rpc/scripture_lock_in', {
      data: {
        session_id: session.id,
        step_index: 0,
        user_id: session.user1_id,
        expected_version: 1,
      },
    }),
    request.post('/rest/v1/rpc/scripture_lock_in', {
      data: {
        session_id: session.id,
        step_index: 0,
        user_id: session.user2_id,
        expected_version: 1,
      },
    }),
  ]);

  // One should succeed (200), one may get version mismatch (409) or also succeed
  const statuses = [response1.status(), response2.status()];
  expect(statuses).toContain(200);
  // Both could succeed if processed in order, or one gets 409
  expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
});

// P1 accessibility test
test('@P1 @E2E @Accessibility rating scale has aria-labels', async ({ page }) => {
  await page.goto('/scripture-reading/solo');

  // Start session and get to reflection screen
  await page.click('[data-testid="start-session"]');
  await page.click('[data-testid="done-reading"]');
  await page.click('[data-testid="done-response"]');

  // Check aria-labels on rating buttons
  const ratingButtons = page.locator('[data-testid="rating-button"]');
  await expect(ratingButtons.nth(0)).toHaveAttribute('aria-label', /1.*Struggling/i);
  await expect(ratingButtons.nth(4)).toHaveAttribute('aria-label', /5.*Strong/i);
});
```

**Run specific tags:**

```bash
# Run only P0 tests
npx playwright test --grep @P0

# Run P0 + P1 tests
npx playwright test --grep "@P0|@P1"

# Run only security tests
npx playwright test --grep @Security

# Run only race condition tests
npx playwright test --grep @RaceCondition

# Run all Playwright tests in PR (default)
npx playwright test
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` - Risk scoring methodology (Probability x Impact)
- **Test Priorities Matrix**: `test-priorities-matrix.md` - P0-P3 criteria
- **Test Levels Framework**: `test-levels-framework.md` - E2E vs API vs Unit selection
- **ADR Quality Checklist**: `adr-quality-readiness-checklist.md` - 8-category NFR framework

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/bmm/testarch/test-design`
**Version:** 4.0 (BMad v6)
