# Story 3.1: Couple-Aggregate Stats Dashboard

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see my Scripture Reading journey stats on the overview page,
So that I can see our progress without gamification pressure.

## Acceptance Criteria

1. **Given** the user navigates to the Scripture Reading overview page **When** the stats section renders **Then** the following couple-aggregate metrics are displayed:
   - Total sessions completed (count of sessions with status='complete' for the couple)
   - Total steps completed (sum of completed steps across all sessions)
   - Last session completion date (most recent completed_at)
   - Average reflection rating (mean of all ratings across both partners)
   - Bookmark count (total bookmarks across both partners)

2. **Given** the user has no completed sessions **When** the stats section renders **Then** stats show zeros or dashes gracefully (no error states) **And** a gentle message encourages starting: "Begin your first reading"

3. **Given** the stats are being loaded **When** the page first renders **Then** skeleton loading states are shown for each stat card **And** stats load within NFR-P3 target (<2s on 3G) **And** cached stats from localStorage (Zustand persist) are shown immediately, then updated from server

4. **Given** the user's partner has also completed sessions **When** stats aggregate **Then** the metrics reflect both partners' data (couple-level, not individual) **And** the queries use session-based access (RLS enforced via SECURITY DEFINER RPC)

5. **Given** the stats are displayed **When** the user views the overview **Then** stats use the Lavender Dreams glass morphism card styling **And** the layout is single-column on mobile, max-w-md centered on md+ **And** no gamification language is used (no streaks, no "keep it up!" pressure)

## Tasks / Subtasks

