/**
 * Interaction Validation Utilities Tests
 *
 * Unit tests for interaction validation functions.
 * Tests UUID validation, interaction type validation, and comprehensive validation.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidInteractionType,
  validatePartnerId,
  validateInteraction,
  sanitizeInput,
  INTERACTION_ERRORS,
} from '../../../src/utils/interactionValidation';

describe('interactionValidation', () => {
  describe('isValidUUID', () => {
    it('should validate correct UUID v4 format', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];

      validUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUID formats', () => {
      const invalidUUIDs = [
        '',
        'not-a-uuid',
        '550e8400-e29b-41d4-a716',
        '550e8400e29b41d4a716446655440000',
        '550e8400-e29b-41d4-a716-446655440000-extra',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });

    it('should handle null and undefined', () => {
      expect(isValidUUID(null as any)).toBe(false);
      expect(isValidUUID(undefined as any)).toBe(false);
    });

    it('should trim whitespace before validation', () => {
      const uuidWithSpaces = '  550e8400-e29b-41d4-a716-446655440000  ';
      expect(isValidUUID(uuidWithSpaces)).toBe(true);
    });
  });

  describe('isValidInteractionType', () => {
    it('should accept valid interaction types', () => {
      expect(isValidInteractionType('poke')).toBe(true);
      expect(isValidInteractionType('kiss')).toBe(true);
    });

    it('should reject invalid interaction types', () => {
      expect(isValidInteractionType('hug')).toBe(false);
      expect(isValidInteractionType('wave')).toBe(false);
      expect(isValidInteractionType('')).toBe(false);
      expect(isValidInteractionType('POKE')).toBe(false);
      expect(isValidInteractionType('Kiss')).toBe(false);
    });
  });

  describe('validatePartnerId', () => {
    it('should return valid for correct partner ID', () => {
      const partnerId = '550e8400-e29b-41d4-a716-446655440000';
      const result = validatePartnerId(partnerId);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for null partner ID', () => {
      const result = validatePartnerId(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Partner ID is required');
    });

    it('should return error for empty string', () => {
      const result = validatePartnerId('');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Partner ID is required');
    });

    it('should return error for invalid UUID format', () => {
      const result = validatePartnerId('not-a-uuid');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid partner ID format');
    });
  });

  describe('validateInteraction', () => {
    const validPartnerId = '550e8400-e29b-41d4-a716-446655440000';

    it('should validate correct poke interaction', () => {
      const result = validateInteraction(validPartnerId, 'poke');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate correct kiss interaction', () => {
      const result = validateInteraction(validPartnerId, 'kiss');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for null partner ID', () => {
      const result = validateInteraction(null, 'poke');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail validation for invalid UUID', () => {
      const result = validateInteraction('invalid-uuid', 'poke');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid partner ID format');
    });

    it('should fail validation for invalid interaction type', () => {
      const result = validateInteraction(validPartnerId, 'hug');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid interaction type');
    });

    it('should fail for both invalid partner ID and type', () => {
      const result = validateInteraction('invalid', 'invalid');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
      expect(sanitizeInput('\n\tworld\t\n')).toBe('world');
    });

    it('should limit to 500 characters', () => {
      const longString = 'a'.repeat(1000);
      const sanitized = sanitizeInput(longString);

      expect(sanitized.length).toBe(500);
    });

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
    });

    it('should preserve content under 500 characters', () => {
      const input = 'Hello, this is a test message!';
      expect(sanitizeInput(input)).toBe(input);
    });
  });

  describe('INTERACTION_ERRORS', () => {
    it('should have all required error messages', () => {
      expect(INTERACTION_ERRORS.NO_PARTNER).toBeDefined();
      expect(INTERACTION_ERRORS.INVALID_UUID).toBeDefined();
      expect(INTERACTION_ERRORS.INVALID_TYPE).toBeDefined();
      expect(INTERACTION_ERRORS.NETWORK_ERROR).toBeDefined();
      expect(INTERACTION_ERRORS.AUTH_ERROR).toBeDefined();
      expect(INTERACTION_ERRORS.RATE_LIMIT).toBeDefined();
      expect(INTERACTION_ERRORS.SERVER_ERROR).toBeDefined();
      expect(INTERACTION_ERRORS.UNKNOWN_ERROR).toBeDefined();
    });

    it('should have non-empty error messages', () => {
      Object.values(INTERACTION_ERRORS).forEach((message) => {
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
