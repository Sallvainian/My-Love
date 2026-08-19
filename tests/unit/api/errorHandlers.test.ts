/**
 * `handleSupabaseError` — the SQLSTATE → user-message map
 *
 * The map in `src/api/errorHandlers.ts` is a bare object literal, and every
 * code it does NOT list falls through to `` `Database error: ${error.message}` ``
 * — which renders the raw Postgres sentence to the user. For a CHECK-constraint
 * rejection (SQLSTATE `23514`) that sentence names the table and the constraint:
 *
 *   new row for relation "events" violates check constraint "events_label_check"
 *
 * `EventsSettings.tsx` renders `error.message` and nothing else
 * (`src/components/Settings/EventsSettings.tsx:789-795`), so mapping on `code`
 * is what closes that leak. The map is keyed on SQLSTATE alone, so the one
 * entry covers every caller that routes through this function — which is
 * `src/api/moodApi.ts:14`, `src/api/interactionService.ts:23` and
 * `src/services/eventsService.ts:39`, and nothing else. `photoService.ts`,
 * `notesSlice.ts`, `partnerService.ts` and `scriptureReadingService.ts` never
 * import it and handle their own rejections, so they are NOT covered here.
 *
 * Nothing else in the repo asserts the map's contents, so a future edit could
 * silently drop a key. This file pins the new `23514` entry, the codes that
 * were already mapped, and the `Database error: ` fallback — which nothing
 * else pins: `tests/e2e/settings/events-crud.spec.ts:413-439` injects `XX000`
 * but asserts only that the surfaced text contains `Injected create failure`,
 * so it would still pass with the prefix removed.
 *
 * `SupabaseServiceError` is module-private, so assertions are on the returned
 * object's public fields (`message`, `code`, `details`, `hint`,
 * `isNetworkError`, `name`) — never `instanceof`.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';

import { handleSupabaseError } from '@/api/errorHandlers';

/** The user-facing text the `23514` key must produce. */
const CHECK_VIOLATION_MESSAGE = 'Some values are not allowed - check length and format limits';

/** The raw sentence Postgres emits for a failed CHECK on `public.events`. */
const RAW_CHECK_MESSAGE =
  'new row for relation "events" violates check constraint "events_label_check"';

/**
 * The PostgREST error envelope as it arrives on the wire.
 *
 * `details` and `hint` are sent as JSON `null` for most rejections, but the
 * SDK's `PostgrestError` class types both as plain `string`
 * (`@supabase/postgrest-js` `dist/index.d.mts:26-29`). The cast keeps the
 * nullable reality — which is what `handleSupabaseError` actually passes
 * through — instead of substituting empty strings the server never sent.
 */
interface WirePostgrestError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

const asPostgrestError = (wire: WirePostgrestError): PostgrestError =>
  ({ name: 'PostgrestError', ...wire }) as unknown as PostgrestError;

const checkViolation = (): PostgrestError =>
  asPostgrestError({
    code: '23514',
    message: RAW_CHECK_MESSAGE,
    details: 'Failing row contains (…).',
    hint: null,
  });

describe('handleSupabaseError', () => {
  describe('CHECK-constraint violations (23514)', () => {
    it('maps the code to the generic message with no context', () => {
      const err = handleSupabaseError(checkViolation());

      expect(err.message).toBe(CHECK_VIOLATION_MESSAGE);
    });

    it('leaks neither the raw message, the constraint name, nor the table name', () => {
      const err = handleSupabaseError(checkViolation());

      expect(err.message).not.toContain('check constraint');
      expect(err.message).not.toContain('events_label_check');
      expect(err.message).not.toContain('events');
      expect(err.message).not.toContain(RAW_CHECK_MESSAGE);
      // The fallback branch is what would have surfaced the raw sentence.
      expect(err.message).not.toContain('Database error:');
    });

    it('applies the context prefix the same way as every other code', () => {
      const err = handleSupabaseError(checkViolation(), 'EventsService.createEvent');

      expect(err.message).toBe(`[EventsService.createEvent] ${CHECK_VIOLATION_MESSAGE}`);
    });

    it('passes code, details and hint through unchanged and is not a network error', () => {
      const err = handleSupabaseError(checkViolation());

      expect(err.code).toBe('23514');
      expect(err.details).toBe('Failing row contains (…).');
      expect(err.hint).toBeNull();
      expect(err.isNetworkError).toBe(false);
      expect(err.name).toBe('SupabaseServiceError');
    });
  });

  describe('codes that were already mapped', () => {
    const MAPPED: ReadonlyArray<[string, string]> = [
      ['23505', 'This record already exists'],
      ['23503', 'Referenced record not found'],
      ['23502', 'Required field is missing'],
      ['42501', 'Permission denied - check Row Level Security policies'],
      ['42P01', 'Table not found - database schema may be out of sync'],
      ['PGRST116', 'No rows found'],
      ['PGRST301', 'Invalid request parameters'],
    ];

    it.each(MAPPED)('%s still maps to its own message', (code, expected) => {
      const err = handleSupabaseError(
        asPostgrestError({
          code,
          message: 'raw postgres text that must not surface',
          details: null,
          hint: null,
        })
      );

      expect(err.message).toBe(expected);
      expect(err.code).toBe(code);
      expect(err.isNetworkError).toBe(false);
    });
  });

  describe('unmapped codes', () => {
    // `tests/e2e/settings/events-crud.spec.ts:413-439` injects exactly this
    // code and asserts the surfaced text contains the raw message, so the
    // fallback is load-bearing. This is the only assertion on the prefix.
    it('falls back to "Database error: <message>"', () => {
      const err = handleSupabaseError(
        asPostgrestError({
          code: 'XX000',
          message: 'Injected create failure',
          details: '',
          hint: '',
        })
      );

      expect(err.message).toBe('Database error: Injected create failure');
      expect(err.code).toBe('XX000');
    });

    it('keeps the context prefix on the fallback branch', () => {
      const err = handleSupabaseError(
        asPostgrestError({
          code: 'XX000',
          message: 'Injected create failure',
          details: '',
          hint: '',
        }),
        'EventsService.createEvent'
      );

      expect(err.message).toBe('[EventsService.createEvent] Database error: Injected create failure');
    });
  });
});
