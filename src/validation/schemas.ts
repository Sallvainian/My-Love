import { z } from 'zod';
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
 * Full message schema for existing messages
 * Used when validating messages retrieved from IndexedDB
 */
export const MessageSchema = z.object({
  id: z.number().int().positive().optional(),
  text: z
    .string()
    .min(1, 'Message text cannot be empty')
    .max(
      VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH,
      `Message text cannot exceed ${VALIDATION_LIMITS.MESSAGE_TEXT_MAX_LENGTH} characters`
    ),
  category: MessageCategorySchema,
  isCustom: z.boolean(),
  active: z.boolean().default(true),
  createdAt: z.date(),
  isFavorite: z.boolean().optional(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
});

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

// Inferred TypeScript types from schemas
export type MessageSchemaType = z.infer<typeof MessageSchema>;
export type CreateMessageInputType = z.infer<typeof CreateMessageInputSchema>;
export type UpdateMessageInputType = z.infer<typeof UpdateMessageInputSchema>;

// ============================================================================
// Photo Validation
// ============================================================================

/**
 * MIME type validation for photos
 * Only JPEG, PNG, and WebP formats supported
 */
const PhotoMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Full photo schema for existing photos
 * Used when validating photos retrieved from IndexedDB
 */
export const PhotoSchema = z.object({
  id: z.number().int().positive().optional(),
  imageBlob: z.instanceof(Blob, { message: 'Image must be a valid Blob' }),
  caption: z.string().max(500, 'Caption cannot exceed 500 characters').optional(),
  tags: z.array(z.string()).default([]),
  uploadDate: z.date(),
  originalSize: z.number().positive('Original size must be a positive number'),
  compressedSize: z.number().positive('Compressed size must be a positive number'),
  width: z.number().int().positive('Width must be a positive integer'),
  height: z.number().int().positive('Height must be a positive integer'),
  mimeType: PhotoMimeTypeSchema,
});

/**
 * Schema for photo upload input from user
 * Validates form data before photo processing
 */
export const PhotoUploadInputSchema = z.object({
  file: z.instanceof(File, { message: 'Must provide a valid file' }),
  caption: z.string().max(500, 'Caption cannot exceed 500 characters').optional(),
  tags: z.string().optional(), // Comma-separated string, will be parsed to array
});

// Inferred TypeScript types from schemas
export type PhotoSchemaType = z.infer<typeof PhotoSchema>;
export type PhotoUploadInputType = z.infer<typeof PhotoUploadInputSchema>;

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

// Inferred TypeScript type from schema
export type MoodEntrySchemaType = z.infer<typeof MoodEntrySchema>;

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

// Inferred TypeScript types from schemas
export type SettingsSchemaType = z.infer<typeof SettingsSchema>;
export type AnniversarySchemaType = z.infer<typeof AnniversarySchema>;

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

export type CustomMessagesExportSchemaType = z.infer<typeof CustomMessagesExportSchema>;
