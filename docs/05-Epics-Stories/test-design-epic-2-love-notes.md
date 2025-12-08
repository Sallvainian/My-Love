# Test Design: Epic 2 - Love Notes Real-Time Messaging

**Date:** 2025-12-07
**Author:** TEA (Test Engineering Architect) via BMAD Workflow
**Status:** Draft
**Story Reference:** TD-1.2 - Love Notes E2E Test Regeneration

---

## Executive Summary

**Scope:** Full test design for Epic 2 - Love Notes Real-Time Messaging (Stories 2.1-2.4)

**Risk Summary:**

- Total risks identified: 12
- High-priority risks (≥6): 4
- Critical categories: TECH, PERF, DATA, BUS

**Coverage Summary:**

- P0 scenarios: 8 (16 hours)
- P1 scenarios: 12 (12 hours)
- P2/P3 scenarios: 10 (5 hours)
- **Total effort**: 33 hours (~4 days)

**Quality Gate Context:**

This test design supports Story TD-1.2 which regenerates Love Notes E2E tests previously archived with a 52/100 quality score. All tests MUST:
- Score ≥85/100 on TEA quality rubric
- Pass all 16 quality gates from `e2e-quality-standards.md`
- Contain zero anti-patterns (conditional flow, error swallowing, runtime skip)

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| R-001 | TECH | Supabase Realtime subscription drops silently, missing messages | 2 | 3 | 6 | Test subscription reconnection; Mock WebSocket events; Verify deduplication | QA | Sprint |
| R-002 | PERF | Virtualized message list causes scroll position jumps during data load | 2 | 3 | 6 | Test scroll position preservation with network intercepts; Verify DOM node count | QA | Sprint |
| R-003 | DATA | Optimistic update rollback fails, leaving ghost messages | 2 | 3 | 6 | Test error scenarios with network failures; Verify rollback removes temp message | QA | Sprint |
| R-004 | BUS | Message deduplication fails, showing duplicates to user | 3 | 2 | 6 | Test rapid message sending; Verify no duplicate IDs rendered | QA | Sprint |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| R-005 | TECH | Network-first pattern violated causing race conditions | 2 | 2 | 4 | Enforce intercept-before-navigate in all API tests | QA |
| R-006 | PERF | Message history pagination causes visible loading jank | 2 | 2 | 4 | Test infinite scroll triggers; Verify loading indicator visibility | QA |
| R-007 | SEC | XSS via unsanitized message content | 1 | 3 | 3 | Test script injection in message body; Verify sanitized render | QA |
| R-008 | DATA | Image attachment upload fails silently with bad file type | 2 | 2 | 4 | Test file type validation for JPEG/PNG/WebP only | QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------- |
| R-009 | OPS | Haptic feedback (Vibration API) fails on unsupported browsers | 1 | 1 | 1 | Monitor - feature detection exists |
| R-010 | BUS | Character counter edge case at exactly 1000 chars | 1 | 1 | 1 | Monitor - covered in unit tests |
| R-011 | TECH | Send button enable/disable flickers during rapid typing | 1 | 2 | 2 | Monitor - UX polish |
| R-012 | OPS | Image preview cleanup leaks object URLs | 1 | 2 | 2 | Monitor - memory profile in dev |

### Risk Category Legend

- **TECH**: Technical/Architecture (WebSocket, virtualization, API integration)
- **SEC**: Security (XSS, injection, sanitization)
- **PERF**: Performance (scroll jank, loading states, DOM count)
- **DATA**: Data Integrity (deduplication, optimistic updates, message ordering)
- **BUS**: Business Impact (UX, duplicates, missing messages)
- **OPS**: Operations (browser compatibility, memory leaks)

---

## Test Coverage Plan

### P0 (Critical) - Run on every commit

