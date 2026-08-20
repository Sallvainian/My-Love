/**
 * A CHECK-constraint rejection (23514) as each adopter's caller sees it
 *
 * `tests/unit/api/errorHandlers.test.ts` pins the map itself: give
 * `handleSupabaseError` a `23514` and it returns the generic sentence. That is
 * the unit level, and it is complete. What it cannot show is that the key is
 * *reached* — every adopter routes a rejection through its own catch tail
 * first, and each tail has a branch that would swallow a `23514` before the map
 * ever sees it:
 *
 *   - `eventsService.createEvent`      -> `EventWriteError` short-circuit, then
 *                                          `isPostgrestError`, then `networkFailure`
 *     (`src/services/eventsService.ts:345-357`)
 *   - `interactionService.sendInteraction` -> `InteractionWriteError` short-circuit,
 *                                          then `isPostgrestError`, then `networkFailure`
 *     (`src/api/interactionService.ts:190-202`)
 *   - `moodApi.create`                 -> `ApiValidationError` short-circuit, then
 *                                          `isPostgrestError`, then `handleNetworkError`
 *     (`src/api/moodApi.ts:106-119`)
 *
 * A `23514` that lands in any of those network tails comes back as
 * "Network error: … Your changes will be synced when you're back online" — a
 * different wrong answer from the raw-Postgres one this story closed, and one
 * the map-level test cannot detect. That routing is what this file covers, for
 * all three modules that import `handleSupabaseError` (measured:
 * `grep -rln handleSupabaseError src/` returns 4 files, one of which is
 * `errorHandlers.ts` itself).
 *
 * The injected envelope is not hand-written. It comes from
 * `tests/support/check-constraint-envelopes.ts`, whose literals were measured
 * against this repo's running PostgREST under a signed-in user's JWT — which is
 * the role the browser client uses, and which gets `details: null` rather than
 * the failing row a service_role caller is shown. That distinction is not
 * cosmetic: `isPostgrestError` keys on the *presence* of `details`, and JSON
 * `null` still produces the property, so the guard passes and the map runs.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — with a builder that rejects whatever it is handed. Same idiom as
 * `tests/unit/services/eventsService.test.ts:173` and `./interactionService.test.ts:35`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  AUTHENTICATED_EVENTS_LABEL_CHECK,
  AUTHENTICATED_INTERACTIONS_TYPE_CHECK,
  AUTHENTICATED_MOODS_NOTE_CHECK,
  CHECK_VIOLATION_MESSAGE,
  LEAK_MARKERS,
  SERVICE_ROLE_EVENTS_ICON_CHECK,
  checkViolation,
  type PostgrestErrorEnvelope,
} from '../../support/check-constraint-envelopes';

const USER_ID = 'USER-A-ID';
const PARTNER_ID = 'USER-B-ID';

/**
 * The one wrong answer a map-level test cannot see. `handleNetworkError`
 * (`src/api/errorHandlers.ts:96`) closes with this, and a `23514` misrouted
 * into a network tail would carry it.
 */
const SYNC_PROMISE = "will be synced when you're back online";

/**
 * The slice of the PostgREST builder the three services use, over one injected
 * rejection. `insert`, `upsert`, `select` and `single` are the whole surface:
 *
 *   events       .from('events').insert(payload).select().single()
 *   interactions .from('interactions').insert(payload).select().single()
 *   moods        .from('moods').upsert(payload, { onConflict }).select().single()
 *
 * The table name is recorded so a test can prove the rejection it asserts on
 * came from the write it meant to drive, rather than from some other query the
 * service happened to issue first.
 */
class RejectingQuery implements PromiseLike<{ data: null; error: PostgrestErrorEnvelope }> {
  constructor(private readonly error: PostgrestErrorEnvelope) {}

  insert(): this {
    return this;
  }

  upsert(): this {
    return this;
  }

  select(): this {
    return this;
  }

  single(): this {
    return this;
  }

  then<TResult1 = { data: null; error: PostgrestErrorEnvelope }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: null; error: PostgrestErrorEnvelope }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: null, error: this.error }).then(onfulfilled, onrejected);
  }
}

