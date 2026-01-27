# Story 1.1: Navigation Entry Point

Status: review

## Story

As a **user**,
I want **to access Scripture Reading from the bottom navigation**,
So that **I can easily find and start the feature from anywhere in the app**.

## Acceptance Criteria

1. **Given** the user is authenticated and on any screen with bottom navigation
   **When** they tap the Scripture Reading icon
   **Then** the app navigates to the Scripture Reading overview screen
   **And** the bottom nav highlights the Scripture icon as active

2. **Given** the user has a linked partner
   **When** they view the Scripture Reading entry point
   **Then** Together mode is available (no partner-related messaging shown)

3. **Given** the user has no linked partner
   **When** they view the Scripture Reading entry point
   **Then** they see "Link your partner to do this together" message
   **And** Solo mode remains accessible

4. **Given** the user has no linked partner
   **When** they tap the "Link your partner" message (FR49)
   **Then** the app navigates to the partner setup flow (existing ViewType)

5. **Given** the partner link status is loading
   **When** the user views the Scripture Reading entry point
   **Then** they see a skeleton/loading state for the partner status area

6. **Given** the partner link check fails (network error)
   **When** the user views the Scripture Reading entry point
   **Then** they see a neutral offline indicator
   **And** Solo mode remains accessible

## Tasks / Subtasks

