# Test Design for QA: Scripture Reading for Couples

**Purpose:** Test execution recipe for QA team. Defines what to test, how to test it, and what QA needs from other teams.

**Date:** 2026-01-27
**Author:** TEA (Test Engineering Agent)
**Status:** Draft
**Project:** My-Love

**Related:** See Architecture doc (test-design-architecture.md) for testability concerns and architectural blockers.

---

## Executive Summary

**Scope:** Scripture Reading feature - Solo mode (17-step offline-capable flow), Together mode (real-time synchronized reading with partner), reflection system (rating, help flag, notes), and Daily Prayer Report.

**Risk Summary:**
- Total Risks: 8 (3 high-priority score >=6, 3 medium, 2 low)
- Critical Categories: TECH (race conditions), SEC (broadcast auth), DATA (sync conflicts)

**Coverage Summary:**
- P0 tests: ~25 (critical paths, security, real-time sync)
- P1 tests: ~35 (feature flows, error handling)
- P2 tests: ~30 (edge cases, regression)
- P3 tests: ~15 (exploratory, performance benchmarks)
- **Total**: ~105 tests (~2-3 weeks with 1 QA)

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### Backend/Architecture Dependencies (Sprint 0)

**Source:** See Architecture doc "Quick Guide" for detailed mitigation plans

1. **B-001: Centralized IndexedDB Schema** - Backend - Sprint 0 Week 1
   - QA needs: Single `dbSchema.ts` with version 5 including 5 scripture stores
   - Why it blocks: Without this, IndexedDB tests will have VersionError flakiness

2. **B-002: Supabase Migration Deployed** - Backend - Sprint 0 Week 2
   - QA needs: All 5 tables (`scripture_sessions`, `scripture_reflections`, `scripture_step_states`, `scripture_bookmarks`, `scripture_messages`) with RLS policies
   - Why it blocks: Cannot test data persistence, security, or sync without tables

3. **B-003: Test Data Seeding** - Backend - Sprint 0 Week 2
   - QA needs: Method to create test sessions and reflections programmatically
   - Why it blocks: Each test needs isolated session data; manual creation is too slow

### QA Infrastructure Setup (Sprint 0)

1. **Test Data Factories** - QA
   - Session factory with faker-based randomization
   - Reflection factory for all 17 steps
   - Auto-cleanup fixtures for parallel safety

2. **Test Environments** - QA
   - Local: Supabase local development with test database
   - CI/CD: GitHub Actions with Playwright sharding (4 shards)
   - Staging: Shared Supabase staging instance (if available)

**Example factory pattern:**

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Session factory
function createTestSession(overrides = {}) {
  return {
    id: `test-session-${faker.string.uuid()}`,
    mode: 'solo',
    user1_id: `test-user-${faker.string.uuid()}`,
    user2_id: null,
    current_phase: 'reading',
    current_step_index: 0,
    status: 'active',
    version: 1,
    ...overrides,
  };
}

// Reflection factory
function createTestReflection(sessionId: string, stepIndex: number, overrides = {}) {
  return {
    id: `test-reflection-${faker.string.uuid()}`,
    session_id: sessionId,
    step_index: stepIndex,
    user_id: `test-user-${faker.string.uuid()}`,
    rating: faker.number.int({ min: 1, max: 5 }),
    help_flag: faker.datatype.boolean(),
    notes: faker.lorem.sentence().slice(0, 200),
    synced: false,
    ...overrides,
  };
}

