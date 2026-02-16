# Tasks / Subtasks

- [x] Task 1: Create ReflectionSummary presentational component (AC: #1, #2)
  - [x] 1.1 Create `ReflectionSummary.tsx` in `src/components/scripture-reading/reflection/`
  - [x] 1.2 Accept props: `bookmarkedVerses` (array of `{stepIndex, verseReference, verseText}`), `onSubmit` callback, `disabled` flag
  - [x] 1.3 Render bookmarked verse chips using MoodButton-style pattern (rounded pill, `aria-pressed`, 48x48px min touch target)
  - [x] 1.4 If no bookmarks exist, display: "You didn't mark any verses — that's okay"
  - [x] 1.5 Standout verse selection: multi-select from bookmarked list only (at least one required)
  - [x] 1.6 Session-level rating scale: reuse same 1-5 numbered circle pattern from `PerStepReflection` (radiogroup, `aria-label`, end labels "A little" / "A lot")
  - [x] 1.7 Optional note textarea: max 200 chars, auto-grow, `resize-none`, char counter at 150+, placeholder "Reflect on the session as a whole (optional)"
  - [x] 1.8 Continue button: `aria-disabled` until both standout verse(s) and rating selected
  - [x] 1.9 Quiet validation: "Please select a standout verse" and/or "Please select a rating" as helper text on Continue tap

- [x] Task 2: Integrate ReflectionSummary into SoloReadingFlow completion screen (AC: #1, #3)
  - [x] 2.1 Replace the completion screen placeholder ("Reflection summary coming in Story 2.2") with `ReflectionSummary` component
  - [x] 2.2 Load bookmarks for current session via `scriptureReadingService.getBookmarksBySession()` (already loaded in `bookmarkedSteps` state)
  - [x] 2.3 Map `bookmarkedSteps` Set to array of `{stepIndex, verseReference, verseText}` using `SCRIPTURE_STEPS` data
  - [x] 2.4 Fade-through-white transition (400ms) when entering reflection summary, using existing `crossfade` from `useMotionConfig`
  - [x] 2.5 Focus management: move focus to reflection summary heading on transition
  - [x] 2.6 Screen reader announcement: `aria-live="polite"` — "Review your session reflections"
  - [x] 2.7 On submit: save session-level reflection data, then advance phase to 'report'

- [x] Task 3: Wire service layer for session-level reflection persistence (AC: #3)
  - [x] 3.1 Save session-level reflection as a `ScriptureReflection` with `stepIndex: MAX_STEPS` (17) sentinel value (distinguishes session-level from per-step 0-16 reflections; must be >= 0 to pass Zod `min(0)` validation)
  - [x] 3.2 Store standout verse selections in the reflection `notes` field as JSON: `{"standoutVerses": [0, 5, 12], "userNote": "..."}`
  - [x] 3.3 Use existing `scriptureReadingService.addReflection()` with `stepIndex: MAX_STEPS`, session rating, JSON notes, `isShared: false`
  - [x] 3.4 Write is non-blocking (same pattern as per-step reflections — don't block phase advancement)
  - [x] 3.5 After reflection saved, update session phase from `'reflection'` to `'report'` via `updatePhase('report')` slice action

- [x] Task 4: Update session phase transition logic (AC: #1, #3)
  - [x] 4.1 In `advanceStep()` (scriptureReadingSlice): when step 17 reflection completes, set `currentPhase: 'reflection'` but keep `status: 'in_progress'` (NOT 'complete' — that happens after the report phase in Story 2.3)
  - [x] 4.2 The completion screen `isCompleted` check must now trigger on `currentPhase === 'reflection'` (already does — see line 341 of SoloReadingFlow)
  - [x] 4.3 Add new phase check: when `currentPhase === 'report'`, render Story 2.3 placeholder ("Daily Prayer Report coming in Story 2.3" + "Return to Overview" button)
  - [x] 4.4 Persist phase change to server via `scriptureReadingService.updateSession()` after user submits reflection summary

- [x] Task 5: Write unit tests for ReflectionSummary (AC: #1, #2, #3)
  - [x] 5.1 Create `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx`
  - [x] 5.2 Test: renders bookmarked verses as selectable chips
  - [x] 5.3 Test: displays "You didn't mark any verses — that's okay" when no bookmarks
  - [x] 5.4 Test: verse chips toggle `aria-pressed` on click
  - [x] 5.5 Test: session rating scale renders 5 buttons with correct ARIA attributes
  - [x] 5.6 Test: Continue disabled until verse selected AND rating selected
  - [x] 5.7 Test: validation messages appear on Continue tap without required selections
  - [x] 5.8 Test: character counter visible at 150+ chars
  - [x] 5.9 Test: onSubmit called with correct data (standoutVerses array, rating, notes)
  - [x] 5.10 Test: keyboard navigation within rating radiogroup (arrow keys)

- [x] Task 6: Update SoloReadingFlow integration tests (AC: #1, #3)
  - [x] 6.1 Update `SoloReadingFlow.test.tsx` — completion flow now shows ReflectionSummary instead of placeholder
  - [x] 6.2 Test: after step 17 reflection submit, ReflectionSummary screen appears
  - [x] 6.3 Test: bookmarked verses from reading session appear as chips
  - [x] 6.4 Test: submitting reflection summary advances phase to 'report'
