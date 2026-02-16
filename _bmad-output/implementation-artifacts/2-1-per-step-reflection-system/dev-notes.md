# Dev Notes

## What Already Exists (DO NOT Recreate)

The following are already implemented from Epic 1. **Extend, don't duplicate:**

| Component/File | What It Does | Location |
|---|---|---|
| `scriptureReadingService.addReflection()` | Writes reflection to Supabase + IndexedDB cache | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.toggleBookmark()` | Toggles bookmark in Supabase + IndexedDB cache | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.addBookmark()` | Creates bookmark server-side | `src/services/scriptureReadingService.ts` |
| `scriptureReadingService.getBookmarksBySession()` | Reads bookmarks (cache-first) | `src/services/scriptureReadingService.ts` |
| `scripture_submit_reflection` RPC | Server-side upsert with `ON CONFLICT DO UPDATE` | `supabase/migrations/20260130000001_scripture_rpcs.sql` |
| `scripture_reflections` table | DB table with unique constraint `(session_id, step_index, user_id)` | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `scripture_bookmarks` table | DB table with unique constraint `(session_id, step_index, user_id)` | `supabase/migrations/20260128000001_scripture_reading.sql` |
| `ScriptureReflection` type | TypeScript interface (id, sessionId, stepIndex, userId, rating, notes, isShared) | `src/services/dbSchema.ts` |
| `ScriptureBookmark` type | TypeScript interface (id, sessionId, stepIndex, userId, shareWithPartner) | `src/services/dbSchema.ts` |
| `SupabaseReflectionSchema` | Zod validation for RPC responses | `src/validation/schemas.ts` |
| `SupabaseBookmarkSchema` | Zod validation for RPC responses | `src/validation/schemas.ts` |
| `SoloReadingFlow.tsx` | Reading container with verse/response subviews, step navigation | `src/components/scripture-reading/SoloReadingFlow.tsx` |
| `scriptureReadingSlice` | Zustand slice with session state, `advanceStep()`, optimistic UI, retry queue | `src/stores/slices/scriptureReadingSlice.ts` |
| `useMotionConfig` hook | Provides crossfade, slide transitions respecting `prefers-reduced-motion` | `src/hooks/useMotionConfig.ts` |
| `useAutoSave` hook | Saves on visibility change / beforeunload | Used in `SoloReadingFlow.tsx` |
| `SyncToast` | Success/failure toast component | `src/components/shared/SyncToast` |
| `NetworkStatusIndicator` | Offline/connecting banner | `src/components/shared/NetworkStatusIndicator` |
| RLS policies | Session-based access isolation for all `scripture_*` tables | Migration files |
| IndexedDB stores | `scriptureReflections`, `scriptureBookmarks` stores in schema v5 | `src/services/dbSchema.ts` |

## Architecture Constraints

**State Management:**
- Types co-located with `scriptureReadingSlice.ts` — do NOT create separate type files
- Use explicit boolean flags for loading: `isPendingReflection` (already exists in slice)
- Optimistic UI: toggle bookmark icon immediately, write server in background
- Retry queue: existing `retryFailedWrite()` pattern with max 3 attempts, exponential backoff

**Component Pattern:**
- Presentational (dumb) components receive data via props + callbacks
- Container components connect to Zustand slice
- `PerStepReflection` should be a presentational component; flow integration happens in `SoloReadingFlow`

**Data Flow:**
- Reads: IndexedDB cache first → fetch fresh from server → update cache
- Writes: POST to server → on success, update IndexedDB → on failure, show retry UI
- Bookmarks: write-through pattern (same as existing mood service pattern)
- Reflections: write-through with upsert semantics (idempotent)

**Error Handling:**
- Use existing `ScriptureErrorCode` enum from `scriptureReadingService.ts`
- Write failures: non-blocking toast via `SyncToast`, never block session advancement
- Network offline: queue write, retry when connectivity returns

## UX / Design Requirements

**BookmarkFlag:**
- Icon: Lucide `Bookmark` (outlined) / filled variant when active
- Color: Amber fill when bookmarked (`text-amber-400 fill-amber-400`), outlined muted when not
- Position: On verse screen, near verse text (top-right of verse card or inline)
- No confirmation dialog — instant toggle
- Debounce rapid toggles: 300ms, last-write-wins with server reconciliation

**Rating Scale:**
- 5 numbered circles (1–5) in a horizontal row
- End labels: "A little" (left) and "A lot" (right)
- Selected state: filled purple/lavender background, white text
- Unselected state: outlined, muted text
- Use existing card/glass styling (`.card` pattern: `rounded-3xl`, backdrop blur)
- Each circle: min 48x48px touch target, 8px spacing between

**Note Textarea:**
- Uses existing `.input` class pattern (soft blurred field)
- `min-h-[80px]`, `resize-none`, auto-grow to ~4 lines max
- Character counter: appears at 200+ chars, muted style, positioned below textarea right-aligned
- `enterKeyHint="done"` for mobile keyboard hint
- Placeholder: "Add a note (optional)"

