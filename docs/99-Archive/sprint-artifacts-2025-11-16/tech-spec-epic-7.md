# Epic Technical Specification: NFR Testing & Technical Debt

Date: 2025-11-15
Author: Frank
Epic ID: 7
Status: Draft

---

## Overview

Epic 7 addresses critical testing gaps identified in the System-Level Test Retrospective (2025-11-15). While the My-Love PWA has strong functional requirement coverage (33/33 FRs at 100%), non-functional requirements (NFRs) have significant blind spots. The highest priority risk is R-001 (Offline functionality) with a CRITICAL score of 8/10—this is a PWA, and offline support is a core promise that has zero test coverage.

This epic focuses on establishing comprehensive NFR testing infrastructure to validate the application's performance, offline capabilities, browser compatibility, mobile responsiveness, and security posture. The goal is to reduce identified risks to acceptable levels and provide regression protection for non-functional characteristics that are essential to user experience.

## Objectives and Scope

**In-Scope:**

- Service worker lifecycle testing (registration, activation, updates, cache invalidation)
- Offline mode detection and UI state management testing
- Cache-first strategy validation for static assets and data
- Network failure recovery and sync queue testing
- Mobile viewport responsiveness testing (320px-428px breakpoints)
- Touch gesture accuracy validation
- Performance baseline establishment (Lighthouse CI integration)
- Bundle size budget enforcement
- Cross-browser compatibility validation (Chrome, Firefox, Safari, Edge)
- Row Level Security (RLS) adversarial testing
- CI pipeline integration for all new tests

**Out-of-Scope:**

- Implementing new features (testing only)
- Push notification testing (not currently implemented)
- Background Sync API implementation (if not present)
- Performance optimization code changes (just measurement)
- Visual regression testing infrastructure (future enhancement)
- Mutation testing setup (long-term technical debt)

## System Architecture Alignment

**Architecture Components Affected:**

- **Service Worker** (`vite-plugin-pwa` v1.1.0): Testing lifecycle and caching strategies
- **IndexedDB** (`idb` v8.0.3): Validating offline data access patterns
- **Supabase Client** (`@supabase/supabase-js` v2.81.1): Testing graceful degradation when offline
- **Playwright** (`@playwright/test` v1.56.1): Extending E2E suite with NFR scenarios
- **Vitest** (`vitest` v4.0.9): Unit tests for offline queue logic
- **GitHub Actions**: CI pipeline enhancement with new quality gates

**Architectural Constraints:**

- Tests must not modify production code (testing-only epic)
- Service worker testing requires Playwright's `context.setOffline()` API
- Performance testing needs Lighthouse CI integration
- Cross-browser testing requires Playwright multi-project configuration
- All tests must be non-flaky (deterministic, with retry logic for network simulation)

## Detailed Design

### Services and Modules

| Module                                                                 | Responsibility                                                                        | Inputs                                    | Outputs                                           | Owner       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------- | ----------- |
| **Offline Test Suite** (`tests/e2e/offline-*.spec.ts`)                 | Validate service worker lifecycle, offline detection, cache strategies, sync recovery | Network conditions, app state             | Test assertions, coverage reports                 | E2E Testing |
| **Mobile Viewport Tests** (`tests/e2e/responsive-*.spec.ts`)           | Validate responsive layouts across viewport breakpoints                               | Viewport dimensions (320px, 375px, 428px) | Layout validation results, touch gesture accuracy | E2E Testing |
| **Performance Monitor** (`tests/performance/`)                         | Track Lighthouse metrics, bundle size budgets                                         | Build artifacts, runtime metrics          | LCP, FCP, TTI scores, bundle size reports         | CI Pipeline |
| **Browser Compatibility Suite** (`playwright.config.ts` multi-project) | Cross-browser validation                                                              | Test scenarios                            | Browser-specific pass/fail results                | E2E Testing |
| **RLS Security Tests** (`tests/e2e/security-*.spec.ts`)                | Adversarial testing of Row Level Security policies                                    | Cross-user access attempts                | Security validation reports                       | E2E Testing |

