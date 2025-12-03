# Tech-Spec: Multi-Mood Selection Feature

**Created:** 2025-12-03
**Status:** Ready for Development

## Overview

### Problem Statement
The service worker (`sw.ts:78`) sends a `mood_types` array field during background sync, but this column doesn't exist in the database schema. This causes **all background mood syncs to fail with 400 errors**. The frontend already supports multi-mood selection, but the backend infrastructure is incomplete.

### Solution
Complete the multi-mood selection feature by:
1. Adding database migration for `mood_types` column
2. Fixing all sync paths to properly handle the array field
3. Updating display components to show multiple moods

### Scope

**In Scope:**
- Database migration for `mood_types TEXT[]` column
- Fix service worker sync transformation
- Update moodSyncService to include `mood_types`
- Update partner mood display to show multiple moods
- Update mood history components

**Out of Scope:**
- Mood analytics/insights based on multiple moods
- Mood combination suggestions
- Historical data migration (existing single moods remain as-is)

## Context for Development

### Codebase Patterns

**Validation Pattern:**
- Client-side: Zod schemas in `src/validation/schemas.ts`
- API-side: Zod schemas in `src/api/validation/supabaseSchemas.ts`
- Both schemas already have `mood_types` field prepared

**Sync Pattern:**
- Immediate sync: `moodSlice.ts` → `moodSyncService.ts` → `moodApi.ts`
- Background sync: `sw.ts` → Direct REST API to Supabase
- Both paths must include `mood_types` field

**Type Pattern:**
- Local type: `MoodEntry` with `mood` (primary) + `moods` (array)
- Supabase type: `SupabaseMood` with `mood_type` (primary) + `mood_types` (array)

### Files to Reference

| File | Role | Current State |
|------|------|---------------|
| `src/sw.ts:71-84` | Background sync transform | **BUG: Sends non-existent field** |
| `src/api/moodSyncService.ts:86-91` | Immediate sync transform | Missing `mood_types` |
| `src/api/moodApi.ts` | Supabase CRUD operations | Ready (uses schema) |
| `src/api/validation/supabaseSchemas.ts:101-109` | API validation | **Already has `mood_types`** |
| `src/validation/schemas.ts:174-179` | Client validation | **Already has `moods`** |
| `src/services/moodService.ts:161-198` | IndexedDB operations | **Already stores `moods`** |
| `src/stores/slices/moodSlice.ts:301-314` | Partner mood transform | Only reads `mood_type` |
| `src/components/MoodTracker/MoodTracker.tsx` | UI component | **Already supports multi-select** |
| `src/sw-db.ts:32-42` | SW IndexedDB types | **Already has `moods?: string[]`** |
| `docs/99-migrations/001_initial_schema.sql` | DB schema | Only has `mood_type` |

### Technical Decisions

1. **Backward Compatibility:** Keep `mood_type` as primary (first mood in array) for backward compatibility with existing data and queries
2. **Array Storage:** Use PostgreSQL `TEXT[]` for `mood_types` - native array type with good query support
3. **Nullable Array:** `mood_types` is nullable to support existing records without array data
4. **First Mood Primary:** When displaying a single mood (e.g., calendar dot), use `mood_type` (first/primary mood)

## Implementation Plan

### Tasks

- [ ] **Task 1: Database Migration** (CRITICAL - Do First)
  - Create migration `006_add_mood_types_array.sql`
  - Add `mood_types TEXT[]` column to moods table
  - No default value (nullable for backward compat)
  - Run migration in Supabase SQL Editor

- [ ] **Task 2: Fix Service Worker Sync** (CRITICAL)
  - File: `src/sw.ts:71-84`
  - Update `transformMoodForSupabase` to conditionally include `mood_types`
  - Only send `mood_types` if array has more than one mood
  - Handles both old (single) and new (multi) mood entries

- [ ] **Task 3: Update MoodSyncService Transform**
  - File: `src/api/moodSyncService.ts:86-91`
  - Add `mood_types: mood.moods` to `moodInsert` object
  - Ensure array is properly formatted for Supabase

- [ ] **Task 4: Update Partner Mood Transform**
  - File: `src/stores/slices/moodSlice.ts:301-314`
  - Add `moods: record.mood_types || [record.mood_type]` when transforming
  - Handle backward compat (old records have null `mood_types`)

