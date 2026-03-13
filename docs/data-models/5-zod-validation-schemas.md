# 5. Zod Validation Schemas

**Sources:**

- `src/validation/schemas.ts` -- Client-side schemas (IndexedDB boundary)
- `src/api/validation/supabaseSchemas.ts` -- API response schemas (Supabase boundary)

**Zod version:** v4 (`zod/v4`)

## Validation Architecture

Validation occurs at two boundaries:

1. **Service boundary** -- Before IndexedDB writes. Validates user input.
2. **API boundary** -- After Supabase reads. Validates server responses.

## Client-Side Schemas

### MessageSchema

| Field        | Schema                                   | Constraints                            |
| ------------ | ---------------------------------------- | -------------------------------------- |
| `id`         | `z.number().int().positive().optional()` | Auto-generated                         |
| `text`       | `z.string().min(1).max(1000)`            | Required, max from `VALIDATION_LIMITS` |
| `category`   | `z.enum([...])`                          | 5 categories                           |
| `isCustom`   | `z.boolean()`                            | Required                               |
| `active`     | `z.boolean().default(true)`              |                                        |
| `createdAt`  | `z.date()`                               | Required                               |
| `isFavorite` | `z.boolean().optional()`                 |                                        |
| `updatedAt`  | `z.date().optional()`                    |                                        |
| `tags`       | `z.array(z.string()).optional()`         |                                        |

### PhotoSchema

| Field            | Schema                                            | Constraints  |
| ---------------- | ------------------------------------------------- | ------------ |
| `id`             | `z.number().int().positive().optional()`          |              |
| `imageBlob`      | `z.instanceof(Blob)`                              | Must be Blob |
| `caption`        | `z.string().max(500).optional()`                  |              |
| `tags`           | `z.array(z.string()).default([])`                 |              |
| `uploadDate`     | `z.date()`                                        | Required     |
| `originalSize`   | `z.number().positive()`                           | Bytes        |
| `compressedSize` | `z.number().positive()`                           | Bytes        |
| `width`          | `z.number().int().positive()`                     | Pixels       |
| `height`         | `z.number().int().positive()`                     | Pixels       |
| `mimeType`       | `z.enum(['image/jpeg','image/png','image/webp'])` |              |

### MoodEntrySchema

| Field   | Schema                                             | Constraints                     |
| ------- | -------------------------------------------------- | ------------------------------- |
| `date`  | ISO date string                                    | YYYY-MM-DD with date validation |
| `mood`  | `z.enum([...12 types...])`                         | Primary mood                    |
| `moods` | `z.array(MoodType).min(1).optional()`              | Multi-mood                      |
| `note`  | `z.string().max(200).optional().or(z.literal(''))` | Allows empty                    |

### SettingsSchema

Nested object with:

- `themeName`: `z.enum(['sunset','ocean','lavender','rose'])`
- `notificationTime`: HH:MM regex with hour/minute range validation
- `relationship.startDate`: ISO date string
- `relationship.partnerName`: Non-empty string
- `relationship.anniversaries`: Array of `{ id, date, label, description? }`
- `customization.accentColor`, `customization.fontFamily`: Strings
- `notifications.enabled`: Boolean, `notifications.time`: String

### CustomMessagesExportSchema

```
{ version: '1.0', exportDate: string, messageCount: number, messages: [...] }
```

Each message: `{ text, category, active, tags, createdAt, updatedAt }`

### Scripture Schemas (Client-Side)

- **SupabaseSessionSchema**: `id`, `mode`, `user1_id`, `user2_id` (nullable), `current_phase` (6 enum), `current_step_index` (min 0), `status` (4 enum), `version` (min 1), `snapshot_json` (nullable record), `started_at`, `completed_at` (nullable)
- **SupabaseReflectionSchema**: `id`, `session_id`, `step_index`, `user_id`, `rating` (1-5, nullable), `notes` (nullable), `is_shared`, `created_at`
- **SupabaseBookmarkSchema**: `id`, `session_id`, `step_index`, `user_id`, `share_with_partner`, `created_at`
- **SupabaseMessageSchema**: `id`, `session_id`, `sender_id`, `message`, `created_at`

## API Response Schemas

### Common Base Schemas

- **UUIDSchema**: `z.string().uuid()`
- **TimestampSchema**: Regex-validated ISO 8601 supporting microseconds, optional timezone (`Z`, `+HH`, `+HH:MM`)

### SupabaseMoodSchema

| Field        | Schema                                    |
| ------------ | ----------------------------------------- |
| `id`         | UUID                                      |
| `user_id`    | UUID                                      |
| `mood_type`  | Enum (12 mood types)                      |
| `mood_types` | `z.array(MoodType).nullable().optional()` |
| `note`       | `z.string().nullable()`                   |
| `created_at` | Timestamp, nullable                       |
| `updated_at` | Timestamp, nullable                       |

### SupabaseInteractionSchema

`id`, `type` (poke/kiss), `from_user_id`, `to_user_id` (UUIDs), `viewed` (nullable boolean), `created_at` (nullable timestamp)

### SupabaseUserSchema

`id`, `partner_name` (nullable), `device_id` (nullable UUID), `partner_id` (nullable UUID, optional), `email` (nullable, optional), `display_name` (nullable, optional), timestamps (nullable)

### CoupleStatsSchema

`totalSessions` (int min 0), `totalSteps` (int min 0), `lastCompleted` (nullable timestamp), `avgRating` (0-5), `bookmarkCount` (int min 0)

### Insert/Update Schemas

Each entity has `*InsertSchema` (required fields + optional ID) and `*UpdateSchema` (all fields optional).

### Array Schemas

- `MoodArraySchema`: `z.array(SupabaseMoodSchema)`
- `InteractionArraySchema`: `z.array(SupabaseInteractionSchema)`
- `UserArraySchema`: `z.array(SupabaseUserSchema)`

## Inferred Types

All schemas export inferred TypeScript types:

```typescript
type SupabaseMood = z.infer<typeof SupabaseMoodSchema>;
type MoodInsert = z.infer<typeof MoodInsertSchema>;
type CoupleStats = z.infer<typeof CoupleStatsSchema>;
// etc.
```
