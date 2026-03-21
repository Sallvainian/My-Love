/**
 * Validation module exports
 *
 * Centralized validation infrastructure for My Love app
 * Provides Zod schemas and error handling utilities
 */

// Export all schemas
export {
  CreateMessageInputSchema,
  CustomMessagesExportSchema,
  MessageSchema,
  MoodEntrySchema,
  PhotoSchema,
  PhotoUploadInputSchema,
  SettingsSchema,
  UpdateMessageInputSchema,
  type AnniversarySchemaType,
  type CreateMessageInputType,
  type CustomMessagesExportSchemaType,
  type MessageSchemaType,
  type MoodEntrySchemaType,
  type PhotoSchemaType,
  type PhotoUploadInputType,
  type SettingsSchemaType,
  type UpdateMessageInputType,
} from './schemas';

// Export error handling utilities
export {
  ValidationError,
  createValidationError,
  formatZodError,
  getFieldErrors,
  isValidationError,
  isZodError,
} from './errorMessages';
