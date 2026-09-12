/**
 * `handleSupabaseError` — SQLSTATE/PostgREST `error.code` → user-message map
 *
 * The map in `src/api/errorHandlers.ts` is a bare object literal, and every
 * code it does NOT list falls through to `Database error: ` followed by the
 * original message, or a generic message when the original is missing or blank.
 * A meaningful message renders the raw Postgres sentence to the user. For a
 * CHECK-constraint rejection (SQLSTATE `23514`) that sentence names the table
 * and the constraint:
 *
 *   new row for relation "events" violates check constraint "events_label_check"
 *
 * `EventsSettings.tsx` displays a failed save's `saveFailure.error`, so
 * mapping on `code` keeps the raw CHECK message out of that error text.
 * The map is keyed on `error.code`, covering SQLSTATE and PostgREST codes.
 * `src/api/moodApi.ts`,
 * `src/api/interactionService.ts` and `src/services/eventsService.ts` route
 * database errors through it. Four other callers use it selectively, gated
 * by `isPostgrestError(error)` and SQLSTATE `23514`: `photoService.ts`
 * reports the mapped metadata-write message through an optional callback;
 * `notesSlice.ts` sets `notesError` for send/retry failures;
 * `partnerService.ts` replaces the original error's message for
 * send/accept/decline failures; and `scriptureReadingService.ts` wraps the
 * mapped message for reflection submission failures. Other errors retain
 * those callers' existing handling.
 *
 * This suite calls the mapper directly, pinning the `23514` entry, the other
 * mapped codes and the `Database error: ` fallback. It does not exercise
 * each caller's integration. `tests/api/empty-database-error-fallback.spec.ts`
 * also asserts CHECK mapping and fallback messages after SDK error parsing.
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
 * Optional `code` and missing, null, or numeric `message` values also model
 * malformed envelopes explicitly without weakening the production SDK types.
 */
interface WirePostgrestError {
  code?: string;
  message?: string | number | null;
  details: string | null;
  hint: string | null;
}

const asPostgrestError = (wire: WirePostgrestError): PostgrestError =>
  ({ name: 'PostgrestError', ...wire }) as unknown as PostgrestError;

const MISSING_OR_BLANK_MESSAGES: ReadonlyArray<[string, Pick<WirePostgrestError, 'message'>]> = [
  ['omitted', {}],
  ['undefined', { message: undefined }],
  ['null', { message: null }],
  ['empty', { message: '' }],
  ['spaces', { message: '   ' }],
  ['tabs and newlines', { message: '\t\n\r' }],
];

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
      ['23514', CHECK_VIOLATION_MESSAGE],
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

    describe.each(MISSING_OR_BLANK_MESSAGES)('with a %s message', (_label, messageFields) => {
      it.each(MAPPED)('%s keeps its mapped message', (code, expected) => {
        const err = handleSupabaseError(
          asPostgrestError({ code, ...messageFields, details: null, hint: null })
        );

        expect(err.message).toBe(expected);
        expect(err.code).toBe(code);
        expect(err.isNetworkError).toBe(false);
      });
    });
  });

  describe('unmapped codes', () => {
    // `tests/e2e/settings/events-crud.spec.ts:413-439` injects exactly this
    // code and asserts the surfaced text contains the raw message, so the
    // fallback must preserve meaningful messages and the exact prefix.
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

    it.each([
      [42, 'Database error: 42'],
      [0, 'Database error: 0'],
    ] as const)('preserves a numeric message of %s without throwing', (message, expected) => {
      const err = handleSupabaseError(
        asPostgrestError({ code: 'XX000', message, details: null, hint: null })
      );

      expect(err.message).toBe(expected);
      expect(err.code).toBe('XX000');
    });

    it.each([undefined, 'EventsService.createEvent'])(
      'preserves surrounding whitespace in meaningful messages with context %s',
      (context) => {
        const err = handleSupabaseError(
          asPostgrestError({
            code: 'XX000',
            message: '  Injected create failure \n',
            details: null,
            hint: null,
          }),
          context
        );

        const prefix = context ? '[EventsService.createEvent] ' : '';
        expect(err.message).toBe(`${prefix}Database error:   Injected create failure \n`);
      }
    );

    describe.each(MISSING_OR_BLANK_MESSAGES)('with a %s message', (_label, messageFields) => {
      it('uses a useful generic message for an unmapped code', () => {
        const err = handleSupabaseError(
          asPostgrestError({ code: 'XX000', ...messageFields, details: null, hint: null })
        );

        expect(err.message).toBe('Database error: An unknown database error occurred');
        expect(err.code).toBe('XX000');
      });

      it('uses the same fallback when the code is omitted', () => {
        const err = handleSupabaseError(
          asPostgrestError({ ...messageFields, details: null, hint: null })
        );

        expect(err.message).toBe('Database error: An unknown database error occurred');
        expect(err.code).toBeUndefined();
      });

      it('preserves context and diagnostics on the generic fallback', () => {
        const err = handleSupabaseError(
          asPostgrestError({
            code: 'XX000',
            ...messageFields,
            details: 'Original diagnostic details',
            hint: 'Original diagnostic hint',
          }),
          'EventsService.createEvent'
        );

        expect(err.message).toBe(
          '[EventsService.createEvent] Database error: An unknown database error occurred'
        );
        expect(err.code).toBe('XX000');
        expect(err.details).toBe('Original diagnostic details');
        expect(err.hint).toBe('Original diagnostic hint');
        expect(err.name).toBe('SupabaseServiceError');
        expect(err.isNetworkError).toBe(false);
      });
    });
  });
});