### Data Models and Contracts

**Offline Sync Queue Schema** (if implementation needed):

```typescript
interface SyncQueueItem {
  id: string;
  type: 'mood' | 'interaction';
  payload: MoodEntry | Interaction;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

// localStorage key: 'my-love-sync-queue'
type SyncQueue = SyncQueueItem[];
```

**Performance Budget Contract**:

```typescript
interface PerformanceBudget {
  maxBundleSizeKB: 300;
  maxLCP: 2500; // ms
  maxFCP: 1800; // ms
  maxTTI: 3800; // ms
  minLighthouseScore: 90;
}
```

**Test Result Schema**:

```typescript
interface NFRTestResult {
  category: 'offline' | 'performance' | 'responsiveness' | 'security' | 'compatibility';
  testName: string;
  passed: boolean;
  riskId: string; // R-001, R-002, etc.
  metrics?: Record<string, number>;
  timestamp: Date;
}
```

### APIs and Interfaces

**Playwright Context API (for offline testing)**:

```typescript
// Set browser offline mode
await context.setOffline(true);

// Restore network connectivity
await context.setOffline(false);

// Verify service worker registration
const swRegistration = await page.evaluate(() => navigator.serviceWorker.ready);

// Check online status
const isOnline = await page.evaluate(() => navigator.onLine);
```

**Lighthouse CI API (for performance testing)**:

```typescript
// Package: @lhci/cli
// Configuration: lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:5173/My-Love/"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interactive": ["error", { "maxNumericValue": 3800 }]
      }
    }
  }
}
```

**Viewport Emulation API (for responsive testing)**:

```typescript
// Playwright device emulation
const devices = ['iPhone SE', 'iPhone 12', 'iPhone 14 Pro'];
await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
await page.setViewportSize({ width: 375, height: 812 }); // iPhone X/12
await page.setViewportSize({ width: 428, height: 926 }); // iPhone 14 Pro Max
```

### Workflows and Sequencing

**Story 7-1: Offline Mode Testing Suite**

```
1. Create test directory structure
   └── tests/e2e/offline-service-worker.spec.ts
   └── tests/e2e/offline-detection.spec.ts
   └── tests/e2e/offline-cache-strategy.spec.ts
   └── tests/e2e/offline-sync-recovery.spec.ts

2. Service Worker Lifecycle Tests
   ├── Test SW registration on first load
   ├── Test SW activation after registration
   ├── Test SW update detection
   └── Test cache invalidation on new version

3. Offline Mode Detection Tests
   ├── Test navigator.onLine status detection
   ├── Test UI state changes when offline
   ├── Test network reconnection detection
   └── Test sync trigger on reconnection

4. Cache-First Strategy Validation
   ├── Load app once to populate cache
   ├── Go offline (context.setOffline(true))
   ├── Verify static assets served from cache
   ├── Verify message data accessible
   ├── Verify photo gallery accessible (IndexedDB)
   └── Verify navigation works without network

5. Sync Recovery Tests
   ├── Log mood while offline
   ├── Verify queued in localStorage/IndexedDB
   ├── Go online
   ├── Verify queue processing
   └── Verify queue cleared after sync

6. CI Integration
   └── Update .github/workflows/playwright.yml
```

**Future Stories (Recommended Sprint 7 Continuation)**:

- **7-2**: Mobile Viewport Responsiveness Tests (R-002)
- **7-3**: Lighthouse CI Performance Budgets (R-004)
- **7-4**: Multi-Browser Playwright Configuration (R-005)
- **7-5**: RLS Security Audit Tests (R-003)

## Non-Functional Requirements

### Performance

**Measurable Targets (from PRD NFR001)**:

