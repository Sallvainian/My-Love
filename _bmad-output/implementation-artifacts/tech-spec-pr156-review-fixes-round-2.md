---
title: 'PR #156 Review Fixes — Round 2'
type: 'bugfix'
created: '2026-03-15'
status: 'done'
baseline_commit: '55aa718'
context: ['_bmad-output/project-context.md']
---

# PR #156 Review Fixes — Round 2

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR #156 still has open review findings after the first round of fixes: broadcast auth failure leaves stale "connected" UI state, bookmark debounce captures stale session references, the report phase has three error-handling gaps (reflection→report transition, dual initialization, silent message loss), CI setup-supabase doesn't explicitly apply migrations, and three docs files claim 80% coverage threshold when the actual config enforces 25%.

**Approach:** Apply 7 targeted fixes across 4 source/CI files and 3 doc files. No architectural changes.

## Boundaries & Constraints

**Always:** Preserve existing test behavior. Run typecheck + lint + format after changes.

**Ask First:** If any fix requires adding new user-visible UI elements (e.g., toast for message failure).

**Never:** Refactor surrounding code. Change error handling patterns in unrelated files. Touch files not listed in the code map.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Broadcast auth fails | `setAuth()` throws in useScriptureBroadcast | UI shows disconnected state | `isPartnerConnected` reset to false |
| Bookmark toggle during session change | Session changes within 300ms debounce window | Debounced write uses captured session values | Stale closure prevented by capturing IDs before timeout |
| Reflection saved, phase update fails | `addReflection` succeeds, `updateSession` throws | User sees specific error, not stuck in reflection | Separate try/catch for phase update with distinct message |
| Message write fails | `addMessage` throws during report send | Session completes, user warned message wasn't sent | `logger.info` logs failure; `completionError` state set if message lost |

</frozen-after-approval>

## Code Map

- `src/hooks/useScriptureBroadcast.ts` -- Realtime broadcast hook (auth failure catch block, lines 235-242)
- `src/components/scripture-reading/hooks/useSessionPersistence.ts` -- Bookmark debounce (lines 103-131)
- `src/components/scripture-reading/hooks/useReportPhase.ts` -- Report phase hook (reflection submit, message send, sub-phase init)
- `.github/actions/setup-supabase/action.yml` -- Supabase CI setup (missing explicit migration step)
- `docs/project-overview/development.md` -- Coverage threshold claim (line 51)
- `docs/architecture/16-testing-architecture.md` -- Coverage threshold claim (line 20)
- `docs/project-overview/repository-structure.md` -- Coverage threshold claim (line 238)

## Tasks & Acceptance

**Execution:**
- [ ] `src/hooks/useScriptureBroadcast.ts` -- In the `.catch()` block (line 235), after `handleScriptureError()`, add store reset for `isPartnerConnected: false` -- matches the `CHANNEL_ERROR` handler pattern that already resets connection state on failure
- [ ] `src/components/scripture-reading/hooks/useSessionPersistence.ts` -- In `handleBookmarkToggle`, capture `session.id` and `session.userId` as local `const` variables before the `setTimeout` call (alongside the existing `stepIndex` capture), then use those locals inside the timeout body -- prevents stale closure if session changes within 300ms window
- [ ] `src/components/scripture-reading/hooks/useReportPhase.ts` (reflection submit) -- Wrap the `updateSession` call (lines 116-118) in its own try/catch with a distinct error message ("Reflection saved but failed to advance phase") so the user knows their data is safe even if the phase transition fails
- [ ] `src/components/scripture-reading/hooks/useReportPhase.ts` (dual init) -- Remove inline computation from `useState` initializer (lines 53-58), initialize to `'compose'`, let the existing effect be the single source of truth for sub-phase transitions
- [ ] `src/components/scripture-reading/hooks/useReportPhase.ts` (message loss) -- In `handleMessageSend`, log message write failure with `logger.info` and set a flag so the completion screen can indicate the message wasn't delivered
- [ ] `.github/actions/setup-supabase/action.yml` -- Add `supabase db reset` step after `supabase start` to explicitly apply migrations in CI -- ensures deterministic schema state
- [ ] `docs/project-overview/development.md`, `docs/architecture/16-testing-architecture.md`, `docs/project-overview/repository-structure.md` -- Change coverage threshold from "80%" to "25%" to match actual `vitest.config.ts` thresholds

**Acceptance Criteria:**
- Given broadcast auth fails, when the catch block runs, then store `isPartnerConnected` is false
- Given bookmark toggle fires during session change, when the 300ms debounce expires, then the write uses the session ID captured at toggle time
- Given reflection saves but phase update fails, when the user sees the error, then the message distinguishes "reflection saved" from "reflection failed"
- Given reportSubPhase initializes, when the component mounts, then the effect (not the initializer) determines the sub-phase
- Given message write fails, when the session completes, then the user is informed their message wasn't sent

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run format:check` -- expected: all files formatted
- `npx vitest run --silent` -- expected: all unit tests pass
