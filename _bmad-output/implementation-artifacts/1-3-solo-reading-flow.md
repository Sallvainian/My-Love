# Story 1.3: Solo Reading Flow

Status: in-progress

## Story

As a user,
I want to read through all 17 scripture steps at my own pace with verse and response screens,
So that I can engage with scripture in a calm, self-paced experience.

## Acceptance Criteria

1. **Session Start**: Given the user selects Solo mode and starts a session, When the session begins, Then a new scripture_session is created with mode=solo, status=in_progress, current_step_index=0 and the first verse screen loads.

2. **Verse Screen**: Given the user is on a verse screen, When the screen renders, Then the verse reference is displayed, the verse text is displayed prominently (Playfair Display), a View Response secondary button and Next Verse primary button are available, and the progress indicator shows "Verse X of 17".

3. **Response Screen**: Given the user taps View Response, When the response screen loads, Then the response prayer text is displayed, Back to Verse and Next Verse buttons are available, and transition uses crossfade animation (200ms, instant if reduced-motion).

4. **Step Advancement**: Given the user taps Next Verse, When advancing to the next step, Then current_step_index increments, the next verse screen loads with slide animation, and the progress indicator updates.

5. **Session Completion**: Given the user reaches step 17 and taps Next Verse, When advancing past the last step, Then the session phase transitions to reflection and a completion screen is shown (placeholder for Epic 2).

6. **Exit with Save**: Given the user is on any reading screen, When they tap the exit button, Then a confirmation prompt appears with Save & Exit that saves current_step_index to server and returns to overview.

## Tasks / Subtasks

- [x] Task 1: Add advanceStep and saveAndExit actions to scriptureReadingSlice
  - [x] 1.1 Add advanceStep() action - increments step, handles last-step transition to reflection
  - [x] 1.2 Add saveAndExit() action - persists to server, clears session
  - [x] 1.3 Use get() for reading current state before mutations
  - [x] 1.4 Persist step changes to server via scriptureReadingService.updateSession()
  - [x] 1.5 Handle errors with ScriptureError pattern

- [x] Task 2: Create SoloReadingFlow container component
  - [x] 2.1 Verse screen with reference, text, View Response button, Next Verse button
  - [x] 2.2 Response screen with prayer text, Back to Verse button, Next Verse button
  - [x] 2.3 Progress indicator "Verse X of 17" with aria-label
  - [x] 2.4 Exit button in header with confirmation dialog
  - [x] 2.5 Session completion screen (placeholder for Epic 2 reflection)
  - [x] 2.6 Framer Motion animations (crossfade for verse/response, slide for step advance)
  - [x] 2.7 Lavender Dreams theme (glass morphism, purple gradients, Playfair Display)
  - [x] 2.8 Syncing indicator and error display with role="alert"

- [x] Task 3: Update ScriptureOverview to route to SoloReadingFlow
  - [x] 3.1 Import SoloReadingFlow
  - [x] 3.2 Detect session in reading state (in_progress + solo mode) → render SoloReadingFlow
  - [x] 3.3 Detect completed session → render SoloReadingFlow (for completion screen)

- [x] Task 4: Update barrel exports
  - [x] 4.1 Add SoloReadingFlow to scripture-reading/index.ts

- [x] Task 5: Write comprehensive tests
  - [x] 5.1 SoloReadingFlow.test.tsx — 50 tests covering all ACs
  - [x] 5.2 scriptureReadingSlice.test.ts — 8 new tests for advanceStep, saveAndExit

## Dev Notes

### Architecture Compliance

- Container/Presentational pattern: SoloReadingFlow is container (connects to Zustand), all sub-views are inline presentational
- Zustand selector pattern: destructured selectors from useAppStore
- No React Router: navigation via session state in slice
- Error handling: ScriptureErrorCode + handleScriptureError pattern
- Loading states: isSyncing boolean flag

### File List

| File | Action | Notes |
|------|--------|-------|
| src/stores/slices/scriptureReadingSlice.ts | Modified | Added advanceStep(), saveAndExit(), added get() param, import MAX_STEPS |
| src/components/scripture-reading/containers/SoloReadingFlow.tsx | Created | 350 lines, full reading flow with verse/response/completion screens |
| src/components/scripture-reading/containers/ScriptureOverview.tsx | Modified | Added session routing to SoloReadingFlow, imported SoloReadingFlow |
| src/components/scripture-reading/index.ts | Modified | Added SoloReadingFlow export |
| src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx | Created | 50 tests |
| tests/unit/stores/scriptureReadingSlice.test.ts | Modified | +8 tests for advanceStep, saveAndExit |
| _bmad-output/implementation-artifacts/sprint-status.yaml | Modified | 1-2→done, 1-3→in-progress |

### Test Results

- 353 tests pass (58 new: 50 component + 8 slice)
- 0 regressions from 295 baseline
- Pre-existing failure: useMotionConfig.test.ts (Story 1.5 scaffold)
- tsc --noEmit: clean

### Change Log

- 2026-01-31: Story 1.3 implementation complete — SoloReadingFlow with verse/response screens, step advancement, exit dialog, completion screen, and comprehensive test coverage
