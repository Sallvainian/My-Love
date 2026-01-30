# Sprint 0 Commitments: Scripture Reading Test Infrastructure

**Date:** 2026-01-28
**Sprint Duration:** 2 weeks
**Goal:** Enable automated testing for Scripture Reading feature

---

## Executive Summary

Following team review of the test risk assessment, Sprint 0 focuses on unblocking QA automation. Three high-priority risks (R-001, R-002, R-008) must be resolved before test development can proceed.

**Definition of Done:**
- QA can run automated tests in CI against seeded data
- Together mode tests execute with real-time sync (Supabase Local or mock)
- No IndexedDB version errors blocking test runs

---

## Committed Work Items

### Backend (Owner: Backend Dev)

| Item | Description | Days | Blocked By |
|------|-------------|------|------------|
| **R-001: Seeding RPC** | Implement `scripture_seed_test_data()` RPC | 1-2 | - |
| **R-008: dbSchema.ts** | Centralize IndexedDB version management | 0.5 | - |
| **Environment Guard** | Restrict seed RPC to dev/staging only | 0.5 | R-001 |

**Seeding RPC Specification (per Architecture review):**

```typescript
// Input
scripture_seed_test_data({
  session_count?: number,      // Default: 1
  include_reflections?: boolean, // Default: false
  include_messages?: boolean,    // Default: false
  preset?: 'mid_session' | 'completed' | 'with_help_flags' // Optional
})

// Output
{
  session_ids: string[],
  user_ids: string[],
  reflection_ids?: string[],
  message_ids?: string[]
}
```

**Acceptance Criteria:**
- [ ] RPC creates valid session with all FK relationships
- [ ] Preset 'mid_session' creates session at step 7
- [ ] Preset 'completed' creates session at step 17 with status 'complete'
- [ ] Preset 'with_help_flags' adds help flags to odd-numbered steps
- [ ] Environment check rejects calls in production
- [ ] Returns all created IDs for cleanup

---

### DevOps (Owner: DevOps)

| Item | Description | Days | Blocked By |
|------|-------------|------|------------|
| **R-002: Supabase Local CI** | Add Supabase Local to GitHub Actions | 1 | - |

**Acceptance Criteria:**
- [ ] CI workflow starts Supabase Local before test job
- [ ] Broadcast channels functional in CI environment
- [ ] Startup adds <60 seconds to pipeline
- [ ] Teardown cleans up containers

---

### QA (Owner: Murat/TEA)

| Item | Description | Days | Blocked By |
|------|-------------|------|------------|
| **Test Factories** | Create factories using seed RPC | 2 | R-001 |
| **P0 Test Skeleton** | Implement 25 P0 test stubs | 2-3 | R-001, R-002 |
| **CI Integration** | Configure Playwright in GitHub Actions | 1 | R-002 |

**Acceptance Criteria:**
- [ ] `createTestSession()` factory calls seed RPC
- [ ] `createTestReflection()` factory creates reflection data
- [ ] All P0 tests have file structure and describe blocks
- [ ] CI runs `npx playwright test --grep @P0` successfully

---

## Dependencies & Sequencing

```
Week 1:
  Day 1-2: [Backend] dbSchema.ts + Seeding RPC
  Day 2-3: [DevOps] Supabase Local CI setup

Week 2:
  Day 1-2: [QA] Test factories (after R-001 delivered)
  Day 2-4: [QA] P0 test skeleton + CI integration
  Day 5:   [All] Sprint 0 validation - full CI run
```

---

## Risk Mitigation Status

| Risk ID | Score | Status | Sprint 0 Action |
|---------|-------|--------|-----------------|
| R-001 | 9 | **IN PROGRESS** | Seeding RPC implementation |
| R-002 | 6 | **IN PROGRESS** | Supabase Local CI |
| R-003 | 6 | Deferred | Sprint 1 - race condition tests |
| R-004 | 4 | Deferred | Sprint 1 - reconnection tests |
| R-005 | 4 | **IN PROGRESS** | dbSchema.ts centralization |
| R-006 | 4 | Deferred | Sprint 1 - RLS penetration tests |
| R-007 | 4 | Deferred | Nightly - performance benchmarks |
| R-008 | 2 | **IN PROGRESS** | dbSchema.ts centralization |
| R-009 | 1 | Deferred | Post-MVP - feature flags |

---

## Exit Criteria for Sprint 0

**Must achieve ALL:**

1. **Seeding works:** `scripture_seed_test_data()` returns valid session IDs
2. **CI runs:** GitHub Actions executes Playwright tests with Supabase Local
3. **P0 ready:** 25 P0 test files exist with proper structure
4. **Green build:** CI pipeline passes with at least 1 actual test (homepage smoke test)

---

## Team Sign-Off

| Role | Name | Commitment | Date |
|------|------|------------|------|
| Architect | Winston | Seeding RPC spec approved | 2026-01-28 |
| Developer | Amelia | Backend items committed | 2026-01-28 |
| Test Architect | Murat | QA items committed | 2026-01-28 |
| Scrum Master | Bob | Sprint scope locked | 2026-01-28 |

---

## Next Steps After Sprint 0

1. **Sprint 1:** P0 test implementation (~25 tests)
2. **Sprint 1:** Race condition test suite (R-003)
3. **Sprint 1-2:** P1 test implementation (~40 tests)
4. **Nightly:** Chaos testing for Together mode
5. **Sprint 2+:** P2/P3 tests as time permits

---

*Generated from Party Mode risk assessment review - 2026-01-28*
