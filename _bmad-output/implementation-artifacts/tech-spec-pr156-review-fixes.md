---
title: 'PR #156 Review Fixes'
type: 'bugfix'
created: '2026-03-15'
status: 'done'
baseline_commit: 'e915155'
context: ['_bmad-output/project-context.md']
---

# PR #156 Review Fixes

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR #156 introduced regressions and inconsistencies: Countdown polls at 100ms without a state-change guard (unnecessary re-renders), useSessionPersistence lacks unmount safety on its async bookmark-loading effect, mood sync failures are silently swallowed in prod, exit dialog has duplicated text, and the dialog is missing aria-modal. Three additional consistency items: stale docs, a missing explanatory comment, and logger ambiguity.

**Approach:** Apply 8 targeted fixes across 6 source files and 1 doc file. No architectural changes.

## Boundaries & Constraints

**Always:** Preserve existing test behavior. Run typecheck + lint + format after changes.

**Ask First:** If any fix requires changing test assertions or public API signatures.

**Never:** Refactor surrounding code. Change logger.debug/info semantics beyond what's specified. Touch files not listed in the code map.

</frozen-after-approval>

## Code Map

- `src/components/scripture-reading/session/Countdown.tsx` -- Countdown timer component (issue #1)
- `src/components/scripture-reading/hooks/useSessionPersistence.ts` -- Bookmark persistence hook (issue #2)
- `src/api/moodSyncService.ts` -- Mood sync batch processor (issue #3)
- `src/components/scripture-reading/containers/ReadingPhaseView.tsx` -- Exit dialog (issues #4, #5)
- `docs/state-management/photos-slice.md` -- Photos slice documentation (issue #6)
- `src/hooks/useScriptureBroadcast.ts` -- Realtime broadcast hook (issue #7)
- `src/utils/logger.ts` -- Logger utility (issue #8)

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/scripture-reading/session/Countdown.tsx` -- Restore `setDigit((prev) => (prev !== current ? current : prev))` guard at line 57 and revert interval from 100ms to 250ms -- prevents unnecessary re-renders on every poll tick
- [ ] `src/components/scripture-reading/hooks/useSessionPersistence.ts` -- Add `let isActive = true` + cleanup `return () => { isActive = false }` to the bookmark-loading effect (lines 68-75), guard the `setBookmarkedSteps` call with `if (isActive)` -- unmount safety per project convention
- [ ] `src/api/moodSyncService.ts` -- Change `logger.debug` at line 241 to `logger.info` -- per-mood sync failures should be visible in prod (outer catch at 254 already uses console.error; also change that to `logger.info` for consistency)
- [ ] `src/components/scripture-reading/containers/ReadingPhaseView.tsx` -- Change dialog description (line 381) from "Save your progress? You can continue later." to "You can continue where you left off." -- removes duplicate of title text
- [ ] `src/components/scripture-reading/containers/ReadingPhaseView.tsx` -- Add `aria-modal="true"` to the exit dialog div (line 372) -- matches ReadingContainer's equivalent dialog
- [ ] `docs/state-management/photos-slice.md` -- Update cross-slice dependencies section to document AuthSlice dependency (reads `get().userId`)
- [ ] `src/hooks/useScriptureBroadcast.ts` -- Add comment above `supabase.auth.getUser()` call (line 156) explaining why direct auth call is needed instead of `get().userId` (Realtime setAuth handshake requires fresh token)
- [ ] `src/utils/logger.ts` -- Remove `logger.log`, keep only `logger.debug` (dev-only) and `logger.info` (always logs). Update any callers of `logger.log` to `logger.info`.

**Acceptance Criteria:**
- Given Countdown is running, when the digit hasn't changed between polls, then `setDigit` is not called (no re-render)
- Given useSessionPersistence unmounts during bookmark fetch, when the fetch resolves, then state is not updated
- Given a mood sync failure in production, when the error is caught, then it appears in logger.info output
- Given the exit dialog is displayed, when the user reads it, then the title text is not repeated in the description
- Given the exit dialog is rendered, when inspected in accessibility tools, then aria-modal="true" is present
- Given logger.ts is imported, when calling logger methods, then only `.debug()` and `.info()` are available

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run format:check` -- expected: all files formatted
- `npx vitest run --silent` -- expected: all unit tests pass
