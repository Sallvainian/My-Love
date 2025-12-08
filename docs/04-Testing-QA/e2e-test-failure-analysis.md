# E2E Test Failure Analysis Report

**Date**: 2025-12-08
**Branch**: `feature/epic-td-1-technical-debt`
**Scope**: Love Notes E2E Test Suite

---

## Executive Summary

The Love Notes E2E test suite has **~35 failing tests** across 4 spec files. Analysis reveals two distinct categories:

| Category | Count | Root Cause |
|----------|-------|------------|
| **Unimplemented Features** | ~10 | Image attachment UI not built |
| **Broken Test Patterns** | ~25 | `page.waitForResponse()` timeout issues |
| **Already Skipped** | ~15 | Properly marked with `test.skip()` |

---

## Test Files Analyzed

1. `tests/e2e/love-notes/image-attachments.spec.ts` (703 lines)
2. `tests/e2e/love-notes/send-message.spec.ts` (579 lines)
3. `tests/e2e/love-notes/message-history.spec.ts` (705 lines)
4. `tests/e2e/love-notes/realtime-reception.spec.ts` (716 lines)

---

## Category 1: Unimplemented Features

These tests are **correctly written** but fail because the application features don't exist yet.

### File: `image-attachments.spec.ts`

All image attachment tests fail because the UI components are not implemented.

| Test Name | Missing Feature | AC Reference |
|-----------|-----------------|--------------|
| `AC6.18: attaches image via button` | Attach image button | AC6.18 |
| `AC6.18: rejects non-image files` | File type validation UI | AC6.18 |
| `AC6.18: handles large image files` | File size validation UI | AC6.18 |
| `AC6.19: shows preview before sending` | Image preview component | AC6.19 |
| `AC6.20: removes attached image` | Image remove button | AC6.20 |
| `AC6.20: allows re-attaching after removal` | Re-attach flow | AC6.20 |
| `AC6.23: compresses large images before upload` | Compression indicator | AC6.23 |
| `AC6.23: maintains image quality after compression` | Quality validation UI | AC6.23 |
| `handles multiple rapid attach/remove cycles` | Attach/remove cycle | Edge case |
| `handles cancelled file selection gracefully` | File selection cancel | Edge case |

**Recommendation**: Mark these tests with `test.skip()` until Epic 2 (Image Attachments) is implemented, OR implement the missing UI components.

---

## Category 2: Broken Test Patterns (Timeout Issues)

These tests have a **common bug**: `page.waitForResponse()` is set up AFTER navigation begins, causing the response listener to miss the actual response.

### Root Cause Pattern

```typescript
// BROKEN PATTERN (in multiple tests):
await page.goto("/");

// Set up response listener AFTER navigation - TOO LATE!
const notesResponsePromise = page.waitForResponse(
  (resp) => resp.url().includes('love_notes') && resp.request().method() === 'GET'
);

await notesNav.click();
await notesResponsePromise; // TIMEOUT - response already happened
```

### Correct Pattern

```typescript
// CORRECT PATTERN:
// 1. Set up route mock BEFORE navigation
await page.route(LOVE_NOTES_API.fetchNotes, async (route) => { ... });

// 2. Set up response listener BEFORE navigation
const notesResponsePromise = page.waitForResponse(
  (resp) => resp.url().includes('love_notes') && resp.request().method() === 'GET'
);

// 3. THEN navigate
await page.goto("/");
await notesNav.click();
await notesResponsePromise; // Works - listener was ready
```

---

### File: `send-message.spec.ts`

| Test Name | Error | Line | Fix Required |
|-----------|-------|------|--------------|
| `sends message with optimistic update showing immediately` | Timeout 5000ms waiting for "response" | 70-103 | Move `waitForResponse` before action |
| `clears input after successful send` | Timeout on send | 112-135 | Move `waitForResponse` before action |
| `send button enables when text is entered` | Timeout 5000ms | 152-159 | Response listener timing |
| `send button disables when text is cleared` | Timeout 5000ms | 161-170 | Response listener timing |
| `Enter key sends message` | Timeout 5000ms | 241-272 | Move `waitForResponse` before action |
| `Shift+Enter inserts newline without sending` | Timeout 5000ms | 274-286 | Response listener timing |
| `Ctrl+Enter sends message (alternative shortcut)` | Timeout 5000ms | 288-311 | Move `waitForResponse` before action |
| `handles emoji-only messages` | Timeout 5000ms | 443-464 | Response listener timing |
| `handles message with special characters` | Timeout 5000ms | 466-489 | Response listener timing |
| `message input has accessible label` | Assertion error | 534-538 | Missing `aria-label` attribute |
| `send button has accessible name` | Assertion error | 540-545 | Missing accessible name |

---

### File: `message-history.spec.ts`