- [x] Task 1: Create `scripture_get_couple_stats` RPC (AC: #1, #4)
  - [x] 1.1 Create migration file with SECURITY DEFINER RPC function
  - [x] 1.2 RPC returns JSONB with: totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount
  - [x] 1.3 RPC validates session membership via `auth.uid()` checks (not RLS — DEFINER bypasses)
  - [x] 1.4 Add index on `scripture_sessions(status)` for efficient filtered counts
  - [x] 1.5 Grant execute permission to `authenticated` role
  - [x] 1.6 Set `search_path = ''` and use fully qualified table names (per create-db-functions convention)
- [x] Task 2: Add stats service method (AC: #1, #3)
  - [x] 2.1 Add `getCoupleStats()` method to `scriptureReadingService.ts`
  - [x] 2.2 Calls `supabase.rpc('scripture_get_couple_stats')` — returns typed `CoupleStats` object
  - [x] 2.3 Add Zod validation schema for RPC response in `supabaseSchemas.ts`
  - [x] 2.4 On failure: return `null` (read operation per error handling convention)
- [x] Task 3: Add stats state to Zustand slice (AC: #3)
  - [x] 3.1 Add `coupleStats: CoupleStats | null` and `isStatsLoading: boolean` to `ScriptureSlice`
  - [x] 3.2 Add `loadCoupleStats()` action — calls service, updates state
  - [x] 3.3 Add `CoupleStats` type to `src/stores/types.ts` (store types centralized per convention)
  - [x] 3.4 Zustand persist automatically caches stats to localStorage — on hydration, stale stats shown immediately
- [x] Task 4: Create `StatsSection` presentational component (AC: #1, #2, #5)
  - [x] 4.1 Create `src/components/scripture-reading/overview/StatsSection.tsx`
  - [x] 4.2 Receives `stats: CoupleStats | null`, `isLoading: boolean` via props
  - [x] 4.3 Skeleton loading cards while `isLoading && !stats`
  - [x] 4.4 Zero-state: dashes for metrics + "Begin your first reading" message when all zeros
  - [x] 4.5 Lavender Dreams glass morphism card styling (backdrop-blur, white/80%, rounded-2xl)
  - [x] 4.6 No gamification language — neutral stat labels only
  - [x] 4.7 Accessible: `aria-label` on stat values, semantic heading for section
- [x] Task 5: Integrate StatsSection into ScriptureOverview (AC: #1, #3, #5)
  - [x] 5.1 Connect `coupleStats` and `isStatsLoading` from slice to ScriptureOverview
  - [x] 5.2 Call `loadCoupleStats()` on mount (after partner loading)
  - [x] 5.3 Place `StatsSection` between header and partner status/resume prompt
  - [x] 5.4 Single-column layout, max-w-md centered
- [x] Task 6: Write pgTAP database tests (AC: #1, #4 — Test Design P0)
  - [x] 6.1 `3.1-DB-001`: RPC data isolation — user A must never see couple B's stats (E3-R01 mitigation)
  - [x] 6.2 `3.1-DB-002`: RPC returns correct aggregate metrics for known seed data (all 5 metrics independently)
  - [x] 6.3 `3.1-DB-003`: RPC returns zeros/nulls for couple with no sessions
- [x] Task 7: Write unit tests (AC: #1, #2, #3, #5)
  - [x] 7.1 `StatsSection.test.tsx` — skeleton loading, zero-state, populated state, stale-while-revalidate, no gamification language, accessibility
  - [x] 7.2 `scriptureReadingService` stats method test — RPC call, error handling, Zod validation
  - [x] 7.3 `scriptureReadingSlice` stats state test — loadCoupleStats flow, initial state
  - [x] 7.4 `ScriptureOverview` integration test — stats appear on overview page (mock updated)
- [x] Task 8: Write E2E tests (AC: #1, #2, #3)
  - [x] 8.1 `3.1-E2E-001`: Overview shows stats after completing a session
  - [x] 8.2 `3.1-E2E-002`: Overview shows zero-state when no completed sessions

## Dev Notes

### Test Design Document

**CRITICAL: A comprehensive test design exists for this story.** Read it before writing any tests.

- **Location:** `_bmad-output/test-artifacts/test-design-epic-3.md`
- **19 total test scenarios** across P0-P3 priorities
- **6 risks identified** — 1 high-priority (E3-R01: SECURITY DEFINER data isolation, score 6)
- **Quality gates:** P0 100% pass required, P1 >=95%, E3-R01 security test mandatory before merge

**Risk-driven test priorities:**

| Risk ID | Category | Score | Mitigation Test |
|---------|----------|-------|-----------------|
| E3-R01 | SEC | **6** | `3.1-DB-001` — pgTAP isolation: user A must never see couple B's stats |
| E3-R02 | DATA | 4 | `3.1-DB-002` — pgTAP: verify each metric independently with seed data |
| E3-R03 | PERF | 4 | `3.1-PERF-001` — RPC execution time <500ms |
| E3-R04 | BUS | 2 | Documented — stale cache acceptable for informational stats |
| E3-R05 | BUS | 2 | `3.1-UNIT-004` — zero-state rendering |
| E3-R06 | SEC | 3 | Documented — partner detection well-tested in Epics 1-2 |

**Entry criteria (before starting tests):**
- [x] `scripture_get_couple_stats` RPC migration applied locally
- [x] Local Supabase running (`supabase start`)
- [ ] Epic 1-2 E2E tests still passing (no regressions)

**Exit criteria (before merge):**
- [x] All P0 tests passing (100%)
- [x] All P1 tests passing (>=95%)
- [x] E3-R01 security test passes — no cross-couple data leak
- [ ] Coverage >= 80% for new code

### What Already Exists (DO NOT Recreate)

| Component/File | What It Does | Location |
|---|---|---|
| `ScriptureOverview.tsx` | Overview page with Start button, partner detection, resume prompt, mode selection | `src/components/scripture-reading/containers/ScriptureOverview.tsx` |
| `scriptureReadingService.ts` | IndexedDB + Supabase CRUD for sessions, reflections, bookmarks, messages | `src/services/scriptureReadingService.ts` |
| `scriptureReadingSlice.ts` | Zustand slice with session state management, phase transitions | `src/stores/slices/scriptureReadingSlice.ts` |
| `scripture_sessions` table | Session metadata with RLS | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `scripture_reflections` table | Per-step reflections with rating, notes, is_shared | Same migration |
| `scripture_bookmarks` table | Per-step bookmarks with share_with_partner | Same migration |
| `is_scripture_session_member()` | Helper function for RLS session membership check | Same migration |
| `ScriptureSession` type | `{ id, mode, userId, partnerId?, currentPhase, currentStepIndex, status, version, completedAt? }` | `src/services/dbSchema.ts` (line 32) |
| `scriptureTheme` design tokens | `{ primary: '#A855F7', background: '#F3E5F5', surface: '#FAF5FF' }` | `ScriptureOverview.tsx` (line 37) |
| `FOCUS_RING` constant | `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'` | `ScriptureOverview.tsx` (line 44) |
| `useMotionConfig` hook | Motion presets respecting `prefers-reduced-motion` | `src/hooks/useMotionConfig.ts` |
| `useNetworkStatus` hook | `{ isOnline }` for offline detection | `src/hooks/useNetworkStatus.ts` |
| `partnerSlice` | `partner: PartnerInfo \| null`, `isLoadingPartner`, `loadPartner()` | `src/stores/slices/partnerSlice.ts` |
| Zustand persist middleware | Auto-persists slice state to localStorage — survives page reloads | `src/stores/useAppStore.ts` |

### Architecture Constraints

**Data Model:**
- Scripture is **online-first** — Supabase RPC is source of truth, not IndexedDB
- Stats are aggregate queries that MUST run server-side (no client-side computation from partial IndexedDB cache)
- RPC uses `SECURITY DEFINER` because reflections/bookmarks RLS restricts visibility to own + shared partner data, but stats need ALL couple data regardless of sharing flags
- The RPC validates session membership via `auth.uid()` checks internally (since DEFINER bypasses RLS)

**State Management:**
- Types for `CoupleStats` go in `src/stores/types.ts` (store types centralized — NOT in slice file)
- `coupleStats` and `isStatsLoading` added to existing `ScriptureSlice` interface
- Zustand persist middleware automatically caches `coupleStats` to localStorage — on page reload, stale cached stats are shown immediately while fresh data loads from server
- `StatsSection` is a **presentational (dumb) component** — receives all data via props from `ScriptureOverview` container
- Use `useShallow` selector in `ScriptureOverview` for stats state
- Boolean loading flags (`isStatsLoading`) — do NOT use status enums

**Error Handling:**
- `getCoupleStats()` is a READ operation → returns `null` on failure (per project convention)
- No error toast for stats fetch failure — silently show cached data or zero-state
- If offline, show cached stats from Zustand persist without attempting RPC call
- Catch blocks must never be empty — catch → return null with logged warning

**Caching Strategy:**
- **Fast path:** Zustand persist hydrates from localStorage on mount → stale stats shown < 50ms
- **Fresh path:** `loadCoupleStats()` fires after mount → calls RPC → updates slice state → Zustand persist saves to localStorage for next visit
- No IndexedDB schema changes needed — stats cache lives in localStorage via Zustand persist
- Cache invalidation: stats refresh on every overview page mount (simple, sufficient for couple app usage pattern)

**Import Discipline:**
- DO NOT import `supabase` directly in components — use service layer via slice actions
- DO NOT import service modules directly in components
- All data flows: Component → Zustand slice action → Service → Supabase RPC

**RPC Implementation Requirements:**
- Function name: `scripture_get_couple_stats`
- `SECURITY DEFINER` with `set search_path = ''`
- Use fully qualified names (e.g., `public.scripture_sessions`)
- Return JSONB with camelCase keys matching TypeScript interface
- Grant execute to `authenticated` role
- Add comment on function purpose
- Reuse `is_scripture_session_member()` helper if applicable, or implement equivalent auth.uid() check

### UX / Design Requirements

**Stats Section Layout:**
- Placed between header ("Scripture Reading") and partner status/start area
- Section heading: "Your Journey" (centered, Inter 500, `text-purple-700`, `text-sm`)
- 5 stat cards in vertical stack (single-column mobile, same max-w-md container)
- Each card: glass morphism (`bg-white/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-4`)
- Stat value: large (`text-2xl font-semibold text-purple-900`)
- Stat label: small muted (`text-xs text-purple-500`)
- Icons: Lucide React icons per stat

**Stat Card Content:**

| Metric | Value Format | Label | Icon |
|---|---|---|---|
| Total Sessions | Integer (e.g., "12") | "Sessions Completed" | `BookOpen` |
| Total Steps | Integer (e.g., "204") | "Steps Completed" | `CheckCircle` |
| Last Session | Relative date (e.g., "3 days ago") | "Last Completed" | `Calendar` |
| Avg Rating | Decimal (e.g., "3.8") | "Average Rating" | `Star` |
| Bookmarks | Integer (e.g., "47") | "Bookmarks Saved" | `Bookmark` |

**Zero-State:**
- All metrics show "—" (em dash) instead of "0"
- Below cards: "Begin your first reading" (centered, `text-sm text-purple-400 italic`)
- No error states, no empty-state illustrations

**Skeleton Loading:**
- 5 skeleton cards matching stat card dimensions
- Animated pulse (`animate-pulse`) with purple-200 fill
- Stat value area: `h-8 w-16 bg-purple-200 rounded`
- Stat label area: `h-3 w-24 bg-purple-100 rounded`
- Show skeleton only when `isLoading=true && stats===null` (no cached data)
- If stale cached data exists, show it while refreshing — NO skeleton

**No Gamification Language:**
- Labels are neutral: "Sessions Completed" not "Sessions Crushed!"
- No streaks, no "keep it up!", no "you're on fire!", no progress percentages
- Tone: informational, calm, reflective

**Value Formatting:**

| Metric | Format | Notes |
|---|---|---|
| totalSessions | Integer: `"12"` | |
| totalSteps | Integer: `"204"` | |
| lastCompleted | Relative: `"3 days ago"` | Use `Intl.RelativeTimeFormat` or similar |
| avgRating | 1 decimal: `"3.8"` | `toFixed(1)` |
| bookmarkCount | Integer: `"47"` | |

### File Locations

| New File | Purpose |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_scripture_couple_stats.sql` | RPC + index for couple stats |
| `src/components/scripture-reading/overview/StatsSection.tsx` | Stats presentational component |
| `src/components/scripture-reading/__tests__/StatsSection.test.tsx` | Unit tests |
| `tests/e2e/scripture/scripture-stats.spec.ts` | E2E tests |
| `supabase/tests/database/scripture_couple_stats.test.sql` | pgTAP database tests (P0 security + correctness) |

| Modified File | Changes |
|---|---|
| `src/services/scriptureReadingService.ts` | Add `getCoupleStats()` method |
| `src/stores/slices/scriptureReadingSlice.ts` | Add `coupleStats`, `isStatsLoading`, `loadCoupleStats()` |
| `src/stores/types.ts` | Add `CoupleStats` interface |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | Integrate StatsSection, call loadCoupleStats on mount |
| `src/components/scripture-reading/index.ts` | Add barrel export for StatsSection |
| `src/api/validation/supabaseSchemas.ts` | Add `CoupleStatsSchema` Zod validation |

### Testing Requirements

**IMPORTANT: Follow the test design document** at `_bmad-output/test-artifacts/test-design-epic-3.md` for complete test specifications, priorities, and risk mitigations.

**pgTAP Database Tests (`supabase/tests/database/scripture_couple_stats.test.sql`):**
- `3.1-DB-001` (P0): RPC data isolation — create two couples with sessions, verify user A only sees couple A's stats, user B only sees couple B's stats. This is the **highest-priority security test** (E3-R01, score 6).
- `3.1-DB-002` (P0): RPC returns correct aggregate metrics for known seed data — verify totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount each independently
- `3.1-DB-003` (P2): RPC returns zeros/nulls for couple with no completed sessions

**Unit Tests (StatsSection.test.tsx) — `3.1-UNIT-001` through `3.1-UNIT-012`:**
- Renders 5 stat cards with correct values when stats provided
- Shows skeleton loading when `isLoading=true` and `stats=null`
- Shows cached stats (not skeleton) when `isLoading=true` but `stats` is non-null (stale-while-revalidate)
- Shows zero-state (em dashes + "Begin your first reading") when all values are zero
- Stat labels contain no gamification language
- Last completed date renders as relative time (e.g., "3 days ago")
- Average rating renders with 1 decimal place
- Glass morphism card classes present (backdrop-blur, white/80%)
- All stat values have `aria-label` attributes

**Unit Tests (service + slice) — `3.1-UNIT-005` through `3.1-UNIT-007`:**
- `getCoupleStats()` calls `supabase.rpc('scripture_get_couple_stats')` and returns typed object
- `getCoupleStats()` returns `null` on RPC failure
- `loadCoupleStats()` sets `isStatsLoading=true`, calls service, updates `coupleStats`, sets `isStatsLoading=false`
- Slice state initializes with `coupleStats: null`, `isStatsLoading: false`

**Integration Tests (ScriptureOverview):**
- Stats section appears on overview page
- Stats load on mount
- Skeleton shown while loading
- Stats update after server response

**E2E Tests (`tests/e2e/scripture/scripture-stats.spec.ts`) — `3.1-E2E-001`, `3.1-E2E-002`:**
- `3.1-E2E-001` (P0): Overview shows stats after completing a session (full user journey with seeded completed sessions)
- `3.1-E2E-002` (P1): Overview shows zero-state when no completed sessions

**P3 Tests (lower priority):**
- `3.1-PERF-001`: RPC execution time <500ms (performance baseline)
- `3.1-UNIT-013`: Zod schema validates RPC response shape

**Test IDs:**
- `scripture-stats-section` — root container
- `scripture-stats-skeleton` — skeleton loading container
- `scripture-stats-sessions` — sessions completed card
- `scripture-stats-steps` — steps completed card
- `scripture-stats-last-completed` — last completed card
- `scripture-stats-avg-rating` — average rating card
- `scripture-stats-bookmarks` — bookmarks card
- `scripture-stats-zero-state` — zero-state message ("Begin your first reading")

### Accessibility Checklist

- [x] Stats section has `aria-label="Scripture reading statistics"`
- [x] Each stat card value has descriptive `aria-label` (e.g., "12 sessions completed")
- [x] Skeleton loading state has `aria-busy="true"` on section
- [x] Zero-state message is readable by screen readers
- [x] No color-only information — icons accompany stat labels
- [x] Focus ring on any interactive elements (none expected in stats section)
- [x] All text meets WCAG AA contrast (4.5:1 for normal, 3:1 for large)

### Previous Story Intelligence (Epic 2)

**Learnings from Story 2.3 implementation:**
- Container/presentational pattern is well-established — `ScriptureOverview` is the container, `StatsSection` receives props
- `useShallow` selectors are mandatory for Zustand store access in components
- Non-blocking data fetching pattern: fire `loadCoupleStats()` on mount, don't block render
- Zustand persist hydration provides instant cached data — test with stale data + fresh fetch scenarios
- `handleScriptureError()` for error handling — but stats failures are silent (read operation, show cached or zero-state)
- Session completion is reliably implemented (status='complete', completedAt set) — stats RPC can depend on these fields
- Dancing Script font and `font-cursive` class already loaded — not needed for stats but confirms Tailwind config is reliable

**Code review fixes from previous stories (avoid same mistakes):**
- Do NOT import `supabase` directly in components — use service layer via slice actions
- Include all actions in `useShallow` selectors — don't use `getState()` for actions
- Always add `disabled` guard to submission handlers (not applicable to stats display, but pattern awareness)
- Document all modified files in the File List
- ESLint `set-state-in-effect` may trigger warnings for mount-time data loading — acceptable if legitimate

### Git Intelligence

Recent commits show patterns:
- Branch naming: `epic-3/stats-overview-dashboard` (already on this branch)
- Commit prefix convention: `feat(epic-3): implement Story 3.1 couple aggregate stats`
- Component files: PascalCase (`StatsSection.tsx`)
- Test files: `__tests__/` co-located with components
- Migrations: timestamped `YYYYMMDDHHmmss_description.sql`
- Previous story (2.3) completed with 184 unit tests passing, 6 E2E passing, 11 API tests passing
- Focus management pattern: `useRef` + `requestAnimationFrame` (not needed for stats display)
- `data-testid` attributes aligned with E2E test specs

### Cross-Story Context

- **Epic 1** (Foundation + Solo Reading) — provides: database tables, service layer, slice, overview page, IndexedDB schema
- **Epic 2** (Reflection + Daily Prayer Report) — provides: completed sessions with reflections and bookmarks, session completion logic (`status: 'complete'`, `completedAt`)
- **Story 3.1** (this story) — adds: aggregate stats dashboard to overview page
- The stats RPC depends on completed sessions existing (from Story 2.3 session completion flow)
- Phase transition chain: stories complete → stats aggregate → dashboard displays

### Project Structure Notes

- `StatsSection.tsx` goes in new `overview/` subfolder under `scripture-reading/` — separate from `reflection/` and `reading/` which handle session flow
- No new hooks needed — reuse `useNetworkStatus` for offline detection
- No new IndexedDB stores needed — stats cached via Zustand persist (localStorage)
- No DB schema version bump — RPC function only, no new tables
- Single new migration file for the RPC function + index
- pgTAP test file at `supabase/tests/database/scripture_couple_stats.test.sql`

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-3-stats-overview-dashboard.md#Story 3.1]
- [Source: _bmad-output/test-artifacts/test-design-epic-3.md] (full test design with risk assessment)
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 1, Decision 4, Decision 6]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Structure Patterns, Process Patterns]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Stats & Progress FR42-46]
- [Source: _bmad-output/planning-artifacts/prd/functional-requirements.md#Stats & Progress FR42-FR46]
- [Source: _bmad-output/planning-artifacts/prd/non-functional-requirements.md#NFR-P3 Initial Load]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/visual-design-foundation.md#Lavender Dreams Palette, Typography]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md#Components to Reuse, Glass Morphism]
- [Source: _bmad-output/implementation-artifacts/2-3-daily-prayer-report-send-and-view/dev-notes.md#Architecture Constraints, Previous Story Intelligence]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx]
- [Source: src/services/scriptureReadingService.ts]
- [Source: src/stores/slices/scriptureReadingSlice.ts]
- [Source: supabase/migrations/20260128000001_scripture_reading.sql]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- RPC uses `sum(current_step_index + 1)` for totalSteps instead of counting step_states rows — simpler and avoids dependency on step_states table being populated.
- avgRating uses `round(v_avg_rating, 2)` (2 decimal precision) to avoid floating-point tolerance issues in pgTAP tests.
- `loadCoupleStats` in the slice wraps service call in try/catch so `isStatsLoading` resets even on thrown errors.
- ScriptureOverview existing test suite needed `coupleStats`, `isStatsLoading`, `loadCoupleStats` added to mock store state — fixed.
- E2E tests use UI flow (`scriptureNav.completeAllSteps()`) instead of factory seeding for populated test to avoid user-matching issues between seed RPC and worker auth.
- pgTAP timestamp comparison uses `LIKE '2026-02-12T15:30:00%'` instead of exact match due to PostgreSQL timezone offset format differences.

### File List

**New Files:**
- `supabase/migrations/20260217150353_scripture_couple_stats.sql` — RPC + index
- `src/components/scripture-reading/overview/StatsSection.tsx` — Presentational stats component

**Modified Files:**
- `src/services/scriptureReadingService.ts` — Added `getCoupleStats()` method
- `src/stores/slices/scriptureReadingSlice.ts` — Added stats state, `loadCoupleStats()` action
- `src/stores/types.ts` — Added `CoupleStats` interface
- `src/api/validation/supabaseSchemas.ts` — Added `CoupleStatsSchema` Zod schema
- `src/components/scripture-reading/containers/ScriptureOverview.tsx` — Integrated StatsSection
- `src/components/scripture-reading/index.ts` — Added barrel export for StatsSection
- `src/types/database.types.ts` — Regenerated (includes new RPC)
- `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` — Added mock state for stats

**Test Files:**
- `supabase/tests/database/09_scripture_couple_stats.sql` — 11 pgTAP tests (DB-001, DB-002, DB-003)
- `src/components/scripture-reading/__tests__/StatsSection.test.tsx` — 25 unit tests (UNIT-001 through UNIT-012)
- `tests/unit/services/scriptureReadingService.stats.test.ts` — 9 unit tests (UNIT-005, UNIT-006, UNIT-013)
- `tests/unit/stores/scriptureReadingSlice.stats.test.ts` — 6 unit tests (UNIT-007)
- `tests/e2e/scripture/scripture-stats.spec.ts` — 2 E2E tests (E2E-001, E2E-002)
