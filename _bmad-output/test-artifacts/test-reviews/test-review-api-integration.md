---
stepsCompleted:
  - 'step-01-load-context'
  - 'step-02-discover-tests'
  - 'step-03-quality-evaluation'
  - 'step-03f-aggregate-scores'
  - 'step-04-generate-report'
lastStep: 'step-04-generate-report'
lastSaved: '2026-03-04'
workflowType: 'testarch-test-review'
inputDocuments:
  - '_bmad/tea/testarch/knowledge/test-quality.md'
  - '_bmad/tea/testarch/knowledge/data-factories.md'
  - '_bmad/tea/testarch/knowledge/test-levels-framework.md'
  - '_bmad/tea/testarch/knowledge/overview.md'
  - '_bmad/tea/testarch/knowledge/api-request.md'
  - '_bmad/tea/testarch/knowledge/auth-session.md'
  - '_bmad/tea/testarch/knowledge/test-healing-patterns.md'
  - '_bmad/tea/testarch/knowledge/recurse.md'
---

# Test Quality Review: API & Integration Tests

**Quality Score**: 74/100 (C - Acceptable)
**Review Date**: 2026-03-04
**Review Scope**: directory (3 files: api/, integration/)
**Reviewer**: TEA Agent (review-api-integration)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here. Use `trace` for coverage decisions.

## Executive Summary

**Overall Assessment**: Acceptable

**Recommendation**: Approve with Comments

### Key Strengths

- Tests correctly import from `tests/support/merged-fixtures` and use the `apiRequest` fixture from `@seontechnologies/playwright-utils`
- Excellent BDD structure with Given/When/Then comments throughout all tests
- Strong test isolation with proper try/finally cleanup patterns using `createTestSession`/`cleanupTestSession`
- Test IDs and priority markers (P0/P1) present and consistent
- Good use of `faker` for dynamic test data generation (scripture-reflection-api.spec.ts)
- Zod schema validation via `responseSchema` parameter on `apiRequest` calls

### Key Weaknesses

- `scripture-reflection-api.spec.ts` is 1003 lines (3.3x over 300-line threshold)
- Extreme code duplication: `baseURL`/`anonKey`/headers block repeated in every single test (20+ times across files)
- Auth token retrieval (`getUserAccessToken`) called per-test instead of using `auth-session` fixture
- `apiRequest` `baseUrl` not configured via `configBaseUrl` or playwright config — manually passed every call

### Summary

The API and integration tests demonstrate solid test design fundamentals: proper BDD structure, consistent test IDs, good isolation with cleanup, and correct use of the `apiRequest` fixture from `@seontechnologies/playwright-utils`. However, the tests suffer significantly from maintainability issues. The 1003-line scripture-reflection-api.spec.ts file needs splitting, and the repetitive baseURL/anonKey/headers boilerplate across every test should be extracted into fixtures or configuration. The auth pattern manually calls `getUserAccessToken` instead of leveraging the `auth-session` utility from playwright-utils, which would eliminate per-test token management. These are all "should fix" issues rather than blockers.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes                                                    |
| ------------------------------------ | ------- | ---------- | -------------------------------------------------------- |
| BDD Format (Given-When-Then)         | PASS    | 0          | Excellent GWT comments in all tests                      |
| Test IDs                             | PASS    | 0          | 4.1-API-001/002/003, 2.2-API-001, 2.3-API-001/002/003/004 present |
| Priority Markers (P0/P1/P2/P3)       | PASS    | 0          | P0 and P1 markers on all tests                           |
| Hard Waits (sleep, waitForTimeout)   | PASS    | 0          | No hard waits found                                      |
| Determinism (no conditionals)        | PASS    | 0          | No conditionals, no Math.random()                        |
| Isolation (cleanup, no shared state) | PASS    | 0          | try/finally cleanup in all tests                         |
| Fixture Patterns                     | WARN    | 3          | apiRequest used but auth/baseUrl not via fixtures         |
| Data Factories                       | PASS    | 0          | createTestSession + faker used properly                  |
| Network-First Pattern                | N/A     | 0          | API-only tests, no browser navigation                    |
| Explicit Assertions                  | PASS    | 0          | All assertions visible in test bodies                    |
| Test Length (<=300 lines)            | FAIL    | 2          | 1003 lines and 377 lines                                 |
| Test Duration (<=1.5 min)            | WARN    | 1          | test.setTimeout(30_000) on one test                      |
| Flakiness Patterns                   | PASS    | 0          | No flakiness patterns detected                           |

