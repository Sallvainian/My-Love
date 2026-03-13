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
- Components use `<AnimatePresence>{condition && (<motion.div exit={...}>...</motion.div>)}</AnimatePresence>` pattern for exit animations. Some also have an early-return guard (`if (!x) return null`) above the AnimatePresence — this early return is the redundant part because it unmounts the entire tree (including AnimatePresence), preventing exit animations from firing. The inner `{x && (...)}` conditional is the correct pattern that AnimatePresence needs to detect child removal
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
| `src/components/PhotoUpload/PhotoUpload.tsx:148-152` | Redundant early return before AnimatePresence — kills exit animations. Parent: `App.tsx:613` |
| `src/components/MoodHistory/MoodDetailModal.tsx:137-147` | Redundant early return before AnimatePresence — kills exit animations. Parent: `MoodHistoryCalendar.tsx:330` |
| `tests/support/merged-fixtures.ts:32` | Regex `/sentry\.io/` used on URLs without anchoring |

### Technical Decisions

- **Log injection fix:** CodeQL recommends `String.prototype.replace` to strip newlines from interpolated values. In practice, all `logTest` callers pass hardcoded `testName` strings and `details` from HTTP status codes / `error.message` of the project's own deploy URL — low actual risk. But to satisfy CodeQL and harden the script, sanitize `details` with `.replace(/[\n\r]/g, '')` before interpolation.
- **Origin check:** `ExtendableMessageEvent` has `readonly origin: string` (verified in `lib.webworker.d.ts:4100`). Add guard `if (event.origin && event.origin !== self.location.origin) return` before processing. SW `message` events from same-origin `navigator.serviceWorker.controller.postMessage()` have empty string origin — allow empty (same-origin guarantee) while blocking non-empty cross-origin.
- **Trivial conditionals — three distinct patterns:**
  1. *Redundant early return before AnimatePresence* (PhotoUpload, MoodDetailModal): The `if (!x) return null` early return unmounts the entire component tree including `<AnimatePresence>`, which prevents exit animations from firing. The inner `{x && (...)}` conditional is the correct AnimatePresence pattern — it lets AnimatePresence stay mounted and observe its children appearing/disappearing. **Fix: Remove the early return, keep the inner conditional.**
  2. *Dead code* (MessageList `includeBeginning`): Remove the parameter entirely. The `getRowHeight` useCallback wrapper at line 278-289 already handles the beginning-of-conversation case via `showBeginning` and passes `adjustedIndex` to `calculateRowHeight`. The function just needs `(note, index)`.
  3. *Redundant null guard clarity* (ScriptureOverview `error`): `error &&` on line 56 is actually a necessary null guard (`typeof null === 'object'` is `true`), NOT a redundant check. CodeQL's "always evaluates to true" assessment appears incorrect. However, replacing `error && typeof error === 'object'` with `typeof error === 'object' && error !== null` is semantically equivalent and makes the null guard explicit, satisfying CodeQL. This is a clarity improvement, not a bug fix.
- **Regex anchoring:** The `excludePatterns` array in merged-fixtures has 6 patterns, 5 of which are unanchored. CodeQL only flagged `/sentry\.io/` because it looks like a hostname. The broad match is intentional — it filters Sentry network traffic from E2E error monitoring. Use minimal anchoring `/[\w.]sentry\.io/` to indicate hostname context without being so restrictive it misses Sentry URL formats. Overly restrictive anchoring (full `^https?://...`) risks breaking E2E test filtering.
- **False positive dismissal:** Use `gh api -X PATCH` to dismiss alert #91 with `-f dismissed_reason="false positive"` (with a space — the API rejects `false_positive`; valid values are `"false positive"`, `"won't fix"`, `"used in tests"`).
- **Unused imports in tests:** Remove exact unused imports per CodeQL analysis: `beforeEach` in offlineErrorHandler.test.ts, `vi` in moodService.test.ts, `afterEach` in cache.test.ts, `beforeAll` in crud.test.ts, `DB_VERSION`+`upgradeDb`+`openDB`+`afterEach`+`beforeAll` in service.test.ts, `mockSend` (prefix with `_`) in reconnect.test.ts, `startFocus` (prefix with `_`) and `initialText` (prefix with `_`) in scripture-accessibility.spec.ts, `expect` (remove) in display-name-setup.spec.ts.

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
  - Action: In `logTest()`, sanitize `details` by stripping newlines before interpolation. `testName` is always a hardcoded string literal at every call site so it's safe, but sanitize `details` which comes from HTTP responses (`error.message`, `response.statusCode`, `manifest.theme_color`):
    ```javascript
    function logTest(testName, passed, details = '') {
      const safeDetails = String(details).replace(/[\n\r]/g, '');
      if (passed) {
        console.log(`${colors.green}✅ ${testName}${colors.reset}${safeDetails ? `: ${safeDetails}` : ''}`);
      } else {
        console.log(`${colors.yellow}⚠️  ${testName}${colors.reset}${safeDetails ? `: ${safeDetails}` : ''}`);
      }
    }
    ```
  - Notes: CodeQL's `js/log-injection` rule recommends `String.prototype.replace` to strip newlines. `%s` substitution does NOT sanitize (verified: newlines and ANSI codes pass through). In practice, risk is low (CI script fetching own deploy URL), but the sanitization is correct and cheap.

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
  - Action: In `getErrorMessage()`, replace `error && typeof error === 'object'` with `typeof error === 'object' && error !== null`:
    ```typescript
    function getErrorMessage(error: unknown): string {
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message: unknown }).message);
      }
      return 'An unexpected error occurred';
    }
    ```
  - Notes: The `error &&` is actually a necessary null guard (`typeof null === 'object'` returns `true`), NOT a redundant check — CodeQL's "always evaluates to true" analysis appears incorrect. However, the replacement `typeof error === 'object' && error !== null` is semantically identical and makes the null guard explicit, satisfying CodeQL. This is a clarity improvement, not a bug fix.

