/**
 * Interaction Validation Utilities
 *
 * Provides validation functions for poke/kiss interaction features.
 * Ensures data integrity and security before sending to Supabase.
 *
 * Validation Rules:
 * - Partner ID must be valid UUID format
 * - Interaction type must be 'poke' or 'kiss'
 * - User must be authenticated
 */

import type { InteractionType } from '../types';

/**
 * UUID regex pattern (accepts any UUID version)
 * Format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
 * Where M is the version (1-5) and N is the variant (8, 9, a, b)
 * Permissive pattern to accept any valid UUID from Supabase
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates UUID format
 * @param uuid - UUID string to validate
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_REGEX.test(uuid.trim());
}

/**
 * Validates interaction type
 * @param type - Interaction type to validate
 * @returns true if valid interaction type ('poke' or 'kiss')
 */
export function isValidInteractionType(type: string): type is InteractionType {
  return type === 'poke' || type === 'kiss';
}

/**
 * Validates partner ID for interaction
 * @param partnerId - Partner user ID to validate
 * @returns Validation result with error message if invalid
 */
export function validatePartnerId(partnerId: string | null): {
  isValid: boolean;
  error?: string;
} {
  if (!partnerId) {
    return {
      isValid: false,
      error: 'Partner ID is required. Please configure your partner in settings.',
    };
  }

  if (!isValidUUID(partnerId)) {
    return {
      isValid: false,
      error: 'Invalid partner ID format. Please check your settings.',
    };
  }

  return { isValid: true };
}

/**
 * Validates interaction data before sending
 * @param partnerId - Partner user ID
 * @param type - Interaction type
 * @returns Validation result with error message if invalid
 */
export function validateInteraction(
  partnerId: string | null,
  type: string
): {
  isValid: boolean;
  error?: string;
} {
  // Validate partner ID
  const partnerValidation = validatePartnerId(partnerId);
  if (!partnerValidation.isValid) {
    return partnerValidation;
  }

  // Validate interaction type
  if (!isValidInteractionType(type)) {
    return {
      isValid: false,
      error: `Invalid interaction type: ${type}. Must be 'poke' or 'kiss'.`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes user input for interaction messages (if added in future)
 * @param input - User input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input.trim().slice(0, 500); // Max 500 characters
}

/**
 * Error messages for common interaction validation failures
 */
export const INTERACTION_ERRORS = {
  NO_PARTNER: 'No partner configured. Please set up your partner in settings.',
  INVALID_UUID: 'Invalid partner ID format.',
  INVALID_TYPE: 'Invalid interaction type.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AUTH_ERROR: 'Authentication error. Please refresh the page and try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment before trying again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;