**Total Violations**: 0 Critical, 3 High, 4 Medium, 3 Low

---

## Quality Score Breakdown

```
Starting Score:          100

Dimension Scores (weighted):
  Determinism (30%):     90 x 0.30 = 27.0
  Isolation (30%):       95 x 0.30 = 28.5
  Maintainability (25%): 50 x 0.25 = 12.5
  Performance (15%):     88 x 0.15 = 13.2

Raw Weighted Score:      81.2

Penalty Adjustments:
  File length violations:  -5 (1003-line file)
  Duplication penalty:     -5 (20+ repeated blocks)
  Missing fixture usage:   -2 (auth not via fixture)

Bonus Points:
  Excellent BDD:           +2
  All Test IDs:            +2
  Perfect Isolation:       +1
                           --------
Final Score:               74/100
Grade:                     C (Acceptable)
```

---

## Critical Issues (Must Fix)

No critical issues detected. All tests are functional and follow core quality patterns.

---

## Recommendations (Should Fix)

### 1. Split scripture-reflection-api.spec.ts (1003 lines)

**Severity**: P1 (High)
**Location**: `tests/api/scripture-reflection-api.spec.ts:1-1003`
**Criterion**: Test Length
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Issue Description**:
At 1003 lines, this file is 3.3x over the 300-line recommended maximum. It contains 3 separate story sections (Reflection RPC, Story 2.2, Story 2.3) that should be independent files.

**Current Code**:

```typescript
// 1003-line monolithic file containing:
// - "Scripture Reflection API - RPC Validation" (lines 29-135)
// - "Scripture Reflection API - Story 2.2" (lines 326-623)
// - "Scripture Reflection API - Story 2.3" (lines 631-1003)
```

**Recommended Fix**:

```typescript
// Split into 3 files:
// tests/api/scripture-reflection-rpc.spec.ts (~135 lines)
// tests/api/scripture-reflection-2.2.spec.ts (~300 lines)
// tests/api/scripture-reflection-2.3.spec.ts (~370 lines)
```

**Benefits**: Each file under 400 lines, easier to debug failures, better CI parallelization.

**Priority**: HIGH — maintainability and debuggability

---

### 2. Extract baseURL/anonKey/headers into fixture or config

**Severity**: P1 (High)
**Location**: `tests/api/scripture-lobby-4.1.spec.ts:52-53` (and 20+ other locations)
**Criterion**: Fixture Patterns / DRY
**Knowledge Base**: [api-request.md](../../../tea/testarch/knowledge/api-request.md)

**Issue Description**:
Every test manually constructs `baseURL`, `anonKey`, and headers. This 6-line block is repeated 20+ times across all API test files.

**Current Code**:

```typescript
// Repeated in EVERY test:
const baseURL = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

const response = await apiRequest({
  method: 'POST',
  path: '/rest/v1/rpc/scripture_select_role',
  baseUrl: baseURL,
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${user1Token}`,
    'Content-Type': 'application/json',
  },
  body: { ... },
});
```

**Recommended Fix**:

```typescript
// Option A: Configure in playwright.config.ts
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: process.env.SUPABASE_ANON_KEY!,
      'Content-Type': 'application/json',
    },
  },
});

// Then in tests - much cleaner:
const response = await apiRequest({
  method: 'POST',
  path: '/rest/v1/rpc/scripture_select_role',
  headers: { Authorization: `Bearer ${user1Token}` },
  body: { p_session_id: sessionId, p_role: 'reader' },
});

// Option B: Use configBaseUrl from apiRequest fixture
// tests/support/merged-fixtures.ts
test.use({ configBaseUrl: process.env.SUPABASE_URL });
```

**Benefits**: Eliminates 20+ duplicated blocks, single source of truth for API config, easier env changes.

---

### 3. Use auth-session fixture instead of manual getUserAccessToken

**Severity**: P1 (High)
**Location**: `tests/api/scripture-lobby-4.1.spec.ts:51` (and 15+ other locations)
**Criterion**: Fixture Patterns
**Knowledge Base**: [auth-session.md](../../../tea/testarch/knowledge/auth-session.md)

**Issue Description**:
Every test manually calls `getUserAccessToken(supabaseAdmin, userId)` to get auth tokens. The `@seontechnologies/playwright-utils` auth-session utility provides disk-persisted tokens, multi-user support, and automatic token management — all already available via `merged-fixtures.ts`.

**Current Code**:

```typescript
// Repeated in every test:
import { getUserAccessToken } from '../support/helpers/supabase';