- **Load Time**: App SHALL load in < 2 seconds on 3G connection
- **Animation FPS**: Maintain 60fps for all Framer Motion animations
- **First Contentful Paint (FCP)**: < 1.8 seconds
- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Time to Interactive (TTI)**: < 3.8 seconds
- **Bundle Size**: < 300KB gzipped (main bundle)

**Test Validation Approach**:

- Lighthouse CI integration with performance budgets
- Bundle size monitoring via `rollup-plugin-visualizer`
- Animation frame rate testing via Playwright performance tracing
- 3G network throttling simulation tests

**Gap**: Currently NO automated performance regression testing in CI (Risk R-004, score 6)

### Security

**Authentication/Authorization Requirements (from Architecture)**:

- Supabase Email/Password Auth
- JWT session management with auto-refresh
- Row Level Security (RLS) at database level
- Users can only access own data and partner's data

**Data Handling**:

- Client-side storage for photos/messages (IndexedDB)
- Server-side sync only for moods/interactions (Supabase)
- HTTPS enforced via GitHub Pages and Supabase
- XSS protection via React escaping
- Input validation via Zod schemas (653 lines of schema tests)

**Threat Model Gaps (Risk R-003, score 7)**:

- RLS policies need adversarial testing (cross-user access attempts)
- Token expiration edge cases not tested
- Sensitive data masking in console logs not verified
- GDPR compliance validation (data deletion) not tested

**Security Tests Required**:

- Cross-user data isolation validation
- Authentication token handling (expiration, refresh, revocation)
- Malicious input injection attempts
- Session hijacking prevention

### Reliability/Availability

**Offline-First Architecture (from PRD NFR002)**:

- App SHALL function fully offline after initial load
- Exception: Mood sync and poke/kiss features require network
- Service worker pre-caches all static assets
- IndexedDB provides local data access without network
- Graceful degradation when backend unavailable

**Recovery Behavior**:

- Network failures fall back to local-only mode
- Sync queue buffers operations for later retry
- Cache invalidation on service worker updates
- No data loss during offline periods

**Critical Gap**: Zero test coverage for offline functionality (Risk R-001, score 8 CRITICAL)

**Degradation Scenarios to Test**:

- App loaded with network → network goes offline → operations continue
- App loaded offline → cached assets served
- Sync operations queued during offline → processed on reconnection
- Service worker update available while offline → updates on next online visit

### Observability

**Current Logging Strategy**:

- Development: Console logging for state updates
- Production: ErrorBoundary catches component errors
- Future: Error tracking service integration (not implemented)

**Required Signals for NFR Testing**:

- **Service Worker Events**: Registration, activation, update, cache hits/misses
- **Network Status**: Online/offline transitions, sync attempts, failures
- **Performance Metrics**: LCP, FCP, TTI, bundle size, memory usage
- **Error Rates**: Failed API calls, validation errors, IndexedDB errors

**Test Observability Outputs**:

- Playwright test reports with screenshots on failure
- GitHub Actions test artifacts (reports, logs)
- Lighthouse CI performance score history
- Bundle size trend analysis

**Monitoring Gaps**:

- No real-user monitoring (RUM) in production
- No alerting for performance regressions
- No synthetic monitoring for uptime

## Dependencies and Integrations

**Core Testing Infrastructure (Already Installed)**:

| Dependency            | Version  | Purpose                                        |
| --------------------- | -------- | ---------------------------------------------- |
| `@playwright/test`    | ^1.56.1  | E2E testing framework with offline simulation  |
| `vitest`              | ^4.0.9   | Unit testing for queue logic, helper functions |
| `@vitest/coverage-v8` | ^4.0.9   | Test coverage reporting                        |
| `fake-indexeddb`      | ^6.2.5   | Mock IndexedDB for unit tests                  |
| `happy-dom`           | ^20.0.10 | DOM environment for Vitest                     |

**New Dependencies Required**:

