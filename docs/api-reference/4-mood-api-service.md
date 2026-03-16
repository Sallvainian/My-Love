# 4. Mood API Service

**Source:** `src/api/moodApi.ts`

## Purpose

Validated CRUD wrapper around Supabase for mood entries. All API responses are validated against Zod schemas before returning to the application.

## Class: `MoodApi`

Singleton exported as `moodApi`.

### `create(moodData: MoodInsert): Promise<SupabaseMood>`

Inserts a mood entry. Validates response with `SupabaseMoodSchema`. Checks `isOnline()` before executing.

### `fetchByUser(userId: string, limit?: number): Promise<SupabaseMood[]>`

Fetches moods for a user, ordered by `created_at DESC`. Default limit: 50. Validates with `MoodArraySchema`.

### `fetchByDateRange(userId, startDate, endDate): Promise<SupabaseMood[]>`

Fetches moods within an ISO date range using `gte`/`lte` filters.

### `fetchById(moodId: string): Promise<SupabaseMood | null>`

Fetches single mood. Returns `null` for `PGRST116` (not found). Validates with `SupabaseMoodSchema`.

### `update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood>`

Updates mood, auto-sets `updated_at`. Validates response.

### `delete(moodId: string): Promise<void>`

Deletes mood by ID. No response validation needed.

### `getMoodHistory(userId, offset?, limit?): Promise<SupabaseMood[]>`

Paginated mood history using `.range(offset, offset + limit - 1)`.

## Error Classes

### `ApiValidationError`

Thrown when Zod validation of server response fails. Contains `validationErrors: ZodError | null`.

## Error Handling Pattern

Every method follows:

1. Check `isOnline()` -- throw network error if offline
2. Execute Supabase query
3. Validate response with Zod schema
4. On validation error: throw `ApiValidationError`
5. On Postgrest error: `handleSupabaseError()`
6. On unknown error: `handleNetworkError()`

## Dependencies

- `src/api/supabaseClient`
- `src/api/validation/supabaseSchemas` (Zod schemas)
- `src/api/errorHandlers`
