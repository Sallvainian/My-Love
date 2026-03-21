import { z } from 'zod/v4';
import { VALIDATION_LIMITS } from '../config/performance';

/**
 * Validation schemas for My Love app data models
 *
 * These schemas provide runtime validation to prevent data corruption
 * at service boundaries before IndexedDB writes. They complement
 * TypeScript's compile-time type checking with runtime validation.
 */

// ============================================================================
// Message Validation
// ============================================================================

/**
 * Message category enum validation
 * Ensures only valid categories are accepted
 */
const MessageCategorySchema = z.enum(['reason', 'memory', 'affirmation', 'future', 'custom']);

/**
 * Schema for creating new messages
 * Validates user input before message creation
 */
export const CreateMessageInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Message text cannot be empty')
    .max(
      VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH,
      `Message text cannot exceed ${VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH} characters`
    ),
  category: MessageCategorySchema,
  active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

/**
 * Schema for updating existing messages
 * All fields optional except id (partial update support)
 */
export const UpdateMessageInputSchema = z.object({
  id: z.number().int().positive(),
  text: z
    .string()
    .trim()
    .min(1, 'Message text cannot be empty')
    .max(
      VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH,
      `Message text cannot exceed ${VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH} characters`
    )
    .optional(),
  category: MessageCategorySchema.optional(),
  active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Photo Validation
// ============================================================================

/**
 * Schema for photo upload input from user
 * Validates form data before photo processing
 */
export const PhotoUploadInputSchema = z.object({
  file: z.instanceof(File, { message: 'Must provide a valid file' }),
  caption: z.string().max(500, 'Caption cannot exceed 500 characters').optional(),
  tags: z.string().optional(), // Comma-separated string, will be parsed to array
});

// ============================================================================
// Mood Validation
// ============================================================================

/**
 * Mood type enum validation
 * Ensures only valid mood types are accepted
 */
const MoodTypeSchema = z.enum([
  'loved',
  'happy',
  'content',
  'excited',
  'thoughtful',
  'grateful',
  'sad',
  'anxious',
  'frustrated',
  'angry',
  'lonely',
  'tired',
]);

/**
 * ISO date format validation (YYYY-MM-DD)
 * Ensures consistent date format across the app and validates actual date values
 */
const IsoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format (YYYY-MM-DD)')
  .refine((date) => {
    // Additional validation: check if date is actually valid
    const [_year, month, day] = date.split('-').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check if date is valid by parsing
    const dateObj = new Date(date);
    return dateObj.toISOString().startsWith(date);
  }, 'Invalid date values');

/**
 * Mood entry schema
 * Validates mood tracking data
 * Supports both single mood (backward compat) and multiple moods array
 */
export const MoodEntrySchema = z.object({
  date: IsoDateStringSchema,
  mood: MoodTypeSchema,
  moods: z.array(MoodTypeSchema).min(1, 'At least one mood must be selected').optional(),
  note: z.string().max(200, 'Note cannot exceed 200 characters').optional().or(z.literal('')),
});

// ============================================================================
// Settings Validation
// ============================================================================

/**
 * Theme name enum validation
 * Ensures only valid themes are accepted
 */
const ThemeNameSchema = z.enum(['sunset', 'ocean', 'lavender', 'rose']);

/**
 * Time format validation (HH:MM)
 * Ensures consistent time format for notifications and validates hour/minute ranges
 */
const TimeFormatSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
  .refine((time) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }, 'Invalid time values (hour must be 00-23, minute must be 00-59)');

/**
 * Anniversary schema for relationship milestones
 */
const AnniversarySchema = z.object({
  id: z.number().int().positive(),
  date: IsoDateStringSchema,
  label: z.string().min(1, 'Anniversary label cannot be empty'),
  description: z.string().optional(),
});

/**
 * Full settings schema with nested structures
 * Validates all app settings including relationship, customization, and notifications
 */
export const SettingsSchema = z.object({
  themeName: ThemeNameSchema,
  notificationTime: TimeFormatSchema,
  relationship: z.object({
    startDate: IsoDateStringSchema,
    partnerName: z.string().min(1, 'Partner name cannot be empty'),
    anniversaries: z.array(AnniversarySchema),
  }),
  customization: z.object({
    accentColor: z.string(),
    fontFamily: z.string(),
  }),
  notifications: z.object({
    enabled: z.boolean(),
    time: z.string(),
  }),
});

// ============================================================================
// Export Schema Validation
// ============================================================================

/**
 * Custom messages export schema
 * Validates data during import/export operations
 */
export const CustomMessagesExportSchema = z.object({
  version: z.literal('1.0'),
  exportDate: z.string(),
  messageCount: z.number().int().nonnegative(),
  messages: z.array(
    z.object({
      text: z.string().min(1).max(VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH),
      category: MessageCategorySchema,
      active: z.boolean(),
      tags: z.array(z.string()).optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
  ),
});

// ============================================================================
// Scripture Reading Validation (Story 1.1)
// ============================================================================

/**
 * Supabase scripture_sessions row schema
 * Validates RPC/query responses at the service boundary.
 * snapshot_json is optional because not all RPCs return it.
 */
export const SupabaseSessionSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['solo', 'together']),
  user1_id: z.string().uuid(),
  user2_id: z.string().uuid().nullable(),
  current_phase: z.enum(['lobby', 'countdown', 'reading', 'reflection', 'report', 'complete']),
  current_step_index: z.number().int().min(0),
  status: z.enum(['pending', 'in_progress', 'complete', 'abandoned']),
  version: z.number().int().min(1),
  snapshot_json: z.record(z.string(), z.unknown()).nullable().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

/**
 * Supabase scripture_reflections row schema
 */
export const SupabaseReflectionSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  step_index: z.number().int().min(0),
  user_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  is_shared: z.boolean(),
  created_at: z.string(),
});

/**
 * Supabase scripture_bookmarks row schema
 */
export const SupabaseBookmarkSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  step_index: z.number().int().min(0),
  user_id: z.string().uuid(),
  share_with_partner: z.boolean(),
  created_at: z.string(),
});

/**
 * Supabase scripture_messages row schema
 */
export const SupabaseMessageSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string(),
});

// Inferred TypeScript types from scripture schemas
export type SupabaseSession = z.infer<typeof SupabaseSessionSchema>;
export type SupabaseReflection = z.infer<typeof SupabaseReflectionSchema>;
export type SupabaseBookmark = z.infer<typeof SupabaseBookmarkSchema>;
export type SupabaseMessage = z.infer<typeof SupabaseMessageSchema>;
