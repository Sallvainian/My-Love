/**
 * Unit: Zod Validation Schemas — Epic 1 (Scripture Reading)
 *
 * Validates the Supabase API response schemas for scripture sessions,
 * reflections, bookmarks, and messages. Ensures runtime validation
 * catches malformed data at the service boundary.
 *
 * Story 1.1: Task 5 (validation layer)
 */
import { describe, it, expect } from 'vitest';
import {
  SupabaseSessionSchema,
  SupabaseReflectionSchema,
  SupabaseBookmarkSchema,
  SupabaseMessageSchema,
} from '../../../src/validation/schemas';

// ============================================================================
// Valid fixtures
// ============================================================================

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_UUID_2 = 'b1ffcd00-0d1c-4fa9-8c7e-7cc0ce491b22';

function validSession(overrides = {}) {
  return {
    id: VALID_UUID,
    mode: 'solo' as const,
    user1_id: VALID_UUID_2,
    user2_id: null,
    current_phase: 'reading' as const,
    current_step_index: 0,
    status: 'in_progress' as const,
    version: 1,
    started_at: '2026-01-30T10:00:00Z',
    completed_at: null,
    ...overrides,
  };
}

function validReflection(overrides = {}) {
  return {
    id: VALID_UUID,
    session_id: VALID_UUID_2,
    step_index: 3,
    user_id: VALID_UUID_2,
    rating: 4,
    notes: 'This verse spoke to me deeply.',
    is_shared: false,
    created_at: '2026-01-30T12:00:00Z',
    ...overrides,
  };
}

function validBookmark(overrides = {}) {
  return {
    id: VALID_UUID,
    session_id: VALID_UUID_2,
    step_index: 5,
    user_id: VALID_UUID_2,
    share_with_partner: true,
    created_at: '2026-01-30T12:00:00Z',
    ...overrides,
  };
}

function validMessage(overrides = {}) {
  return {
    id: VALID_UUID,
    session_id: VALID_UUID_2,
    sender_id: VALID_UUID_2,
    message: 'Lord, thank you for this time.',
    created_at: '2026-01-30T12:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// SupabaseSessionSchema
// ============================================================================

describe('SupabaseSessionSchema', () => {
  it('should accept a valid solo session', () => {
    const result = SupabaseSessionSchema.safeParse(validSession());
    expect(result.success).toBe(true);
  });

  it('should accept a valid together session with user2_id', () => {
    const result = SupabaseSessionSchema.safeParse(
      validSession({ mode: 'together', user2_id: VALID_UUID_2 })
    );
    expect(result.success).toBe(true);
  });

  it('should accept all valid phases', () => {
    const phases = ['lobby', 'countdown', 'reading', 'reflection', 'report', 'complete'];
    for (const phase of phases) {
      const result = SupabaseSessionSchema.safeParse(validSession({ current_phase: phase }));
      expect(result.success, `Phase "${phase}" should be valid`).toBe(true);
    }
  });

  it('should accept all valid statuses', () => {
    const statuses = ['pending', 'in_progress', 'complete', 'abandoned'];
    for (const status of statuses) {
      const result = SupabaseSessionSchema.safeParse(validSession({ status }));
      expect(result.success, `Status "${status}" should be valid`).toBe(true);
    }
  });

  it('should accept completed session with completed_at timestamp', () => {
    const result = SupabaseSessionSchema.safeParse(
      validSession({
        status: 'complete',
        current_phase: 'complete',
        completed_at: '2026-01-30T11:00:00Z',
      })
    );
    expect(result.success).toBe(true);
  });

  it('should accept optional snapshot_json', () => {
    const result = SupabaseSessionSchema.safeParse(
      validSession({ snapshot_json: { key: 'value' } })
    );
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID id', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ id: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  it('should reject invalid mode', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ mode: 'invalid' }));
    expect(result.success).toBe(false);
  });

  it('should reject invalid phase', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ current_phase: 'unknown' }));
    expect(result.success).toBe(false);
  });

  it('should reject negative step index', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ current_step_index: -1 }));
    expect(result.success).toBe(false);
  });

  it('should reject version less than 1', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ version: 0 }));
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = SupabaseSessionSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID user1_id', () => {
    const result = SupabaseSessionSchema.safeParse(validSession({ user1_id: 'bad' }));
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SupabaseReflectionSchema
// ============================================================================

describe('SupabaseReflectionSchema', () => {
  it('should accept a valid reflection with rating and notes', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection());
    expect(result.success).toBe(true);
  });

  it('should accept reflection with null rating', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ rating: null }));
    expect(result.success).toBe(true);
  });

  it('should accept reflection with null notes', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ notes: null }));
    expect(result.success).toBe(true);
  });

  it('should accept rating values 1 through 5', () => {
    for (let r = 1; r <= 5; r++) {
      const result = SupabaseReflectionSchema.safeParse(validReflection({ rating: r }));
      expect(result.success, `Rating ${r} should be valid`).toBe(true);
    }
  });

  it('should reject rating below 1', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ rating: 0 }));
    expect(result.success).toBe(false);
  });

  it('should reject rating above 5', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ rating: 6 }));
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID session_id', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ session_id: 'bad' }));
    expect(result.success).toBe(false);
  });

  it('should reject negative step_index', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ step_index: -1 }));
    expect(result.success).toBe(false);
  });

  it('should accept is_shared as true', () => {
    const result = SupabaseReflectionSchema.safeParse(validReflection({ is_shared: true }));
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// SupabaseBookmarkSchema
// ============================================================================

describe('SupabaseBookmarkSchema', () => {
  it('should accept a valid bookmark', () => {
    const result = SupabaseBookmarkSchema.safeParse(validBookmark());
    expect(result.success).toBe(true);
  });

  it('should accept share_with_partner as false', () => {
    const result = SupabaseBookmarkSchema.safeParse(
      validBookmark({ share_with_partner: false })
    );
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID id', () => {
    const result = SupabaseBookmarkSchema.safeParse(validBookmark({ id: 'bad' }));
    expect(result.success).toBe(false);
  });

  it('should reject negative step_index', () => {
    const result = SupabaseBookmarkSchema.safeParse(validBookmark({ step_index: -1 }));
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = SupabaseBookmarkSchema.safeParse({ id: VALID_UUID });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SupabaseMessageSchema
// ============================================================================

describe('SupabaseMessageSchema', () => {
  it('should accept a valid scripture message', () => {
    const result = SupabaseMessageSchema.safeParse(validMessage());
    expect(result.success).toBe(true);
  });

  it('should accept empty string message', () => {
    const result = SupabaseMessageSchema.safeParse(validMessage({ message: '' }));
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID sender_id', () => {
    const result = SupabaseMessageSchema.safeParse(validMessage({ sender_id: 'bad' }));
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID session_id', () => {
    const result = SupabaseMessageSchema.safeParse(validMessage({ session_id: 'bad' }));
    expect(result.success).toBe(false);
  });

  it('should reject missing message field', () => {
    const { message: _, ...noMessage } = validMessage();
    const result = SupabaseMessageSchema.safeParse(noMessage);
    expect(result.success).toBe(false);
  });

  it('should reject missing created_at', () => {
    const { created_at: _, ...noCreatedAt } = validMessage();
    const result = SupabaseMessageSchema.safeParse(noCreatedAt);
    expect(result.success).toBe(false);
  });
});
