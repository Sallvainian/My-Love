# Dev Notes

## What Already Exists (DO NOT RECREATE)

Story 1.1 and 1.2 created substantial infrastructure. These files **already exist**:

| File | Status | Notes |
|------|--------|-------|
| `src/stores/slices/scriptureReadingSlice.ts` | EXISTS | Has `advanceStep`, `saveAndExit`, `createSession`, `loadSession`, `exitSession` |
| `src/services/scriptureReadingService.ts` (857 lines) | EXISTS | Full CRUD, cache-first reads, write-through, error recovery |
| `src/data/scriptureSteps.ts` | EXISTS | 17 steps, MAX_STEPS=17, verse/response data |
| `src/services/dbSchema.ts` | EXISTS | DB_VERSION=5, all scripture stores |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | EXISTS | Already has session routing to SoloReadingFlow |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | EXISTS | **ALREADY IMPLEMENTED** — full reading flow component |
| `src/components/scripture-reading/index.ts` | EXISTS | Barrel exports ScriptureOverview + SoloReadingFlow |
| `tests/e2e/scripture/scripture-solo-reading.spec.ts` | EXISTS | E2E test specs (P0-009, P1-001, P1-010, P1-011, P1-012, P2-012) |
| `tests/unit/stores/scriptureReadingSlice.test.ts` | EXISTS | Slice tests including advanceStep + saveAndExit |
| `src/validation/schemas.ts` | EXISTS | Centralized Zod schemas |

## ⚠️ CRITICAL: Implementation Status Assessment

**Story 1.3 implementation appears substantially complete.** The SoloReadingFlow component (290+ lines), slice actions (`advanceStep`, `saveAndExit`), and ScriptureOverview routing are already in the codebase. The dev agent's primary task is to:

1. **Verify** all ACs are met by the existing implementation
2. **Add missing unit tests** for `SoloReadingFlow.tsx` (no unit test file exists yet at `tests/unit/components/scripture-reading/SoloReadingFlow.test.tsx` or `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`)
3. **Fix any gaps** between the ACs and the current implementation
4. **Run E2E tests** to validate the flow end-to-end
5. **Validate** TypeScript compiles clean (`tsc --noEmit`)

## Existing SoloReadingFlow.tsx Implementation Analysis

The current component implements:

| AC | Implementation | Status | Gap |
|----|---------------|--------|-----|
| #1 Session start | ScriptureOverview routes to SoloReadingFlow when `session.status === 'in_progress' && session.mode === 'solo'` | ✅ Done | None — session creation in Story 1.2 |
| #2 Verse screen | Verse ref (`text-sm font-medium text-purple-500`), verse text (`font-serif text-xl` in glass card), progress ("Verse X of 17"), View Response + Next Verse buttons | ✅ Done | Verify font sizes match AC spec (Inter 500 12px, Playfair 400 20px) |
| #3 Response screen | Response text (`text-base text-purple-800`), Back to Verse + Next Verse, crossfade 200ms, `useReducedMotion()` | ✅ Done | None |
| #4 Step advancement | `advanceStep()` increments step, slide-left 300ms, progress updates | ✅ Done | None |
| #5 Session completion | On last step → phase='reflection', status='complete', placeholder screen with "Return to Overview" | ✅ Done | None |
| #6 Exit with save | X button → dialog "Save your progress?" with Save & Exit / Cancel, calls `saveAndExit()` | ✅ Done | None |

## What Actually Needs Work

1. **Unit tests for SoloReadingFlow.tsx** — NO unit test file exists. Must create comprehensive tests.
2. **E2E test alignment** — E2E specs exist but may use different `data-testid` values than component. Verify:
   - E2E uses `scripture-verse-reference` but component uses `verse-reference`
   - E2E uses `scripture-next-verse-button` but component uses `next-verse-button`
   - E2E uses `scripture-progress-indicator` but component uses `progress-indicator`
   - E2E uses `scripture-completion-screen` but component uses `reading-complete`
   - **Either update E2E specs OR update component testids for consistency**
3. **Completion screen** — E2E expects `scripture-completion-screen`, component has `reading-complete`. Fix mismatch.
4. **Slice tests** — advanceStep and saveAndExit tests exist but may need expansion for edge cases.

## data-testid Mismatch Analysis

