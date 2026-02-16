# Tasks / Subtasks

- [x]Task 1: Create MessageCompose presentational component (AC: #1)
  - [x]1.1 Create `MessageCompose.tsx` in `src/components/scripture-reading/reflection/`
  - [x]1.2 Accept props: `partnerName: string`, `onSend: (message: string) => void`, `onSkip: () => void`, `disabled: boolean`
  - [x]1.3 Heading: "Write something for [Partner Name]" (centered, serif, `text-purple-900`)
  - [x]1.4 Textarea: max 300 chars, auto-grow to ~6 lines, `resize-none`, `enterKeyHint="send"`, placeholder "Share what's on your heart (optional)"
  - [x]1.5 Character counter: visible at 250+ chars, muted style (`text-xs text-gray-400`), right-aligned below textarea
  - [x]1.6 "Send" button: full-width primary style, `aria-disabled` when textarea is empty AND user hasn't chosen to skip
  - [x]1.7 "Skip" button: tertiary text-only style below Send button, copy: "Skip for now" (no shame/guilt language)
  - [x]1.8 Keyboard handling: scroll textarea into view on focus to avoid keyboard overlap
  - [x]1.9 `disabled` prop gates both Send and Skip to prevent double-submission while parent is syncing
  - [x]1.10 Accessibility: `aria-label="Message to partner"` on textarea, focus moves to textarea on mount

- [x]Task 2: Create DailyPrayerReport presentational component (AC: #3, #4, #5)
  - [x]2.1 Create `DailyPrayerReport.tsx` in `src/components/scripture-reading/reflection/`
  - [x]2.2 Accept props: `userRatings: {stepIndex: number, rating: number}[]`, `userBookmarks: number[]`, `userStandoutVerses: number[]`, `partnerMessage: string | null`, `partnerName: string | null`, `partnerRatings: {stepIndex: number, rating: number}[] | null`, `partnerBookmarks: number[] | null`, `partnerStandoutVerses: number[] | null`, `isPartnerComplete: boolean`, `onReturn: () => void`
  - [x]2.3 Section: "Your Journey" — list user's step-by-step ratings with bookmarked verses highlighted (amber bookmark icon next to bookmarked steps)
  - [x]2.4 Section: "Verses That Stood Out" — display user's standout verse selections as chips
  - [x]2.5 Section: "A Message for You" — reveal partner's message in Dancing Script font (`font-cursive text-lg leading-relaxed`), card styling with subtle background
  - [x]2.6 If no partner message: do not render message section
  - [x]2.7 If partner has not completed: show "Waiting for [Partner Name]'s reflections" (muted, gentle copy)
  - [x]2.8 If partner complete (Together mode / async): show partner's ratings side-by-side with user's ratings
  - [x]2.9 "Return to Overview" button: full-width primary style at bottom
  - [x]2.10 Accessibility: `tabIndex={-1}` on report heading for programmatic focus, `aria-live="polite"` for partner data reveal

- [x]Task 3: Create UnlinkedCompletionScreen presentational component (AC: #2)
  - [x]3.1 Create inline within `SoloReadingFlow.tsx` (small enough to not warrant separate file — just a heading + button)
  - [x]3.2 Display: "Session complete" heading (centered, serif, `text-purple-900`)
  - [x]3.3 Subtext: "Your reflections have been saved" (muted, `text-sm text-purple-600`)
  - [x]3.4 "Return to Overview" button: full-width primary style
  - [x]3.5 On mount: mark session complete (`status: 'complete'`, `completedAt: new Date()`) via service

- [x]Task 4: Integrate report phase into SoloReadingFlow container (AC: #1, #2, #3)
  - [x]4.1 Replace the report phase placeholder ("Daily Prayer Report coming in Story 2.3") with multi-step report flow
  - [x]4.2 Report sub-phases: `'compose'` → `'report'` (or `'complete-unlinked'` for unlinked users)
  - [x]4.3 On report phase entry: check `partner` from `partnerSlice` — if null/no partner, skip to unlinked completion
  - [x]4.4 Linked flow: show `MessageCompose` → on send/skip → save message (if any) → mark session complete → show `DailyPrayerReport`
  - [x]4.5 `handleMessageSend(message: string)`: call `scriptureReadingService.addMessage(sessionId, userId, message)` non-blocking, then mark session complete and advance to report view
  - [x]4.6 `handleMessageSkip()`: skip message, mark session complete, advance to report view
  - [x]4.7 Mark session complete: call `updateSession(sessionId, { status: 'complete', completedAt: new Date() })` and `updatePhase('complete')` in slice
  - [x]4.8 Load report data: fetch user's reflections via `getReflectionsBySession()`, bookmarks via `getBookmarksBySession()`, partner message via `getMessagesBySession()`
  - [x]4.9 Fade-through-white transitions between compose → report subphases (400ms via `crossfade`)
  - [x]4.10 Focus management: focus on compose heading on entry, focus on report heading after transition

- [x]Task 5: Wire partner data for report display (AC: #3, #4, #5)
  - [x]5.1 Access partner info via `useAppStore(state => state.partner)` from `partnerSlice`
  - [x]5.2 For Solo mode: partner data may not exist yet (async) — show "Waiting for [Partner Name]'s reflections"
  - [x]5.3 For Together mode: both users' data available in same session — fetch partner's reflections and bookmarks via service
  - [x]5.4 Partner message: `getMessagesBySession()` returns all messages for session — filter by `senderId !== userId` to find partner's message
  - [x]5.5 Parse session-level reflection (stepIndex === MAX_STEPS/17) to extract standout verses from JSON `notes` field: `JSON.parse(notes).standoutVerses`

- [x]Task 6: Write unit tests for MessageCompose (AC: #1)
  - [x]6.1 Create `src/components/scripture-reading/__tests__/MessageCompose.test.tsx`
  - [x]6.2 Test: renders partner name in heading
  - [x]6.3 Test: textarea accepts input up to 300 chars
  - [x]6.4 Test: character counter visible at 250+ chars
  - [x]6.5 Test: Send button calls onSend with message text
  - [x]6.6 Test: Skip button calls onSkip
  - [x]6.7 Test: Send and Skip disabled when `disabled` prop is true
  - [x]6.8 Test: textarea has correct aria-label
  - [x]6.9 Test: focus moves to textarea on mount

- [x]Task 7: Write unit tests for DailyPrayerReport (AC: #3, #4, #5)
  - [x]7.1 Create `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx`
  - [x]7.2 Test: renders user's step-by-step ratings
  - [x]7.3 Test: renders bookmarked verses with amber highlight
  - [x]7.4 Test: renders standout verse selections
  - [x]7.5 Test: reveals partner message in Dancing Script font (font-cursive class)
  - [x]7.6 Test: shows "Waiting for [Partner Name]'s reflections" when partner incomplete
  - [x]7.7 Test: does not render message section when no partner message
  - [x]7.8 Test: shows partner ratings side-by-side when partner data available
  - [x]7.9 Test: "Return to Overview" button calls onReturn
  - [x]7.10 Test: report heading has tabIndex={-1} for programmatic focus

- [x]Task 8: Update SoloReadingFlow integration tests (AC: #1, #2, #3)
  - [x]8.1 Update `SoloReadingFlow.test.tsx` — report phase now shows MessageCompose/DailyPrayerReport instead of placeholder
  - [x]8.2 Test: linked user sees MessageCompose after reflection summary
  - [x]8.3 Test: unlinked user sees completion screen (skips message compose)
  - [x]8.4 Test: sending message calls addMessage service method
  - [x]8.5 Test: skipping message still marks session complete
  - [x]8.6 Test: DailyPrayerReport appears after send/skip
  - [x]8.7 Test: session marked complete (status + completedAt) after report phase entry
  - [x]8.8 Test: "Return to Overview" calls exitSession

- [x]Task 9: Update E2E and API test suites (AC: #1, #2, #3)
  - [x]9.1 Add Story 2.3 E2E tests to `tests/e2e/scripture/scripture-reflection-2.3.spec.ts`
  - [x]9.2 Add Story 2.3 API tests to `tests/api/scripture-reflection-api.spec.ts`
  - [x]9.3 Test IDs for E2E targeting listed in Testing Requirements below
