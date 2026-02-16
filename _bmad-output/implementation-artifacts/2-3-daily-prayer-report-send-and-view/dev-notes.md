# Dev Notes

## What Already Exists (DO NOT Recreate)

The following are already implemented from Stories 2.1, 2.2 and Epic 1. **Extend, don't duplicate:**

| Component/File | What It Does | Location |
|---|---|---|
| `ReflectionSummary.tsx` | End-of-session reflection form (standout verses, rating, note) | `src/components/scripture-reading/reflection/ReflectionSummary.tsx` |
| `PerStepReflection.tsx` | Per-step rating + note form — **reuse visual patterns** | `src/components/scripture-reading/reflection/PerStepReflection.tsx` |
| `scriptureReadingService.addMessage()` | Writes message to Supabase + IndexedDB cache (write-through) | `src/services/scriptureReadingService.ts` (line 466) |
| `scriptureReadingService.getMessagesBySession()` | Reads messages (cache-first) | `src/services/scriptureReadingService.ts` (line 501) |
| `scriptureReadingService.getReflectionsBySession()` | Reads all reflections for a session | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.getBookmarksBySession()` | Reads bookmarks (cache-first) | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.updateSession()` | Updates session fields (phase, status, completedAt, etc.) | `src/services/scriptureReadingService.ts` (line 260) |
| `scripture_messages` table | DB table with RLS policies, index on (session_id, created_at) | `supabase/migrations/20260128000001_scripture_reading.sql` (line 94) |
| `ScriptureMessage` type | `{ id, sessionId, senderId, message, createdAt }` | `src/services/dbSchema.ts` (line 72) |
| `SupabaseMessageSchema` | Zod validation for message responses | `src/validation/schemas.ts` (line 317) |
| `ScriptureSession` type | `{ id, mode, userId, partnerId?, currentPhase, currentStepIndex, status, version, completedAt? }` | `src/services/dbSchema.ts` (line 32) |
| `SCRIPTURE_STEPS` constant | Array of 17 steps with `{ stepIndex, sectionTheme, verseReference, verseText, responseText }` | `src/data/scriptureSteps.ts` |
| `MAX_STEPS` constant | `17` | `src/data/scriptureSteps.ts` |
| `SoloReadingFlow.tsx` | Container with verse/response/reflection subviews, bookmark state, phase routing | `src/components/scripture-reading/containers/SoloReadingFlow.tsx` |
| `scriptureReadingSlice` | Zustand slice with `advanceStep()`, `updatePhase()`, `saveSession()`, `exitSession()` | `src/stores/slices/scriptureReadingSlice.ts` |
| `partnerSlice` | Zustand slice with `partner: PartnerInfo \| null`, `hasPartner()` | `src/stores/slices/partnerSlice.ts` |
| `PartnerInfo` type | `{ id, email, displayName, connectedAt }` | `src/api/partnerService.ts` (line 23) |
| `useMotionConfig` hook | `crossfade` (200ms), `slide` (300ms), `fadeIn` (200ms), respects `prefers-reduced-motion` | `src/hooks/useMotionConfig.ts` |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | Used in `SoloReadingFlow.tsx`, `PerStepReflection.tsx` |
| `MessageInput` component | Existing message input pattern in love-notes feature — reference for textarea patterns | `src/components/love-notes/MessageInput.tsx` |
| `SyncToast` | Success/failure toast component | `src/components/shared/SyncToast` |
| `isReportPhase` guard | Currently renders placeholder: "Daily Prayer Report coming in Story 2.3" | `SoloReadingFlow.tsx` |
| IndexedDB `scripture-messages` store | Configured with `by-session` index | `src/services/dbSchema.ts` (line 148) |
| Dancing Script font | Imported in `index.css`, configured as `font-cursive` in Tailwind config | `src/index.css`, `tailwind.config.js` |

## Architecture Constraints