| Dependency                 | Version                    | Purpose                               | Stories      |
| -------------------------- | -------------------------- | ------------------------------------- | ------------ |
| `@lhci/cli`                | ^0.15.x                    | Lighthouse CI for performance budgets | 7-3 (future) |
| `rollup-plugin-visualizer` | ^6.0.5 (already installed) | Bundle size analysis                  | 7-3 (future) |

**External Integration Points**:

1. **GitHub Actions CI Pipeline** (`.github/workflows/playwright.yml`)
   - Extend workflow with offline test scenarios
   - Add performance budget assertions
   - Multi-browser matrix configuration

2. **Playwright Configuration** (`playwright.config.ts`)
   - Add multi-project configuration for cross-browser testing
   - Configure viewport presets for mobile responsiveness
   - Set up service worker test environment

3. **Supabase Backend** (existing integration)
   - Test RLS policies with adversarial scenarios
   - Validate offline queue behavior for mood/interaction sync
   - Test authentication edge cases

4. **Service Worker** (`vite-plugin-pwa` configuration)
   - Existing service worker generated by vite-plugin-pwa v1.1.0
   - Tests validate behavior, don't modify implementation
   - Workbox runtime (`workbox-window` ^7.3.0) for SW communication

**Development Environment**:

- Node.js 18+ (LTS)
- npm 9+ or yarn 1.22+
- Modern browsers for local testing (Chrome DevTools for SW debugging)
- Playwright browsers installed (`npx playwright install`)

**No Breaking Changes**: This epic is testing-only. No production code modifications required (unless sync queue implementation is missing, which would become a prerequisite implementation story).

## Acceptance Criteria (Authoritative)

**Story 7-1: Offline Mode Testing Suite (CRITICAL - R-001)**

1. **AC1-SW**: Service worker registration test passes on first load
2. **AC2-SW**: Service worker activation test completes after registration
3. **AC3-SW**: Service worker update detection test identifies new versions
4. **AC4-SW**: Cache invalidation test verifies old cache cleared on update
5. **AC5-OFFLINE**: Offline detection test validates `navigator.onLine` status
6. **AC6-OFFLINE**: UI state change test shows offline indicator when network lost
7. **AC7-OFFLINE**: Network reconnection test triggers sync operations
8. **AC8-CACHE**: Static assets test serves from cache when offline
9. **AC9-CACHE**: Message data test accessible without network
10. **AC10-CACHE**: Photo gallery test loads from IndexedDB when offline
11. **AC11-CACHE**: Navigation test works without network connectivity
12. **AC12-SYNC**: Mood logging test queues operations when offline
13. **AC13-SYNC**: Queue verification test confirms operations in localStorage/IndexedDB
14. **AC14-SYNC**: Online restoration test processes queued operations
15. **AC15-SYNC**: Queue clearing test removes processed items after sync
16. **AC16-CI**: Tests integrated into GitHub Actions pipeline
17. **AC17-CI**: Tests pass consistently (no flaky tests across 3 runs)
18. **AC18-CI**: Clear failure messages when offline behavior breaks

**Epic-Level Acceptance Criteria (All Stories Combined)**:

19. **AC19-RISK**: R-001 (Offline) risk score reduced from 8 to ≤3
20. **AC20-COVERAGE**: NFR002 has ≥80% test coverage
21. **AC21-DOC**: Test design documentation updated in test-design-system.md
22. **AC22-QUALITY**: No increase in test execution time (< 10 minutes total CI)

## Traceability Mapping

