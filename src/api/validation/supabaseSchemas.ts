import { z } from 'zod';

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
const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * ISO timestamp schema for Supabase timestamps
 */
const TimestampSchema = z.string().datetime('Invalid timestamp format');

// ============================================================================
// User Schemas
// ============================================================================

/**
 * Supabase User Row Schema
 * Validates user records from the users table
 */
export const SupabaseUserSchema = z.object({
  id: UUIDSchema,
  partner_name: z.string().nullable(),
  device_id: z.string(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * User insert input schema
 */
export const UserInsertSchema = z.object({
  id: UUIDSchema,
  partner_name: z.string().nullable().optional(),
  device_id: z.string().optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

/**
 * User update input schema
 */
export const UserUpdateSchema = z.object({
  id: UUIDSchema.optional(),
  partner_name: z.string().nullable().optional(),
  device_id: z.string().optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

// ============================================================================
// Mood Schemas
// ============================================================================

/**
 * Mood type enum schema (matches database constraint)
 */
const MoodTypeSchema = z.enum(['loved', 'happy', 'content', 'thoughtful', 'grateful']);

/**
 * Supabase Mood Row Schema
 * Validates mood records from the moods table
 */
export const SupabaseMoodSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema,
  note: z.string().nullable(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

/**
 * Mood insert input schema
 */
export const MoodInsertSchema = z.object({
  id: UUIDSchema.optional(),
  user_id: UUIDSchema,
  mood_type: MoodTypeSchema,
  note: z.string().max(200, 'Note cannot exceed 200 characters').nullable().optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

/**
 * Mood update input schema
 */
export const MoodUpdateSchema = z.object({
  id: UUIDSchema.optional(),
  user_id: UUIDSchema.optional(),
  mood_type: MoodTypeSchema.optional(),
  note: z.string().max(200, 'Note cannot exceed 200 characters').nullable().optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

// ============================================================================
// Interaction Schemas
// ============================================================================

/**
 * Interaction type enum schema (matches database constraint)
 */
const InteractionTypeSchema = z.enum(['poke', 'kiss']);

/**
 * Supabase Interaction Row Schema
 * Validates interaction records from the interactions table
 */
export const SupabaseInteractionSchema = z.object({
  id: UUIDSchema,
  type: InteractionTypeSchema,
  from_user_id: UUIDSchema,
  to_user_id: UUIDSchema,
  viewed: z.boolean(),
  created_at: TimestampSchema,
});

/**
 * Interaction insert input schema
 */
export const InteractionInsertSchema = z.object({
  id: UUIDSchema.optional(),
  type: InteractionTypeSchema,
  from_user_id: UUIDSchema,
  to_user_id: UUIDSchema,
  viewed: z.boolean().optional(),
  created_at: TimestampSchema.optional(),
});

/**
 * Interaction update input schema
 */
export const InteractionUpdateSchema = z.object({
  id: UUIDSchema.optional(),
  type: InteractionTypeSchema.optional(),
  from_user_id: UUIDSchema.optional(),
  to_user_id: UUIDSchema.optional(),
  viewed: z.boolean().optional(),
  created_at: TimestampSchema.optional(),
});

// ============================================================================
// Message Schemas (for future use)
// ============================================================================

/**
 * Message category enum schema
 */
const MessageCategorySchema = z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']);

/**
 * Supabase Message Schema (placeholder for future implementation)
 * Note: Messages table not yet implemented in Supabase
 */
export const SupabaseMessageSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  text: z.string().min(1).max(500),
  category: MessageCategorySchema,
  is_custom: z.boolean(),
  active: z.boolean(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  tags: z.array(z.string()).nullable(),
});

// ============================================================================
// Photo Schemas (for future use)
// ============================================================================

/**
 * Supabase Photo Schema (placeholder for future implementation)
 * Note: Photos table not yet implemented in Supabase
 */
export const SupabasePhotoSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  storage_path: z.string().min(1),
  caption: z.string().max(500).nullable(),
  tags: z.array(z.string()).nullable(),
  upload_date: TimestampSchema,
  original_size: z.number().positive(),
  compressed_size: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

// ============================================================================
// Array Response Schemas
// ============================================================================

/**
 * Array of moods schema
 * Validates responses from queries that return multiple mood records
 */
export const MoodArraySchema = z.array(SupabaseMoodSchema);

/**
 * Array of interactions schema
 * Validates responses from queries that return multiple interaction records
 */
export const InteractionArraySchema = z.array(SupabaseInteractionSchema);

/**
 * Array of users schema
 * Validates responses from queries that return multiple user records
 */
export const UserArraySchema = z.array(SupabaseUserSchema);

// ============================================================================
// Exported Types
// ============================================================================

export type SupabaseUser = z.infer<typeof SupabaseUserSchema>;
export type SupabaseMood = z.infer<typeof SupabaseMoodSchema>;
export type SupabaseInteraction = z.infer<typeof SupabaseInteractionSchema>;
export type SupabaseMessage = z.infer<typeof SupabaseMessageSchema>;
export type SupabasePhoto = z.infer<typeof SupabasePhotoSchema>;

export type UserInsert = z.infer<typeof UserInsertSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type MoodInsert = z.infer<typeof MoodInsertSchema>;
export type MoodUpdate = z.infer<typeof MoodUpdateSchema>;
export type InteractionInsert = z.infer<typeof InteractionInsertSchema>;
export type InteractionUpdate = z.infer<typeof InteractionUpdateSchema>;
