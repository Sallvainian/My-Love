import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidInteractionType,
  validatePartnerId,
  validateInteraction,
  sanitizeInput,
  INTERACTION_ERRORS,
} from '@/utils/interactionValidation';

describe('isValidUUID', () => {
  it('accepts a valid UUID v4', () => {
    expect(isValidUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
  });

  it('accepts uppercase UUID', () => {
    expect(isValidUUID('123E4567-E89B-42D3-A456-426614174000')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('rejects non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidUUID(null as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidUUID(undefined as any)).toBe(false);
  });

  it('rejects malformed UUID', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('123e4567-e89b-62d3-a456-426614174000')).toBe(false); // version 6 not in range
  });

  it('trims whitespace before validation', () => {
    expect(isValidUUID('  123e4567-e89b-42d3-a456-426614174000  ')).toBe(true);
  });
});

describe('isValidInteractionType', () => {
  it('accepts poke', () => {
    expect(isValidInteractionType('poke')).toBe(true);
  });

  it('accepts kiss', () => {
    expect(isValidInteractionType('kiss')).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(isValidInteractionType('hug')).toBe(false);
    expect(isValidInteractionType('')).toBe(false);
  });
});

describe('validatePartnerId', () => {
  it('returns valid for a correct UUID', () => {
    const result = validatePartnerId('123e4567-e89b-42d3-a456-426614174000');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns invalid for null', () => {
    const result = validatePartnerId(null);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Partner ID is required');
  });

  it('returns invalid for malformed UUID', () => {
    const result = validatePartnerId('bad-uuid');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid partner ID format');
  });
});

describe('validateInteraction', () => {
  const validId = '123e4567-e89b-42d3-a456-426614174000';

  it('returns valid for correct partner ID and type', () => {
    expect(validateInteraction(validId, 'poke').isValid).toBe(true);
    expect(validateInteraction(validId, 'kiss').isValid).toBe(true);
  });

  it('returns invalid when partner ID is null', () => {
    const result = validateInteraction(null, 'poke');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Partner ID is required');
  });

  it('returns invalid for bad interaction type', () => {
    const result = validateInteraction(validId, 'slap');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid interaction type');
  });

  it('validates partner ID before interaction type', () => {
    const result = validateInteraction(null, 'bad-type');
    expect(result.error).toContain('Partner ID is required');
  });
});

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('truncates to 500 characters', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeInput(long)).toHaveLength(500);
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('INTERACTION_ERRORS', () => {
  it('contains all expected error keys', () => {
    expect(INTERACTION_ERRORS).toHaveProperty('NO_PARTNER');
    expect(INTERACTION_ERRORS).toHaveProperty('INVALID_UUID');
    expect(INTERACTION_ERRORS).toHaveProperty('INVALID_TYPE');
    expect(INTERACTION_ERRORS).toHaveProperty('NETWORK_ERROR');
    expect(INTERACTION_ERRORS).toHaveProperty('AUTH_ERROR');
    expect(INTERACTION_ERRORS).toHaveProperty('RATE_LIMIT');
    expect(INTERACTION_ERRORS).toHaveProperty('SERVER_ERROR');
    expect(INTERACTION_ERRORS).toHaveProperty('UNKNOWN_ERROR');
  });
});