**State Management:**
- Types co-located with `scriptureReadingSlice.ts` — do NOT create separate type files
- `MessageCompose` and `DailyPrayerReport` are **presentational (dumb) components** — receive all data via props
- Container logic (partner detection, service calls, phase transitions) stays in `SoloReadingFlow`
- Use `useAppStore(state => state.partner)` from `partnerSlice` for partner info — accessed via `useShallow` selector
- Use `updatePhase('complete')` from the slice to mark session complete

**Message Data Model:**
- Uses existing `scripture_messages` table — no new migrations needed
- `addMessage(sessionId, senderId, message)` writes to server then caches in IndexedDB
- No dedicated RPC — direct table insert via `addMessage()` service method (already handles write-through)
- RLS policy: users can insert messages where they are session member AND sender
- Messages are NOT idempotent (no unique constraint beyond PK) — guard against double-submission in UI with `disabled` prop

**Session Completion:**
- Session `status: 'complete'` and `completedAt` are set in THIS story (not before)
- `updateSession(sessionId, { status: 'complete', completedAt: new Date() })` persists to server
- `updatePhase('complete')` updates local slice state
- Phase transition chain: `reading` -> `reflection` (Story 2.2) -> `report` (this story) -> `complete` (this story)
- For unlinked users: skip compose, go directly to completion

**Partner Detection:**
- Check `useAppStore(state => state.partner)` — if `null`, user is unlinked
- Also check `session.partnerId` — if `undefined`, session has no partner
- Both conditions should align, but check `partner` from slice as primary (it has `displayName` for UI)
- For Solo sessions with linked partner: partner may not have completed yet — show waiting state

**Data Flow:**
- Reads: messages via `getMessagesBySession()` (cache-first), reflections via `getReflectionsBySession()` (cache-first), bookmarks via `getBookmarksBySession()` (already loaded in `bookmarkedSteps`)
- Writes: `addMessage()` → server → cache (non-blocking, fire-and-forget pattern)
- Session complete: `updateSession()` → server → cache (this one IS blocking — wait for success before showing report)
- Parse session-level reflection: filter reflections where `stepIndex === 17` (MAX_STEPS), parse `notes` field as JSON for `standoutVerses`

**Error Handling:**
- Use existing `ScriptureErrorCode` enum
- Message write failures: non-blocking toast via `SyncToast`, don't block session completion
- Session update failures: retry once, then show error toast and let user return to overview
- If partner data fetch fails: show "Waiting for [Partner Name]'s reflections" fallback

## UX / Design Requirements

**Message Composition Screen:**
- Heading: "Write something for [Partner Name]" (centered, serif `font-serif`, `text-purple-900`)
- Textarea: uses `.input` class pattern (soft blurred field), `min-h-[120px]`, `resize-none`, auto-grow to ~6 lines
- Max 300 chars (per epic AC — note: this is different from the 200 char limit on reflection notes)
- Character counter: visible at 250+ chars, muted style (`text-xs text-gray-400`), right-aligned
- `enterKeyHint="send"` for mobile keyboard hint
- Placeholder: "Share what's on your heart (optional)"
- `aria-label="Message to partner"` on textarea
- "Send" button: full-width primary gradient, text "Send", disabled when empty
- "Skip for now" button: below Send, tertiary text-only style (`text-sm text-purple-500 underline`), no guilt language
- Keyboard handling: use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on textarea focus
- Same max-width (`max-w-md`) and padding as reading flow

**Unlinked User Completion:**
- Simple centered screen: "Session complete" (serif heading)
- Subtext: "Your reflections have been saved" (muted purple)
- "Return to Overview" button (primary, full-width)
- No message compose step — skip straight to this
- Session marked complete on mount