| Test Name | Error | Line | Fix Required |
|-----------|-------|------|--------------|
| `loads message history on page open (AC6.12)` | Timeout 5000ms waiting for "response" | 33-89 | Move `waitForResponse` BEFORE `goto()` |
| `shows empty state when no messages exist (AC6.17)` | Timeout 5000ms | 91-143 | Move `waitForResponse` BEFORE `goto()` |
| `only renders visible items in viewport` | Timeout 5000ms | 261-312 | Move `waitForResponse` BEFORE `goto()` |
| `maintains scroll position when not at bottom` | Timeout 5000ms | 426-491 | Move `waitForResponse` BEFORE `goto()` |
| `loads more messages on scroll up (AC6.15)` | Timeout 5000ms | 498-567 | Move `waitForResponse` BEFORE `goto()` |
| `shows beginning of conversation marker (AC6.16)` | Timeout 5000ms | 569-629 | Move `waitForResponse` BEFORE `goto()` |

**Common Issue in `message-history.spec.ts`**: All tests follow this broken pattern:

```typescript
// Line 56-73 (example from AC6.12 test):
await page.goto("/");  // Navigation starts

// TOO LATE - response listener set up AFTER goto
const notesResponsePromise = page.waitForResponse(
  (resp) => resp.url().includes('love_notes') ...
);

await notesNav.click();  // Click happens
await notesResponsePromise;  // TIMEOUT - response already fired
```

---

### File: `realtime-reception.spec.ts`

| Test Name | Error | Line | Fix Required |
|-----------|-------|------|--------------|
| `receives partner message in real-time` | Timeout 5000ms | 74-107 | Subscription mock not triggering |
| `deduplicates messages on rapid reconnection` | Timeout 5000ms | 157-186 | Subscription mock timing |
| `increments reconnection counter after reconnection` | Timeout 5000ms | 412-434 | `waitForSubscriptionState` timing |
| `receives messages sent during disconnection` | Timeout 5000ms | 442-477 | Subscription state transitions |
| `maintains message order after reconnection` | Timeout 5000ms | 479-540 | Subscription state transitions |
| `handles messages with special characters in real-time` | Timeout 5000ms | 640-668 | Subscription mock timing |
| `preserves scroll position when receiving message` | Timeout 5000ms | 670-713 | Response listener timing |

**Special Note for `realtime-reception.spec.ts`**: This file uses custom event dispatching (`__test_new_message`, `__test_subscription_set_healthy`) which requires the application to have test hooks implemented. Some tests fail because:

1. The `beforeEach` hook waits for `window.__subscriptionHealth?.isHealthy === true` but this global isn't being set
2. The custom events aren't being listened to by the application

---

## Accessibility Issues

Two tests fail due to missing accessibility attributes:

| Test | Issue | Required Fix |
|------|-------|--------------|
| `message input has accessible label` | Missing `aria-label` | Add `aria-label="love note message input"` to MessageInput |
| `send button has accessible name` | Missing accessible name | Add `aria-label="send"` or visible text to SendButton |

---

## Recommended Fixes

### Priority 1: Fix Test Patterns (25 tests)

**Fix the `waitForResponse` timing issue** in all affected files:

```typescript
// Before (broken):
await page.goto("/");
const responsePromise = page.waitForResponse(...);

// After (fixed):
const responsePromise = page.waitForResponse(...);
await page.goto("/");
```

**Estimated effort**: 2-3 hours to fix all 25 tests

### Priority 2: Skip Unimplemented Feature Tests (10 tests)

Add `test.skip()` with clear comments to image attachment tests:

```typescript
test.skip('AC6.18: attaches image via button', async ({ page }) => {
  // SKIP: Image attachment UI not implemented (Epic 2)
  // TODO: Enable when image attachment feature is complete
});
```

**Estimated effort**: 30 minutes

### Priority 3: Fix Accessibility Attributes (2 tests)

Add missing ARIA attributes to components:
- `MessageInput`: Add `aria-label="love note message input"`
- `SendButton`: Add `aria-label="send"` or ensure button text is accessible

**Estimated effort**: 15 minutes

---

## Story Recommendations

Based on this analysis, create **4 stories** (one per file):

1. **TD-1.3: Fix image-attachments.spec.ts** - Skip all tests, document missing features
2. **TD-1.4: Fix send-message.spec.ts** - Fix response listener timing + accessibility
3. **TD-1.5: Fix message-history.spec.ts** - Fix response listener timing pattern
4. **TD-1.6: Fix realtime-reception.spec.ts** - Fix subscription mock timing

---

## Appendix: Full Test List by Status

### Passing Tests (not shown in failure screenshot)
- `send button is disabled when input is empty`
- `whitespace-only input does not enable send button`

### Skipped Tests (already marked with `test.skip()`)
- All character counter tests (P1)
- All error handling tests (P1)
- Upload progress tests (AC6.21)
- Full-screen viewer tests (AC6.22)
- New message indicator tests
- Connection status UI tests
- Various edge cases

### Failing Tests (need action)
See detailed tables above.

---

*Generated by TEA (Test Architect Agent) - 2025-12-08*