test('@P0 @API session creation', async ({ apiRequest }) => {
  const sessionData = createTestSession({ mode: 'solo' });

  const { status, body } = await apiRequest({
    method: 'POST',
    path: '/rest/v1/scripture_sessions',
    body: sessionData,
  });

  expect(status).toBe(201);
  expect(body.id).toBe(sessionData.id);
});
```

---

## Risk Assessment

**Note:** Full risk details in Architecture doc. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score >=6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| **R-001** | TECH | Race conditions in Together mode lock-in | **6** | P0: Concurrent lock-in tests; verify no double-advance |
| **R-002** | SEC | Broadcast channel could leak session events | **6** | P0: Unauthorized channel subscription test; verify 403 |
| **R-003** | DATA | Offline sync conflicts could lose reflections | **6** | P0: Two-device offline edit; verify correct resolution |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| R-004 | TECH | IndexedDB VersionError from non-centralized schema | 4 | P1: IndexedDB migration test; verify no errors |
| R-005 | PERF | Real-time sync latency exceeds 500ms | 4 | P2: Latency benchmark under simulated load |
| R-006 | OPS | Partner reconnection fails to resync | 4 | P1: Disconnect/reconnect test; verify state sync |
| R-007 | BUS | Partial offline session unaware to partner | 2 | P2: Monitor; design test for async sync |
| R-008 | OPS | sw-db.ts manual sync forgotten | 1 | P3: Monitor; code review checklist |

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (>=6) + No workaround + Affects majority of users

#### Session Management (~5 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-001** | User can start Solo session | API | R-001 | Session created with correct phase/step |
| **P0-002** | Session completion marks status correctly | API | - | Step 17 reflection triggers status='complete' |
| **P0-003** | Unlinked user cannot access Together mode | E2E | - | Together button disabled with explanation |
| **P0-004** | Session data persists across app restart | E2E | R-004 | IndexedDB persistence validated |
| **P0-005** | Session RLS blocks unauthorized access | API | R-002 | User cannot read another user's session |

#### Together Mode Sync (~8 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-006** | Both users see synchronized lobby state | E2E | R-001 | Ready state reflected within 500ms |
| **P0-007** | Countdown starts when both ready | E2E | R-001 | 3-2-1 countdown synchronized |
| **P0-008** | Lock-in prevents race condition | API | R-001 | Concurrent lock-in; only one advances |
| **P0-009** | Version mismatch returns 409 | API | R-001 | Stale mutation rejected |
| **P0-010** | Phase advances only when both locked | API | R-001 | Single lock-in doesn't advance |
| **P0-011** | Unauthorized broadcast subscription rejected | API | R-002 | Non-participant gets 403 |
| **P0-012** | Partner disconnect shows reconnecting indicator | E2E | R-006 | No shame language |
| **P0-013** | Partner reconnect resyncs state | E2E | R-006 | Session continues correctly |

#### Offline & Sync (~6 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-014** | Solo session works fully offline | E2E | R-004 | Create, progress, reflect without network |
| **P0-015** | Offline reflections sync when online | API | R-003 | synced: false -> true after reconnect |
| **P0-016** | Sync conflict resolution uses last-write | API | R-003 | Two edits; most recent wins |
| **P0-017** | Sync failure retries automatically | API | R-003 | Transient error; retry succeeds |
| **P0-018** | IndexedDB migration to v5 preserves data | API | R-004 | Existing v4 data intact after upgrade |
| **P0-019** | No data loss during app crash | E2E | - | Force close; data persisted |

#### Security (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-020** | Reflection RLS: user sees only own + shared partner | API | R-002 | Query filtered correctly |
| **P0-021** | Session RLS: participants only | API | R-002 | Non-participant gets empty result |
| **P0-022** | Broadcast events don't leak to non-participants | API | R-002 | Subscribe to wrong session; no events |
| **P0-023** | Private reflections not visible to partner | API | - | is_shared=false enforced |

**Total P0:** ~23 tests

---

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows + Workaround exists but difficult

#### Solo Mode Flow (~8 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-001** | User progresses through all 17 steps | E2E | - | Full happy path |
| **P1-002** | Verse -> Response -> Reflection flow | E2E | - | Phase transitions correct |
| **P1-003** | Back to Verse navigation works | E2E | - | Free navigation within step |
| **P1-004** | Save and exit preserves progress | E2E | - | Resume at correct step/phase |
| **P1-005** | Resume shows correct progress indicator | E2E | - | "Verse X of 17" accurate |
| **P1-006** | Reflection rating required before submit | E2E | - | Validation enforced |
| **P1-007** | Note truncated at 200 characters | E2E | - | Character limit enforced |
| **P1-008** | Help flag toggles correctly | E2E | - | State persisted |

#### Together Mode Flow (~6 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-009** | Role selection (Reader/Responder) | E2E | - | Roles assigned correctly |
| **P1-010** | Role alternation each step | E2E | - | Reader N becomes Responder N+1 |
| **P1-011** | Partner position indicator updates | E2E | R-005 | Shows where partner is viewing |
| **P1-012** | Lobby fallback to Solo available | E2E | - | "Continue Solo" before countdown |
| **P1-013** | Countdown cancellation on unready | E2E | - | Either user can cancel |
| **P1-014** | Both reflections required to advance | E2E | R-001 | Single reflection waits |

#### Daily Prayer Report (~6 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-015** | Report shows all 17 step ratings | E2E | - | Complete history displayed |
| **P1-016** | Help flags visible in report | E2E | - | Flagged steps highlighted |
| **P1-017** | Partner message displayed | E2E | - | Together mode message visible |
| **P1-018** | Solo report shared async to partner | API | R-007 | Partner can view after sync |
| **P1-019** | Message composition 300 char limit | E2E | - | Truncation enforced |
| **P1-020** | Skip message option works | E2E | - | No message saved |

#### Stats & Overview (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-021** | Total sessions count accurate | API | - | Couple aggregate |
| **P1-022** | Average rating calculated correctly | API | - | 1.0-5.0 one decimal |
| **P1-023** | Help request count accurate | API | - | help_flag=true count |
| **P1-024** | Stats work offline from IndexedDB | E2E | R-004 | Local calculation |

#### Error Handling (~4 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-025** | Network error shows retry option | E2E | - | Graceful degradation |
| **P1-026** | Session not found handled gracefully | E2E | - | Clear error message |
| **P1-027** | Supabase RPC timeout shows error | API | - | 5s timeout handling |
| **P1-028** | Invalid session state rejected | API | - | Malformed data returns 400 |

**Total P1:** ~28 tests

---

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

#### Edge Cases (~12 tests)

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P2-001** | Multiple incomplete sessions handled | E2E | - | Most recent shown |
| **P2-002** | Partner linking mid-session | E2E | - | Together mode becomes available |
| **P2-003** | Reflection edit before partner submit | E2E | - | Idempotent upsert |
| **P2-004** | Very long note truncation UX | E2E | - | Character counter accurate |
| **P2-005** | Empty note allowed | E2E | - | Optional field |
| **P2-006** | Rating 1-5 boundaries | API | - | Invalid ratings rejected |
| **P2-007** | Step index 0-16 boundaries | API | - | Invalid step rejected |
| **P2-008** | Session version overflow handling | API | - | Large version numbers |
| **P2-009** | Concurrent session start race | API | - | No duplicate sessions |
| **P2-010** | Browser refresh during session | E2E | - | State preserved |
| **P2-011** | App backgrounding during Together | E2E | - | Reconnection works |
| **P2-012** | Network flapping during sync | E2E | - | Queue continues |

#### Accessibility (~10 tests)

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| **P2-013** | Keyboard navigation through rating scale | E2E | Tab + Arrow keys |
| **P2-014** | Screen reader announces rating labels | E2E | "Rating 1 of 5: Struggling" |
| **P2-015** | Focus moves to new verse on step advance | E2E | Focus management |
| **P2-016** | Help flag toggle accessible | E2E | aria-checked announced |
| **P2-017** | Countdown accessible for screen readers | E2E | Numbers announced |
| **P2-018** | Exit modal focus trapped | E2E | No escape to background |
| **P2-019** | Color independence for ready/waiting | E2E | Icon + text, not color only |
| **P2-020** | Touch targets >=48px | E2E | Measured via Playwright |
| **P2-021** | Reduced motion: no animations | E2E | prefers-reduced-motion |
| **P2-022** | Reduced motion: countdown static | E2E | No fade transitions |

#### Regression (~8 tests)

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| **P2-023** | Existing mood tracking unaffected | E2E | No regression |
| **P2-024** | Bottom navigation includes scripture | E2E | New ViewType works |
| **P2-025** | Partner linking flow still works | E2E | Existing flow preserved |
| **P2-026** | Auth session persists | E2E | No logout during feature |
| **P2-027** | IndexedDB v4->v5 migration clean | API | No data corruption |
| **P2-028** | SyncService extension works | API | syncScriptureReadingData() |
| **P2-029** | Supabase Auth integration | API | User ID from auth |
| **P2-030** | Existing RLS policies intact | API | Other tables unaffected |

**Total P2:** ~30 tests

---

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Performance benchmarks + Documentation validation

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| **P3-001** | Sync latency under 500ms (100 users) | Perf | k6 load test |
| **P3-002** | Phase transition under 200ms | Perf | Client-side measurement |
| **P3-003** | Initial load under 2s on 3G | Perf | Lighthouse/WebPageTest |
| **P3-004** | 50+ concurrent Together sessions | Perf | Supabase Broadcast stress |
| **P3-005** | IndexedDB quota handling | E2E | Simulate full storage |
| **P3-006** | Large sync queue processing | E2E | 50+ pending items |
| **P3-007** | Typography rendering (Playfair Display) | Visual | Screenshot comparison |
| **P3-008** | Lavender Dreams theme consistency | Visual | Color token audit |
| **P3-009** | Scripture content JSON valid | API | Schema validation |
| **P3-010** | All 17 steps have content | API | Content completeness |
| **P3-011** | Framer Motion animations smooth | Visual | 60fps validation |
| **P3-012** | Mobile viewport rendering | E2E | <768px breakpoint |
| **P3-013** | Tablet viewport rendering | E2E | 768-1024px breakpoint |
| **P3-014** | Error telemetry logging | API | Verify logs captured |
| **P3-015** | Session cleanup for tests | API | Delete test data |

**Total P3:** ~15 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with parallelization is extremely fast (100s of tests in ~10-15 min).

**Organized by TOOL TYPE:**

### Every PR: Playwright Tests (~10-15 min)

**All functional tests** (from any priority level):
- All E2E, API, integration tests using Playwright
- Parallelized across 4 shards
- Total: ~90 Playwright tests (P0-001 through P2-030)
- Tags: `@P0`, `@P1`, `@P2`, `@API`, `@E2E`, `@Security`, `@A11y`

**Why run in PRs:** Fast feedback, no expensive infrastructure, Playwright parallelization makes this viable

### Nightly: k6 Performance Tests (~30-60 min)

**All performance tests** (from any priority level):
- Load test: 100 concurrent sessions (P3-001)
- Broadcast stress test: 50+ Together sessions (P3-004)
- Total: ~4 k6 tests

**Why defer to nightly:** k6 Cloud requires dedicated infrastructure, tests are long-running (10-30 min each)

### Weekly: Visual & Exploratory (~hours)

**Special tests** (from any priority level):
- Visual regression (P3-007, P3-008, P3-011)
- Manual exploratory testing
- Quota/stress edge cases (P3-005, P3-006)

**Why defer to weekly:** Requires human review, expensive screenshot storage, infrequent validation sufficient

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps, Backend, Data Eng work):

| Priority | Count | Effort Range | Notes |
|----------|-------|--------------|-------|
| P0 | ~23 | ~1-1.5 weeks | Complex setup (real-time sync, security, offline) |
| P1 | ~28 | ~1-1.5 weeks | Standard flows (happy paths, error handling) |
| P2 | ~30 | ~0.5-1 week | Edge cases, accessibility (reusable patterns) |
| P3 | ~15 | ~2-3 days | Performance, visual (deferred lower priority) |
| **Total** | ~96 | **~2-3 weeks** | **1 QA engineer, full-time** |

**Assumptions:**
- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort)
- Assumes test infrastructure (factories, fixtures) ready by Sprint 1
- Backend dependencies (dbSchema, migration, seeding) completed in Sprint 0

**Dependencies from other teams:**
- See "Dependencies & Test Blockers" section for what QA needs from Backend

---

## Appendix A: Code Examples & Tagging

**Playwright Tags for Selective Execution:**

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';

// P0 security test - unauthorized access
test('@P0 @API @Security unauthorized session access returns empty', async ({ apiRequest }) => {
  // Attempt to read another user's session
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/rest/v1/scripture_sessions?id=eq.other-user-session',
  });

  expect(status).toBe(200);
  expect(body).toHaveLength(0); // RLS filters to empty
});

// P0 sync test - race condition prevention
test('@P0 @API @Together concurrent lock-in prevents double advance', async ({ apiRequest }) => {
  const sessionId = 'test-session-concurrent';
  const stepIndex = 0;

  // Simulate concurrent lock-in (both users lock at same time)
  const [result1, result2] = await Promise.all([
    apiRequest({
      method: 'POST',
      path: '/rest/v1/rpc/scripture_lock_in',
      body: { session_id: sessionId, step_index: stepIndex, user_id: 'user1', expected_version: 1 },
    }),
    apiRequest({
      method: 'POST',
      path: '/rest/v1/rpc/scripture_lock_in',
      body: { session_id: sessionId, step_index: stepIndex, user_id: 'user2', expected_version: 1 },
    }),
  ]);

  // Both should succeed (lock-in, not advance)
  expect(result1.status).toBe(200);
  expect(result2.status).toBe(200);

  // Verify step advanced only once
  const { body: session } = await apiRequest({
    method: 'GET',
    path: `/rest/v1/scripture_sessions?id=eq.${sessionId}`,
  });

  expect(session[0].current_step_index).toBe(1); // Advanced to step 1, not step 2
});

// P1 E2E test - solo mode flow
test('@P1 @E2E @Solo complete solo session flow', async ({ page }) => {
  await page.goto('/scripture');

  // Start solo session
  await page.getByRole('button', { name: 'Start New Session' }).click();
  await page.getByRole('button', { name: 'Solo' }).click();
  await page.getByRole('button', { name: 'Start Session' }).click();

  // Complete all 17 steps
  for (let step = 0; step < 17; step++) {
    // Read verse
    await expect(page.getByText(`Verse ${step + 1} of 17`)).toBeVisible();
    await page.getByRole('button', { name: "I've read this" }).click();

    // View response
    await page.getByRole('button', { name: 'Continue to Reflection' }).click();

    // Submit reflection
    await page.getByRole('radio', { name: /Rating 3 of 5/ }).click();
    await page.getByRole('button', { name: 'Submit Reflection' }).click();
  }

  // Verify completion
  await expect(page.getByText('Session Complete')).toBeVisible();
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

# Run only accessibility tests
npx playwright test --grep @A11y

# Run all Playwright tests in PR (default)
npx playwright test
```

---

## Appendix B: Knowledge Base References

- **Risk Governance**: `risk-governance.md` - Risk scoring methodology (Probability x Impact)
- **Test Priorities Matrix**: `test-priorities-matrix.md` - P0-P3 criteria and classification
- **Test Levels Framework**: `test-levels-framework.md` - E2E vs API vs Unit selection
- **Test Quality**: `test-quality.md` - Definition of Done (no hard waits, <300 lines, <1.5 min)

---

**Generated by:** BMad TEA Agent
**Workflow:** `_bmad/bmm/testarch/test-design`
**Version:** 4.0 (BMad v6)