- [x] Task 1: Extend ViewType and Navigation Slice (AC: #1)
  - [x] 1.1: Add `'scripture'` to `ViewType` enum in `src/stores/slices/navigationSlice.ts`
  - [x] 1.2: Add navigation action for scripture view
  - [x] 1.3: Verify TypeScript compilation succeeds

- [x] Task 2: Update BottomNavigation Component (AC: #1)
  - [x] 2.1: Import or create Scripture icon (Lavender Dreams themed)
  - [x] 2.2: Add Scripture tab to BottomNavigation component
  - [x] 2.3: Implement active state styling for Scripture tab
  - [x] 2.4: Ensure touch target minimum 48x48px per UX spec

- [x] Task 3: Create ScriptureOverview Container Component (AC: #1, #2, #3, #4, #5, #6)
  - [x] 3.1: Create `src/components/scripture-reading/containers/ScriptureOverview.tsx`
  - [x] 3.2: Wire up partner status detection using existing partner state
  - [x] 3.3: Implement mode selection cards (Solo always accessible, Together conditional)
  - [x] 3.4: Add "Link your partner to do this together" messaging for unlinked users
  - [x] 3.5: Add navigation to partner setup flow on link message tap

- [x] Task 4: Implement Loading and Error States (AC: #5, #6)
  - [x] 4.1: Create skeleton loading state for partner status area
  - [x] 4.2: Implement offline/error indicator (neutral, non-shame language)
  - [x] 4.3: Ensure Solo mode remains accessible during loading/error states

- [x] Task 5: Apply Lavender Dreams Design Tokens (AC: all visual)
  - [x] 5.1: Define/use Lavender Dreams tokens: `#A855F7` primary, `#F3E5F5` background
  - [x] 5.2: Apply consistent styling across ScriptureOverview
  - [x] 5.3: Ensure visual consistency with existing app design patterns

- [x] Task 6: Wire Up App Routing (AC: #1)
  - [x] 6.1: Update `src/App.tsx` to render ScriptureOverview when ViewType is 'scripture'
  - [x] 6.2: Verify navigation works from any screen with bottom nav

- [x] Task 7: Create Barrel Export (housekeeping)
  - [x] 7.1: Create `src/components/scripture-reading/index.ts` with exports
  - [x] 7.2: Ensure import paths follow project conventions

- [x] Task 8: Write Unit Tests
  - [x] 8.1: Test BottomNavigation renders Scripture tab
  - [x] 8.2: Test ScriptureOverview shows correct state for linked partner
  - [x] 8.3: Test ScriptureOverview shows correct state for unlinked partner
  - [x] 8.4: Test loading skeleton state
  - [x] 8.5: Test error/offline state

## Dev Notes

### Architecture Compliance

**Brownfield Integration:**
- This is the first story in the Scripture Reading feature for the existing My-Love PWA
- MUST follow existing navigation patterns via `navigationSlice` (no React Router)
- MUST use Zustand selector pattern for state access

**Component Pattern:**
- Use container/presentational split per architecture doc
- Container: connects to Zustand slice, passes props to presentational
- Presentational: receives props only, no direct store access

**Technology Stack (Locked):**
- React 19 + TypeScript 5.9 (strict)
- Zustand 5.0 (slice composition)
- Tailwind CSS 4.1
- Framer Motion 12.27 (respect `prefers-reduced-motion`)

### Technical Requirements

**ViewType Extension:**
```typescript
// In src/stores/slices/navigationSlice.ts
type ViewType = 'messages' | 'photo' | 'mood' | 'notes' | 'scripture' | 'settings' | 'partner-setup' | ...;
```

**Partner Status Detection:**
- Use existing partner state from `partnerSlice` or wherever partner linking is tracked
- Access via Zustand selector: `useAppStore(s => s.partner?.isLinked)`
- Handle three states: loading, linked, unlinked

**Design Tokens (Lavender Dreams):**
```typescript
// Purple theme for Scripture Reading screens
const scriptureTheme = {
  primary: '#A855F7',      // Purple-500
  background: '#F3E5F5',   // Light lavender
  surface: '#FAF5FF',      // Very light purple
};
```

### File Structure Requirements

**New Files to Create:**
```
src/components/scripture-reading/
├── containers/
│   └── ScriptureOverview.tsx
└── index.ts

tests/unit/components/scripture-reading/
└── ScriptureOverview.test.tsx
```

**Files to Modify:**
```
src/stores/slices/navigationSlice.ts  - Add 'scripture' to ViewType
src/components/Navigation/BottomNavigation.tsx  - Add Scripture tab
src/App.tsx  - Add scripture view routing
```

### Testing Requirements

**Unit Tests Required:**
- BottomNavigation renders Scripture tab with correct icon
- ScriptureOverview shows partner-linked state correctly
- ScriptureOverview shows partner-unlinked state with link message
- Loading skeleton renders during partner status check
- Error state shows neutral offline indicator
- Navigation to partner-setup works when link message tapped

**Test Patterns:**
```typescript
// Mock Zustand store for tests
vi.mock('@/stores/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    partner: { isLinked: false },
    // ...
  })),
}));
```

### Project Structure Notes

**Alignment with Unified Project Structure:**
- Component folder: `src/components/scripture-reading/` (kebab-case folder, PascalCase files)
- Container folder: `src/components/scripture-reading/containers/`
- Tests mirror src: `tests/unit/components/scripture-reading/`
- Barrel export at `index.ts` following existing feature patterns

**Import Conventions:**
- Use relative imports (no path aliases configured)
- Import from barrel where available

### Previous Story Intelligence

N/A - This is the first story in Epic 1.

### Git Intelligence Summary

**Recent Commit Patterns:**
- Conventional commits used: `feat:`, `fix:`, `chore:`, `refactor:`
- Testing setup recently completed (dotenvx CI, Playwright config)
- No Scripture Reading code exists yet - this is greenfield within brownfield

**Files Recently Modified:**
- CI workflows standardized
- ESLint config updated
- No relevant component patterns from recent commits (infrastructure focus)

### Latest Tech Information

**React 19 Considerations:**
- Hooks only, no class components
- No `"use client"` or `"use server"` directives (pure client SPA)

**Tailwind CSS 4.1:**
- Use existing utility classes
- Define custom colors via CSS variables or Tailwind config if needed

**Framer Motion 12.27:**
- Use `useReducedMotion` hook when implementing any animations later
- For this story, minimal animation needed (basic view transitions)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Navigation Entry Point]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns]
- [Source: docs/project-context.md#Technology Stack & Versions]
- [Source: docs/project-context.md#Framework-Specific Rules]
- [Source: docs/project-context.md#Critical Implementation Rules]

### Critical Guardrails

1. **NO `any` types** - Use `unknown`, generics, `Record<string, unknown>`, or `z.infer<>`
2. **NO React Router** - Use `navigationSlice` for all navigation
3. **Zustand selector pattern required** - Never `useAppStore()` without selector
4. **Touch targets minimum 48x48px** - Per UX accessibility spec
5. **Validate external data with Zod** at boundaries (if any API calls needed)
6. **Offline-first mindset** - Partner status should degrade gracefully
7. **No blocking UI on network** - Show loading states, never freeze

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All tests pass (26 new tests, 187 total)
- TypeScript compilation succeeds with no errors

### Completion Notes List

- Added `'scripture'` to ViewType enum and navigation slice
- Added `navigateScripture()` convenience action
- Added `/scripture` path mapping for browser history
- Created ScriptureOverview container component with:
  - Partner status detection (loading/linked/unlinked/error states)
  - Mode selection cards (Solo always accessible, Together conditional)
  - "Link your partner" messaging for unlinked users
  - Lavender Dreams design tokens (#A855F7 primary, #F3E5F5 background)
  - Skeleton loading state
  - Offline indicator (neutral, non-shame language)
- Added Scripture tab to BottomNavigation with purple active state
- Wired up routing in App.tsx with lazy loading
- Created barrel export at scripture-reading/index.ts
- Created comprehensive unit tests (26 tests covering all ACs)

### File List

**New Files:**
- src/components/scripture-reading/containers/ScriptureOverview.tsx
- src/components/scripture-reading/index.ts
- src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx
- src/components/Navigation/__tests__/BottomNavigation.test.tsx

**Modified Files:**
- src/stores/slices/navigationSlice.ts (added 'scripture' ViewType)
- src/components/Navigation/BottomNavigation.tsx (added Scripture tab)
- src/App.tsx (added scripture routing)

### Change Log

- 2026-01-27: Story 1.1 implemented - Navigation Entry Point for Scripture Reading feature

