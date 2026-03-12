---
title: 'Fix GitHub Code Scanning Alerts'
slug: 'fix-code-scanning-alerts'
created: '2026-03-12'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: [TypeScript, React 19, Zustand 5, Vite 7, Playwright, Vitest]
files_to_modify:
  - .gitignore
  - tests/playwright-report/index.html (remove from git)
  - scripts/post-deploy-check.cjs
  - src/sw.ts
  - src/components/scripture-reading/containers/ScriptureOverview.tsx
  - src/components/love-notes/MessageList.tsx
  - src/components/PhotoUpload/PhotoUpload.tsx
  - src/components/MoodHistory/MoodDetailModal.tsx
  - tests/support/merged-fixtures.ts
  - tests/unit/utils/offlineErrorHandler.test.ts
  - tests/unit/services/moodService.test.ts
  - tests/unit/services/scriptureReadingService.cache.test.ts
  - tests/unit/services/scriptureReadingService.crud.test.ts
  - tests/unit/services/scriptureReadingService.service.test.ts
  - tests/unit/hooks/useScripturePresence.reconnect.test.ts
  - tests/e2e/scripture/scripture-accessibility.spec.ts
  - tests/e2e/auth/display-name-setup.spec.ts
code_patterns:
  - 'Early-return guard pattern: `if (!x) return null` before AnimatePresence'
  - 'Zustand slice creator: (set, get, api) => ({...}) - 3rd arg is standard'
  - 'CommonJS scripts use console.log with template literals for CI output'
  - 'SW message handler uses `as EventListener` cast for TypeScript compat'
test_patterns:
  - 'Unit tests import {describe, it, expect, vi, beforeEach} from vitest'
  - 'E2E tests import {test, expect} from merged-fixtures'
  - 'CodeQL flags unused vitest imports (e.g. vi, beforeAll) as unused-local-variable'
---

# Tech-Spec: Fix GitHub Code Scanning Alerts

**Created:** 2026-03-12

## Overview

### Problem Statement

The repository has 80 open GitHub code scanning alerts (CodeQL). 50 of them are false noise from a generated Playwright report HTML file that was accidentally committed. The remaining 30 are real issues: 2 error-severity log-injection vulnerabilities, 1 missing-origin-check in the service worker, trivial-conditional warnings in 4 components, unused variables across test files, and a regex anchoring issue.

### Solution

Remove the committed generated report from git tracking (fixing the gitignore pattern), then systematically fix the remaining ~30 alerts across source code, test files, and scripts. Dismiss the one confirmed false positive (Zustand slice pattern).

### Scope

**In Scope:**

1. Remove `tests/playwright-report/index.html` from git tracking and fix `.gitignore` to match `**/playwright-report/`
2. Fix 2 error-severity `js/log-injection` alerts in `scripts/post-deploy-check.cjs:97,99`
3. Fix `js/missing-origin-check` in `src/sw.ts:263` (validate message origin)
4. Fix 4 `js/trivial-conditional` warnings in src components
5. Dismiss `js/superfluous-trailing-arguments` on `useAppStore.ts:79` (false positive - standard Zustand slice pattern)
6. Fix `js/regex/missing-regexp-anchor` in `tests/support/merged-fixtures.ts:32`
7. Clean up ~14 `js/unused-local-variable` alerts across test files

**Out of Scope:**

- Feature changes or refactoring beyond what's needed to resolve alerts
- Alerts in `tests/e2e-archive/` (archived tests - separate cleanup concern)
- Changing the Zustand slice pattern itself

## Context for Development

### Codebase Patterns