- [ ] Task 5: Remove dead `includeBeginning` parameter from MessageList
  - File: `src/components/love-notes/MessageList.tsx`
  - Context: `calculateRowHeight` (lines 156-171) accepts `(note, includeBeginning, index)` but is only called once at line 286: `calculateRowHeight(note, false, adjustedIndex)`. The `getRowHeight` useCallback wrapper (lines 278-289) already handles the beginning-of-conversation case via its own `showBeginning` check and passes `adjustedIndex` to `calculateRowHeight`.
  - Action:
    1. Change `calculateRowHeight` signature from `(note: LoveNote | null, includeBeginning: boolean, index: number)` to `(note: LoveNote | null, index: number)`
    2. Remove the `if (includeBeginning && index === 0) { return 120; }` branch (lines 162-164)
    3. Remove the `const adjustedIndex = includeBeginning ? index - 1 : index;` line (line 167) — use `index` directly
    4. Change `if (!note || adjustedIndex < 0)` to `if (!note || index < 0)` (line 169)
    5. Update the call site at line 286 from `calculateRowHeight(note, false, adjustedIndex)` to `calculateRowHeight(note, adjustedIndex)`
  - Notes: The `adjustedIndex` variable at the call site (line 284) is computed by the `getRowHeight` callback, not by `calculateRowHeight` — it stays. Only the `false` argument is removed. The callback's `showBeginning` logic (lines 280-284) continues to handle the beginning-of-conversation case independently.

