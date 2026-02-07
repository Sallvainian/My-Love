# Tasks / Subtasks

- [x] Task 1: Create SoloReadingFlow container component (AC: #1, #2, #3)
  - [x] 1.1 Create `src/components/scripture-reading/containers/SoloReadingFlow.tsx` as container component
  - [x] 1.2 Connect to Zustand store: `session`, `isSyncing`, `scriptureError`, `advanceStep`, `saveAndExit`
  - [x] 1.3 Implement local UI state: `subView` ('verse' | 'response'), `showExitConfirm`, `slideDirection`
  - [x] 1.4 Guard: if no session, render `null` (component should only mount when session is active)
  - [x] 1.5 Guard: if session is complete or phase is 'reflection', render completion placeholder screen

- [x] Task 2: Implement verse screen (AC: #2)
  - [x] 2.1 Display verse reference text (Inter font, `text-sm font-medium text-purple-500`)
  - [x] 2.2 Display verse text prominently in glass morphism card (`font-serif text-xl text-purple-900`, `bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl`)
  - [x] 2.3 Display progress indicator: "Verse X of 17" with `aria-label="Currently on verse X of 17"`
  - [x] 2.4 Add section theme badge in header
  - [x] 2.5 Ensure verse data comes from `SCRIPTURE_STEPS[session.currentStepIndex]`

- [x] Task 3: Implement response screen (AC: #3)
  - [x] 3.1 Display response prayer text (Inter 400, `text-base text-purple-800`)
  - [x] 3.2 Show contextual verse reference ("Response to {verseReference}")
  - [x] 3.3 Crossfade animation between verse and response (200ms, 0ms if reduced-motion)
  - [x] 3.4 Use `useReducedMotion()` from Framer Motion for accessibility

- [x] Task 4: Implement navigation buttons (AC: #2, #3, #4)
  - [x] 4.1 "View Response" button — secondary style, switches `subView` to 'response'
  - [x] 4.2 "Back to Verse" button — secondary style, switches `subView` to 'verse'
  - [x] 4.3 "Next Verse" primary button — full-width, 56px height, bottom-anchored, gradient style
  - [x] 4.4 On verse screen: show "View Response" + "Next Verse"
  - [x] 4.5 On response screen: show "Back to Verse" + "Next Verse"
  - [x] 4.6 "Next Verse" changes to "Complete Reading" on step 17 (index 16)
  - [x] 4.7 Disable "Next Verse" while `isSyncing` is true
  - [x] 4.8 All buttons meet 48x48px minimum touch target, 8px spacing

- [x] Task 5: Implement step advancement logic (AC: #4, #5)
  - [x] 5.1 `handleNextVerse` resets `subView` to 'verse', sets slide direction, calls `advanceStep()`
  - [x] 5.2 `advanceStep()` in slice: optimistically increments `currentStepIndex` + persists to server
  - [x] 5.3 On last step (index 16): set `currentPhase = 'reflection'`, `status = 'complete'`
  - [x] 5.4 Slide-left + fade animation on step change (300ms, 0ms if reduced-motion)
  - [x] 5.5 Handle server sync errors gracefully (show error alert, don't block navigation)

- [x] Task 6: Implement exit with save dialog (AC: #6)
  - [x] 6.1 Add exit (X) button in header with `aria-label="Exit reading"` (44x44px touch target)
  - [x] 6.2 Show confirmation dialog: "Save your progress?" / "You can continue later."
  - [x] 6.3 "Save & Exit" button calls `saveAndExit()` from slice
  - [x] 6.4 "Cancel" dismisses dialog, returns to reading
  - [x] 6.5 Dialog uses `role="dialog"`, `aria-labelledby`, `aria-describedby`
  - [x] 6.6 Backdrop overlay with `bg-black/40 backdrop-blur-sm`
  - [x] 6.7 Show "Saving..." text while `isSyncing` is true, disable Save button

- [x] Task 7: Integrate routing from ScriptureOverview (AC: #1)
  - [x] 7.1 In `ScriptureOverview.tsx`, add condition: if `session` exists with `status='in_progress'` and `mode='solo'`, render `<SoloReadingFlow />` instead of overview
  - [x] 7.2 Also route to SoloReadingFlow for completion screen (session.status = 'complete' or phase = 'reflection')
  - [x] 7.3 Update barrel export in `src/components/scripture-reading/index.ts` to export `SoloReadingFlow`
  - [x] 7.4 On `saveAndExit()`, session is cleared from slice → user returns to ScriptureOverview automatically

- [x] Task 8: Implement completion placeholder screen (AC: #5)
  - [x] 8.1 Show "Reading Complete" message with prayer emoji
  - [x] 8.2 Display "You've completed all 17 scripture readings" text
  - [x] 8.3 Add "Reflection feature coming soon (Epic 2)" placeholder note
  - [x] 8.4 "Return to Overview" button calls `exitSession()` to clear session state

- [x] Task 9: Add syncing and error indicators (AC: #4, #6)
  - [x] 9.1 "Saving..." indicator when `isSyncing` is true
  - [x] 9.2 Error alert with `role="alert"` when `scriptureError` is non-null
  - [x] 9.3 Error display uses red styling: `bg-red-50 border border-red-200 text-red-700`

- [x] Task 10: Write unit tests for SoloReadingFlow (AC: all)
  - [x] 10.1 Test verse screen renders with correct reference, text, and progress
  - [x] 10.2 Test response screen renders with prayer text and context reference
  - [x] 10.3 Test "View Response" toggles to response screen
  - [x] 10.4 Test "Back to Verse" toggles to verse screen
  - [x] 10.5 Test "Next Verse" calls `advanceStep()` and resets subView to 'verse'
  - [x] 10.6 Test progress indicator updates: "Verse X of 17"
  - [x] 10.7 Test last step shows "Complete Reading" instead of "Next Verse"
  - [x] 10.8 Test completion screen renders when session.status is 'complete'
  - [x] 10.9 Test exit button shows confirmation dialog
  - [x] 10.10 Test "Save & Exit" calls `saveAndExit()` and dismisses dialog
  - [x] 10.11 Test "Cancel" dismisses exit dialog
  - [x] 10.12 Test loading/syncing state disables buttons
  - [x] 10.13 Test error display shows error message
  - [x] 10.14 Test null session renders nothing
  - [x] 10.15 Test routing: ScriptureOverview renders SoloReadingFlow when session is active

- [x] Task 11: Write/update slice tests for advanceStep and saveAndExit (AC: #4, #5, #6)
  - [x] 11.1 Test `advanceStep` increments `currentStepIndex` and sets `isSyncing`
  - [x] 11.2 Test `advanceStep` on last step sets phase to 'reflection' and status to 'complete'
  - [x] 11.3 Test `advanceStep` handles server error gracefully (sets `scriptureError`, clears `isSyncing`)
  - [x] 11.4 Test `saveAndExit` persists session to server and clears slice state
  - [x] 11.5 Test `saveAndExit` handles server error (sets `scriptureError`, preserves session)
