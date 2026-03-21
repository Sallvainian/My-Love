/**
 * Performance Configuration Constants
 */

/**
 * Validation length limits for text fields
 * Epic 5: Zod validation schemas (Story 5.5)
 */
export const VALIDATION_LIMITS = {
  /** Maximum message text length (messages, custom messages) */
  MESSAGE_TEXT_MAX_LENGTH: 1000,
  /** Maximum photo caption length */
  CAPTION_MAX_LENGTH: 500,
  /** Maximum mood note length */
  NOTE_MAX_LENGTH: 1000,
  /** Maximum partner name length */
  PARTNER_NAME_MAX_LENGTH: 50,
} as const;

/**
 * Log message truncation length for debugging
 */
export const LOG_TRUNCATE_LENGTH = 50;