const user1Token = await getUserAccessToken(supabaseAdmin, user1Id);
// ... later:
headers: { Authorization: `Bearer ${user1Token}` },
```

**Recommended Fix**:

```typescript
// Create a Supabase auth provider for playwright-utils
// tests/support/auth/supabase-auth-provider.ts
import { type AuthProvider } from '@seontechnologies/playwright-utils/auth-session';

const supabaseAuthProvider: AuthProvider = {
  getEnvironment: () => 'local',
  getUserIdentifier: (opts) => opts.userIdentifier || 'test-user-1',
  extractToken: (state) => state.origins?.[0]?.localStorage?.find(i => i.name === 'token')?.value,
  isTokenExpired: () => false, // Test tokens don't expire
  manageAuthToken: async (request, opts) => {
    // Use existing getUserAccessToken logic here
    // Return storage state format
  },
};

// Then in tests:
test('[P1] role selection', async ({ apiRequest, authToken }) => {
  // authToken automatically managed
  const response = await apiRequest({
    method: 'POST',
    path: '/rest/v1/rpc/scripture_select_role',
    headers: { Authorization: `Bearer ${authToken}` },
    body: { p_session_id: sessionId, p_role: 'reader' },
  });
});
```

**Benefits**: Token persistence across test runs, automatic refresh, multi-user support, less boilerplate per test.

**Priority**: HIGH but can be done incrementally — current pattern works, just verbose.

---

### 4. Reduce scripture-lobby-4.1.spec.ts boilerplate (377 lines)

**Severity**: P2 (Medium)
**Location**: `tests/api/scripture-lobby-4.1.spec.ts:1-377`
**Criterion**: Test Length / DRY
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Issue Description**:
At 377 lines, this file is moderately over the 300-line threshold. The core test logic per test case is ~10 lines, but boilerplate (session creation, partner linking, token fetching, headers, cleanup) inflates each test to ~60 lines.

**Recommended Fix**:
After implementing recommendations 2 and 3 (baseURL config + auth fixture), each test should shrink from ~60 lines to ~25 lines, bringing the file well under 300 lines.

---

### 5. Type cast workaround should have a cleanup TODO

**Severity**: P2 (Medium)
**Location**: `tests/api/scripture-lobby-4.1.spec.ts:22-31`
**Criterion**: Maintainability
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Issue Description**:
The `ScriptureSessionLobbyRow` interface with `as unknown as` casts is a workaround for types not yet regenerated. The comment says "Remove after running supabase gen types" but this has persisted.

**Current Code**:

```typescript
interface ScriptureSessionLobbyRow {
  user1_role: 'reader' | 'responder' | null;
  // ...
}
// Used as:
const dbRow = roleResult.data as unknown as ScriptureSessionLobbyRow | null;
```

**Recommended Fix**:
Run `supabase gen types typescript --local > src/types/database.types.ts` to update types, then remove the manual interface and casts.

---

### 6. Unused schema imports in scripture-reflection-api.spec.ts

**Severity**: P3 (Low)
**Location**: `tests/api/scripture-reflection-api.spec.ts:13-16`
**Criterion**: Maintainability

**Issue Description**:
`SupabaseSessionSchema` is imported but only used in 2 of 10 tests. `SupabaseBookmarkSchema` and `SupabaseMessageSchema` are used correctly. Not a bug, but indicates the file covers too many concerns (further evidence for splitting).

---

### 7. example-rpc.spec.ts missing test IDs and priority markers

**Severity**: P2 (Medium)
**Location**: `tests/integration/example-rpc.spec.ts:18,50`
**Criterion**: Test IDs / Priority Markers
**Knowledge Base**: [test-levels-framework.md](../../../tea/testarch/knowledge/test-levels-framework.md)

**Issue Description**:
Unlike the API tests which have proper test IDs (e.g., `[4.1-API-001]`) and priority markers (e.g., `[P1]`), the integration test has neither.

**Current Code**:

```typescript
test('scripture_seed_test_data RPC creates session with correct structure', async ({ ... }) => {
test('cleanup removes all related data in FK order', async ({ ... }) => {
```

**Recommended Fix**:

```typescript
test('[P1] [INT-001] scripture_seed_test_data RPC creates session with correct structure', async ({ ... }) => {
test('[P1] [INT-002] cleanup removes all related data in FK order', async ({ ... }) => {
```

---

## Best Practices Found

### 1. Correct merged-fixtures Import Pattern

**Location**: All 3 files, line 1 of imports
**Pattern**: Consistent fixture import
**Knowledge Base**: [overview.md](../../../tea/testarch/knowledge/overview.md)

**Why This Is Good**:
All files correctly import `{ test, expect }` from `../support/merged-fixtures` instead of from bare `@playwright/test`. This ensures all playwright-utils fixtures (apiRequest, recurse, log, etc.) are available.

```typescript
import { test, expect } from '../support/merged-fixtures';
```

**Use as Reference**: This is the correct pattern for all test files in this project.

### 2. Factory-Based Test Data with Cleanup

**Location**: `tests/api/scripture-reflection-api.spec.ts:20-27`
**Pattern**: Data factory with faker
**Knowledge Base**: [data-factories.md](../../../tea/testarch/knowledge/data-factories.md)

**Why This Is Good**:
Dynamic data generation using faker prevents parallel test collisions and makes test intent clear.

```typescript
function generateReflectionNote(prefix = 'test'): string {
  return `${prefix}-${faker.lorem.sentence()}`;
}

function generateRating(): number {
  return faker.number.int({ min: 1, max: 5 });
}
```

### 3. Zod Schema Validation on API Responses

**Location**: `tests/api/scripture-reflection-api.spec.ts:179`
**Pattern**: responseSchema parameter
**Knowledge Base**: [api-request.md](../../../tea/testarch/knowledge/api-request.md)

**Why This Is Good**:
Using `responseSchema: SupabaseReflectionSchema` on `apiRequest` calls leverages playwright-utils' built-in schema validation — single-line response contract verification.

```typescript
const response = await apiRequest({
  method: 'POST',
  path: '/rest/v1/rpc/scripture_submit_reflection',
  // ...
  responseSchema: SupabaseReflectionSchema, // Validates response shape
});
```

### 4. Proper Try/Finally Cleanup Pattern

**Location**: All test files
**Pattern**: Deterministic cleanup
**Knowledge Base**: [test-quality.md](../../../tea/testarch/knowledge/test-quality.md)

**Why This Is Good**:
Every test wraps its assertions in try/finally to ensure cleanup runs even on failure. This prevents test pollution.

```typescript
try {
  // WHEN + THEN assertions
} finally {
  await unlinkTestPartners(supabaseAdmin, user1Id, user2Id);
  await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
}
```

---

## Test File Analysis

### File Metadata

| File | Lines | KB | Framework | Tests | Describe Blocks |
| ---- | ----- | -- | --------- | ----- | --------------- |
| `tests/api/scripture-lobby-4.1.spec.ts` | 377 | ~14 | Playwright | 5 | 4 |
| `tests/api/scripture-reflection-api.spec.ts` | 1003 | ~37 | Playwright | 10 | 8 |
| `tests/integration/example-rpc.spec.ts` | 81 | ~3 | Playwright | 2 | 1 |

### Test Structure

- **Total Test Cases**: 17
- **Average Test Length**: ~55 lines per test
- **Fixtures Used**: `supabaseAdmin`, `apiRequest` (from merged-fixtures)
- **Data Factories Used**: `createTestSession`, `cleanupTestSession`, `linkTestPartners`, `unlinkTestPartners`, `getUserAccessToken`, `generateReflectionNote`, `generateRating`

### Test Scope

- **Test IDs**: 4.1-API-001, 4.1-API-002, 4.1-API-003, 2.2-API-001, 2.3-API-001, 2.3-API-002, 2.3-API-003, 2.3-API-004
- **Priority Distribution**:
  - P0 (Critical): 4 tests
  - P1 (High): 13 tests
  - P2 (Medium): 0 tests
  - P3 (Low): 0 tests
  - Unknown: 2 tests (example-rpc.spec.ts)

### Assertions Analysis

- **Total Assertions**: ~120
- **Assertions per Test**: ~7 (avg)
- **Assertion Types**: `toBe`, `toBeNull`, `toBeTruthy`, `toHaveLength`, `toEqual`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `not.toBeNull`, `not.toBe`

---

## Context and Integration

### Related Artifacts

- **Merged Fixtures**: [merged-fixtures.ts](../../tests/support/merged-fixtures.ts) - correctly used
- **Factories**: [factories/index.ts](../../tests/support/factories/index.ts) - RPC-based seeding
- **Supabase Helpers**: [helpers/supabase.ts](../../tests/support/helpers/supabase.ts) - token management

---

## Knowledge Base References

This review consulted the following knowledge base fragments:

- **[test-quality.md](../../../tea/testarch/knowledge/test-quality.md)** - Definition of Done for tests (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[overview.md](../../../tea/testarch/knowledge/overview.md)** - Playwright Utils installation, fixture composition, mergeTests pattern
- **[api-request.md](../../../tea/testarch/knowledge/api-request.md)** - Typed HTTP client, schema validation, URL resolution, baseUrl config
- **[auth-session.md](../../../tea/testarch/knowledge/auth-session.md)** - Token persistence, multi-user, API authentication
- **[data-factories.md](../../../tea/testarch/knowledge/data-factories.md)** - Factory functions with overrides, API-first setup
- **[test-levels-framework.md](../../../tea/testarch/knowledge/test-levels-framework.md)** - API vs Integration test appropriateness
- **[test-healing-patterns.md](../../../tea/testarch/knowledge/test-healing-patterns.md)** - Common failure patterns and fixes
- **[recurse.md](../../../tea/testarch/knowledge/recurse.md)** - Polling patterns (not used in these tests but available)

See [tea-index.csv](../../../tea/testarch/tea-index.csv) for complete knowledge base.

---

## Next Steps

### Immediate Actions (Before Merge)

1. **Run `supabase gen types`** - Regenerate database types to remove ScriptureSessionLobbyRow workaround
   - Priority: P2
   - Estimated Effort: 5 minutes

### Follow-up Actions (Future PRs)

1. **Split scripture-reflection-api.spec.ts** into 3 files by story
   - Priority: P1
   - Target: next sprint

2. **Extract baseURL/anonKey/headers into config** via playwright.config.ts or configBaseUrl
   - Priority: P1
   - Target: next sprint

3. **Integrate auth-session fixture** for token management
   - Priority: P1
   - Target: backlog (requires SupabaseAuthProvider implementation)

4. **Add test IDs to example-rpc.spec.ts**
   - Priority: P2
   - Target: next sprint

### Re-Review Needed?

No re-review needed - approve as-is. All issues are maintainability improvements, not correctness or reliability concerns.

---

## Decision

**Recommendation**: Approve with Comments

**Rationale**:
Test quality is acceptable with 74/100 score. The tests are functionally correct, well-isolated, deterministic, and follow BDD patterns. The main area for improvement is maintainability — specifically file length (1003-line file), code duplication (repeated baseURL/headers blocks), and underutilization of playwright-utils fixtures for auth and URL configuration. These are "clean up when convenient" items, not blockers. The tests correctly import from merged-fixtures and use `apiRequest` from playwright-utils, which means the foundation is right — they just need the boilerplate trimmed.

> Test quality is acceptable with 74/100 score. High-priority recommendations should be addressed but don't block merge. Critical issues resolved, but improvements would enhance maintainability.

---

## Appendix

### Violation Summary by Location

| File | Line | Severity | Criterion | Issue | Fix |
| ---- | ---- | -------- | --------- | ----- | --- |
| scripture-reflection-api.spec.ts | 1-1003 | P1 | Length | 1003 lines (3.3x limit) | Split into 3 files |
| scripture-lobby-4.1.spec.ts | 1-377 | P2 | Length | 377 lines (1.25x limit) | Extract boilerplate |
| All API files | Multiple | P1 | DRY | baseURL/anonKey repeated 20+ times | Config/fixture |
| All API files | Multiple | P1 | Fixtures | Manual getUserAccessToken | auth-session fixture |
| scripture-lobby-4.1.spec.ts | 22-31 | P2 | Maintenance | Type cast workaround persisted | Run supabase gen types |
| example-rpc.spec.ts | 18,50 | P2 | Test IDs | Missing test IDs and priority | Add [ID] [P1] markers |
| scripture-reflection-api.spec.ts | 13-16 | P3 | Maintenance | Unused/scattered schema imports | Clean up after split |

### Playwright-Utils Adoption Status

| Utility | Status | Notes |
| ------- | ------ | ----- |
| apiRequest | ADOPTED | Used correctly in all test files |
| responseSchema | PARTIAL | Used in some tests (scripture-reflection-api), not all |
| configBaseUrl | NOT USED | Tests pass baseUrl manually every call |
| auth-session | NOT USED | Manual getUserAccessToken instead |
| recurse | NOT USED | No polling needed for these tests |
| log | NOT USED | No structured logging in tests |
| interceptNetworkCall | N/A | API-only tests, no browser |
| networkErrorMonitor | N/A | API-only tests, no browser |

---

## Review Metadata

**Generated By**: BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review v5.0
**Review ID**: test-review-api-integration-20260304
**Timestamp**: 2026-03-04
**Version**: 1.0
**Execution Mode**: sequential (team agent context)
