import { randomUUID } from 'node:crypto';
import type { SupabaseInteractionRecord } from '../../../src/api/interactionService';

/** Complete callback records; server tests override both participants with their worker pair. */
export function createInteractionRecord(
  overrides: Partial<SupabaseInteractionRecord> = {}
): SupabaseInteractionRecord {
  return {
    id: randomUUID(),
    type: 'poke',
    from_user_id: randomUUID(),
    to_user_id: randomUUID(),
    viewed: false,
    created_at: '2026-09-12T12:00:00.000Z',
    ...overrides,
  };
}