**Criteria**: Blocks core messaging journey + High risk (≥6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| Send text message with optimistic update | E2E | R-003 | 2 | QA | Happy path + error rollback |
| Message appears immediately before server confirmation | E2E | R-003 | 1 | QA | Network delay simulation |
| Receive message in real-time via Supabase Realtime | E2E | R-001 | 2 | QA | Happy path + reconnection |
| Message deduplication prevents duplicates | E2E | R-004 | 1 | QA | Rapid send simulation |
| Scroll position maintained during pagination load | E2E | R-002 | 1 | QA | Network-first pattern |
| Virtualized list renders efficiently (DOM node check) | E2E | R-002 | 1 | QA | Performance assertion |

**Total P0**: 8 tests, 16 hours

### P1 (High) - Run on PR to main

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| Chat UI displays messages in conversation format | E2E | - | 1 | QA | Layout verification |
| Partner messages left, user messages right | E2E | - | 1 | QA | Visual alignment |
| Timestamp in friendly format | E2E | - | 2 | QA | Today, yesterday, older |
| Message input validation (empty, max length) | E2E | R-010 | 2 | QA | Boundary conditions |
| Character counter behavior (900+, 950+, 1000+) | E2E | R-010 | 1 | QA | Progressive warning |
| Keyboard shortcuts (Enter send, Shift+Enter newline) | E2E | - | 2 | QA | Modifier key handling |
| Image attachment button visible | E2E | - | 1 | QA | Feature access |
| Image preview on selection | E2E | R-008 | 1 | QA | File API integration |
| File type validation (JPEG, PNG, WebP only) | E2E | R-008 | 1 | QA | Rejection test |

**Total P1**: 12 tests, 12 hours

### P2 (Medium) - Run nightly/weekly

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| Send button enable/disable states | E2E | R-011 | 1 | QA | State transitions |
| Empty state display | E2E | - | 1 | QA | No messages view |
| Loading indicator behavior | E2E | R-006 | 1 | QA | Spinner visibility |
| XSS sanitization of message content | E2E | R-007 | 1 | QA | Script injection |
| Send image with text | E2E | - | 1 | QA | Combined upload |
| Send image without text | E2E | - | 1 | QA | Image-only message |
| Error state display on send failure | E2E | - | 1 | QA | Network error UI |

**Total P2**: 7 tests, 3.5 hours

### P3 (Low) - Run on-demand

**Criteria**: Nice-to-have + Exploratory + Performance benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| ----------- | ---------- | ---------- | ----- | ----- |
| Haptic feedback on send | E2E | 1 | QA | Browser API mock |
| Haptic feedback on receive | E2E | 1 | QA | Browser API mock |
| Background tab message accumulation | E2E | 1 | QA | Tab visibility API |

**Total P3**: 3 tests, 1.5 hours

---

## Execution Order

### Smoke Tests (<5 min)

**Purpose**: Fast feedback, catch build-breaking issues

- [ ] Login and navigate to Love Notes page (30s)
- [ ] Send a simple text message (45s)
- [ ] Verify message appears in chat (30s)

**Total**: 3 scenarios

### P0 Tests (<10 min)

**Purpose**: Critical path validation

- [ ] Send message with optimistic update (E2E)
- [ ] Optimistic update rollback on error (E2E)
- [ ] Real-time message reception (E2E)
- [ ] Subscription reconnection after drop (E2E)
- [ ] Message deduplication (E2E)
- [ ] Scroll position preservation (E2E)
- [ ] Virtualized list DOM count check (E2E)
- [ ] Network delay simulation (E2E)

**Total**: 8 scenarios

### P1 Tests (<30 min)

**Purpose**: Important feature coverage

- [ ] Chat UI layout verification (E2E)
- [ ] Message alignment (left/right) (E2E)
- [ ] Timestamp format - today (E2E)
- [ ] Timestamp format - older dates (E2E)
- [ ] Empty message validation (E2E)
- [ ] Max length validation (E2E)
- [ ] Character counter thresholds (E2E)
- [ ] Enter to send (E2E)
- [ ] Shift+Enter for newline (E2E)
- [ ] Image attachment button (E2E)
- [ ] Image preview (E2E)
- [ ] Invalid file type rejection (E2E)

**Total**: 12 scenarios

### P2/P3 Tests (<60 min)

**Purpose**: Full regression coverage

- [ ] Send button states (E2E)
- [ ] Empty state (E2E)
- [ ] Loading indicator (E2E)
- [ ] XSS sanitization (E2E)
- [ ] Image with text (E2E)
- [ ] Image without text (E2E)
- [ ] Error state UI (E2E)
- [ ] Haptic on send (E2E)
- [ ] Haptic on receive (E2E)
- [ ] Background tab behavior (E2E)

**Total**: 10 scenarios

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| -------- | ----- | ---------- | ----------- | ----- |
| P0 | 8 | 2.0 | 16 | Complex setup, network mocking |
| P1 | 12 | 1.0 | 12 | Standard coverage |
| P2 | 7 | 0.5 | 3.5 | Simple scenarios |
| P3 | 3 | 0.5 | 1.5 | Exploratory |
| **Total** | **30** | **-** | **33** | **~4 days** |

### Prerequisites

**Test Data:**

- `createTestMessage()` factory (faker-based, auto-cleanup)
- `mockLoveNotesAPI()` fixture (network-first intercept)
- `mockRealtimeChannel()` fixture (WebSocket simulation)

**Tooling:**

- Playwright with page fixtures from `love-notes.setup.ts`
- Network interception from `@seontechnologies/playwright-utils` (if enabled)
- Auth fixtures from `auth.setup.ts` (TD-1.1 prerequisite)

**Environment:**

- Local dev server (npm run dev)
- Supabase test project with RLS enabled
- Test user credentials in environment variables

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk mitigations**: 100% complete or approved waivers

### Coverage Targets

- **Critical paths**: ≥80% (send, receive, scroll)
- **Security scenarios**: 100% (XSS test mandatory)
- **Business logic**: ≥70% (optimistic updates, deduplication)
- **Edge cases**: ≥50% (character limits, file types)

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) items unmitigated
- [ ] Security tests (XSS) pass 100%
- [ ] Performance targets met (DOM count, scroll position)

