---
title: 'Fix Mood Date Storage to Use Local Time'
type: 'bugfix'
created: '2026-03-20'
status: 'done'
baseline_commit: '986e1eb'
context:
  - '_bmad-output/project-context.md'
---

# Fix Mood Date Storage to Use Local Time

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mood dates are stored and queried using UTC (`toISOString().split('T')[0]`), but the Calendar view looks up moods using local dates (`formatDateKey`). A mood logged at 10:40 PM Eastern shows on the wrong day in Calendar vs Timeline.

**Approach:** Replace all UTC date extractions in mood code with `formatDateISO()` from `dateUtils.ts`, which uses local timezone. This aligns storage, lookup, and display on the same local date.

## Boundaries & Constraints

**Always:**
- Use `formatDateISO()` from `src/utils/dateUtils.ts` for all local date formatting
- Only touch mood-related date code

**Ask First:**
- Changes to non-mood features (e.g., messagesSlice also uses UTC dates)

**Never:**
- Change the Time Together timer (already correct — pure elapsed millisecond diff)
- Modify Supabase schema or `created_at` column behavior
- Touch `formatDateKey` in calendarHelpers (already correct, uses local time)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mood logged at 10:40 PM EST | `new Date()` = Mar 20 10:40 PM local | Stored as `2026-03-20` (local), shown on Mar 20 in Calendar AND Timeline | N/A |
| Mood logged at 2:40 AM UTC (same moment) | Same moment as above | Same result — local date wins | N/A |
| Partner mood from Supabase | `created_at: "2026-03-21T02:40:00Z"` | Extracted as `2026-03-20` (local) not `2026-03-21` (UTC) | N/A |
| getMoodsInRange query | Month boundaries (local dates) | Range strings use local dates matching stored format | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/dateUtils.ts:129` -- `formatDateISO()` — the correct local-time formatter (already exists)
- `src/services/moodService.ts:64,163,189-190` -- UTC date extraction in create, getMoodForDate, getMoodsInRange
- `src/stores/slices/moodSlice.ts:68` -- UTC today check in addMoodEntry
- `src/stores/slices/moodSlice.ts:319` -- UTC extraction of partner mood date from Supabase `created_at`
- `src/components/MoodTracker/MoodTracker.tsx:136` -- UTC today check in useEffect

## Tasks & Acceptance

**Execution:**
- [ ] `src/services/moodService.ts` -- Replace `toISOString().split('T')[0]` with `formatDateISO()` at lines 64, 163, 189, 190. Import `formatDateISO` from `../utils/dateUtils`.
- [ ] `src/stores/slices/moodSlice.ts` -- Replace `toISOString().split('T')[0]` at line 68 with `formatDateISO(new Date())`. Replace `createdAt.split('T')[0]` at line 319 with `formatDateISO(new Date(createdAt))`. Import `formatDateISO` from `../../utils/dateUtils`.
- [ ] `src/components/MoodTracker/MoodTracker.tsx` -- Replace `toISOString().split('T')[0]` at line 136 with `formatDateISO(new Date())`. Import `formatDateISO` from `../../utils/dateUtils`.

**Acceptance Criteria:**
- Given a mood logged near midnight local time, when viewing Calendar and Timeline, then the mood appears on the same local date in both views
- Given partner moods from Supabase, when displayed in Partner views, then dates reflect the partner's local time, not UTC

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run test:unit` -- expected: all pass
- `npm run format` -- expected: formats changed files
