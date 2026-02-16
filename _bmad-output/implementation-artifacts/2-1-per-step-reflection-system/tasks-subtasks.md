# Tasks / Subtasks

- [x] Task 1: Add BookmarkFlag component to verse screen (AC: #1)
  - [x] 1.1 Create `BookmarkFlag.tsx` in `src/components/scripture-reading/reading/`
  - [x] 1.2 Amber filled/outlined icon toggle using Lucide `Bookmark` (single icon with fill)
  - [x] 1.3 48x48px touch target wrapper with `aria-label` toggling
  - [x] 1.4 Wire `toggleBookmark()` from `scriptureReadingService` on tap
  - [x] 1.5 Add bookmark button to verse screen in `SoloReadingFlow.tsx` (top-right of verse reference row)
  - [x] 1.6 Optimistic UI: toggle icon immediately, write-through to server, revert on failure
  - [x] 1.7 Debounce rapid toggles (300ms) — last-write-wins

- [x] Task 2: Create PerStepReflection component (AC: #2, #4)
  - [x] 2.1 Create `PerStepReflection.tsx` in `src/components/scripture-reading/reflection/`
  - [x] 2.2 Rating scale: 5 numbered circle buttons in a `radiogroup`
  - [x] 2.3 End labels: "A little" (left of 1) and "A lot" (right of 5)
  - [x] 2.4 Prompt text: "How meaningful was this for you today?"
  - [x] 2.5 Each rating button: `role="radio"`, `aria-checked`, `aria-label="Rating N of 5: [label]"`
  - [x] 2.6 Keyboard navigation: arrow keys within radiogroup, Tab to move past group
  - [x] 2.7 Optional note textarea: max 200 chars, `resize-none`, auto-grow to ~4 lines
  - [x] 2.8 Character counter: visible at 150+ chars, muted style (`text-xs text-gray-400`)
  - [x] 2.9 Continue button: `aria-disabled` until rating selected, full-width primary style
  - [x] 2.10 Validation: quiet helper text "Please select a rating" on Continue tap without rating

- [x] Task 3: Integrate reflection into reading flow (AC: #2, #3)
  - [x] 3.1 Modify `SoloReadingFlow.tsx` to add `'reflection'` as a subview state (alongside `'verse'` and `'response'`)
  - [x] 3.2 When user taps "Next Verse", transition to reflection screen instead of immediately advancing
  - [x] 3.3 On reflection "Continue", call `addReflection()` service method then advance step
  - [x] 3.4 Fade-through-white transition (400ms) from verse/response to reflection
  - [x] 3.5 Focus management: move focus to reflection form heading on transition
  - [x] 3.6 `aria-live="polite"` announcement: "Reflect on this verse"
  - [x] 3.7 On step 17 reflection submission, transition to completion/end-of-session (Story 2.2 placeholder)

- [x] Task 4: Wire service layer and state management (AC: #3)
  - [x] 4.1 Reflection state managed as local component state in PerStepReflection (rating, notes)
  - [x] 4.2 Call `scriptureReadingService.addReflection()` with `is_shared: false` default
  - [x] 4.3 Handle write failure: non-blocking (reflection write failure doesn't block advancement)
  - [x] 4.4 Service handles IndexedDB cache update on success
  - [x] 4.5 Advance step via existing `advanceStep()` action after reflection submit

- [x] Task 5: Update completion screen placeholder (AC: #3)
  - [x] 5.1 After step 17's reflection, show placeholder: "Reflection summary coming in Story 2.2"
  - [x] 5.2 Replaced "Reflection feature coming soon (Epic 2)" text
  - [x] 5.3 Keep "Return to Overview" button
