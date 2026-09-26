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

/**
 * An insert body as the `authenticated` role may send it: every column but
 * `created_at`, which that role's column grant omits
 * (`supabase/migrations/20260912020000_partner_only_immutable_interactions.sql:123`).
 * The server default `now()` then keeps each new row the newest.
 */
export function createInteractionInsert(
  overrides: Partial<Omit<SupabaseInteractionRecord, 'created_at'>> = {}
): Omit<SupabaseInteractionRecord, 'created_at'> {
  const { created_at: _createdAt, ...insert } = createInteractionRecord(overrides);
  return insert;
}
