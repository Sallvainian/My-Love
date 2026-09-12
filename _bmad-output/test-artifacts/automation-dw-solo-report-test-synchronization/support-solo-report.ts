import { faker } from '@faker-js/faker';
import { MAX_STEPS } from '../../../src/data/scriptureSteps';
import type { Database } from '../../../src/types/database.types';

type ReflectionInsert = Database['public']['Tables']['scripture_reflections']['Insert'];

/** Shared session summary: completion depends on its presence, even without a rating. */
export function createPartnerSessionReflection(
  sessionId: string,
  partnerId: string,
  overrides: Partial<ReflectionInsert> = {}
): ReflectionInsert {
  return {
    id: faker.string.uuid(),
    session_id: sessionId,
    user_id: partnerId,
    step_index: MAX_STEPS,
    rating: null,
    is_shared: true,
    // First verse is intentional: the UI assertion names its scripture reference.
    notes: JSON.stringify({ standoutVerses: [0] }),
    ...overrides,
  };
}