const backend = {
  /** The envelope every query rejects with. Set per test. */
  nextError: AUTHENTICATED_EVENTS_LABEL_CHECK as PostgrestErrorEnvelope,
  /** Every table the code under test asked for, in order. */
  tables: [] as string[],

  reset(): void {
    this.nextError = AUTHENTICATED_EVENTS_LABEL_CHECK;
    this.tables = [];
  },
};

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      backend.tables.push(table);
      return new RejectingQuery(backend.nextError);
    },
  },
  getPartnerId: vi.fn(),
}));

import { eventsService } from '@/services/eventsService';
import { InteractionService } from '@/api/interactionService';
import { moodApi } from '@/api/moodApi';
import { isPostgrestError } from '@/api/errorHandlers';
import type { MoodInsert } from '@/api/validation/supabaseSchemas';

const interactionService = new InteractionService();

/** The public fields of the module-private `SupabaseServiceError`. */
interface ThrownServiceError extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
  isNetworkError?: boolean;
  cause?: unknown;
}

/** The rejection reason, so its message can be compared whole. */
async function rejection(promise: Promise<unknown>): Promise<ThrownServiceError> {
  const caught = await promise.then(
    () => null,
    (error: ThrownServiceError) => error
  );

  if (!caught) {
    throw new Error('expected the call to reject, but it resolved');
  }

  return caught;
}

/** Events adds its own machine-readable code and retains this mapped error as its cause. */
function mappedErrorOf(error: ThrownServiceError): ThrownServiceError {
  return error.cause instanceof Error ? (error.cause as ThrownServiceError) : error;
}

function moodInsert(overrides: Partial<MoodInsert> = {}): MoodInsert {
  return {
    user_id: USER_ID,
    mood_type: 'happy',
    mood_types: ['happy'],
    note: null,
    created_at: '2026-08-19T12:00:00.000Z',
    ...overrides,
  };
}

/** Drive each adopter's write. The label/note values are irrelevant to the
 *  injected rejection; they exist so the payload is a realistic one. */
const ADOPTERS = [
  {
    module: 'eventsService.createEvent',
    context: 'EventsService.createEvent',
    table: 'events',
    envelope: AUTHENTICATED_EVENTS_LABEL_CHECK,
    write: () =>
      eventsService.createEvent({
        userId: USER_ID,
        label: 'a label the database will reject',
        eventDate: '2030-01-01',
      }),
  },
  {
    module: 'interactionService.sendPoke',
    context: 'InteractionService.sendInteraction',
    table: 'interactions',
    envelope: AUTHENTICATED_INTERACTIONS_TYPE_CHECK,
    write: () => interactionService.sendPoke(PARTNER_ID, USER_ID),
  },
  {
    module: 'moodApi.create',
    context: 'MoodApi.create',
    table: 'moods',
    envelope: AUTHENTICATED_MOODS_NOTE_CHECK,
    write: () => moodApi.create(moodInsert()),
  },
] as const;