- [ ] **Task 5: Update MoodSyncService Broadcast**
  - File: `src/api/moodSyncService.ts:117-170`
  - Include `mood_types` in broadcast payload
  - Update `subscribeMoodUpdates` to receive `mood_types`

- [ ] **Task 6: Update Partner Mood Display** (Optional Enhancement)
  - File: `src/components/MoodTracker/PartnerMoodDisplay.tsx`
  - Show all selected moods (icons + labels)
  - Primary mood emphasized, others shown smaller

- [ ] **Task 7: Update Mood History Display** (Optional Enhancement)
  - Files: `MoodHistoryTimeline.tsx`, `MoodHistoryItem.tsx`
  - Show all moods in history items
  - Primary mood icon prominent, others as badges

- [ ] **Task 8: Write Tests**
  - Unit tests for transform functions
  - E2E test for multi-mood sync flow
  - Test backward compat with single-mood entries

### Acceptance Criteria

- [ ] **AC-1:** Database migration adds `mood_types TEXT[]` column without breaking existing data
- [ ] **AC-2:** Background sync (service worker) successfully syncs moods without 400 errors
- [ ] **AC-3:** Immediate sync includes `mood_types` array in Supabase insert
- [ ] **AC-4:** Partner mood display shows all selected moods from partner
- [ ] **AC-5:** Existing single-mood entries continue to work (backward compatibility)
- [ ] **AC-6:** New multi-mood entries properly store and display all selected moods
- [ ] **AC-7:** All existing tests pass (no regressions)

## Additional Context

### Dependencies

- **Supabase Dashboard Access:** Required to run migration
- **No npm dependencies:** All required Zod schemas already exist

### Testing Strategy

1. **Unit Tests:**
   - `transformMoodForSupabase` function (both single and multi mood)
   - Partner mood transform (with and without `mood_types`)

2. **Integration Tests:**
   - Sync flow with multi-mood entry
   - IndexedDB → Supabase round-trip

3. **E2E Tests:**
   - Select multiple moods → Save → View in history
   - Background sync after offline period
   - Partner mood visibility

### Notes

**Why the bug exists:**
Someone prepared the frontend for multi-mood selection (UI, types, validation schemas, IndexedDB storage) but forgot to:
1. Create the database migration
2. Update the sync services to send the field

**Quick Fix vs Full Implementation:**
- **Quick Fix:** Just remove line 78 in `sw.ts` to stop 400 errors
- **Full Implementation:** Complete the feature as specified above

**Risk Assessment:**
- Migration is low-risk (additive column, nullable)
- Sync changes are medium-risk (test thoroughly)
- Display changes are low-risk (enhancement only)

### Migration SQL

```sql
-- Migration: 006_add_mood_types_array.sql
-- Purpose: Add mood_types array column for multi-mood selection
-- Created: 2025-12-03

-- Add mood_types column (nullable for backward compatibility)
ALTER TABLE moods
ADD COLUMN mood_types TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN moods.mood_types IS 'Array of mood types for multi-mood selection. Primary mood is always first element.';

-- Optional: Create index for array queries (if needed for filtering)
-- CREATE INDEX idx_moods_mood_types ON moods USING GIN (mood_types);

-- Verification query
-- SELECT id, mood_type, mood_types FROM moods LIMIT 5;
```

### Code Changes Summary

```typescript
// sw.ts - Fix transform function
function transformMoodForSupabase(mood: StoredMoodEntry, userId: string) {
  return {
    user_id: userId,
    mood_type: mood.mood,
    mood_types: mood.moods && mood.moods.length > 0 ? mood.moods : [mood.mood],
    note: mood.note || null,
    created_at: mood.timestamp instanceof Date
      ? mood.timestamp.toISOString()
      : new Date(mood.timestamp).toISOString(),
  };
}

// moodSyncService.ts - Update insert transform
const moodInsert: MoodEntryInsert = {
  user_id: mood.userId,
  mood_type: mood.mood,
  mood_types: mood.moods || [mood.mood],  // ADD THIS LINE
  note: mood.note || null,
  created_at: mood.timestamp.toISOString(),
};

// moodSlice.ts - Update partner mood transform
const transformedMoods: MoodEntry[] = partnerMoodRecords.map((record) => ({
  // ... existing fields ...
  mood: record.mood_type,
  moods: record.mood_types || [record.mood_type],  // ADD THIS LINE
  // ...
}));
```
