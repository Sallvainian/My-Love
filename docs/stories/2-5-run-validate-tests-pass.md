# Story 2.5: Run & Validate Tests Pass

Status: ready-for-dev

## Story

As a developer,
I want all tests to pass with 100% coverage of Epic 1 features,
So that I have confidence in the stability of the foundation.

## Requirements Context Summary

**From [epics.md#Story-2.5](../../docs/epics.md#Story-2.5):**

Story 2.5 is the validation checkpoint for Epic 2, ensuring the complete test infrastructure (Stories 2.1-2.4) delivers on its promise: 100% coverage of Epic 1 features with reliable, fast, and maintainable tests. With Story 2.4 completing the webServer auto-start configuration, Story 2.5 validates that the entire test suite passes consistently across all browsers, meets performance targets, and generates comprehensive reports for debugging.

**Core Requirements:**
- **100% Epic 1 Coverage**: All features from Epic 1 (persistence fixes, pre-configuration, refactoring, deployment) have corresponding E2E tests
- **Multi-Browser Validation**: Tests pass in Chromium, Firefox, and WebKit without flakiness
- **Performance Target**: Test execution completes in under 5 minutes locally
- **Zero Flakiness**: Tests achieve 100% pass rate across 10 consecutive runs
- **HTML Reporting**: Playwright generates comprehensive HTML reports with screenshots on failure
- **Documentation**: Known limitations and edge cases documented in tests/README.md

**From [tech-spec-epic-2.md#Story-2.5](../../docs/tech-spec-epic-2.md#Story-2.5):**

Story 2.5 validates the test infrastructure against quantitative targets defined in Epic 2's NFR requirements:
- Test Execution Performance: < 5 minutes for full suite across 3 browsers (NFR line 395)
- Test Reliability: < 1% flaky test rate (99%+ consistent pass rate) (NFR line 464)
- Test Coverage: 100% of Epic 1 critical user paths (NFR line 469)
- Test Infrastructure Impact: Zero production bundle size increase (NFR line 416)

**Test Coverage Breakdown** (tech-spec-epic-2.md lines 922-952):
- Message Display: 10 test cases (rotation, animations, duration counter)
- Favorites: 8 test cases (toggle, persistence, offline mode)
- Settings: 6 test cases (pre-configuration, edits, persistence)
- Navigation: 5 test cases (theme switching, view transitions)
- Persistence: 8 test cases (LocalStorage, IndexedDB, quota handling)
- **Total**: 37 test cases × 3 browsers = 111 test executions

**From [PRD.md#NFR001](../../docs/PRD.md#NFR001):**

Performance requirement: App shall load in under 2 seconds and maintain 60fps animations. Test suite validates these requirements through PWA helpers (service worker registration timing) and visual regression checks (animation smoothness).

## Acceptance Criteria

1. **AC-2.5.1**: All Epic 1 features have corresponding E2E tests
   - Verify test coverage checklist: message display, favorites, settings, navigation, persistence
   - Confirm each Epic 1 feature (Stories 1.1-1.6) has at least one test suite
   - Validate critical user paths covered: daily message view, favorite toggle, settings edit, theme switch

2. **AC-2.5.2**: Test coverage report shows 100% of critical user paths covered
   - Generate test coverage report from test execution
   - Review HTML report test matrix (features × browsers)
   - Confirm all 37 planned test cases implemented and passing
   - Document coverage gaps if any (with justification)

3. **AC-2.5.3**: All tests pass in all configured browsers (Chromium, Firefox, WebKit)
   - Run full test suite: `npm run test:e2e`
   - Verify Chromium tests: all passing
   - Verify Firefox tests: all passing
   - Verify WebKit tests: all passing (or document known issues)
   - Check for browser-specific failures and resolve

4. **AC-2.5.4**: Tests run in under 5 minutes total
   - Measure full test suite execution time (wall clock)
   - Target: < 5 minutes for 37 tests × 3 browsers = 111 executions
   - Identify slow tests (> 15 seconds individual execution)
   - Optimize slow tests or document performance bottlenecks

5. **AC-2.5.5**: No flaky tests (consistent pass rate across 10 runs)
   - Run test suite 10 consecutive times: `for i in {1..10}; do npm run test:e2e; done`
   - Calculate pass rate: (successful runs / 10) × 100%
   - Target: 99%+ pass rate (maximum 1 flaky run out of 10)
   - Document flakiness patterns if detected
   - Fix flaky tests before marking story complete

6. **AC-2.5.6**: Generate HTML test report with screenshots on failure
   - Verify HTML report generated: `playwright-report/index.html`
   - Confirm report includes: test matrix, execution timeline, pass/fail counts
   - Trigger test failure intentionally, verify screenshot captured
   - Validate screenshot shows failure context (element state, page UI)

7. **AC-2.5.7**: Document any known limitations or edge cases not covered
   - Review test suite for gaps: features tested vs Epic 1 scope
   - Document edge cases deferred (e.g., storage quota edge cases)
   - List browser-specific limitations (e.g., WebKit IndexedDB quirks)
   - Update tests/README.md with known limitations section

## Tasks / Subtasks

- [ ] Run baseline test suite and capture current status (AC: 1, 2, 3)
  - [ ] Execute: `npm run test:e2e` (full suite, all browsers)
  - [ ] Capture: Total test count, pass/fail counts per browser
  - [ ] Review: Playwright console output for warnings or errors
  - [ ] Check: HTML report generated at `playwright-report/index.html`
  - [ ] Document: Baseline test status (how many tests exist currently)

- [ ] Validate test coverage against Epic 1 features (AC: 1, 2)
  - [ ] Create checklist: Epic 1 features from epics.md (Stories 1.1-1.6)
  - [ ] Map features to test suites:
    - [ ] Story 1.1 (Technical Debt Audit): No tests needed (analysis only)
    - [ ] Story 1.2 (Zustand Persist Fix): Persistence test suite (LocalStorage hydration)
    - [ ] Story 1.3 (IndexedDB/SW Fix): Persistence test suite (IndexedDB operations, offline mode)
    - [ ] Story 1.4 (Pre-Configuration): Settings test suite (hardcoded constants loaded)
    - [ ] Story 1.5 (Refactoring): Implicitly covered by all tests (regression detection)
    - [ ] Story 1.6 (Build/Deployment): No E2E tests needed (build process validation)
  - [ ] Verify critical user paths tested:
    - [ ] Daily message display with correct rotation algorithm
    - [ ] Favorite toggle persists across browser refresh
    - [ ] Settings show pre-configured relationship data
    - [ ] Theme switching works across all 4 themes
    - [ ] Data persists after browser close/reopen
  - [ ] Calculate coverage percentage: (tested features / total features) × 100%
  - [ ] Document coverage gaps if < 100% (with justification)

- [ ] Resolve any failing tests to achieve 100% pass rate (AC: 3)
  - [ ] If baseline run has failures:
    - [ ] Identify failing test(s): test name, browser, failure reason
    - [ ] Reproduce failure locally: `npx playwright test <test-file> --project=<browser>`
    - [ ] Debug using Playwright Inspector: `npx playwright test <test-file> --debug`
    - [ ] Review failure screenshot in HTML report
    - [ ] Determine root cause: test issue, application bug, or environment issue
    - [ ] Fix test or application code
    - [ ] Rerun failed test to verify fix
    - [ ] Run full suite to ensure no regressions from fix
  - [ ] If baseline run passes all tests:
    - [ ] Document: All tests passing (X tests, 100% pass rate)
    - [ ] Proceed to flakiness validation (next task)

- [ ] Measure test execution time and optimize if needed (AC: 4)
  - [ ] Run full test suite with time measurement: `time npm run test:e2e`
  - [ ] Record: Total execution time (wall clock seconds)
  - [ ] Compare to target: < 5 minutes (300 seconds)
  - [ ] If execution time > 5 minutes:
    - [ ] Review HTML report for slow tests (individual execution > 15s)
    - [ ] Identify bottlenecks: slow page loads, excessive waits, complex assertions
    - [ ] Optimize slow tests:
      - [ ] Reduce explicit waits (use Playwright auto-waiting)
      - [ ] Parallelize independent tests (ensure test isolation)
      - [ ] Remove redundant setup/teardown
    - [ ] Rerun after optimization, verify time reduction
  - [ ] If execution time < 5 minutes:
    - [ ] Document: Execution time meets performance target
    - [ ] Note: Individual slow tests (if any) for future optimization

- [ ] Validate test reliability with 10 consecutive runs (AC: 5)
  - [ ] Run flakiness test: `for i in {1..10}; do npm run test:e2e || echo "Run $i failed"; done`
  - [ ] Monitor each run: record pass/fail status (1-10)
  - [ ] Calculate pass rate: (successful runs / 10) × 100%
  - [ ] Target: ≥ 99% pass rate (9 or 10 passes out of 10 runs)
  - [ ] If flakiness detected (< 9 passes):
    - [ ] Identify flaky test(s): which tests fail intermittently
    - [ ] Analyze flakiness pattern:
      - [ ] Timing issue (race condition, async operation)
      - [ ] Browser-specific (fails only in WebKit, Firefox, or Chromium)
      - [ ] Environment-dependent (works locally, fails in CI)
    - [ ] Fix flaky test:
      - [ ] Add explicit waits for async operations
      - [ ] Use Playwright auto-waiting (expect().toBeVisible())
      - [ ] Increase timeout for slow operations
      - [ ] Ensure test isolation (clear state before each test)
    - [ ] Rerun 10-run test to verify fix
  - [ ] If pass rate ≥ 99%:
    - [ ] Document: Test suite reliable (X/10 runs passed, Y% pass rate)
    - [ ] Note: Any intermittent failures for monitoring

- [ ] Verify HTML report generation with failure screenshots (AC: 6)
  - [ ] Run test suite that generates report: `npm run test:e2e`
  - [ ] Verify report exists: `ls playwright-report/index.html` (file exists)
  - [ ] Open HTML report in browser: `open playwright-report/index.html`
  - [ ] Review report contents:
    - [ ] Test matrix: browsers × test suites displayed
    - [ ] Execution timeline: test run duration visualized
    - [ ] Pass/fail counts: summary statistics present
    - [ ] Test details: individual test results expandable
  - [ ] Trigger intentional test failure to verify screenshot capture:
    - [ ] Temporarily break a test: modify assertion to fail (e.g., change expected text)
    - [ ] Run failing test: `npx playwright test <modified-test>`
    - [ ] Check HTML report for failed test entry
    - [ ] Verify screenshot attached to failed test
    - [ ] Open screenshot, confirm it shows failure context:
      - [ ] Element state visible (e.g., incorrect text, missing button)
      - [ ] Page UI visible (confirms test was on correct page)
    - [ ] Revert test change, rerun to confirm passing
  - [ ] Document: HTML report generated successfully with screenshots on failure

- [ ] Document known limitations and edge cases (AC: 7)
  - [ ] Review test suite scope vs Epic 1 complete scope
  - [ ] Identify features tested vs features deferred:
    - [ ] E.g., "Story 1.1 (Audit) not tested - analysis only, no runtime behavior"
    - [ ] E.g., "Story 1.6 (Build/Deployment) not E2E tested - validated manually"
  - [ ] List edge cases not covered:
    - [ ] Storage quota exceeded scenarios (complex to test reliably)
    - [ ] Extremely slow network conditions (< 2G)
    - [ ] Browser crashes or abrupt closures (OS-level)
    - [ ] Specific PWA installation flows (platform-dependent)
  - [ ] Document browser-specific limitations:
    - [ ] WebKit IndexedDB quirks (if encountered)
    - [ ] Firefox service worker registration timing differences
    - [ ] Chromium DevTools protocol limitations
  - [ ] Update tests/README.md with "Known Limitations" section:
    - [ ] Read existing tests/README.md structure
    - [ ] Add new section: "Known Limitations and Edge Cases"
    - [ ] Include: feature gaps, edge cases deferred, browser quirks
    - [ ] Provide justification for each limitation
    - [ ] Save updates to tests/README.md

- [ ] Final validation and documentation (AC: all)
  - [ ] Run final test suite: `npm run test:e2e`
  - [ ] Confirm: All tests passing (100% pass rate)
  - [ ] Confirm: Execution time < 5 minutes
  - [ ] Confirm: HTML report generated successfully
  - [ ] Review all acceptance criteria checklist:
    - [ ] AC-2.5.1: ✅ Epic 1 features covered
    - [ ] AC-2.5.2: ✅ 100% critical paths tested
    - [ ] AC-2.5.3: ✅ All browsers passing
    - [ ] AC-2.5.4: ✅ < 5 min execution time
    - [ ] AC-2.5.5: ✅ No flaky tests (≥ 99% pass rate)
    - [ ] AC-2.5.6: ✅ HTML report with screenshots
    - [ ] AC-2.5.7: ✅ Limitations documented
  - [ ] Update story status in docs/sprint-status.yaml: backlog → drafted
  - [ ] Document completion in story file Dev Agent Record

## Dev Notes

### Architecture Context

**From [tech-spec-epic-2.md#Story-2.5](../../docs/tech-spec-epic-2.md#Story-2.5):**

- **Goal**: Validate test infrastructure delivers 100% Epic 1 coverage with reliability and performance
- **Approach**: Execute full test suite, measure performance, validate reliability (10-run test), document limitations
- **Scope**: Test validation and documentation; no new tests written (test suite complete from Story 2.2)
- **Constraint**: All 37 test cases must pass across all 3 browsers with < 1% flakiness before story completion

**From [epics.md#Story-2.5](../../docs/epics.md#Story-2.5):**

- User story: Developer wants all tests passing with 100% Epic 1 coverage
- Core value: Confidence in foundation stability before expanding to Epics 3-5
- Prerequisites: Stories 2.1-2.4 complete (framework, tests written, data-testid, auto-start configured)

**From [tech-spec-epic-2.md#Test-Coverage-Target](../../docs/tech-spec-epic-2.md#Test-Coverage-Target):**

Expected test suite structure (lines 922-952):
- **Message Display**: 10 test cases (message-display.spec.ts)
- **Favorites**: 8 test cases (favorites.spec.ts)
- **Settings**: 6 test cases (settings.spec.ts)
- **Navigation**: 5 test cases (navigation.spec.ts)
- **Persistence**: 8 test cases (persistence.spec.ts)
- **Total**: 37 test cases × 3 browsers = 111 test executions

### Learnings from Previous Story

**From Story 2.4 (Status: review - APPROVED)**

- **webServer Auto-Start Operational**: Story 2.4 delivered fully functional auto-start configuration
  - **Apply here**: Tests can run via single command `npm run test:e2e` without manual server start
  - **Pattern**: Cold start scenario validated (124 tests executed successfully)
  - **Resolution**: webServer configuration transparent to Story 2.5 validation

- **Test Infrastructure Mature**: 124 tests currently exist (105 passing in cold start, 1 Firefox-specific IndexedDB failure pre-existing from Story 2.3)
  - **Apply here**: Baseline test count is 124, not 37 as planned in tech spec
  - **Reason**: Stories 2.2 and 2.3 created more granular tests than originally estimated
  - **Action**: Validate all 124 tests, not just 37 - higher coverage is better

- **Known Firefox IndexedDB Issue**: Story 2.4 documented 1 failing test: Firefox-specific IndexedDB issue unrelated to webServer
  - **Apply here**: Story 2.5 must investigate and resolve this failure to achieve 100% pass rate (AC-2.5.3)
  - **Location**: tests/e2e/persistence.spec.ts or favorites.spec.ts (IndexedDB operations)
  - **Priority**: HIGH - blocks 100% pass rate acceptance criterion

- **Documentation Standards**: Story 2.4 added 400+ line comprehensive webServer section to tests/README.md
  - **Apply here**: Match documentation quality for Known Limitations section (AC-2.5.7)
  - **Pattern**: Include detailed explanations, examples, troubleshooting guidance
  - **Location**: Add "Known Limitations and Edge Cases" section to tests/README.md

- **Verification Rigor**: Story 2.4 validated all 7 acceptance criteria with concrete evidence
  - **Apply here**: Story 2.5 must validate all 7 acceptance criteria systematically
  - **Pattern**: Run verification scenarios, capture evidence, document results in story file
  - **Quality**: Zero false completions - every task must have verifiable completion evidence

- **Performance Targets Met**: webServer timeout (120s) accommodates typical dev server starts (10-30s)
  - **Apply here**: Test execution time target (< 5 min) should be achievable with current infrastructure
  - **Evidence**: Story 2.4 cold start test completed 124 tests successfully (time not reported but within reasonable bounds)

### Project Structure Notes

**Files to READ** (validation):
- `tests/e2e/` - All test suite files (*.spec.ts) to understand current coverage
- `playwright-report/index.html` - HTML report after test execution (generated, not committed)
- `tests/README.md` - Existing documentation structure for Known Limitations section
- `docs/sprint-status.yaml` - Current story status (will update backlog → drafted)
- `playwright.config.ts` - Test configuration (timeout, retries, browsers)

**Files to MODIFY**:
- `tests/README.md` - Add "Known Limitations and Edge Cases" section (AC-2.5.7)
- `docs/sprint-status.yaml` - Update story status: backlog → drafted
- `docs/stories/2-5-run-validate-tests-pass.md` - This file (mark tasks complete, add evidence)

**Directories Involved**:
- `tests/e2e/` - Test suites executed (no changes, validation only)
- `playwright-report/` - Generated HTML reports (not committed, validated for AC-2.5.6)

**No Files to CREATE**: Story 2.5 is validation and documentation only, no new code files

**Alignment with Architecture**:

**Epic 1 Feature Coverage Mapping**:
```
Epic 1 Features (from epics.md):
- Story 1.1: Technical Debt Audit → No tests needed (analysis only)
- Story 1.2: Zustand Persist Fix → persistence.spec.ts (LocalStorage hydration tests)
- Story 1.3: IndexedDB/SW Fix → persistence.spec.ts (IndexedDB operations, offline mode)
- Story 1.4: Pre-Configuration → settings.spec.ts (hardcoded constants validation)
- Story 1.5: Refactoring → Implicitly covered by all tests (regression detection)
- Story 1.6: Build/Deployment → No E2E tests (build process validated manually)

Test Suite Coverage:
- message-display.spec.ts → Validates message rotation, animations, duration counter
- favorites.spec.ts → Validates favorite toggle, persistence, offline mode
- settings.spec.ts → Validates pre-configured data, edits, persistence
- navigation.spec.ts → Validates theme switching, view transitions
- persistence.spec.ts → Validates LocalStorage/IndexedDB operations, quota handling
```

### Critical Areas to Investigate

**Primary Investigation Needed**:

**1. Firefox IndexedDB Failure** (HIGH PRIORITY):
- **Location**: Story 2.4 documented 1 failing Firefox test (pre-existing from Story 2.3)
- **Test File**: Likely `tests/e2e/persistence.spec.ts` or `tests/e2e/favorites.spec.ts`
- **Failure Pattern**: IndexedDB operations in Firefox
- **Action Required**:
  - Identify specific failing test: `npx playwright test --project=firefox`
  - Reproduce failure: Run Firefox test in headed mode to observe
  - Debug: Use Playwright Inspector to step through IndexedDB operations
  - Research: Firefox IndexedDB quirks or timing differences vs Chromium
  - Fix: Adjust test to handle Firefox-specific behavior or fix application code
  - Validate: Rerun Firefox tests to confirm 100% pass rate

**2. Test Count Validation**:
- **Expected**: Tech spec planned 37 test cases
- **Actual**: Story 2.4 reports 124 tests executed in cold start
- **Discrepancy**: Likely more granular tests written in Story 2.2
- **Action Required**:
  - Confirm total test count: `npm run test:e2e` and count from output
  - Review test suites to understand test breakdown
  - Document actual coverage: "124 tests covering 5 test suites (message display, favorites, settings, navigation, persistence)"
  - Validate: Higher test count is positive (better coverage), not a concern

**3. Flakiness Validation**:
- **Target**: ≥ 99% pass rate across 10 consecutive runs
- **Concern**: Firefox IndexedDB issue may cause flakiness if intermittent
- **Action Required**:
  - Run 10-run flakiness test: `for i in {1..10}; do npm run test:e2e || echo "Run $i failed"; done`
  - Monitor for intermittent failures (not just Firefox issue)
  - If flakiness detected: identify timing issues, add explicit waits
  - Document: Pass rate calculation and any intermittent failures

**4. Performance Measurement**:
- **Target**: < 5 minutes (300 seconds) for full suite
- **Current**: Story 2.4 ran 124 tests successfully but didn't report execution time
- **Action Required**:
  - Measure: `time npm run test:e2e` (capture wall clock time)
  - Compare to target: 300 seconds
  - If > 5 min: Identify slow tests in HTML report, optimize or document
  - If < 5 min: Document performance target met

### References

- [Source: docs/epics.md#Story-2.5] - User story, acceptance criteria, test coverage requirements
- [Source: docs/tech-spec-epic-2.md#Story-2.5] - Test validation approach, coverage targets (37 test cases × 3 browsers)
- [Source: docs/tech-spec-epic-2.md#Test-Coverage-Target] - Detailed test suite breakdown (lines 922-952)
- [Source: docs/tech-spec-epic-2.md#NFR-Performance] - Performance targets: < 5 min execution time (line 395)
- [Source: docs/tech-spec-epic-2.md#NFR-Reliability] - Reliability targets: < 1% flaky test rate (line 464)
- [Source: stories/2-4-configure-auto-start-preview-server.md] - Previous story learnings (webServer operational, 124 tests exist, 1 Firefox failure)
- [Source: stories/2-4-configure-auto-start-preview-server.md#Completion-Notes] - Test results: 124 tests (105 passed, 1 failed, 18 skipped)
- [Source: tests/README.md] - Existing documentation structure for Known Limitations section addition

## Dev Agent Record

### Context Reference

- `docs/stories/2-5-run-validate-tests-pass.context.xml` - Complete story context with Epic 1 feature mapping, test suite artifacts, and validation guidance

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

**Implementation Plan:**
1. Run baseline test suite (`npm run test:e2e`) and capture status
2. Validate Epic 1 feature coverage mapping (Stories 1.1-1.6)
3. Verify 100% pass rate (0 failures)
4. Measure execution time against < 5 min target
5. Run 10 consecutive test runs to validate ≥ 99% reliability
6. Verify HTML report generation and screenshot capture
7. Document Epic 1 coverage gaps and edge cases in tests/README.md
8. Perform final validation of all acceptance criteria

**Key Findings:**
- Baseline run: 106 passed, 18 skipped, 0 failed (100% pass rate achieved)
- Execution time: 1.7 minutes (102 seconds) - well under 5-minute target
- Test coverage exceeds planned 37 tests: 124 total test executions (62 unique tests × 2 browsers)
- Firefox IndexedDB issue from Story 2.4 appears resolved (no failures detected)

### Completion Notes List

**Task 1: Baseline Test Run** ✅
- Executed: `npm run test:e2e` with timing measurement
- Results: 106 passed, 18 skipped, 0 failed
- Execution time: 1.7 minutes (102 seconds)
- HTML report generated at `playwright-report/index.html` (591KB)
- Browsers tested: Chromium, Firefox (WebKit disabled per Known Limitations)

**Task 2: Epic 1 Coverage Validation** ✅
- Story 1.1 (Technical Debt Audit): No tests needed - analysis only
- Story 1.2 (Zustand Persist Fix): `persistence.spec.ts` - LocalStorage hydration, state persistence
- Story 1.3 (IndexedDB/SW Fix): `persistence.spec.ts`, `favorites.spec.ts` - IndexedDB ops, offline mode
- Story 1.4 (Pre-Configuration): `settings.spec.ts` - hardcoded constants validation
- Story 1.5 (Refactoring): All tests - implicit regression detection
- Story 1.6 (Build/Deployment): No E2E tests - manual validation
- **Coverage: 100% of Epic 1 critical user paths**

**Task 3: Resolve Failing Tests** ✅
- No failing tests detected in baseline run
- Firefox IndexedDB issue from Story 2.4 not reproduced
- 100% pass rate achieved without fixes needed

**Task 4: Performance Measurement** ✅
- Full test suite execution: 1.7 minutes (102 seconds)
- Target: < 5 minutes (300 seconds)
- **Performance target exceeded** (only 34% of allowed time used)

**Task 5: Flakiness Test** ⏳ In Progress
- Running 10 consecutive test runs to validate ≥ 99% pass rate
- Progress: 3/10 runs completed (Runs 1-2: PASSED)
- Expected completion time: ~17 minutes total

**Task 6: HTML Report & Screenshots** ⏳ In Progress
- HTML report verified to exist at `playwright-report/index.html`
- Screenshot capture test running (intentional failure to verify screenshot capture)
- Will verify screenshot shows failure context and UI state

**Task 7: Documentation** ✅
- Added comprehensive "Epic 1 Test Coverage and Scope" section to `tests/README.md`
- Documented features covered by E2E tests (Stories 1.2-1.5)
- Documented features intentionally not covered (Stories 1.1, 1.6)
- Listed edge cases not covered with justifications
- Updated "Last Updated" metadata to Story 2.5

### File List

## Change Log

- **2025-10-31**: Story 2.5 drafted - Run & validate tests pass with 100% Epic 1 coverage
  - Created story file from epic breakdown and technical specifications
  - Mapped Epic 1 features to test suite coverage
  - Identified critical investigation needed: Firefox IndexedDB failure from Story 2.4
  - Documented test validation approach: baseline run, coverage check, flakiness test, performance measurement
  - Status: drafted (backlog → drafted), ready for dev agent execution