| E2E Spec TestID | Component TestID | Action Needed |
|-----------------|-----------------|---------------|
| `scripture-verse-reference` | `verse-reference` | **FIX** — align to one convention |
| `scripture-verse-text` | `verse-text` | **FIX** |
| `scripture-progress-indicator` | `progress-indicator` | **FIX** |
| `scripture-view-response-button` | `view-response-button` | **FIX** |
| `scripture-next-verse-button` | `next-verse-button` | **FIX** |
| `scripture-response-text` | `response-text` | **FIX** |
| `scripture-back-to-verse-button` | `back-to-verse-button` | **FIX** |
| `scripture-completion-screen` | `reading-complete` | **FIX** |
| `scripture-start-button` | `start-button` | **FIX** (in ScriptureOverview) |
| `scripture-mode-solo` | Solo ModeCard (no testid) | **FIX** — add testid to Solo mode card |

**Recommendation:** Update the component `data-testid` values to match E2E specs (prefix with `scripture-`). This is the safer option since E2E specs were reviewed/written first and components should conform.

## Architecture Compliance

**MANDATORY patterns — follow exactly:**

- **Container/Presentational pattern:** SoloReadingFlow is the container — connects to Zustand. Any sub-components (if extracted) are presentational (props only).
  - [Source: architecture/implementation-patterns-consistency-rules.md#Process Patterns]

- **Zustand selector pattern:** Use object selector, never bare `useAppStore()`.
  ```typescript
  const { session, isSyncing, scriptureError, advanceStep, saveAndExit } = useAppStore(
    (state) => ({
      session: state.session,
      isSyncing: state.isSyncing,
      scriptureError: state.scriptureError,
      advanceStep: state.advanceStep,
      saveAndExit: state.saveAndExit,
    })
  );
  ```
  - [Source: docs/project-context.md#Framework-Specific Rules]

- **Error handling:** Use `ScriptureErrorCode` enum + `handleScriptureError()`. Errors surfaced via `scriptureError` from slice.
  - [Source: architecture/implementation-patterns-consistency-rules.md#Format Patterns]

- **No React Router:** ScriptureOverview conditionally renders SoloReadingFlow based on `session` state. No routing library involved.
  - [Source: docs/project-context.md#Critical Implementation Rules]

- **Reduced Motion:** Use `useReducedMotion()` from Framer Motion. All animations get duration: 0 when reduced motion is enabled.
  - [Source: architecture/core-architectural-decisions.md#Decision 5: Component Architecture]

- **No `any`:** Use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`.

- **Pure client SPA:** No `"use client"` or `"use server"` directives.

## Lavender Dreams Theme Tokens

```typescript
const scriptureTheme = {
  primary: '#A855F7',     // Purple-500
  background: '#F3E5F5',  // Light lavender
  surface: '#FAF5FF',     // Very light purple
};
```

## Animation Specifications

| Transition | Duration | Type | Reduced Motion |
|------------|----------|------|----------------|
| Verse ↔ Response | 200ms | Crossfade (opacity) | Instant (0ms) |
| Step → Step | 300ms | Slide-left + fade | Instant (0ms) |
| Exit dialog | 200ms | Crossfade + scale | Instant (0ms) |

Animation handled via Framer Motion `AnimatePresence` + `motion.div` with `useReducedMotion()` hook.

## Component Layout Structure

```
SoloReadingFlow
├── Header
│   ├── Exit button (X) — 44x44px touch target
│   ├── Progress indicator ("Verse X of 17") — aria-label
│   └── Section theme badge
├── Main Content (AnimatePresence)
│   ├── Verse Screen
│   │   ├── Verse reference (centered, muted purple)
│   │   └── Verse text (glass morphism card, serif font)
│   └── Response Screen
│       ├── Response verse reference (context)
│       └── Response prayer text (glass card)
├── Sync/Error indicators
└── Action Buttons (bottom-anchored)
    ├── Verse: "View Response" (secondary) + "Next Verse" (primary)
    └── Response: "Back to Verse" (secondary) + "Next Verse" (primary)

Exit Dialog (overlay)
├── "Save your progress?" title
├── "You can continue later." description
└── "Save & Exit" (primary) + "Cancel" (text)

Completion Screen
├── 🙏 emoji
├── "Reading Complete" heading
├── Completion message
├── Epic 2 placeholder note
└── "Return to Overview" button
```

## Button Styling Reference

**Primary (Next Verse, Save & Exit, Complete Reading, Return to Overview):**
```
w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl
font-semibold text-lg hover:from-purple-600 hover:to-purple-700
active:from-purple-700 active:to-purple-800 disabled:opacity-50
min-h-[56px] shadow-lg shadow-purple-500/25
```

**Secondary (View Response, Back to Verse):**
```
w-full py-3 px-4 bg-white/80 backdrop-blur-sm border border-purple-200/50
text-purple-700 rounded-xl font-medium hover:bg-purple-50/80
active:bg-purple-100/80 transition-colors min-h-[48px]
```

## Slice Actions (Already Implemented)

```typescript
// advanceStep: Optimistic step increment + server persist
advanceStep: async () => {
  // Normal: increment currentStepIndex, set isSyncing, persist via updateSession
  // Last step: set phase='reflection', status='complete', persist completion
  // Error: set scriptureError with SYNC_FAILED, clear isSyncing
}

// saveAndExit: Persist current state to server + clear session
saveAndExit: async () => {
  // Persist current step/phase/status to server
  // On success: clear all slice state (return to overview)
  // On error: set scriptureError, keep session state (don't lose progress)
}
```

## Cache/Persistence Pattern

```
Step Advance: Optimistic UI → update slice → server persist (background) → update cache on success
Save & Exit: Server persist → clear slice → cache updated by service
Session Load (resume): Cache first → return cached → fetch fresh → update cache
```

## Testing Strategy

**New unit test file needed:** `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`

**Mock strategy:**
```typescript
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

// Mock returns full scripture reading slice state
const mockState = {
  session: {
    id: 'session-1',
    mode: 'solo',
    currentPhase: 'reading',
    currentStepIndex: 0,
    status: 'in_progress',
    version: 1,
    userId: 'user-1',
    startedAt: new Date(),
  },
  isSyncing: false,
  scriptureError: null,
  advanceStep: vi.fn(),
  saveAndExit: vi.fn(),
  exitSession: vi.fn(),
};
```

**Test coverage targets:**
- All 6 ACs covered
- All button interactions
- Both sub-views (verse, response)
- Progress indicator text
- Exit dialog lifecycle
- Completion screen
- Error/syncing states
- Null session guard
- Routing from ScriptureOverview
- Reduced motion fallback (optional: mock `useReducedMotion`)

**Existing slice tests to verify/extend:**
- `tests/unit/stores/scriptureReadingSlice.test.ts` already has tests for `advanceStep` and `saveAndExit`
- Verify edge cases: last-step completion, server error during advance, save failure preserves session

## E2E Tests (Already Written — RED)

Tests in `tests/e2e/scripture/scripture-solo-reading.spec.ts`:
| Test ID | Description | Status |
|---------|-------------|--------|
| P0-009 | Advance through 17 steps sequentially | RED (testid mismatch) |
| P1-001 | Optimistic step advance | RED (testid mismatch) |
| P1-012 | Progress indicator updates | RED (testid mismatch) |
| P2-012 | Session completion boundary | RED (testid mismatch) |

These tests should pass once `data-testid` values are aligned.

## Technology Versions (Locked)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks only |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | Slice composition |
| Framer Motion | 12.27.1 | AnimatePresence, useReducedMotion |
| Vitest | 4.0.17 | Unit tests |
| Testing Library | 16.3.2 | Component tests |
| Tailwind CSS | 4.1.17 | Lavender theme |

## Project Structure Notes

- SoloReadingFlow lives in `src/components/scripture-reading/containers/` (container pattern)
- Tests go in `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` (co-located with component tests, matching ScriptureOverview pattern)
- No new sub-components directory needed unless SoloReadingFlow exceeds ~400 lines (currently ~290 lines)
- `src/components/scripture-reading/index.ts` already exports SoloReadingFlow

## Validation Gates (Before Marking Complete)

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Unit tests:** `npx vitest run` — all pass, zero regressions
3. **New test file:** SoloReadingFlow.test.tsx exists with ≥15 tests
4. **E2E alignment:** data-testid values match E2E specs OR E2E specs updated
5. **Visual check:** Manually verify Lavender Dreams theme renders correctly

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-solo-scripture-reading.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/prd.md#Solo Mode Flow — FR8, FR9, FR10, FR12, FR13]
- [Source: _bmad-output/planning-artifacts/prd.md#User Journeys — Journey 2 (Solo — The Quiet Reset), Journey 5 (Time-Constrained — The Partial Session)]
- [Source: _bmad-output/planning-artifacts/prd.md#Web App Specific Requirements — Performance, Accessibility, Offline]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 3: State Machine Design]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 4: Caching Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 5: Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Process Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Component Boundaries]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Phase Transition Animations]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Button Hierarchy]
- [Source: _bmad-output/implementation-artifacts/1-1-database-schema-and-backend-infrastructure.md — slice/service patterns]
- [Source: _bmad-output/implementation-artifacts/1-2-navigation-and-overview-page.md — routing, theme, test patterns]
- [Source: src/components/scripture-reading/containers/SoloReadingFlow.tsx — existing implementation]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx — routing logic]
- [Source: src/stores/slices/scriptureReadingSlice.ts — advanceStep, saveAndExit actions]
- [Source: src/data/scriptureSteps.ts — SCRIPTURE_STEPS, MAX_STEPS]
- [Source: tests/e2e/scripture/scripture-solo-reading.spec.ts — E2E test expectations]
