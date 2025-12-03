/**
 * Message Validation Utilities
 *
 * Provides validation and sanitization for Love Note messages.
 * Implements Story 2.2 AC-2.2.5 requirements:
 * - Max 1000 characters
 * - No empty messages
 * - XSS sanitization via DOMPurify
 *
 * @module utils/messageValidation
 */

import DOMPurify from 'dompurify';
import type { MessageValidationResult } from '../types/models';

/**
 * Maximum allowed message length
 */
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Validates message content against business rules
 *
 * @param content - The message content to validate
 * @returns Validation result with error message if invalid
 */
export function validateMessageContent(
  content: string
): MessageValidationResult {
  // Check for empty or whitespace-only messages
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: 'Message cannot be empty',
    };
  }

  // Check maximum length
  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: 'Message cannot exceed 1000 characters',
    };
  }

  // Message is valid
  return {
    valid: true,
  };
}

/**
 * Sanitizes message content to prevent XSS attacks
 *
 * Uses DOMPurify to strip dangerous HTML, scripts, and event handlers
 * while preserving safe text content.
 *
 * @param content - The message content to sanitize
 * @returns Sanitized message content safe for display
 */
export function sanitizeMessageContent(content: string): string {
  // Configure DOMPurify to strip all HTML tags
  // This is a text-only messaging app, so we don't need any HTML
  const config = {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Preserve text content
  };

  // Sanitize and return
  return DOMPurify.sanitize(content, config);
}
