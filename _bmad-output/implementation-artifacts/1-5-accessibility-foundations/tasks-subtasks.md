# Tasks / Subtasks

## Task 1: Create useMotionConfig Hook (AC: #4)

- [x] 1.1 Create `src/hooks/useMotionConfig.ts`
  - Wraps Framer Motion's `useReducedMotion()` hook
  - Returns named animation presets:
    ```typescript
    export function useMotionConfig() {
      const shouldReduceMotion = useReducedMotion();
      return {
        shouldReduceMotion,
        crossfade: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
        slide: shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' },
        spring: shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 15 },
        fadeIn: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
        modeReveal: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
      };
    }
    ```
  - [Source: architecture/core-architectural-decisions.md#Decision 5: Component Architecture]
- [x] 1.2 Export from `src/hooks/index.ts` barrel file
  - Add `export { useMotionConfig } from './useMotionConfig';`
- [x] 1.3 Write unit tests: `src/hooks/__tests__/useMotionConfig.test.ts`
  - Test: returns non-zero durations when reduced motion is false
  - Test: returns zero durations for all presets when reduced motion is true
  - Test: `shouldReduceMotion` boolean reflects underlying hook value

## Task 2: Refactor Components to Use useMotionConfig (AC: #4)

- [x] 2.1 Refactor `SoloReadingFlow.tsx` — replace inline `useReducedMotion()` usage
  - Remove: `import { useReducedMotion } from 'framer-motion'`
  - Remove: `const shouldReduceMotion = useReducedMotion()`
  - Remove: inline `CROSSFADE_DURATION` / `SLIDE_DURATION` constants
  - Add: `import { useMotionConfig } from '../../../hooks/useMotionConfig'`
  - Add: `const { shouldReduceMotion, crossfade, slide } = useMotionConfig()`
  - Replace: `crossfadeTransition` → use `crossfade` from hook
  - Replace: `slideTransition` → use `slide` from hook
  - Replace: dialog transitions → use `crossfade` from hook
- [x] 2.2 Refactor `ScriptureOverview.tsx` — replace inline `useReducedMotion()` usage
  - Remove: `import { useReducedMotion } from 'framer-motion'`
  - Remove: `const shouldReduceMotion = useReducedMotion()`
  - Remove: inline `MODE_REVEAL_DURATION` constant
  - Add: `import { useMotionConfig } from '../../../hooks/useMotionConfig'`
  - Add: `const { modeReveal } = useMotionConfig()`
  - Replace: `fadeTransition` → use `modeReveal` from hook
- [x] 2.3 Update existing tests to mock `useMotionConfig` instead of `useReducedMotion`
  - Update `SoloReadingFlow.test.tsx`: change Framer Motion mock to `useMotionConfig` mock
  - Update `ScriptureOverview.test.tsx`: same change
  - Verify all existing tests still pass

## Task 3: Add Visible Focus Styles (AC: #1)

- [x] 3.1 Add focus-visible ring styles to all interactive elements in `SoloReadingFlow.tsx`
  - **Exit button:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
  - **Primary buttons (Next Verse, Complete Reading, Save & Exit, Return to Overview):** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2`
  - **Secondary buttons (View Response, Back to Verse):** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2`
  - **Cancel button (exit dialog):** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
  - **Retry button:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
  - Use `focus-visible` (not `focus`) to avoid showing rings on mouse click
- [x] 3.2 Add focus-visible ring styles to all interactive elements in `ScriptureOverview.tsx`
  - **Start button:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2`
  - **Continue button:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2`
  - **Start fresh button:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
  - **ModeCard buttons:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2`
  - **Link partner buttons:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
  - **Setup partner link:** Add `focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 rounded-lg`
- [x] 3.3 Verify no keyboard traps
  - Tab through entire flow: Overview → Start → Mode Selection → Solo → Reading → Exit Dialog → back
  - Exit dialog: Tab cycles between Save & Exit and Cancel (focus trap within dialog ✅ — already has backdrop click to dismiss + Escape key)
  - Ensure Escape key dismisses dialog (already implemented ✅)
  - Verify tab doesn't escape dialog while it's open (may need focus trap)
- [x] 3.4 Add focus trap to exit confirmation dialog
  - When dialog opens: trap focus within dialog (Save & Exit + Cancel buttons)
  - Use a simple focus trap: on Tab at last element, cycle to first; on Shift+Tab at first, cycle to last
  - Alternatively use `inert` attribute on background content when dialog is open
  - Dialog already has `autoFocus` on Save & Exit button ✅

## Task 4: Add Screen Reader Phase Transition Announcements (AC: #2)

- [x] 4.1 Create a visually-hidden announcer region in `SoloReadingFlow.tsx`
  - Add a `<div>` with `aria-live="polite"` and `aria-atomic="true"` that is visually hidden (sr-only)
  - Position it at the top of the component's DOM (before header)
  - `data-testid="sr-announcer"`
  - Content is driven by state, updated only on semantic changes
  ```tsx
  <div
    className="sr-only"
    aria-live="polite"
    aria-atomic="true"
    data-testid="sr-announcer"
  >
    {announcement}
  </div>
  ```
- [x] 4.2 Implement announcement logic
  - Track `prevStepIndex` and `prevSubView` using refs
  - On step change (`currentStepIndex` changed): set announcement to `"Now on verse {X}"`
  - On sub-view change to response: set announcement to `"Viewing response for verse {X}"`
  - On sub-view change to verse: set announcement to `"Back to verse {X}"`
  - On completion (session status = 'complete'): set announcement to `"Reading complete. All 17 verses finished."`
  - Clear announcement after a short delay (~1 second) to prevent stale reads
  - **Critical:** Only update on ACTUAL state changes, not on re-renders
- [x] 4.3 Add aria-live region to ScriptureOverview for session state changes
  - Announce "Session resumed at verse {X}" when loading a saved session
  - Announce "New session started" when creating a session
  - Use same sr-only pattern

## Task 5: Implement Focus Management on Transitions (AC: #3)

- [x] 5.1 Add refs for focus targets in `SoloReadingFlow.tsx`
  ```typescript
  const verseHeadingRef = useRef<HTMLParagraphElement>(null);
  const viewResponseButtonRef = useRef<HTMLButtonElement>(null);
  const backToVerseButtonRef = useRef<HTMLButtonElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  ```
- [x] 5.2 Add `tabIndex={-1}` to non-interactive focus targets
  - Verse reference `<p>` element: add `ref={verseHeadingRef}` + `tabIndex={-1}`
  - Completion heading `<h1>`: add `ref={completionHeadingRef}` + `tabIndex={-1}`
  - These elements aren't normally focusable; `tabIndex={-1}` allows programmatic focus without adding to tab order
- [x] 5.3 Implement focus movement on sub-view transitions
  - **Verse → Response** (View Response clicked): After render, focus `viewResponseButtonRef` is wrong per AC — AC says "Response screen: navigation button that was used" — this means focus the View Response button if that's what was clicked. BUT View Response disappears on response screen. Re-reading AC: "navigation button that was used" — on response screen, focus the Back to Verse button (it's the corresponding navigation action). Actually, on reflection, the AC likely means: after transition to response screen, put focus on the element relevant to how they got there. Since View Response was clicked, and now Back to Verse is the counterpart, focus Back to Verse button.
  - **Response → Verse** (Back to Verse clicked): Focus verse heading ref
  - **Step advancement** (Next Verse clicked): Focus verse heading ref of the new step
  - Use `useEffect` watching `subView` and `session.currentStepIndex` to manage focus
  - Wrap focus calls in `requestAnimationFrame` or small timeout to ensure DOM is updated after Framer Motion animation
- [x] 5.4 Implement focus management for completion screen
  - When `isCompleted` is true and completion screen renders: focus the "Reading Complete" heading
  - Use `useEffect` watching `isCompleted` flag
- [x] 5.5 Write tests for focus management
  - Test: after clicking "View Response", Back to Verse button receives focus
  - Test: after clicking "Back to Verse", verse heading receives focus
  - Test: after clicking "Next Verse", verse heading of new step receives focus
  - Test: completion screen focuses the heading

## Task 6: Audit & Fix Color Independence (AC: #5)

- [x] 6.1 Audit all color-only indicators in scripture reading components
  - **Error indicator** (`bg-red-50 text-red-700`): Has text content ✅ but no icon
    - Fix: Add a ⚠️ or warning SVG icon before error text
  - **Syncing indicator** ("Saving..." text): Text-only ✅ — no color-only issue
  - **Offline indicator** (`bg-amber-50 text-amber-700`): Has SVG icon + text ✅
  - **Retry banner** (`bg-amber-50 text-amber-700`): Has text + button ✅
  - **Progress indicator** ("Verse X of 17"): Text-only ✅
  - **Disabled button state** (`disabled:opacity-50`): Opacity only — needs text indication
    - Fix: When offline and Next Verse disabled, add helper text "Connect to internet to continue" below button
  - **Partner status skeleton** (animated pulse): No color-only concern
- [x] 6.2 Verify WCAG AA contrast ratios
  - **Muted purple text** (`text-purple-500` / `#A855F7`) on lavender background (`#F3E5F5`): CHECK — may fail 4.5:1
  - **Verse reference text** (`text-purple-500 text-xs`): Small text needs 4.5:1
  - **Response reference text** (`text-purple-400`): Lighter — likely fails contrast
  - **Section theme badge** (`text-purple-400 text-xs`): Likely fails contrast
  - **Text on glass surfaces** (`text-purple-900` on `bg-white/80`): Should pass
  - **Primary button text** (`text-white` on `purple-500/600`): Should pass
  - Fix any failing elements by darkening text color (e.g., `text-purple-400` → `text-purple-600`)
- [x] 6.3 Add icon to error indicator
  - Add warning SVG icon before error message text in both SoloReadingFlow and ScriptureOverview error displays
  ```tsx
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
  ```
- [x] 6.4 Add disabled reason text when Next Verse is disabled
  - When `!isOnline`: show `"Connect to internet to continue"` text below the disabled button
  - When `isSyncing`: "Saving..." indicator already present ✅

## Task 7: Verify & Fix Touch Target Sizes (AC: #5)

- [x] 7.1 Audit all touch targets in SoloReadingFlow
  - **Exit button (X):** `min-w-[44px] min-h-[44px]` ✅
  - **View Response:** `min-h-[48px]` ✅, full width ✅
  - **Back to Verse:** `min-h-[48px]` ✅, full width ✅
  - **Next Verse / Complete Reading:** `min-h-[56px]` ✅, full width ✅
  - **Save & Exit (dialog):** `min-h-[48px]` ✅
  - **Cancel (dialog):** `min-h-[48px]` ✅
  - **Retry button:** `min-w-[44px] min-h-[44px]` ✅
  - **Return to Overview:** `min-h-[56px]` ✅, full width ✅
  - **Spacing:** `space-y-3` (12px) between action buttons ✅ (>8px requirement)
- [x] 7.2 Audit all touch targets in ScriptureOverview
  - **Start button:** `min-h-[56px]` ✅, full width ✅
  - **Continue button:** `min-h-[48px]` ✅
  - **Start fresh:** `min-h-[48px]` ✅
  - **ModeCard buttons:** `min-h-[120px]` ✅
  - **Link partner message:** Full width, padding ✅
  - **Setup partner link:** Check — `py-2` may be too small — **Fix:** ensure min-h-[44px]
- [x] 7.3 Fix any failing touch targets
  - Add `min-h-[44px]` to "Setup partner link" and any other undersized elements

## Task 8: Enhance Exit Dialog Accessibility (AC: #1, #2)

- [x] 8.1 Implement focus trap in exit confirmation dialog
  - When dialog opens: first focusable element (Save & Exit) gets focus (`autoFocus` ✅)
  - Trap Tab / Shift+Tab within dialog (cycle between Save & Exit and Cancel)
  - On Escape: dismiss dialog (already implemented ✅)
  - On backdrop click: dismiss dialog (already implemented ✅)
  - Option A: Manual focus trap with `onKeyDown` on dialog container
  - Option B: Set `inert` attribute on `<main>` when dialog is open
- [x] 8.2 Restore focus when dialog closes
  - When dialog is dismissed (Cancel or backdrop click): return focus to the exit (X) button
  - Store the previously focused element before dialog opens, restore on close
- [x] 8.3 Write tests for dialog focus behavior
  - Test: opening dialog moves focus to Save & Exit button
  - Test: Tab from Cancel cycles back to Save & Exit
  - Test: Escape closes dialog and returns focus to exit button
  - Test: backdrop click closes dialog and returns focus to exit button

## Task 9: Add Semantic HTML Improvements (AC: #2)

- [x] 9.1 Add `<h1>` heading to verse screen for screen reader navigation
  - Currently verse reference is a `<p>` — consider wrapping in a heading for landmark navigation
  - Use visually-hidden `<h1>` or make the verse reference an `<h2>` under the main flow
  - The progress indicator context + verse reference should give screen readers clear structure
- [x] 9.2 Add `role="main"` or use `<main>` tag properly
  - SoloReadingFlow already uses `<main>` element ✅
  - ScriptureOverview does NOT use `<main>` — uses `<div>` — consider adding `<main>` wrapper or `role="main"`
- [x] 9.3 Add `aria-current="step"` to the active step indicator
  - Progress indicator "Verse X of 17" could benefit from `aria-current="step"` for step-based navigation context

## Task 10: Write Comprehensive Accessibility Tests (AC: all)

- [x] 10.1 Keyboard navigation tests for SoloReadingFlow
  - Test: all buttons are reachable via Tab in expected order
  - Test: Enter key activates buttons (View Response, Back to Verse, Next Verse, Exit)
  - Test: Space key activates buttons
  - Test: focus-visible ring class is applied on keyboard focus
- [x] 10.2 Screen reader tests for SoloReadingFlow
  - Test: sr-announcer region exists with aria-live="polite"
  - Test: step change triggers announcement "Now on verse X"
  - Test: subview change to response triggers announcement
  - Test: completion triggers announcement
  - Test: progress indicator has correct aria-label
  - Test: exit button has aria-label "Exit reading"
  - Test: all buttons have accessible names
- [x] 10.3 Focus management tests for SoloReadingFlow
  - Test: after View Response click, Back to Verse button has focus
  - Test: after Back to Verse click, verse heading has focus
  - Test: after Next Verse click, new verse heading has focus
  - Test: completion screen heading has focus
  - Test: dialog open focuses Save & Exit
  - Test: dialog close restores focus to exit button
- [x] 10.4 Reduced motion tests
  - Test: useMotionConfig returns zero durations when reduced motion is on
  - Test: SoloReadingFlow uses useMotionConfig (not raw useReducedMotion)
  - Test: ScriptureOverview uses useMotionConfig (not raw useReducedMotion)
- [x] 10.5 Color independence tests
  - Test: error indicator includes icon element
  - Test: disabled buttons show helper text when offline
  - Test: all interactive elements meet minimum touch target sizes (via data-testid + style checks)
- [x] 10.6 ScriptureOverview accessibility tests
  - Test: all buttons have accessible names
  - Test: mode selection section has aria-label
  - Test: resume prompt section has aria-label
  - Test: focus-visible ring classes applied to buttons