**Transitions:**
- Verse/Response → Reflection: fade-through-white (400ms) using `crossfade` from `useMotionConfig`
- Reflection → Next Verse: slide-left using `slideVariants` from `useMotionConfig`
- All transitions: instant swap when `prefers-reduced-motion` enabled
- Focus moves to reflection heading on transition

**Validation:**
- Quiet validation only — no red, no aggressive indicators
- "Please select a rating" appears as helper text below rating group (muted, `text-sm`)
- Continue button stays `disabled` (reduced opacity, `cursor-not-allowed`) until rating selected
- Note is optional — never validated beyond character limit

## File Locations

| New File | Purpose |
|---|---|
| `src/components/scripture-reading/reading/BookmarkFlag.tsx` | Bookmark toggle icon component |
| `src/components/scripture-reading/reflection/PerStepReflection.tsx` | Rating + note form component |

| Modified File | Changes |
|---|---|
| `src/components/scripture-reading/SoloReadingFlow.tsx` | Add reflection subview, bookmark to verse screen, modify step advancement flow |
| `src/components/scripture-reading/index.ts` | Export new components |

## Testing Requirements

**Unit Tests:**
- `BookmarkFlag.tsx`: renders, toggles state, correct aria-labels, debounce
- `PerStepReflection.tsx`: renders rating scale, validation, character counter, keyboard nav

**Integration Tests:**
- Full flow: verse → bookmark toggle → next verse → reflection → continue → next verse
- Rating validation prevents advancement without selection
- Reflection data persists (mock service layer)

**Test IDs (from test design):**
- `2.1-E2E-001`: Submit per-step reflection with rating and note — data persists
- `2.1-E2E-002`: Bookmark toggle persists to server
- `2.1-E2E-003`: Rating validation — Continue disabled until rating selected
- `2.1-E2E-004`: Reflection write failure shows retry UI
- `2.1-UNIT-001`: Bookmark toggle debounce

**Test file locations:**
- `src/components/scripture-reading/__tests__/BookmarkFlag.test.tsx`
- `src/components/scripture-reading/__tests__/PerStepReflection.test.tsx`

## Accessibility Checklist

- [x] BookmarkFlag: `aria-label` toggles between "Bookmark this verse" / "Remove bookmark"
- [x] BookmarkFlag: `aria-pressed` attribute reflects state
- [x] BookmarkFlag: 48x48px minimum touch target
- [x] Rating: `role="radiogroup"` with `aria-label="How meaningful was this for you today?"`
- [x] Rating buttons: `role="radio"`, `aria-checked`, `aria-label="Rating N of 5: [label]"`
- [x] Rating: keyboard arrow navigation within group
- [x] Note textarea: `aria-label="Optional reflection note"`
- [x] Character counter: `aria-live="polite"` when approaching/exceeding limit
- [x] Continue button: `aria-disabled` when no rating selected
- [x] Phase transition: focus moves to reflection heading
- [x] Phase transition: `aria-live="polite"` announces "Reflect on this verse"
- [x] All animations respect `prefers-reduced-motion` (uses useMotionConfig transitions)

## Git Intelligence (Epic 1 Patterns)

Recent commits show established patterns to follow:
- Component files use PascalCase: `SoloReadingFlow.tsx`, `ScriptureOverview.tsx`
- Focus management with `useRef` + `useEffect` for focus on mount/transition
- `AnimatePresence` with `mode="wait"` for view transitions
- `data-testid` attributes aligned with E2E test specs
- Existing focus ring constant: `'focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2'`
- Verse screen blockquote styling: serif font (`font-serif`), large text, prominent

## Cross-Story Context

- **Story 2.2** (End-of-Session Reflection Summary) depends on bookmarks collected during 2.1. Ensure bookmarks are properly cached in IndexedDB by session for retrieval.
- **Story 2.3** (Daily Prayer Report) depends on reflection data saved in 2.1. Ensure `is_shared` flag defaults to `false` per privacy-by-default principle.
- Step 17 completion should transition to a placeholder (not the current "coming soon" text) that Story 2.2 will replace.

## Project Structure Notes

- All new files align with architecture doc's component directory structure
- `BookmarkFlag.tsx` goes in `reading/` subfolder (per architecture Decision 5)
- `PerStepReflection.tsx` goes in `reflection/` subfolder (per architecture Decision 5)
- No new hooks needed — reuse `useMotionConfig` for transitions
- No new services needed — reuse existing `scriptureReadingService` methods
- No new store slices needed — reuse `scriptureReadingSlice` (may add local state for reflection form)

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-reflection-daily-prayer-report.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 1, Decision 4, Decision 5]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Structure Patterns, Format Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/design-system-foundation.md#BookmarkFlag, Components to Reuse]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/ux-consistency-patterns.md#Form Patterns, Validation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Touch Target Requirements, Keyboard & Focus]
- [Source: _bmad-output/test-design-epic-2.md#P0/P1 Test Coverage]