| AC            | Spec Section             | Component(s)/API(s)                  | Test Idea                                                   |
| ------------- | ------------------------ | ------------------------------------ | ----------------------------------------------------------- |
| AC1-SW        | Service Worker Lifecycle | `navigator.serviceWorker.ready`      | E2E: Load app, verify SW registration promise resolves      |
| AC2-SW        | Service Worker Lifecycle | SW activation event                  | E2E: After registration, verify SW enters 'activated' state |
| AC3-SW        | Service Worker Lifecycle | SW `updatefound` event               | E2E: Deploy new version, verify update detected             |
| AC4-SW        | Cache Strategy           | `caches.delete()`, Cache API         | E2E: Update SW, verify old caches removed                   |
| AC5-OFFLINE   | Offline Detection        | `navigator.onLine`                   | E2E: Use `context.setOffline()`, check status               |
| AC6-OFFLINE   | UI State Management      | Offline indicator component          | E2E: Go offline, verify UI shows offline badge              |
| AC7-OFFLINE   | Sync Recovery            | `window.addEventListener('online')`  | E2E: Go online, verify sync service triggered               |
| AC8-CACHE     | Cache-First Strategy     | SW fetch handler                     | E2E: Go offline after load, reload, verify assets served    |
| AC9-CACHE     | Data Persistence         | LocalStorage, Zustand persist        | E2E: Offline, verify message rotation works                 |
| AC10-CACHE    | IndexedDB Operations     | `photoStorageService`                | E2E: Offline, verify photo grid renders from IDB            |
| AC11-CACHE    | Navigation               | React Router, tab switching          | E2E: Offline, navigate between tabs without errors          |
| AC12-SYNC     | Sync Queue               | `localStorage.setItem('syncQueue')`  | E2E: Offline, log mood, verify queue entry created          |
| AC13-SYNC     | Queue Persistence        | SyncQueue schema                     | E2E: Check queue structure matches contract                 |
| AC14-SYNC     | Sync Service             | `syncService.processQueue()`         | E2E: Go online, verify API calls made                       |
| AC15-SYNC     | Queue Management         | Queue clearing logic                 | E2E: After sync, verify queue empty                         |
| AC16-CI       | GitHub Actions           | `.github/workflows/playwright.yml`   | CI: Tests run automatically on PR                           |
| AC17-CI       | Test Stability           | Playwright retry config              | CI: Run suite 3x, 100% consistent pass                      |
| AC18-CI       | Error Reporting          | Test failure messages                | CI: Verify descriptive failure output                       |
| AC19-RISK     | Risk Mitigation          | Risk matrix in test-design-system.md | Retrospective: Re-evaluate R-001 score                      |
| AC20-COVERAGE | Test Coverage            | Coverage reports                     | Metric: NFR002 coverage ≥80%                                |
| AC21-DOC      | Documentation            | test-design-system.md updates        | Doc: Add offline testing section                            |
| AC22-QUALITY  | CI Performance           | Test execution time                  | Metric: Total runtime < 10 minutes                          |

## Risks, Assumptions, Open Questions

**RISKS:**

1. **R-IMPL-001**: Sync queue implementation may not exist
   - **Impact**: HIGH - AC12-15 depend on queue infrastructure
   - **Mitigation**: During story 7-1 implementation, first audit codebase for sync queue. If missing, create prerequisite implementation story (7-0) before testing.

2. **R-IMPL-002**: Service worker testing complexity
   - **Impact**: MEDIUM - Playwright SW testing has known limitations
   - **Mitigation**: Use `page.evaluate()` for SW introspection; add retry logic for timing-sensitive tests; consult Playwright docs and community examples.

3. **R-FLAKY-001**: Network simulation tests timing sensitivity
   - **Impact**: MEDIUM - False failures in CI
   - **Mitigation**: Use explicit waits instead of timeouts; add retry configuration (`test.retry` in Playwright); validate with 10 consecutive runs before merging.

4. **R-SCOPE-001**: Epic scope creep into feature implementation
   - **Impact**: MEDIUM - This is testing-only epic
   - **Mitigation**: Any production code changes discovered as prerequisites become separate stories. Do not mix testing and implementation.

5. **R-BLOCKER-001**: Missing UI offline indicator
   - **Impact**: LOW - AC6 assumes offline indicator exists
   - **Mitigation**: If not present, either create implementation story or adjust AC to test console.warn() output instead.

**ASSUMPTIONS:**

