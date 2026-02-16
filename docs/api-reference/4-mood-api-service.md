# 4. Mood API Service

**Source:** `src/api/moodApi.ts`

## Overview

The `MoodApi` class provides **Zod-validated** CRUD operations for mood entries in the Supabase `moods` table. Every response from Supabase is validated against `SupabaseMoodSchema` before being returned, ensuring type safety and data integrity at the API boundary.

## ApiValidationError Class

```typescript
class ApiValidationError extends Error {
  public readonly validationErrors: ZodError | null;
  constructor(message: string, validationErrors?: ZodError | null);
}
```

Thrown when a Supabase response fails Zod schema validation. The `validationErrors` property contains the raw `ZodError` for debugging.

## Methods

All methods check `isOnline()` before making network calls and throw `SupabaseServiceError` with `isNetworkError: true` when offline.

### `create(moodData: MoodInsert): Promise<SupabaseMood>`

Inserts a new mood entry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `moodData` | `MoodInsert` | Mood data (`user_id`, `mood_type`, `mood_types?`, `note?`, `created_at?`) |

**Query:** `supabase.from('moods').insert(moodData).select().single()`

**Validation:** Response parsed against `SupabaseMoodSchema`.

**Throws:** `ApiValidationError` on response validation failure, `SupabaseServiceError` on DB error.

### `fetchByUser(userId: string, limit?: number): Promise<SupabaseMood[]>`

Fetches moods for a specific user, sorted newest first.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | `string` | -- | User UUID |
| `limit` | `number` | `50` | Max results |

**Query:** `supabase.from('moods').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)`

**Validation:** Response parsed against `MoodArraySchema` (array of `SupabaseMoodSchema`).

### `fetchByDateRange(userId: string, startDate: string, endDate: string): Promise<SupabaseMood[]>`

Fetches moods within a date range.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User UUID |
| `startDate` | `string` | ISO timestamp (inclusive) |
| `endDate` | `string` | ISO timestamp (inclusive) |

**Query:** Uses `.gte('created_at', startDate).lte('created_at', endDate)`.

### `fetchById(moodId: string): Promise<SupabaseMood | null>`

Fetches a single mood by ID. Returns `null` for `PGRST116` (no rows found) instead of throwing.

### `update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood>`

Updates an existing mood. Automatically appends `updated_at: new Date().toISOString()`.

**Query:** `supabase.from('moods').update({ ...updates, updated_at }).eq('id', moodId).select().single()`

### `delete(moodId: string): Promise<void>`

Deletes a mood entry. No response validation needed.

**Query:** `supabase.from('moods').delete().eq('id', moodId)`

### `getMoodHistory(userId: string, offset?: number, limit?: number): Promise<SupabaseMood[]>`

Paginated mood history.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `userId` | `string` | -- | User UUID |
| `offset` | `number` | `0` | Starting position |
| `limit` | `number` | `50` | Page size |

**Query:** Uses `.range(offset, offset + limit - 1)` for server-side pagination.

## Singleton

```typescript
export const moodApi = new MoodApi();
```

## Validation Schemas Used

- `SupabaseMoodSchema` -- validates individual mood records
- `MoodArraySchema` -- validates arrays of mood records (wraps `SupabaseMoodSchema`)
- `MoodInsert` type -- inferred from `MoodInsertSchema` for input validation

All schemas are defined in `src/api/validation/supabaseSchemas.ts`.