**Daily Prayer Report:**
- Section heading: "Daily Prayer Report" (centered, serif, `text-purple-900`)
- **Your Journey section:**
  - Subheading: "Your Reflections"
  - List of 17 steps showing: verse reference, rating (1-5 as numbered circle — reuse visual from PerStepReflection), bookmark indicator (amber bookmark icon if bookmarked)
  - Compact layout: each step is a single row (verse reference left, rating circle right, bookmark icon if applicable)
  - Scrollable if content overflows (but likely fits on one screen)
- **Standout Verses section:**
  - Subheading: "Verses That Stood Out"
  - Display user's standout verse selections as read-only chips (same purple chip style as ReflectionSummary but non-interactive)
- **Partner Message section (if partner sent message):**
  - Card with subtle lavender background (`bg-purple-50`)
  - Border: `border border-purple-200 rounded-2xl`
  - Label: "A message from [Partner Name]" (muted, `text-sm text-purple-500`)
  - Message text: Dancing Script font (`font-cursive font-normal text-lg leading-relaxed text-purple-900`)
  - This should feel like receiving a handwritten note — emotional payoff moment
- **Waiting section (if partner hasn't completed):**
  - Text: "Waiting for [Partner Name]'s reflections" (muted, italic, `text-sm text-purple-400`)
  - Subtle pulse animation on text (2s cycle), respects `prefers-reduced-motion`
- **Together Mode Side-by-Side (AC #5):**
  - When both users complete: show two columns (or stacked on mobile) comparing ratings
  - User's column left, partner's column right
  - Both standout verse selections shown
  - Both messages revealed
  - This is a future enhancement for Together mode — for Solo MVP, just show user's data + partner's message
- "Return to Overview" button: full-width primary style at bottom, calls `exitSession()` from slice

**Transitions:**
- Reflection Summary → Message Compose: fade-through-white (400ms) via `crossfade`
- Message Compose → Daily Prayer Report: fade-through-white (400ms)
- All transitions: instant swap when `prefers-reduced-motion`
- Focus moves to compose heading on entry, report heading after transition

**Layout:**
- Same max-width (`max-w-md`) and padding (`p-6`) as all other reading flow screens
- Content vertically scrollable if needed (report can be longer than viewport)
- "Return to Overview" button sticky at bottom or at end of scroll content

## File Locations

| New File | Purpose |
|---|---|
| `src/components/scripture-reading/reflection/MessageCompose.tsx` | Message composition presentational component |
| `src/components/scripture-reading/reflection/DailyPrayerReport.tsx` | Daily Prayer Report presentational component |
| `src/components/scripture-reading/__tests__/MessageCompose.test.tsx` | Unit tests for MessageCompose |
| `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx` | Unit tests for DailyPrayerReport |

| Modified File | Changes |
|---|---|
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | Replace report placeholder with MessageCompose/DailyPrayerReport flow; add partner detection; add session completion logic |
| `src/components/scripture-reading/index.ts` | Add barrel exports for `MessageCompose`, `DailyPrayerReport` |
| `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` | Update report phase tests for new components |
| `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` | Add Story 2.3 E2E tests |
| `tests/api/scripture-reflection-api.spec.ts` | Add Story 2.3 API tests (message persistence) |

## Testing Requirements

**Unit Tests (MessageCompose.test.tsx):**
- Renders partner name in heading
- Textarea accepts input up to 300 chars
- Character counter visible at 250+ chars
- Send button calls onSend with message text
- Skip button calls onSkip
- Send and Skip disabled when `disabled` prop is true
- Textarea has correct aria-label
- Focus moves to textarea on mount

**Unit Tests (DailyPrayerReport.test.tsx):**
- Renders user's step-by-step ratings (17 rows)
- Renders bookmarked verses with amber highlight
- Renders standout verse selections as chips
- Reveals partner message in Dancing Script font (`font-cursive` class present)
- Shows "Waiting for [Partner Name]'s reflections" when partner incomplete
- Does not render message section when no partner message and no waiting
- Shows partner ratings side-by-side when partner data available
- "Return to Overview" button calls onReturn
- Report heading has `tabIndex={-1}` for programmatic focus

**Integration Tests (SoloReadingFlow.test.tsx):**
- Linked user sees MessageCompose after reflection summary
- Unlinked user sees completion screen (skips message compose)
- Sending message calls addMessage service method
- Skipping message still marks session complete
- DailyPrayerReport appears after send/skip
- Session marked complete (status + completedAt) after report phase entry
- "Return to Overview" calls exitSession

**Test IDs:**
- `scripture-message-compose-screen` — root container for message compose
- `scripture-message-compose-heading` — heading element
- `scripture-message-textarea` — textarea input
- `scripture-message-char-count` — character counter
- `scripture-message-send-btn` — send button
- `scripture-message-skip-btn` — skip button
- `scripture-report-screen` — root container for DailyPrayerReport
- `scripture-report-heading` — report heading
- `scripture-report-user-ratings` — user's ratings section
- `scripture-report-rating-step-{n}` — individual step rating row (0-16)
- `scripture-report-bookmark-indicator-{n}` — bookmark indicator per step
- `scripture-report-standout-verses` — standout verses section
- `scripture-report-partner-message` — partner message card
- `scripture-report-partner-waiting` — waiting for partner text
- `scripture-report-return-btn` — return to overview button
- `scripture-unlinked-complete-screen` — unlinked user completion screen
- `scripture-unlinked-complete-heading` — completion heading
- `scripture-unlinked-return-btn` — return button for unlinked

**Test file locations:**
- `src/components/scripture-reading/__tests__/MessageCompose.test.tsx`
- `src/components/scripture-reading/__tests__/DailyPrayerReport.test.tsx`
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` (modified)
- `tests/e2e/scripture/scripture-reflection-2.3.spec.ts` (modified)
- `tests/api/scripture-reflection-api.spec.ts` (modified)

## Accessibility Checklist

- [x]Message compose heading: `tabIndex={-1}` for programmatic focus
- [x]Message textarea: `aria-label="Message to partner"`
- [x]Message textarea: auto-grow, `resize-none`
- [x]Character counter: `aria-live="polite"` when approaching limit (250+)
- [x]Send button: `aria-disabled` when textarea empty
- [x]Skip button: clear, non-judgmental label ("Skip for now")
- [x]Report heading: `tabIndex={-1}` for programmatic focus, `data-testid="scripture-report-heading"`
- [x]Partner message: displayed in Dancing Script (`font-cursive`), adequate contrast against card background
- [x]Waiting text: `aria-live="polite"` for dynamic partner status updates
- [x]All animations respect `prefers-reduced-motion` (uses `crossfade` from `useMotionConfig`)
- [x]Phase transition: focus moves to compose heading, then report heading
- [x]Phase transition: `aria-live="polite"` announces "Write a message for your partner" / "Your Daily Prayer Report"
- [x]"Return to Overview" button: full-width, accessible, focus ring
- [x]Unlinked completion screen: simple, non-judgmental, all reflections still saved
- [x]All interactive elements meet 48x48px minimum touch target
- [x]No-shame UX copy throughout (skip language, waiting language, unlinked language)

## Previous Story Intelligence (Stories 2.1 & 2.2)

**Learnings from Story 2.1 implementation:**
- `aria-disabled` pattern preferred over HTML `disabled` on Continue/Send buttons — allows click events to fire for validation display
- Character counter threshold convention: appear ~50 chars before limit (150 for 200-char fields → 250 for 300-char field)
- Reflection writes are fire-and-forget (non-blocking) — apply same pattern for message writes
- Focus management uses `requestAnimationFrame` + `document.querySelector` by `data-testid`
- Screen reader announcements use `setTimeout(100ms)` + `setTimeout(1000ms)` clear pattern

**Learnings from Story 2.2 implementation:**
- `ReflectionSummary` established presentational component pattern: all data via props, callbacks for actions
- H2 code review fix: always include `updatePhase` in `useShallow` selector — don't use `useAppStore.getState()` directly
- H1 code review fix: always add `disabled` guard to submit handlers to prevent double-submission
- Full `isReflectionPhase` / `isReportPhase` routing already established in SoloReadingFlow
- Session stays `status: 'in_progress'` through reflection and report phases until THIS story completes it
- `handleReflectionSummarySubmit` pattern: save data non-blocking → update phase → transition to next screen

**Code review fixes from Stories 2.1 & 2.2 (avoid same mistakes):**
- Do NOT import `supabase` directly in container components — use service layer methods
- Avoid duplicate `aria-live` announcers — use the single dynamic announcer pattern
- Always clean up timers on unmount
- Include all actions in `useShallow` selectors — don't use `getState()` for actions
- Add `disabled` guard to all submission handlers
- Document all modified files in the File List (don't miss cross-story changes)

## Git Intelligence

Recent commits show established patterns:
- Component files: PascalCase (`MessageCompose.tsx`, `DailyPrayerReport.tsx`)
- Focus management: `useRef` + `requestAnimationFrame` for focus on mount/transition
- `AnimatePresence` with `mode="wait"` for view transitions
- `data-testid` attributes aligned with E2E test specs
- Existing focus ring constant reused: `FOCUS_RING`
- Container/presentational split: container in `containers/`, presentational in `reflection/`
- Commit prefix: `feat(epic-2): implement Story 2.3 daily prayer report`

## Cross-Story Context

- **Story 2.1** (Per-Step Reflection) — completed. Provides: per-step reflections in DB, bookmark state in UI, reflection subview pattern.
- **Story 2.2** (End-of-Session Reflection Summary) — completed. Provides: session-level reflection with standout verses, phase transitions (reading → reflection → report), `isReportPhase` guard in SoloReadingFlow.
- **Story 2.3** (this story) — completes Epic 2. Provides: message composition, daily prayer report display, session completion logic.
- **Epic 3** (Stats & Overview Dashboard) — depends on completed sessions. Ensure session `status: 'complete'` and `completedAt` are reliably set so aggregate queries work.
- Phase transition chain: `reading` → `reflection` (Story 2.2) → `report` (this story) → `complete` (this story)

## Project Structure Notes

- `MessageCompose.tsx` goes in `reflection/` subfolder (per architecture Decision 5 directory structure — reflection components live here)
- `DailyPrayerReport.tsx` goes in `reflection/` subfolder (per architecture Decision 5: "DailyPrayerReport" listed in `reflection/`)
- No new hooks needed — reuse `useMotionConfig` for transitions
- No new services needed — reuse existing `scriptureReadingService` methods (`addMessage`, `getMessagesBySession`, `getReflectionsBySession`, `updateSession`)
- No new store slices needed — reuse `scriptureReadingSlice` (`updatePhase`, `exitSession`) + `partnerSlice` (`partner`)
- No new DB migrations needed — `scripture_messages` table already exists with RLS policies
- No new IndexedDB stores needed — `scripture-messages` store already configured
- Dancing Script font already imported and configured as `font-cursive` in Tailwind

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-reflection-daily-prayer-report.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 1, Decision 4, Decision 5]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Structure Patterns, Format Patterns, Process Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md#Typography System, Partner Message]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Form Patterns, Validation, Phase Transition Animations]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md#DailyPrayerReport Component, Components to Reuse]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md#Solo Mode Flow, Together Mode Flow]
- [Source: _bmad-output/implementation-artifacts/2-1-per-step-reflection-system.md#Dev Notes, Code Review Fixes]
- [Source: _bmad-output/implementation-artifacts/2-2-end-of-session-reflection-summary.md#Dev Notes, Code Review Fixes, Completion Notes]
- [Source: docs/project-context.md#Scripture Reading Feature Architecture]
