# Dev Notes

## What Already Exists (DO NOT RECREATE)

Story 1.1 created substantial infrastructure that this story builds upon. These files **already exist and should be MODIFIED, not recreated**:

| File | Status | Notes |
|------|--------|-------|
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | EXISTS (229 lines) | Enhance with Start button, resume prompt, session creation wiring |
| `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` | EXISTS (45 tests) | Update/extend existing tests |
| `src/components/scripture-reading/index.ts` | EXISTS | Barrel export, no change needed |
| `src/stores/slices/navigationSlice.ts` | EXISTS | Already has `'scripture'` in ViewType |
| `src/stores/slices/scriptureReadingSlice.ts` | EXISTS | Has `createSession`, `loadSession`, `exitSession` actions |
| `src/components/Navigation/BottomNavigation.tsx` | EXISTS | Already has Scripture tab with `BookOpen` icon, purple-500 active color |
| `src/App.tsx` | EXISTS | Already lazy-loads ScriptureOverview for `scripture` view |

## Existing Component Anatomy (ScriptureOverview.tsx)

The current ScriptureOverview already has:
- **Design tokens:** `scriptureTheme` object with `primary`, `background`, `surface` colors
- **PartnerStatus type:** `'loading' | 'linked' | 'unlinked' | 'error'`
- **ModeCard component:** Reusable card with `primary`/`secondary` variants
- **PartnerLinkMessage component:** "Link your partner" button
- **PartnerStatusSkeleton component:** Loading state
- **OfflineIndicator component:** Error state
- **SoloIcon / TogetherIcon:** SVG icon components
- **Partner detection:** Uses `loadPartner()` on mount, determines partner status
- **Navigation handlers:** `handleStartSolo`, `handleStartTogether` (currently console.log stubs), `handleLinkPartner` (navigates to partner view)
- **Zustand integration:** Selects `partner`, `isLoadingPartner`, `loadPartner`, `setView`

## What Needs to Change

1. **Add "Start" button entry point:** Currently mode cards are always visible. Per AC#3, user should see a "Start" button first, then mode selection appears on tap. This is a UX flow change.

2. **Add scriptureReadingSlice integration:** Currently only uses partner slice. Need to also select `session`, `isLoading`, `createSession`, `loadSession`, `exitSession` from the scripture reading slice.

3. **Add resume prompt:** Check `session` state on mount. If an incomplete solo session exists (`session.status === 'in_progress'`), show resume prompt with current step info.

4. **Wire mode actions:** Replace console.log stubs with actual `createSession()` calls.

5. **Enhance visual theme:** Add glass morphism, purple gradients, and Playfair Display heading.

## Architecture Compliance

**MANDATORY patterns to follow:**

