# 8. Validation Schemas

**Module:** `src/api/validation/supabaseSchemas.ts`

All schemas use [Zod](https://zod.dev) for runtime validation at API boundaries.

## Common Schemas

| Schema | Validates |
|---|---|
| `UUIDSchema` | UUID v4 format string |
| `TimestampSchema` | ISO 8601 strings including PostgreSQL variants with microseconds and timezone offsets |

## Entity Schemas

### User Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseUserSchema` | Validate user rows | `id`, `partner_name`, `device_id`, `partner_id?`, `email?`, `display_name?` |
| `UserInsertSchema` | Validate user inserts | `id` (required), `partner_name?`, `device_id?` |
| `UserUpdateSchema` | Validate user updates | All fields optional |

### Mood Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseMoodSchema` | Validate mood rows | `id`, `user_id`, `mood_type`, `mood_types?` (array), `note?`, `created_at`, `updated_at` |
| `MoodInsertSchema` | Validate mood inserts | `user_id`, `mood_type` (required); `mood_types?`, `note?` (max 200 chars) |
| `MoodUpdateSchema` | Validate mood updates | All fields optional |

**Mood type enum:** `loved`, `happy`, `content`, `excited`, `thoughtful`, `grateful`, `sad`, `anxious`, `frustrated`, `angry`, `lonely`, `tired`

### Interaction Schemas

| Schema | Purpose | Key Fields |
|---|---|---|
| `SupabaseInteractionSchema` | Validate interaction rows | `id`, `type` (`poke` or `kiss`), `from_user_id`, `to_user_id`, `viewed?`, `created_at` |
| `InteractionInsertSchema` | Validate interaction inserts | `type`, `from_user_id`, `to_user_id` (required) |

### Message & Photo Schemas (placeholder)

| Schema | Purpose |
|---|---|
| `SupabaseMessageSchema` | Future: messages with category, tags, 1-500 char text |
| `SupabasePhotoSchema` | Future: photos with storage path, dimensions, MIME type |

## Array Schemas

| Schema | Wraps |
|---|---|
| `MoodArraySchema` | `z.array(SupabaseMoodSchema)` |
| `InteractionArraySchema` | `z.array(SupabaseInteractionSchema)` |
| `UserArraySchema` | `z.array(SupabaseUserSchema)` |

## Exported Types

All schemas export inferred TypeScript types: `SupabaseUser`, `SupabaseMood`, `SupabaseInteraction`, `MoodInsert`, `MoodUpdate`, `InteractionInsert`, `InteractionUpdate`, etc.

---