describe('a 23514 reaching the caller that issued the write', () => {
  beforeEach(() => {
    backend.reset();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    // Each catch tail logs through logSupabaseError; the thrown error is what
    // is under test, not the noise.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  describe('fake fidelity — the envelope these tests inject', () => {
    // `isPostgrestError` is the gate every adopter checks before calling
    // `handleSupabaseError`. An envelope it rejects would send all three
    // writes down their network tails instead, so this premise is asserted
    // rather than assumed.
    it.each(ADOPTERS.map((a) => [a.table, a.envelope] as const))(
      'the %s envelope is one isPostgrestError accepts',
      (_table, envelope) => {
        expect(isPostgrestError(envelope)).toBe(true);
      }
    );

    it('an envelope missing details is NOT accepted, which is why details is modelled', () => {
      const { details: _details, ...withoutDetails } = AUTHENTICATED_EVENTS_LABEL_CHECK;

      expect(isPostgrestError(withoutDetails)).toBe(false);
    });
  });

  describe.each(ADOPTERS)('$module', ({ module, context, table, envelope, write }) => {
    it('surfaces the mapped sentence, context-prefixed', async () => {
      backend.nextError = envelope;

      const error = await rejection(write() as Promise<unknown>);

      expect(error.message).toBe(`[${context}] ${CHECK_VIOLATION_MESSAGE}`);
      expect(backend.tables).toEqual([table]);
    });

    it('leaks no part of the raw Postgres sentence', async () => {
      backend.nextError = envelope;

      const error = await rejection(write() as Promise<unknown>);

      for (const marker of LEAK_MARKERS) {
        expect(error.message).not.toContain(marker);
      }
      // The constraint name and the table name are what the raw sentence
      // discloses, and both are substrings of `envelope.message`.
      expect(error.message).not.toContain(table);
      expect(error.message).not.toContain(envelope.message);
    });

    it('does not dress the rejection as a network failure', async () => {
      backend.nextError = envelope;

      const error = await rejection(write() as Promise<unknown>);
      const mappedError = mappedErrorOf(error);

      // The network tail is the other wrong answer: it promises a sync that
      // no queue exists to perform for any of these three modules.
      expect(error.message).not.toContain(SYNC_PROMISE);
      expect(error.message).not.toContain('Network error:');
      expect(mappedError.isNetworkError).toBe(false);
    });

    it('keeps the mapped code, details, hint and identity inspectable', async () => {
      backend.nextError = envelope;

      const error = await rejection(write() as Promise<unknown>);
      const mappedError = mappedErrorOf(error);

      if (module === 'eventsService.createEvent') {
        expect(error).toMatchObject({
          name: 'EventWriteError',
          code: 'transport',
          cause: mappedError,
        });
        expect(mappedError).not.toBe(error);
      } else {
        // The other adopters keep their established direct-error contract.
        expect(mappedError).toBe(error);
      }

      expect(mappedError.code).toBe('23514');
      // Both null on the wire for an authenticated caller, and both must
      // arrive that way rather than as '' — an empty string would read as
      // "the server sent nothing here", which is a different claim.
      expect(mappedError.details).toBeNull();
      expect(mappedError.hint).toBeNull();
      expect(mappedError.name).toBe('SupabaseServiceError');
    });

    it('keeps the failing row out of the message when a caller IS shown one', async () => {
      // The app never receives this envelope — `src/api/supabaseClient.ts:55`
      // builds the browser client with the publishable key, and Postgres
      // withholds `Failing row contains (…)` from that role. It is injected
      // here anyway because `details` is the only field that quotes the user's
      // own input back, and the mapping must keep it out of `.message`
      // regardless of which role produced it. `EventsSettings.tsx:789-797`
      // renders `.message` alone, so that is the boundary that matters.
      backend.nextError = { ...SERVICE_ROLE_EVENTS_ICON_CHECK };

      const error = await rejection(write() as Promise<unknown>);
      const mappedError = mappedErrorOf(error);

      expect(mappedError.details).toContain('Failing row contains');
      expect(error.message).not.toContain('Failing row contains');
      expect(error.message).toBe(`[${context}] ${CHECK_VIOLATION_MESSAGE}`);
    });
  });

  describe('the mapping is keyed on 23514 and nothing else', () => {
    // Without this, every assertion above would still pass if the map had been
    // widened to catch all of 235xx — and the tests could not tell a precise
    // fix from a blunt one. 23515 is exclusion_violation, the adjacent
    // SQLSTATE, and it is deliberately NOT in the map.
    it.each(ADOPTERS)('$module falls back for an adjacent SQLSTATE', async ({ context, write }) => {
      backend.nextError = checkViolation({
        code: '23515',
        message: 'conflicting key value violates exclusion constraint "x"',
      });

      const error = await rejection(write() as Promise<unknown>);
      const mappedError = mappedErrorOf(error);

      expect(error.message).toBe(
        `[${context}] Database error: conflicting key value violates exclusion constraint "x"`
      );
      expect(mappedError.code).toBe('23515');
    });
  });
});