### TEA Quality Gates (16 Mandatory)

All tests MUST pass these quality gates from `e2e-quality-standards.md`:

**Determinism Gates (1-5):**
1. [x] No `waitForTimeout()` or arbitrary delays
2. [x] No `if/else` conditional logic in test bodies
3. [x] No `.catch(() => false)` error swallowing
4. [x] No runtime `test.skip()` decisions
5. [x] Deterministic waits only (`waitForResponse`, `waitFor({ state })`)

**Assertion Gates (6-10):**
6. [x] All test paths have guaranteed assertions
7. [x] No soft assertions that don't fail tests
8. [x] Explicit assertions (no `isVisible().catch(() => false)`)
9. [x] Meaningful assertions (not just `toBeTruthy()`)
10. [x] API response validation where applicable

**Selector Gates (11-13):**
11. [x] Accessibility-first selector hierarchy (getByRole > getByLabel > getByTestId)
12. [x] No brittle CSS/XPath selectors
13. [x] Filter over index for list items

**Structure Gates (14-16):**
14. [x] Test isolation (no shared mutable state)
15. [x] Network-first pattern (intercept before navigate)
16. [x] Cleanup in afterEach/afterAll

---

## Mitigation Plans

### R-001: Realtime Subscription Drops (Score: 6)

**Mitigation Strategy:** Test subscription lifecycle explicitly. Mock WebSocket disconnect/reconnect events. Verify messages received after reconnection match expected sequence.

**Owner:** QA
**Timeline:** Sprint
**Status:** Planned
**Verification:** E2E test `realtime-reception.spec.ts` includes reconnection scenario

### R-002: Scroll Position Jumps (Score: 6)

**Mitigation Strategy:** Use network-first pattern to control data arrival timing. Assert scroll position before and after pagination load. Verify virtualized list maintains position.

**Owner:** QA
**Timeline:** Sprint
**Status:** Planned
**Verification:** E2E test `message-history.spec.ts` asserts `scrollTop` preservation

### R-003: Optimistic Update Rollback Fails (Score: 6)

**Mitigation Strategy:** Mock network failure after optimistic insert. Assert temporary message removed from DOM. Verify error state displayed correctly.

**Owner:** QA
**Timeline:** Sprint
**Status:** Planned
**Verification:** E2E test `send-message.spec.ts` includes error rollback scenario

### R-004: Message Deduplication Fails (Score: 6)

**Mitigation Strategy:** Send multiple rapid messages. Assert no duplicate IDs in rendered list. Use data-testid with message ID for unique identification.

**Owner:** QA
**Timeline:** Sprint
**Status:** Planned
**Verification:** E2E test `send-message.spec.ts` includes rapid-send deduplication check

---

## Assumptions and Dependencies

### Assumptions

1. Auth fixtures from TD-1.1 are available and working
2. Supabase Realtime is enabled for love_notes table
3. Test user credentials are configured in environment
4. Local dev server runs on port 3000

### Dependencies

1. **TD-1.1 Auth E2E** - Required for authenticated test sessions
2. **love_notes table** - Database schema from Story 2.0 exists
3. **Supabase Realtime** - Enabled on love_notes table

