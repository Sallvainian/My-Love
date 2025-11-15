/**
 * Validation module exports
 *
 * Centralized validation infrastructure for My Love app
 * Provides Zod schemas and error handling utilities
 */

// Export all schemas
export {
  MessageSchema,
  CreateMessageInputSchema,
  UpdateMessageInputSchema,
  PhotoSchema,
  PhotoUploadInputSchema,
  MoodEntrySchema,
  SettingsSchema,
  CustomMessagesExportSchema,
  type MessageSchemaType,
  type CreateMessageInputType,
  type UpdateMessageInputType,
  type PhotoSchemaType,
  type PhotoUploadInputType,
  type MoodEntrySchemaType,
  type SettingsSchemaType,
  type AnniversarySchemaType,
  type CustomMessagesExportSchemaType,
} from './schemas';

// Export error handling utilities
export {
  ValidationError,
  formatZodError,
  getFieldErrors,
  createValidationError,
  isValidationError,
  isZodError,
} from './errorMessages';