- [ ] Task 6: Remove redundant early return in PhotoUpload
  - File: `src/components/PhotoUpload/PhotoUpload.tsx:148`
  - Action: Remove the `if (!isOpen) return null;` early return on line 148. Keep the `{isOpen && (...)}` conditional inside `<AnimatePresence>` — that's the correct pattern.
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
    return (
      <AnimatePresence>
        {isOpen && (
          <>...</>
        )}
      </AnimatePresence>
    );
    ```
  - Notes: The early return unmounts the entire tree including `<AnimatePresence>`, which prevents exit animations on the `motion.div` children (opacity fade, scale). `AnimatePresence` needs to stay mounted and observe its children appearing/disappearing via the `{isOpen && (...)}` conditional. Parent is `App.tsx:613`: `<PhotoUpload isOpen={isPhotoUploadOpen} onClose={...} />`. Verify that the component body above line 148 has no side effects that should be guarded (hooks must not be called conditionally, so removing the early return is safe — hooks are already above it).

- [ ] Task 7: Remove redundant early return in MoodDetailModal
  - File: `src/components/MoodHistory/MoodDetailModal.tsx:137`
  - Action: Remove the `if (!mood) return null;` early return on line 137. Keep the `{mood && (...)}` conditional inside `<AnimatePresence>`.
  - Before:
    ```tsx
    if (!mood) return null;

    const moodConfig = MOOD_CONFIG[mood.mood as MoodType];
    // ... more code using mood ...

    return (
      <AnimatePresence>
        {mood && (
          <>...</>
        )}
      </AnimatePresence>
    );
    ```
  - After: Move the code that uses `mood` (lines 139-143: `moodConfig`, `Icon`, `moodDate`, `formattedDate`, `formattedTime`) inside the `{mood && (...)}` conditional, since `mood` can now be null when the component renders:
    ```tsx
    return (
      <AnimatePresence>
        {mood && (() => {
          const moodConfig = MOOD_CONFIG[mood.mood as MoodType];
          const Icon = moodConfig.icon;
          const moodDate = new Date(mood.timestamp);
          const formattedDate = formatModalDate(moodDate);
          const formattedTime = formatModalTime(moodDate);
          return (
            <>...</>
          );
        })()}
      </AnimatePresence>
    );
    ```
    **Alternatively** (simpler): Keep the early return but wrap it so AnimatePresence still renders:
    ```tsx
    const moodConfig = mood ? MOOD_CONFIG[mood.mood as MoodType] : null;
    const Icon = moodConfig?.icon;
    const moodDate = mood ? new Date(mood.timestamp) : null;
    const formattedDate = moodDate ? formatModalDate(moodDate) : '';
    const formattedTime = moodDate ? formatModalTime(moodDate) : '';

    return (
      <AnimatePresence>
        {mood && (
          <>...</>
        )}
      </AnimatePresence>
    );
    ```
  - Notes: Unlike PhotoUpload (where the early return is the only code before the JSX), MoodDetailModal has a `useEffect` for keyboard handling (lines 95-135) and derived values (lines 139-143) between hooks and the return. The `useEffect` depends on `mood` in its dependency array, so it's safe with `mood: null`. But the derived values (`moodConfig`, `Icon`, etc.) would throw on null access without the guard. The dev agent must handle this — either move the derivations inside the conditional or make them null-safe. Parent is `MoodHistoryCalendar.tsx:330`: `<MoodDetailModal mood={selectedMood} onClose={handleCloseModal} />`.

- [ ] Task 8: Anchor regex pattern in merged-fixtures
  - File: `tests/support/merged-fixtures.ts:32`
  - Action: Change `/sentry\.io/` to `/[\w.]sentry\.io/`
  - Notes: CodeQL flags unanchored regexes that look like hostnames because they could match unexpected URL substrings. The `excludePatterns` array (lines 31-37) has 6 patterns — 5 are unanchored (`/analytics/`, `/\/auth\/v1\/token/`, etc.). CodeQL only flagged `sentry.io` because it resembles a hostname. The broad match is intentional — it filters all Sentry network traffic from E2E error monitoring. Using `/[\w.]sentry\.io/` adds minimal anchoring to indicate hostname context (requires a word char or dot before `sentry`) without being so restrictive it misses Sentry URL formats like `https://o123.ingest.sentry.io/...`. Do NOT use `^https?://` anchoring — that's overly restrictive and inconsistent with the other 5 patterns in the array. After this change, run E2E tests (at minimum `npm run test:p0`) to verify Sentry traffic is still filtered.

