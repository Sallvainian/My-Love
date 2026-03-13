# 4. Mood API Service

**Source:** `src/api/moodApi.ts`

## Overview

Provides validated CRUD operations for mood entries in the Supabase `moods` table. All API responses are validated through `SupabaseMoodSchema` (Zod) before being returned, ensuring type safety at the API boundary.

**Singleton:** `export const moodApi = new MoodApi()`

**Supabase table:** `moods`

## Error Classes

### `ApiValidationError`

```typescript
class ApiValidationError extends Error {
  readonly validationErrors: ZodError | null;
}
```

Thrown when a Supabase response fails Zod schema validation. Wraps the underlying `ZodError` for inspection.

## Methods

### `create(moodData: MoodInsert): Promise<SupabaseMood>`

Inserts a new mood entry.

**Query:** `supabase.from('moods').insert(moodData).select().single()`

**Validation:** Response validated via `SupabaseMoodSchema.parse(data)`

**Throws:**

- `SupabaseServiceError` -- on network/database error
- `ApiValidationError` -- if response fails Zod validation

**Precondition:** `isOnline()` check; throws network error if offline.

---

### `fetchByUser(userId: string, limit?: number): Promise<SupabaseMood[]>`

Fetches moods for a user, sorted by `created_at` descending.

**Query:** `supabase.from('moods').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)`

**Default limit:** `50`

**Validation:** `MoodArraySchema.parse(data || [])`

---

### `fetchByDateRange(userId: string, startDate: string, endDate: string): Promise<SupabaseMood[]>`

Fetches moods within an ISO date range using `.gte()` and `.lte()` filters on `created_at`.

**Validation:** `MoodArraySchema.parse(data || [])`

---

### `fetchById(moodId: string): Promise<SupabaseMood | null>`

Fetches a single mood by UUID. Returns `null` if not found (`PGRST116` handled gracefully).

**Query:** `supabase.from('moods').select('*').eq('id', moodId).single()`

**Validation:** `SupabaseMoodSchema.parse(data)`

---

### `update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood>`

Updates a mood entry. Automatically sets `updated_at` to current ISO timestamp.

**Query:** `supabase.from('moods').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', moodId).select().single()`

**Validation:** `SupabaseMoodSchema.parse(data)`

---

### `delete(moodId: string): Promise<void>`

Deletes a mood entry by UUID. No response validation (void return).

**Query:** `supabase.from('moods').delete().eq('id', moodId)`

---

### `getMoodHistory(userId: string, offset?: number, limit?: number): Promise<SupabaseMood[]>`

Paginated mood history using `.range()`.

**Query:** `supabase.from('moods').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)`

**Defaults:** `offset = 0`, `limit = 50`

**Validation:** `MoodArraySchema.parse(data || [])`

## Error Handling Pattern

All methods follow the same error handling pattern:

1. Check `isOnline()` -- throw `SupabaseServiceError` (network) if offline
2. Execute Supabase query
3. Validate response with Zod schema
4. On `ApiValidationError` -- re-throw as-is
5. On `PostgrestError` -- transform via `handleSupabaseError()`
6. On other errors -- transform via `handleNetworkError()`

## Types

```typescript
// From src/api/validation/supabaseSchemas.ts
type SupabaseMood = {
  id: string; // UUID
  user_id: string; // UUID
  mood_type: MoodType; // enum: loved|happy|content|excited|thoughtful|grateful|sad|anxious|frustrated|angry|lonely|tired
  mood_types: MoodType[] | null; // Multi-mood support (nullable for legacy records)
  note: string | null;
  created_at: string | null; // ISO timestamp
  updated_at: string | null; // ISO timestamp
};

type MoodInsert = {
  id?: string;
  user_id: string;
  mood_type: MoodType;
  mood_types?: MoodType[];
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};
```
