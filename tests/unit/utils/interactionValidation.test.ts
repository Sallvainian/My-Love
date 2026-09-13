import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  isValidInteractionType,
  validatePartnerId,
  validateInteraction,
  validateIncomingInteraction,
  NoPartnerError,
  sanitizeInput,
  INTERACTION_ERRORS,
} from '@/utils/interactionValidation';
import type { SupabaseInteractionRecord } from '@/types';

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

describe('validateIncomingInteraction', () => {
  const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const PARTNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  function incoming(
    overrides: Partial<SupabaseInteractionRecord> = {}
  ): SupabaseInteractionRecord {
    return {
      id: 'incoming-1',
      type: 'poke',
      from_user_id: PARTNER,
      to_user_id: ME,
      viewed: false,
      created_at: '2026-09-12T12:00:00.000Z',
      ...overrides,
    };
  }

  it('accepts a row addressed to me and sent by my current partner', () => {
    expect(
      validateIncomingInteraction(incoming(), { currentUserId: ME, partnerId: PARTNER })
    ).toEqual({ isValid: true });
  });

  it('accepts a kiss as well as a poke', () => {
    expect(
      validateIncomingInteraction(incoming({ type: 'kiss' }), {
        currentUserId: ME,
        partnerId: PARTNER,
      }).isValid
    ).toBe(true);
  });

  it('rejects a row sent by anyone other than the current partner', () => {
    const result = validateIncomingInteraction(incoming({ from_user_id: STRANGER }), {
      currentUserId: ME,
      partnerId: PARTNER,
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Interaction was not sent by the current partner');
  });

  it('rejects a row addressed to another account', () => {
    const result = validateIncomingInteraction(incoming({ to_user_id: STRANGER }), {
      currentUserId: ME,
      partnerId: PARTNER,
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Interaction is addressed to another account');
  });

  it('rejects everything while the relationship is unknown', () => {
    const result = validateIncomingInteraction(incoming(), {
      currentUserId: ME,
      partnerId: null,
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toBe(INTERACTION_ERRORS.NO_PARTNER);
  });

  it('rejects everything when nobody is signed in', () => {
    const result = validateIncomingInteraction(incoming(), {
      currentUserId: null,
      partnerId: PARTNER,
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('rejects an interaction type the app does not render', () => {
    const result = validateIncomingInteraction(incoming({ type: 'hug' }), {
      currentUserId: ME,
      partnerId: PARTNER,
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid interaction type: hug.');
  });
});

describe('NoPartnerError', () => {
  it('carries the shared no-partner sentence and a name the UI can match on', () => {
    const error = new NoPartnerError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NoPartnerError');
    expect(error.message).toBe(INTERACTION_ERRORS.NO_PARTNER);
  });
});
