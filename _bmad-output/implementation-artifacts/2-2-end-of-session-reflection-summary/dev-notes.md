# Dev Notes

## What Already Exists (DO NOT Recreate)

The following are already implemented from Story 2.1 and Epic 1. **Extend, don't duplicate:**

| Component/File | What It Does | Location |
|---|---|---|
| `PerStepReflection.tsx` | Rating scale (1-5) + note textarea pattern — **reuse this visual pattern** | `src/components/scripture-reading/reflection/PerStepReflection.tsx` |
| `scriptureReadingService.addReflection()` | Writes reflection to Supabase + IndexedDB cache | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.getBookmarksBySession()` | Reads bookmarks (cache-first) | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.getReflectionsBySession()` | Reads all reflections for a session | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.updateSession()` | Updates session fields (phase, status, etc.) on server | `src/services/scriptureReadingService.ts` |
| `scripture_submit_reflection` RPC | Server-side upsert with `ON CONFLICT DO UPDATE` | `supabase/migrations/20260130000001_scripture_rpcs.sql` |
| `scripture_reflections` table | DB table with unique constraint `(session_id, step_index, user_id)` | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `ScriptureReflection` type | `{ id, sessionId, stepIndex, userId, rating, notes, isShared, createdAt }` | `src/services/dbSchema.ts` |
| `ScriptureBookmark` type | `{ id, sessionId, stepIndex, userId, shareWithPartner, createdAt }` | `src/services/dbSchema.ts` |
| `SupabaseReflectionSchema` | Zod validation for RPC responses | `src/validation/schemas.ts` |
| `SCRIPTURE_STEPS` constant | Array of 17 steps with `{ stepIndex, sectionTheme, verseReference, verseText, responseText }` | `src/data/scriptureSteps.ts` |
| `MAX_STEPS` constant | `17` | `src/data/scriptureSteps.ts` |
| `SoloReadingFlow.tsx` | Container with verse/response/reflection subviews, bookmark state (`bookmarkedSteps`), step navigation | `src/components/scripture-reading/containers/SoloReadingFlow.tsx` |
| `scriptureReadingSlice` | Zustand slice with `advanceStep()`, `updatePhase()`, `saveSession()`, `exitSession()` | `src/stores/slices/scriptureReadingSlice.ts` |
| `useMotionConfig` hook | `crossfade` (400ms fade), `slide` transitions, respects `prefers-reduced-motion` | `src/hooks/useMotionConfig.ts` |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | Used in `SoloReadingFlow.tsx`, `PerStepReflection.tsx` |
| `bookmarkedSteps` state | `Set<number>` of step indices the user bookmarked — **already loaded on session mount** | `SoloReadingFlow.tsx` line 94 |
| `isCompleted` check | `session.status === 'complete' || session.currentPhase === 'reflection'` | `SoloReadingFlow.tsx` line 341 |

## Architecture Constraints

**State Management:**
- Types co-located with `scriptureReadingSlice.ts` — do NOT create separate type files
- `ReflectionSummary` is a **presentational (dumb) component** — receives all data via props
- Container logic (bookmark loading, phase transitions, service calls) stays in `SoloReadingFlow`
- Use `updatePhase('report')` from the slice to transition after reflection summary submission

**Session-Level Reflection Data Model:**
- Reuse the existing `scripture_reflections` table with `step_index: MAX_STEPS` (17) as sentinel for session-level reflections
- Why 17 not -1: Zod schema `SupabaseReflectionSchema` has `step_index: z.number().int().min(0)` — negative values fail validation
- The unique constraint `(session_id, step_index, user_id)` guarantees idempotent upsert for step 17
- Standout verse indices stored as JSON in `notes` field: `{"standoutVerses": [0, 5, 12], "userNote": "optional text"}`
- This avoids new tables/migrations — the existing schema supports this pattern
- The `rating` field stores the session-level rating (1-5)

**Phase Transition Fix (CRITICAL):**
- Currently, `advanceStep()` sets BOTH `currentPhase: 'reflection'` AND `status: 'complete'` when step 17 finishes
- This is WRONG for Story 2.2 — status should stay `'in_progress'` until after the report phase (Story 2.3)
- Fix: change `status: 'complete'` → `status: 'in_progress'` in `advanceStep()` when reaching max steps
- The session will be marked `'complete'` in Story 2.3 after the Daily Prayer Report

**Completion Screen Refactor:**
- The current `isCompleted` guard (`SoloReadingFlow.tsx` line 340-342) checks `session.status === 'complete' || session.currentPhase === 'reflection'`
- This must be split into two states:
  1. `currentPhase === 'reflection'` → show `ReflectionSummary` component
  2. `currentPhase === 'report'` → show Story 2.3 placeholder ("Daily Prayer Report coming in Story 2.3")
- Remove `session.status === 'complete'` from this guard — it's premature

**Data Flow:**
- Reads: `bookmarkedSteps` already loaded in `SoloReadingFlow` state (optimistic, populated on session mount)
- Map `bookmarkedSteps` Set → array via `SCRIPTURE_STEPS[stepIndex]` to get `verseReference` and `verseText`
- Writes: `addReflection(sessionId, MAX_STEPS, rating, JSON.stringify({standoutVerses, userNote}), false)` → non-blocking
- Phase advance: `updatePhase('report')` → persists to server → then render Story 2.3 placeholder

**Error Handling:**
- Use existing `ScriptureErrorCode` enum
- Write failures: non-blocking toast via `SyncToast`, never block phase advancement
- If reflection write fails, still advance to 'report' phase

## UX / Design Requirements

**Bookmarked Verse Chips:**
- Display only bookmarked verses (NOT all 17)
- Each chip shows verse reference text (e.g., "Psalm 147:3")
- Uses MoodButton-style pattern: rounded pill, toggleable
- Selected state: `bg-purple-500 text-white` (filled)
- Unselected state: `border-purple-200 bg-white/80 text-purple-600` (outlined)
- `aria-pressed` attribute reflects selection state
- Min 48x48px touch target per chip, `gap-2` spacing
- Wrap layout (`flex-wrap`) for multiple bookmarks

**No-Bookmarks Fallback:**
- When `bookmarkedSteps` is empty, show: "You didn't mark any verses — that's okay"
- This is NOT an error — it's a gentle acknowledgment (per UX Principle 4: Vulnerability is Invited, Not Demanded)
- When no bookmarks exist, the verse selection requirement is waived (only rating required)
- Continue button enables with just a rating selected

**Session Rating:**
- Same visual pattern as `PerStepReflection` rating (1-5 numbered circles)
- Prompt: "How meaningful was this session for you today?" (note: "session" not "verse")
- End labels: "A little" (1) and "A lot" (5)
- `role="radiogroup"`, `aria-label`, arrow key navigation
- 48x48px circle buttons, purple selected/white unselected

**Note Textarea:**
- Same pattern as `PerStepReflection` note textarea
- Placeholder: "Reflect on the session as a whole (optional)"
- Max 200 chars, auto-grow to ~4 lines, `resize-none`
- Character counter at 150+ chars, muted style
- `enterKeyHint="done"`, `aria-label="Optional session reflection note"`

**Validation:**
- Quiet only — no red, no aggressive indicators
- When bookmarks exist: both standout verse AND rating required
- When no bookmarks: only rating required
- Helper text: "Please select a standout verse" / "Please select a rating" (muted, `text-sm text-purple-400`)
- Continue button: `aria-disabled` + `opacity-50 cursor-not-allowed` until requirements met

**Transitions:**
- Reading (step 17 reflection) → Reflection Summary: fade-through-white (400ms) via `crossfade`
- Reflection Summary → Report placeholder: fade-through-white (400ms)
- All transitions: instant swap when `prefers-reduced-motion`
- Focus moves to reflection summary heading on entry

**Layout:**
- Section heading: "Your Session" (centered, serif, `text-purple-900`)
- Verse chips section with subheading: "Verses that stood out"
- Rating section (reuse PerStepReflection layout)
- Note textarea
- Continue button (full-width, primary style)
- Same max-width (`max-w-md`) and padding as reading flow

## File Locations

| New File | Purpose |
|---|---|
| `src/components/scripture-reading/reflection/ReflectionSummary.tsx` | Reflection summary presentational component |
| `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx` | Unit tests for ReflectionSummary |

| Modified File | Changes |
|---|---|
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | Replace completion placeholder with ReflectionSummary; add report phase placeholder; refactor `isCompleted` guard |
| `src/components/scripture-reading/index.ts` | Add barrel export for `ReflectionSummary` |
| `src/stores/slices/scriptureReadingSlice.ts` | Fix `advanceStep()` to NOT set `status: 'complete'` at step 17 (keep `'in_progress'`) |
| `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` | Update completion tests for new ReflectionSummary flow |

## Testing Requirements

**Unit Tests (ReflectionSummary.test.tsx):**
- Renders bookmarked verses as selectable chips with correct verse references
- Displays no-bookmark fallback message when empty
- Chips toggle `aria-pressed` on click (multi-select)
- Rating scale renders with correct ARIA attributes
- Continue disabled until both verse and rating selected
- Continue enabled with just rating when no bookmarks
- Validation messages appear on premature Continue tap
- Character counter visible at 150+ chars
- `onSubmit` called with `{ standoutVerses: number[], rating: number, notes: string }`
- Keyboard navigation within rating radiogroup

**Integration Tests (SoloReadingFlow.test.tsx):**
- After step 17 reflection submit → ReflectionSummary screen appears
- Bookmarked verses from session appear as chips in ReflectionSummary
- Submitting reflection summary calls `addReflection` with `stepIndex: MAX_STEPS` (17)
- Phase advances to 'report' after submission

**Test IDs:**
- `scripture-reflection-summary-screen` — root container
- `scripture-reflection-summary-heading` — section heading
- `scripture-standout-verse-{stepIndex}` — each verse chip
- `scripture-no-bookmarks-message` — fallback text
- `scripture-session-rating-group` — rating radiogroup
- `scripture-session-rating-{n}` — rating buttons (1-5)
- `scripture-session-note` — textarea
- `scripture-session-note-char-count` — character counter
- `scripture-reflection-summary-continue` — Continue button
- `scripture-reflection-summary-validation` — validation messages
- `scripture-report-placeholder` — Story 2.3 placeholder screen

**Test file locations:**
- `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx`
- `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` (modified)

## Accessibility Checklist

- [ ] Reflection summary heading: `tabIndex={-1}` for programmatic focus, `data-testid="scripture-reflection-summary-heading"`
- [ ] Verse chips: `aria-pressed` toggles on selection, `role="button"`
- [ ] Verse chips: 48x48px minimum touch target
- [ ] Rating: `role="radiogroup"` with `aria-label="How meaningful was this session for you today?"`
- [ ] Rating buttons: `role="radio"`, `aria-checked`, `aria-label="Rating N of 5: [label]"`
- [ ] Rating: keyboard arrow navigation within group
- [ ] Note textarea: `aria-label="Optional session reflection note"`
- [ ] Character counter: `aria-live="polite"` when approaching limit
- [ ] Continue button: `aria-disabled` when requirements not met
- [ ] Phase transition: focus moves to reflection summary heading
- [ ] Phase transition: `aria-live="polite"` announces "Review your session reflections"
- [ ] All animations respect `prefers-reduced-motion` (uses `crossfade` from `useMotionConfig`)
- [ ] No-bookmarks message is gentle, non-judgmental (UX principle 4)

## Previous Story Intelligence (Story 2.1)

**Learnings from Story 2.1 implementation:**
- `aria-disabled` pattern preferred over HTML `disabled` on Continue button — allows click events to fire for validation display
- Character counter threshold was set to 150 (not 200) for better UX warning — follow same pattern
- Debounce approach: visual toggle is instant, server write is debounced — bookmark state in `SoloReadingFlow` is source of truth for UI
- Reflection writes are fire-and-forget (non-blocking) — never block session advancement
- Focus management uses `requestAnimationFrame` + `document.querySelector` by `data-testid` for newly rendered elements
- Screen reader announcements use `setTimeout(100ms)` + `setTimeout(1000ms)` clear pattern
- Action buttons hidden during reflection subview to avoid confusion — apply same pattern for reflection summary

**Code review fixes from Story 2.1 (avoid same mistakes):**
- Do NOT import `supabase` directly in container components — use `session.userId` from slice
- Avoid duplicate `aria-live` announcers — use the single dynamic announcer pattern
- Always clean up debounce timers on unmount to prevent ghost writes

## Git Intelligence

Recent commits show established patterns:
- Component files: PascalCase (`ReflectionSummary.tsx`)
- Focus management: `useRef` + `requestAnimationFrame` for focus on mount/transition
- `AnimatePresence` with `mode="wait"` for view transitions
- `data-testid` attributes aligned with E2E test specs
- Existing focus ring constant reused: `FOCUS_RING`
- Container/presentational split: container in `containers/`, presentational in `reflection/`

## Cross-Story Context

- **Story 2.1** (Per-Step Reflection) — completed. Provides: per-step reflections in DB, bookmark state in UI, reflection subview pattern.
- **Story 2.3** (Daily Prayer Report) — depends on this story completing. Needs: session marked as `phase: 'report'`, reflection summary data available for report display. Story 2.3 will implement the `'report'` phase screen that replaces the placeholder created here.
- Phase transition chain: `reading` → `reflection` (this story) → `report` (Story 2.3) → `complete` (Story 2.3)
- Session `status: 'complete'` should NOT be set in this story. Keep `status: 'in_progress'` until Story 2.3 completes the report.

## Project Structure Notes

- `ReflectionSummary.tsx` goes in `reflection/` subfolder (per architecture Decision 5 directory structure)
- No new hooks needed — reuse `useMotionConfig` for transitions
- No new services needed — reuse existing `scriptureReadingService` methods
- No new store slices needed — reuse `scriptureReadingSlice` with existing `updatePhase()` action
- No new DB migrations needed — reuse `scripture_reflections` table with `stepIndex: MAX_STEPS` (17) sentinel
- No new IndexedDB stores needed — existing schema supports this

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-reflection-daily-prayer-report.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 1, Decision 4, Decision 5]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Structure Patterns, Format Patterns, Process Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Form Patterns, Validation, Phase Transition Animations]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/core-user-experience.md#Experience Principles]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/user-journey-flows.md#Solo Mode Flow]
- [Source: _bmad-output/implementation-artifacts/2-1-per-step-reflection-system.md#Dev Notes, Completion Notes, Code Review Fixes]
