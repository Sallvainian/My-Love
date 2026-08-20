/**
 * Composed fixture for the event-write error-code API and E2E specs.
 *
 * Target path once activated: `tests/support/fixtures/events-write-errors.ts`.
 * The generated specs import this target path. This copy is parked under
 * `test_artifacts` with them and is validated by copying all three files to
 * their target paths together.
 *
 * Pair-scoped cleanup remains owned by the existing `coupleEvents` fixture.
 * This wrapper adds the two authenticated actors plus checked operations for
 * the stale-row race; it never links/unlinks partners or resets a password.
 */
import { test as base, expect } from '../merged-fixtures';
import type { TestType } from '@playwright/test';
import { getUserAccessToken } from '../helpers/supabase';
import type { EventSpec, SeededEvent } from '../factories/events';
import type { Database } from '../../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

type EventWriteActor = {
  id: string;
  token: string;
};

type EventWriteSeedInput = Omit<EventSpec, 'owner'> & {
  /** `creator` and `self` are synonyms for the signed-in user. */
  owner: 'creator' | 'self' | 'partner';
};

export type EventWriteHarness = {
  creator: EventWriteActor;
  partner: EventWriteActor;
  seed: (input: EventWriteSeedInput) => Promise<SeededEvent>;
  /** Remove one row after proving it belongs to this worker's own pair. */
  remove: (eventId: string) => Promise<void>;
  /** Read one row and reject accidental access to another worker's data. */
  find: (eventId: string) => Promise<EventRow | null>;
};

type EventWriteFixtures = {
  eventWriteHarness: EventWriteHarness;
};

type EventWriteTest = typeof base extends TestType<infer T, infer W>
  ? TestType<T & EventWriteFixtures, W>
  : never;

// The explicit type prevents a nested-worktree TS2883 declaration from naming
// playwright-utils' transitive LogParams path while preserving every fixture
// already composed into the merged base.
export const test: EventWriteTest = base.extend<EventWriteFixtures>({
  eventWriteHarness: async ({ coupleEvents, supabaseAdmin }, use) => {
    const pairIds = new Set([coupleEvents.userId, coupleEvents.partnerId]);

    const find = async (eventId: string): Promise<EventRow | null> => {
      const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) {
        throw new Error(`eventWriteHarness.find: ${error.message}`);
      }
      if (data && !pairIds.has(data.user_id)) {
        throw new Error(
          `eventWriteHarness.find: ${eventId} belongs outside this worker's pair`
        );
      }

      return data;
    };

    const remove = async (eventId: string): Promise<void> => {
      const before = await find(eventId);
      if (!before) {
        throw new Error(`eventWriteHarness.remove: ${eventId} does not exist`);
      }

      const { data, error } = await supabaseAdmin
        .from('events')
        .delete()
        .eq('id', eventId)
        .select('id');

      if (error) {
        throw new Error(`eventWriteHarness.remove: ${error.message}`);
      }
      if (data?.length !== 1 || data[0]?.id !== eventId) {
        throw new Error(
          `eventWriteHarness.remove: expected ${eventId} back, got ${data?.length ?? 0} rows`
        );
      }
      if ((await find(eventId)) !== null) {
        throw new Error(`eventWriteHarness.remove: ${eventId} still exists after delete`);
      }
    };

    const [creatorToken, partnerToken] = await Promise.all([
      getUserAccessToken(supabaseAdmin, coupleEvents.userId),
      getUserAccessToken(supabaseAdmin, coupleEvents.partnerId),
    ]);

    await use({
      creator: { id: coupleEvents.userId, token: creatorToken },
      partner: { id: coupleEvents.partnerId, token: partnerToken },
      seed: async ({ owner, ...spec }) => {
        const [seeded] = await coupleEvents.seed([
          { ...spec, owner: owner === 'partner' ? 'partner' : 'self' },
        ]);
        if (!seeded) {
          throw new Error('eventWriteHarness.seed: no row returned');
        }
        return seeded;
      },
      remove,
      find,
    });
  },
});

export { expect };