- [ ] Task 9: Clean up unused imports in unit test files
  - Action: Remove the exact unused imports identified by CodeQL:
    - `tests/unit/utils/offlineErrorHandler.test.ts:1` — remove `beforeEach` from vitest import (alert #111)
    - `tests/unit/services/moodService.test.ts:1` — remove `vi` from vitest import (alert #110)
    - `tests/unit/services/scriptureReadingService.cache.test.ts:14` — remove `afterEach` from vitest import (alert #57)
    - `tests/unit/services/scriptureReadingService.crud.test.ts:14` — remove `beforeAll` from vitest import (alert #56)
    - `tests/unit/services/scriptureReadingService.service.test.ts:14-17` — remove `beforeAll` and `afterEach` from vitest import (alert #53), remove `openDB` from idb import (alert #54), remove `DB_VERSION` and `upgradeDb` from service import (alert #55)
    - `tests/unit/hooks/useScripturePresence.reconnect.test.ts:17` — prefix `mockSend` with `_` in the `vi.hoisted()` destructure (alert #52). It's part of the mock setup block that must stay together — renaming to `_mockSend` satisfies CodeQL without breaking the mock factory.

- [ ] Task 10: Clean up unused variables in E2E test files
  - Action:
    - `tests/e2e/scripture/scripture-accessibility.spec.ts:86` — rename `const startFocus` to `const _startFocus` (alert #41). This is assigned from `await page.evaluate(() => document.activeElement?.tagName)` — the assignment has no needed side effect (it's a pure read), but it documents the test's intent to capture initial focus state. The test asserts on `afterShiftTab` instead, making `startFocus` an incomplete assertion. Prefix with `_` to preserve the intent while satisfying CodeQL.
    - `tests/e2e/scripture/scripture-accessibility.spec.ts:168` — rename `const initialText` to `const _initialText` (alert #43). Assigned from `await liveRegion.textContent()`. The test later asserts `afterViewResponse` against `/verse 2/i` (line 181) rather than comparing to `initialText`. The variable documents that the test intended to compare before/after text but the assertion was written differently. Prefix with `_`.
    - `tests/e2e/auth/display-name-setup.spec.ts:14` — remove `expect` from the import: change `import { test, expect }` to `import { test }` (alert #29). Both tests in this file are `test.skip()` stubs that never use `expect`.

- [ ] Task 11: Dismiss false-positive alert #91
  - Action: Run `gh api -X PATCH /repos/sallvainian/My-Love/code-scanning/alerts/91 -f state=dismissed -f 'dismissed_reason=false positive' -f dismissed_comment="Standard Zustand slice pattern: createXxxSlice(set, get, api) — the api parameter is the standard StateCreator third argument, not a superfluous trailing argument."`
  - Notes: This is the `js/superfluous-trailing-arguments` alert on `useAppStore.ts:79`. The Zustand slice pattern always passes `(set, get, api)` to slice creators. IMPORTANT: The API requires `"false positive"` with a space — `false_positive` returns HTTP 422. Valid values are: `"false positive"`, `"won't fix"`, `"used in tests"`.

- [ ] Task 12: Run verification checks
  - Action:
    1. `npm run typecheck` — verify no TypeScript errors
    2. `npm run format` — ensure Prettier formatting
    3. `npm run lint` — verify no ESLint errors
    4. `npm run test:unit` — verify no unit test regressions
    5. `npm run test:p0` — verify P0 E2E tests pass (requires `supabase start`). This validates that the regex change in Task 8 (`merged-fixtures.ts`) doesn't break network error monitoring.
  - Notes: Steps 1-4 must pass before committing. Step 5 should run if local Supabase is available — if not, note it as a manual verification step post-merge.

### Acceptance Criteria

- [ ] AC 1: Given `tests/playwright-report/index.html` is currently tracked in git, when `git ls-files tests/playwright-report/` is run after the fix, then no files are listed (untracked)
- [ ] AC 2: Given the `.gitignore` has been updated, when a file is created at `tests/playwright-report/foo.html`, then `git status` does not show it as untracked
- [ ] AC 3: Given `scripts/post-deploy-check.cjs` uses `console.log` with `%s` substitution, when CodeQL rescans, then alerts #18 and #19 (`js/log-injection`) are resolved
- [ ] AC 4: Given `src/sw.ts` message handler checks `event.origin`, when a cross-origin message is received, then the handler returns early without processing
- [ ] AC 5: Given `src/sw.ts` message handler checks `event.origin`, when a same-origin `postMessage('SKIP_WAITING')` is sent, then `self.skipWaiting()` is still called (empty origin is allowed)
- [ ] AC 6: Given the 4 trivial-conditional fixes are applied, when CodeQL rescans, then alerts #75, #76, #77, #78 are resolved
- [ ] AC 7: Given unused imports are removed from test files, when CodeQL rescans, then alerts #29, #41, #43, #51-57, #110, #111 are resolved
- [ ] AC 8: Given alert #91 is dismissed via API, when the alerts list is queried, then alert #91 shows `state: dismissed` with `dismissed_reason: "false positive"` (with space)
- [ ] AC 9: Given all fixes are applied, when `npm run typecheck` is run, then it exits with code 0
- [ ] AC 10: Given all fixes are applied, when `npm run lint` is run, then it exits with code 0
- [ ] AC 11: Given all fixes are applied, when `npm run test:unit` is run, then all tests pass with no regressions
- [ ] AC 12: Given the regex change in `merged-fixtures.ts`, when `npm run test:p0` is run with local Supabase, then P0 E2E tests pass and Sentry network requests are still filtered from error monitoring

## Additional Context

### Dependencies

None - this is a cleanup/security task with no new dependencies.

### Testing Strategy

- **Automated verification:** `npm run typecheck`, `npm run format`, `npm run lint`, `npm run test:unit` must all pass
- **E2E verification:** `npm run test:p0` should pass (requires `supabase start`) to validate Task 8 regex change doesn't break network error monitoring in `merged-fixtures.ts`
- **Manual verification:** After push, check GitHub Security tab to confirm alert count drops from 80 to ~3 (only `tests/e2e-archive/` alerts remain)
- **No new tests needed:** These are code quality fixes, not feature changes. Existing tests verify no regressions.

### Notes

- Alert numbers referenced are from the GitHub API as of 2026-03-12
- 50 of 80 alerts vanish by removing the single committed `tests/playwright-report/index.html`
- 3 alerts in `tests/e2e-archive/` are out of scope (archived test files) — they can be addressed when the archive is cleaned up
- Alert #91 (`useAppStore.ts:79`) is a false positive - the `api` 3rd argument to Zustand slice creators is standard Zustand pattern, not superfluous
- Risk: CodeQL rescanning happens asynchronously after push — alerts may take a few minutes to update
- Risk: Removing `includeBeginning` from `calculateRowHeight` (Task 5) changes the function signature — verify no other callers exist (confirmed: only 1 call site)
