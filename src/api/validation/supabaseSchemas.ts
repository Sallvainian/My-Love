import { MOOD_TYPES } from '../../types/moods';
import { z } from 'zod/v4';

/**
 * Zod Validation Schemas for Supabase API Responses
 *
 * Provides runtime validation for all data returned from Supabase to ensure
 * type safety and data integrity. These schemas validate API responses before
 * data is used in the application, catching potential issues early.
 *
 * @module api/validation/supabaseSchemas
 */

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID schema for Supabase record IDs
 */
export const UUIDSchema = z.uuid({ error: 'Invalid UUID format' });

/**
 * ISO timestamp schema for Supabase timestamps
 * Uses regex to accept various ISO 8601 formats including:
 * - Microseconds: 2025-01-15T10:30:00.123456+00:00
 * - No timezone: 2025-01-15T10:30:00 (PostgreSQL default)
 * - UTC: 2025-01-15T10:30:00Z
 * - Timezone without colon: 2025-01-15T10:30:00+00
 * - Timezone with colon: 2025-01-15T10:30:00+00:00
 */
export const TimestampSchema = z.string().refine(
  (val) => {
    // Accept various PostgreSQL/ISO 8601 formats
    // Required: YYYY-MM-DDTHH:MM:SS
    // Optional: .fractional_seconds
    // Optional: timezone (Z, +HH, -HH, +HH:MM, -HH:MM, +HHMM, -HHMM)
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/;
    return isoRegex.test(val);
  },
  { error: 'Invalid timestamp format' }
);

// ============================================================================
// Mood Schemas
// ============================================================================

/**
 * Mood type enum schema (matches database constraint)
 * Includes both positive and negative emotions
 */
const MoodTypeSchema = z.enum(MOOD_TYPES);

/**
 * Supabase Mood Row Schema
 * Validates mood records from the moods table
 */
export const SupabaseMoodSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema, // Legacy single mood (kept for backward compatibility)
  mood_types: z.array(MoodTypeSchema).nullable().optional(), // New: multiple mood support (nullable for legacy records)
  note: z.string().nullable(),
  created_at: TimestampSchema.nullable(),
  updated_at: TimestampSchema.nullable(),
});

/**
 * Mood insert input schema
 */
export const MoodInsertSchema = z.object({
  id: UUIDSchema.optional(),
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema,
  mood_types: z.array(MoodTypeSchema).optional(), // New: multiple mood support
  note: z.string().max(200, 'Note cannot exceed 200 characters').nullable().optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

// ============================================================================
// Array Response Schemas
// ============================================================================

/**
 * Array of moods schema
 * Validates responses from queries that return multiple mood records
 */
export const MoodArraySchema = z.array(SupabaseMoodSchema);

// ============================================================================
// Exported Types
// ============================================================================

export type SupabaseMood = z.infer<typeof SupabaseMoodSchema>;
export type MoodInsert = z.infer<typeof MoodInsertSchema>;