### Risks to Plan

- **Risk**: Auth fixtures not ready from TD-1.1
  - **Impact**: Cannot run authenticated Love Notes tests
  - **Contingency**: Create minimal auth setup in love-notes.setup.ts

- **Risk**: Supabase Realtime rate limits in test environment
  - **Impact**: Flaky subscription tests
  - **Contingency**: Use mock WebSocket for most tests, one real integration test

---

## Anti-Pattern Prevention Reference

### Archived Test Patterns to AVOID

From `tests/e2e-archive-2025-12/send-love-note.spec.ts`:

```typescript
// ❌ ANTI-PATTERN: No-op assertion path
const sendingWasVisible = await sendingIndicator.isVisible().catch(() => false);
if (sendingWasVisible) {
  await expect(sendingIndicator).toBeHidden({ timeout: 5000 });
}
// If sendingWasVisible is false, NO assertion runs!
```

**Correct Pattern:**

```typescript
// ✅ CORRECT: Guaranteed assertion path
await expect(sendingIndicator).toBeVisible({ timeout: 5000 });
await expect(sendingIndicator).toBeHidden({ timeout: 5000 });
```

From `tests/e2e-archive-2025-12/love-notes-pagination.spec.ts`:

```typescript
// ❌ ANTI-PATTERN: Runtime test.skip with shared state
let messagesExist = false;
test.skip(!messagesExist, 'Requires seed data with messages');
```

**Correct Pattern:**

```typescript
// ✅ CORRECT: Seed data in beforeAll, deterministic test
test.beforeAll(async ({ request }) => {
  await seedTestMessages(request);
});

test('scrolling loads older messages', async ({ page }) => {
  // Test always runs with known data state
});
```

From `tests/e2e-archive-2025-12/love-notes-images.spec.ts`:

```typescript
// ❌ ANTI-PATTERN: Error swallowing + conditional
const notesNavVisible = await notesNav.isVisible().catch(() => false);
if (notesNavVisible) { ... }
```

**Correct Pattern:**

```typescript
// ✅ CORRECT: Explicit wait, no error swallowing
await expect(notesNav).toBeVisible({ timeout: 5000 });
await notesNav.click();
```

### Anti-Pattern Detection Commands

Run these before marking tests complete:

```bash
# Detect error swallowing
grep -rE "\\.catch\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*(false|\\{\\})\\s*\\)" tests/e2e/love-notes/

# Detect conditional flow in test bodies
grep -rE "^\\s*if\\s*\\(" tests/e2e/love-notes/*.spec.ts

# Detect runtime test.skip
grep -rE "test\\.skip\\s*\\(" tests/e2e/love-notes/*.spec.ts

# Detect arbitrary waits
grep -rE "waitForTimeout" tests/e2e/love-notes/
```

All commands should return no results for compliant tests.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: _________ Date: _________
- [ ] Tech Lead: _________ Date: _________
- [ ] QA Lead: _________ Date: _________

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework (6 categories)
- `probability-impact.md` - Risk scoring methodology (probability × impact)
- `test-levels-framework.md` - Test level selection (E2E vs API vs Unit)
- `test-priorities-matrix.md` - P0-P3 prioritization criteria
- `e2e-quality-standards.md` - 16 mandatory quality gates

### Related Documents

- Story: `docs/05-Epics-Stories/td-1-2-love-notes-e2e-regeneration.md`
- Epic: `docs/05-Epics-Stories/epics.md` (Epic 2 section)
- Tech Spec: `docs/05-Epics-Stories/tech-spec-epic-td-1.md`
- Quality Standards: `docs/04-Testing-QA/e2e-quality-standards.md`
- Auth Fixtures: `tests/e2e/auth/auth.setup.ts`

### Test File Structure

```
tests/e2e/love-notes/
├── love-notes.setup.ts          # Shared fixtures (network intercepts, factories)
├── send-message.spec.ts         # Story 2-2: Send with optimistic updates
├── realtime-reception.spec.ts   # Story 2-3: Real-time message reception
├── message-history.spec.ts      # Story 2-4: Pagination & scroll performance
└── image-attachments.spec.ts    # Image upload and display
```

---

**Generated by**: BMAD TEA Agent - Test Architect Module
**Workflow**: `.bmad/bmm/workflows/testarch/test-design`
**Version**: 4.0 (BMad v6)
**Story**: TD-1.2 - Love Notes E2E Test Regeneration