- **Container/Presentational pattern:** ScriptureOverview is the container — it connects to Zustand store. Any new presentational sub-components receive props only. Do NOT fetch data in presentational components.
  - [Source: docs/project-context.md#Component Architecture]

- **Zustand selector pattern:** Use selector destructuring, never `useAppStore()` without selector.
  ```typescript
  const { session, isLoading, createSession, loadSession, exitSession } = useAppStore(state => ({
    session: state.session,
    isLoading: state.isLoading,
    createSession: state.createSession,
    loadSession: state.loadSession,
    exitSession: state.exitSession,
  }));
  ```
  - [Source: docs/project-context.md#Framework-Specific Rules]

- **No React Router:** Navigation via `setView()` from navigationSlice only.
  - [Source: docs/project-context.md#Critical Implementation Rules]

- **No `any`:** Use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`.
  - [Source: docs/project-context.md#Language-Specific Rules]

- **Pure client SPA:** Never use `"use client"` or `"use server"`.
  - [Source: docs/project-context.md#Framework-Specific Rules]

- **Error handling:** Use `ScriptureErrorCode` enum + `handleScriptureError()` pattern. Surface errors via UI, don't swallow.
  - [Source: docs/project-context.md#Critical Implementation Rules]

- **Loading states:** Explicit boolean flags (`isLoading`, `isSyncing`). Never use status enums for simple loading.
  - [Source: docs/project-context.md#Scripture Reading Feature Architecture]

## UI/UX Requirements

**Lavender Dreams Theme (from UX spec):**
- Purple gradients, glass morphism cards
- Primary color: `#A855F7` (purple-500)
- Background: `#F3E5F5` (light lavender)
- Surface: `#FAF5FF` (very light purple)
- Existing Tailwind config has full `lavender` scale (50-900)

**Typography:**
- Main heading: `Playfair Display` (font-serif in Tailwind config)
- Body text: `Inter` (font-sans, default)
- Heading: `text-2xl font-bold text-purple-900`
- Subtitle: `text-purple-700`

**Button Hierarchy (from UX consistency patterns):**
| Tier | Purpose | Style |
|------|---------|-------|
| Primary | "Start", "Continue" | Full-width, Lavender gradient, 56px height |
| Secondary | Mode cards, navigation | Outlined, transparent |
| Tertiary | "Start fresh", dismiss | Text-only, muted |

**Glass Morphism Pattern (existing in app):**
```
bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl
```

**Mobile-First Layout:**
- `max-w-md mx-auto` for centered single-column
- Touch targets: minimum 48x48px with 8px spacing
- Bottom-anchored actions (thumb-friendly)
- `min-h-screen` for full viewport

**Phase Transition Animations:**
- Crossfade for mode selection reveal: 200ms
- Use Framer Motion (`AnimatePresence` + `motion.div`)
- Respect `prefers-reduced-motion` via `useMotionConfig` hook (Story 1.5 creates this; for now use inline check or Framer's `useReducedMotion`)
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md]

## Previous Story Intelligence

**From Story 1.1 (Database Schema & Backend Infrastructure):**

- **All backend infrastructure is complete:** 5 Supabase tables, RLS, RPCs (`scripture_create_session`, `scripture_submit_reflection`), IndexedDB stores, validation schemas, service layer, Zustand slice — all working and tested.
- **ScriptureReadingService** provides `createSession()`, `getSession()`, `getActiveSessions()` for IndexedDB cache + server calls.
- **scriptureReadingSlice** has `createSession(mode, partnerId?)` action that calls the service and Supabase RPC.
- **loadSession(sessionId)** loads a specific session from cache/server.
- **exitSession()** clears session from state (does NOT delete from server).
- **Static scripture data** in `src/data/scriptureSteps.ts`: `MAX_STEPS = 17`, all 17 steps with themes, verses, responses.
- **Test patterns established:** Use `vi.mock()` for Zustand store, `render()` + `screen` + `fireEvent` from Testing Library, `waitFor` for async.
- **45 existing tests** in ScriptureOverview.test.tsx cover: partner states, mode cards, navigation, loading states, error states.
- **Key learning:** Sprint 0 laid heavy infrastructure. Story 1.1 found and fixed a seed RPC bug (variable reuse in RETURNING clauses). All 240 tests pass with zero regressions.

**Git Intelligence (Recent Commits):**
- `b353aa5` — Centralized validation schemas (moved from service inline to `src/validation/schemas.ts`)
- `eecacdc` — Added scripture reading slice, service, migration, and test infrastructure
- Pattern: conventional commits (`feat:`, `refactor:`, `chore:`), descriptive messages

## Session Detection for Resume Prompt

To implement AC#6 (resume prompt), the container needs to:

1. On mount, call `scriptureReadingService.getActiveSessions()` or check the slice `session` state
2. If an incomplete solo session exists (`status === 'in_progress'`, `mode === 'solo'`):
   - Display resume prompt with `currentStepIndex + 1` of `MAX_STEPS` (17)
   - "Continue" calls `loadSession(session.id)`
   - "Start fresh" calls `exitSession()` then allows new session creation
3. If no incomplete session, show normal Start flow

**Implementation approach:** Add a `useEffect` on mount that checks for active sessions via the slice or service. Store the found session in local component state or extend the slice selection.

## File Structure Notes

All changes are within existing directories:
- `src/components/scripture-reading/containers/ScriptureOverview.tsx` — primary edit target
- `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` — test update target
- No new files needed for this story (unless extracting sub-components from ScriptureOverview, which is optional)

Optional: If ScriptureOverview grows beyond ~300 lines, extract presentational components into:
- `src/components/scripture-reading/ResumePrompt.tsx`
- `src/components/scripture-reading/StartButton.tsx`
These would be presentational (props only, no store access).

## Technology Versions (Locked from Story 1.1)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks only, no class components |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | Slice composition, selector pattern |
| Tailwind CSS | 4.1.17 | Lavender theme configured |
| Framer Motion | 12.27.1 | AnimatePresence, useReducedMotion |
| Vitest | 4.0.17 | Unit tests |
| Testing Library | 16.3.2 | Component tests |
| Lucide React | (installed) | BookOpen icon for nav tab |

## Testing Strategy

**Existing tests to preserve (45 tests in ScriptureOverview.test.tsx):**
- Partner status states (loading, linked, unlinked, error)
- Mode card rendering and interaction
- Navigation to partner setup
- Accessibility (aria labels, test IDs)

**New tests to add:**
- Start button renders and triggers mode selection reveal
- Mode selection hidden initially, shown after Start tap
- Resume prompt renders when incomplete session exists
- Resume prompt hidden when no incomplete session
- "Continue" action calls `loadSession` with correct session ID
- "Start fresh" action calls `exitSession`
- Solo mode card calls `createSession('solo')`
- Together mode card calls `createSession('together', partnerId)`
- Loading state shown during session creation
- Error state displayed on session creation failure
- Glass morphism / Lavender Dreams visual elements render correctly

**Mock strategy:**
```typescript
vi.mock('../../../stores/useAppStore', () => ({
  useAppStore: vi.fn(),
}));
// Mock returns include both partner and scripture reading slice state
```

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-solo-scripture-reading.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements — FR1, FR1a, FR2, FR3, FR4, FR6]
- [Source: _bmad-output/planning-artifacts/prd.md#User Journeys — Journey 2 (Solo), Journey 4 (Unlinked), Journey 5 (Partial Session)]
- [Source: docs/project-context.md#Critical Implementation Rules]
- [Source: docs/project-context.md#Scripture Reading Feature Architecture]
- [Source: docs/project-context.md#Framework-Specific Rules]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Button Hierarchy]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Phase Transition Animations]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-validation-results.md#Implementation Readiness]
- [Source: _bmad-output/implementation-artifacts/1-1-database-schema-and-backend-infrastructure.md#Dev Notes]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx — existing 229-line component]
- [Source: src/stores/slices/scriptureReadingSlice.ts — session management actions]
- [Source: src/stores/slices/navigationSlice.ts — ViewType with 'scripture']
