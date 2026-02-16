# 3. Mood API

**Module:** `src/api/moodApi.ts`
**Singleton export:** `moodApi` (instance of `MoodApi`)

All responses are validated against Zod schemas (`SupabaseMoodSchema`, `MoodArraySchema`) before being returned.

## Custom Error Class

```typescript
class ApiValidationError extends Error {
  public readonly validationErrors: ZodError | null;
}
```

Thrown when Supabase returns data that does not match the Zod schema.

## Methods

### `create(moodData)`

```typescript
async create(moodData: MoodInsert): Promise<SupabaseMood>
```

- **Purpose:** Insert a mood entry into the `moods` table.
- **Validation:** Response validated via `SupabaseMoodSchema.parse()`.
- **Throws:** `ApiValidationError` on schema mismatch, `SupabaseServiceError` on DB error, network error if offline.

---

### `fetchByUser(userId, limit?)`

```typescript
async fetchByUser(userId: string, limit: number = 50): Promise<SupabaseMood[]>
```

- **Purpose:** Fetch moods for a user, ordered by `created_at` descending.
- **Validation:** Response validated via `MoodArraySchema.parse()`.

---

### `fetchByDateRange(userId, startDate, endDate)`

```typescript
async fetchByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<SupabaseMood[]>
```

- **Purpose:** Fetch moods within an ISO date range using `gte`/`lte` filters.

---

### `fetchById(moodId)`

```typescript
async fetchById(moodId: string): Promise<SupabaseMood | null>
```

- **Purpose:** Fetch a single mood by UUID.
- **Returns:** `null` if not found (`PGRST116`).

---

### `update(moodId, updates)`

```typescript
async update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood>
```

- **Purpose:** Partial update. Automatically sets `updated_at` to current time.
- **Validation:** Response validated via `SupabaseMoodSchema.parse()`.

---

### `delete(moodId)`

```typescript
async delete(moodId: string): Promise<void>
```

- **Purpose:** Delete a mood by UUID.

---

### `getMoodHistory(userId, offset?, limit?)`

```typescript
async getMoodHistory(
  userId: string,
  offset: number = 0,
  limit: number = 50
): Promise<SupabaseMood[]>
```

- **Purpose:** Paginated mood history using `range()`.

---