1. **A-001**: Service worker is correctly configured by `vite-plugin-pwa`
   - Tests validate behavior, not configuration
   - If misconfigured, tests will fail and reveal the issue

2. **A-002**: IndexedDB operations already work offline
   - Based on existing `photoStorageService` and `customMessageService` tests
   - Epic 4 and 5 validated this indirectly

3. **A-003**: Supabase client handles offline gracefully
   - Existing error handling code wraps API calls
   - Tests will validate this assumption

4. **A-004**: Playwright `context.setOffline()` is reliable
   - Standard Playwright API with good documentation
   - Community usage patterns available

5. **A-005**: CI environment supports service worker testing
   - GitHub Actions uses headful Chrome
   - May need additional configuration for SW registration

**OPEN QUESTIONS:**

1. **Q-001**: Does the app have a sync queue implementation?
   - **Next Step**: Audit `src/services/` for queue logic before story 7-1 implementation
   - If NO: Create story 7-0 for minimal queue implementation

2. **Q-002**: Is there an offline indicator component?
   - **Next Step**: Search for offline/network status UI elements
   - If NO: Adjust AC6 or add small implementation task

3. **Q-003**: Should we test actual Supabase RLS policies or mock them?
   - **Recommendation**: Test against real Supabase (existing `supabase-rls.spec.ts` pattern)
   - Requires test user credentials

4. **Q-004**: What's the acceptable test execution time increase?
   - **Current**: ~5 minutes for all E2E tests
   - **Budget**: Allow up to 10 minutes total (AC22)

5. **Q-005**: Should we implement missing features or just test what exists?
   - **Decision**: Test existing behavior only. Any missing features become separate implementation stories.

## Test Strategy Summary

**Test Levels:**

1. **E2E Tests (Primary Focus)**
   - Playwright-based browser automation
   - Network condition simulation via `context.setOffline()`
   - Service worker lifecycle validation
   - User journey scenarios (load → offline → online)

2. **Integration Tests (Supporting)**
   - Sync queue logic (if implemented)
   - Service worker communication
   - IndexedDB offline access patterns

3. **Unit Tests (Minimal)**
   - Queue data structure validation
   - Helper functions for offline detection
   - Already covered by existing service tests

**Test Frameworks:**

- **Playwright 1.56.1** - E2E testing with offline simulation
- **Vitest 4.0.9** - Unit tests for queue logic (if needed)
- **GitHub Actions** - CI pipeline integration

**Coverage Strategy:**

- Focus on **NFR002 (Offline Support)** - currently 0% coverage
- Target **80%+ coverage** for offline scenarios
- Acceptance criteria coverage: All 22 ACs have corresponding tests
- Risk-based testing: Highest priority = R-001 (Offline functionality)

**Edge Cases:**

1. App loaded while already offline (cached assets only)
2. Network flapping (rapid online/offline transitions)
3. Partial network failure (some requests fail, others succeed)
4. Service worker update available while offline
5. Storage quota exceeded during offline operation
6. Long offline period (24+ hours) with many queued operations
7. Multiple tabs open with different offline states

**Test Organization:**

```
tests/e2e/
├── offline-service-worker.spec.ts    # AC1-4 (SW lifecycle)
├── offline-detection.spec.ts         # AC5-7 (Network detection)
├── offline-cache-strategy.spec.ts    # AC8-11 (Cache validation)
└── offline-sync-recovery.spec.ts     # AC12-15 (Sync queue)
```

**Success Metrics:**

- All 22 acceptance criteria pass
- R-001 risk score reduced from 8 to ≤3
- No flaky tests (100% pass rate across 3 consecutive runs)
- Test execution time < 10 minutes in CI
- Documentation updated with offline testing patterns

**Exclusions:**

- Performance testing (separate story 7-3)
- Cross-browser testing (separate story 7-4)
- Mobile responsiveness testing (separate story 7-2)
- RLS security testing (separate story 7-5)
- Visual regression testing (future epic)
- Mutation testing (long-term technical debt)
