import { ZodError, type ZodIssue } from 'zod/v4';

/**
 * Error message transformation utilities
 *
 * Converts Zod validation errors into user-friendly messages
 * for display in UI forms and error notifications.
 */

/**
 * Custom validation error class
 * Thrown when validation fails at service boundaries
 */
export class ValidationError extends Error {
  public readonly fieldErrors: Map<string, string>;

  constructor(message: string, fieldErrors?: Map<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors || new Map();
  }
}

/**
 * Maps technical field paths to user-friendly field names
 */
const FIELD_NAME_MAP: Record<string, string> = {
  text: 'Message',
  category: 'Category',
  tags: 'Tags',
  caption: 'Caption',
  imageBlob: 'Image',
  file: 'File',
  width: 'Width',
  height: 'Height',
  mimeType: 'File type',
  originalSize: 'Original size',
  compressedSize: 'Compressed size',
  date: 'Date',
  mood: 'Mood',
  note: 'Note',
  themeName: 'Theme',
  notificationTime: 'Notification time',
  'relationship.startDate': 'Relationship start date',
  'relationship.partnerName': 'Partner name',
  'relationship.anniversaries': 'Anniversaries',
  'customization.accentColor': 'Accent color',
  'customization.fontFamily': 'Font family',
  'notifications.enabled': 'Notifications enabled',
  'notifications.time': 'Notification time',
};

/**
 * Formats a Zod issue into a user-friendly error message
 */
function formatIssue(issue: ZodIssue): { field: string; message: string } {
  const path = issue.path.join('.');
  const fieldName = FIELD_NAME_MAP[path] || path || 'Field';

  // Use custom error messages from schemas, or fallback to default
  let message = issue.message;

  // Special handling for common error types
  switch (issue.code) {
    case 'too_small':
      // In Zod v4, check the minimum value directly
      if ('minimum' in issue) {
        if (issue.minimum === 1) {
          message = `${fieldName} cannot be empty`;
        } else {
          message = `${fieldName} must be at least ${issue.minimum} characters`;
        }
      }
      break;
    case 'too_big':
      // In Zod v4, check the maximum value directly
      if ('maximum' in issue) {
        message = `${fieldName} cannot exceed ${issue.maximum} characters`;
      }
      break;
    case 'invalid_value':
      message = `Invalid ${fieldName.toLowerCase()}. Please select a valid option.`;
      break;
    case 'invalid_type':
      if (issue.expected === 'date') {
        message = `${fieldName} must be a valid date`;
      } else {
        message = `${fieldName} has an invalid value`;
      }
      break;
    default:
      // Use the message from schema if available
      if (!message || message === 'Required') {
        message = `${fieldName} is required`;
      }
  }

  return { field: path, message };
}

/**
 * Transforms a ZodError into a user-friendly error message
 *
 * @param error - The ZodError to format
 * @returns A user-friendly error message string
 *
 * @example
 * try {
 *   const validated = MessageSchema.parse(input);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     const message = formatZodError(error);
 *     // message: "Message cannot be empty, Category must select a valid option"
 *   }
 * }
 */
export function formatZodError(error: ZodError): string {
  const fieldErrors = error.issues.map(formatIssue);

  if (fieldErrors.length === 0) {
    return 'Validation failed';
  }

  if (fieldErrors.length === 1) {
    return fieldErrors[0].message;
  }

  // Multiple errors: format as list
  return fieldErrors.map((err) => err.message).join(', ');
}

/**
 * Transforms a ZodError into a map of field-specific error messages
 * Useful for displaying errors next to form fields
 *
 * @param error - The ZodError to format
 * @returns Map of field paths to error messages
 *
 * @example
 * try {
 *   const validated = MessageSchema.parse(input);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     const fieldErrors = getFieldErrors(error);
 *     // fieldErrors.get('text') === 'Message cannot be empty'
 *     // fieldErrors.get('category') === 'Category must select a valid option'
 *   }
 * }
 */
export function getFieldErrors(error: ZodError): Map<string, string> {
  const fieldErrors = new Map<string, string>();

  error.issues.forEach((issue) => {
    const { field, message } = formatIssue(issue);
    // Only store first error for each field
    if (!fieldErrors.has(field)) {
      fieldErrors.set(field, message);
    }
  });

  return fieldErrors;
}

/**
 * Creates a ValidationError from a ZodError
 * Convenience function for service layer error handling
 *
 * @param error - The ZodError to wrap
 * @returns A ValidationError with user-friendly messages
 *
 * @example
 * try {
 *   const validated = MessageSchema.parse(input);
 * } catch (error) {
 *   if (error instanceof ZodError) {
 *     throw createValidationError(error);
 *   }
 *   throw error;
 * }
 */
export function createValidationError(error: ZodError): ValidationError {
  const message = formatZodError(error);
  const fieldErrors = getFieldErrors(error);
  return new ValidationError(message, fieldErrors);
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
