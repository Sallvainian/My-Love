---
title: 'Fix Mood Tracker State & Display Bugs'
type: 'bugfix'
created: '2026-03-20'
status: 'done'
baseline_commit: '2605311'
context:
  - '_bmad-output/project-context.md'
---

# Fix Mood Tracker State & Display Bugs

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Multi-mood selections only show the first mood everywhere (Timeline, Calendar, Partner views). After logging, no confirmation state is shown. Logging once creates duplicate DB rows. Partner tab concatenates mood name and date label ("ExcitedYesterday").

**Approach:** Fix all display components to read `moods`/`mood_types` arrays instead of scalar fields. Add post-log confirmation state in MoodTracker. Remove duplicate `syncPendingMoods` call and add concurrency guard. Fix Partner mood card spacing.

## Boundaries & Constraints

**Always:**
- Backward-compatible: handle entries where `moods` is undefined (fall back to `[mood]`)
- Display multi-moods as comma-separated labels (e.g., "Excited, Grateful")
- Keep `mood` (singular) field populated as primary for backward compat

**Ask First:**
- Changes to Supabase schema or RLS policies
- Adding a unique constraint on (user_id, date) to prevent server-side duplicates

**Never:**
- Refactor the mood data model or rename fields
- Change the sync architecture (offline-first with background sync)
- Touch unrelated features

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single mood logged | `moods: ["happy"]` | All views show "Happy" | N/A |
| Multi-mood logged | `moods: ["excited", "grateful"]` | All views show "Excited, Grateful" | N/A |
| Legacy entry (no `moods` field) | `mood: "happy", moods: undefined` | All views show "Happy" (fallback) | N/A |
| Mood already logged today | User opens MoodTracker | Shows confirmation: "You're feeling: X, Y" with Update button | N/A |
| Double-submit race | Two `syncPendingMoods` calls overlap | Only one runs; second is skipped via `isSyncing` guard | Second call returns early |
| Partner mood with multi-mood | `mood_types: ["sad", "lonely"]` | Partner widget + history show "Sad, Lonely" | N/A |

</frozen-after-approval>

## Code Map

- `src/components/MoodTracker/MoodTracker.tsx` -- Mood logger; missing post-log confirmation, duplicate sync call at line 207
- `src/components/MoodTracker/MoodHistoryItem.tsx` -- Timeline item; reads `mood.mood_type` (singular) at line 51/61
- `src/components/MoodTracker/PartnerMoodDisplay.tsx` -- Partner current mood widget; reads `partnerMood.mood_type` at line 104
- `src/components/MoodHistory/CalendarDay.tsx` -- Calendar cell; reads `mood.mood` at lines 92/104
- `src/components/MoodHistory/MoodDetailModal.tsx` -- Calendar detail; reads `mood.mood` at line 89
- `src/components/PartnerMoodView/PartnerMoodView.tsx` -- Partner mood history card; reads `moodEntry.mood` at line 622, missing whitespace at lines 644-646
- `src/stores/slices/moodSlice.ts` -- `addMoodEntry` calls `syncPendingMoods` at line 91; no concurrency guard

## Tasks & Acceptance

**Execution:**
- [ ] `src/stores/slices/moodSlice.ts` -- Add `isSyncing` early-return guard at top of `syncPendingMoods` to prevent concurrent runs
- [ ] `src/components/MoodTracker/MoodTracker.tsx` -- Remove duplicate `syncPendingMoods()` call at line 207 (already called inside `addMoodEntry`). Fix `useEffect` dependency at line 134 to re-fire when `moods` state changes so `isEditing` updates after logging.
- [ ] `src/components/MoodTracker/MoodHistoryItem.tsx` -- Read `mood.mood_types` array (fallback to `[mood.mood_type]`), display comma-joined labels
- [ ] `src/components/MoodHistory/CalendarDay.tsx` -- Read `mood.moods` array (fallback to `[mood.mood]`) for aria-label and bg color (use first mood's color)
- [ ] `src/components/MoodHistory/MoodDetailModal.tsx` -- Read `mood.moods` array, display all mood labels/icons
- [ ] `src/components/MoodTracker/PartnerMoodDisplay.tsx` -- Read `partnerMood.mood_types` array (fallback to `[partnerMood.mood_type]`), display comma-joined labels
- [ ] `src/components/PartnerMoodView/PartnerMoodView.tsx` -- Read `moodEntry.moods` array (fallback to `[moodEntry.mood]`), display comma-joined labels. Add literal space or `gap` between mood label and date spans (lines 644-646).

**Acceptance Criteria:**
- Given a multi-mood entry (e.g., Excited + Grateful), when viewing Timeline/Calendar/Partner views, then all moods are displayed (not just the first)
- Given a user who just logged a mood, when looking at the MoodTracker, then it shows the logged mood(s) with an "Update Mood" button instead of the empty selector
- Given a user logging a mood once, when sync completes, then exactly 1 row exists in Supabase (no duplicates)
- Given the Partner tab mood history, when viewing mood cards, then mood name and date label have visible spacing between them

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors
- `npm run lint` -- expected: no errors
- `npm run test:unit` -- expected: all pass
- `npm run format` -- expected: formats changed files

## Suggested Review Order

**Duplicate sync elimination (root cause of duplicate DB rows)**

- Concurrency guard: early-return if already syncing
  [`moodSlice.ts:205`](/src/stores/slices/moodSlice.ts#L205)

- Removed duplicate `syncPendingMoods` call; only offline branch remains
  [`MoodTracker.tsx:204`](/src/components/MoodTracker/MoodTracker.tsx#L204)

**Post-log confirmation state**

- Added `moods` store dependency so effect re-fires after logging
  [`MoodTracker.tsx:78`](/src/components/MoodTracker/MoodTracker.tsx#L78)

- Effect now detects today's mood and sets `isEditing = true`
  [`MoodTracker.tsx:152`](/src/components/MoodTracker/MoodTracker.tsx#L152)

**Multi-mood display across all views**

- Timeline: reads `mood_types` array, shows all emojis and comma-joined labels
  [`MoodHistoryItem.tsx:38`](/src/components/MoodTracker/MoodHistoryItem.tsx#L38)

- Calendar cell: reads `moods` array, first mood for color/icon, all for aria-label
  [`CalendarDay.tsx:70`](/src/components/MoodHistory/CalendarDay.tsx#L70)

- Calendar modal: renders icon per mood, comma-joined heading
  [`MoodDetailModal.tsx:89`](/src/components/MoodHistory/MoodDetailModal.tsx#L89)

- Partner widget: reads `mood_types` array, shows all emojis and labels
  [`PartnerMoodDisplay.tsx:105`](/src/components/MoodTracker/PartnerMoodDisplay.tsx#L105)

- Partner history card: reads `moods` array, flex gap fixes spacing bug
  [`PartnerMoodView.tsx:624`](/src/components/PartnerMoodView/PartnerMoodView.tsx#L624)
