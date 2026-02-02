# Tasks / Subtasks

- [x] Task 1: Enhance ScriptureOverview with "Start" entry point and session resume (AC: #2, #3, #6)
  - [x] 1.1 Add a prominent "Start" button to the overview page that triggers mode selection display
  - [x] 1.2 Implement mode selection show/hide state (modes not visible until Start is tapped)
  - [x] 1.3 Integrate with `scriptureReadingSlice` to check for existing incomplete solo session on mount
  - [x] 1.4 Add resume prompt UI: "Continue where you left off? (Step X of 17)" with "Continue" and "Start fresh" actions
  - [x] 1.5 Wire "Continue" to call `loadSession(sessionId)` on the slice
  - [x] 1.6 Wire "Start fresh" to clear saved state (exit old session, allow new session start)
- [x] Task 2: Enhance Lavender Dreams visual theme (AC: #2)
  - [x] 2.1 Apply glass morphism cards to mode selection cards (semi-transparent backgrounds, `backdrop-blur-sm`, subtle borders)
  - [x] 2.2 Add purple gradient backgrounds where appropriate (header area, section separators)
  - [x] 2.3 Use `Playfair Display` for the main "Scripture Reading" heading (per PRD typography spec)
  - [x] 2.4 Ensure existing `scriptureTheme` tokens are applied consistently
- [x] Task 3: Wire mode selection to session creation (AC: #3, #4, #5)
  - [x] 3.1 Replace `console.log` in `handleStartSolo` with `createSession('solo')` from scriptureReadingSlice
  - [x] 3.2 Replace `console.log` in `handleStartTogether` with `createSession('together', partnerId)` from scriptureReadingSlice
  - [x] 3.3 After session creation, the user stays on scripture view (Story 1.3 will handle reading flow navigation)
  - [x] 3.4 Show loading state during session creation (`isLoading` from slice)
  - [x] 3.5 Handle session creation errors with user-visible feedback
- [x] Task 4: Verify navigation integration (AC: #1)
  - [x] 4.1 Confirm `'scripture'` in ViewType and BottomNavigation tab renders correctly (already done in Story 1.1)
  - [x] 4.2 Confirm `setView('scripture')` navigates correctly and URL updates to `/scripture`
  - [x] 4.3 Confirm lazy loading via `App.tsx` Suspense boundary works for ScriptureOverview
  - [x] 4.4 Confirm browser back button navigation works (popstate handler in App.tsx)
- [x] Task 5: Write/update unit tests (AC: all)
  - [x] 5.1 Update existing `ScriptureOverview.test.tsx` tests for new Start button → mode selection flow
  - [x] 5.2 Add tests for resume prompt rendering when incomplete session exists
  - [x] 5.3 Add tests for "Continue" action calling `loadSession`
  - [x] 5.4 Add tests for "Start fresh" action clearing session
  - [x] 5.5 Add tests for session creation via mode cards (Solo and Together)
  - [x] 5.6 Add tests for loading state during session creation
  - [x] 5.7 Add tests for error state display on session creation failure

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Update File List to document all 8 changed files (6 undocumented: scriptureSteps.ts, dbSchema.ts, scriptureReadingService.ts, scriptureReadingSlice.ts, and their test files) [story file: Dev Agent Record → File List]
- [x] [AI-Review][HIGH] H2: Move `supabase.auth.getUser()` + `getUserSessions()` call out of component — use Zustand slice action or lift session detection to the slice so the component only reads store state [ScriptureOverview.tsx:24,194]
- [x] [AI-Review][HIGH] H3: Replace empty catch block in session detection with `handleScriptureError()` or at minimum `console.warn()` — silent error swallowing violates project error handling mandate [ScriptureOverview.tsx:210-211]
- [x] [AI-Review][MEDIUM] M1: Fix `act(...)` warnings in tests — wrap renders with async state updates in `act()` or add `waitFor` to "Error State Display" and "Accessibility" test blocks [ScriptureOverview.test.tsx]
- [x] [AI-Review][MEDIUM] M2: `partnerStatus === 'error'` is unreachable dead code — no state path produces it. Either remove the `error` case or add error detection for partner loading failures [ScriptureOverview.tsx:224-230,283]
- [x] [AI-Review][MEDIUM] M3: Add test coverage for session check failure scenarios (getUser fails, getUserSessions throws) to verify graceful degradation [ScriptureOverview.test.tsx]
- [x] [AI-Review][MEDIUM] M4: "Start fresh" only clears local state — server-side session remains `in_progress` and resume prompt will re-appear on next visit. Either update server status or document this as intentional [ScriptureOverview.tsx:254-258, scriptureReadingSlice.ts:136-138]
- [x] [AI-Review][LOW] L1: Clarify test count discrepancy — Story 1.1 claims 45 tests, Story 1.2 has 40. What happened to the 5 removed tests? [story file: Dev Notes]
- [x] [AI-Review][LOW] L3: Extract animation duration 0.2 into named constant or scriptureTheme token [ScriptureOverview.tsx:264]