- ESLint enforces `no-explicit-any` as error - fixes must not introduce `any`
- `verbatimModuleSyntax` enabled - use `import type` for type-only imports
- Unused parameters/variables must be prefixed with `_` (TypeScript convention in this project)
- Service worker uses `injectManifest` strategy via `vite-plugin-pwa` - `src/sw.ts` is the custom service worker
- `.gitignore` has `/playwright-report/` (root-anchored) but the committed file is at `tests/playwright-report/index.html` - pattern doesn't match subdirectories
- Components use early-return guard pattern (`if (!x) return null`) before `<AnimatePresence>` wrapping, making the inner `{x && (...)}` check redundant
- `calculateRowHeight` in MessageList accepts `includeBeginning` param but is only ever called with `false` - the param and first branch are dead code
- `getErrorMessage` in ScriptureOverview checks `error` truthiness inside a branch that already confirmed `error && typeof error === 'object'` - the outer `error` check makes inner usage trivially true

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `.gitignore` | Fix pattern to catch `**/playwright-report/` not just root-level |
| `scripts/post-deploy-check.cjs:95-101` | `logTest()` function - log-injection via `details` and `testName` interpolation |
| `src/sw.ts:263-267` | SW message handler - no origin check on incoming messages |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx:54-59` | `getErrorMessage()` - trivial conditional on `error` param |
| `src/components/love-notes/MessageList.tsx:156-171` | `calculateRowHeight()` - dead `includeBeginning` parameter |
| `src/components/PhotoUpload/PhotoUpload.tsx:148-152` | Early return + redundant `{isOpen && ...}` in AnimatePresence |
| `src/components/MoodHistory/MoodDetailModal.tsx:137-147` | Early return + redundant `{mood && ...}` in AnimatePresence |
| `tests/support/merged-fixtures.ts:32` | Regex `/sentry\.io/` used on URLs without anchoring |

### Technical Decisions

- **Log injection fix:** Replace template-literal interpolation with `console.log(format, ...args)` using `%s` substitution - this is the standard CodeQL-recommended fix for `js/log-injection` in Node.js scripts
- **Origin check:** Service workers receive messages via `postMessage()` - add guard `if (event.origin && event.origin !== self.location.origin) return` before processing. Note: SW `message` events from same-origin `navigator.serviceWorker.controller.postMessage()` may have empty origin - so allow empty origin (same-origin guarantee) while blocking cross-origin
- **Trivial conditionals - two patterns:**
  1. *Redundant AnimatePresence guard* (PhotoUpload, MoodDetailModal): Remove inner `{isOpen && ...}` / `{mood && ...}` since early return already handles null case. Keep the `<AnimatePresence>` wrapper for exit animations.
  2. *Dead code* (MessageList `includeBeginning`): Remove the parameter entirely, always use `index` directly since it's never called with `true`
  3. *Redundant truthiness* (ScriptureOverview `error`): Simplify the compound conditional - `error` is guaranteed truthy by the outer `if`
- **Regex anchoring:** Change `/sentry\.io/` to `/^https?:\/\/[^/]*sentry\.io/` to anchor against the URL host
- **False positive dismissal:** Use `gh api -X PATCH` to dismiss alert #91 with `dismissed_reason: "used in tests"` (or `false positive`)
- **Unused imports in tests:** Remove unused vitest imports (e.g., `beforeAll`, `vi`, `afterEach`) that CodeQL flagged. These are vitest destructured imports where not all are used in every test file.

## Implementation Plan

### Tasks

Tasks are ordered by dependency (infrastructure first, then security, then code quality, then test cleanup).

- [ ] Task 1: Remove committed Playwright report and fix gitignore
  - File: `.gitignore`
  - Action: Change `/playwright-report/` to `**/playwright-report/` so it matches at any depth (not just repo root)
  - File: `tests/playwright-report/index.html`
  - Action: `git rm --cached tests/playwright-report/index.html` to untrack without deleting locally
  - Notes: This single change resolves 50 of 80 alerts. The file was tracked because the gitignore pattern was root-anchored.

- [ ] Task 2: Fix log-injection vulnerabilities in post-deploy script (ERROR severity)
  - File: `scripts/post-deploy-check.cjs:95-101`
  - Action: In `logTest()`, replace template literals with `console.log` format strings:
    - Line 97: `console.log('%s✅ %s%s%s', colors.green, testName, colors.reset, details ? ': ' + details : '');`
    - Line 99: `console.log('%s⚠️  %s%s%s', colors.yellow, testName, colors.reset, details ? ': ' + details : '');`
  - Notes: CodeQL flags `details` and `testName` as user-controlled values interpolated into log output. Using `%s` substitution prevents log injection. These are the only 2 error-severity alerts.

- [ ] Task 3: Add origin check to service worker message handler (SECURITY)
  - File: `src/sw.ts:263-267`
  - Action: Add origin validation at the top of the message handler callback:
    ```typescript
    self.addEventListener('message', ((event: ExtendableMessageEvent) => {
      // Validate origin — same-origin postMessage may have empty origin
      if (event.origin && event.origin !== self.location.origin) return;

      if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
      }
    }) as EventListener);
    ```
  - Notes: SW message events from `navigator.serviceWorker.controller.postMessage()` have empty string origin when same-origin. We allow empty (trusted) and block mismatched (cross-origin).

- [ ] Task 4: Fix trivial conditional in ScriptureOverview
  - File: `src/components/scripture-reading/containers/ScriptureOverview.tsx:54-59`
  - Action: In `getErrorMessage()`, the `error` variable on line 56 is inside a branch where `error && typeof error === 'object'` is already confirmed true. Simplify:
    ```typescript
    function getErrorMessage(error: unknown): string {
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
      }
      return 'An unexpected error occurred';
    }
    ```
  - Notes: Changed from `error && typeof error === 'object' && 'message' in error` (where `error` is trivially true after `&&`) to `typeof error === 'object' && error !== null && 'message' in error` which is semantically identical but explicit about the null check that `typeof === 'object'` doesn't exclude.

- [ ] Task 5: Remove dead `includeBeginning` parameter from MessageList
  - File: `src/components/love-notes/MessageList.tsx:156-171`
  - Action:
    1. Remove `includeBeginning` parameter from `calculateRowHeight` function signature
    2. Remove the `if (includeBeginning && index === 0)` branch (lines 162-164)
    3. Remove the `const adjustedIndex = includeBeginning ? index - 1 : index;` line — use `index` directly
    4. Update the `if (!note || adjustedIndex < 0)` check to `if (!note || index < 0)`
    5. Update the call site to remove the `false` argument: `calculateRowHeight(note, adjustedIndex)` → `calculateRowHeight(note, index)`
  - Notes: `calculateRowHeight` is only called once, always with `includeBeginning: false`. The entire parameter and its branches are dead code.

- [ ] Task 6: Remove redundant AnimatePresence guard in PhotoUpload
  - File: `src/components/PhotoUpload/PhotoUpload.tsx:148-152`
  - Action: Line 148 has `if (!isOpen) return null;`. Line 152 has `{isOpen && (`. Since the early return guarantees `isOpen` is true at line 152, remove the `{isOpen && (` wrapper and its closing `)}`. Keep `<AnimatePresence>` and its children as direct return content.
  - Before:
    ```tsx
    if (!isOpen) return null;
    return (
      <AnimatePresence>
        {isOpen && (
          <>...</>
        )}
      </AnimatePresence>
    );
    ```
  - After:
    ```tsx
    if (!isOpen) return null;
    return (
      <AnimatePresence>
        <>...</>
      </AnimatePresence>
    );
    ```
  - Notes: The fragment `<>...</>` inside AnimatePresence may also be simplifiable but keep it to minimize blast radius.

- [ ] Task 7: Remove redundant AnimatePresence guard in MoodDetailModal
  - File: `src/components/MoodHistory/MoodDetailModal.tsx:137-147`
  - Action: Same pattern as Task 6. Line 137 has `if (!mood) return null;`. Line 147 has `{mood && (`. Remove the `{mood && (` wrapper and its closing `)}`.
  - Notes: Identical pattern to PhotoUpload. The early return on line 137 guarantees `mood` is truthy.

- [ ] Task 8: Anchor regex pattern in merged-fixtures
  - File: `tests/support/merged-fixtures.ts:32`
  - Action: Change `/sentry\.io/` to `/^https?:\/\/[^/]*sentry\.io/`
  - Notes: CodeQL flags unanchored regexes used on URLs because they could match unexpected substrings. Anchoring to the URL scheme + host prevents false matches.

- [ ] Task 9: Clean up unused imports in unit test files
  - Files:
    - `tests/unit/utils/offlineErrorHandler.test.ts:1` — check which vitest imports are unused and remove them
    - `tests/unit/services/moodService.test.ts:1` — check which vitest imports are unused and remove them
    - `tests/unit/services/scriptureReadingService.cache.test.ts:14` — check `beforeAll`, `afterEach`, `vi` usage
    - `tests/unit/services/scriptureReadingService.crud.test.ts:14` — check `beforeAll`, `afterEach`, `vi` usage
    - `tests/unit/services/scriptureReadingService.service.test.ts:14-17` — 3 alerts: check `beforeAll`, `afterEach`, `vi`, and imported types
    - `tests/unit/hooks/useScripturePresence.reconnect.test.ts:17` — check `mockRemoveChannel` usage
  - Action: For each file, read the full file, identify which imported names are never referenced, and remove them from the import statement. For unused mock variables (like `mockRemoveChannel`), prefix with `_` if they're part of a destructured mock setup that must stay.
  - Notes: CodeQL scans differently than ESLint — it may flag imports that ESLint misses because CodeQL does whole-file data flow analysis. Read each file fully before removing to ensure the import isn't used indirectly.

- [ ] Task 10: Clean up unused imports in E2E test files
  - Files:
    - `tests/e2e/scripture/scripture-accessibility.spec.ts:86,168` — 2 alerts: check `startFocus` (line 86) and `initialText` (line 168) variable usage
    - `tests/e2e/auth/display-name-setup.spec.ts:14` — check unused imports from merged-fixtures
  - Action: For each file, identify the unused variable/import. If a variable is assigned but never read (like `startFocus` or `initialText`), either remove it or prefix with `_` if the assignment has a needed side effect (e.g., `await page.evaluate()`).
  - Notes: `startFocus` at line 86 is assigned from `page.evaluate()` but never asserted on — it's a leftover from incomplete test logic. `initialText` at line 168 is assigned from `liveRegion.textContent()` but never compared.

- [ ] Task 11: Dismiss false-positive alert #91
  - Action: Run `gh api -X PATCH /repos/sallvainian/My-Love/code-scanning/alerts/91 -f state=dismissed -f dismissed_reason=false_positive -f dismissed_comment="Standard Zustand slice pattern: createXxxSlice(set, get, api) — the api parameter is the standard StateCreator third argument, not a superfluous trailing argument."`
  - Notes: This is the `js/superfluous-trailing-arguments` alert on `useAppStore.ts:79`. The Zustand slice pattern always passes `(set, get, api)` to slice creators.

- [ ] Task 12: Run verification checks
  - Action:
    1. `npm run typecheck` — verify no TypeScript errors
    2. `npm run lint` — verify no ESLint errors
    3. `npm run format` — ensure Prettier formatting
    4. `npm run test:unit` — verify no test regressions
  - Notes: All 4 must pass before committing. Run format last since other fixes may introduce formatting drift.

### Acceptance Criteria

- [ ] AC 1: Given `tests/playwright-report/index.html` is currently tracked in git, when `git ls-files tests/playwright-report/` is run after the fix, then no files are listed (untracked)
- [ ] AC 2: Given the `.gitignore` has been updated, when a file is created at `tests/playwright-report/foo.html`, then `git status` does not show it as untracked
- [ ] AC 3: Given `scripts/post-deploy-check.cjs` uses `console.log` with `%s` substitution, when CodeQL rescans, then alerts #18 and #19 (`js/log-injection`) are resolved
- [ ] AC 4: Given `src/sw.ts` message handler checks `event.origin`, when a cross-origin message is received, then the handler returns early without processing
- [ ] AC 5: Given `src/sw.ts` message handler checks `event.origin`, when a same-origin `postMessage('SKIP_WAITING')` is sent, then `self.skipWaiting()` is still called (empty origin is allowed)
- [ ] AC 6: Given the 4 trivial-conditional fixes are applied, when CodeQL rescans, then alerts #75, #76, #77, #78 are resolved
- [ ] AC 7: Given unused imports are removed from test files, when CodeQL rescans, then alerts #29, #41, #43, #51-57, #110, #111 are resolved
- [ ] AC 8: Given alert #91 is dismissed via API, when the alerts list is queried, then alert #91 shows `state: dismissed` with `dismissed_reason: false_positive`
- [ ] AC 9: Given all fixes are applied, when `npm run typecheck` is run, then it exits with code 0
- [ ] AC 10: Given all fixes are applied, when `npm run lint` is run, then it exits with code 0
- [ ] AC 11: Given all fixes are applied, when `npm run test:unit` is run, then all tests pass with no regressions

## Additional Context

### Dependencies

None - this is a cleanup/security task with no new dependencies.

### Testing Strategy

- **Automated verification:** `npm run typecheck`, `npm run lint`, `npm run test:unit` must all pass
- **Manual verification:** After push, check GitHub Security tab to confirm alert count drops from 80 to ~3 (only `tests/e2e-archive/` alerts remain)
- **No new tests needed:** These are code quality fixes, not feature changes. Existing tests verify no regressions.

### Notes

- Alert numbers referenced are from the GitHub API as of 2026-03-12
- 50 of 80 alerts vanish by removing the single committed `tests/playwright-report/index.html`
- 3 alerts in `tests/e2e-archive/` are out of scope (archived test files) — they can be addressed when the archive is cleaned up
- Alert #91 (`useAppStore.ts:79`) is a false positive - the `api` 3rd argument to Zustand slice creators is standard Zustand pattern, not superfluous
- Risk: CodeQL rescanning happens asynchronously after push — alerts may take a few minutes to update
- Risk: Removing `includeBeginning` from `calculateRowHeight` (Task 5) changes the function signature — verify no other callers exist (confirmed: only 1 call site)
